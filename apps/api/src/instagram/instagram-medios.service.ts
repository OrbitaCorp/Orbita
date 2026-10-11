import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ENTRADA_IMAGEN, MAX_IMAGEN_BYTES } from '../common/utils/subida-imagen';
import { describeError } from '../common/utils/describe-error.util';

// Archivos de las publicaciones de Instagram: las fotos del producto, las que el dueño sube desde su
// computadora y los videos.
//
// Instagram baja el archivo de una dirección pública, y pide fotos en JPEG con proporciones que entren en el
// feed. Las fotos se preparan acá: sobre fondo blanco, en un lienzo cuadrado (1:1) o vertical (4:5) a elección,
// y se suben a un lugar temporal que se borra cuando la publicación termina. Los videos van directo del
// navegador al almacenamiento con una dirección firmada: pasarlos por la API chocaría con el tope de tamaño de
// una llamada (Cloud Run, 32 MB), y un video pesa más que eso.

export const BUCKET_INSTAGRAM = 'instagram-media';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const TIPOS_FOTO = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TIPOS_VIDEO: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov' };
const MAX_BYTES_DESCARGA = 25 * 1024 * 1024;
// De dónde se aceptan las imágenes que llegan por mensaje directo (las direcciones las da Instagram).
const HOSTS_DE_INSTAGRAM = ['fbsbx.com', 'cdninstagram.com', 'fbcdn.net', 'instagram.com'];
const LADO_MAX_SUBIDA = 2048;
const LADO_MINIATURA = 320;

export const FORMATOS = { cuadrado: [1080, 1080], vertical: [1080, 1350] } as const;
export type FormatoDeFoto = keyof typeof FORMATOS;

export interface ArchivoSubido {
  /** Ruta en el almacenamiento: es lo que el panel manda después como `ref` de la publicación. */
  ref: string;
  tipo: 'image' | 'video';
  /** Dirección pública para mostrar una vista previa. */
  url: string;
}
export interface ArchivoDeVideoParaSubir extends ArchivoSubido {
  /** A dónde sube el navegador el video (PUT con el archivo). */
  subida: { url: string; token: string };
}

export interface ItemDePublicacion {
  origen: 'producto' | 'subida';
  /** producto: la dirección de la foto del producto. subida: la ruta que devolvió la subida. */
  ref: string;
  tipo: 'image' | 'video';
}
export interface ItemResuelto {
  tipo: 'image' | 'video';
  /** Lo que se le manda a Instagram (JPEG preparado o el video tal cual). */
  url: string;
  /** Archivos del almacenamiento que hay que borrar al terminar. */
  temporales: string[];
  /** Foto chica y persistente para el historial (solo fotos). */
  miniatura: string | null;
}

@Injectable()
export class InstagramMediosService {
  private readonly logger = new Logger(InstagramMediosService.name);
  private bucketListo: Promise<void> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  private get almacen() {
    return this.supabase.adminClient.storage.from(BUCKET_INSTAGRAM);
  }

  // El bucket se crea la primera vez que se usa: público (Instagram tiene que poder bajar los archivos) y con
  // el tope de tamaño de un video. Si ya existe, no pasa nada.
  private async asegurarBucket(): Promise<void> {
    this.bucketListo ??= (async () => {
      const { error } = await this.supabase.adminClient.storage.createBucket(BUCKET_INSTAGRAM, { public: true, fileSizeLimit: MAX_VIDEO_BYTES });
      if (error && !/already exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) {
        this.bucketListo = undefined;
        this.logger.error(`No se pudo preparar el almacenamiento de Instagram: ${error.message}`);
        throw new ServiceUnavailableException('El almacenamiento no respondió, probá de nuevo en un rato.');
      }
    })();
    return this.bucketListo;
  }

  private urlPublica(ruta: string): string {
    return this.almacen.getPublicUrl(ruta).data.publicUrl;
  }

  // ── Subidas desde la computadora ───────────────────────────────────────────

  /** Una foto subida desde la computadora: se endereza, se achica y se guarda como JPEG. */
  async subirFoto(businessId: string, archivo: Express.Multer.File | undefined): Promise<ArchivoSubido> {
    const jpeg = await this.fotoAJpeg(archivo);
    await this.asegurarBucket();
    const ruta = `${businessId}/subidas/${randomUUID()}.jpg`;
    await this.subir(ruta, jpeg, 'image/jpeg');
    return { ref: ruta, tipo: 'image', url: this.urlPublica(ruta) };
  }

