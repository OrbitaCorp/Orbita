import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';

// Código de descuento al ACTIVAR el plan (Configuración → Suscripción): vale
// solo para el primer cobro. La preapproval de MP se crea con el monto rebajado
// y, registrado ese primer cobro, se le devuelve el precio de lista.

const LISTA_MENSUAL = 16500;

function armar() {
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    platformDiscountRedemption: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    subscription: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    subscriptionActivationDiscount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    subscriptionPayment: { count: jest.fn() },
    platformDiscountCode: { findUnique: jest.fn() },
    member: { findUnique: jest.fn().mockResolvedValue({ email: 'dueña@x.com' }), findFirst: jest.fn().mockResolvedValue({ email: 'dueña@x.com' }) },
    business: { findUnique: jest.fn().mockResolvedValue({ subdomain: 'tienda' }) },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
  };
  const cfg: any = { get: jest.fn((k: string) => ({ MP_ACCESS_TOKEN: 'tok', FRONTEND_URL: 'https://orbita.site' } as Record<string, string>)[k]) };
  const mail: any = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const businesses: any = { publish: jest.fn().mockResolvedValue({}) };
  const service = new SubscriptionsService(prisma, cfg, {} as any, businesses, {} as any, {} as any, mail);
  const preapproval = {
    create: jest.fn().mockResolvedValue({ id: 'PRE-1', init_point: 'https://mp/pagar' }),
    update: jest.fn().mockResolvedValue({}),
    get: jest.fn(),
  };
  (service as any)._preapproval = preapproval;
  jest.spyOn(service as any, 'syncAddonAvanzado').mockResolvedValue(undefined);
  jest.spyOn(service as any, 'notificarReactivacion').mockResolvedValue(undefined);
  return { service, prisma, tx, preapproval, mail };
}

const subVencida = (extra: Record<string, unknown> = {}) => ({
  id: 'sub1',
  businessId: 'b1',
  plan: 'mensual',
  nextPlan: null,
  origin: 'PAID',
  status: 'ACTIVE',
  planActive: false,
  mpPreapprovalId: null,
  currentPeriodEnd: new Date(Date.now() - 86_400_000),
  ...extra,
});

const codigo = (percentOff: number) => ({ id: 'code1', code: 'PRUEBA', percentOff, isActive: true, expiresAt: null, maxUses: 5, usedCount: 0 });

describe('activatePlan con código de descuento', () => {
  it('le manda a MP el monto rebajado y deja anotado el precio de lista', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.platformDiscountCode.findUnique.mockResolvedValue(codigo(99));

    const r = await service.activatePlan('b1', 'm1', 'prueba');

    expect(r.initPoint).toBe('https://mp/pagar');
    expect(preapproval.create.mock.calls[0][0].body.auto_recurring.transaction_amount).toBe(165);
    const fila = prisma.subscriptionActivationDiscount.create.mock.calls[0][0].data;
    expect(fila).toMatchObject({ businessId: 'b1', preapprovalId: 'PRE-1', codeId: 'code1', plan: 'mensual' });
    expect(Number(fila.amountList)).toBe(LISTA_MENSUAL);
    expect(Number(fila.amountFinal)).toBe(165);
  });

  it('sin código cobra el precio de lista y no guarda ningún descuento', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());

    await service.activatePlan('b1', 'm1');

    expect(preapproval.create.mock.calls[0][0].body.auto_recurring.transaction_amount).toBe(LISTA_MENSUAL);
    expect(prisma.subscriptionActivationDiscount.create).not.toHaveBeenCalled();
  });

  it('rechaza un código del 100%: es un alta gratis, no un descuento sobre el plan', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.platformDiscountCode.findUnique.mockResolvedValue({ ...codigo(100), expiresAt: new Date(Date.now() + 86_400_000) });

    await expect(service.activatePlan('b1', 'm1', 'prueba')).rejects.toBeInstanceOf(BadRequestException);
    expect(preapproval.create).not.toHaveBeenCalled();
  });

  it('rechaza un código que no existe sin llamar a MP', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.platformDiscountCode.findUnique.mockResolvedValue(null);

    await expect(service.activatePlan('b1', 'm1', 'nada')).rejects.toBeInstanceOf(BadRequestException);
    expect(preapproval.create).not.toHaveBeenCalled();
  });

  it('cierra los descuentos que habían quedado a medias de una activación anterior', async () => {
    const { service, prisma } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());

    await service.activatePlan('b1', 'm1');

    expect(prisma.subscriptionActivationDiscount.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'b1', status: { in: ['PENDING', 'ACTIVE', 'PAID'] } },
      data: { status: 'CLOSED' },
    });
  });
});

