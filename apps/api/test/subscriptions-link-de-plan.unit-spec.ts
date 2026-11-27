import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';

// Activación del plan con un link de PLAN de Mercado Pago (preapproval_plan),
// sin email. Antes la activación creaba una suscripción con `payer_email` = el
// email del panel, y MP solo dejaba pagarla a la cuenta con ese mismo correo:
// una clienta con Mercado Pago en otro email no podía pagar de ninguna forma
// (26/11). Las suscripciones que salen del link no traen external_reference,
// así que el negocio se reconoce por la fila del link (SubscriptionPlanCheckout).

const LISTA_MENSUAL = 16500;

function armar() {
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    platformDiscountRedemption: { create: jest.fn().mockResolvedValue({}) },
    subscriptionPayment: { create: jest.fn().mockResolvedValue({}) },
    subscription: { update: jest.fn().mockResolvedValue({}) },
    business: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    subscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    subscriptionPlanCheckout: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'chk-nuevo', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    subscriptionActivationDiscount: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'd1', status: 'PENDING', ...data })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    subscriptionPayment: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
    platformAdminLog: { findFirst: jest.fn().mockResolvedValue(null) },
    platformDiscountCode: { findUnique: jest.fn() },
    member: { findFirst: jest.fn().mockResolvedValue({ email: 'duena@x.com' }) },
    business: { findUnique: jest.fn().mockResolvedValue({ subdomain: 'tienda' }), update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
  };
  const cfg: any = { get: jest.fn((k: string) => ({ MP_ACCESS_TOKEN: 'tok', FRONTEND_URL: 'https://orbita.site' } as Record<string, string>)[k]) };
  const mail: any = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const businesses: any = { publish: jest.fn().mockResolvedValue({}) };
  const service = new SubscriptionsService(prisma, cfg, {} as any, businesses, {} as any, {} as any, mail);
  const preapproval = {
    get: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    search: jest.fn().mockResolvedValue({ results: [] }),
  };
  const preapprovalPlan = {
    create: jest.fn().mockResolvedValue({ id: 'PLAN-1', init_point: 'https://mp/suscribirse' }),
    update: jest.fn().mockResolvedValue({}),
  };
  const payment = { get: jest.fn() };
  Object.assign(service as any, { _preapproval: preapproval, _preapprovalPlan: preapprovalPlan, _payment: payment });
  jest.spyOn(service as any, 'syncAddonAvanzado').mockResolvedValue(undefined);
  jest.spyOn(service as any, 'notificarReactivacion').mockResolvedValue(undefined);
  return { service, prisma, tx, preapproval, preapprovalPlan, payment, mail };
}

const subVencida = (extra: Record<string, unknown> = {}) => ({
  id: 'sub1', businessId: 'b1', plan: 'mensual', nextPlan: null, origin: 'PAID', status: 'SUSPENDED', planActive: false,
  mpPreapprovalId: null, frozenAmount: null, frozenChargesLeft: 0, amount: LISTA_MENSUAL,
  currentPeriodEnd: new Date(Date.now() - 86_400_000), gracePeriodDays: 7,
  ...extra,
});

// Lo que devuelve MP para una suscripción creada desde el link: SIN
// external_reference, con el plan del que salió.
const desdeElLink = (monto = LISTA_MENSUAL, extra: Record<string, unknown> = {}) => ({
  id: 'PRE-9',
  status: 'authorized',
  preapproval_plan_id: 'PLAN-1',
  payer_email: 'otra-cuenta@mp.com',
  auto_recurring: { transaction_amount: monto, frequency: 1, frequency_type: 'months', currency_id: 'ARS' },
  ...extra,
});

const link = (extra: Record<string, unknown> = {}) => ({
  id: 'chk-1', businessId: 'b1', mpPlanId: 'PLAN-1', plan: 'mensual', amountList: LISTA_MENSUAL, amountFinal: LISTA_MENSUAL,
  discounted: false, codeId: null, campaignId: null, chargesTotal: 1, status: 'PENDING', preapprovalId: null, usedAt: null,
  createdAt: new Date(), ...extra,
});

