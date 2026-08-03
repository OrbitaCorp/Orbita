import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthContext } from '../common/types/auth-context.type';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginResponse, PlatformAdminAuthResponse } from './auth.types';
import { GoogleIdentity } from './google-auth.service';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomInt } from 'crypto';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos
const MEMBER_REFRESH_DAYS = 7;
const CUSTOMER_REFRESH_DAYS = 30;
// Código de recuperación: 6 dígitos, 15 minutos, máximo 5 intentos fallidos
// antes de invalidarlo (espacio de 1.000.000 de valores — sin este límite es
// trivialmente adivinable por fuerza bruta en ese lapso).
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_CODE_ATTEMPTS = 5;
// Cuánto tiempo después de rotarse un refresh token se sigue aceptando, para
// tolerar pedidos concurrentes que salieron con la misma cookie (ver refresh()).
// Corto a propósito: cubre una carrera de milisegundos, no un token viejo.
const REFRESH_ROTATION_GRACE_MS = 30 * 1000;

export interface JwtPayload {
  sub: string;
  type: 'member' | 'customer' | 'platform_admin';
  businessId?: string; // ausente para platform_admin (identidad cross-tenant)
  iat?: number;
  exp?: number;
}

// Metadata de dispositivo para "sesiones activas" (RBT-631). La arma el
// controller desde el request (user-agent + IP) y viaja hasta createRefreshToken.
export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
    this.jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '15m';
  }

  // ── Register (storefront) ─────────────────────────────────────────────────

  async register(dto: RegisterDto, businessSlug: string): Promise<{ message: string }> {
    if (!businessSlug) throw new BadRequestException('Header X-Business-Slug requerido');

    const business = await this.prisma.business.findUnique({
      where: { subdomain: businessSlug },
      include: { storefrontConfig: { select: { storeName: true } } },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const existingCustomer = await this.prisma.customer.findFirst({
      where: { businessId: business.id, email: dto.email, deletedAt: null },
    });
    if (existingCustomer?.passwordHash) {
      throw new BadRequestException('Ya tenés cuenta en esta tienda. Iniciá sesión.');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    let customerId: string;
    if (existingCustomer) {
      await this.prisma.customer.update({
        where: { id: existingCustomer.id },
        data: { passwordHash, firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone, emailVerified: true },
      });
      customerId = existingCustomer.id;
    } else {
      const creado = await this.prisma.customer.create({
        data: {
          businessId: business.id,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          email: dto.email,
          phone: dto.phone ?? null,
          passwordHash,
          emailVerified: true,
        },
      });
      customerId = creado.id;
    }

    const storeName = business.storefrontConfig?.storeName ?? business.name;
    await this.mail.sendWelcome(dto.email, { storeName }, { businessId: business.id, customerId });

    return { message: 'Cuenta creada exitosamente. Iniciá sesión para continuar.' };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, businessSlug?: string, deviceInfo?: DeviceInfo): Promise<LoginResponse> {
    if (businessSlug) {
      const business = await this.prisma.business.findUnique({
        where: { subdomain: businessSlug },
      });
      if (!business) throw new UnauthorizedException('Credenciales inválidas');

      // Buscar como member de ESTE negocio primero.
      const member = await this.prisma.member.findFirst({
        where: { email: dto.email, businessId: business.id },
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } },
        },
      });

      if (member) {
        await this.checkLockout(member.lockedUntil);
        if (!member.passwordHash) throw new UnauthorizedException('Credenciales inválidas');

        const valid = await argon2.verify(member.passwordHash, dto.password);
        if (!valid) {
          await this.handleFailedLogin('member', member.id, member.failedLoginAttempts);
          throw new UnauthorizedException('Credenciales inválidas');
        }

        await this.prisma.member.update({
          where: { id: member.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastAccessAt: new Date() },
        });

        const token = this.signToken({ sub: member.id, type: 'member', businessId: business.id });
        const refreshToken = await this.createRefreshToken(member.id, 'MEMBER', business.id, deviceInfo);

        return {
          type: 'member',
          token,
          refreshToken,
          member: { id: member.id, name: member.name, email: member.email, status: member.status },
          role: member.role.name,
          permissions: member.role.rolePermissions.map((rp) => rp.permission.code),
          business: { id: business.id, name: business.name, subdomain: business.subdomain, mode: business.mode },
        };
      }

      // No es member → buscar como customer de ESTE negocio.
      const customer = await this.prisma.customer.findFirst({
        where: { email: dto.email, businessId: business.id, deletedAt: null },
      });

      if (!customer) {
        throw new ForbiddenException({
          error: 'NO_ACCOUNT_IN_BUSINESS',
          statusCode: 403,
          message: 'No tenés cuenta en esta tienda. Registrate para continuar.',
        });
      }

      await this.checkLockout(customer.lockedUntil);
      if (!customer.passwordHash) throw new UnauthorizedException('Credenciales inválidas');

      const valid = await argon2.verify(customer.passwordHash, dto.password);
      if (!valid) {
        await this.handleFailedLogin('customer', customer.id, customer.failedLoginAttempts);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });

      const token = this.signToken({ sub: customer.id, type: 'customer', businessId: business.id });
      const refreshToken = await this.createRefreshToken(customer.id, 'CUSTOMER', business.id, deviceInfo);

      return {
        type: 'customer',
        token,
        refreshToken,
        customer: { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email },
        business: { id: business.id, name: business.name, subdomain: business.subdomain, mode: business.mode },
      };
    }

    // Login sin slug (apex, orbita.site/login). Precedencia: PRIMERO super admin,
    // después member. Un super admin no está scopeado a ningún negocio, así que
    // su email es único global (a diferencia del de un member).
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email } });
    if (admin && admin.isActive) {
      await this.checkLockout(admin.lockedUntil);
      if (!admin.passwordHash) throw new UnauthorizedException('Credenciales inválidas');

      const valid = await argon2.verify(admin.passwordHash, dto.password);
      if (!valid) {
        await this.handleFailedLogin('platform_admin', admin.id, admin.failedLoginAttempts);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      await this.prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastAccessAt: new Date() },
      });

      return this.buildPlatformAdminResponse(admin, deviceInfo);
    }

    // No es super admin → buscar member por email en cualquier negocio.
    const member = await this.prisma.member.findFirst({
      where: { email: dto.email },
      include: {
        business: true,
        role: { include: { rolePermissions: { include: { permission: true } } } },
      },
    });

    if (!member || !member.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.checkLockout(member.lockedUntil);

    const valid = await argon2.verify(member.passwordHash, dto.password);
    if (!valid) {
      await this.handleFailedLogin('member', member.id, member.failedLoginAttempts);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.member.update({
      where: { id: member.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastAccessAt: new Date() },
    });

    const token = this.signToken({ sub: member.id, type: 'member', businessId: member.businessId });
    const refreshToken = await this.createRefreshToken(member.id, 'MEMBER', member.businessId, deviceInfo);

    return {
      type: 'member',
      token,
      refreshToken,
      member: { id: member.id, name: member.name, email: member.email, status: member.status },
      role: member.role.name,
      permissions: member.role.rolePermissions.map((rp) => rp.permission.code),
      business: {
        id: member.business.id,
        name: member.business.name,
        subdomain: member.business.subdomain,
        mode: member.business.mode,
      },
    };
  }

  // ── Refresh token ─────────────────────────────────────────────────────────

  async refresh(currentRefreshToken: string, deviceInfo?: DeviceInfo): Promise<{ token: string; refreshToken: string }> {
    const tokenHash = this.hashToken(currentRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (stored.revokedAt) {
      // Ventana de gracia SOLO para tokens revocados por rotación: dos pedidos
      // de refresh concurrentes con la misma cookie (p. ej. dos pestañas del
      // panel recargando a la vez) hacen que el segundo encuentre el token ya
      // consumido por el primero. Eso no es un token robado — quien lo
      // presenta demostró tener uno válido hace segundos — así que se le emite
      // un par nuevo en vez de matarle la sesión.
      //
      // Un token revocado por LOGOUT no tiene `replacedAt`, así que nunca
      // entra acá: cerrar sesión sigue siendo inmediato y definitivo.
      const rotadoReciMs = stored.replacedAt ? Date.now() - stored.replacedAt.getTime() : Infinity;
      if (rotadoReciMs > REFRESH_ROTATION_GRACE_MS) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }
    }

    // Rotación: revocar el actual y emitir uno nuevo. `replacedAt` marca que
    // fue por rotación (no por logout) — ver la ventana de gracia de arriba.
    const ahora = new Date();
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: stored.revokedAt ?? ahora, replacedAt: ahora },
    });

    const jwtType =
      stored.userType === 'MEMBER' ? 'member' : stored.userType === 'CUSTOMER' ? 'customer' : 'platform_admin';
    const token = this.signToken({ sub: stored.userId, type: jwtType, businessId: stored.businessId ?? undefined });
    const newRefreshToken = await this.createRefreshToken(stored.userId, stored.userType, stored.businessId, deviceInfo);

    return { token, refreshToken: newRefreshToken };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (stored && !stored.revokedAt) {
      await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto, businessSlug?: string): Promise<void> {
    if (businessSlug) {
      const business = await this.prisma.business.findUnique({ where: { subdomain: businessSlug } });
      if (!business) return; // no revelar si el negocio existe

      // Buscar como member, luego como customer de ESE negocio.
      const member = await this.prisma.member.findFirst({ where: { email: dto.email, businessId: business.id } });
      const customer = !member
        ? await this.prisma.customer.findFirst({ where: { email: dto.email, businessId: business.id, deletedAt: null } })
        : null;

      if (!member && !customer) return; // no revelar si el email existe

      const userType = member ? 'MEMBER' : 'CUSTOMER';
      await this.issuePasswordResetToken(dto.email, userType, business.id, {
        memberId: member?.id,
        customerId: customer?.id,
      });
      return;
    }

    // Sin slug (orbita.com/panel) — mismo criterio que login(): buscar member
    // globalmente. Nunca se busca customer sin slug: un customer siempre
    // pertenece a un negocio específico (no existe "cuenta de plataforma" para
    // clientes del storefront), a diferencia de un dueño que puede no recordar
    // el subdominio de su propia tienda.
    const member = await this.prisma.member.findFirst({ where: { email: dto.email } });
    if (!member) return; // no revelar si el email existe

    const business = await this.prisma.business.findUnique({ where: { id: member.businessId } });
    if (!business) return;

    await this.issuePasswordResetToken(dto.email, 'MEMBER', business.id, {
      memberId: member.id,
    });
  }

  private async issuePasswordResetToken(
    email: string,
    userType: 'MEMBER' | 'CUSTOMER',
    businessId: string,
    destinatario?: { memberId?: string; customerId?: string },
  ): Promise<void> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = this.hashToken(code);

    await this.prisma.passwordResetToken.create({
      data: {
        codeHash,
        email,
        userType,
        businessId,
        expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
      },
    });

    await this.mail.sendPasswordReset(email, { code, expiresIn: '15 minutos' }, { businessId, ...destinatario });
  }

  // ── Verificar código (sin consumirlo) ───────────────────────────────────────
  // Le permite al frontend confirmar el código ANTES de pedir la contraseña
  // nueva, sin gastarlo — el consumo real (usedAt) pasa recién en resetPassword().

  async verifyResetCode(dto: VerifyResetCodeDto): Promise<void> {
    await this.findValidResetCode(dto.email, dto.code);
  }

  /**
   * Busca el código de recuperación vigente para `email` (el más reciente, no
   * usado, no expirado) y lo compara con `code`. Si no matchea, incrementa
   * `attempts` de ESA fila (no se puede buscar directo por hash: el código no
   * es @unique, ver comentario en el schema) y, superado el límite, la
   * invalida. No marca `usedAt` — eso es responsabilidad exclusiva de
   * resetPassword(), el único paso que efectivamente gasta el código.
   */
  private async findValidResetCode(email: string, code: string) {
    const stored = await this.prisma.passwordResetToken.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!stored || stored.attempts >= MAX_RESET_CODE_ATTEMPTS) {
      throw new BadRequestException('Código inválido o expirado');
    }

    if (stored.codeHash !== this.hashToken(code)) {
      await this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código inválido o expirado');
    }

    return stored;
  }

  // ── Reset password ────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<{ userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN' }> {
    const stored = await this.findValidResetCode(dto.email, dto.code);

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    // Los tokens de MEMBER/CUSTOMER siempre llevan businessId (el where lo exige);
    // los de PLATFORM_ADMIN no (email único global). Ver forgotPassword() — hoy
    // el apex solo emite tokens de member; el reset de admin queda para cuando se
    // exponga su flujo (ver PENDIENTES), pero la persistencia ya lo contempla.
    let cambiado: { memberId?: string; customerId?: string } | null = null;
    if (stored.userType === 'MEMBER' && stored.businessId) {
      const member = await this.prisma.member.findFirst({ where: { email: stored.email, businessId: stored.businessId } });
      if (member) {
        await this.prisma.member.update({ where: { id: member.id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
        cambiado = { memberId: member.id };
      }
    } else if (stored.userType === 'CUSTOMER' && stored.businessId) {
      const customer = await this.prisma.customer.findFirst({ where: { email: stored.email, businessId: stored.businessId, deletedAt: null } });
      if (customer) {
        await this.prisma.customer.update({ where: { id: customer.id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
        cambiado = { customerId: customer.id };
      }
    } else if (stored.userType === 'PLATFORM_ADMIN') {
      const admin = await this.prisma.platformAdmin.findUnique({ where: { email: stored.email } });
      if (admin) {
        await this.prisma.platformAdmin.update({ where: { id: admin.id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
      }
    }

    await this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } });

    // Aviso de seguridad al dueño de la cuenta. Best-effort: si el mail falla,
    // la contraseña ya se cambió y el flujo no se rompe.
    if (cambiado && stored.businessId) {
      try {
        const business = await this.prisma.business.findUnique({
          where: { id: stored.businessId },
          include: { storefrontConfig: { select: { storeName: true } } },
        });
        if (business) {
          const storeName = business.storefrontConfig?.storeName ?? business.name;
          await this.mail.sendPasswordChanged(stored.email, { storeName }, { businessId: business.id, ...cambiado });
        }
      } catch {
        // nada — el aviso es informativo, no puede voltear el reset
      }
    }

    return { userType: stored.userType as 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN' };
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  // Mismo criterio de aislamiento que login()/register() con password: el
  // storefront resuelve SIEMPRE contra customer de ESE businessId; el apex
  // resuelve SIEMPRE contra member global, y nunca crea negocio ni member.

  async googleLoginStorefront(identity: GoogleIdentity, businessSlug: string): Promise<LoginResponse> {
    const business = await this.prisma.business.findUnique({ where: { subdomain: businessSlug } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    let customer = await this.prisma.customer.findFirst({
      where: { businessId: business.id, googleId: identity.googleId, deletedAt: null },
    });
    if (!customer) {
      customer = await this.prisma.customer.findFirst({
        where: { businessId: business.id, email: identity.email, deletedAt: null },
      });
    }

    if (customer) {
      // Vincula, nunca duplica. Solo setea googleId si todavía no tenía uno
      // vinculado (no pisa un vínculo existente).
      if (!customer.googleId) {
        customer = await this.prisma.customer.update({
          where: { id: customer.id },
          data: { googleId: identity.googleId, emailVerified: true },
        });
      }
    } else {
      customer = await this.prisma.customer.create({
        data: {
          businessId: business.id,
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
          googleId: identity.googleId,
          emailVerified: true,
        },
      });
    }

    const { token, refreshToken } = await this.issueSession(customer.id, 'customer', business.id);
    return {
      type: 'customer',
      token,
      refreshToken,
      customer: { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email },
      business: { id: business.id, name: business.name, subdomain: business.subdomain, mode: business.mode },
    };
  }

  // Devuelve null si no existe member (nunca crea negocio ni member acá — el
  // controller traduce eso en el mensaje "no tenés negocio, hacé onboarding").
  async googleLoginApex(identity: GoogleIdentity): Promise<LoginResponse | null> {
    // Precedencia (igual que login por password): PRIMERO super admin.
    let admin = await this.prisma.platformAdmin.findUnique({ where: { googleId: identity.googleId } });
    if (!admin) {
      admin = await this.prisma.platformAdmin.findUnique({ where: { email: identity.email } });
    }
    if (admin && admin.isActive) {
      // Vincula el googleId en el primer login con Google; nunca pisa uno existente.
      await this.prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          ...(admin.googleId ? {} : { googleId: identity.googleId, emailVerified: true }),
          lastAccessAt: new Date(),
        },
      });
      return this.buildPlatformAdminResponse(admin);
    }

    const include = {
      business: true as const,
      role: { include: { rolePermissions: { include: { permission: true } } } },
    };

    let member = await this.prisma.member.findFirst({
      where: { googleId: identity.googleId },
      include,
    });
    if (!member) {
      member = await this.prisma.member.findFirst({
        where: { email: identity.email },
        include,
      });
    }
    if (!member) return null;

    if (!member.googleId) {
      await this.prisma.member.update({ where: { id: member.id }, data: { googleId: identity.googleId } });
    }

    const { token, refreshToken } = await this.issueSession(member.id, 'member', member.businessId);
    return {
      type: 'member',
      token,
      refreshToken,
      member: { id: member.id, name: member.name, email: member.email, status: member.status },
      role: member.role.name,
      permissions: member.role.rolePermissions.map((rp) => rp.permission.code),
      business: {
        id: member.business.id,
        name: member.business.name,
        subdomain: member.business.subdomain,
        mode: member.business.mode,
      },
    };
  }

  async issueSession(
    userId: string,
    type: 'member' | 'customer',
    businessId: string,
  ): Promise<{ token: string; refreshToken: string }> {
    const token = this.signToken({ sub: userId, type, businessId });
    const refreshToken = await this.createRefreshToken(userId, type === 'member' ? 'MEMBER' : 'CUSTOMER', businessId);
    return { token, refreshToken };
  }

  // Arma la sesión + respuesta de un super admin (password o Google). Sin
  // `business`: no pertenece a ningún negocio; el refresh token va con
  // businessId null (ver createRefreshToken).
  private async buildPlatformAdminResponse(admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  }, deviceInfo?: DeviceInfo): Promise<PlatformAdminAuthResponse> {
    const token = this.signToken({ sub: admin.id, type: 'platform_admin' });
    const refreshToken = await this.createRefreshToken(admin.id, 'PLATFORM_ADMIN', null, deviceInfo);
    return {
      type: 'platform_admin',
      token,
      refreshToken,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    };
  }

  // ── Accept invitation ─────────────────────────────────────────────────────

  async acceptInvitation(dto: AcceptInvitationDto): Promise<{ token: string; refreshToken: string; member: object }> {
    const member = await this.prisma.member.findUnique({
      where: { invitationToken: dto.token },
      include: { business: { select: { id: true, name: true } } },
    });

    if (!member || member.status !== 'PENDING' || !member.hasTempPassword) {
      throw new BadRequestException('Invitación inválida o ya aceptada');
    }
    if (!member.invitationTokenExpiresAt || member.invitationTokenExpiresAt < new Date()) {
      throw new BadRequestException('La invitación expiró — pedí que te reinviten');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    const activatedMember = await this.prisma.member.update({
      where: { id: member.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        hasTempPassword: false,
        invitationToken: null,
        invitationTokenExpiresAt: null,
        emailVerified: true,
      },
    });

    const token = this.signToken({ sub: member.id, type: 'member', businessId: member.businessId });
    const refreshToken = await this.createRefreshToken(member.id, 'MEMBER', member.businessId);

    return {
      token,
      refreshToken,
      member: { id: activatedMember.id, name: activatedMember.name, email: activatedMember.email, status: activatedMember.status },
    };
  }

  // ── /me ───────────────────────────────────────────────────────────────────

  // getMe() solo se llama desde GET /auth/me (auth.controller.ts), que no tiene
  // @Public() — pasa siempre por AuthGuard, que ya validó JWT + businessId (ver
  // auth.guard.ts) antes de poblar `ctx`. Por eso buscar por id acá es seguro:
  // memberId/customerId y businessId ya son un par verificado, no datos crudos
  // del cliente.
  async getMe(ctx: AuthContext): Promise<object> {
    if (ctx.type === 'member') {
      const member = await this.prisma.member.findUnique({
        where: { id: ctx.memberId },
        include: {
          business: true,
          role: { include: { rolePermissions: { include: { permission: true } } } },
        },
      });
      if (!member) throw new UnauthorizedException('Miembro no encontrado');

      return {
        type: 'member',
        member: { id: member.id, name: member.name, email: member.email },
        role: member.role.name,
        permissions: member.role.rolePermissions.map((rp) => rp.permission.code),
        business: { id: member.business.id, name: member.business.name, subdomain: member.business.subdomain, mode: member.business.mode },
      };
    }

    if (ctx.type === 'platform_admin') {
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: ctx.adminId } });
      if (!admin || !admin.isActive) throw new UnauthorizedException('Admin no encontrado');

      return {
        type: 'platform_admin',
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
      };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: ctx.customerId },
      include: { business: true },
    });
    if (!customer) throw new UnauthorizedException('Cliente no encontrado');

    return {
      type: 'customer',
      customer: { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email },
      business: { id: customer.business.id, name: customer.business.name, subdomain: customer.business.subdomain, mode: customer.business.mode },
    };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  signToken(payload: JwtPayload): string {
    const { sub, type, businessId } = payload;
    // businessId solo viaja para member/customer; en platform_admin es undefined
    // y JSON.stringify (dentro de jwt.sign) lo omite.
    const claims: Record<string, unknown> = { sub, type };
    if (businessId) claims.businessId = businessId;
    return jwt.sign(claims, this.jwtSecret, { expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.jwtSecret) as JwtPayload;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createRefreshToken(
    userId: string,
    userType: 'MEMBER' | 'CUSTOMER' | 'PLATFORM_ADMIN',
    businessId: string | null,
    deviceInfo?: DeviceInfo,
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const days = userType === 'CUSTOMER' ? CUSTOMER_REFRESH_DAYS : MEMBER_REFRESH_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash, userId, userType, businessId, expiresAt,
        // deviceInfo (user-agent + IP) lo pasa el controller desde el request en
        // login/refresh, para la pantalla "sesiones activas" (RBT-631). Es
        // opcional: los flujos que no lo pasan (Google, invitación) guardan null.
        deviceInfo: deviceInfo ? { userAgent: deviceInfo.userAgent ?? null, ip: deviceInfo.ip ?? null } : undefined,
      },
    });

    return rawToken;
  }

  // ── Sesiones activas (RBT-631) ─────────────────────────────────────────────
  // Una "sesión activa" = un refresh token vivo (no revocado, no expirado). Como
  // refresh() revoca el token viejo al rotar, cada dispositivo real tiene a lo
  // sumo una fila viva a la vez, así que listar las vivas ≈ listar dispositivos.
  async listSessions(userId: string, userType: 'MEMBER' | 'CUSTOMER', currentRefreshToken?: string) {
    const currentHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : null;
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, userType, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      deviceInfo: r.deviceInfo,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      isCurrent: currentHash != null && r.tokenHash === currentHash,
    }));
  }

  // Revoca UNA sesión, verificando que sea del usuario (no revela existencia ajena).
  async revokeSession(userId: string, userType: 'MEMBER' | 'CUSTOMER', sessionId: string): Promise<void> {
    const sesion = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId, userType },
      select: { id: true, revokedAt: true },
    });
    if (!sesion) throw new NotFoundException('Sesión no encontrada');
    if (!sesion.revokedAt) {
      await this.prisma.refreshToken.update({ where: { id: sesion.id }, data: { revokedAt: new Date() } });
    }
  }

  // Revoca TODAS las sesiones vivas del usuario. Si se pasa el refresh token
  // actual, esa sesión se preserva ("cerrar en los demás dispositivos").
  async revokeAllSessions(userId: string, userType: 'MEMBER' | 'CUSTOMER', exceptRefreshToken?: string): Promise<void> {
    const exceptHash = exceptRefreshToken ? this.hashToken(exceptRefreshToken) : null;
    await this.prisma.refreshToken.updateMany({
      where: {
        userId, userType, revokedAt: null,
        ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  private async checkLockout(lockedUntil: Date | null): Promise<void> {
    if (lockedUntil && lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Cuenta bloqueada. Intentá de nuevo en ${minutesLeft} minuto(s).`);
    }
  }

  private async handleFailedLogin(
    type: 'member' | 'customer' | 'platform_admin',
    id: string,
    currentAttempts: number,
  ): Promise<void> {
    const newAttempts = currentAttempts + 1;
    const data: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: newAttempts };

    if (newAttempts >= LOCKOUT_THRESHOLD) {
      data.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    if (type === 'member') {
      await this.prisma.member.update({ where: { id }, data });
    } else if (type === 'customer') {
      await this.prisma.customer.update({ where: { id }, data });
    } else {
      await this.prisma.platformAdmin.update({ where: { id }, data });
    }
  }
}
