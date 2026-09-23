import { boxFilter, endurecer, guidedFilter } from '../../src/background-removal/mask-refine';

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
});
