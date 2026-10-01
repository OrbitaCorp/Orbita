import sharp from 'sharp';
import { detectarMarco, quitarMarco } from '../../src/background-removal/quitar-marco';

// Imágenes sintéticas RGB crudas: `pintar` decide el color de cada píxel.
function rgbDe(w: number, h: number, pintar: (x: number, y: number) => [number, number, number]): Buffer {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) buf.set(pintar(x, y), (y * w + x) * 3);
  }
  return buf;
}

const BLANCO: [number, number, number] = [255, 255, 255];
const CEMENTO = (x: number, y: number): [number, number, number] => {
  const v = 120 + ((x * 7 + y * 13) % 30); // textura gris, nunca cerca del blanco
  return [v, v, v];
};

describe('quitar-marco — fotos enmarcadas', () => {
  it('foto de cemento con marco blanco: devuelve el rectángulo interior', () => {
    const w = 120;
    const h = 100;
    const rgb = rgbDe(w, h, (x, y) => (x >= 20 && x < 100 && y >= 10 && y < 90 ? CEMENTO(x, y) : BLANCO));
    expect(detectarMarco(rgb, w, h)).toEqual({ left: 20, top: 10, width: 80, height: 80 });
  });

  it('el marco puede ser de cualquier color liso, no solo blanco', () => {
    const w = 120;
    const h = 100;
    const rgb = rgbDe(w, h, (x, y) => (x >= 20 && x < 100 && y >= 10 && y < 90 ? CEMENTO(x, y) : [10, 10, 10]));
    expect(detectarMarco(rgb, w, h)).not.toBeNull();
  });

  it('remera blanca sobre fondo blanco liso: NO hay marco, no se recorta nada', () => {
    const w = 120;
    const h = 100;
    // "Remera" blanca apenas más gris que el fondo, apoyada en el centro.
    const rgb = rgbDe(w, h, (x, y) => (x >= 30 && x < 90 && y >= 20 && y < 80 ? [240, 240, 240] : BLANCO));
    expect(detectarMarco(rgb, w, h)).toBeNull();
  });

  it('producto con estampa oscura sobre fondo blanco liso: no se confunde con un marco', () => {
    const w = 120;
    const h = 100;
    const rgb = rgbDe(w, h, (x, y) => {
      if (x >= 30 && x < 90 && y >= 20 && y < 80) return x >= 50 && x < 70 && y >= 40 && y < 60 ? [20, 20, 20] : [245, 245, 245];
      return BLANCO;
    });
    expect(detectarMarco(rgb, w, h)).toBeNull();
  });

  it('foto sin margen (el fondo llega hasta el borde): no hay marco', () => {
    const rgb = rgbDe(120, 100, (x, y) => CEMENTO(x, y));
    expect(detectarMarco(rgb, 120, 100)).toBeNull();
  });

  it('si el marco comería casi toda la imagen no recorta', () => {
    const w = 120;
    const h = 100;
    const rgb = rgbDe(w, h, (x, y) => (x >= 50 && x < 70 && y >= 40 && y < 60 ? CEMENTO(x, y) : BLANCO));
    expect(detectarMarco(rgb, w, h)).toBeNull();
  });

  it('esquinas de distinto color (no hay un color de marco): no recorta', () => {
    const w = 120;
    const h = 100;
    const rgb = rgbDe(w, h, (x, y) => (x < 60 ? [255, 255, 255] : [0, 0, 0]));
    expect(detectarMarco(rgb, w, h)).toBeNull();
  });

  it('quitarMarco: recorta el marco de una imagen real y deja intacta una sin marco', async () => {
    const w = 600;
    const h = 500;
    const conMarco = await sharp(rgbDe(w, h, (x, y) => (x >= 100 && x < 500 && y >= 50 && y < 450 ? CEMENTO(x, y) : BLANCO)), { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer();
    const recortada = await sharp(await quitarMarco(conMarco)).metadata();
    expect(recortada.width).toBeLessThan(400);
    expect(recortada.width).toBeGreaterThan(340);
    expect(recortada.height).toBeLessThan(400);

    const sinMarco = await sharp(rgbDe(w, h, (x, y) => CEMENTO(x, y)), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    expect(await quitarMarco(sinMarco)).toBe(sinMarco);
  });

  it('quitarMarco: una imagen con transparencia no se toca', async () => {
    const png = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.5 } } }).png().toBuffer();
    expect(await quitarMarco(png)).toBe(png);
  });

  it('quitarMarco: un buffer que no es imagen devuelve el mismo buffer sin romper', async () => {
    const basura = Buffer.from('no soy una imagen');
    expect(await quitarMarco(basura)).toBe(basura);
  });
});
