// Refinamiento de la máscara de recorte (Fase 3 de "Fondo con IA").
//
// U2Netp trabaja a 320x320 fijos (el .onnx no acepta otra resolución): al
// agrandar esa máscara ~4-8x hasta la foto real, el contorno hereda los
// "escalones" de 1 píxel de la máscara chica — endurecerlo después (como se
// hacía antes) solo los vuelve más notorios (bordes pixelados en mangas y
// hombros). Acá la máscara se mantiene SUAVE (flotante) y se la hace seguir
// los bordes reales de la foto con un guided filter (He et al.), y recién
// después se endurece.

/** Promedio en ventana (2r+1)² con bordes replicados, separable, O(w·h). */
export function boxFilter(src: Float32Array, width: number, height: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[row + Math.min(width - 1, Math.max(0, k))];
    tmp[row] = sum / n;
    for (let x = 1; x < width; x++) {
      sum += src[row + Math.min(width - 1, x + r)] - src[row + Math.max(0, x - r - 1)];
      tmp[row + x] = sum / n;
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += tmp[Math.min(height - 1, Math.max(0, k)) * width + x];
    out[x] = sum / n;
    for (let y = 1; y < height; y++) {
      sum += tmp[Math.min(height - 1, y + r) * width + x] - tmp[Math.max(0, y - r - 1) * width + x];
      out[y * width + x] = sum / n;
    }
  }
  return out;
}

/**
 * Guided filter de una sola guía (luma de la foto): suaviza `p` (la máscara)
 * preservando los bordes que existen en `guide`. Valores en [0,1].
 */
export function guidedFilter(guide: Float32Array, p: Float32Array, width: number, height: number, r: number, eps: number): Float32Array {
  const size = guide.length;
  const meanI = boxFilter(guide, width, height, r);
  const meanP = boxFilter(p, width, height, r);
  const ip = new Float32Array(size);
  const ii = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    ip[i] = guide[i] * p[i];
    ii[i] = guide[i] * guide[i];
  }
  const meanIP = boxFilter(ip, width, height, r);
  const meanII = boxFilter(ii, width, height, r);

  const a = new Float32Array(size);
  const b = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const varI = meanII[i] - meanI[i] * meanI[i];
    const covIP = meanIP[i] - meanI[i] * meanP[i];
    a[i] = covIP / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxFilter(a, width, height, r);
  const meanB = boxFilter(b, width, height, r);

  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.min(1, Math.max(0, meanA[i] * guide[i] + meanB[i]));
  return out;
}

/** Curva S en [0,1]: 0 por debajo de `centro - ancho`, 1 por encima de `centro + ancho`. */
export function endurecer(mascara: Float32Array, centro: number, ancho: number): void {
  const lo = centro - ancho;
  const span = 2 * ancho;
  for (let i = 0; i < mascara.length; i++) {
    const t = Math.min(1, Math.max(0, (mascara[i] - lo) / span));
    mascara[i] = t * t * (3 - 2 * t);
  }
}

export interface SenalesRecorte {
  /** Distancia RGB entre el color medio del producto y el del fondo (0-441): chica = se parecen. */
  distanciaColor: number;
  /** Desvío estándar de la luminosidad del fondo (0-255): alto = fondo con textura. */
  texturaFondo: number;
  /** Fracción de píxeles "indecisos" del modelo (ni producto ni fondo) sobre producto + indecisos. */
  indecision: number;
}

/**
 * Señales baratas (sobre la máscara y la foto de 320x320 que ya se calcularon)
 * para decidir si un recorte local probablemente salió mal — ver
 * BackgroundRemovalService.removeBackgroundConAnalisis().
 */
