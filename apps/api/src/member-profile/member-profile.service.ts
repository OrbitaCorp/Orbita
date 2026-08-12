import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';

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
