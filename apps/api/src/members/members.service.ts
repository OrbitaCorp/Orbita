import { createHash, randomBytes, randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import * as argon2 from 'argon2';

// Sin caracteres ambiguos (0/O, 1/l/I) para que sea legible al copiarla del email.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// 24 horas: un link de acceso al panel dando vueltas en una casilla de mail
// es una puerta abierta — si no lo usó en el día, que pida que lo reinviten.
const INVITATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 día

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async findAll(businessId: string) {
    const members = await this.prisma.member.findMany({
      where: { businessId },
      include: { role: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => this.toResponse(m));
  }

  async invite(businessId: string, dto: InviteMemberDto) {
    const existing = await this.prisma.member.findUnique({
      where: { businessId_email: { businessId, email: dto.email } },
    });
    if (existing) throw new ConflictException('Ese email ya es miembro de este negocio');

    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, businessId } });
    if (!role) throw new BadRequestException('Rol inválido');

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { storefrontConfig: { select: { storeName: true } } },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const tempPassword = this.genTempPassword();
    const invitationToken = randomBytes(32).toString('hex');
    const invitationTokenExpiresAt = new Date(Date.now() + INVITATION_TOKEN_EXPIRY_MS);

    const tempPasswordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

    const member = await this.prisma.member.create({
      data: {
        businessId,
        name: dto.name,
        email: dto.email,
        roleId: dto.roleId,
        status: 'PENDING',
        hasTempPassword: true,
        passwordHash: tempPasswordHash,
        invitationToken,
        invitationTokenExpiresAt,
      },
    });

    // El token de aceptación es un secreto aleatorio de un solo uso (32 bytes),
    // no el memberId — expira a las 24 horas y se limpia al aceptar (ver auth.service).
    const storeName = business.storefrontConfig?.storeName ?? business.name;
    const panelUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/aceptar-invitacion?token=${invitationToken}`;
    await this.mail.sendMemberInvitation(
      dto.email,
      {
        storeName,
        roleName: role.name,
        panelUrl,
        tempPassword,
      },
      { businessId, memberId: member.id },
    );

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      status: member.status,
      hasTempPassword: member.hasTempPassword,
      // (Fase 4 — Alex) Se devuelve también para que el panel la pueda mostrar
      // y copiar — el endpoint ya es solo owner/admin, y el email igual sale.
      tempPassword,
    };
  }

  // actorId/actorRoleName: quién está editando (del token). Se usan para cerrar
  // la escalación de privilegios — el guard @Roles ya limita a owner/admin, pero
  // acá se protege el caso puntual del rol "owner", que ningún admin debe tocar.
  async update(
    businessId: string,
    actorId: string,
    actorRoleName: string,
    id: string,
    dto: UpdateMemberDto,
  ) {
    const objetivo = await this.findOneRaw(businessId, id);

    // Nadie puede cambiarle el rol al dueño (ni degradarlo, ni "reasignarlo"),
    // y solo el propio dueño puede ascender a alguien a owner. Sin esto, un
    // admin podía hacerse owner o degradar al owner y después resetearle la clave.
    if (dto.roleId) {
      const nuevoRol = await this.prisma.role.findFirst({ where: { id: dto.roleId, businessId } });
      if (!nuevoRol) throw new BadRequestException('Rol inválido');

      const esObjetivoOwner = objetivo.role.name === 'owner';
      const asciendeAOwner = nuevoRol.name === 'owner';
      if ((esObjetivoOwner || asciendeAOwner) && actorRoleName !== 'owner') {
        throw new UnprocessableEntityException('Solo el dueño puede cambiar el rol de propietario.');
      }
      // Un admin no puede reasignarse el rol a sí mismo (evita auto-ascensos y
      // que se saque permisos por error y quede sin acceso de gestión).
      if (id === actorId && actorRoleName !== 'owner') {
        throw new UnprocessableEntityException('No podés cambiar tu propio rol.');
      }
    }

    // businessId va en el where del updateMany — la query garantiza el
    // aislamiento por sí misma, no depende del findOneRaw previo.
    const { count } = await this.prisma.member.updateMany({
      where: { id, businessId },
      data: { name: dto.name, roleId: dto.roleId },
    });
    if (count === 0) throw new NotFoundException('Miembro no encontrado');

    const updated = await this.findOneRaw(businessId, id);
    return this.toResponse(updated);
  }

  // (Fase 4 — Alex) Resetear la contraseña de un miembro: genera una temporal
  // nueva (mismo formato legible que la de la invitación), lo marca para que
  // deba cambiarla en el próximo acceso, y la devuelve para que el dueño pueda
  // copiarla del panel. Si sendEmail es true, el miembro recibe un mail con un
  // LINK a la pantalla de restablecer contraseña (crea la definitiva ahí mismo,
  // como en la invitación) + la temporal como plan B para entrar por el login.
  // El link reusa el motor de "olvidé mi contraseña" (código de un solo uso,
  // hasheado, con límite de intentos), con 1 hora de vida por venir en un mail.
  //
  // Al owner no se le resetea la contraseña desde acá: para eso está el flujo
  // propio de "olvidé mi contraseña" (forgot-password), que valida identidad.
  async resetPassword(businessId: string, id: string, sendEmail: boolean) {
    const member = await this.findOneRaw(businessId, id);
    if (member.role.name === 'owner') {
      throw new UnprocessableEntityException('La contraseña del dueño se cambia desde "Olvidé mi contraseña"');
    }

    const tempPassword = this.genTempPassword();
    const tempPasswordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

    await this.prisma.member.update({
      where: { id: member.id },
      data: { passwordHash: tempPasswordHash, hasTempPassword: true },
    });

    // Todas las sesiones abiertas del miembro dejan de valer: con la
    // contraseña vieja invalidada no tiene sentido dejar tokens vivos.
    await this.prisma.refreshToken.updateMany({
      where: { userId: member.id, userType: 'MEMBER', revokedAt: null },
      data: { revokedAt: new Date() },
    });

    let emailSent = false;
    if (sendEmail) {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: { storefrontConfig: { select: { storeName: true } } },
      });
      const storeName = business?.storefrontConfig?.storeName ?? business?.name ?? 'tu tienda';

      // Código de un solo uso para el link del mail — misma tabla y misma
      // validación que "olvidé mi contraseña" (hasheado, 5 intentos máx.).
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await this.prisma.passwordResetToken.create({
        data: {
          codeHash: createHash('sha256').update(code).digest('hex'),
          email: member.email,
          userType: 'MEMBER',
          businessId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora: viene en un mail
        },
      });
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
      const resetUrl = `${frontend}/restablecer-contrasena?email=${encodeURIComponent(member.email)}&code=${code}`;

      emailSent = true;
      await this.mail.sendMemberPasswordReset(
        member.email,
        { storeName, resetUrl, tempPassword },
        { businessId, memberId: member.id },
      );
    }

    return { tempPassword, emailSent };
  }

  async remove(businessId: string, id: string) {
    const member = await this.findOneRaw(businessId, id);
    if (member.role.name === 'owner') {
      throw new UnprocessableEntityException('No se puede eliminar al owner');
    }

    // No se borra el usuario de Supabase Auth asociado — ver PENDIENTES.md
    // (decisión abierta: si conviene liberar el email para poder reinvitarlo).
    const { count } = await this.prisma.member.deleteMany({ where: { id, businessId } });
    if (count === 0) throw new NotFoundException('Miembro no encontrado');
    return { ok: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findOneRaw(businessId: string, id: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, businessId },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    return member;
  }

  private toResponse(member: {
    id: string;
    name: string;
    email: string;
    role: { id: string; name: string };
    status: string;
    hasTempPassword: boolean;
    lastAccessAt: Date | null;
  }) {
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      hasTempPassword: member.hasTempPassword,
      lastAccessAt: member.lastAccessAt,
    };
  }

  private genTempPassword(): string {
    const bytes = randomBytes(12);
    let out = '';
    for (let i = 0; i < 12; i++) {
      out += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
    }
    return out;
  }
}
