import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// Mismo bucket que las imágenes de negocio (público). Los avatares van bajo el
// prefijo avatars/<customerId>/ para no mezclarse con logos/slides.
const AVATARS_BUCKET = 'business-logos';

// (RBT-630 / RBT-631) Cuenta del cliente: datos personales, avatar y contraseña.
// Todo opera sobre el customerId que resuelve assertCustomerContext en el
// controller — nunca sobre un id crudo del request.
@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async getProfile(customerId: string) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return this.toResponse(c);
  }

  async updateProfile(customerId: string, businessId: string, dto: UpdateMeDto) {
    // Email único DENTRO del negocio (mismo criterio de aislamiento que el resto:
    // el mismo email puede existir en otro negocio, pero no dos veces en este).
    if (dto.email) {
      const existente = await this.prisma.customer.findFirst({
        where: { businessId, email: dto.email, id: { not: customerId }, deletedAt: null },
        select: { id: true },
      });
      if (existente) throw new BadRequestException('Ese email ya está en uso en esta tienda.');
    }

    const c = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        // Cambiar el email obliga a re-verificarlo, mismo criterio que el registro.
        ...(dto.email !== undefined && { email: dto.email, emailVerified: false }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.dni !== undefined && { dni: dto.dni }),
        ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
      },
    });
    return this.toResponse(c);
  }

  async changePassword(customerId: string, dto: ChangePasswordDto) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    // Un cliente que se registró solo con Google no tiene passwordHash: no puede
    // "cambiar" una contraseña que nunca tuvo.
    if (!c.passwordHash) {
      throw new BadRequestException('Tu cuenta no tiene una contraseña definida (iniciás con Google).');
    }
    const ok = await argon2.verify(c.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('La contraseña actual no es correcta.');

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.customer.update({ where: { id: customerId }, data: { passwordHash } });
    return { message: 'Contraseña actualizada.' };
  }

  async uploadAvatar(customerId: string, file: { buffer: Buffer }) {
    let webp: Buffer;
    try {
      webp = await sharp(file.buffer).resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException('El archivo no es una imagen válida o está corrupto.');
    }

    const path = `avatars/${customerId}/${randomUUID()}.webp`;
    const { error } = await this.supabase.adminClient.storage
      .from(AVATARS_BUCKET)
      .upload(path, webp, { contentType: 'image/webp', upsert: false });
    if (error) throw new BadRequestException(`No se pudo subir la imagen: ${error.message}`);

    const { data } = this.supabase.adminClient.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    const c = await this.prisma.customer.update({ where: { id: customerId }, data: { avatarUrl: data.publicUrl } });
    return { avatarUrl: c.avatarUrl };
  }

  private toResponse(c: {
    id: string; firstName: string; lastName: string | null; email: string | null;
    phone: string | null; dni: string | null; birthDate: Date | null; avatarUrl: string | null;
    emailVerified: boolean;
  }) {
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      dni: c.dni,
      birthDate: c.birthDate,
      avatarUrl: c.avatarUrl,
      emailVerified: c.emailVerified,
    };
  }
}
