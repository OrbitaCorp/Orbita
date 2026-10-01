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
// si el rectángulo que queda tiene un borde que es claramente OTRA cosa que el
// color del marco (una foto), no más blanco o prenda.

const LADO_ANALISIS = 400;
// Distancia RGB máxima entre las 4 esquinas para considerar que hay un color de marco.
const TOLERANCIA_ESQUINAS = 25;
// Distancia RGB al color del marco para contar un píxel como "marco".
const TOLERANCIA_MARCO = 30;
// Una fila/columna es marco si al menos esta fracción de sus píxeles lo es.
const FRACCION_FILA_MARCO = 0.99;
// Del borde recortado, qué fracción tiene que NO ser color de marco.
const FRACCION_BORDE_FOTO = 0.85;
// Mínimo de margen (fracción del lado) en algún costado para que valga la pena recortar.
const MARGEN_MINIMO = 0.02;
// Mínimo del área original que tiene que quedar.
const AREA_MINIMA = 0.35;

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

  // El borde del rectángulo interior tiene que ser una foto, no más color de marco.
  let total = 0;
  let foto = 0;
  const visitar = (x: number, y: number) => {
    total++;
    if (!esMarco(x, y)) foto++;
  };
  for (let x = rect.left; x < rect.left + rect.width; x++) {
    visitar(x, rect.top);
    visitar(x, rect.top + rect.height - 1);
  }
  for (let y = rect.top + 1; y < rect.top + rect.height - 1; y++) {
    visitar(rect.left, y);
    visitar(rect.left + rect.width - 1, y);
  }
  if (foto / total < FRACCION_BORDE_FOTO) return null;
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
    const inset = Math.max(2, Math.round(Math.max(w, h) * 0.01));
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