  /**
   * La foto que el dueño manda por un mensaje directo: misma preparación, pero queda guardada (es parte de la
   * charla y se vuelve a mostrar), no es un temporal de una publicación.
   */
  async subirFotoDeMensaje(businessId: string, archivo: Express.Multer.File | undefined): Promise<string> {
    const jpeg = await this.fotoAJpeg(archivo);
    await this.asegurarBucket();
    const ruta = `${businessId}/mensajes/${randomUUID()}.jpg`;
    await this.subir(ruta, jpeg, 'image/jpeg');
    return this.urlPublica(ruta);
  }

  /**
   * Una imagen que mandó un cliente por mensaje directo. La dirección que da Instagram vence, así que se baja y
   * se guarda. Mejor esfuerzo: si falla devuelve null y el mensaje se guarda igual (con la dirección original).
   */
  async guardarImagenEntrante(businessId: string, url: string): Promise<string | null> {
    try {
      const destino = new URL(url);
      const host = destino.hostname.toLowerCase();
      if (destino.protocol !== 'https:' || !HOSTS_DE_INSTAGRAM.some((h) => host === h || host.endsWith(`.${h}`))) return null;
      const res = await fetch(destino, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const original = Buffer.from(await res.arrayBuffer());
      if (original.length > MAX_BYTES_DESCARGA) return null;
      const jpeg = await sharp(original, ENTRADA_IMAGEN)
        .rotate()
        .resize(LADO_MAX_SUBIDA, LADO_MAX_SUBIDA, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      await this.asegurarBucket();
      const ruta = `${businessId}/mensajes/${randomUUID()}.jpg`;
      await this.subir(ruta, jpeg, 'image/jpeg');
      return this.urlPublica(ruta);
    } catch (e) {
      this.logger.warn(`No se pudo guardar una imagen recibida por Instagram: ${describeError(e)}`);
      return null;
    }
  }

  private async fotoAJpeg(archivo: Express.Multer.File | undefined): Promise<Buffer> {
    if (!archivo) throw new BadRequestException('Falta la foto.');
    if (!TIPOS_FOTO.has(archivo.mimetype)) throw new BadRequestException('Subí una foto JPG, PNG o WebP.');
    if (archivo.size > MAX_IMAGEN_BYTES) throw new BadRequestException('La foto pesa más de 10 MB.');
    try {
      return await sharp(archivo.buffer, ENTRADA_IMAGEN)
        .rotate()
        .resize(LADO_MAX_SUBIDA, LADO_MAX_SUBIDA, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new BadRequestException('El archivo no es una foto válida o es demasiado grande.');
    }
  }

  /** Dirección firmada para que el navegador suba un video directo al almacenamiento. */
  async prepararVideo(businessId: string, tipoDeArchivo: string, bytes: number): Promise<ArchivoDeVideoParaSubir> {
    const extension = TIPOS_VIDEO[tipoDeArchivo];
    if (!extension) throw new BadRequestException('El video tiene que ser MP4 o MOV.');
    if (!Number.isFinite(bytes) || bytes <= 0) throw new BadRequestException('No se pudo leer el tamaño del video.');
    if (bytes > MAX_VIDEO_BYTES) throw new BadRequestException(`El video pesa más de ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`);
    await this.asegurarBucket();
    const ruta = `${businessId}/subidas/${randomUUID()}.${extension}`;
    const { data, error } = await this.almacen.createSignedUploadUrl(ruta);
    if (error || !data) {
      this.logger.error(`No se pudo firmar la subida del video ${ruta}: ${error?.message}`);
      throw new ServiceUnavailableException('El almacenamiento no respondió, probá de nuevo en un rato.');
    }
    return { ref: ruta, tipo: 'video', url: this.urlPublica(ruta), subida: { url: data.signedUrl, token: data.token } };
  }

  // ── Dejar cada archivo listo para Instagram ────────────────────────────────

  async resolver(businessId: string, item: ItemDePublicacion, formato: FormatoDeFoto, conMiniatura: boolean): Promise<ItemResuelto> {
    if (item.origen === 'producto') {
      if (item.tipo !== 'image') throw new BadRequestException('Las fotos de un producto son solo fotos.');
      // Solo se acepta una foto que realmente es de un producto de ESTE negocio.
      const foto = await this.prisma.productImage.findFirst({
        where: { url: item.ref, product: { businessId } },
        select: { id: true },
      });
      if (!foto) throw new UnprocessableEntityException('Una de las fotos ya no está en tu catálogo. Volvé a elegirla.');
      const original = await this.descargarPublica(item.ref);
      const listo = await this.prepararFoto(businessId, original, formato);
      return { tipo: 'image', url: listo.url, temporales: [listo.ruta], miniatura: conMiniatura ? item.ref : null };
    }

    // Subida: la ruta tiene que ser de este negocio (sin escaparse a otra carpeta).
    const ruta = this.rutaPropia(businessId, item.ref);
    if (item.tipo === 'video') {
      const existe = await this.almacen.exists(ruta).then((r) => (typeof r === 'boolean' ? r : (r as { data?: boolean }).data === true)).catch(() => false);
      if (!existe) throw new UnprocessableEntityException('Un video no terminó de subirse. Volvé a subirlo.');
      return { tipo: 'video', url: this.urlPublica(ruta), temporales: [ruta], miniatura: null };
    }
    const { data, error } = await this.almacen.download(ruta);
    if (error || !data) throw new UnprocessableEntityException('Una de las fotos subidas ya no está disponible. Volvé a subirla.');
    const original = Buffer.from(await data.arrayBuffer());
    const listo = await this.prepararFoto(businessId, original, formato);
    const miniatura = conMiniatura ? await this.guardarMiniatura(businessId, original) : null;
    return { tipo: 'image', url: listo.url, temporales: [ruta, listo.ruta], miniatura };
  }

  /** Borra archivos temporales. Nunca tira: un archivo que quedó de más no justifica romper nada. */
  async limpiar(rutas: string[]): Promise<void> {
    if (rutas.length === 0) return;
    const { error } = await this.almacen.remove(rutas);
    if (error) this.logger.warn(`No se pudieron borrar ${rutas.length} temporales de Instagram: ${error.message}`);
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private rutaPropia(businessId: string, ref: string): string {
    const prefijo = `${businessId}/subidas/`;
    if (!ref.startsWith(prefijo) || !/^[A-Za-z0-9._-]+$/.test(ref.slice(prefijo.length))) {
      throw new BadRequestException('Archivo inválido.');
    }
    return ref;
  }

  private async subir(ruta: string, contenido: Buffer, tipo: string): Promise<void> {
    const { error } = await this.almacen.upload(ruta, contenido, { contentType: tipo, upsert: false });
    if (error) {
      this.logger.error(`Subida de ${ruta} a ${BUCKET_INSTAGRAM} falló: ${error.message}`);
      throw new ServiceUnavailableException('No se pudo preparar el archivo: el almacenamiento no respondió, probá de nuevo en un rato.');
    }
  }

  private async prepararFoto(businessId: string, original: Buffer, formato: FormatoDeFoto): Promise<{ ruta: string; url: string }> {
    const [ancho, alto] = FORMATOS[formato];
    let jpeg: Buffer;
    try {
      jpeg = await sharp(original, ENTRADA_IMAGEN)
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize(ancho, alto, { fit: 'contain', background: '#ffffff' })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new UnprocessableEntityException('Una de las fotos no es una imagen válida para publicar.');
    }
    await this.asegurarBucket();
    const ruta = `${businessId}/publicaciones/${randomUUID()}.jpg`;
    await this.subir(ruta, jpeg, 'image/jpeg');
    return { ruta, url: this.urlPublica(ruta) };
  }

  // Miniatura chica que se queda para el historial: el original subido se borra al terminar.
  private async guardarMiniatura(businessId: string, original: Buffer): Promise<string | null> {
    try {
      const chica = await sharp(original, ENTRADA_IMAGEN)
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize(LADO_MINIATURA, LADO_MINIATURA, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      const ruta = `${businessId}/miniaturas/${randomUUID()}.jpg`;
      await this.subir(ruta, chica, 'image/jpeg');
      return this.urlPublica(ruta);
    } catch (e) {
      this.logger.warn(`No se pudo guardar la miniatura: ${describeError(e)}`);
      return null;
    }
  }

  // Solo se baja de direcciones https públicas: la dirección sale de la ficha del producto, pero no se le pide
  // al servidor que llegue a nada interno.
  private async descargarPublica(url: string): Promise<Buffer> {
    let destino: URL;
    try {
      destino = new URL(url);
    } catch {
      throw new UnprocessableEntityException('Una foto del producto no tiene una dirección válida.');
    }
    const host = destino.hostname.toLowerCase();
    if (destino.protocol !== 'https:' || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new UnprocessableEntityException('Una foto del producto no se puede usar para publicar.');
    }
    try {
      const res = await fetch(destino, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_BYTES_DESCARGA) throw new Error('foto demasiado pesada');
      return buffer;
    } catch (e) {
      this.logger.warn(`No se pudo bajar una foto para Instagram: ${describeError(e)}`);
      throw new ServiceUnavailableException('No se pudo leer una foto del producto. Probá de nuevo en un momento.');
    }
  }
}