export function analizarSenales(rgb: Uint8Array | Buffer, mascara: Uint8Array | Buffer): SenalesRecorte {
  const n = mascara.length;
  let nFg = 0, nBg = 0, nMid = 0;
  const fg = [0, 0, 0], bg = [0, 0, 0];
  let sumL = 0, sumL2 = 0;
  for (let i = 0; i < n; i++) {
    const m = mascara[i];
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    if (m >= 150) {
      nFg++; fg[0] += r; fg[1] += g; fg[2] += b;
    } else if (m <= 60) {
      nBg++; bg[0] += r; bg[1] += g; bg[2] += b;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      sumL += l; sumL2 += l * l;
    } else nMid++;
  }
  if (nFg === 0 || nBg === 0) return { distanciaColor: 441, texturaFondo: 0, indecision: 0 };
  const d = Math.hypot(fg[0] / nFg - bg[0] / nBg, fg[1] / nFg - bg[1] / nBg, fg[2] / nFg - bg[2] / nBg);
  const meanL = sumL / nBg;
  return {
    distanciaColor: d,
    texturaFondo: Math.sqrt(Math.max(0, sumL2 / nBg - meanL * meanL)),
    indecision: nMid / (nFg + nMid),
  };
}

/**
 * Recupera estructuras finas (brazo de un micrófono, un cable) que la erosión
 * de borde borra: el modelo (320 px) las ve como ~1 px, y un choke de varios
 * px las elimina. La `mascara` que recibe es la YA erosionada. Solo aplica con fondo
 * LISO (un estudio blanco): ahí "distinto del fondo" y "conectado al producto"
 * alcanza para decidir. Con fondo con textura devuelve null (no se arriesga).
 *
 * Para no reabrir el halo/sombra pegado al contorno (lo que la erosión quita a
 * propósito), solo se recuperan píxeles LEJOS de la máscara (> `banda`) y, de
 * los cercanos, los que llegan hasta `banda + 2` pasos de un píxel lejano —
 * es decir, el tramo del brazo que se apoya en el producto, no todo el anillo.
 */
export function recuperarFinos(
  rgb: Uint8Array | Buffer,
  mascara: Float32Array,
  w: number,
  h: number,
  banda: number,
  opciones: { distanciaMin?: number; maxFraccion?: number } = {},
): Uint8Array | null {
  const distanciaMin = opciones.distanciaMin ?? 250;
  const maxFraccion = opciones.maxFraccion ?? 0.08;
  const n = w * h;

  // Color de fondo = promedio del borde; si el borde no es parejo, no es liso.
  let br = 0, bg = 0, bb = 0, nb = 0;
  const visitarBorde = (x: number, y: number) => {
    const i = (y * w + x) * 3;
    br += rgb[i]; bg += rgb[i + 1]; bb += rgb[i + 2]; nb++;
  };
  for (let x = 0; x < w; x++) { visitarBorde(x, 0); visitarBorde(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { visitarBorde(0, y); visitarBorde(w - 1, y); }
  br /= nb; bg /= nb; bb /= nb;
  let parejos = 0;
  const distFondo = (i: number) => Math.hypot(rgb[i * 3] - br, rgb[i * 3 + 1] - bg, rgb[i * 3 + 2] - bb);
  for (let x = 0; x < w; x++) {
    if (distFondo(x) < 30) parejos++;
    if (distFondo((h - 1) * w + x) < 30) parejos++;
  }
  for (let y = 1; y < h - 1; y++) {
    if (distFondo(y * w) < 30) parejos++;
    if (distFondo(y * w + w - 1) < 30) parejos++;
  }
  if (parejos / nb < 0.9) return null;

  const enMascara = new Uint8Array(n);
  let nMask = 0;
  for (let i = 0; i < n; i++) if (mascara[i] >= 0.5) { enMascara[i] = 1; nMask++; }
  if (nMask === 0) return null;

  // Píxeles "cerca" de la máscara (dilatación cuadrada de radio `banda`), separable.
  const cerca = dilatar(enMascara, w, h, banda);

  const cand = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (!enMascara[i] && distFondo(i) > distanciaMin) cand[i] = 1;

  // A: todo lo candidato conectado (8 vecinos) a la máscara.
  const enA = new Uint8Array(n);
  const cola = new Int32Array(n);
  let ini = 0, fin = 0;
  for (let i = 0; i < n; i++) if (enMascara[i]) cola[fin++] = i;
  const vecinos = (i: number, f: (j: number) => void) => {
    const x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if ((dx === 0 && dy === 0) || xx < 0 || xx >= w) continue;
        f(yy * w + xx);
      }
    }
  };
  while (ini < fin) {
    const i = cola[ini++];
    vecinos(i, (j) => {
      if (cand[j] && !enA[j]) { enA[j] = 1; cola[fin++] = j; }
    });
  }

  // B: de A, lo lejano + el tramo cercano que cuelga de un píxel lejano.
  const out = new Uint8Array(n);
  const pasos = new Int16Array(n).fill(-1);
  ini = 0; fin = 0;
  let agregados = 0;
  for (let i = 0; i < n; i++) {
    if (enA[i] && !cerca[i]) { out[i] = 255; pasos[i] = 0; cola[fin++] = i; agregados++; }
  }
  if (agregados === 0) return null;
  const limite = banda + 2;
  while (ini < fin) {
    const i = cola[ini++];
    vecinos(i, (j) => {
      if (!enA[j] || pasos[j] >= 0) return;
      const p = pasos[i] + 1;
      if (p > limite) return;
      pasos[j] = p; out[j] = 255; agregados++; cola[fin++] = j;
    });
  }
  if (agregados / nMask > maxFraccion) return null;
  return out;
}

