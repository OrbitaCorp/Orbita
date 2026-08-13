import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Unit test del vencimiento de licencias comp dentro de
// reconcileOverdueSubscriptions (RBT-651). A diferencia del tramo PAID, este
// tramo no depende de MercadoPago -- debe correr aunque MP_ACCESS_TOKEN no
// esté configurado (caso normal en dev/test).

function makeService(mpAccessToken: string | undefined) {
  const config = { get: (k: string) => (k === 'MP_ACCESS_TOKEN' ? mpAccessToken : undefined) };
  const prisma = {
    subscription: { findMany: jest.fn(), update: jest.fn() },
    business: { update: jest.fn() },
    $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
  };
  const svc = new SubscriptionsService(prisma as any, config as any, {} as any, {} as any, {} as any, {} as any);
  (svc as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { svc, prisma };
}

describe('SubscriptionsService.reconcileOverdueSubscriptions — comps (unit)', () => {
  it('suspende una comp vencida y pausa el negocio, aunque MP no esté configurado', async () => {
    const { svc, prisma } = makeService(undefined);
    prisma.subscription.findMany.mockResolvedValue([{ id: 'sub1', businessId: 'biz1' }]);

    await svc.reconcileOverdueSubscriptions();

    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: { origin: 'COMP', status: 'ACTIVE', currentPeriodEnd: { lt: expect.any(Date) } },
    });
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub1' }, data: { status: 'SUSPENDED' } });
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz1' }, data: { isPaused: true } });
  });

  it('no hace nada si no hay comps vencidas', async () => {
    const { svc, prisma } = makeService(undefined);
    prisma.subscription.findMany.mockResolvedValue([]);

    await svc.reconcileOverdueSubscriptions();

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('un error al reconciliar una comp no interrumpe el resto del barrido', async () => {
    const { svc, prisma } = makeService(undefined);
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'sub1', businessId: 'biz1' },
      { id: 'sub2', businessId: 'biz2' },
    ]);
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(new Error('db down')))
      .mockImplementationOnce((arr: Promise<unknown>[]) => Promise.all(arr));

    await svc.reconcileOverdueSubscriptions();

    // La segunda comp se procesa igual pese al error de la primera.
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub2' }, data: { status: 'SUSPENDED' } });
  });
});
