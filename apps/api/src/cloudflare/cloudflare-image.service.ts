import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CloudflareGeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

interface WorkersAiErrorBody {
  success: false;
  errors?: { message: string; code: number }[];
}

interface WorkersAiImageBody {
  success: true;
  result: { image: string };
}

// Flux 1 [schnell]: texto → imagen, entra en el free tier diario (10.000
// Neurons/día — ver https://developers.cloudflare.com/workers-ai/platform/pricing/).
// NO usar flux-2-dev acá: ese cobra desde la primera llamada incluso sin
// pasarte del free tier (confirmado 09/2026, no está en la asignación gratis).
const MODEL_GENERATE = '@cf/black-forest-labs/flux-1-schnell';

// Flux 2 [klein] 4B: unifica generación y edición (imagen + texto → imagen),
// también dentro del free tier. Probado 09/2026: NO acepta JSON — el request
// tiene que ser multipart/form-data real (campos "prompt" e "input_image_0"),
// un body JSON tira 400 "required properties at '/' are 'multipart'" pase lo
// que pase en el JSON. IMPORTANTE: el campo de la imagen de referencia es
// "input_image_0" (así nombra Cloudflare sus campos de multi-referencia,
// hasta input_image_3 para hasta 4 imágenes) — un campo "image" a secas NO
// es válido, la API lo ignora en silencio (sigue devolviendo success:true)
// y el modelo genera de cero solo a partir del prompt de texto, sin mirar
// la foto real. Encontrado 22/09/2026 comparando contra ejemplos de curl
// reales de la doc de Cloudflare — esto explicaba resultados que antes
// parecían "el modelo reinterpreta demasiado la imagen".
const MODEL_EDIT = '@cf/black-forest-labs/flux-2-klein-4b';

// code 5035 = "Model X is not available on the Workers Free plan" — no es un
// error nuestro, es que ese modelo puntual requiere upgrade de plan.
const CODIGO_MODELO_NO_DISPONIBLE_EN_FREE = 5035;

// Cloudflare no expone un código propio para esto (viene en el texto del
// mensaje, no en `code`) — el free tier son 10.000 Neurons/día COMPARTIDOS
// entre generateImage() y editImage() (misma cuenta), así que agotarlo
// afecta a las dos funciones del paquete "Avanzado" por igual.
const CUOTA_AGOTADA_RE = /daily free allocation|used up your daily/i;

/**
 * Se lanza cuando Cloudflare devuelve "se acabaron los 10.000 Neurons
 * gratis de hoy" — distinto de "modelo no disponible en este plan" (ese es
 * un problema de configuración nuestro; esto es un límite de uso que se
 * resuelve solo al otro día). Pedido explícito: que el vendedor vea un
 * aviso claro con cuándo vuelve a estar disponible, no un 500 genérico.
 * Los estilos YA cacheados en R2 (ver ImageStudioService.obtenerFondoCacheado)
 * y "sin fondo" (BackgroundRemovalService, corre local, no pega a Cloudflare)
 * NO se ven afectados por este límite — solo la descripción personalizada y
 * los estilos del catálogo que todavía no tienen variantes en R2.
 */
export class CloudflareQuotaExhaustedException extends ServiceUnavailableException {
  constructor() {
    const ahora = new Date();
    const proximoResetUtc = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1, 0, 0, 0));
    const horasRestantes = Math.max(1, Math.ceil((proximoResetUtc.getTime() - ahora.getTime()) / 3_600_000));
    super(
      'Se acabó la cuota gratis de generación de imágenes con IA por hoy (10.000 Neurons de Cloudflare). ' +
        `Se renueva a las 00:00 UTC / 21:00 hora Argentina — quedan aprox. ${horasRestantes}h. ` +
        'Mientras tanto, los estilos ya guardados del catálogo y "Sin fondo" siguen funcionando normalmente.',
    );
  }
}

