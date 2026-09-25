import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { BusinessesService } from '../businesses/businesses.service';
import { BackgroundRemovalService } from '../background-removal/background-removal.service';
import { CloudflareImageService } from '../cloudflare/cloudflare-image.service';
import { GeminiImageService } from '../gemini-image/gemini-image.service';
import { R2Service } from '../r2/r2.service';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';
import { fondoIaEnMantenimiento, fondoIaMotor, MENSAJE_FONDO_IA_MANTENIMIENTO } from '../common/utils/fondo-ia-mantenimiento';
import {
  BACKGROUND_STYLES,
  DEFAULT_BACKGROUND_STYLE,
  PREMIUM_ONLY_STYLES,
  SIN_FONDO_KEY,
  type BackgroundStyle,
  type PremiumOnlyStyle,
} from './background-styles';

export interface ImageStudioResult {
  /** Imagen resultante en base64, lista para <img src="data:{mimeType};base64,...">. */
  base64: string;
  mimeType: string;
  /** Solo en generateModelWearing(): el resultado no es determinístico, avisar antes de publicar. */
  advertencia?: string;
  /** Solo en "Sin fondo": el recorte local probablemente salió mal — el panel ofrece mejorarRecorte(). */
  recorteDificil?: boolean;
}

// Mejorar recorte: solo cambia el fondo, sin tocar el producto (mismo lenguaje
// de preservación que promptPremium) — el blanco liso es lo que hace fácil el
// recorte local posterior.
const PROMPT_FONDO_BLANCO =
  'This is a product photo. Replace ONLY the background with a perfectly flat, uniform, pure white (#FFFFFF) ' +
  'background, with no shadows, no texture and no gradient. Keep the product itself pixel-perfect: same shape, ' +
  'same angle, same text, same logos, same stitching, and the EXACT original colors (same hue, saturation and ' +
  'brightness) — do not redraw, restyle, recolor or reinterpret it in any way. Remove everything that is not the ' +
  'product, including anything visible through gaps, straps or openings of the product.';

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
    private readonly geminiImage: GeminiImageService,
    private readonly r2: R2Service,
    private readonly config: ConfigService,
  ) {}

  // Fotos YA GUARDADAS de un producto (edición, no alta) llegan como URL, no
  // como archivo — bajarlas desde el NAVEGADOR pega contra CORS del storage;
  // servidor a servidor no hay ese problema. Lo que sí hay que cuidar es
  // SSRF: solo se permite bajar de nuestro propio storage (Supabase o R2),
  // nunca una URL arbitraria que mande el cliente — si no, este endpoint
  // sería un proxy para pegarle a cualquier host desde nuestra IP.
  private async resolverImagenPorUrl(imageUrl: string): Promise<{ buffer: Buffer; mimetype: string }> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const r2PublicUrl = this.config.get<string>('R2_PUBLIC_URL');
    const permitido = [supabaseUrl, r2PublicUrl].some((base) => !!base && imageUrl.startsWith(base));
    if (!permitido) throw new BadRequestException('La URL de la imagen no pertenece a este negocio');

    let res: Response;
    try {
      res = await fetch(imageUrl);
    } catch (error) {
      this.logger.error(`No se pudo bajar la imagen guardada (${imageUrl}): ${error}`);
      throw new BadRequestException('No se pudo leer la foto guardada. Probá de nuevo.');
    }
    if (!res.ok) throw new BadRequestException('No se pudo leer la foto guardada. Probá de nuevo.');

    return { buffer: Buffer.from(await res.arrayBuffer()), mimetype: res.headers.get('content-type') || 'image/jpeg' };
  }

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

  // "Sin fondo": siempre el recorte local (ONNX), en los dos modos — ni Gemini ni
  // Workers AI garantizan canal alfa real. Además avisa si el recorte
  // probablemente salió mal (producto y fondo parecidos, ver
  // BackgroundRemovalService.removeBackgroundConAnalisis).
  private async recorteSinFondo(buffer: Buffer, businessId: string): Promise<ImageStudioResult> {
    const { png, dificil } = await this.backgroundRemoval.removeBackgroundConAnalisis(buffer, businessId);
    return { base64: png.toString('base64'), mimeType: 'image/png', recorteDificil: dificil };
  }

  // Elige una de las variantes pre-generadas al azar (no siempre la misma,
  // para que no todos los productos con el mismo estilo se vean idénticos)
  // y la baja de R2. Si R2 no responde (caso raro, no el camino feliz), cae
  // a generar en vivo con Flux en vez de romper el pedido del vendedor —
  // más lento pero mejor que un 500.
  private async obtenerFondoCacheado(style: BackgroundStyle, businessId: string): Promise<Buffer> {
    if (!style.backgroundKeys || style.backgroundKeys.length === 0) {
      return (await this.cloudflareImage.generateImage(style.prompt)).buffer;
    }
    const key = style.backgroundKeys[Math.floor(Math.random() * style.backgroundKeys.length)];
    const url = this.r2.publicUrlDe(key);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      this.logger.warn(`No se pudo bajar el fondo cacheado (${url}) para negocio ${businessId}, generando en vivo: ${error}`);
      return (await this.cloudflareImage.generateImage(style.prompt)).buffer;
    }
  }

  private async obtenerFondoParaComposicion(style: BackgroundStyle, businessId: string): Promise<Buffer> {
    if (style.localAsset) {
      const candidates = [
        path.resolve(process.cwd(), style.localAsset),
        path.resolve(process.cwd(), 'apps/api', style.localAsset),
        path.resolve(__dirname, 'assets/fondos', path.basename(style.localAsset)),
        path.resolve(__dirname, '../../src/image-studio/assets/fondos', path.basename(style.localAsset)),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return await fs.promises.readFile(p);
        }
      }
      this.logger.warn(`Asset local no encontrado para ${style.localAsset}, usando fallback`);
    }

    if (style.backgroundKeys && style.backgroundKeys.length > 0) {
      return await this.obtenerFondoCacheado(style, businessId);
    }

    const defaultStyle = BACKGROUND_STYLES[DEFAULT_BACKGROUND_STYLE];
    if (defaultStyle && defaultStyle.backgroundKeys && defaultStyle.backgroundKeys.length > 0) {
      return await this.obtenerFondoCacheado(defaultStyle, businessId);
    }

    return (await this.cloudflareImage.generateImage(style.prompt)).buffer;
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
   *
   * El fondo NO se genera en vivo por default: cada estilo trae 3 variantes
   * ya generadas y subidas a R2 (scripts/image-studio/seed-backgrounds.ts)
   * — se elige una al azar y se compone, sin llamar a Flux ni gastar cuota.
   * Tiene sentido porque el fondo es genérico (centro vacío a propósito, no
   * depende del producto del vendedor) — no hacía falta generarlo de nuevo
   * en cada uso. Si el vendedor escribe una `descripcion` personalizada, ahí
   * sí se genera en vivo (es un pedido que el catálogo pre-armado no cubre).
   *
   * `file` o `imageUrl`, uno de los dos: `file` para una foto pendiente
   * recién subida (alta), `imageUrl` para una YA GUARDADA de un producto en
   * edición — ver resolverImagenPorUrl().
   */
  async generateBackground(
    businessId: string,
    file?: { buffer: Buffer; mimetype: string },
    estilo?: string,
    descripcion?: string,
    imageUrl?: string,
    photoType?: 'flat' | 'volume',
  ): Promise<ImageStudioResult> {
    await this.requireAddonAvanzado(businessId);

    // EN MANTENIMIENTO (24/09/2026, pedido explícito): se está reconstruyendo
    // este pipeline (modo gratis actual + modo premium nuevo con Gemini/
    // Workers AI). El toggle de producto (products.service.ts) queda pausado
    // igual; uploadStorefrontImage() en businesses.service.ts (sliders de
    // Apariencia/Plantillas) NO se toca, sigue andando con el modelo local.
    // Se habilita con FONDO_IA_MANTENIMIENTO=false (ver fondo-ia-mantenimiento.ts).
    if (fondoIaEnMantenimiento()) throw new ServiceUnavailableException(MENSAJE_FONDO_IA_MANTENIMIENTO);

    const origen = file ?? (imageUrl ? await this.resolverImagenPorUrl(imageUrl) : undefined);
    if (!origen) throw new BadRequestException('Falta la imagen a procesar');

    // "Sin fondo": siempre el recorte local (ONNX segmenter)
    if (estilo === SIN_FONDO_KEY) return this.recorteSinFondo(origen.buffer, businessId);

    const key = estilo ?? DEFAULT_BACKGROUND_STYLE;
    const style: BackgroundStyle | undefined = BACKGROUND_STYLES[key] ?? (PREMIUM_ONLY_STYLES as any)[key];
    if (!style) throw new BadRequestException('Estilo de fondo inválido');

    // Flujo unificado:
    // 1. Intenta Workers AI (hasta 6 intentos).
    // 2. Si falla (error, flag de contenido NSFW, cuota o tras los 6 intentos),
    //    aplica automáticamente fallback al modelo local pulido (BiRefNet-Lite + sombra orgánica + composición).
    const prompt = this.promptPremium(style, descripcion);
    let workersResult: { buffer: Buffer; mimeType: string } | null = null;
    const MAX_INTENTOS_WORKERS = 6;
    let ultimoError: any = null;

    for (let intento = 1; intento <= MAX_INTENTOS_WORKERS; intento++) {
      try {
        this.logger.log(`[generateBackground] Intento ${intento}/${MAX_INTENTOS_WORKERS} con Workers AI (estilo: ${key})`);
        const res = await this.cloudflareImage.editImage(prompt, origen.buffer, origen.mimetype);
        if (res && res.buffer && res.buffer.length > 0) {
          workersResult = res;
          break;
        }
      } catch (err: any) {
        ultimoError = err;
        this.logger.warn(`[generateBackground] Intento ${intento}/${MAX_INTENTOS_WORKERS} falló: ${err?.message || err}`);
        // Si el filtro de contenido de Cloudflare bloqueó la imagen (código 3030 o flagged),
        // reintentar la misma imagen no va a cambiar el resultado. Pasamos de inmediato al modelo local.
        if (err?.message && (err.message.includes('flagged') || err.message.includes('3030') || err.message.includes('NSFW'))) {
          this.logger.warn(`[generateBackground] Workers AI detectó flag de contenido (falso positivo NSFW). Pasando al modelo local.`);
          break;
        }
        // Si la cuota diaria se agotó (429 / 503 / quota), pasamos directo al modelo local
        if (err?.status === 429 || err?.status === 503 || (err?.message && err.message.includes('quota'))) {
          this.logger.warn(`[generateBackground] Cuota de Workers AI agotada o 503. Pasando al modelo local.`);
          break;
        }
        if (intento < MAX_INTENTOS_WORKERS) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    }

    if (workersResult) {
      return {
        base64: workersResult.buffer.toString('base64'),
        mimeType: workersResult.mimeType || 'image/jpeg',
      };
    }

    // Fallback al modelo local pulido (BiRefNet + sombra orgánica doble capa + composición):
    this.logger.log(
      `[generateBackground] Fallback al modelo local (BiRefNet-Lite + sombra orgánica + composición) para estilo: ${key} (${ultimoError?.message})`,
    );
    return await this.componerConModeloLocal(businessId, origen.buffer, style, descripcion);
  }

  private async componerConModeloLocal(
    businessId: string,
    origenBuffer: Buffer,
    style: BackgroundStyle,
    descripcion?: string,
  ): Promise<ImageStudioResult> {
    const cutout = await this.backgroundRemoval.removeBackground(origenBuffer, businessId);
    const meta = await sharp(cutout, ENTRADA_IMAGEN).metadata();
    const cutoutWidth = meta.width ?? 1024;
    const cutoutHeight = meta.height ?? 1024;

    const MARGEN_FONDO = 1.35;
    const anchoConMargen = Math.round(cutoutWidth * MARGEN_FONDO);
    const altoConMargen = Math.round(cutoutHeight * MARGEN_FONDO);

    const ASPECT_OBJETIVO = 3 / 4;
    const productoEsMasAnchoQueElObjetivo = anchoConMargen / altoConMargen > ASPECT_OBJETIVO;
    const width = productoEsMasAnchoQueElObjetivo ? anchoConMargen : Math.round(altoConMargen * ASPECT_OBJETIVO);
    const height = productoEsMasAnchoQueElObjetivo ? Math.round(anchoConMargen / ASPECT_OBJETIVO) : altoConMargen;
    const left = Math.round((width - cutoutWidth) / 2);
    const top = Math.round((height - cutoutHeight) / 2);

    const backgroundBuffer = descripcion
      ? (await this.cloudflareImage.generateImage(`${style.prompt} Additional style note: ${descripcion}.`)).buffer
      : await this.obtenerFondoParaComposicion(style, businessId);

    let composedBuffer: Buffer;
    try {
      const backgroundResized = await sharp(backgroundBuffer, ENTRADA_IMAGEN)
        .resize(width, height, { fit: 'cover' })
        .toBuffer();

      // Sombra de contacto profesional en DOBLE CAPA calculada sobre el lienzo completo:
      // Al renderizar primero el producto centrado en el lienzo final (width x height)
      // con márgenes libres, el desenfoque gaussiano decae de forma 100% natural
      // a cero opacidad sin recortarse contra los límites de una caja delimitadora
      // (evita esquinas cuadradas y líneas rectas en mangas o dobladillos).
      const prodFull = await sharp({
        create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: cutout, left, top }])
        .png()
        .toBuffer();

      const alphaFull = await sharp(prodFull).extractChannel(3).raw().toBuffer();

      // Capa A: Oclusión de Contacto fina (blur 4) - estricto 1 canal b-w
      const alphaContacto = await sharp(alphaFull, { raw: { width, height, channels: 1 } })
        .toColourspace('b-w')
        .blur(4)
        .toColourspace('b-w')
        .raw()
        .toBuffer();

      // Capa B: Difusión Ambiental suave (blur 22) - estricto 1 canal b-w
      const alphaAmbiente = await sharp(alphaFull, { raw: { width, height, channels: 1 } })
        .toColourspace('b-w')
        .blur(22)
        .toColourspace('b-w')
        .raw()
        .toBuffer();

      const contactoRgba = Buffer.alloc(width * height * 4);
      const ambienteRgba = Buffer.alloc(width * height * 4);

      for (let i = 0; i < width * height; i++) {
        contactoRgba[i * 4] = 12;
        contactoRgba[i * 4 + 1] = 12;
        contactoRgba[i * 4 + 2] = 12;
        contactoRgba[i * 4 + 3] = Math.round(alphaContacto[i] * 0.35);

        ambienteRgba[i * 4] = 15;
        ambienteRgba[i * 4 + 1] = 15;
        ambienteRgba[i * 4 + 2] = 15;
        ambienteRgba[i * 4 + 3] = Math.round(alphaAmbiente[i] * 0.18);
      }

      const sombraContacto = await sharp(contactoRgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
      const sombraAmbiente = await sharp(ambienteRgba, { raw: { width, height, channels: 4 } }).png().toBuffer();

      composedBuffer = await sharp(backgroundResized, ENTRADA_IMAGEN)
        .composite([
          { input: sombraAmbiente, top: 8, left: 2 },
          { input: sombraContacto, top: 2, left: 0 },
          { input: prodFull, top: 0, left: 0 },
        ])
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.error(`No se pudo componer fondo + producto (negocio ${businessId}): ${error}`);
      throw new InternalServerErrorException('No se pudo generar el fondo. Probá de nuevo.');
    }

    return { base64: composedBuffer.toString('base64'), mimeType: 'image/png' };
  }

  // Instrucción de edición para el modo premium — validada a mano en esta
  // misma tarea contra Gemini (jersey 49ers, texto/logos densos) y Workers AI
  // (riñonera en ángulo): un solo call de edición sobre la foto COMPLETA
  // preserva el producto igual de bien que componer local, y de paso resuelve
  // 3D sin la metadata de superficie que generateBackground() necesitaría.
  // Reusa style.prompt tal cual (pensado para el catálogo gratis, con
  // VISTA_CENITAL) — en la práctica el modelo lo interpreta como la textura
  // del fondo, no como un mandato de cámara para toda la foto, así que sirve
  // igual para productos en ángulo (ver resumen de la tarea). Catálogo de
  // estilos dedicado a premium (más realista, "podio" para 3D) es la Fase 2.
  // Refuerzo de preservación de color (Fase 2, pedido explícito del
  // vendedor): antes solo decía "same colors" en la misma frase que forma/
  // texto/logos — se lo separa en su propia oración, explícito sobre qué NO
  // hacer (viraje de balance de blancos, recoloreo "para combinar" con el
  // fondo nuevo), porque es el punto más fácil de perder en una edición
  // generativa de la foto completa.
  private promptPremium(style: BackgroundStyle | PremiumOnlyStyle, descripcion?: string): string {
    const escena = descripcion ? `${style.prompt} Additional style note: ${descripcion}.` : style.prompt;
    return (
      'This is a product photo. Replace ONLY the background with the following scene, keeping the product ' +
      'itself pixel-perfect: same shape, same angle, same text, same numbers, same logos, same stitching, same ' +
      'zippers — do not redraw, restyle or reinterpret the product in any way, only place it on the new ' +
      'background with a soft realistic contact shadow. Keep the EXACT original color of the product (same hue, ' +
      'saturation and brightness as the source photo) — do not shift white balance, do not recolor, do not apply ' +
      `any color grading or tint to the product to match the new background. Background scene: ${escena}`
    );
  }

  /**
   * Modo premium de "Fondo con IA": en vez de componer local (ver
   * generateBackground()), le pide a un modelo generativo que edite la foto
   * completa de una sola vez. Dos motores según `photoType` (Product.photoType,
   * decisión del vendedor al cargar el producto — ver el plan "Fondo con IA:
   * pipeline 2D/3D"):
   * - `flat` (indumentaria, la mayoría del catálogo) → Gemini: Workers AI
   *   bloquea con falsos positivos de NSFW la indumentaria femenina ajustada
   *   (confirmado por el vendedor), Gemini no.
   * - `volume` (riñoneras, accesorios) → Workers AI: gratis dentro del free
   *   tier de Cloudflare, y ya resolvió bien un producto en ángulo sin la
   *   metadata de superficie que necesitaría el modo gratis.
   *
   * El caso "Sin fondo" sigue siendo SIEMPRE BackgroundRemovalService (ONNX)
   * acá también — ni Gemini ni Workers AI garantizan canal alfa real, son
   * generativos, no segmentadores.
   */
  async generatePremiumBackground(
    businessId: string,
    photoType?: 'flat' | 'volume',
    file?: { buffer: Buffer; mimetype: string },
    estilo?: string,
    descripcion?: string,
    imageUrl?: string,
  ): Promise<ImageStudioResult> {
    await this.requireAddonAvanzado(businessId);
    if (fondoIaEnMantenimiento()) throw new ServiceUnavailableException(MENSAJE_FONDO_IA_MANTENIMIENTO);

    const origen = file ?? (imageUrl ? await this.resolverImagenPorUrl(imageUrl) : undefined);
    if (!origen) throw new BadRequestException('Falta la imagen a procesar');

    if (estilo === SIN_FONDO_KEY) return this.recorteSinFondo(origen.buffer, businessId);

    // Catálogo combinado: BACKGROUND_STYLES (compartido con el modo gratis)
    // + PREMIUM_ONLY_STYLES (Fase 2 — texturas premium y familia "podio",
    // sin backgroundKeys porque el modo premium no compone contra R2).
    const key = estilo ?? DEFAULT_BACKGROUND_STYLE;
    const style: BackgroundStyle | PremiumOnlyStyle | undefined = BACKGROUND_STYLES[key] ?? PREMIUM_ONLY_STYLES[key];
    if (!style) throw new BadRequestException('Estilo de fondo inválido');

    // "podio_*" está pensado para un producto apoyado sobre una superficie
    // real (perspectiva, profundidad) — no tiene sentido para indumentaria
    // plana. Mismo criterio que la regla firme 2D=Gemini/3D=Workers AI, pero
    // a nivel de catálogo en vez de motor.
    if ('soloVolumen' in style && style.soloVolumen && photoType !== 'volume') {
      throw new BadRequestException('Este estilo es solo para productos con volumen');
    }

    const prompt = this.promptPremium(style, descripcion);
    const result =
      photoType === 'volume' || fondoIaMotor() === 'workers'
        ? await this.cloudflareImage.editImage(prompt, origen.buffer, origen.mimetype)
        : await this.geminiImage.editImage(prompt, origen.buffer, origen.mimetype);

    return { base64: result.buffer.toString('base64'), mimeType: result.mimeType };
  }

  /**
   * "Recorte difícil: mejorar con IA": para fotos donde el recorte local no
   * separa producto de fondo (ej. prenda beige sobre alfombra beige, ver
   * BackgroundRemovalService.removeBackgroundConAnalisis). Gemini reemplaza el
   * fondo por blanco liso (mucho más fácil de recortar que la alfombra) y
   * después se corre el recorte local sobre ESE resultado — devuelve el PNG
   * con transparencia. Siempre Gemini (no Workers AI): sigue la regla de no
   * mandar indumentaria por el filtro NSFW de Cloudflare. Cada llamada cuenta
   * contra el cupo compartido de generaciones IA (ver el controller).
   */
  async mejorarRecorte(
    businessId: string,
    file?: { buffer: Buffer; mimetype: string },
    imageUrl?: string,
  ): Promise<ImageStudioResult> {
    await this.requireAddonAvanzado(businessId);
    if (fondoIaEnMantenimiento()) throw new ServiceUnavailableException(MENSAJE_FONDO_IA_MANTENIMIENTO);

    const origen = file ?? (imageUrl ? await this.resolverImagenPorUrl(imageUrl) : undefined);
    if (!origen) throw new BadRequestException('Falta la imagen a procesar');

    const conFondoBlanco =
      fondoIaMotor() === 'workers'
        ? await this.cloudflareImage.editImage(PROMPT_FONDO_BLANCO, origen.buffer, origen.mimetype)
        : await this.geminiImage.editImage(PROMPT_FONDO_BLANCO, origen.buffer, origen.mimetype);
    const cutout = await this.backgroundRemoval.removeBackground(conFondoBlanco.buffer, businessId);
    return { base64: cutout.toString('base64'), mimeType: 'image/png' };
  }

  /**
   * Genera una versión de la prenda puesta en un modelo. A diferencia de
   * generateBackground(), acá SÍ se le pide a la IA que reinterprete la
   * imagen completa — no hay forma de componer esto localmente. La fidelidad
   * mejoró mucho el 22/09/2026 al corregir un bug en
   * CloudflareImageService.editImage() (el campo de la imagen de referencia
   * estaba mal — ver comentario ahí), pero sigue sin ser un "probador
   * virtual" con garantías: no es inpainting con máscara, así que no hay
   * certeza formal de que estampas/logos se reproduzcan exactos — se
   * devuelve con advertencia explícita para que el vendedor lo revise antes
   * de publicarlo en la tienda.
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