function dilatar(bin: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(bin.length);
  const out = new Uint8Array(bin.length);
  for (let y = 0; y < h; y++) {
    let ultimo = -Infinity;
    // marca x si hay un 1 en [x-r, x+r]: barrido hacia adelante y atrás
    const fila = y * w;
    for (let x = 0; x < w; x++) { if (bin[fila + x]) ultimo = x; if (x - ultimo <= r) tmp[fila + x] = 1; }
    ultimo = Infinity;
    for (let x = w - 1; x >= 0; x--) { if (bin[fila + x]) ultimo = x; if (ultimo - x <= r) tmp[fila + x] = 1; }
  }
  for (let x = 0; x < w; x++) {
    let ultimo = -Infinity;
    for (let y = 0; y < h; y++) { if (tmp[y * w + x]) ultimo = y; if (y - ultimo <= r) out[y * w + x] = 1; }
    ultimo = Infinity;
    for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) ultimo = y; if (ultimo - y <= r) out[y * w + x] = 1; }
  }
  return out;
}

/**
 * Rellena huecos que el modelo abre DENTRO del producto cuando este tiene
 * zonas claras sobre un fondo blanco liso (ej. la pantalla de un celular con
 * un fondo de pantalla claro: el modelo de 320 px la toma por fondo y la
 * perfora). Solo con fondo liso. Suma a la máscara los píxeles que (1) se
 * distinguen del fondo, (2) caen dentro del casco convexo de la máscara y (3)
 * están conectados a ella. El casco deja afuera la sombra que se proyecta
 * fuera del producto, y un hueco de fondo puro (el aro de un bolso) no se
 * rellena porque su color ES el del fondo.
 *
 * Solo actúa cuando lo que falta es una parte grande de la silueta
 * (`minFraccion`..`maxFraccion` del área de la máscara): una máscara sana con
 * algún píxel de sombra en una concavidad no se toca. Modifica `mascara` en
 * el lugar y devuelve la cantidad de píxeles sumados (0 si no hizo nada).
 */