describe('previewActivationDiscount', () => {
  it('calcula contra el precio de lista del plan, no contra el de bienvenida', async () => {
    const { service, prisma } = armar();
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.platformDiscountCode.findUnique.mockResolvedValue(codigo(50));

    const r = await service.previewActivationDiscount('b1', 'prueba');

    expect(r).toMatchObject({ code: 'PRUEBA', percentOff: 50, amountBase: LISTA_MENSUAL, amountFinal: 8250, currency: 'ARS' });
  });
});

describe('confirmPlanActivation con descuento', () => {
  const preapprovalAutorizada = (monto: number) => ({
    status: 'authorized',
    external_reference: 'b1',
    auto_recurring: { transaction_amount: monto, frequency: 1, frequency_type: 'months', currency_id: 'ARS' },
  });
  const fila = (extra: Record<string, unknown> = {}) => ({
    id: 'd1', businessId: 'b1', preapprovalId: 'PRE-1', codeId: 'code1', plan: 'mensual',
    amountList: 16500, amountFinal: 165, status: 'PENDING', createdAt: new Date(), ...extra,
  });

  it('reconoce el monto rebajado, activa el plan, pasa la fila a ACTIVE y consume el uso del código', async () => {
    const { service, prisma, tx, preapproval } = armar();
    preapproval.get.mockResolvedValue(preapprovalAutorizada(165));
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.subscriptionActivationDiscount.findUnique.mockResolvedValue(fila());

    const r = await service.confirmPlanActivation('PRE-1');

    expect(r).toMatchObject({ activated: true, plan: 'mensual' });
    expect(prisma.subscription.update.mock.calls[0][0].data).toMatchObject({ plan: 'mensual', planActive: true, mpPreapprovalId: 'PRE-1', amount: 165 });
    expect(prisma.subscriptionActivationDiscount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.platformDiscountRedemption.create.mock.calls[0][0].data).toMatchObject({ codeId: 'code1', businessId: 'b1' });
  });

  it('no consume el código dos veces si la confirmación llega repetida', async () => {
    const { service, prisma, tx, preapproval } = armar();
    preapproval.get.mockResolvedValue(preapprovalAutorizada(165));
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.subscriptionActivationDiscount.findUnique.mockResolvedValue(fila({ status: 'ACTIVE' }));

    await service.confirmPlanActivation('PRE-1');

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('un monto raro sin fila de descuento sigue sin activar nada', async () => {
    const { service, prisma, preapproval } = armar();
    preapproval.get.mockResolvedValue(preapprovalAutorizada(165));
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.subscriptionActivationDiscount.findUnique.mockResolvedValue(null);

    const r = await service.confirmPlanActivation('PRE-1');

    expect(r).toEqual({ activated: false, status: 'plan_no_coincide' });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('el precio de lista sin descuento se activa como siempre', async () => {
    const { service, prisma, preapproval } = armar();
    preapproval.get.mockResolvedValue(preapprovalAutorizada(LISTA_MENSUAL));
    prisma.subscription.findUnique.mockResolvedValue(subVencida());
    prisma.subscriptionActivationDiscount.findUnique.mockResolvedValue(null);

    const r = await service.confirmPlanActivation('PRE-1');

    expect(r).toMatchObject({ activated: true, plan: 'mensual' });
    expect(prisma.subscription.update.mock.calls[0][0].data.amount).toBe(LISTA_MENSUAL);
  });
});

describe('devolver el precio de lista tras el primer cobro', () => {
  const fila = (status: string) => ({
    id: 'd1', businessId: 'b1', preapprovalId: 'PRE-1', codeId: 'code1', plan: 'mensual',
    amountList: 16500, amountFinal: 165, chargesTotal: 1, status, createdAt: new Date(Date.now() - 3600_000),
  });

  it('con el primer cobro aprobado, le devuelve a MP el precio de lista y deja la fila en RESTORED', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscriptionActivationDiscount.findFirst.mockResolvedValue(fila('ACTIVE'));
    // Prisma devuelve la fila COMPLETA tras un update, no solo lo que se cambió.
    prisma.subscriptionActivationDiscount.update.mockImplementation(({ data }: any) => Promise.resolve({ ...fila('ACTIVE'), ...data }));
    prisma.subscriptionPayment.count.mockResolvedValue(1);

    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');

    expect(preapproval.update).toHaveBeenCalledWith({
      id: 'PRE-1',
      body: { auto_recurring: { transaction_amount: 16500, currency_id: 'ARS' } },
    });
    const estados = prisma.subscriptionActivationDiscount.update.mock.calls.map((c: any) => c[0].data.status);
    expect(estados).toEqual(['PAID', 'RESTORED']);
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'b1', mpPreapprovalId: 'PRE-1' },
      data: { amount: 16500 },
    });
  });

  it('sin cobro aprobado todavía no toca el precio', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscriptionActivationDiscount.findFirst.mockResolvedValue(fila('ACTIVE'));
    prisma.subscriptionPayment.count.mockResolvedValue(0);

    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');

    expect(preapproval.update).not.toHaveBeenCalled();
    expect(prisma.subscriptionActivationDiscount.update).not.toHaveBeenCalled();
  });

  it('si MP rechaza el cambio, la fila queda en PAID para reintentar y NO se da por restaurada', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscriptionActivationDiscount.findFirst.mockResolvedValue(fila('PAID'));
    preapproval.update.mockRejectedValue(new Error('mp caído'));

    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');

    expect(prisma.subscriptionActivationDiscount.update).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });
});

