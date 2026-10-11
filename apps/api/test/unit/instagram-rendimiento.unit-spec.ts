import { analizarRendimiento, tipoDe, type MedioDeInstagram } from '../../src/instagram/instagram-rendimiento';

// Qué le funciona mejor a la cuenta: que se calcule con los datos reales, que con pocas publicaciones no se saquen
// conclusiones, y que el momento sugerido caiga en el futuro y en un día y hora que la cuenta realmente usa.

// Lunes 12 de octubre de 2026, 12:00 en Argentina (15:00 UTC).
const AHORA = new Date('2026-10-12T15:00:00Z');

// Una publicación a las `hora` locales de Argentina del `dia` de octubre de 2026 (UTC = local + 3).
const medio = (id: string, dia: number, hora: number, likes: number, extra: Partial<MedioDeInstagram> = {}): MedioDeInstagram => ({
  id,
  media_type: 'IMAGE',
  timestamp: new Date(Date.UTC(2026, 9, dia, hora + 3, 0, 0)).toISOString(),
  like_count: likes,
  comments_count: 0,
  ...extra,
});

describe('tipoDe', () => {
  it('distingue foto, carrusel, reel y video', () => {
    expect(tipoDe({ id: '1', media_type: 'IMAGE' })).toBe('foto');
    expect(tipoDe({ id: '2', media_type: 'CAROUSEL_ALBUM' })).toBe('carrusel');
    expect(tipoDe({ id: '3', media_type: 'VIDEO', media_product_type: 'REELS' })).toBe('reel');
    expect(tipoDe({ id: '4', media_type: 'VIDEO', media_product_type: 'FEED' })).toBe('video');
  });
});

describe('analizarRendimiento', () => {
  it('con pocas publicaciones avisa que la muestra es chica y sugiere un horario general', () => {
    const r = analizarRendimiento([medio('a', 1, 19, 10), medio('b', 2, 19, 20)], AHORA);
    expect(r.suficiente).toBe(false);
    expect(r.mejoresDias).toEqual([]);
    expect(r.momentoDeLaCuenta).toBe(false);
    // 19 h de Argentina = 22 h UTC, y siempre en el futuro.
    expect(new Date(r.proximoMomento).getUTCHours()).toBe(22);
    expect(new Date(r.proximoMomento).getTime()).toBeGreaterThan(AHORA.getTime());
  });

  it('promedia me gusta + comentarios por tipo y los ordena de mejor a peor', () => {
    const medios = [
      medio('a', 1, 10, 10), medio('b', 2, 10, 20),
      medio('c', 3, 10, 100, { media_type: 'CAROUSEL_ALBUM', comments_count: 10 }),
      medio('d', 4, 10, 60, { media_type: 'CAROUSEL_ALBUM' }),
      ...Array.from({ length: 4 }, (_, i) => medio(`e${i}`, 5 + i, 10, 5)),
    ];
    const r = analizarRendimiento(medios, AHORA);
    expect(r.tipos[0]).toEqual({ tipo: 'carrusel', publicaciones: 2, promedio: 85 });
    expect(r.tipos.find((t) => t.tipo === 'foto')?.publicaciones).toBe(6);
  });

  it('con muestra suficiente encuentra el mejor día y la mejor franja, ignorando lo que pasó una sola vez', () => {
    // Cuatro martes (6, 13… en realidad 6/10/2026 es martes) a las 20 h con muchos me gusta, el resto flojo.
    const medios = [
      medio('m1', 6, 20, 100), medio('m2', 13, 20, 120), medio('m3', 20, 20, 110),
      medio('l1', 5, 9, 10), medio('l2', 12, 9, 12), medio('j1', 8, 14, 15), medio('j2', 15, 14, 20),
      medio('suerte', 2, 3, 900), // una sola publicación a las 3 de la mañana: no cuenta
    ];
    const r = analizarRendimiento(medios, AHORA);
    expect(r.suficiente).toBe(true);
    expect(r.mejoresDias[0]).toMatchObject({ clave: 2, publicaciones: 3 }); // martes
    expect(r.mejoresHoras[0]).toMatchObject({ clave: 18, publicaciones: 3 }); // ventana de 18 a 21 h
    expect(r.mejoresHoras.some((h) => h.clave === 3)).toBe(false);
    expect(r.momentoDeLaCuenta).toBe(true);
  });

  it('el momento sugerido es el próximo martes, a las 19 h de Argentina', () => {
    const medios = [
      medio('m1', 6, 20, 100), medio('m2', 13, 20, 120), medio('m3', 20, 20, 110),
      medio('l1', 5, 9, 10), medio('l2', 12, 9, 12), medio('j1', 8, 14, 15), medio('j2', 15, 14, 20), medio('x', 1, 11, 1),
    ];
    const r = analizarRendimiento(medios, AHORA);
    // AHORA es lunes 12/10: el próximo martes (el mejor día) es el 13/10 a las 19 h locales = 22 h UTC.
    expect(r.proximoMomento).toBe('2026-10-13T22:00:00.000Z');
    // Y hay un momento por cada uno de los 3 mejores días (martes, jueves y lunes), del más cercano al más lejano.
    expect(r.momentos).toEqual(['2026-10-12T22:00:00.000Z', '2026-10-13T22:00:00.000Z', '2026-10-15T22:00:00.000Z']);
  });

  it('sin publicaciones no rompe', () => {
    const r = analizarRendimiento([], AHORA);
    expect(r).toMatchObject({ muestra: 0, suficiente: false, tipos: [], publicaciones: [] });
  });
});
