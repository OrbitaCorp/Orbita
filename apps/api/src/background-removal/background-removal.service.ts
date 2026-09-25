import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';
import { yaEsRecorteConAlfa } from './transparencia';
import { analizarSenales, endurecer, completarHuecos, guidedFilter, recuperarFinos, type SenalesRecorte } from './mask-refine';

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

// Producto y fondo casi del mismo color (distancia RGB media) Y fondo con
// textura (desvío de luminosidad): ahí el modelo local no distingue uno de otro.
const UMBRAL_DISTANCIA_COLOR = 60;
const UMBRAL_TEXTURA_FONDO = 12;

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

  // Detecta si BiRefNet-Lite (alta definición 1024x1024) está disponible;
  // de lo contrario recurre al modelo liviano u2netp (320x320).
  private getModelConfig(): { path: string; size: number; isBiRefNet: boolean } {
    const birefnetPath = path.join(__dirname, 'models', 'birefnet-lite.onnx');
    if (fs.existsSync(birefnetPath)) {
      return { path: birefnetPath, size: 1024, isBiRefNet: true };
    }
    return { path: path.join(__dirname, 'models', 'u2netp.onnx'), size: 320, isBiRefNet: false };
  }

  // Carga el modelo una sola vez (lazy) y reusa la sesión entre requests.
  private getSession(): Promise<ort.InferenceSession> {
    if (!this.sessionPromise) {
      const config = this.getModelConfig();
      this.sessionPromise = ort.InferenceSession.create(config.path, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });
    }
    return this.sessionPromise;
  }

  // Devuelve un buffer PNG con canal alfa (RGBA) — SIN codificar a webp, eso
  // lo hace uploadToStorage() en businesses.service.ts, para no codificar dos veces.
  async removeBackground(buffer: Buffer, businessId: string): Promise<Buffer> {
    return (await this.removeBackgroundConAnalisis(buffer, businessId)).png;
  }

  // Igual que removeBackground() pero además dice si el recorte local
  // PROBABLEMENTE salió mal (producto y fondo del mismo color con textura,
  // ej. prenda beige sobre alfombra beige — el modelo local no los separa):
  // ahí el panel ofrece "mejorar con IA" (ImageStudioService.mejorarRecorte),
  // que consume del cupo de generaciones. Calibrado con solo dos fotos reales
  // (conjunto beige sobre alfombra → dificil; remera negra sobre blanco →
  // no): si aparecen falsos positivos/negativos, ajustar los umbrales de acá.
  async removeBackgroundConAnalisis(buffer: Buffer, businessId: string): Promise<{ png: Buffer; senales: SenalesRecorte; dificil: boolean }> {
    this.registrarUso(businessId);
    await this.esperarTurno();
    try {
      const { png, senales } = await this.procesar(buffer);
      const dificil = senales.distanciaColor < UMBRAL_DISTANCIA_COLOR && senales.texturaFondo > UMBRAL_TEXTURA_FONDO;
      return { png, senales, dificil };
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

  private async procesar(buffer: Buffer): Promise<{ png: Buffer; senales: SenalesRecorte }> {
    // Todas las lecturas del original con el tope de píxeles de las subidas
    // (ENTRADA_IMAGEN): un PNG chico puede declarar cientos de megapíxeles.
    const meta = await sharp(buffer, ENTRADA_IMAGEN).metadata();
    const origWidth = meta.width ?? MODEL_SIZE;
    const origHeight = meta.height ?? MODEL_SIZE;

    // Ya viene recortada (fondo transparente): no se le pasa el modelo, solo se
    // le quita el margen vacío como al resto — ver yaEsRecorteConAlfa.
    if (await yaEsRecorteConAlfa(buffer)) {
      const senalesRecorte: SenalesRecorte = { distanciaColor: 441, texturaFondo: 0, indecision: 0 };
      try {
        const png = await sharp(buffer, ENTRADA_IMAGEN).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        return { png, senales: senalesRecorte };
      } catch {
        return { png: await sharp(buffer, ENTRADA_IMAGEN).png().toBuffer(), senales: senalesRecorte };
      }
    }

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

    const modelConfig = this.getModelConfig();
    const modelSize = modelConfig.size;

    // Fondo blanco antes de aplanar: evita franjas oscuras si la imagen de
    // origen ya tuviera transparencia parcial.
    const { data: raw } = await sharp(sourceForMask, ENTRADA_IMAGEN)
      .flatten({ background: '#ffffff' })
      .resize(modelSize, modelSize, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const chwSize = modelSize * modelSize;
    const tensorData = new Float32Array(3 * chwSize);

    if (modelConfig.isBiRefNet) {
      for (let p = 0; p < chwSize; p++) {
        for (let c = 0; c < 3; c++) {
          tensorData[c * chwSize + p] = (raw[p * 3 + c] / 255 - MEAN[c]) / STD[c];
        }
      }
    } else {
      let maxVal = 1; // evita división por cero si la imagen fuera negra
      for (let i = 0; i < raw.length; i++) if (raw[i] > maxVal) maxVal = raw[i];
      for (let p = 0; p < chwSize; p++) {
        const r = raw[p * 3] / maxVal;
        const g = raw[p * 3 + 1] / maxVal;
        const b = raw[p * 3 + 2] / maxVal;
        tensorData[p] = (r - MEAN[0]) / STD[0];
        tensorData[chwSize + p] = (g - MEAN[1]) / STD[1];
        tensorData[2 * chwSize + p] = (b - MEAN[2]) / STD[2];
      }
    }

    const session = await this.getSession();
    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, modelSize, modelSize]);
    const results = await session.run({ [session.inputNames[0]]: inputTensor });
    const maskData = results[session.outputNames[0]].data as Float32Array;

    const maskBytes = Buffer.alloc(chwSize);
    if (modelConfig.isBiRefNet) {
      for (let i = 0; i < chwSize; i++) {
        maskBytes[i] = Math.round((1 / (1 + Math.exp(-maskData[i]))) * 255);
      }
    } else {
      // normPRED de u2net_test.py: reescala la salida de la red a [0,1] real
      // según su propio mínimo/máximo antes de convertir a bytes de máscara.
      let maskMin = Infinity;
      let maskMax = -Infinity;
      for (let i = 0; i < maskData.length; i++) {
        if (maskData[i] < maskMin) maskMin = maskData[i];
        if (maskData[i] > maskMax) maskMax = maskData[i];
      }
      const range = maskMax - maskMin || 1;
      for (let i = 0; i < chwSize; i++) {
        maskBytes[i] = Math.round(((maskData[i] - maskMin) / range) * 255);
      }
    }

    const senales = analizarSenales(raw, maskBytes);

    // Con BiRefNet-Lite (1024x1024), la máscara nativa ya tiene definición sub-píxel.
    // Se compone directamente sin necesidad de guided-filter ni erosión agresiva.
    if (modelConfig.isBiRefNet) {
      const maskResized =
        origWidth === modelSize && origHeight === modelSize
          ? maskBytes
          : await sharp(maskBytes, { raw: { width: modelSize, height: modelSize, channels: 1 } })
              .resize(origWidth, origHeight, { fit: 'fill', kernel: 'mitchell' })
              .toColourspace('b-w')
              .raw()
              .toBuffer();

      const { data: rgbRaw, info: rgbInfo } = await sharp(buffer, ENTRADA_IMAGEN)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const compuesta = await sharp(rgbRaw, { raw: { width: rgbInfo.width, height: rgbInfo.height, channels: 3 } })
        .joinChannel(maskResized, { raw: { width: origWidth, height: origHeight, channels: 1 } })
        .png()
        .toBuffer();

      try {
        const png = await sharp(compuesta)
          .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        return { png, senales };
      } catch {
        return { png: compuesta, senales };
      }
    }

    const CENTRO_BORDE = 150;
    // Fase 3 (24/09/2026): la máscara se mantiene SUAVE hasta el final y se la
    // afina contra la foto real — antes se endurecía a 320x320 (contraste 4 +
    // punto medio 150) y se volvía a endurecer después de agrandarla ~4-8x, y
    // cada "escalón" de 1 px de la máscara chica quedaba como un escalón de
    // 4-8 px en el contorno (bordes pixelados, sobre todo en mangas y
    // hombros de prendas oscuras sobre fondo claro). Ahora: agrandar suave
    // (mitchell, sin ringing) → guided filter con la foto como guía (el
    // contorno pasa a seguir el borde real de la prenda, no la grilla de
    // 320px) → recién ahí se endurece, se erosiona (sombra de contacto, ver
    // más abajo) y se redondea con un desenfoque + curva S.
    // Todo a una resolución de trabajo acotada (no a los 60 MP posibles): la
    // máscara final se reescala a la real al final.
    const MAX_TRABAJO = 1200;
    const escalaTrabajo = Math.min(1, MAX_TRABAJO / Math.max(origWidth, origHeight));
    const wT = Math.max(1, Math.round(origWidth * escalaTrabajo));
    const hT = Math.max(1, Math.round(origHeight * escalaTrabajo));

    // Trampas de sharp (confirmadas con un repro mínimo, siguen vigentes):
    // (1) .resize() sobre un raw de 1 canal lo promueve en silencio a 3
    //     (sRGB) — sin .toColourspace('b-w') el buffer mide 3x lo esperado.
    // (2) .raw() antes de toBuffer() es obligatorio, si no codifica a PNG.
    // kernel 'mitchell': el default (lanczos3) hace "ringing" al agrandar un
    // borde duro — un pico de vuelta a opaco fuera del contorno real que
    // arrastraba el blanco del fondo original (línea blanca calcando el
    // contorno, confirmado a mano el 21/09/2026).
    const maskSuave = await sharp(maskBytes, { raw: { width: MODEL_SIZE, height: MODEL_SIZE, channels: 1 } })
      .resize(wT, hT, { fit: 'fill', kernel: 'mitchell' })
      .toColourspace('b-w')
      .raw()
      .toBuffer();
    const guiaBytes = await sharp(sourceForMask, ENTRADA_IMAGEN)
      .flatten({ background: '#ffffff' })
      .resize(wT, hT, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();

    const pMask = new Float32Array(wT * hT);
    const guia = new Float32Array(wT * hT);
    for (let i = 0; i < pMask.length; i++) {
      pMask[i] = maskSuave[i] / 255;
      guia[i] = guiaBytes[i] / 255;
    }
    const radioGuia = Math.max(3, Math.round(Math.min(wT, hT) * 0.012));
    const maskGuiada = guidedFilter(guia, pMask, wT, hT, radioGuia, 1e-3);
    // El filtro sigue el brillo de la foto: en una estampa con muchos contrastes
    // (camisa clara con dibujo oscuro) llega a borrar partes claras de la
    // prenda que el modelo tenía bien (confirmado: la máscara cruda del modelo
    // traía el cuello y el hombro completos). Solo puede MOVER el borde un
    // poco respecto de la máscara suave, nunca crear ni tapar bloques.
    const MAX_AJUSTE_GUIA = 0.2;
    for (let i = 0; i < maskGuiada.length; i++) {
      const delta = Math.max(-MAX_AJUSTE_GUIA, Math.min(MAX_AJUSTE_GUIA, maskGuiada[i] - pMask[i]));
      maskGuiada[i] = pMask[i] + delta;
    }

    // Mismo criterio que antes (punto medio corrido hacia arriba: exigirle más
    // confianza al modelo para contar como "producto" — "choke matte", saca
    // el halo del fondo original en píxeles de antialiasing), pero sobre la
    // máscara ya afinada y con transición suave (curva S) en vez de lineal
    // saturada. Confirmado a mano el 21/09/2026: centro 150/255 borra el halo.
    endurecer(maskGuiada, CENTRO_BORDE / 255, 0.14);

    // RGB a la resolución de trabajo, para las correcciones que miran color.
    const rgbTrabajo = await sharp(sourceForMask, ENTRADA_IMAGEN)
      .flatten({ background: '#ffffff' })
      .resize(wT, hT, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();

    // Zonas claras del producto que el modelo tomó por fondo (pantalla de un
    // celular con fondo de pantalla claro sobre blanco liso): se rellenan antes
    // del choke, ver completarHuecos.
    completarHuecos(rgbTrabajo, maskGuiada, wT, hT);

    const maskDura = Buffer.alloc(wT * hT);
    for (let i = 0; i < maskDura.length; i++) maskDura[i] = Math.round(maskGuiada[i] * 255);

    // "Choke" final: erosiona la máscara unos píxeles hacia adentro — es la
    // SOMBRA DE CONTACTO real que la prenda proyecta sobre la mesa en la foto
    // original (gris, no el fondo parejo): el modelo a veces la clasifica como
    // "probablemente producto" y esos píxeles arrastran su gris, no el color
    // de la prenda (confirmado a mano el 21/09/2026 con un scan de píxeles en
    // un dobladillo). Un umbral de confianza más alto no alcanza de forma
    // confiable; achicar la silueta un radio fijo sí. Proporcional a la
    // resolución (no un número fijo de px).
    const RADIO_EROSION = Math.max(2, Math.round(Math.min(wT, hT) * 0.006));
    const maskErosionada = erosionar(maskDura, wT, hT, RADIO_EROSION);

    // Estructuras finas (brazo de un micrófono, cables) que el choke de arriba
    // borra: se recuperan aparte, solo con fondo liso, ver recuperarFinos.
    const bandaFinos = Math.max(2, Math.round(Math.min(wT, hT) * 0.006)) * 2;
    const maskErosionadaF = new Float32Array(wT * hT);
    for (let i = 0; i < maskErosionadaF.length; i++) maskErosionadaF[i] = maskErosionada[i] / 255;
    const finos = recuperarFinos(rgbTrabajo, maskErosionadaF, wT, hT, bandaFinos);

    // El filtro de mínimo es un cuadrado (separable): en un borde diagonal o
    // curvo deja un contorno dentado tipo escalera. Desenfoque proporcional al
    // radio + curva S: redondea el dentado y deja un borde antialiasado de
    // ~2 px sin reabrir el halo (ya está erosionado hacia adentro).
    const maskRedonda = await sharp(maskErosionada, { raw: { width: wT, height: hT, channels: 1 } })
      .blur(Math.max(1.5, RADIO_EROSION * 0.5))
      .toColourspace('b-w') // misma trampa de arriba: sin esto, sharp promueve a 3 canales en silencio
      .raw()
      .toBuffer();
    const maskFinalT = new Float32Array(wT * hT);
    for (let i = 0; i < maskFinalT.length; i++) maskFinalT[i] = maskRedonda[i] / 255;
    endurecer(maskFinalT, 0.5, 0.3);
    if (finos) {
      const finosSuaves = await sharp(Buffer.from(finos), { raw: { width: wT, height: hT, channels: 1 } })
        .blur(0.8)
        .toColourspace('b-w')
        .raw()
        .toBuffer();
      for (let i = 0; i < maskFinalT.length; i++) {
        maskFinalT[i] = Math.max(maskFinalT[i], Math.min(1, (finosSuaves[i] / 255) * 1.6));
      }
    }
    const maskFinalBytes = Buffer.alloc(wT * hT);
    for (let i = 0; i < maskFinalBytes.length; i++) maskFinalBytes[i] = Math.round(maskFinalT[i] * 255);

    const maskResized =
      wT === origWidth && hT === origHeight
        ? maskFinalBytes
        : await sharp(maskFinalBytes, { raw: { width: wT, height: hT, channels: 1 } })
            .resize(origWidth, origHeight, { fit: 'fill', kernel: 'mitchell' })
            .toColourspace('b-w')
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
      const png = await sharp(compuesta)
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      return { png, senales };
    } catch {
      // Puede fallar si el modelo no detectó NADA de fondo para recortar
      // (imagen ya sin margen, o la máscara salió toda opaca/transparente
      // pareja) — en ese caso la foto compuesta sin recortar sigue siendo
      // correcta, solo sin este paso extra.
      return { png: compuesta, senales };
    }
  }
}