/**
 * Cliente de Cloudflare Workers AI para generación/edición de imágenes
 * (Flux). Deliberadamente SIN capacidad de chat/texto — Orbi sigue con su
 * propio LLM (ver orbi/llm/), esto es solo para las funciones de imagen del
 * paquete "Avanzado" (ver ImageStudioService).
 *
 * IMPORTANTE sobre editImage() — bug de campo encontrado y corregido
 * (22/09/2026): la imagen de referencia va en el campo "input_image_0", NO
 * en "image" — este último no es un campo real de la API de Flux 2 klein
 * (multi-referencia: "input_image_0".."input_image_3"), así que con "image"
 * el modelo probablemente ignoraba la foto de entrada por completo y
 * generaba una imagen nueva solo a partir del prompt de texto. Eso explica
 * las pruebas anteriores donde "cambiá el fondo, dejá la prenda igual"
 * devolvía una prenda completamente distinta — no era el modelo
 * reinterpretando de más, era que nunca vio la foto real. Con el campo
 * corregido, la fidelidad al producto real mejora muchísimo (ver comparación
 * en el resumen de la tarea), pero SIGUE sin haber garantía formal de
 * preservación exacta (no es inpainting con máscara) — por eso
 * ImageStudioService.generateBackground() sigue sin usar editImage() sobre
 * la foto real del producto para el catálogo (genera el fondo aparte y
 * compone localmente con sharp), y generateModelWearing() sigue devolviendo
 * la advertencia de revisar el resultado antes de publicar.
 *
 * El filtro de contenido de Workers AI tira falsos positivos de NSFW con
 * cierta frecuencia sobre prompts completamente inocuos (confirmado 09/2026:
 * "papel kraft", "piedra clara" — texto sin nada cuestionable, rechazado al
 * primer intento y aceptado al reintentar con el mismo prompt exacto). Por
 * eso generateImage()/editImage() reintentan un par de veces SOLO ante ese
 * error puntual — cualquier otro error (credenciales, modelo no disponible,
 * red) no se reintenta, porque reintentar algo determinístico no cambia nada.
 */
@Injectable()
export class CloudflareImageService {
  private readonly logger = new Logger(CloudflareImageService.name);

  constructor(private readonly config: ConfigService) {}

  private getCreds(): { accountId: string; apiToken: string } {
    // Mismo Account ID que ya usa R2Module (R2_ACCOUNT_ID) — es la misma
    // cuenta de Cloudflare, no hace falta duplicar la variable. El token sí
    // es distinto: el de R2 está scopeado a Object Read&Write, este necesita
    // permiso de Workers AI (ver comentario de armado del token en el
    // resumen de la tarea).
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const apiToken = this.config.get<string>('CF_WORKERS_AI_API_TOKEN');
    if (!accountId || !apiToken) {
      throw new ServiceUnavailableException('La generación de imágenes no está configurada en el servidor');
    }
    return { accountId, apiToken };
  }

  private esFalsoPositivoNsfw(json: WorkersAiErrorBody | null): boolean {
    return !!json?.errors?.some((e) => /nsfw/i.test(e.message));
  }

  private esCuotaAgotada(json: WorkersAiErrorBody | null): boolean {
    return !!json?.errors?.some((e) => CUOTA_AGOTADA_RE.test(e.message));
  }

  private manejarError(model: string, status: number, json: WorkersAiErrorBody | null): never {
    const detalle = json?.errors?.[0]?.message ?? `HTTP ${status}`;
    this.logger.error(`Workers AI (${model}) rechazó la request: ${detalle}`);
    if (this.esCuotaAgotada(json)) {
      throw new CloudflareQuotaExhaustedException();
    }
    if (json?.errors?.some((e) => e.code === CODIGO_MODELO_NO_DISPONIBLE_EN_FREE)) {
      throw new ServiceUnavailableException('Este modelo de imagen no está disponible en el plan actual de Cloudflare');
    }
    throw new InternalServerErrorException('No se pudo generar la imagen. Probá de nuevo.');
  }

