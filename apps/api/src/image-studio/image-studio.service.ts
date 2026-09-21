import { ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { BusinessesService } from '../businesses/businesses.service';
import { BackgroundRemovalService } from '../background-removal/background-removal.service';
import { CloudflareImageService } from '../cloudflare/cloudflare-image.service';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';

export interface ImageStudioResult {
  /** Imagen resultante en base64, lista para <img src="data:{mimeType};base64,...">. */
  base64: string;
  mimeType: string;
  /** Solo en generateModelWearing(): el resultado no es determinístico, avisar antes de publicar. */
  advertencia?: string;
}

const PROMPT_FONDO_DEFAULT =
  'a professional studio product photography background, softly lit, seamless backdrop, no text, no watermark, no objects, no people';

const PROMPT_MODELO_DEFAULT =
  'a photorealistic person wearing this exact garment, natural studio lighting, e-commerce fashion photography, neutral background';

/**
 * Orquesta las dos funciones de imagen del paquete "Avanzado" (RBT — sin
 * ticket puntual todavía, ver resumen de la tarea): fondo generado para
 * fotos de producto, y "prenda en un modelo". Usa Cloudflare Workers AI
 * (Flux) — ver CloudflareImageService para el porqué de Workers AI en vez
 * de Gemini (sin tier gratis para imágenes) o Groq (no genera imágenes).
 */
@Injectable()
export class ImageStudioService {
  private readonly logger = new Logger(ImageStudioService.name);

  constructor(
    private readonly businesses: BusinessesService,
    private readonly backgroundRemoval: BackgroundRemovalService,
    private readonly cloudflareImage: CloudflareImageService,
  ) {}

  // Mismo helper que ya usan games/social-proof/promo-modal/two-for-one/
  // countdown (BusinessesService.hasActiveAddon) — auditoría interna 09/09
  // (ítem api.common) encontró que varios de esos módulos NO revalidaban el
  // add-on con una query propia distinta, ver audit-seed.ts. No repetir ese
  // error acá con una query de Prisma propia.
  private async requireAddonAvanzado(businessId: string): Promise<void> {
    if (!(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) {
      throw new ForbiddenException('ADDON_REQUIRED:ADVANCED');
    }
  }

  /**
   * Genera un fondo nuevo para una foto de producto.
   *
   * A PROPÓSITO no le pide a la IA que edite la foto completa: en pruebas,
   * pedirle a Flux "cambiá el fondo, dejá el producto igual" a veces
   * devolvía un producto distinto (mismo prompt, dos corridas, dos prendas
   * diferentes — no es determinístico). Acá el fondo se genera aparte
   * (texto → imagen, sin el producto de por medio) y se compone LOCALMENTE
   * con sharp sobre el recorte que ya da BackgroundRemovalService — el
   * producto queda pixel-perfecto, la IA nunca lo toca.
   */
  async generateBackground(
    businessId: string,
    file: { buffer: Buffer; mimetype: string },
    descripcion?: string,
  ): Promise<ImageStudioResult> {
    await this.requireAddonAvanzado(businessId);

    const cutout = await this.backgroundRemoval.removeBackground(file.buffer, businessId);
    const meta = await sharp(cutout, ENTRADA_IMAGEN).metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1024;

    const prompt = descripcion ? `${PROMPT_FONDO_DEFAULT}, ${descripcion}` : PROMPT_FONDO_DEFAULT;
    const background = await this.cloudflareImage.generateImage(prompt);

    let composedBuffer: Buffer;
    try {
      const backgroundResized = await sharp(background.buffer, ENTRADA_IMAGEN)
        .resize(width, height, { fit: 'cover' })
        .toBuffer();

      composedBuffer = await sharp(backgroundResized, ENTRADA_IMAGEN)
        .composite([{ input: cutout }])
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.error(`No se pudo componer fondo + producto (negocio ${businessId}): ${error}`);
      throw new InternalServerErrorException('No se pudo generar el fondo. Probá de nuevo.');
    }

    return { base64: composedBuffer.toString('base64'), mimeType: 'image/png' };
  }

  /**
   * Genera una versión de la prenda puesta en un modelo. A diferencia de
   * generateBackground(), acá SÍ se le pide a la IA que reinterprete la
   * imagen completa — no hay forma de componer esto localmente. El
   * resultado NO es un "probador virtual" real (no hay garantía de que
   * estampas/logos se reproduzcan tal cual, ver pruebas en el resumen de la
   * tarea) — se devuelve con advertencia explícita para que el vendedor lo
   * revise antes de publicarlo en la tienda.
   */
  async generateModelWearing(
    businessId: string,
    file: { buffer: Buffer; mimetype: string },
    descripcion?: string,
  ): Promise<ImageStudioResult> {
    await this.requireAddonAvanzado(businessId);

    const prompt = descripcion ? `${PROMPT_MODELO_DEFAULT}, ${descripcion}` : PROMPT_MODELO_DEFAULT;
    const result = await this.cloudflareImage.editImage(prompt, file.buffer, file.mimetype);

    return {
      base64: result.buffer.toString('base64'),
      mimeType: result.mimeType,
      advertencia: 'Resultado generado por IA, no determinístico: revisá que la prenda se vea fiel al producto real antes de publicarlo.',
    };
  }
}
