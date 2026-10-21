import { Prisma } from '@prisma/client';
import { renglonesNetosDe } from './reports.service';

const costo = (n: number | null) => (n === null ? null : new Prisma.Decimal(n));
const item = (quantity: number, unitPrice: number, cost: number | null, isConcept = false) => ({
  quantity,
  unitPrice: new Prisma.Decimal(unitPrice),
  isConcept,
  variant: { product: { cost: costo(cost) } },
});

// Base de la tarjeta "Ganancias" del Inicio (kpisDe en reports.service.ts).
describe('renglonesNetosDe', () => {
  it('ingreso neto = cantidad × precio, y costo = cantidad × costo del producto', () => {
    const [r] = renglonesNetosDe({ discountTotal: 0, items: [item(2, 1000, 600)] });
    expect(r.neto).toBe(2000);
    expect(r.costo).toBe(1200);
  });

  it('reparte el descuento del pedido en proporción al precio de cada ítem', () => {
    const rs = renglonesNetosDe({ discountTotal: 300, items: [item(1, 1000, 500), item(1, 2000, 500)] });
    expect(rs.map((r) => Math.round(r.neto))).toEqual([900, 1800]);
  });

  it('un producto sin costo cargado queda con costo null (no se cuenta como costo cero)', () => {
    const [r] = renglonesNetosDe({ discountTotal: 0, items: [item(1, 500, null)] });
    expect(r.costo).toBeNull();
  });

  it('los ítems libres (isConcept) no son renglones de producto', () => {
    expect(renglonesNetosDe({ discountTotal: 0, items: [item(1, 500, null, true)] })).toEqual([]);
  });
});
