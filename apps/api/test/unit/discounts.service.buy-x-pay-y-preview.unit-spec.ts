import { DiscountsService } from '../../src/discounts/discounts.service';

// Bug real de producción (2026-09-05): descuentosDeItems() arma el "precio
// de vista previa" del catálogo/detalle evaluando TODAS las filas que se
// están mostrando (todas las variantes de un producto en getProduct(), o
// todos los candidatos de una página en listProducts()) en un solo
// evaluateCart(), cada una forzada a quantity:1. Si dos de esas filas
// matcheaban la MISMA promo BUY_X_PAY_Y, el motor las contaba como si fueran
// 2 unidades de un carrito real y mostraba una de ellas YA con el descuento
// aplicado — un producto con 1 sola unidad en el carrito se veía a $0.
// descuentosDeItems() tiene que excluir BUY_X_PAY_Y (solo tiene sentido con
// cantidades reales de un carrito real); promoLabelsDeItems() (el badge
// "2x1") sigue funcionando igual — ese sí es informativo a propósito.

function discountRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'd1',
    name: '2x1',
    type: 'BUY_X_PAY_Y',
    value: 1 as unknown,
    scope: 'PRODUCT',
    productLevel: 'padre',
    minAmount: null,
    minQuantity: 2,
    priority: 0,
    activeDays: [],
    startTime: null,
    endTime: null,
    maxUsesTotal: null,
    usesConsumed: 0,
    products: [{ productId: 'p1' }],
    categories: [],
    ...overrides,
  };
}

function svcCon(rows: ReturnType<typeof discountRow>[]) {
  const prisma = { discount: { findMany: jest.fn().mockResolvedValue(rows) } } as any;
  return new DiscountsService(prisma);
}

describe('DiscountsService.descuentosDeItems — no aplica BUY_X_PAY_Y a precios de vista previa', () => {
  it('dos variantes del mismo producto (quantity:1 cada una) que matchean un 2x1: no se descuenta ninguna', async () => {
    const svc = svcCon([discountRow()]);
    const items = [
      { variantId: 'v1', productId: 'p1', categoryId: 'cat1', unitPrice: 1000 },
      { variantId: 'v2', productId: 'p1', categoryId: 'cat1', unitPrice: 800 },
    ];
    const mapa = await svc.descuentosDeItems('biz1', items);
    expect(mapa.size).toBe(0);
  });

  it('promoLabelsDeItems() sigue devolviendo el badge para las mismas filas (informativo, sin tocar precio)', async () => {
    const svc = svcCon([discountRow()]);
    const items = [
      { variantId: 'v1', productId: 'p1', categoryId: 'cat1', unitPrice: 1000 },
      { variantId: 'v2', productId: 'p1', categoryId: 'cat1', unitPrice: 800 },
    ];
    const mapa = await svc.promoLabelsDeItems('biz1', items);
    const esperado = { label: '2x1', scope: 'PRODUCT', llevaCantidad: 2, pagaCantidad: 1, productIds: ['p1'], categoryIds: [] };
    expect(mapa.get('v1')).toEqual(esperado);
    expect(mapa.get('v2')).toEqual(esperado);
  });

  it('un descuento V1 normal (no BUY_X_PAY_Y) sobre esas mismas filas sigue aplicando el precio de vista previa', async () => {
    const svc = svcCon([
      discountRow({ id: 'd2', name: '10% off', type: 'PERCENT_PRODUCT', value: 10, minQuantity: null }),
    ]);
    const items = [{ variantId: 'v1', productId: 'p1', categoryId: 'cat1', unitPrice: 1000 }];
    const mapa = await svc.descuentosDeItems('biz1', items);
    expect(mapa.get('v1')).toEqual({ amount: 100, discountId: 'd2', discountName: '10% off' });
  });
});