export function completarHuecos(
  rgb: Uint8Array | Buffer,
  mascara: Float32Array,
  w: number,
  h: number,
  opciones: { distanciaMin?: number; minFraccion?: number; maxFraccion?: number } = {},
): number {
  const distanciaMin = opciones.distanciaMin ?? 22;
  const minFraccion = opciones.minFraccion ?? 0.06;
  const maxFraccion = opciones.maxFraccion ?? 0.6;
  const n = w * h;

  const fondo = colorFondoLiso(rgb, w, h);
  if (!fondo) return 0;
  const distFondo = (i: number) => Math.hypot(rgb[i * 3] - fondo[0], rgb[i * 3 + 1] - fondo[1], rgb[i * 3 + 2] - fondo[2]);

  // Extensión del producto = máscara + píxeles MUY distintos del fondo (oscuros
  // o saturados) conectados a ella: una pantalla oscura, un estampado, nunca
  // una sombra suave. Sin esto el casco quedaba corto cuando el modelo perdía
  // casi todo un costado del producto.
  const extension = new Uint8Array(n);
  let nMask = 0;
  {
    const cola0 = new Int32Array(n);
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) if (mascara[i] >= 0.5) { extension[i] = 1; nMask++; cola0[b++] = i; }
    while (a < b) {
      const i = cola0[a++];
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if ((dx === 0 && dy === 0) || xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (!extension[j] && distFondo(j) > 140) { extension[j] = 1; cola0[b++] = j; }
        }
      }
    }
  }

  // Casco convexo de esa extensión: solo los extremos de cada fila alcanzan.
  const puntos: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) {
    let izq = -1, der = -1;
    for (let x = 0; x < w; x++) {
      if (extension[y * w + x]) { if (izq < 0) izq = x; der = x; }
    }
    if (izq >= 0) { puntos.push([izq, y]); if (der !== izq) puntos.push([der, y]); }
  }
  if (nMask === 0 || puntos.length < 3) return 0;
  const casco = cascoConvexo(puntos);
  const dentro = new Uint8Array(n);
  const ys = casco.map((p) => p[1]);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  for (let y = yMin; y <= yMax; y++) {
    let xMin = Infinity, xMax = -Infinity;
    for (let k = 0; k < casco.length; k++) {
      const [x1, y1] = casco[k], [x2, y2] = casco[(k + 1) % casco.length];
      if ((y1 <= y && y <= y2) || (y2 <= y && y <= y1)) {
        if (y1 === y2) { xMin = Math.min(xMin, x1, x2); xMax = Math.max(xMax, x1, x2); }
        else { const x = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1); xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); }
      }
    }
    for (let x = Math.max(0, Math.ceil(xMin)); x <= Math.min(w - 1, Math.floor(xMax)); x++) dentro[y * w + x] = 1;
  }

  const cand = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (mascara[i] < 0.5 && dentro[i] && distFondo(i) > distanciaMin) cand[i] = 1;

  // Solo lo conectado (8 vecinos) a la máscara.
  const visto = new Uint8Array(n);
  const cola = new Int32Array(n);
  let ini = 0, fin = 0, agregados = 0;
  for (let i = 0; i < n; i++) if (mascara[i] >= 0.5) cola[fin++] = i;
  while (ini < fin) {
    const i = cola[ini++];
    const x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if ((dx === 0 && dy === 0) || xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (cand[j] && !visto[j]) { visto[j] = 1; agregados++; cola[fin++] = j; }
      }
    }
  }
  const fraccion = agregados / nMask;
  if (fraccion < minFraccion || fraccion > maxFraccion) return 0;
  for (let i = 0; i < n; i++) if (visto[i]) mascara[i] = 1;
  // Zonas a medias (0.15-1) dentro del casco con color de producto: el modelo
  // dudó ahí, pero pasan el umbral y la erosión/desenfoque de después las
  // vuelve semitransparentes. Se llevan a opacas.
  for (let i = 0; i < n; i++) if (dentro[i] && mascara[i] >= 0.15 && mascara[i] < 1 && distFondo(i) > distanciaMin) mascara[i] = 1;

  // Huecos CHICOS rodeados por completo por el producto (un brillo casi blanco
  // dentro de la pantalla, que por color es indistinguible del fondo): se
  // rellenan. Uno grande (el aro de un bolso, el espacio entre dos partes)
  // queda como fondo.
  const afuera = new Uint8Array(n);
  let a = 0, b = 0;
  const semilla = (x: number, y: number) => { const i = y * w + x; if (mascara[i] < 0.5 && !afuera[i]) { afuera[i] = 1; cola[b++] = i; } };
  for (let x = 0; x < w; x++) { semilla(x, 0); semilla(x, h - 1); }
  for (let y = 0; y < h; y++) { semilla(0, y); semilla(w - 1, y); }
  while (a < b) {
    const i = cola[a++];
    const x = i % w, y = (i - x) / w;
    if (x > 0) semilla(x - 1, y);
    if (x < w - 1) semilla(x + 1, y);
    if (y > 0) semilla(x, y - 1);
    if (y < h - 1) semilla(x, y + 1);
  }
  const maxHueco = Math.round(nMask * 0.01);
  const marca = new Uint8Array(n);
  let rellenados = 0;
  for (let i0 = 0; i0 < n; i0++) {
    if (mascara[i0] >= 0.5 || afuera[i0] || marca[i0]) continue;
    const comp: number[] = [i0];
    marca[i0] = 1;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k];
      const x = i % w, y = (i - x) / w;
      const vecinos = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of vecinos) if (j >= 0 && mascara[j] < 0.5 && !afuera[j] && !marca[j]) { marca[j] = 1; comp.push(j); }
    }
    if (comp.length <= maxHueco) { for (const i of comp) mascara[i] = 1; rellenados += comp.length; }
  }

  // Líneas finas de brillo (1-2 px) dentro del producto: no encierran nada, así
  // que el relleno de arriba no las ve, y la erosión de borde las ensancha
  // hasta ~15 px. Un cierre morfológico chico las tapa.
  const radioCierre = Math.max(2, Math.round(Math.min(w, h) * 0.004));
  const bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = mascara[i] >= 0.5 ? 1 : 0;
  const dil = dilatar(bin, w, h, radioCierre);
  const inv = new Uint8Array(n);
  for (let i = 0; i < n; i++) inv[i] = dil[i] ? 0 : 1;
  const invDil = dilatar(inv, w, h, radioCierre);
  let cerrados = 0;
  for (let i = 0; i < n; i++) if (!bin[i] && !invDil[i]) { mascara[i] = 1; cerrados++; }
  return agregados + rellenados + cerrados;
}

