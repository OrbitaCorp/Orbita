import sharp from 'sharp';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';

// Algunas fotos de catálogo vienen "enmarcadas": un borde liso (blanco casi
// siempre) alrededor de la foto real, con una foto de fondo adentro (la remera
// sobre cemento, con marco blanco). Ese marco confunde a los modelos de recorte:
// el blanco del marco se parece al blanco de la prenda y el modelo deja pegado
// un pedazo grande del fondo (confirmado a mano el 01/10/2026 con U2Netp). Se
// quita el marco ANTES de correr el modelo.
//
// Conservador a propósito: una remera blanca sobre fondo blanco liso NO tiene
// marco, y recortar "lo blanco" se comería la prenda. Por eso solo se recorta
// si el rectángulo que queda tiene un borde que NO es la continuación plana del
// marco: es una foto (con textura o con otro color).
//
// El marco se distingue por PLANITUD, no por color (corregido el 01/10/2026): el
// normalizador del navegador (imageStandardizer.ts) toma una alfombra marrón por
// "fondo uniforme" y pega la foto sobre un lienzo del marrón PROMEDIO. La foto
// de adentro es del mismo marrón que el marco, solo que con textura. Con una
// tolerancia de color holgada no se veía la diferencia, el marco liso quedaba, y
// el relleno de huecos (completarHuecos, que asume un fondo liso) metía la
// alfombra dentro del producto.

const LADO_ANALISIS = 400;
// Distancia RGB máxima entre las 4 esquinas para considerar que hay un color de marco.
const TOLERANCIA_ESQUINAS = 25;
// Distancia RGB al color del marco para contar un píxel como "marco plano". Chica a
// propósito: ruido de JPEG sí, textura de una alfombra no.
const TOLERANCIA_MARCO = 6;
// Una fila/columna es marco si al menos esta fracción de sus píxeles lo es.
const FRACCION_FILA_MARCO = 0.99;
// Del borde recortado, hasta qué fracción puede ser plana (color de marco) y aun así
// considerarse un marco: por encima, es el mismo fondo que sigue adentro.
const MAX_FRACCION_BORDE_PLANA = 0.6;
// Mínimo de margen (fracción del lado) en algún costado para que valga la pena recortar.
const MARGEN_MINIMO = 0.02;
// Mínimo del área original que tiene que quedar.
const AREA_MINIMA = 0.35;

/** Cuánto se mete el recorte hacia adentro del marco (px de la imagen analizada): el borde está antialiasado/comprimido y arrastra una mezcla. */
export function insetMarco(w: number, h: number): number {
  return Math.max(2, Math.round(Math.max(w, h) * 0.01));
}

export interface RectanguloMarco {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Detecta el marco liso de una imagen RGB cruda (3 canales) y devuelve el
 * rectángulo interior en coordenadas de esa imagen, o null si no hay marco
 * (o no se está seguro de que lo sea).
 */
export function detectarMarco(rgb: Uint8Array | Buffer, w: number, h: number): RectanguloMarco | null {
  if (w < 16 || h < 16) return null;
  const px = (x: number, y: number) => (y * w + x) * 3;

  // Color del marco: promedio de las 4 esquinas, que tienen que coincidir.
  const esquinas = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
  const marco = [0, 1, 2].map((c) => esquinas.reduce((s, i) => s + rgb[i + c], 0) / 4);
  const dist = (i: number) => Math.hypot(rgb[i] - marco[0], rgb[i + 1] - marco[1], rgb[i + 2] - marco[2]);
  for (const i of esquinas) if (dist(i) > TOLERANCIA_ESQUINAS) return null;

  const esMarco = (x: number, y: number) => dist(px(x, y)) <= TOLERANCIA_MARCO;
  const filaMarco = (y: number) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (esMarco(x, y)) n++;
    return n / w >= FRACCION_FILA_MARCO;
  };
  const colMarco = (x: number) => {
    let n = 0;
    for (let y = 0; y < h; y++) if (esMarco(x, y)) n++;
    return n / h >= FRACCION_FILA_MARCO;
  };

  let top = 0;
  while (top < h && filaMarco(top)) top++;
  let bottom = h - 1;
  while (bottom > top && filaMarco(bottom)) bottom--;
  let left = 0;
  while (left < w && colMarco(left)) left++;
  let right = w - 1;
  while (right > left && colMarco(right)) right--;
  if (top >= bottom || left >= right) return null;

  const rect = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const hayMargen = left >= w * MARGEN_MINIMO || top >= h * MARGEN_MINIMO || w - 1 - right >= w * MARGEN_MINIMO || h - 1 - bottom >= h * MARGEN_MINIMO;
  if (!hayMargen) return null;
  if ((rect.width * rect.height) / (w * h) < AREA_MINIMA) return null;

  // El borde del rectángulo interior no puede ser la continuación plana del marco.
  // Se mide unos píxeles HACIA ADENTRO (lo mismo que se va a recortar después): la
  // fila/columna justo en el límite es una mezcla marco/foto por la compresión.
  const k = insetMarco(w, h);
  const iL = rect.left + k;
  const iT = rect.top + k;
  const iR = rect.left + rect.width - 1 - k;
  const iB = rect.top + rect.height - 1 - k;
  if (iR - iL < 8 || iB - iT < 8) return null;
  let total = 0;
  let planos = 0;
  const visitar = (x: number, y: number) => {
    total++;
    if (esMarco(x, y)) planos++;
  };
  for (let x = iL; x <= iR; x++) {
    visitar(x, iT);
    visitar(x, iB);
  }
  for (let y = iT + 1; y < iB; y++) {
    visitar(iL, y);
    visitar(iR, y);
  }
  if (planos / total >= MAX_FRACCION_BORDE_PLANA) return null;
  return rect;
}

/**
 * Quita el marco liso de la foto, si lo tiene. Devuelve el mismo buffer si no
 * hay marco, si la imagen ya trae transparencia, o ante cualquier duda.
 */
export async function quitarMarco(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer, ENTRADA_IMAGEN).metadata();
    const W = meta.width;
    const H = meta.height;
    if (!W || !H || meta.hasAlpha) return buffer;

    const escala = Math.min(1, LADO_ANALISIS / Math.max(W, H));
    const w = Math.max(1, Math.round(W * escala));
    const h = Math.max(1, Math.round(H * escala));
    const rgb = await sharp(buffer, ENTRADA_IMAGEN).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();

    const rect = detectarMarco(rgb, w, h);
    if (!rect) return buffer;

    // Se mete un poco hacia adentro: el borde del marco está antialiasado y
    // arrastra una línea clara.
    const inset = insetMarco(w, h);
    const sx = W / w;
    const sy = H / h;
    const left = Math.round((rect.left + inset) * sx);
    const top = Math.round((rect.top + inset) * sy);
    const width = Math.round((rect.width - 2 * inset) * sx);
    const height = Math.round((rect.height - 2 * inset) * sy);
    if (width < 16 || height < 16 || left + width > W || top + height > H) return buffer;

    return await sharp(buffer, ENTRADA_IMAGEN).extract({ left, top, width, height }).toBuffer();
  } catch {
    return buffer;
  }
}
