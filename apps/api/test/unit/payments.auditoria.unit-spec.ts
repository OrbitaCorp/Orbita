import { OrdersService } from '../../src/orders/orders.service';

// Auditoría interna 2026-09-10, ítem `api.payments`.
//
// Un pago offline (efectivo, transferencia, tarjeta con posnet) de un pedido
// online nace PENDING y se aprueba cuando el negocio confirma el pedido. Esa
// aprobación no guardaba quién la hizo: el pago quedaba cobrado sin nadie
// detrás, a diferencia de la venta de caja, que sí lleva verifiedBy.

const BIZ = 'biz-1';

function pedidos(status: 'PENDING' | 'CONFIRMED') {
  const tx = {
    order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderStatusHistory: { create: jest.fn() },
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    variantStock: { upsert: jest.fn() },
    stockMovement: { create: jest.fn() },
  };
  const prisma = {
    order: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'o-1', orderNumber: 7, businessId: BIZ, branchId: 'b-1', channel: 'ONLINE', status, total: 1000, customerId: null,
        business: { name: 'T', subdomain: 't' }, customer: null, onlineOrderDetails: null, items: [],
      }),
    },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const svc = new OrdersService(prisma as any, {} as any, {} as any, { emit: jest.fn() } as any);
  jest.spyOn(svc as any, 'descontarStockEnTx').mockResolvedValue(undefined);
  jest.spyOn(svc as any, 'avisarStockCritico').mockResolvedValue(undefined);
  jest.spyOn(svc, 'findOne').mockResolvedValue({} as any);
  return { svc, tx };
}

describe('Confirmar un pedido aprueba su pago offline con quién lo confirmó', () => {
  it('pendiente → confirmado: APPROVED con verifiedBy y verifiedAt, nunca sobre Mercado Pago', async () => {
    const { svc, tx } = pedidos('PENDING');
    await svc.updateStatus(BIZ, 'm-cajero', 'o-1', 'CONFIRMED');
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o-1', businessId: BIZ, status: 'PENDING', method: { not: 'MERCADOPAGO' } },
      data: { status: 'APPROVED', paidAt: expect.any(Date), verifiedBy: 'm-cajero', verifiedAt: expect.any(Date) },
    });
  });

  it('cancelar rechaza el pago pendiente y no lo da por verificado', async () => {
    const { svc, tx } = pedidos('PENDING');
    await svc.updateStatus(BIZ, 'm-cajero', 'o-1', 'CANCELLED');
    expect(tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'REJECTED' } }));
  });

  it('un pedido ya confirmado que avanza no vuelve a tocar pagos', async () => {
    const { svc, tx } = pedidos('CONFIRMED');
    await svc.updateStatus(BIZ, 'm-cajero', 'o-1', 'PREPARING');
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });
});
