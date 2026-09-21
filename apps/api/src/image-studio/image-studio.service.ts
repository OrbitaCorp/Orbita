import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { BusinessesService } from '../businesses/businesses.service';
import { BackgroundRemovalService } from '../background-removal/background-removal.service';
import { CloudflareImageService } from '../cloudflare/cloudflare-image.service';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';
import { BACKGROUND_STYLES, DEFAULT_BACKGROUND_STYLE } from './background-styles';

export interface ImageStudioResult {
  /** Imagen resultante en base64, lista para <img src="data:{mimeType};base64,...">. */
  base64: string;
  mimeType: string;
  /** Solo en generateModelWearing(): el resultado no es determinístico, avisar antes de publicar. */
  advertencia?: string;
}

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
   * Genera un fondo nuevo para una foto de producto, eligiendo un estilo del
   * catálogo curado (ver background-styles.ts — madera, mármol con plantas,
   * calle urbana, lino con flores, etc., cada uno pensado para un rubro
   * distinto: no es lo mismo perfumería que ropa urbana o joyería).
   *
   * A PROPÓSITO no le pide a la IA que edite la foto completa: en pruebas,
   * pedirle a Flux "cambiá el fondo, dejá el producto igual" a veces
   * devolvía un producto distinto (mismo prompt, dos corridas, dos prendas
   * diferentes — no es determinístico; con un prompt de estilo editorial
   * "lino + flores" convirtió unos aros en un colgante). Acá el fondo se
   * genera aparte (texto → imagen, con el tercio central vacío a propósito)
   * y se compone LOCALMENTE con sharp sobre el recorte que ya da
   * BackgroundRemovalService — el producto queda pixel-perfecto, la IA
   * nunca lo toca. Validado a mano con una foto de producto real (remera
   * MLB) contra varios estilos del catálogo — ver resumen de la tarea.
   *
   * Sombra de contacto (feedback real: sin esto el producto "flota" sobre
   * el fondo) — también determinística, no generativa: se difumina la
   * silueta del alfa del recorte y se usa como canal alfa de un negro semi-
   * transparente, desplazada unos px (luz simulada desde arriba-izquierda).
   * Se probó primero pedirle a la IA que ajustara luz/sombra sobre la
   * imagen YA compuesta con una consigna ultra conservadora ("no cambies
   * nada más") — igual reinventó la prenda (remera distinta, logo
   * distinto). Ni con el pedido más chico posible es confiable tocar la
   * imagen con este modelo, así que la sombra queda 100% del lado de sharp.
   */
  async generateBackground(
    businessId: string,
    file: { buffer: Buffer; mimetype: string },
    estilo?: string,
    descripcion?: string,
  ): Promise<ImageStudioResult> {
    await this.requireAddonAvanzado(businessId);

    const style = BACKGROUND_STYLES[estilo ?? DEFAULT_BACKGROUND_STYLE];
    if (!style) throw new BadRequestException('Estilo de fondo inválido');

    const cutout = await this.backgroundRemoval.removeBackground(file.buffer, businessId);
    const meta = await sharp(cutout, ENTRADA_IMAGEN).metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1024;

    const prompt = descripcion ? `${style.prompt} Additional style note: ${descripcion}.` : style.prompt;
    const background = await this.cloudflareImage.generateImage(prompt);

    let composedBuffer: Buffer;
    try {
      const backgroundResized = await sharp(background.buffer, ENTRADA_IMAGEN)
        .resize(width, height, { fit: 'cover' })
        .toBuffer();

      // Silueta del producto difuminada y atenuada al 45%, usada como canal
      // alfa de un negro transparente — no un negro sólido tapando todo el
      // fondo (ese fue el bug de la primera versión: 'multiply' con una
      // máscara sin atenuar ennegrecía TODA el área fuera del producto).
      const sombraAlfa = await sharp(cutout, ENTRADA_IMAGEN)
        .ensureAlpha()
        .extractChannel('alpha')
        .blur(18)
        .linear(0.45, 0)
        .raw()
        .toBuffer();
      const sombra = await sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
        .joinChannel(sombraAlfa, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer();

      // Desplazada unos px hacia abajo/derecha (luz simulada desde arriba-
      // izquierda) — el recorte crudo va encima tapando la sombra que cae
      // debajo suyo; solo asoma el borde, como una sombra de contacto real.
      const desplazamiento = Math.round(height * 0.012);

      composedBuffer = await sharp(backgroundResized, ENTRADA_IMAGEN)
        .composite([
          { input: sombra, top: desplazamiento, left: desplazamiento },
          { input: cutout, top: 0, left: 0 },
        ])
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
