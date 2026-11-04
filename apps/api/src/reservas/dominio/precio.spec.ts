import { extrasElegidos, precioTotal, redondear, sena } from './precio';

describe('reservas · precio', () => {
  it('redondea al peso y no deja la coma flotante en el ticket', () => {
    expect(redondear(45_000 * 1.15)).toBe(51_750);
    expect(precioTotal(12_499.5, 1)).toBe(12_500);
  });

  it('multiplica la base por las unidades y suma los extras', () => {
    expect(precioTotal(8000, 2)).toBe(16_000);
    expect(precioTotal(8000, 2, [{ id: 'pelotas', nombre: 'Pelotas', precio: 1500 }])).toBe(17_500);
    expect(precioTotal(8000, 0)).toBe(8000); // nunca menos de una unidad
    expect(precioTotal(-5, 1)).toBe(0);
  });

  it('la seña es un porcentaje del total, al peso; 0 % es sin seña', () => {
    expect(sena(10_000, 30)).toBe(3000);
    expect(sena(10_001, 50)).toBe(5001);
    expect(sena(10_000, 0)).toBe(0);
    expect(sena(0, 50)).toBe(0);
    expect(sena(100, 150)).toBe(100); // nunca más del total
  });

  it('los extras salen del catálogo del recurso, nunca del pedido', () => {
    const catalogo = [{ id: 'a', nombre: 'Asador', precio: 2000 }, { id: 'b', nombre: 'Vajilla', precio: 1000 }, { id: 'roto', precio: 'gratis' }];
    expect(extrasElegidos(catalogo, ['b', 'a', 'b', 'inventado', 'roto'])).toEqual([
      { id: 'b', nombre: 'Vajilla', precio: 1000 },
      { id: 'a', nombre: 'Asador', precio: 2000 },
    ]);
    expect(extrasElegidos(undefined, ['a'])).toEqual([]);
    expect(extrasElegidos(catalogo, undefined)).toEqual([]);
  });
});