/** Color de fondo si el borde de la foto es parejo (fondo liso), si no null. */
function colorFondoLiso(rgb: Uint8Array | Buffer, w: number, h: number): [number, number, number] | null {
  let r = 0, g = 0, b = 0, nb = 0;
  const lado = (x: number, y: number) => { const i = (y * w + x) * 3; r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; nb++; };
  for (let x = 0; x < w; x++) { lado(x, 0); lado(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { lado(0, y); lado(w - 1, y); }
  r /= nb; g /= nb; b /= nb;
  let parejos = 0;
  const cerca = (x: number, y: number) => { const i = (y * w + x) * 3; if (Math.hypot(rgb[i] - r, rgb[i + 1] - g, rgb[i + 2] - b) < 30) parejos++; };
  for (let x = 0; x < w; x++) { cerca(x, 0); cerca(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { cerca(0, y); cerca(w - 1, y); }
  return parejos / nb >= 0.9 ? [r, g, b] : null;
}

/** Casco convexo (cadena monótona de Andrew). */
function cascoConvexo(pts: Array<[number, number]>): Array<[number, number]> {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inf: Array<[number, number]> = [];
  for (const q of p) { while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], q) <= 0) inf.pop(); inf.push(q); }
  const sup: Array<[number, number]> = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], q) <= 0) sup.pop(); sup.push(q); }
  inf.pop(); sup.pop();
  return inf.concat(sup);
}