describe('activatePlan arma un link de plan, sin email', () => {
  it('crea un plan de MP sin payer_email y anota de qué negocio es', async () => {
    const { service, prisma, preapprovalPlan } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());

    const r = await service.activatePlan('b1', 'm1');

    expect(r).toEqual({ initPoint: 'https://mp/suscribirse', plan: 'mensual' });
    const body = preapprovalPlan.create.mock.calls[0][0].body;
    expect(body).not.toHaveProperty('payer_email');
    expect(body.back_url).toBe('https://orbita.site/onboarding/plan-activado');
    expect(body.auto_recurring).toMatchObject({ transaction_amount: LISTA_MENSUAL, frequency: 1, frequency_type: 'months', currency_id: 'ARS' });
    expect(prisma.subscriptionPlanCheckout.create.mock.calls[0][0].data).toMatchObject({ businessId: 'b1', mpPlanId: 'PLAN-1', plan: 'mensual' });
  });

  it('reemplaza los links pedidos antes y los desactiva en MP', async () => {
    const { service, prisma, preapprovalPlan } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.subscriptionPlanCheckout.findMany.mockResolvedValue([{ id: 'chk-viejo', mpPlanId: 'PLAN-VIEJO' }]);

    await service.activatePlan('b1', 'm1');

    expect(prisma.subscriptionPlanCheckout.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['chk-viejo'] }, status: 'PENDING' },
      data: { status: 'SUPERSEDED' },
    });
    expect(preapprovalPlan.update).toHaveBeenCalledWith({ id: 'PLAN-VIEJO', updatePreApprovalPlanRequest: { status: 'inactive' } });
  });

  it('si MP no deja desactivar un link viejo, el nuevo sale igual', async () => {
    const { service, prisma, preapprovalPlan } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.subscriptionPlanCheckout.findMany.mockResolvedValue([{ id: 'chk-viejo', mpPlanId: 'PLAN-VIEJO' }]);
    preapprovalPlan.update.mockRejectedValue(new Error('mp caído'));

    await expect(service.activatePlan('b1', 'm1')).resolves.toMatchObject({ initPoint: 'https://mp/suscribirse' });
  });
});

