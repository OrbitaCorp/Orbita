import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import * as path from 'node:path';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';

// U2Netp (Apache-2.0, ~4.6MB) — mismo checkpoint que usa el proyecto `rembg`,
// descargado de sus releases oficiales en GitHub. Corre 100% en este server,
// sin llamadas externas — ver PENDIENTES.md para la decisión de licencia
// (se descartó @imgly/background-removal-node por ser AGPL-3.0).
const MODEL_SIZE = 320;
// Normalización EXACTA tomada de ToTensorLab en xuebinqin/U-2-Net (data_loader.py):
// la imagen se escala por su propio máximo (no una constante fija /255) y
// luego se aplica media/desvío por canal RGB — no son constantes inventadas.
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
// Techo de resolución de entrada — acota memoria/CPU antes de correr el modelo;
// la máscara se reescala de vuelta a la resolución ORIGINAL, no a este techo.
const MAX_INPUT_EDGE = 2000;

// Costo acotado (auditoría interna 10/09, ítem api.background-removal): cada
// foto corre el modelo en la CPU de esta instancia y no había más límite que
// el global por IP. Hasta 30 fotos cada 10 minutos por negocio, y como mucho
// 2 procesándose a la vez (las demás esperan turno). Vive en memoria: con
// varias instancias de Cloud Run el tope real es por instancia, alcanza para
// acotar el costo sin una tabla nueva.
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 30;
const MAX_SIMULTANEOS = 2;

// Erosión morfológica (filtro de mínimo) sobre un buffer de 1 canal —
// separable en pasada horizontal + vertical, O(w·h·radio) en vez de
// O(w·h·radio²) de un min-filter 2D directo. Sharp no expone erode/dilate
// para máscaras de un canal (solo .convolve(), que es un kernel lineal —
// no sirve para un mínimo), así que se hace a mano. Usado para "achicar" la
// máscara de recorte un radio fijo de píxeles — ver el comentario en
// procesar() sobre por qué hace falta esto y no alcanza con un umbral de
// confianza.
function erosionar(mascara: Buffer, width: number, height: number, radio: number): Buffer {
  const horizontal = Buffer.alloc(mascara.length);
  for (let y = 0; y < height; y++) {
    const fila = y * width;
    for (let x = 0; x < width; x++) {
      let min = 255;
      for (let dx = -radio; dx <= radio; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < width) min = Math.min(min, mascara[fila + xx]);
      }
      horizontal[fila + x] = min;
    }
  }
  const resultado = Buffer.alloc(mascara.length);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let min = 255;
      for (let dy = -radio; dy <= radio; dy++) {
        const yy = y + dy;
        if (yy >= 0 && yy < height) min = Math.min(min, horizontal[yy * width + x]);
      }
      resultado[y * width + x] = min;
    }
  }
  return resultado;
}

@Injectable()
export class BackgroundRemovalService {
  private sessionPromise: Promise<ort.InferenceSession> | null = null;
  private readonly usos = new Map<string, number[]>();
  private enCurso = 0;
  private readonly enEspera: Array<() => void> = [];

  // Carga el modelo una sola vez (lazy) y reusa la sesión entre requests.
  private getSession(): Promise<ort.InferenceSession> {
    if (!this.sessionPromise) {
      const modelPath = path.join(__dirname, 'models', 'u2netp.onnx');
      this.sessionPromise = ort.InferenceSession.create(modelPath);
    }
    return this.sessionPromise;
  }

  // Devuelve un buffer PNG con canal alfa (RGBA) — SIN codificar a webp, eso
  // lo hace uploadToStorage() en businesses.service.ts, para no codificar dos veces.
  async removeBackground(buffer: Buffer, businessId: string): Promise<Buffer> {
    // EN MANTENIMIENTO (24/09/2026, pedido explícito): se está reconstruyendo todo
    // el pipeline de "Fondo con IA" (modo gratis actual + modo premium nuevo con
    // Gemini/Workers AI, ver el plan de esa tarea). Único choke point — lo
    // consumen products.service.ts, businesses.service.ts e image-studio.service.ts,
    // así que este throw apaga el toggle "Quitar fondo", el estilo "Sin fondo" del
    // modal "Fondo con IA" y el checkbox de los sliders de Apariencia/Plantillas de
    // una sola vez. Sacar este throw es el primer paso al retomar esa tarea.
    throw new ServiceUnavailableException('"Quitar fondo" está en mantenimiento — vuelve pronto.');
    this.registrarUso(businessId);
    await this.esperarTurno();
    try {
      return await this.procesar(buffer);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      // sharp u onnx: archivo que no es imagen, corrupto o con más píxeles
      // que el tope. Sin el detalle interno.
      throw new BadRequestException('No pudimos quitar el fondo de esta imagen. Probá con otra foto (JPG o PNG, de hasta 60 megapíxeles).');
    } finally {
      this.liberarTurno();
    }
  }

