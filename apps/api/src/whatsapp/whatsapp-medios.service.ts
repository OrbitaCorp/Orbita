import { BadRequestException, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import sharp from 'sharp';
import { SupabaseService } from '../supabase/supabase.service';
import { describeError } from '../common/utils/describe-error.util';
import { ENTRADA_IMAGEN, MAX_IMAGEN_BYTES } from '../common/utils/subida-imagen';

// Imágenes de los chats de WhatsApp: las que mandan los clientes (se bajan de Meta y se guardan, porque la dirección que
// da Meta vence) y las que manda el negocio desde el panel (se preparan y se guardan para mandarlas y mostrarlas).
// Solo imágenes: el audio, el video y los documentos siguen llegando como etiqueta.
//
// Todo queda en un bucket propio, con rutas que no se pueden adivinar (UUID), igual que las de Instagram.

export const BUCKET_WHATSAPP = 'whatsapp-media';
const TIPOS_FOTO = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LADO_MAX = 2048;
// WhatsApp acepta imágenes de hasta 5 MB.
const MAX_BYTES_WHATSAPP = 5 * 1024 * 1024;
const MAX_BYTES_DESCARGA = 16 * 1024 * 1024;
// De dónde se aceptan las imágenes que llegan de Meta (la dirección la da la API de Meta).
const HOSTS_DE_META = ['fbsbx.com', 'fbcdn.net', 'facebook.com', 'whatsapp.net'];

@Injectable()
export class WhatsappMediosService {
  private readonly logger = new Logger(WhatsappMediosService.name);
  private bucketListo: Promise<void> | undefined;

  constructor(
    private readonly supabase: SupabaseService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private get almacen() {
    return this.supabase.adminClient.storage.from(BUCKET_WHATSAPP);
  }

  // El bucket se crea la primera vez que se usa: público (WhatsApp tiene que poder bajar la imagen que se manda, y el
  // panel la muestra). Si ya existe, no pasa nada.
  private async asegurarBucket(): Promise<void> {
    this.bucketListo ??= (async () => {
      const { error } = await this.supabase.adminClient.storage.createBucket(BUCKET_WHATSAPP, { public: true, fileSizeLimit: MAX_BYTES_DESCARGA });
      if (error && !/already exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) {
        this.bucketListo = undefined;
        this.logger.error(`No se pudo preparar el almacenamiento de WhatsApp: ${error.message}`);
        throw new ServiceUnavailableException('El almacenamiento no respondió, probá de nuevo en un rato.');
      }
    })();
    return this.bucketListo;
  }

  /** Una foto, derecha y en JPEG de hasta 2048 px; si pesa más de lo que WhatsApp acepta, se vuelve a comprimir. */
  private async aJpeg(original: Buffer): Promise<Buffer> {
    let calidad = 88;
    let jpeg = await sharp(original, ENTRADA_IMAGEN)
      .rotate()
      .resize(LADO_MAX, LADO_MAX, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: calidad, mozjpeg: true })
      .toBuffer();
    while (jpeg.length > MAX_BYTES_WHATSAPP && calidad > 40) {
      calidad -= 15;
      jpeg = await sharp(jpeg).jpeg({ quality: calidad, mozjpeg: true }).toBuffer();
    }
    return jpeg;
  }

  private async guardar(businessId: string, jpeg: Buffer): Promise<string> {
    await this.asegurarBucket();
    const ruta = `${businessId}/chats/${randomUUID()}.jpg`;
    const { error } = await this.almacen.upload(ruta, jpeg, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      this.logger.error(`Subida de ${ruta} a ${BUCKET_WHATSAPP} falló: ${error.message}`);
      throw new ServiceUnavailableException('No se pudo guardar la imagen: el almacenamiento no respondió, probá de nuevo en un rato.');
    }
    return this.almacen.getPublicUrl(ruta).data.publicUrl;
  }

  /** La foto que el negocio manda desde el panel: se valida, se prepara y se guarda. Devuelve su dirección pública. */
  async prepararFotoDelPanel(businessId: string, archivo: Express.Multer.File | undefined): Promise<string> {
    if (!archivo) throw new BadRequestException('Falta la foto.');
    if (!TIPOS_FOTO.has(archivo.mimetype)) throw new BadRequestException('Mandá una foto JPG, PNG o WebP.');
    if (archivo.size > MAX_IMAGEN_BYTES) throw new BadRequestException('La foto pesa más de 10 MB.');
    let jpeg: Buffer;
    try {
      jpeg = await this.aJpeg(archivo.buffer);
    } catch {
      throw new BadRequestException('El archivo no es una foto válida o es demasiado grande.');
    }
    return this.guardar(businessId, jpeg);
  }

  /**
   * La foto de un producto de la tienda, lista para mandarla por WhatsApp. Las fotos del catálogo están en WebP y WhatsApp
   * solo acepta JPG y PNG, así que se convierte una vez y se guarda con una ruta que sale de la foto original: la próxima
   * vez que se pida la misma foto ya está lista. Solo se baja de nuestro propio almacenamiento. Mejor esfuerzo: si algo
   * falla devuelve null.
   */
  async prepararFotoDeProducto(businessId: string, urlOrigen: string): Promise<string | null> {
    try {
      const origen = new URL(urlOrigen);
      const nuestro = this.hostDelAlmacenamiento();
      if (origen.protocol !== 'https:' || !nuestro || origen.hostname.toLowerCase() !== nuestro) return null;
      await this.asegurarBucket();
      const ruta = `${businessId}/productos/${createHash('sha256').update(urlOrigen).digest('hex').slice(0, 40)}.jpg`;
      const publica = this.almacen.getPublicUrl(ruta).data.publicUrl;
      const lista = await fetch(publica, { method: 'HEAD', signal: AbortSignal.timeout(5_000) }).catch(() => null);
      if (lista?.ok) return publica;
      const res = await fetch(origen, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const original = Buffer.from(await res.arrayBuffer());
      if (original.length > MAX_BYTES_DESCARGA) return null;
      const { error } = await this.almacen.upload(ruta, await this.aJpeg(original), { contentType: 'image/jpeg', upsert: false });
      // Otra respuesta la pudo subir justo antes: es la misma foto, sirve igual.
      if (error && !/already exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) {
        this.logger.warn(`Subida de ${ruta} falló: ${error.message}`);
        return null;
      }
      return publica;
    } catch (e) {
      this.logger.warn(`No se pudo preparar la foto de un producto: ${describeError(e)}`);
      return null;
    }
  }

  private hostDelAlmacenamiento(): string | null {
    try {
      return new URL(this.config?.get<string>('SUPABASE_URL') ?? process.env.SUPABASE_URL ?? '').hostname.toLowerCase() || null;
    } catch {
      return null;
    }
  }

  /**
   * Baja una imagen que mandó un cliente (o el dueño desde el celular) y la guarda. `urlDeMeta` es la dirección
   * temporal que da la API de Meta y se baja con el token del negocio. Mejor esfuerzo: si algo falla devuelve null y
   * el mensaje se guarda igual, como etiqueta.
   */
  async guardarImagenDeMeta(businessId: string, urlDeMeta: string, token: string): Promise<string | null> {
    try {
      const destino = new URL(urlDeMeta);
      const host = destino.hostname.toLowerCase();
      if (destino.protocol !== 'https:' || !HOSTS_DE_META.some((h) => host === h || host.endsWith(`.${h}`))) return null;
      const res = await fetch(destino, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const original = Buffer.from(await res.arrayBuffer());
      if (original.length > MAX_BYTES_DESCARGA) return null;
      return await this.guardar(businessId, await this.aJpeg(original));
    } catch (e) {
      this.logger.warn(`No se pudo guardar una imagen recibida por WhatsApp: ${describeError(e)}`);
      return null;
    }
  }
}
