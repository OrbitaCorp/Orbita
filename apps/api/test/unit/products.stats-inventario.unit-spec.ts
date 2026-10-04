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

describe('ProductsService.stats — ganancia estimada', () => {
  const conPrecio = (price: number, ...cantidades: number[]) => ({ price, ...stock(...cantidades) });

  it('suma (precio − costo) × stock de los productos con costo y devuelve el margen', async () => {
    const r = await svcCon([
      { status: 'PUBLISHED', cost: 100, variants: [conPrecio(150, 4)] }, // +50 × 4 = 200
      { status: 'PUBLISHED', cost: 40, variants: [conPrecio(100, 1)] }, // +60
    ]).stats('biz');
    expect(r.gananciaEstimada).toBe(260);
    expect(r.margenEstimadoPct).toBe(37.1); // 260 / 700
  });

  it('un producto sin costo no entra en la ganancia y se avisa en sinCostoCargado', async () => {
    const r = await svcCon([
      { status: 'PUBLISHED', cost: 100, variants: [conPrecio(150, 2)] },
      { status: 'PUBLISHED', cost: null, variants: [conPrecio(500, 9)] },
    ]).stats('biz');
    expect(r.gananciaEstimada).toBe(100);
    expect(r.sinCostoCargado).toBe(1);
  });
});