  /** Genera una imagen nueva a partir de una descripción en texto (ej. un fondo de estudio). */
  async generateImage(prompt: string): Promise<CloudflareGeneratedImage> {
    const { accountId, apiToken } = this.getCreds();

    const MAX_INTENTOS = 3;
    let ultimoJson: WorkersAiErrorBody | null = null;
    let ultimoStatus = 0;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      let res: Response;
      try {
        res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL_GENERATE}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
      } catch (error) {
        this.logger.error(`Workers AI (${MODEL_GENERATE}) — error de red: ${error}`);
        throw new InternalServerErrorException('No se pudo generar la imagen. Probá de nuevo.');
      }

      const json = (await res.json().catch(() => null)) as WorkersAiImageBody | WorkersAiErrorBody | null;
      if (res.ok && json?.success && 'result' in json && json.result?.image) {
        // Workers AI devuelve JPEG en base64 para flux-1-schnell.
        return { buffer: Buffer.from(json.result.image, 'base64'), mimeType: 'image/jpeg' };
      }

      ultimoJson = json as WorkersAiErrorBody | null;
      ultimoStatus = res.status;
      if (!this.esFalsoPositivoNsfw(ultimoJson) || intento === MAX_INTENTOS) break;
      this.logger.warn(`Workers AI (${MODEL_GENERATE}) — falso positivo NSFW, reintento ${intento}/${MAX_INTENTOS - 1}`);
    }

    this.manejarError(MODEL_GENERATE, ultimoStatus, ultimoJson);
  }

  /**
   * Edita una imagen existente según una instrucción en texto. Real
   * multipart/form-data — ver comentario de MODEL_EDIT arriba, un body JSON
   * no funciona con este modelo aunque el resto de la API sí use JSON. La
   * imagen de referencia va en "input_image_0" (así es como Flux 2 klein
   * nombra sus campos de multi-referencia, hasta input_image_3) — NO existe
   * un campo genérico "image" en este modelo.
   */
  async editImage(prompt: string, image: Buffer, mimeType: string): Promise<CloudflareGeneratedImage> {
    const { accountId, apiToken } = this.getCreds();

    const MAX_INTENTOS = 3;
    let ultimoJson: WorkersAiErrorBody | null = null;
    let ultimoStatus = 0;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      const form = new FormData();
      form.append('prompt', prompt);
      // new Uint8Array(image) copia a un ArrayBuffer "normal" — Buffer tipa su
      // .buffer como ArrayBufferLike (podría ser SharedArrayBuffer), y BlobPart
      // exige ArrayBuffer puntual. Se arma de nuevo en cada intento: un
      // FormData ya usado en un fetch no se puede reenviar tal cual.
      form.append('input_image_0', new Blob([new Uint8Array(image)], { type: mimeType }), 'input');

      let res: Response;
      try {
        res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL_EDIT}`, {
          method: 'POST',
          // Sin Content-Type manual: fetch arma el boundary del multipart solo.
          headers: { Authorization: `Bearer ${apiToken}` },
          body: form,
        });
      } catch (error) {
        this.logger.error(`Workers AI (${MODEL_EDIT}) — error de red: ${error}`);
        throw new InternalServerErrorException('No se pudo editar la imagen. Probá de nuevo.');
      }

      const json = (await res.json().catch(() => null)) as WorkersAiImageBody | WorkersAiErrorBody | null;
      if (res.ok && json?.success && 'result' in json && json.result?.image) {
        return { buffer: Buffer.from(json.result.image, 'base64'), mimeType: 'image/jpeg' };
      }

      ultimoJson = json as WorkersAiErrorBody | null;
      ultimoStatus = res.status;
      if (!this.esFalsoPositivoNsfw(ultimoJson) || intento === MAX_INTENTOS) break;
      this.logger.warn(`Workers AI (${MODEL_EDIT}) — falso positivo NSFW, reintento ${intento}/${MAX_INTENTOS - 1}`);
    }

    this.manejarError(MODEL_EDIT, ultimoStatus, ultimoJson);
  }
}
