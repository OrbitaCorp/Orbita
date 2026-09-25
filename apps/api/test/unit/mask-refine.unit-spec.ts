import {
  recuperarFinos,
  completarHuecos, analizarSenales, boxFilter, endurecer, guidedFilter } from '../../src/background-removal/mask-refine';

// Fase 3 de "Fondo con IA": refinamiento de la máscara de recorte (bordes
// pixelados al agrandar la máscara de 320x320 de U2Netp).
describe('mask-refine', () => {
  it('boxFilter: una imagen constante queda constante (incluidos los bordes)', () => {
    const src = new Float32Array(6 * 5).fill(0.4);
    const out = boxFilter(src, 6, 5, 2);
    for (const v of out) expect(v).toBeCloseTo(0.4, 5);
  });

  it('guidedFilter: el borde de la máscara pasa a seguir el borde de la guía, no el suyo', () => {
    const w = 40;
    const h = 8;
    const guide = new Float32Array(w * h);
    const mascara = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        guide[y * w + x] = x < 20 ? 0.1 : 0.9; // borde real en x=20
        mascara[y * w + x] = x < 16 ? 0 : 1; // máscara gruesa, con el borde corrido 4 px
      }
    }
    const out = guidedFilter(guide, mascara, w, h, 6, 1e-3);
    const fila = 4 * w;
    expect(out[fila + 6]).toBeLessThan(0.1);
    expect(out[fila + 18]).toBeLessThan(0.7); // la máscara valía 1 acá (zona corrida 16-19): el filtro la acerca al borde real
    expect(out[fila + 30]).toBeGreaterThan(0.9);
  });

  it('endurecer: 0 por debajo del rango, 1 por encima, monótona en el medio', () => {
    const m = new Float32Array([0, 0.3, 0.5, 0.7, 1]);
    endurecer(m, 0.5, 0.2);
    expect(m[0]).toBe(0);
    expect(m[1]).toBeCloseTo(0, 5);
    expect(m[2]).toBeCloseTo(0.5, 5);
    expect(m[3]).toBe(1);
    expect(m[4]).toBe(1);
  });

  describe('analizarSenales', () => {
    // Mitad izquierda = producto (máscara 255), mitad derecha = fondo (máscara 0).
    function escena(colorProducto: number[], fondo: (i: number) => number[]) {
      const n = 100;
      const rgb = new Uint8Array(n * 3);
      const mascara = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const esProducto = i < n / 2;
        const c = esProducto ? colorProducto : fondo(i);
        rgb.set(c, i * 3);
        mascara[i] = esProducto ? 255 : 0;
      }
      return analizarSenales(rgb, mascara);
    }

    it('producto oscuro sobre fondo blanco liso: colores lejanos y fondo sin textura', () => {
      const s = escena([10, 10, 10], () => [255, 255, 255]);
      expect(s.distanciaColor).toBeGreaterThan(300);
      expect(s.texturaFondo).toBeLessThan(1);
    });

    it('producto beige sobre fondo beige con textura: colores parecidos y fondo texturado', () => {
      const s = escena([180, 160, 130], (i) => (i % 2 ? [200, 180, 150] : [150, 130, 100]));
      expect(s.distanciaColor).toBeLessThan(60);
      expect(s.texturaFondo).toBeGreaterThan(12);
    });

    it('sin producto o sin fondo detectado: distancia máxima, sin textura (no marca dificil)', () => {
      const s = analizarSenales(new Uint8Array(30), new Uint8Array(10));
      expect(s.distanciaColor).toBe(441);
    });
  });
});

describe('recuperarFinos', () => {
  const W = 120, H = 60;
  const escena = (fondo: number) => {
    const rgb = Buffer.alloc(W * H * 3, fondo);
    const pintar = (x: number, y: number) => { const i = (y * W + x) * 3; rgb[i] = rgb[i + 1] = rgb[i + 2] = 0; };
    // producto: cuadrado a la izquierda + brazo fino de 2 px que sale hacia la derecha
    for (let y = 20; y < 40; y++) for (let x = 10; x < 40; x++) pintar(x, y);
    for (let x = 40; x < 100; x++) { pintar(x, 30); pintar(x, 31); }
    const mask = new Float32Array(W * H);
    for (let y = 20; y < 40; y++) for (let x = 10; x < 40; x++) mask[y * W + x] = 1;
    return { rgb, mask };
  };

  it('recupera un brazo fino conectado al producto sin reabrir el contorno', () => {
    const { rgb, mask } = escena(255);
    const out = recuperarFinos(rgb, mask, W, H, 4, { maxFraccion: 0.5 })!;
    expect(out).not.toBeNull();
    expect(out[30 * W + 90]).toBe(255);
    expect(out[19 * W + 25]).toBe(0);
  });

  it('con fondo que no es liso no hace nada', () => {
    const { rgb, mask } = escena(255);
    for (let x = 0; x < W; x += 2) rgb[x * 3] = 0;
    expect(recuperarFinos(rgb, mask, W, H, 4)).toBeNull();
  });
});

describe('completarHuecos', () => {
  const W = 100, H = 60;
  // Producto oscuro de 60x40 sobre blanco liso; una sombra gris clara fuera del casco.
  const escena = () => {
    const rgb = Buffer.alloc(W * H * 3, 255);
    const pintar = (x: number, y: number, v: number) => { const i = (y * W + x) * 3; rgb[i] = rgb[i + 1] = rgb[i + 2] = v; };
    for (let y = 10; y < 50; y++) for (let x = 20; x < 80; x++) pintar(x, y, 20);
    for (let x = 20; x < 80; x++) for (let y = 50; y < 54; y++) pintar(x, y, 225); // sombra suave, fuera del producto
    return { rgb, pintar };
  };

  it('rellena la parte del producto que el modelo perdió, sin sumar la sombra de afuera', () => {
    const { rgb } = escena();
    const mascara = new Float32Array(W * H);
    for (let y = 10; y < 50; y++) for (let x = 20; x < 60; x++) mascara[y * W + x] = 1; // falta el tercio derecho
    const sumados = completarHuecos(rgb, mascara, W, H);
    expect(sumados).toBeGreaterThan(0);
    expect(mascara[30 * W + 70]).toBe(1); // parte derecha recuperada
    expect(mascara[51 * W + 50]).toBe(0); // la sombra no
  });

  it('lleva a opaco una zona a medias con color de producto', () => {
    const { rgb } = escena();
    const mascara = new Float32Array(W * H);
    for (let y = 10; y < 50; y++) for (let x = 20; x < 60; x++) mascara[y * W + x] = 1;
    mascara[30 * W + 30] = 0.6; // el modelo dudó ahí
    completarHuecos(rgb, mascara, W, H);
    expect(mascara[30 * W + 30]).toBe(1);
  });

  it('una máscara completa no se toca', () => {
    const { rgb } = escena();
    const mascara = new Float32Array(W * H);
    for (let y = 10; y < 50; y++) for (let x = 20; x < 80; x++) mascara[y * W + x] = 1;
    const antes = Float32Array.from(mascara);
    expect(completarHuecos(rgb, mascara, W, H)).toBe(0);
    expect(Array.from(mascara)).toEqual(Array.from(antes));
  });

  it('con fondo que no es liso no hace nada', () => {
    const { rgb } = escena();
    for (let x = 0; x < W; x += 2) rgb[x * 3] = 0;
    const mascara = new Float32Array(W * H);
    for (let y = 10; y < 50; y++) for (let x = 20; x < 60; x++) mascara[y * W + x] = 1;
    expect(completarHuecos(rgb, mascara, W, H)).toBe(0);
  });
});
