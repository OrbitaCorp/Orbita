import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Auditoría interna, hallazgo `businesses-sin-baja` (RBT-699).
//
// La baja de un negocio pausaba la tienda y ponía la suscripción en CANCELLED,
// pero no tocaba la preapproval de Mercado Pago: al que se fue se le seguía
// debitando todos los meses, y cada cobro aprobado lo devolvía a ACTIVE.

const BIZ = 'biz-1';

function armar(opts: { sub?: Record<string, unknown>; mpFalla?: boolean; pago?: Record<string, unknown> } = {}) {
  const sub = {
    id: 'sub-1', businessId: BIZ, origin: 'PAID', status: 'ACTIVE', plan: 'mensual',
    nextPlan: null, planActive: true, mpPreapprovalId: 'pre-1',
    currentPeriodStart: new Date('2026-09-01'), currentPeriodEnd: new Date('2026-10-01'),
    amount: 16500, gracePeriodDays: 7, ...opts.sub,
  };
  const tx = {
    subscription: { update: jest.fn().mockResolvedValue({}) },
    subscriptionPayment: { create: jest.fn().mockResolvedValue({}) },
    business: { update: jest.fn().mockResolvedValue({}) },
    businessAddon: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    subscription: { findUnique: jest.fn().mockResolvedValue(sub), update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
    subscriptionPayment: { findFirst: jest.fn().mockResolvedValue(null) },
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Tienda', subdomain: 'tienda', cancelledAt: null, deletedAt: null }), update: jest.fn().mockResolvedValue({}) },
    member: { findMany: jest.fn().mockResolvedValue([{ email: 'ana@x.com' }]) },
    platformAdminLog: { findFirst: jest.fn().mockResolvedValue(null) },
    // Acepta las dos formas: el array de cancelBusiness y el callback de recordPayment.
    $transaction: jest.fn(async (arg: unknown) => (typeof arg === 'function' ? (arg as (t: unknown) => unknown)(tx) : [])),
  };
  const config = { get: (k: string) => (k === 'MP_ACCESS_TOKEN' ? 'tok' : undefined) };
  const mail = {
    sendBusinessCancellationConfirmed: jest.fn().mockResolvedValue(undefined),
    sendSubscriptionReactivated: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new SubscriptionsService(prisma as any, config as any, {} as any, {} as any, {} as any, {} as any, mail as any, undefined);
  const preapprovalUpdate = opts.mpFalla
    ? jest.fn().mockRejectedValue(new Error('MP caído'))
    : jest.fn().mockResolvedValue({ status: 'cancelled' });
  (svc as any)._preapproval = { update: preapprovalUpdate };
  (svc as any)._payment = {
    get: jest.fn().mockResolvedValue({ external_reference: BIZ, status: 'approved', transaction_amount: 16500, date_approved: '2026-10-01T00:00:00Z', ...opts.pago }),
  };
  return { svc, prisma, tx, mail, preapprovalUpdate };
}

describe('Dar de baja un negocio corta el débito de Mercado Pago', () => {
  it('cancela la preapproval y le saca el id a la suscripción', async () => {
    const { svc, prisma, preapprovalUpdate } = armar();
    await svc.cancelBusiness(BIZ);
    expect(preapprovalUpdate).toHaveBeenCalledWith({ id: 'pre-1', body: { status: 'cancelled' } });
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED', mpPreapprovalId: null } }),
    );
  });

  it('si MP no confirma la baja, el id se conserva para poder reintentar', async () => {
    const { svc, prisma } = armar({ mpFalla: true });
    await svc.cancelBusiness(BIZ);
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } }),
    );
    const data = prisma.subscription.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('mpPreapprovalId');
  });

  it('una suscripción sin preapproval (cortesía o alta gratis) se da de baja igual', async () => {
    const { svc, prisma, preapprovalUpdate } = armar({ sub: { mpPreapprovalId: null, origin: 'COMP' } });
    await svc.cancelBusiness(BIZ);
    expect(preapprovalUpdate).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED', mpPreapprovalId: null } }),
    );
  });

  it('no toca planActive: si reactiva dentro de los 60 días no le llega el aviso de "período de bienvenida"', async () => {
    const { svc, prisma } = armar();
    await svc.cancelBusiness(BIZ);
    expect(prisma.subscription.updateMany.mock.calls[0][0].data).not.toHaveProperty('planActive');
  });
});

describe('Un cobro no resucita una suscripción dada de baja', () => {
  it('registra el cobro pero no la vuelve a ACTIVE ni despausa la tienda', async () => {
    const { svc, tx } = armar({ sub: { status: 'CANCELLED' } });
    const r = await svc.recordPayment('pay-1');
    expect(r).toMatchObject({ recorded: true, approved: true, cancelled: true });
    // La plata queda registrada…
    expect(tx.subscriptionPayment.create).toHaveBeenCalled();
    // …pero no se renueva el período, no se extiende el addon ni vuelve al aire.
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.business.update).not.toHaveBeenCalled();
    expect(tx.businessAddon.upsert).not.toHaveBeenCalled();
  });

  it('reintenta cancelar la preapproval que sobrevivió a la baja', async () => {
    const { svc, prisma, preapprovalUpdate } = armar({ sub: { status: 'CANCELLED' } });
    await svc.recordPayment('pay-1');
    expect(preapprovalUpdate).toHaveBeenCalledWith({ id: 'pre-1', body: { status: 'cancelled' } });
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-1' }, data: { mpPreapprovalId: null } });
  });

  it('no le manda el mail de "tu tienda está activa de nuevo" a quien se dio de baja', async () => {
    const { svc, mail } = armar({ sub: { status: 'CANCELLED' } });
    await svc.recordPayment('pay-1');
    expect(mail.sendSubscriptionReactivated).not.toHaveBeenCalled();
  });

  it('una suscripción vigente sigue renovándose normalmente', async () => {
    const { svc, tx } = armar({ sub: { status: 'ACTIVE' } });
    const r = await svc.recordPayment('pay-1');
    expect(r).toMatchObject({ recorded: true, approved: true, cancelled: false });
    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }));
  });
});
