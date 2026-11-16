import { OrdersService, COMPRADOR_ANONIMO } from '../../src/orders/orders.service';

// "Solo registrar la venta" (16/11): desde el panel se puede cargar una venta
// sin cliente ni comprador, pidiéndolo explícitamente con `sinComprador`.
// Queda a nombre de "Consumidor final" y no crea ficha en Clientes.

const BIZ = 'biz-1';
const VAR = '11111111-1111-4111-8111-111111111111';
const SUC = '22222222-2222-4222-8222-222222222222';

// La transacción corre hasta guardar los datos del comprador y ahí corta: alcanza
// para ver a nombre de quién quedó el pedido.
function armar() {
  const detalles = jest.fn().mockRejectedValue(new Error('fin del mock'));
  const tx = {
    order: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'o-1', orderNumber: 1, branchId: SUC }),
    },
    orderItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    onlineOrderDetails: { create: detalles },
  };
  const customer = { findFirst: jest.fn(), create: jest.fn() };
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: SUC }) },
    customer,
    productVariant: {
      findMany: jest.fn().mockResolvedValue([{ id: VAR, price: 100, product: { name: 'Remera' }, optionValues: [] }]),
    },
    variantStock: { findMany: jest.fn().mockResolvedValue([{ variantId: VAR, quantity: 10 }]) },
    businessConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const descuentos = { resolverDescuentosParaOrden: jest.fn().mockResolvedValue({ discountTotal: 0, redenciones: [] }) };
  const svc = new OrdersService(prisma as any, {} as any, descuentos as any, { emit: jest.fn() } as any);
  const crear = (extra: Record<string, unknown>, opts?: { publicCheckout?: boolean }) =>
    svc
      .create(BIZ, { channel: 'ONLINE', branch_id: SUC, items: [{ variantId: VAR, quantity: 1 }], ...extra } as any, opts)
      .catch((e) => e);
  return { crear, detalles, customer, tx };
}

describe('Venta del panel sin comprador', () => {
  it('con sinComprador queda a nombre de Consumidor final, sin cliente', async () => {
    const { crear, detalles, customer, tx } = armar();
    await crear({ sinComprador: true });

    expect(detalles).toHaveBeenCalledWith({
      data: expect.objectContaining({ buyerName: COMPRADOR_ANONIMO, buyerEmail: null, buyerPhone: null }),
    });
    expect(tx.order.create).toHaveBeenCalledWith({ data: expect.objectContaining({ customerId: null }) });
    expect(customer.create).not.toHaveBeenCalled();
  });

  it('sin comprador y sin pedirlo explícitamente sigue rebotando', async () => {
    const { crear, detalles } = armar();
    const error = await crear({});

    expect(error.message).toMatch(/Indicá un cliente o el nombre del comprador/);
    expect(detalles).not.toHaveBeenCalled();
  });

  it('el checkout público no puede vender sin comprador', async () => {
    const { crear, detalles } = armar();
    const error = await crear({ sinComprador: true }, { publicCheckout: true });

    expect(error.message).toMatch(/Indicá un cliente o el nombre del comprador/);
    expect(detalles).not.toHaveBeenCalled();
  });

  it('si además viene un comprador, manda el comprador', async () => {
    const { crear, detalles } = armar();
    await crear({ sinComprador: true, buyer: { name: 'Ana' } });

    expect(detalles).toHaveBeenCalledWith({ data: expect.objectContaining({ buyerName: 'Ana' }) });
  });
});
