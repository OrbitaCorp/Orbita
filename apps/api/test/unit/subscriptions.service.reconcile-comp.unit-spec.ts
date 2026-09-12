import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Unit test del vencimiento de licencias comp dentro de
// reconcileOverdueSubscriptions. Antes (RBT-651) este tramo corría separado
// del de PAID y suspendía sin gracia; desde el rediseño de ciclo de vida
// (RBT, 2026-09) comparte el MISMO recorrido y la MISMA gracia que las
// pagas — estos tests cubren que una comp también entra en gracia antes de
// suspenderse, y que sigue corriendo aunque MP_ACCESS_TOKEN no esté
// configurado (caso normal en dev/test, y de hecho el caso normal para una
// comp: no tiene nada que preguntarle a MercadoPago).

function makeService(mpAccessToken: string | undefined) {
  const config = { get: (k: string) => (k === 'MP_ACCESS_TOKEN' ? mpAccessToken : undefined) };
  const prisma = {
    subscription: { findMany: jest.fn(), update: jest.fn() },
    business: { update: jest.fn() },
    $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
  };
  const svc = new SubscriptionsService(prisma as any, config as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  (svc as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { svc, prisma };
}

function compVencida(overrides: Partial<Record<string, unknown>> = {}) {
  const currentPeriodEnd = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // venció hace 10 días
  return {
    id: 'sub1',
    businessId: 'biz1',
    origin: 'COMP',
    status: 'ACTIVE',
    mpPreapprovalId: null,
    gracePeriodDays: 7,
    currentPeriodEnd,
    ...overrides,
  };
}

describe('SubscriptionsService.reconcileOverdueSubscriptions — comps (unit)', () => {
  it('consulta TODOS los orígenes vencidos en un único findMany (no separa PAID/COMP)', async () => {
    const { svc, prisma } = makeService(undefined);
    prisma.subscription.findMany.mockResolvedValue([]);

    await svc.reconcileOverdueSubscriptions();

    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { lt: expect.any(Date) } },
    });
  });

  it('una comp cuya gracia ya se agotó se suspende y pausa el negocio, aunque MP no esté configurado', async () => {
    const { svc, prisma } = makeService(undefined);
    prisma.subscription.findMany.mockResolvedValue([compVencida()]);

    await svc.reconcileOverdueSubscriptions();

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub1' }, data: { status: 'SUSPENDED' } });
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz1' }, data: { isPaused: true } });
  });

  it('una comp recién vencida entra en gracia (PAST_DUE) en vez de suspenderse directo', async () => {
    const { svc, prisma } = makeService(undefined);
    const recienVencida = compVencida({
      currentPeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // venció ayer, gracia de 7 días
    });
    prisma.subscription.findMany.mockResolvedValue([recienVencida]);

    await svc.reconcileOverdueSubscriptions();

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub1' }, data: { status: 'PAST_DUE' } });
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('no hace nada si no hay suscripciones vencidas', async () => {
    const { svc, prisma } = makeService(undefined);
    prisma.subscription.findMany.mockResolvedValue([]);

    await svc.reconcileOverdueSubscriptions();

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('un error al reconciliar una comp no interrumpe el resto del barrido', async () => {
    const { svc, prisma } = makeService(undefined);
    prisma.subscription.findMany.mockResolvedValue([
      compVencida({ id: 'sub1', businessId: 'biz1' }),
      compVencida({ id: 'sub2', businessId: 'biz2' }),
    ]);
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(new Error('db down')))
      .mockImplementationOnce((arr: Promise<unknown>[]) => Promise.all(arr));

    await svc.reconcileOverdueSubscriptions();

    // La segunda comp se procesa igual pese al error de la primera.
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub2' }, data: { status: 'SUSPENDED' } });
  });
});
