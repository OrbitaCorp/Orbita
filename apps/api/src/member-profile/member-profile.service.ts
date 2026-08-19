import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
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
    // Email único DENTRO del negocio — mismo criterio de aislamiento que el
    // resto (el mismo email puede existir en otro negocio, no dos veces acá).
    if (dto.email) {
      const existente = await this.prisma.member.findFirst({
        where: { businessId, email: dto.email, id: { not: memberId } },
        select: { id: true },
      });
      if (existente) throw new BadRequestException('Ese email ya está en uso en este negocio.');
    }

    const m = await this.prisma.member.update({
      where: { id: memberId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        // Cambiar el email obliga a re-verificarlo, mismo criterio que RBT-631.
        ...(dto.email !== undefined && { email: dto.email, emailVerified: false }),
      },
      include: { role: { select: { name: true } } },
    });
    return this.toResponse(m);
  }

  // (Fase 4 — Alex) Cambio de contraseña con la actual como prueba de
  // identidad. Mismo hasheo que el login (argon2id) y apaga hasTempPassword:
  // si entró con una temporal y se pone una propia acá, ya está regularizado.
  async changePassword(memberId: string, dto: ChangePasswordDto) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m) throw new NotFoundException('Miembro no encontrado');

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
