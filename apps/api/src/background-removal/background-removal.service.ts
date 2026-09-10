import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
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

    // Máscara 320×320 → tamaño ORIGINAL real (no el reducido de arriba).
    // Dos trampas de sharp acá, las dos confirmadas con un repro mínimo:
    // (1) .resize() sobre una entrada raw de 1 canal la promueve en silencio
    //     a 3 canales (sRGB) — sin .toColourspace('b-w') el buffer resultante
    //     mide 3x lo esperado y corrompe cualquier lectura por índice.
    // (2) .raw() antes de toBuffer() es obligatorio — sin él, toBuffer()
    //     codifica a PNG y joinChannel() de abajo interpretaría esos bytes
    //     codificados como si fueran píxeles crudos.
    const maskResized = await sharp(maskBytes, { raw: { width: MODEL_SIZE, height: MODEL_SIZE, channels: 1 } })
      .resize(origWidth, origHeight, { fit: 'fill' })
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
