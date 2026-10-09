import { Injectable, Logger, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';
import { describeError } from '../common/utils/describe-error.util';
import { InstagramService } from './instagram.service';

// Publicaciones del kit de difusión: sube a Instagram la foto de un producto con un texto que escribe
// el dueño.
//
// Instagram pide una foto en JPEG y una dirección pública de donde bajarla; las fotos de producto se
// guardan en webp (y a veces con transparencia), así que antes de publicar se convierte: sobre fondo
// blanco, en un cuadrado de 1080 px (el cuadrado entra siempre en las proporciones que acepta el feed).
// El JPEG se sube a un lugar temporal del mismo almacenamiento y se borra al terminar.

const BUCKET = 'product-images';
const LADO = 1080;
const MAX_BYTES_FOTO = 25 * 1024 * 1024;
const MAX_PUBLICACIONES_RECIENTES = 30;

@Injectable()
export class InstagramPublicacionesService {
  private readonly logger = new Logger(InstagramPublicacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly instagram: InstagramService,
  ) {}

  /** Lo último que se publicó desde Órbita, para el historial de la pantalla. */
  listar(businessId: string) {
    return this.prisma.instagramPost.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: MAX_PUBLICACIONES_RECIENTES,
      select: { id: true, productId: true, productName: true, caption: true, imageUrl: true, permalink: true, createdAt: true },
    });
  }

  async publicarProducto(businessId: string, memberId: string | undefined, productId: string, caption: string) {
    await this.instagram.asegurarHabilitado(businessId);

    const producto = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
      select: {
        id: true,
        name: true,
        status: true,
        images: { select: { url: true, isPrimary: true, position: true, optionValueId: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto.status !== 'PUBLISHED') {
      throw new UnprocessableEntityException('Publicá el producto en tu tienda antes de promocionarlo en Instagram.');
    }
    // La foto principal general; si no hay, la primera general, y si el producto solo tiene fotos por variante, la primera.
    const foto = producto.images.find((i) => i.isPrimary && !i.optionValueId) ?? producto.images.find((i) => !i.optionValueId) ?? producto.images[0];
    if (!foto) throw new UnprocessableEntityException('El producto no tiene fotos para publicar.');

    const jpeg = await this.aJpegCuadrado(foto.url);
    const ruta = `${businessId}/instagram/${randomUUID()}.jpg`;
    const imageUrl = await this.subirTemporal(ruta, jpeg);
    try {
      const { mediaId, permalink } = await this.instagram.publicarImagen(businessId, imageUrl, caption);
      const post = await this.prisma.instagramPost.create({
        data: { businessId, productId: producto.id, productName: producto.name, memberId: memberId ?? null, caption, imageUrl: foto.url, igMediaId: mediaId, permalink },
        select: { id: true, productId: true, productName: true, caption: true, imageUrl: true, permalink: true, createdAt: true },
      });
      return post;
    } finally {
      // Instagram ya copió la foto (o falló): el temporal no hace falta más.
      await this.supabase.adminClient.storage
        .from(BUCKET)
        .remove([ruta])
        .catch((e: unknown) => this.logger.warn(`No se pudo borrar el temporal ${ruta}: ${describeError(e)}`));
    }
  }

  // Solo se baja de direcciones https públicas: la dirección sale de la ficha del producto, pero no se
  // le pide al servidor que llegue a nada interno.
  private async aJpegCuadrado(url: string): Promise<Buffer> {
    let destino: URL;
    try {
      destino = new URL(url);
    } catch {
      throw new UnprocessableEntityException('La foto del producto no tiene una dirección válida.');
    }
    const host = destino.hostname.toLowerCase();
    if (destino.protocol !== 'https:' || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new UnprocessableEntityException('La foto del producto no se puede usar para publicar.');
    }

    let original: Buffer;
    try {
      const res = await fetch(destino, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      original = Buffer.from(await res.arrayBuffer());
      if (original.length > MAX_BYTES_FOTO) throw new Error('foto demasiado pesada');
    } catch (e) {
      this.logger.warn(`No se pudo bajar la foto para Instagram: ${describeError(e)}`);
      throw new ServiceUnavailableException('No se pudo leer la foto del producto. Probá de nuevo en un momento.');
    }

    try {
      return await sharp(original, ENTRADA_IMAGEN)
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize(LADO, LADO, { fit: 'contain', background: '#ffffff' })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new UnprocessableEntityException('La foto del producto no es una imagen válida para publicar.');
    }
  }

  private async subirTemporal(ruta: string, jpeg: Buffer): Promise<string> {
    const { error } = await this.supabase.adminClient.storage.from(BUCKET).upload(ruta, jpeg, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      this.logger.error(`Subida temporal para Instagram falló (${ruta}): ${error.message}`);
      throw new ServiceUnavailableException('No se pudo preparar la foto: el almacenamiento no respondió, probá de nuevo en un rato.');
    }
    return this.supabase.adminClient.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  }
}
