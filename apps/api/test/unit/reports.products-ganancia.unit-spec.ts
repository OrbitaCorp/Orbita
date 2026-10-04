import { ReportsService } from '../../src/reports/reports.service';

// Reporte de productos: ganancia estimada de lo vendido (ingresos − costo) y
// ganancia potencial del stock. Números hechos a mano.
//
// Remera (costo 40): vendió 3 u. a $100 con $30 de descuento → ingreso 270,
//   costo 3 × 40 = 120 → ganancia 150.
// Gorra (sin costo cargado): vendió 2 u. a $50 → ingreso 100, SIN ganancia
//   calculable (no se supone costo cero).

const variante = (productId: string, cost: number | null) => ({ variantId: `v-${productId}`, variant: { productId, product: { cost } } });
const venta = (productId: string, cost: number | null, quantity: number, unitPrice: number, discountAmount = 0) => ({
  ...variante(productId, cost), quantity, unitPrice, discountAmount,
});

function svcCon() {
  const productos = [
    { id: 'p-remera', name: 'Remera', cost: 40, basePrice: 100, status: 'PUBLISHED', category: { id: 'c1', name: 'Ropa' }, images: [], variants: [{ id: 'v-p-remera', sku: null, price: 100, stock: [{ quantity: 5, stockMin: 0 }], optionValues: [] }] },
    { id: 'p-gorra', name: 'Gorra', cost: null, basePrice: 50, status: 'PUBLISHED', category: { id: 'c2', name: 'Accesorios' }, images: [], variants: [{ id: 'v-p-gorra', sku: null, price: 50, stock: [{ quantity: 4, stockMin: 0 }], optionValues: [] }] },
  ];
  const prisma = {
    orderItem: {
      groupBy: jest.fn().mockResolvedValue([{ variantId: 'v-p-remera' }, { variantId: 'v-p-gorra' }]),
      findMany: jest.fn().mockResolvedValue([venta('p-remera', 40, 3, 100, 30), venta('p-gorra', null, 2, 50)]),
    },
    product: { findMany: jest.fn().mockResolvedValue(productos) },
  };
  return new ReportsService(prisma as never);
}

describe('ReportsService.products — ganancia estimada', () => {
  it('ganancia vendida = ingresos − costo, solo de los productos con costo cargado', async () => {
    const r = await svcCon().products('biz');
    expect(r.resumen.gananciaVendida).toBe(150);
    expect(r.resumen.margenVendidoPct).toBe(55.6); // 150 / 270
  });

  it('lo vendido de productos sin costo queda aparte (importeSinCosto) y no se supone costo cero', async () => {
    const r = await svcCon().products('biz');
    expect(r.resumen.importeSinCosto).toBe(100);
    expect(r.resumen.importeVendido).toBe(370);
    const gorra = r.masVendidos.find((p) => p.id === 'p-gorra');
    expect(gorra?.ganancia).toBeNull();
    expect(r.masVendidos.find((p) => p.id === 'p-remera')?.ganancia).toBe(150);
  });

  it('ganancia del inventario = (precio − costo) × stock de los productos con costo, y avisa cuántos faltan', async () => {
    const r = await svcCon().products('biz');
    expect(r.resumen.gananciaInventario).toBe(300); // (100 − 40) × 5
    expect(r.resumen.margenInventarioPct).toBe(60);
    expect(r.resumen.productosSinCosto).toBe(1); // la gorra, con 4 u. en stock
  });
});
