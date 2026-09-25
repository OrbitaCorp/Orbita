import sharp from 'sharp';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';

/**
 * ¿La imagen YA es un recorte (PNG/WebP con el fondo transparente)? Se mira el
 * canal alfa en una copia chica: si hay una parte transparente de verdad Y una
 * parte opaca de verdad, el vendedor ya sacó el fondo y volver a pasarla por el
 * modelo solo puede empeorarla — un recorte pegado a los bordes, sin margen,
 * es justo lo que el modelo de 320 px resuelve peor (confirmado con un iPhone,
 * 24/09/2026). Una imagen sin alfa, o con un alfa parejo (todo opaco, o una
 * marca de agua semitransparente), no cuenta.
 */
export async function yaEsRecorteConAlfa(buffer: Buffer): Promise<boolean> {
  const meta = await sharp(buffer, ENTRADA_IMAGEN).metadata();
  if (!meta.hasAlpha) return false;
  const { data: alfa, info } = await sharp(buffer, ENTRADA_IMAGEN)
    .ensureAlpha()
    .extractChannel(3)
    .resize(256, 256, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparentes = 0, opacos = 0;
  for (let i = 0; i < alfa.length; i++) {
    if (alfa[i] < 16) transparentes++;
    else if (alfa[i] > 240) opacos++;
  }
  if (opacos / alfa.length < 0.05) return false;
  if (transparentes / alfa.length >= 0.02) return true;
  // Un recorte muy ajustado (el objeto llena el cuadro) casi no tiene píxeles
  // transparentes, salvo las esquinas: si al menos dos esquinas lo son, el
  // fondo ya se sacó.
  const { width: w, height: h } = info;
  const esquinaTransparente = (x0: number, y0: number) => {
    let suma = 0;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) suma += alfa[(y0 + dy) * w + x0 + dx];
    return suma / 9 < 16;
  };
  const esquinas = [esquinaTransparente(0, 0), esquinaTransparente(w - 3, 0), esquinaTransparente(0, h - 3), esquinaTransparente(w - 3, h - 3)];
  return esquinas.filter(Boolean).length >= 2;
}
