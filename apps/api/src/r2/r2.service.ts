import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 — almacenamiento de los VIDEOS (de producto y del storefront
// de Apariencia, ver businesses.service.ts#uploadStorefrontVideo). Las
// imágenes siguen en Supabase Storage (ver SupabaseService): esto es
// puntual para video, pedido explícito de Ale el 16/09 para manejar mejor
// la capacidad de almacenamiento — el volumen de video pesa mucho más que
// el de fotos y R2 no cobra egress, a diferencia de Supabase Storage.
//
// R2 es compatible con la API S3 — no hay SDK propio de Cloudflare para
// esto, se usa @aws-sdk/client-s3 apuntado al endpoint de la cuenta
// (https://<account_id>.r2.cloudflarestorage.com), región "auto" (R2 no
// tiene regiones reales, cualquier valor no vacío sirve para el SDK).
@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private _client: S3Client | undefined;

  constructor(private readonly config: ConfigService) {}

  private get client(): S3Client {
    if (!this._client) {
      const accountId = this.config.get<string>('R2_ACCOUNT_ID');
      const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
      if (!accountId || !accessKeyId || !secretAccessKey) {
        this.logger.warn('R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY no configurados — subida de video deshabilitada');
      }
      this._client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId ?? ''}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: accessKeyId ?? '', secretAccessKey: secretAccessKey ?? '' },
        // Desde ~diciembre/2024 el SDK v3 agrega por default un checksum
        // (x-amz-checksum-crc32) a cada PutObject, y lo incluye en el cálculo
        // de la firma — R2 no lo soporta igual que S3 real y la firma no
        // coincide del lado de Cloudflare ("SignatureDoesNotMatch"), aunque
        // el Access Key/Secret sean correctos. Encontrado en vivo el 16/09
        // probando la subida real contra R2 (ver r2.unit-spec.ts para el
        // resto del comportamiento). Sin esto, CUALQUIER subida a R2 falla.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        // R2 no resuelve `<bucket>.<accountId>.r2.cloudflarestorage.com`
        // (virtual-hosted style, el default del SDK) — hay que forzar
        // path-style (`<endpoint>/<bucket>/<key>`), documentado por
        // Cloudflare para el cliente S3 de AWS.
        forcePathStyle: true,
      });
    }
    return this._client;
  }

  // Sube el archivo tal cual (mismo criterio que ya tenía
  // uploadStorefrontVideo con Supabase Storage: sin reencodear) y devuelve
  // la URL pública — R2_PUBLIC_URL es el "Public Development URL" de R2
  // (pub-xxxx.r2.dev) o, el día que haya un dominio propio en Cloudflare,
  // ese dominio; el código de acá no necesita saber cuál de los dos es.
  async upload(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const bucket = this.config.get<string>('R2_BUCKET') ?? 'orbita';
    try {
      await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: buffer, ContentType: contentType }));
    } catch (err) {
      this.logger.error(`Subida a R2 (${bucket}/${path}) falló: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo subir el video: el almacenamiento no respondió, probá de nuevo en un rato');
    }
    return this.publicUrlDe(path);
  }

  // El nombre público, sin firmar nada — lo usa `presignUpload()` de acá
  // abajo y `businesses.service.ts` cuando arma la URL final para guardar en
  // el negocio/producto (el mismo cálculo de `upload()`, sin subir nada).
  publicUrlDe(path: string): string {
    const publicUrl = this.config.get<string>('R2_PUBLIC_URL') ?? '';
    return `${publicUrl.replace(/\/$/, '')}/${path}`;
  }

  // URL firmada para que el NAVEGADOR suba el video directo a R2, sin pasar
  // por este backend. Existe porque el camino de arriba (`upload()`) recibe
  // el archivo entero ya bufferizado en memoria por multer — un video de
  // verdad (no solo la foto de un celular) puede tirar abajo la instancia de
  // Cloud Run antes de llegar acá, que es exactamente por qué había un tope
  // de 40 MB (ver MAX_VIDEO_BYTES en subida-video.ts). Con esto el archivo
  // nunca toca la memoria del backend: el navegador hace el PUT directo
  // contra `uploadUrl`, con el `Content-Type` exacto que se firmó acá.
  //
  // Sin `content-length-range`: una URL prefirmada de PutObject no puede
  // limitar el tamaño del lado del proveedor (eso requiere una POST policy,
  // bastante más código para un endpoint que ya exige sesión de dueño/admin
  // o el permiso de catálogo — no vale la pena la complejidad extra acá). El
  // tope real de tamaño lo sigue poniendo el frontend (VideoUploader.tsx,
  // `maxMB`) antes de pedir esta URL.
  async presignUpload(path: string, contentType: string): Promise<string> {
    const bucket = this.config.get<string>('R2_BUCKET') ?? 'orbita';
    try {
      return await getSignedUrl(
        this.client,
        new PutObjectCommand({ Bucket: bucket, Key: path, ContentType: contentType }),
        // 10 minutos para EMPEZAR la subida, no para terminarla — la firma
        // se valida una sola vez, al recibir el request; una vez que arrancó
        // el PUT, R2 no la vuelve a chequear a mitad de transferencia.
        { expiresIn: 600 },
      );
    } catch (err) {
      this.logger.error(`No se pudo firmar la subida a R2 (${bucket}/${path}): ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo preparar la subida: probá de nuevo en un rato');
    }
  }
}
