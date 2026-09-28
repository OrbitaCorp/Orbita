import { ProductsService } from '../../src/products/products.service';

// Valor de inventario del encabezado del listado: costo cargado × unidades en
// stock, solo de los productos con costo. Sin precio de venta de por medio.
const stock = (...cantidades: number[]) => ({ stock: cantidades.map((quantity) => ({ quantity })) });

function svcCon(products: unknown[]) {
  const prisma = { product: { findMany: jest.fn().mockResolvedValue(products) } };
  return new ProductsService(prisma as never, {} as never, {} as never);
}

describe('ProductsService.stats — valor de inventario', () => {
  it('suma costo × stock de todas las variantes y sucursales del producto', async () => {
    const r = await svcCon([
      { status: 'PUBLISHED', cost: 100, variants: [stock(3, 2), stock(5)] }, // 10 u × 100
      { status: 'PUBLISHED', cost: 50.5, variants: [stock(4)] },            // 4 u × 50,5
    ]).stats('biz');
    expect(r.valorInventario).toBe(1202);
    expect(r.sinCostoCargado).toBe(0);
  });

  it('un producto sin costo no se suma (no cae al precio) y se cuenta aparte', async () => {
    const r = await svcCon([
      { status: 'PUBLISHED', cost: 100, variants: [stock(2)] },
      { status: 'PUBLISHED', cost: null, variants: [stock(10)] },
    ]).stats('biz');
    expect(r.valorInventario).toBe(200);
    expect(r.sinCostoCargado).toBe(1);
  });

  it('un producto con costo pero sin stock aporta 0 y no cuenta como "sin costo"', async () => {
    const r = await svcCon([
      { status: 'PUBLISHED', cost: 100, variants: [stock(0)] },
      { status: 'DRAFT', cost: null, variants: [stock(0)] },
    ]).stats('biz');
    expect(r.valorInventario).toBe(0);
    expect(r.sinCostoCargado).toBe(0);
    expect(r.sinStock).toBe(2);
  });

  it('stock negativo (sobreventa) no resta valor', async () => {
    const r = await svcCon([{ status: 'PUBLISHED', cost: 100, variants: [stock(-3)] }]).stats('biz');
    expect(r.valorInventario).toBe(0);
  });
});
