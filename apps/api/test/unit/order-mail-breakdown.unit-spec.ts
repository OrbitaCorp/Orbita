import { desgloseDePedido } from '../../src/orders/order-mail-breakdown';

// Pedido #50: el mail mostraba el producto a $15.000 y un total de $13.500 sin
// explicar la diferencia. El desglose sale de lo guardado en el pedido.

function prismaCon(order: unknown) {
  return { order: { findUnique: jest.fn().mockResolvedValue(order) } } as any;
}

const redencion = (id: string, name: string, type: string, value: number, amount: number) => ({
  amount,
  discount: { id, name, type, value },
});

describe('desgloseDePedido', () => {
  it('sin descuento ni envío no agrega nada (el mail sale como antes)', async () => {
    const prisma = prismaCon({ subtotal: 15000, discountTotal: 0, onlineOrderDetails: null, redemptions: [] });
    expect(await desgloseDePedido(prisma, 'o-1')).toEqual({});
  });

  it('un descuento porcentual sobre el total figura con su nombre y su tasa', async () => {
    const prisma = prismaCon({
      subtotal: 15000,
      discountTotal: 1500,
      onlineOrderDetails: null,
      redemptions: [redencion('d-1', 'Promo primavera', 'PERCENT_TICKET', 10, 1500)],
    });
    const r = await desgloseDePedido(prisma, 'o-1');
    expect(r.subtotal).toMatch(/15\.000/);
    expect(r.discounts).toHaveLength(1);
    expect(r.discounts![0].label).toBe('Promo primavera (10%)');
    expect(r.discounts![0].amount).toMatch(/1\.500/);
    expect(r.shipping).toBeUndefined();
  });

  it('suma las redenciones del mismo descuento en un solo renglón', async () => {
    const prisma = prismaCon({
      subtotal: 20000,
      discountTotal: 3000,
      onlineOrderDetails: null,
      redemptions: [
        redencion('d-1', '2x1 remeras', 'AMOUNT_PRODUCT', 1000, 1000),
        redencion('d-1', '2x1 remeras', 'AMOUNT_PRODUCT', 1000, 2000),
      ],
    });
    const r = await desgloseDePedido(prisma, 'o-1');
    expect(r.discounts).toHaveLength(1);
    expect(r.discounts![0].label).toBe('2x1 remeras');
    expect(r.discounts![0].amount).toMatch(/3\.000/);
  });

  it('lo que no tiene redención (descuento manual) va en un renglón genérico', async () => {
    const prisma = prismaCon({
      subtotal: 10000,
      discountTotal: 2500,
      onlineOrderDetails: null,
      redemptions: [redencion('d-1', 'Cupón HOLA', 'AMOUNT_TICKET', 1000, 1000)],
    });
    const r = await desgloseDePedido(prisma, 'o-1');
    expect(r.discounts!.map((d) => d.label)).toEqual(['Cupón HOLA', 'Descuento']);
    expect(r.discounts![1].amount).toMatch(/1\.500/);
  });

  it('solo envío: muestra subtotal y envío, sin descuentos', async () => {
    const prisma = prismaCon({
      subtotal: 10000,
      discountTotal: 0,
      onlineOrderDetails: { shippingCost: 2000 },
      redemptions: [],
    });
    const r = await desgloseDePedido(prisma, 'o-1');
    expect(r.subtotal).toMatch(/10\.000/);
    expect(r.discounts).toEqual([]);
    expect(r.shipping).toMatch(/2\.000/);
  });

  it('si la consulta falla devuelve {} y no rompe el envío', async () => {
    const prisma = { order: { findUnique: jest.fn().mockRejectedValue(new Error('db')) } } as any;
    expect(await desgloseDePedido(prisma, 'o-1')).toEqual({});
  });

  it('pedido inexistente devuelve {}', async () => {
    expect(await desgloseDePedido(prismaCon(null), 'o-1')).toEqual({});
  });
});