  private registrarUso(businessId: string): void {
    const ahora = Date.now();
    const recientes = (this.usos.get(businessId) ?? []).filter((t) => ahora - t < VENTANA_MS);
    if (recientes.length >= MAX_POR_VENTANA) {
      throw new HttpException('Quitaste el fondo a muchas imágenes seguidas. Esperá unos minutos y volvé a intentar.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recientes.push(ahora);
    this.usos.set(businessId, recientes);
  }

  private async esperarTurno(): Promise<void> {
    if (this.enCurso < MAX_SIMULTANEOS) {
      this.enCurso++;
      return;
    }
    // El turno se transfiere directo desde liberarTurno(): enCurso no baja.
    await new Promise<void>((resolve) => this.enEspera.push(resolve));
  }

  private liberarTurno(): void {
    const siguiente = this.enEspera.shift();
    if (siguiente) siguiente();
    else this.enCurso--;
  }

  private async procesar(buffer: Buffer): Promise<Buffer> {
    // Todas las lecturas del original con el tope de píxeles de las subidas
    // (ENTRADA_IMAGEN): un PNG chico puede declarar cientos de megapíxeles.
    const meta = await sharp(buffer, ENTRADA_IMAGEN).metadata();
    const origWidth = meta.width ?? MODEL_SIZE;
    const origHeight = meta.height ?? MODEL_SIZE;

    // Si la imagen de entrada es muy grande, se trabaja sobre una copia
    // reducida para el modelo — la máscara resultante se reescala luego a la
    // resolución original real, no a esta reducida.
    let sourceForMask = buffer;
    const longEdge = Math.max(origWidth, origHeight);
    if (longEdge > MAX_INPUT_EDGE) {
      const scale = MAX_INPUT_EDGE / longEdge;
      sourceForMask = await sharp(buffer, ENTRADA_IMAGEN)
        .resize(Math.round(origWidth * scale), Math.round(origHeight * scale))
        .toBuffer();
    }

    // Fondo blanco antes de aplanar: evita franjas oscuras si la imagen de
    // origen ya tuviera transparencia parcial.
    const { data: raw } = await sharp(sourceForMask, ENTRADA_IMAGEN)
      .flatten({ background: '#ffffff' })
      .resize(MODEL_SIZE, MODEL_SIZE, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const chwSize = MODEL_SIZE * MODEL_SIZE;
    let maxVal = 1; // evita división por cero si la imagen fuera negra
    for (let i = 0; i < raw.length; i++) if (raw[i] > maxVal) maxVal = raw[i];

    const tensorData = new Float32Array(3 * chwSize);
    for (let p = 0; p < chwSize; p++) {
      const r = raw[p * 3] / maxVal;
      const g = raw[p * 3 + 1] / maxVal;
      const b = raw[p * 3 + 2] / maxVal;
      tensorData[p] = (r - MEAN[0]) / STD[0];
      tensorData[chwSize + p] = (g - MEAN[1]) / STD[1];
      tensorData[2 * chwSize + p] = (b - MEAN[2]) / STD[2];
    }

    const session = await this.getSession();
    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, MODEL_SIZE, MODEL_SIZE]);
    const results = await session.run({ [session.inputNames[0]]: inputTensor });
    const maskData = results[session.outputNames[0]].data as Float32Array;

    // normPRED de u2net_test.py: reescala la salida de la red a [0,1] real
    // según su propio mínimo/máximo antes de convertir a bytes de máscara.
    let maskMin = Infinity;
    let maskMax = -Infinity;
    for (let i = 0; i < maskData.length; i++) {
      if (maskData[i] < maskMin) maskMin = maskData[i];
      if (maskData[i] > maskMax) maskMax = maskData[i];
    }
    const range = maskMax - maskMin || 1;
    const maskBytes = Buffer.alloc(chwSize);
    for (let i = 0; i < chwSize; i++) {
      maskBytes[i] = Math.round(((maskData[i] - maskMin) / range) * 255);
    }

    // Endurece la transición de la máscara Y corre el punto medio hacia
    // arriba (a la 320x320 reducida, más barato que en la resolución final).
    // Sin esto, dos problemas relacionados pero distintos: (1) los píxeles
    // de alfa intermedio conservan el color de fondo ORIGINAL de la foto
    // (blanco/claro de estudio) en su RGB, no el del producto; (2) incluso
    // subiendo el contraste nomás (probado a mano: factor 3 y 5, mismo
    // resultado), un anillo de píxeles de confianza MEDIA-ALTA — no
    // exactamente en el 50%, pero tampoco 100% seguros — quedan marcados
    // como opacos igual, y esos son justo los que en la foto original están
    // en la zona de antialiasing (RGB ya mezclado, grisáceo). Ningún
    // contraste sobre el alfa arregla eso si el pixel igual termina opaco:
    // hay que exigirle más confianza al modelo para contar como "producto",
    // no solo una transición más dura en el mismo punto. Corriendo el punto
    // medio de 127 a 150 ese anillo pasa a NO contar como opaco (se recorta
    // un poco el contorno hacia adentro, imperceptible a simple vista) — es
    // el mismo truco de "choke/shrink matte" de cualquier herramienta de
    // recorte. Confirmado a mano el 21/09/2026: con esto el halo
    // gris/blancuzco alrededor de una remera negra sobre fondo "denim
    // vintage" desapareció por completo (antes, con centro en 127, se
    // notaba un resto fino aunque el contraste ya estuviera en 5).
    const CENTRO_BORDE = 150;
    const CONTRASTE_BORDE = 4;
    for (let i = 0; i < chwSize; i++) {
      maskBytes[i] = Math.max(0, Math.min(255, Math.round((maskBytes[i] - CENTRO_BORDE) * CONTRASTE_BORDE + 127)));
    }

    // Máscara 320×320 → tamaño ORIGINAL real (no el reducido de arriba).
    // Dos trampas de sharp acá, las dos confirmadas con un repro mínimo:
    // (1) .resize() sobre una entrada raw de 1 canal la promueve en silencio
    //     a 3 canales (sRGB) — sin .toColourspace('b-w') el buffer resultante
    //     mide 3x lo esperado y corrompe cualquier lectura por índice.
    // (2) .raw() antes de toBuffer() es obligatorio — sin él, toBuffer()
    //     codifica a PNG y joinChannel() de abajo interpretaría esos bytes
    //     codificados como si fueran píxeles crudos.
    // kernel: 'mitchell' — el default de sharp (lanczos3) genera "ringing"
    // (rebote/overshoot) al agrandar ~7-8x un borde ya duro: en vez de una
    // transición prolija de opaco a transparente, aparece un pico de vuelta
    // hacia opaco justo pasado el contorno real. Ese pico, al pasar por el
    // endurecido de más abajo, se redondea a alfa=255 — y como ese anillo
    // cae FUERA del producto, el RGB que arrastra es el del fondo BLANCO
    // original de la foto, no el del producto. Resultado: una línea blanca
    // sólida calcando el contorno, mucho más marcada que el resto del halo
    // (confirmado a mano el 21/09/2026 con un scan de píxeles: un salto de
    // rgb(24,24,28) a rgb(194,194,196) y de vuelta a rgb(14,27,42) en 4
    // píxeles, justo en el dobladillo). mitchell no genera ese rebote.
    const maskResizedSuave = await sharp(maskBytes, { raw: { width: MODEL_SIZE, height: MODEL_SIZE, channels: 1 } })
      .resize(origWidth, origHeight, { fit: 'fill', kernel: 'mitchell' })
      .toColourspace('b-w')
      .raw()
      .toBuffer();

    // El resize de arriba (320px → resolución real, típicamente ~7-8x) es
    // interpolado: vuelve a meter grises intermedios en el borde aunque la
    // máscara de 320px ya haya quedado dura ahí (cada píxel de la máscara
    // chica se reparte suavizado entre varios píxeles reales). Sin este
    // segundo endurecido, el halo seguía notándose (más fino, pero
    // presente) incluso con CENTRO_BORDE/CONTRASTE_BORDE altos arriba —
    // confirmado a mano el 21/09/2026 comparando un recorte 1:1 sin reescalar.
    const maskDura = Buffer.alloc(maskResizedSuave.length);
    for (let i = 0; i < maskResizedSuave.length; i++) {
      maskDura[i] = Math.max(0, Math.min(255, Math.round((maskResizedSuave[i] - CENTRO_BORDE) * CONTRASTE_BORDE + 127)));
    }

    // "Choke" final: erosiona la máscara unos píxeles hacia adentro — no es
    // ruido de resize (probado con kernel: 'mitchell' arriba, sin cambios),
    // es la SOMBRA DE CONTACTO real que la prenda proyecta sobre la mesa en
    // la foto original (gris, no el fondo parejo) — el modelo a veces la
    // clasifica como "probablemente producto" con más confianza de la que
    // el endurecido de arriba filtra, y esos píxeles arrastran el gris de
    // esa sombra real, no el color de la prenda. Confirmado a mano
    // (21/09/2026) con un scan de píxeles en un dobladillo: rgb(24,24,28)
    // [prenda] → rgb(194,194,196) [sombra de la foto original, mal
    // clasificada como prenda] → rgb(14,27,42) [fondo nuevo] en 4 píxeles.
    // Un umbral de confianza más alto no alcanza de forma confiable (varía
    // según cuán marcada sea la sombra de cada foto) — achicar la silueta un
    // radio fijo sí, sea cual sea la confianza del modelo ahí. Radio
    // proporcional a la resolución (no un número fijo de px): a mano da un
    // resultado parejo entre fotos chicas y grandes.
    const RADIO_EROSION = Math.max(2, Math.round(Math.min(origWidth, origHeight) * 0.006));
    const maskErosionada = erosionar(maskDura, origWidth, origHeight, RADIO_EROSION);

    // El filtro de mínimo de arriba es un cuadrado (separable en horizontal
    // + vertical) — en un borde diagonal o curvo eso deja un contorno
    // dentado tipo escalera en vez de una línea prolija (confirmado a mano:
    // se notaba en la línea del hombro/manga). Un desenfoque chico redondea
    // ese dentado sin reabrir el problema del anillo: como ya está erosionado
    // hacia ADENTRO del área contaminada, volver a suavizar un par de
    // píxeles no vuelve a exponer la sombra de la foto original.
    const maskResized = await sharp(maskErosionada, { raw: { width: origWidth, height: origHeight, channels: 1 } })
      .blur(1.5)
      .toColourspace('b-w') // misma trampa que el resize de arriba: sin esto, sharp promueve a 3 canales en silencio
      .raw()
      .toBuffer();

    // Compone: RGB original + la máscara como canal alfa. joinChannel() sobre
    // un sharp() todavía "encoded" (recién decodificado de PNG/JPEG, sin pasar
    // por .raw()) descarta el canal unido en silencio (channels:3,
    // hasAlpha:false en la salida, sin error) — hay que forzar la decodificación
    // a píxeles crudos primero y recién ahí encadenar joinChannel.
    const { data: rgbRaw, info: rgbInfo } = await sharp(buffer, ENTRADA_IMAGEN)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // NOTA (22/09/2026): hubo acá una "descontaminación" de color por
    // unpremultiply (recuperar el color real del producto en píxeles de
    // alfa parcial, contra un fondo blanco asumido) — se sacó por inestable:
    // la fórmula divide por `alfa`, así que en el anillo de alfa MUY bajo
    // (recién pasado el borde ya erosionado) cualquier ruido de un par de
    // valores en el RGB observado se amplifica a un overshoot enorme que
    // clampea a negro puro — confirmado a mano con una foto de fondo BLANCO
    // (bóxer + caja): quedó un contorno negro grueso rodeando todo el
    // producto. La erosión + el desenfoque de arriba ya sacan el halo del
    // caso real que motivó esto (sombra de contacto mal clasificada, ver
    // comentario de RADIO_EROSION) sin este riesgo — no hacía falta la
    // descontaminación además.
    const compuesta = await sharp(rgbRaw, { raw: { width: rgbInfo.width, height: rgbInfo.height, channels: 3 } })
      .joinChannel(maskResized, { raw: { width: origWidth, height: origHeight, channels: 1 } })
      .png()
      .toBuffer();

    // Recorta el margen transparente que queda alrededor del producto — SIN
    // esto, la foto conserva el tamaño de lienzo original completo (solo se
    // hizo transparente el fondo, no se achicó el lienzo), y si el producto
    // ocupaba una porción chica de esa foto, seguía viéndose chico y
    // "flotando" en las cards del catálogo aunque el fondo ya no se notara
    // — dos productos con foto quedaban con el mismo tamaño de RECUADRO pero
    // el producto en sí a escalas bien distintas entre sí. `background`
    // explícito (en vez de dejar que trim() adivine por el pixel de la
    // esquina superior izquierda) porque el borde de la máscara puede no ser
    // 100% transparente ahí si el fondo original no llegaba a esa esquina.
    try {
      return await sharp(compuesta)
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    } catch {
      // Puede fallar si el modelo no detectó NADA de fondo para recortar
      // (imagen ya sin margen, o la máscara salió toda opaca/transparente
      // pareja) — en ese caso la foto compuesta sin recortar sigue siendo
      // correcta, solo sin este paso extra.
      return compuesta;
    }
  }
}
