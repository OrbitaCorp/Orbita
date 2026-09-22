import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { BusinessesService } from '../businesses/businesses.service';
import { BackgroundRemovalService } from '../background-removal/background-removal.service';
import { CloudflareImageService } from '../cloudflare/cloudflare-image.service';
import { R2Service } from '../r2/r2.service';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';
import { BACKGROUND_STYLES, DEFAULT_BACKGROUND_STYLE, SIN_FONDO_KEY, type BackgroundStyle } from './background-styles';

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

  // Elige una de las variantes pre-generadas al azar (no siempre la misma,
  // para que no todos los productos con el mismo estilo se vean idénticos)
  // y la baja de R2. Si R2 no responde (caso raro, no el camino feliz), cae
  // a generar en vivo con Flux en vez de romper el pedido del vendedor —
  // más lento pero mejor que un 500.
  private async obtenerFondoCacheado(style: BackgroundStyle, businessId: string): Promise<Buffer> {
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
  ): Promise<ImageStudioResult> {
    await this.requireAddonAvanzado(businessId);

    const origen = file ?? (imageUrl ? await this.resolverImagenPorUrl(imageUrl) : undefined);
    if (!origen) throw new BadRequestException('Falta la imagen a procesar');

    // "Sin fondo": no compone nada, devuelve directo el recorte transparente
    // — mismo motor que el toggle "Quitar fondo" de siempre (que solo aplica
    // recién al subir la foto, sin preview) pero con resultado inmediato acá.
    if (estilo === SIN_FONDO_KEY) {
      const cutout = await this.backgroundRemoval.removeBackground(origen.buffer, businessId);
      return { base64: cutout.toString('base64'), mimeType: 'image/png' };
    }

    const style = BACKGROUND_STYLES[estilo ?? DEFAULT_BACKGROUND_STYLE];
    if (!style) throw new BadRequestException('Estilo de fondo inválido');

    const cutout = await this.backgroundRemoval.removeBackground(origen.buffer, businessId);
    const meta = await sharp(cutout, ENTRADA_IMAGEN).metadata();
    const cutoutWidth = meta.width ?? 1024;
    const cutoutHeight = meta.height ?? 1024;

    // El canvas del compuesto NO hereda el aspect ratio de la foto tal cual
    // la subió el vendedor (arbitraria) — se fuerza a 3:4, el mismo aspect
    // ratio que usa ProductCard.tsx en la tienda (contenedor con
    // aspectRatio:'3/4' + object-fit:contain). Feedback real: un compuesto
    // con OTRO aspect ratio quedaba "chico" en la tarjeta — contain no
    // recorta, deja franjas vacías donde el aspect ratio no coincide con el
    // del contenedor (ver comparación en el resumen de la tarea: mismo tipo
    // de fondo, uno lleno de borde a borde y otro con letterboxing). El
    // producto NO se estira ni se recorta acá — va centrado a tamaño
    // natural, y el fondo (una textura genérica pensada para extenderse) se
    // agranda para llenar el resto del canvas.
    // Margen alrededor del producto — historia completa (21/09/2026):
    // 1) Primer intento: 60% de margen en las dos direcciones. Con
    //    object-fit:contain (lo que usaba el storefront en ese momento) eso
    //    ACHICABA la prenda en pantalla: contain escala la imagen COMPLETA
    //    para que entre en su recuadro, así que si la prenda ocupa el 62%
    //    del lienzo, se ve al 62% de grande — sin importar los píxeles del
    //    archivo. Se revirtió a MARGEN_FONDO=1 (sin margen).
    // 2) Con el margen en 1 (cero slack), al pasar las imágenes de "Fondo
    //    con IA" a object-fit:cover (ver ProductImage.hasAiBackground) el
    //    problema cambió de signo: cover SÍ recorta lo que sobra para
    //    llenar el recuadro, y sin margen no hay nada de fondo para
    //    recortar — recorta directo la prenda si el recuadro real no
    //    coincide exacto con el 3:4 del lienzo (confirmado a mano: una
    //    camisa quedó con los costados cortados en la ficha real).
    // Con cover, a diferencia de contain, el margen NO achica la prenda en
    // pantalla — cover siempre escala hasta llenar el recuadro, así que el
    // margen es pura "tela de sobra" para recortar, nunca visible como
    // reducción de tamaño. Por eso se puede volver a agregar sin reabrir el
    // problema del punto 1. 1.35 (35% extra por eje) es un valor moderado:
    // no tan grande como el primer intento, pensado para absorber el rango
    // normal de formas de recuadro entre escritorio y laptop.
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
      : await this.obtenerFondoCacheado(style, businessId);

    let composedBuffer: Buffer;
    try {
      const backgroundResized = await sharp(backgroundBuffer, ENTRADA_IMAGEN)
        .resize(width, height, { fit: 'cover' })
        .toBuffer();

      // Sombra en DOS capas, no una — una sombra real tiene dos componentes
      // distintas: un "contacto" chico y oscuro justo donde el producto
      // toca la mesa (ahí no entra nada de luz) y una "ambiente" grande y
      // difusa alrededor (el producto tapa un poco la luz que llega desde
      // varios lados, se nota mucho menos pero se extiende más lejos). Con
      // una sola sombra tratando de cumplir las dos funciones a la vez, el
      // resultado quedaba a mitad de camino: ni el contacto se notaba
      // firme, ni la ambiente daba sensación real de volumen — la prenda se
      // veía "pegada" sobre el fondo en vez de apoyada.
      //
      // La ambiente NO sale de difuminar la silueta del recorte (como sí
      // hace la de contacto) — feedback real (21/09/2026): un producto de
      // contorno más bien rectangular (remera doblada, caja) sigue
      // leyéndose como "un rectángulo con blur" sin importar cuánto blur o
      // cuán suave la opacidad, porque la forma de origen ya es un
      // rectángulo. Una elipse con gradiente radial (dibujada aparte, no
      // derivada del contorno) da la misma sensación de volumen sin heredar
      // esa forma — no tiene esquinas que blurear.
      const alfaContacto = await sharp(cutout, ENTRADA_IMAGEN)
        .ensureAlpha()
        .extractChannel('alpha')
        .blur(6)
        .linear(0.55, 0)
        .raw()
        .toBuffer();
      const sombraContacto = await sharp({ create: { width: cutoutWidth, height: cutoutHeight, channels: 3, background: { r: 0, g: 0, b: 0 } } })
        .joinChannel(alfaContacto, { raw: { width: cutoutWidth, height: cutoutHeight, channels: 1 } })
        .png()
        .toBuffer();

      // Centrada bajo el producto, un poco más abajo del centro y algo más
      // ancha/baja que su bounding box (una sombra apoyada "cae" y se
      // ensancha levemente en vez de calcar el contorno exacto).
      const cxAmbiente = left + cutoutWidth / 2;
      const cyAmbiente = top + cutoutHeight * 0.54;
      const rxAmbiente = cutoutWidth * 0.56;
      const ryAmbiente = cutoutHeight * 0.46;
      const sombraAmbiente = Buffer.from(`<svg width="${width}" height="${height}">
        <defs>
          <radialGradient id="sombraAmbiente" cx="${cxAmbiente}" cy="${cyAmbiente}" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(${rxAmbiente} 0 0 ${ryAmbiente} ${cxAmbiente - rxAmbiente} ${cyAmbiente - ryAmbiente}) translate(1 1)">
            <stop offset="0%" stop-color="black" stop-opacity="0.30"/>
            <stop offset="55%" stop-color="black" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="black" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="${cxAmbiente}" cy="${cyAmbiente}" rx="${rxAmbiente}" ry="${ryAmbiente}" fill="url(#sombraAmbiente)"/>
      </svg>`);

      // Contacto desplazada hacia abajo/derecha (luz simulada desde arriba-
      // izquierda) — el recorte crudo va encima tapando la sombra que cae
      // debajo suyo, solo asoma el borde. La ambiente ya está centrada por
      // su propio gradiente, no necesita desplazamiento aparte.
      const despContacto = Math.round(cutoutHeight * 0.006);

      composedBuffer = await sharp(backgroundResized, ENTRADA_IMAGEN)
        .composite([
          { input: sombraAmbiente, top: 0, left: 0 },
          { input: sombraContacto, top: top + despContacto, left: left + despContacto },
          { input: cutout, top, left },
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
