import { valorizarInventario } from '../../src/common/utils/inventario';

// Valorización del inventario: la comparten las métricas de Productos y el
// dashboard avanzado. Estas reglas son las que definen "ganancia estimada".
const variante = (price: number | null | undefined, ...stock: number[]) => ({ price, stock: stock.map((quantity) => ({ quantity })) });

describe('valorizarInventario', () => {
  it('ganancia potencial = (precio − costo) × unidades, con el precio de cada variante', () => {
    const r = valorizarInventario([
      // costo 100: variante A 3 u. a 150, variante B 2 u. (en dos sucursales) a 200
      { cost: 100, variants: [variante(150, 3), variante(200, 1, 1)] },
    ]);
    expect(r.valorCosto).toBe(500); // 5 u × 100
    expect(r.valorVenta).toBe(850); // 3×150 + 2×200
    expect(r.gananciaPotencial).toBe(350);
    expect(r.margenPct).toBe(41.2); // 350 / 850
    expect(r.sinCosto).toBe(0);
  });

  it('un producto con stock pero sin costo queda afuera y se cuenta aparte (no se estima con el precio)', () => {
    const r = valorizarInventario([
      { cost: 100, variants: [variante(150, 2)] },
      { cost: null, variants: [variante(999, 10)] },
    ]);
    expect(r.valorCosto).toBe(200);
    expect(r.gananciaPotencial).toBe(100);
    expect(r.sinCosto).toBe(1);
  });

  it('sin stock no aporta ni cuenta como "sin costo"', () => {
    const r = valorizarInventario([{ cost: null, variants: [variante(150, 0)] }]);
    expect(r).toMatchObject({ valorCosto: 0, valorVenta: 0, gananciaPotencial: 0, margenPct: null, sinCosto: 0 });
  });

  it('el stock negativo (sobreventa) cuenta como cero, variante por variante', () => {
    const r = valorizarInventario([{ cost: 100, variants: [variante(150, 4), variante(150, -3)] }]);
    expect(r.valorCosto).toBe(400);
    expect(r.gananciaPotencial).toBe(200);
  });

  it('un costo mayor al precio da ganancia negativa: no se esconde', () => {
    const r = valorizarInventario([{ cost: 200, variants: [variante(150, 2)] }]);
    expect(r.gananciaPotencial).toBe(-100);
  });

  it('tolera una variante sin precio sin romper en NaN', () => {
    const r = valorizarInventario([{ cost: 100, variants: [variante(undefined, 2)] }]);
    expect(Number.isNaN(r.gananciaPotencial)).toBe(false);
  });
});
