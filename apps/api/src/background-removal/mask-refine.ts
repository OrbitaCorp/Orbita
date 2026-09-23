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
