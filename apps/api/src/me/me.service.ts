import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
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
  private readonly avisoLogger = new Logger(`${MeService.name}:aviso`);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    // Aviso "Tu contraseña fue actualizada". Opcional solo para los tests.
    private readonly mail?: MailService,
  ) {}

  async getProfile(customerId: string) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return this.toResponse(c);
  }

  async updateProfile(customerId: string, businessId: string, dto: UpdateMeDto) {
    const actual = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true, passwordHash: true },
    });
    if (!actual) throw new NotFoundException('Cliente no encontrado');

    // La pantalla de perfil manda el email en cada guardado: solo es un cambio
    // si es distinto del guardado (los dos normalizados; null = borrarlo).
    const cambiaEmail = dto.email !== undefined && (dto.email ?? null) !== actual.email;

    if (cambiaEmail) {
      // El email es con qué entra el cliente y adónde llega "olvidé mi
      // contraseña": con una sesión ajena abierta alcanzaba con ponerse uno
      // propio para quedarse con la cuenta (y con sus direcciones y
      // pedidos). Se pide la contraseña actual (auditoría interna 10/09,
      // ítem `api.me`). Una cuenta que entra solo con Google no tiene
      // contra qué comparar: su email no se cambia por acá.
      if (!actual.passwordHash) {
        throw new BadRequestException('Tu cuenta entra con Google: el email no se puede cambiar desde acá.');
      }
      const valida = !!dto.currentPassword && (await argon2.verify(actual.passwordHash, dto.currentPassword));
      if (!valida) throw new BadRequestException('Para cambiar el email, confirmá tu contraseña actual.');

      // Email único DENTRO del negocio (mismo criterio de aislamiento que el
      // resto: el mismo email puede existir en otro negocio, pero no dos
      // veces en este).
      if (dto.email) {
        const existente = await this.prisma.customer.findFirst({
          where: { businessId, email: dto.email, id: { not: customerId }, deletedAt: null },
          select: { id: true },
        });
        if (existente) throw new BadRequestException('Ese email ya está en uso en esta tienda.');
      }
    }

    try {
      const c = await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          // Cambiar el email obliga a re-verificarlo, mismo criterio que el registro.
          ...(cambiaEmail && { email: dto.email ?? null, emailVerified: false }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.dni !== undefined && { dni: dto.dni }),
          ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        },
      });
      return this.toResponse(c);
    } catch (err) {
      // Dos cambios simultáneos al mismo email: la unique decide y el segundo
      // recibe el mismo 400, no un 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Ese email ya está en uso en esta tienda.');
      }
      throw err;
    }
  }

  // Después del cambio (auditoría interna 10/09, ítem web.cliente.perfil —
  // mismo criterio que Mi perfil del panel): las demás sesiones del cliente
  // dejan de valer (se preserva la que manda su refresh token en
  // `sesionActual`; la tienda, que no lo puede leer, vuelve a entrar con la
  // contraseña nueva) y sale el aviso "Tu contraseña fue actualizada".
  async changePassword(customerId: string, dto: ChangePasswordDto, sesionActual?: string) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    // Un cliente que se registró solo con Google no tiene passwordHash: no puede
    // "cambiar" una contraseña que nunca tuvo.
    if (!c.passwordHash) {
      throw new BadRequestException('Tu cuenta no tiene una contraseña definida (iniciás con Google).');
    }
    const ok = await argon2.verify(c.passwordHash, dto.currentPassword);
    // 400 y no 401: un 401 le dice al cliente web que la SESIÓN venció (y
    // puede disparar un refresh o un cierre de sesión), cuando lo que falló
    // es un dato del formulario. Mismo criterio que Mi perfil del panel
    // (auditoría interna 10/09, ítem `api.me`).
    if (!ok) throw new BadRequestException('La contraseña actual no es correcta.');

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.customer.update({ where: { id: customerId }, data: { passwordHash } });

    const hashActual = sesionActual ? createHash('sha256').update(sesionActual).digest('hex') : null;
    await this.prisma.refreshToken.updateMany({
      where: { userId: customerId, userType: 'CUSTOMER', revokedAt: null, ...(hashActual ? { tokenHash: { not: hashActual } } : {}) },
      data: { revokedAt: new Date() },
    });

    await this.avisarCambioDeContrasena(c);
    return { message: 'Contraseña actualizada.' };
  }

  private async avisarCambioDeContrasena(c: { id: string; email: string | null; businessId: string }) {
    if (!this.mail || !c.email) return;
    try {
      const negocio = await this.prisma.business.findUnique({
        where: { id: c.businessId },
        select: { name: true, storefrontConfig: { select: { storeName: true } } },
      });
      if (!negocio) return;
      await this.mail.sendPasswordChanged(c.email, { storeName: negocio.storefrontConfig?.storeName ?? negocio.name }, { businessId: c.businessId, customerId: c.id });
    } catch (e) {
      this.avisoLogger.warn(`No se pudo avisar el cambio de contraseña del cliente ${c.id}: ${e}`);
    }
  }

  async uploadAvatar(customerId: string, file: { buffer: Buffer }) {
    let webp: Buffer;
    try {
      // Con tope de píxeles: cualquier cliente registrado puede subir un avatar,
      // y un PNG chico puede declarar cientos de megapíxeles (ver ENTRADA_IMAGEN).
      webp = await sharp(file.buffer, ENTRADA_IMAGEN).resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException('El archivo no es una imagen válida, está corrupta o supera los 60 megapíxeles.');
    }

    const path = `avatars/${customerId}/${randomUUID()}.webp`;
    const { error } = await this.supabase.adminClient.storage
      .from(AVATARS_BUCKET)
      .upload(path, webp, { contentType: 'image/webp', upsert: false });
    // El detalle de Supabase va al log, no al cliente (auditoría interna 10/09).
    if (error) {
      new Logger(MeService.name).error(`Subida a ${AVATARS_BUCKET} falló para ${customerId}: ${error.message}`);
      throw new ServiceUnavailableException('No se pudo subir la imagen: el almacenamiento no respondió, probá de nuevo en un rato.');
    }

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