describe('confirmPlanActivation de una suscripción que salió del link', () => {
  it('reconoce el negocio por el plan, activa y marca el link como usado', async () => {
    const { service, prisma, preapproval } = armar();
    preapproval.get.mockResolvedValue(desdeElLink());
    prisma.subscriptionPlanCheckout.findUnique.mockResolvedValue(link());
    prisma.subscription.findUnique.mockResolvedValue(subVencida());

    const r = await service.confirmPlanActivation('PRE-9');

    expect(r).toMatchObject({ activated: true, plan: 'mensual', businessId: 'b1', subdomain: 'tienda' });
    expect(prisma.subscriptionPlanCheckout.findUnique).toHaveBeenCalledWith({ where: { mpPlanId: 'PLAN-1' } });
    expect(prisma.subscription.update.mock.calls[0][0].data).toMatchObject({ planActive: true, mpPreapprovalId: 'PRE-9', status: 'ACTIVE' });
    expect(prisma.subscriptionPlanCheckout.update).toHaveBeenCalledWith({
      where: { id: 'chk-1' },
      data: expect.objectContaining({ status: 'USED', preapprovalId: 'PRE-9' }),
    });
  });

  it('con descuento: crea la fila con el id real de la suscripción y consume el código', async () => {
    const { service, prisma, tx, preapproval } = armar();
    preapproval.get.mockResolvedValue(desdeElLink(165));
    prisma.subscriptionPlanCheckout.findUnique.mockResolvedValue(link({ discounted: true, codeId: 'code1', amountFinal: 165 }));
    prisma.subscription.findUnique.mockResolvedValue(subVencida());

    const r = await service.confirmPlanActivation('PRE-9');

    expect(r).toMatchObject({ activated: true, plan: 'mensual' });
    expect(prisma.subscriptionActivationDiscount.create.mock.calls[0][0].data).toMatchObject({
      businessId: 'b1', preapprovalId: 'PRE-9', codeId: 'code1', plan: 'mensual', amountFinal: 165, chargesTotal: 1,
    });
    expect(prisma.subscription.update.mock.calls[0][0].data.amount).toBe(165);
    expect(prisma.subscriptionActivationDiscount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    expect(tx.platformDiscountRedemption.create).toHaveBeenCalledTimes(1);
  });

  it('una suscripción de un plan que no es nuestro no activa nada', async () => {
    const { service, prisma, preapproval } = armar();
    preapproval.get.mockResolvedValue(desdeElLink(LISTA_MENSUAL, { preapproval_plan_id: 'PLAN-AJENO' }));

    const r = await service.confirmPlanActivation('PRE-9');

    expect(r).toEqual({ activated: false, status: 'sin_external_reference' });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('las suscripciones de antes (con external_reference) se siguen confirmando igual', async () => {
    const { service, prisma, preapproval } = armar();
    preapproval.get.mockResolvedValue({ ...desdeElLink(), preapproval_plan_id: undefined, external_reference: 'b1' });
    prisma.subscription.findUnique.mockResolvedValue(subVencida());

    const r = await service.confirmPlanActivation('PRE-9');

    expect(r).toMatchObject({ activated: true, businessId: 'b1' });
    expect(prisma.subscriptionPlanCheckout.findUnique).not.toHaveBeenCalled();
  });

  it('si la suscripción anterior seguía autorizada, la da de baja y avisa', async () => {
    const { service, prisma, preapproval, mail } = armar();
    preapproval.get.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(id === 'PRE-VIEJA' ? { id, status: 'authorized' } : desdeElLink()),
    );
    prisma.subscriptionPlanCheckout.findUnique.mockResolvedValue(link());
    prisma.subscription.findUnique.mockResolvedValue(subVencida({ planActive: true, status: 'ACTIVE', mpPreapprovalId: 'PRE-VIEJA' }));

    await service.confirmPlanActivation('PRE-9');

    expect(preapproval.update).toHaveBeenCalledWith({ id: 'PRE-VIEJA', body: { status: 'cancelled' } });
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
  });

  it('si la anterior ya estaba cancelada (lo normal en un cambio de plan), no hace nada', async () => {
    const { service, prisma, preapproval, mail } = armar();
    preapproval.get.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(id === 'PRE-VIEJA' ? { id, status: 'cancelled' } : desdeElLink()),
    );
    prisma.subscriptionPlanCheckout.findUnique.mockResolvedValue(link());
    prisma.subscription.findUnique.mockResolvedValue(subVencida({ planActive: true, status: 'ACTIVE', mpPreapprovalId: 'PRE-VIEJA' }));

    await service.confirmPlanActivation('PRE-9');

    expect(preapproval.update).not.toHaveBeenCalled();
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
});

describe('recordPayment de un cobro sin external_reference', () => {
  const cobro = { status: 'approved', transaction_amount: LISTA_MENSUAL, date_approved: '2026-11-26T10:00:00.000Z' };

  it('lo imputa por la suscripción que trae el aviso de cobro recurrente', async () => {
    const { service, prisma, tx, payment } = armar();
    payment.get.mockResolvedValue(cobro);
    prisma.subscription.findFirst.mockResolvedValue({ businessId: 'b1' });
    prisma.subscription.findUnique.mockResolvedValue(subVencida({ planActive: true, status: 'ACTIVE', mpPreapprovalId: 'PRE-9' }));

    const r = await service.recordPayment('PAGO-1', 'PRE-9');

    expect(r).toMatchObject({ recorded: true, approved: true });
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({ where: { mpPreapprovalId: 'PRE-9' }, select: { businessId: true } });
    expect(tx.subscriptionPayment.create.mock.calls[0][0].data).toMatchObject({ mpPaymentId: 'PAGO-1', status: 'APPROVED' });
  });

  it('lo imputa por la suscripción que viene dentro del pago', async () => {
    const { service, prisma, tx, payment } = armar();
    payment.get.mockResolvedValue({ ...cobro, metadata: { preapproval_id: 'PRE-9' } });
    prisma.subscription.findFirst.mockResolvedValue({ businessId: 'b1' });
    prisma.subscription.findUnique.mockResolvedValue(subVencida({ planActive: true, status: 'ACTIVE', mpPreapprovalId: 'PRE-9' }));

    const r = await service.recordPayment('PAGO-1');

    expect(r).toMatchObject({ recorded: true });
    expect(tx.subscriptionPayment.create).toHaveBeenCalledTimes(1);
  });

  it('si el cobro llega antes que la confirmación, activa el plan primero', async () => {
    const { service, prisma, preapproval, payment } = armar();
    payment.get.mockResolvedValue(cobro);
    preapproval.get.mockResolvedValue(desdeElLink());
    prisma.subscriptionPlanCheckout.findUnique.mockResolvedValue(link());
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    const confirmar = jest.spyOn(service, 'confirmPlanActivation');

    const r = await service.recordPayment('PAGO-1', 'PRE-9');

    expect(confirmar).toHaveBeenCalledWith('PRE-9');
    expect(r).toMatchObject({ recorded: true });
  });

  it('sin external_reference ni suscripción conocida, se ignora como antes', async () => {
    const { service, payment } = armar();
    payment.get.mockResolvedValue(cobro);

    const r = await service.recordPayment('PAGO-1');

    expect(r).toEqual({ recorded: false, reason: 'sin_external_reference' });
  });
});

describe('rescatarActivacionesPendientes', () => {
  it('activa lo que MP ya tiene autorizado desde un link que seguimos viendo pendiente', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscriptionPlanCheckout.findMany.mockResolvedValue([{ mpPlanId: 'PLAN-1', businessId: 'b1' }]);
    preapproval.search.mockResolvedValue({ results: [{ id: 'PRE-9', status: 'authorized' }] });
    const confirmar = jest.spyOn(service, 'confirmPlanActivation').mockResolvedValue({ activated: true } as any);

    const n = await service.rescatarActivacionesPendientes();

    expect(preapproval.search).toHaveBeenCalledWith({ options: { preapproval_plan_id: 'PLAN-1', status: 'authorized' } });
    expect(confirmar).toHaveBeenCalledWith('PRE-9');
    expect(n).toBe(1);
    // El barrido nocturno vence los links de más de 30 días.
    expect(prisma.subscriptionPlanCheckout.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EXPIRED' } }));
  });

  it('al abrir el panel solo mira ese negocio y no vence nada', async () => {
    const { service, prisma } = armar();

    await service.rescatarActivacionesPendientes('b1');

    expect(prisma.subscriptionPlanCheckout.findMany.mock.calls[0][0].where).toMatchObject({ status: 'PENDING', businessId: 'b1' });
    expect(prisma.subscriptionPlanCheckout.updateMany).not.toHaveBeenCalled();
  });

  it('getForBusiness con un link pendiente le pregunta a MP antes de responder', async () => {
    const { service, prisma } = armar();
    prisma.subscriptionPlanCheckout.findFirst.mockResolvedValue({ id: 'chk-1' });
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    const rescatar = jest.spyOn(service, 'rescatarActivacionesPendientes').mockResolvedValue(0);

    await service.getForBusiness('b1');
    await service.getForBusiness('b1'); // dentro del minuto: no vuelve a consultar

    expect(rescatar).toHaveBeenCalledTimes(1);
    expect(rescatar).toHaveBeenCalledWith('b1');
  });

  it('getForBusiness responde igual si MP falla', async () => {
    const { service, prisma } = armar();
    prisma.subscriptionPlanCheckout.findFirst.mockResolvedValue({ id: 'chk-1' });
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    jest.spyOn(service, 'rescatarActivacionesPendientes').mockRejectedValue(new Error('mp caído'));

    await expect(service.getForBusiness('b1')).resolves.toMatchObject({ plan: 'mensual' });
  });
});
