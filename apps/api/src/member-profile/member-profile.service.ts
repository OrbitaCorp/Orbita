import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// (RBT-646) "Mi perfil" del panel — dueño/equipo. No confundir con `me/`, que
// es la cuenta del CLIENTE del storefront (RBT-630/631): son roles distintos,
// con guards y aislamiento diferentes (assertMemberContext vs
// assertCustomerContext).
@Injectable()
export class MemberProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { role: { select: { name: true } } },
    });
    if (!m) throw new NotFoundException('Miembro no encontrado');
    return this.toResponse(m);
  }

  async updateProfile(memberId: string, businessId: string, dto: UpdateMemberProfileDto) {
    const actual = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { email: true, passwordHash: true },
    });
    if (!actual) throw new NotFoundException('Miembro no encontrado');

    // El panel manda el email siempre, cambie o no: solo es un cambio si es
    // distinto del guardado (los dos ya normalizados).
    const cambiaEmail = dto.email !== undefined && dto.email !== actual.email;

    if (cambiaEmail) {
      // Cambiar el email es cambiar con qué se entra y adónde llega "olvidé
      // mi contraseña": con una sesión robada (una compu compartida, un
      // celular prestado) alcanzaba para quedarse con la cuenta para siempre.
      // Se pide la contraseña actual, igual que para cambiarla (auditoría
      // interna 10/09, ítem `api.member-profile`).
      const valida =
        !!actual.passwordHash && !!dto.currentPassword && (await argon2.verify(actual.passwordHash, dto.currentPassword));
      if (!valida) throw new BadRequestException('Para cambiar el email, confirmá tu contraseña actual.');

      // Email único DENTRO del negocio — mismo criterio de aislamiento que el
      // resto (el mismo email puede existir en otro negocio, no dos veces acá).
      const existente = await this.prisma.member.findFirst({
        where: { businessId, email: dto.email, id: { not: memberId } },
        select: { id: true },
      });
      if (existente) throw new BadRequestException('Ese email ya está en uso en este negocio.');
    }

    try {
      const m = await this.prisma.member.update({
        where: { id: memberId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          // Queda "sin verificar". Todavía no existe el mail de confirmación
          // para members (hallazgo abierto del 10/09): el flag es informativo.
          ...(cambiaEmail && { email: dto.email, emailVerified: false }),
        },
        include: { role: { select: { name: true } } },
      });
      return this.toResponse(m);
    } catch (err) {
      // Dos cambios simultáneos al mismo email pasan los dos el chequeo de
      // arriba; la unique (businessId, email) decide y el segundo recibe el
      // mismo 400, no un 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Ese email ya está en uso en este negocio.');
      }
      throw err;
    }
  }

  // (Fase 4 — Alex) Cambio de contraseña con la actual como prueba de
  // identidad. Mismo hasheo que el login (argon2id) y apaga hasTempPassword:
  // si entró con una temporal y se pone una propia acá, ya está regularizado.
  async changePassword(memberId: string, dto: ChangePasswordDto) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m) throw new NotFoundException('Miembro no encontrado');
    // passwordHash es nullable en el esquema (una cuenta puede no tener
    // contraseña propia todavía): sin este guard el build fallaba (TS2345) y,
    // en runtime, no habría nada contra qué verificar.
    if (!m.passwordHash) {
      throw new BadRequestException('Tu cuenta todavía no tiene una contraseña propia. Entrá con el link de invitación o pedí un restablecimiento.');
    }

    const valida = await argon2.verify(m.passwordHash, dto.currentPassword);
    if (!valida) throw new BadRequestException('La contraseña actual no es correcta.');

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.member.update({
      where: { id: memberId },
      data: { passwordHash, hasTempPassword: false },
    });
    return { message: 'Contraseña actualizada' };
  }

  async updateTheme(memberId: string, themePreference: 'LIGHT' | 'DARK' | 'SYSTEM') {
    const m = await this.prisma.member.update({
      where: { id: memberId },
      data: { themePreference },
      include: { role: { select: { name: true } } },
    });
    return this.toResponse(m);
  }

  private toResponse(m: {
    id: string; name: string; email: string; emailVerified: boolean;
    themePreference: string; role: { name: string };
  }) {
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      emailVerified: m.emailVerified,
      role: m.role.name,
      themePreference: m.themePreference,
    };
  }
}