describe('reconciliarDescuentosDeActivacion (barrido nocturno)', () => {
  const hace = (ms: number) => new Date(Date.now() - ms);
  const DIA = 86_400_000;

  it('cierra el link que nunca se pagó (más de 7 días) y el de una suscripción cancelada', async () => {
    const { service, prisma } = armar();
    prisma.subscriptionActivationDiscount.findMany.mockResolvedValue([
      { id: 'a', businessId: 'b1', preapprovalId: 'P-A', status: 'PENDING', createdAt: hace(8 * DIA) },
      { id: 'b', businessId: 'b2', preapprovalId: 'P-B', status: 'ACTIVE', createdAt: hace(DIA) },
    ]);
    prisma.subscription.findUnique
      .mockResolvedValueOnce({ status: 'ACTIVE', mpPreapprovalId: null })
      .mockResolvedValueOnce({ status: 'CANCELLED', mpPreapprovalId: 'P-B' });

    await service.reconciliarDescuentosDeActivacion();

    const cerradas = prisma.subscriptionActivationDiscount.update.mock.calls.filter((c: any) => c[0].data.status === 'CLOSED').map((c: any) => c[0].where.id);
    expect(cerradas).toEqual(['a', 'b']);
  });

  it('avisa por mail si una fila lleva más de un día sin poder devolver el precio de lista', async () => {
    const { service, prisma, preapproval, mail } = armar();
    const fila = { id: 'c', businessId: 'b3', preapprovalId: 'P-C', codeId: 'code1', plan: 'mensual', amountList: 16500, amountFinal: 165, status: 'PAID', createdAt: hace(3 * DIA) };
    prisma.subscriptionActivationDiscount.findMany.mockResolvedValue([fila]);
    prisma.subscriptionActivationDiscount.findFirst
      .mockResolvedValueOnce(fila) // avanzarDescuentoDeActivacion
      .mockResolvedValueOnce({ status: 'PAID', updatedAt: hace(2 * DIA) }); // relectura
    prisma.subscription.findUnique.mockResolvedValue({ status: 'ACTIVE', mpPreapprovalId: 'P-C' });
    preapproval.update.mockRejectedValue(new Error('mp caído'));

    await service.reconciliarDescuentosDeActivacion();

    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendCustomEmail.mock.calls[0][2]).toContain('b3');
  });

  it('sin MercadoPago configurado (dev) no hace nada', async () => {
    const { service, prisma } = armar();
    (service as any).config.get = jest.fn(() => undefined);

    await service.reconciliarDescuentosDeActivacion();

    expect(prisma.subscriptionActivationDiscount.findMany).not.toHaveBeenCalled();
  });
});
