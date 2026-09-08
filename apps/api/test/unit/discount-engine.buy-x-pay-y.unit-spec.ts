import { evaluateCart, CartItemForEngine, EligibleDiscount } from '../../src/discounts/discount-engine';

// BUY_X_PAY_Y ("llevá X pagá Y" — 2x1, 3x2, etc., RBT-675). Cubre la
// agrupación entre líneas del carrito y, sobre todo, el caso que solo
// aparece con VARIAS promos activas a la vez (2026-09-04): dos promos que
// matchean la misma unidad no pueden descontarla dos veces — la más vieja
// (createdAt asc, mismo desempate que el resto del motor) se la queda.

function discount(overrides: Partial<EligibleDiscount> & Pick<EligibleDiscount, 'id' | 'name'>): EligibleDiscount {
  return {
    type: 'BUY_X_PAY_Y',
    value: 2,
    scope: 'CATEGORY',
    productLevel: null,
    minAmount: null,
    minQuantity: 3,
    priority: 0,
    productIds: [],
    categoryIds: [],
    ...overrides,
  };
}

describe('discount-engine — BUY_X_PAY_Y', () => {
  const promo3x2 = discount({ id: 'd1', name: '3x2', minQuantity: 3, value: 2, categoryIds: ['cat1'] });

  it('agrupa entre líneas y descuenta la unidad más barata del pool', () => {
    const items: CartItemForEngine[] = [
      { variantId: 'v1', productId: 'p1', categoryId: 'cat1', quantity: 1, unitPrice: 1000 },
      { variantId: 'v2', productId: 'p2', categoryId: 'cat1', quantity: 1, unitPrice: 500 },
      { variantId: 'v3', productId: 'p3', categoryId: 'cat1', quantity: 1, unitPrice: 800 },
    ];
    const r = evaluateCart(items, [promo3x2]);
    expect(r.subtotal).toBe(2300);
    expect(r.itemDiscounts).toEqual([{ variantId: 'v2', discountId: 'd1', discountName: '3x2', amount: 500, type: 'BUY_X_PAY_Y' }]);
    expect(r.total).toBe(1800);
  });

  it('grupo incompleto (menos de X unidades) no descuenta nada', () => {
    const items: CartItemForEngine[] = [
      { variantId: 'v1', productId: 'p1', categoryId: 'cat1', quantity: 1, unitPrice: 1000 },
      { variantId: 'v2', productId: 'p2', categoryId: 'cat1', quantity: 1, unitPrice: 500 },
    ];
    const r = evaluateCart(items, [promo3x2]);
    expect(r.itemDiscounts).toEqual([]);
    expect(r.total).toBe(r.subtotal);
  });

  it('una sola variante con cantidad suficiente para dos grupos completos', () => {
    const items: CartItemForEngine[] = [{ variantId: 'v1', productId: 'p1', categoryId: 'cat1', quantity: 6, unitPrice: 300 }];
    const r = evaluateCart(items, [promo3x2]);
    expect(r.itemDiscounts).toEqual([{ variantId: 'v1', discountId: 'd1', discountName: '3x2', amount: 600, type: 'BUY_X_PAY_Y' }]);
  });

  it('no compite con un PERCENT_PRODUCT sobre la misma categoría — la unidad cubierta por el 3x2 no entra en esa competencia', () => {
    const percent = discount({ id: 'd2', name: '10% cat', type: 'PERCENT_PRODUCT', value: 10, categoryIds: ['cat1'] });
    const items: CartItemForEngine[] = [
      { variantId: 'v1', productId: 'p1', categoryId: 'cat1', quantity: 1, unitPrice: 1000 },
      { variantId: 'v2', productId: 'p2', categoryId: 'cat1', quantity: 1, unitPrice: 500 },
      { variantId: 'v3', productId: 'p3', categoryId: 'cat1', quantity: 1, unitPrice: 800 },
    ];
    const r = evaluateCart(items, [promo3x2, percent]);
    expect(r.itemDiscounts.find((d) => d.variantId === 'v2')).toEqual({ variantId: 'v2', discountId: 'd1', discountName: '3x2', amount: 500, type: 'BUY_X_PAY_Y' });
    expect(r.itemDiscounts.find((d) => d.variantId === 'v1')).toEqual({ variantId: 'v1', discountId: 'd2', discountName: '10% cat', amount: 100, type: 'PERCENT_PRODUCT' });
  });

  it('tipo no soportado (V2, ej. BUY_X_GET_Z) se filtra defensivamente y no descuenta', () => {
    const noSoportado = discount({ id: 'd3', name: 'x', type: 'BUY_X_GET_Z' as EligibleDiscount['type'] });
    const items: CartItemForEngine[] = [{ variantId: 'v9', productId: 'p9', categoryId: 'cat1', quantity: 3, unitPrice: 100 }];
    const r = evaluateCart(items, [noSoportado]);
    expect(r.itemDiscounts).toEqual([]);
  });

  // ── Varias promos BUY_X_PAY_Y activas a la vez (2026-09-04) ──────────────

  it('dos promos que matchean la MISMA categoría: la más vieja (primera en la lista) se queda con las unidades, la otra no duplica el descuento', () => {
    // `discounts` le llega al motor ya ordenado por createdAt asc (contrato
    // del caller, ver descuentosAutomaticosVigentes) — acá se simula ese
    // orden con el orden del array.
    const vieja2x1 = discount({ id: 'vieja', name: '2x1-vieja', minQuantity: 2, value: 1, categoryIds: ['cat1'] });
    const nueva3x2 = discount({ id: 'nueva', name: '3x2-nueva', minQuantity: 3, value: 2, categoryIds: ['cat1'] });
    const items: CartItemForEngine[] = [
      { variantId: 'v1', productId: 'p1', categoryId: 'cat1', quantity: 1, unitPrice: 1000 },
      { variantId: 'v2', productId: 'p2', categoryId: 'cat1', quantity: 1, unitPrice: 500 },
      { variantId: 'v3', productId: 'p3', categoryId: 'cat1', quantity: 1, unitPrice: 800 },
    ];
    const r = evaluateCart(items, [vieja2x1, nueva3x2]);

    // La vieja (2x1) toma las 3 unidades del pool ANTES que la nueva pueda
    // verlas: floor(3/2)=1 grupo completo, 1 unidad gratis (la más barata,
    // v2). Sin el fix de superposición, la promo nueva (3x2) también vería
    // las 3 unidades libres, formaría su propio grupo de 3, y v2 terminaría
    // descontada DOS veces (una por cada promo).
    expect(r.itemDiscounts).toHaveLength(1);
    expect(r.itemDiscounts[0]).toEqual({ variantId: 'v2', discountId: 'vieja', discountName: '2x1-vieja', amount: 500, type: 'BUY_X_PAY_Y' });
    expect(r.discountTotal).toBe(500); // no 1000 (que sería contarla dos veces)
  });

  it('dos promos con alcances que NO se pisan (categorías distintas) conviven sin interferirse', () => {
    const promoRemeras = discount({ id: 'remeras', name: '2x1', minQuantity: 2, value: 1, categoryIds: ['remeras'] });
    const promoPantalones = discount({ id: 'pantalones', name: '3x2', minQuantity: 3, value: 2, categoryIds: ['pantalones'] });
    const items: CartItemForEngine[] = [
      { variantId: 'r1', productId: 'p1', categoryId: 'remeras', quantity: 1, unitPrice: 1000 },
      { variantId: 'r2', productId: 'p2', categoryId: 'remeras', quantity: 1, unitPrice: 600 },
      { variantId: 'pa1', productId: 'p3', categoryId: 'pantalones', quantity: 3, unitPrice: 400 },
    ];
    const r = evaluateCart(items, [promoRemeras, promoPantalones]);
    expect(r.itemDiscounts).toEqual(
      expect.arrayContaining([
        { variantId: 'r2', discountId: 'remeras', discountName: '2x1', amount: 600, type: 'BUY_X_PAY_Y' },
        { variantId: 'pa1', discountId: 'pantalones', discountName: '3x2', amount: 400, type: 'BUY_X_PAY_Y' },
      ]),
    );
    expect(r.itemDiscounts).toHaveLength(2);
  });
});
