import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';

// Campañas de precio congelado (2026-10): "los primeros N comercios pagan $X
// por mes durante M meses, después el precio de lista". Reemplazan al beneficio
// de bienvenida fijo. Estos tests fijan qué se cobra en el alta con y sin
// campaña, qué queda guardado en la suscripción, y que el débito automático
// sale al precio congelado solo por los cobros que correspondan.

const LISTA_BASE = 16500;
const LISTA_AVANZADO = 21700;

const campania = (extra: Record<string, unknown> = {}) => ({
  id: 'camp-1',
  name: 'Primeros 30',
  code: null,
  isActive: true,
  priceBase: 10000,
  priceAdvanced: 10000,
  months: 3,
  maxSlots: 30,
  usedSlots: 4,
  startsAt: null,
  endsAt: null,
  createdAt: new Date('2026-10-01'),
  ...extra,
});

function armar() {
  const prisma: any = {
    priceCampaign: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    platformDiscountCode: { findUnique: jest.fn().mockResolvedValue(null) },
    pendingSignup: { findUnique: jest.fn(), create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    subscription: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    subscriptionActivationDiscount: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...filaCongelada('ACTIVE'), ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    subscriptionPayment: { count: jest.fn() },
    member: { findUnique: jest.fn().mockResolvedValue({ email: 'ana@x.com' }) },
  };
  const cfg: any = { get: jest.fn((k: string) => ({ MP_ACCESS_TOKEN: 'tok', FRONTEND_URL: 'https://orbita.site' } as Record<string, string>)[k]) };
  const onboarding: any = {
    checkEmail: jest.fn().mockResolvedValue({ available: true }),
    registerBusiness: jest.fn().mockResolvedValue({ business: { id: 'b1', subdomain: 'auto' }, member: { id: 'm1' }, branch: { id: 'br1' } }),
    updateDraft: jest.fn().mockResolvedValue({ subdomain: 'tienda' }),
  };
  const businesses: any = { updateConfig: jest.fn().mockResolvedValue({}), publish: jest.fn().mockResolvedValue({}) };
  const auth: any = { issueSession: jest.fn().mockResolvedValue({ token: 't', refreshToken: 'r' }) };
  const service = new SubscriptionsService(prisma, cfg, onboarding, businesses, {} as any, auth, {} as any);
  const preference = { create: jest.fn().mockResolvedValue({ id: 'PREF-1', init_point: 'https://mp/pagar' }) };
  const preapproval = { create: jest.fn().mockResolvedValue({ id: 'PRE-1', init_point: 'https://mp/debito' }), update: jest.fn().mockResolvedValue({}) };
  (service as any)._preference = preference;
  (service as any)._preapproval = preapproval;
  jest.spyOn(service as any, 'syncAddonAvanzado').mockResolvedValue(undefined);
  return { service, prisma, preference, preapproval };
}

const alta = (extra: Record<string, unknown> = {}) => ({
  account: { email: 'ana@x.com', password: 'ClaveSegura123', businessName: 'Tienda', ownerName: 'Ana' } as any,
  wizard: {},
  plan: 'mensual' as const,
  ...extra,
});

const cobrado = (preference: { create: jest.Mock }) => preference.create.mock.calls[0][0].body.items[0].unit_price;
const guardado = (prisma: any) => prisma.pendingSignup.create.mock.calls[0][0].data.payload;

function filaCongelada(status: string) {
  return {
    id: 'd1', businessId: 'b1', preapprovalId: 'PRE-1', codeId: null, campaignId: 'camp-1', plan: 'mensual',
    amountList: LISTA_BASE, amountFinal: 10000, chargesTotal: 2, status, createdAt: new Date(Date.now() - 3600_000),
  };
}

describe('alta sin campaña', () => {
  it('cobra el primer mes a precio de lista y no anota ninguna campaña', async () => {
    const { service, prisma, preference } = armar();
    await service.startCheckoutPending(alta());
    expect(cobrado(preference)).toBe(LISTA_BASE);
    expect(guardado(prisma).primerCobro).toMatchObject({ amount: LISTA_BASE, frequency: 1, frequencyType: 'months' });
    expect(guardado(prisma).campaign).toBeUndefined();
  });

  it('Base + Avanzado paga su propio precio de lista', async () => {
    const { service, preference } = armar();
    await service.startCheckoutPending(alta({ plan: 'mensualAvanzado' }));
    expect(cobrado(preference)).toBe(LISTA_AVANZADO);
  });
});

describe('alta con campaña pública', () => {
  it('cobra el precio congelado sin que nadie escriba un código', async () => {
    const { service, prisma, preference } = armar();
    prisma.priceCampaign.findMany.mockResolvedValue([campania()]);
    await service.startCheckoutPending(alta());
    expect(cobrado(preference)).toBe(10000);
    expect(guardado(prisma).campaign).toEqual({ id: 'camp-1', name: 'Primeros 30', frozenAmount: 10000, months: 3 });
  });

  it.each([
    ['sin lugares', { usedSlots: 30 }],
    ['vencida', { endsAt: new Date(Date.now() - 1000) }],
    ['que todavía no empezó', { startsAt: new Date(Date.now() + 86_400_000) }],
  ])('una campaña %s no se aplica: se cobra lista', async (_nombre, extra) => {
    const { service, prisma, preference } = armar();
    prisma.priceCampaign.findMany.mockResolvedValue([campania(extra)]);
    await service.startCheckoutPending(alta());
    expect(cobrado(preference)).toBe(LISTA_BASE);
    expect(guardado(prisma).campaign).toBeUndefined();
  });

  it('un código de descuento se aplica sobre el precio congelado del primer mes', async () => {
    const { service, prisma, preference } = armar();
    prisma.priceCampaign.findMany.mockResolvedValue([campania()]);
    prisma.platformDiscountCode.findUnique.mockResolvedValue({ id: 'dc', code: 'MITAD', percentOff: 50, isActive: true, expiresAt: null, maxUses: null, usedCount: 0, includesAdvancedAddon: false });
    await service.startCheckoutPending(alta({ discountCode: 'mitad' }));
    expect(cobrado(preference)).toBe(5000);
    expect(guardado(prisma).campaign).toMatchObject({ frozenAmount: 10000 });
  });

  it('un alta gratis (código del 100%) no entra a la campaña ni gasta un lugar', async () => {
    const { service, prisma, preference } = armar();
    prisma.priceCampaign.findMany.mockResolvedValue([campania()]);
    prisma.platformDiscountCode.findUnique.mockResolvedValue({ id: 'dc', code: 'GRATIS', percentOff: 100, isActive: true, expiresAt: new Date(Date.now() + 86_400_000), maxUses: 1, usedCount: 0, includesAdvancedAddon: true });
    const r = await service.startCheckoutPending(alta({ discountCode: 'gratis' }));
    expect(r.free).toBe(true);
    expect(preference.create).not.toHaveBeenCalled();
    expect(guardado(prisma).campaign).toBeUndefined();
  });

  it('la oferta pública informa precio, meses y lugares que quedan', async () => {
    const { service, prisma } = armar();
    prisma.priceCampaign.findMany.mockResolvedValue([campania()]);
    await expect(service.ofertaPublica()).resolves.toEqual({
      currency: 'ARS',
      list: { base: LISTA_BASE, avanzado: LISTA_AVANZADO },
      campaign: { name: 'Primeros 30', priceBase: 10000, priceAdvanced: 10000, months: 3, maxSlots: 30, slotsLeft: 26, endsAt: null },
    });
  });

  it('sin campaña vigente la oferta pública es solo la lista', async () => {
    const { service } = armar();
    await expect(service.ofertaPublica()).resolves.toMatchObject({ campaign: null, list: { base: LISTA_BASE } });
  });
});

describe('campaña privada (cortesía con código)', () => {
  const privada = (extra: Record<string, unknown> = {}) => campania({ id: 'camp-2', name: 'Cortesía', code: 'AMIGOS', maxSlots: 5, usedSlots: 0, ...extra });

  it('el código da el precio congelado aunque no haya ninguna campaña pública', async () => {
    const { service, prisma, preference } = armar();
    prisma.priceCampaign.findUnique.mockResolvedValue(privada());
    await service.startCheckoutPending(alta({ discountCode: ' amigos ' }));
    expect(prisma.priceCampaign.findUnique).toHaveBeenCalledWith({ where: { code: 'AMIGOS' } });
    expect(cobrado(preference)).toBe(10000);
    expect(guardado(prisma).campaign).toMatchObject({ id: 'camp-2' });
    // No se lo trata además como código de descuento.
    expect(prisma.platformDiscountCode.findUnique).not.toHaveBeenCalled();
  });

  it('gana sobre la campaña pública', async () => {
    const { service, prisma } = armar();
    prisma.priceCampaign.findMany.mockResolvedValue([campania()]);
    prisma.priceCampaign.findUnique.mockResolvedValue(privada({ priceBase: 8000 }));
    await service.startCheckoutPending(alta({ discountCode: 'AMIGOS' }));
    expect(guardado(prisma).campaign).toMatchObject({ id: 'camp-2', frozenAmount: 8000 });
  });

  it('agotada o apagada: rechaza el alta en vez de cobrar lista callado', async () => {
    const { service, prisma, preference } = armar();
    prisma.priceCampaign.findUnique.mockResolvedValue(privada({ usedSlots: 5 }));
    await expect(service.startCheckoutPending(alta({ discountCode: 'AMIGOS' }))).rejects.toBeInstanceOf(BadRequestException);
    prisma.priceCampaign.findUnique.mockResolvedValue(privada({ isActive: false }));
    await expect(service.startCheckoutPending(alta({ discountCode: 'AMIGOS' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(preference.create).not.toHaveBeenCalled();
  });

  it('la previsualización del código dice el precio y por cuántos meses', async () => {
    const { service, prisma } = armar();
    prisma.priceCampaign.findUnique.mockResolvedValue(privada());
    await expect(service.previewDiscount('AMIGOS', 'mensualAvanzado')).resolves.toEqual({
      code: 'AMIGOS', percentOff: 54, amountBase: LISTA_AVANZADO, amountFinal: 10000, currency: 'ARS', frozenMonths: 3,
    });
  });
});

describe('confirmar el alta', () => {
  const pagoAprobado = (service: SubscriptionsService, monto: number) => {
    (service as any)._payment = { search: jest.fn().mockResolvedValue({ results: [{ id: 9, status: 'approved', transaction_amount: monto, currency_id: 'ARS' }] }) };
  };
  const payload = (extra: Record<string, unknown> = {}) => ({
    payload: {
      account: { email: 'ana@x.com' }, passwordHash: 'h', wizard: {}, plan: 'mensual',
      primerCobro: { amount: 10000, frequency: 1, frequencyType: 'months', currency: 'ARS' },
      campaign: { id: 'camp-1', name: 'Primeros 30', frozenAmount: 10000, months: 3 },
      ...extra,
    },
  });
  const dias = (data: { currentPeriodStart: Date; currentPeriodEnd: Date }) =>
    Math.round((data.currentPeriodEnd.getTime() - data.currentPeriodStart.getTime()) / 86_400_000);

  it('con campaña: un mes pago, quedan 2 cobros congelados y ocupa un lugar', async () => {
    const { service, prisma } = armar();
    prisma.pendingSignup.findUnique.mockResolvedValue(payload());
    pagoAprobado(service, 10000);

    const r = await service.confirmAndCreate('PEND-1');

    expect(r).toMatchObject({ activated: true, frozen: { amount: 10000, months: 3 } });
    const creada = prisma.subscription.upsert.mock.calls[0][0].create;
    expect(creada).toMatchObject({ plan: 'mensual', planActive: false, amount: 10000, campaignId: 'camp-1', frozenChargesLeft: 2 });
    expect(Number(creada.frozenAmount)).toBe(10000);
    expect(dias(creada)).toBeLessThanOrEqual(31);
    expect(prisma.priceCampaign.update).toHaveBeenCalledWith({ where: { id: 'camp-1' }, data: { usedSlots: { increment: 1 } } });
  });

  it('con campaña: si MP cobró menos que el precio congelado no se crea la cuenta', async () => {
    const { service, prisma } = armar();
    prisma.pendingSignup.findUnique.mockResolvedValue(payload());
    pagoAprobado(service, 5500);
    await expect(service.confirmAndCreate('PEND-1')).resolves.toMatchObject({ activated: false, status: 'monto_no_coincide' });
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('sin campaña: un mes a precio de lista, sin nada congelado', async () => {
    const { service, prisma } = armar();
    prisma.pendingSignup.findUnique.mockResolvedValue(payload({ campaign: undefined, primerCobro: { amount: LISTA_BASE, frequency: 1, frequencyType: 'months', currency: 'ARS' } }));
    pagoAprobado(service, LISTA_BASE);

    await service.confirmAndCreate('PEND-1');

    const creada = prisma.subscription.upsert.mock.calls[0][0].create;
    expect(creada).toMatchObject({ amount: LISTA_BASE, planActive: false });
    expect(creada.campaignId).toBeUndefined();
    expect(creada.frozenChargesLeft).toBeUndefined();
    expect(dias(creada)).toBeLessThanOrEqual(31);
    expect(prisma.priceCampaign.update).not.toHaveBeenCalled();
  });

  it('un alta pedida antes del cambio (sin primerCobro) conserva la bienvenida de 3 meses', async () => {
    const { service, prisma } = armar();
    prisma.pendingSignup.findUnique.mockResolvedValue(payload({ campaign: undefined, primerCobro: undefined }));
    pagoAprobado(service, 5500);

    await service.confirmAndCreate('PEND-1');

    const creada = prisma.subscription.upsert.mock.calls[0][0].create;
    expect(creada.amount).toBe(5500);
    expect(dias(creada)).toBeGreaterThanOrEqual(89);
  });
});

describe('débito automático con precio congelado', () => {
  const sub = (extra: Record<string, unknown> = {}) => ({
    id: 'sub1', businessId: 'b1', plan: 'mensual', nextPlan: null, origin: 'PAID', status: 'ACTIVE', planActive: false,
    mpPreapprovalId: null, campaignId: 'camp-1', frozenAmount: 10000, frozenChargesLeft: 2,
    currentPeriodEnd: new Date(Date.now() - 86_400_000),
    ...extra,
  });

  it('la preapproval sale al precio congelado y anota cuántos cobros dura', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscription.findUnique.mockResolvedValue(sub());

    await service.activatePlan('b1', 'm1');

    expect(preapproval.create.mock.calls[0][0].body.auto_recurring).toMatchObject({ transaction_amount: 10000, frequency: 1, frequency_type: 'months' });
    const fila = prisma.subscriptionActivationDiscount.create.mock.calls[0][0].data;
    expect(fila).toMatchObject({ codeId: null, campaignId: 'camp-1', plan: 'mensual', chargesTotal: 2 });
    expect(Number(fila.amountList)).toBe(LISTA_BASE);
    expect(Number(fila.amountFinal)).toBe(10000);
  });

  it('no se combina con un código de descuento', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscription.findUnique.mockResolvedValue(sub());
    await expect(service.activatePlan('b1', 'm1', 'MITAD')).rejects.toBeInstanceOf(BadRequestException);
    expect(preapproval.create).not.toHaveBeenCalled();
  });

  it.each([
    ['ya no le quedan cobros congelados', { frozenChargesLeft: 0 }, LISTA_BASE],
    ['eligió el plan anual', { plan: 'anual' }, 156000],
  ])('si %s, sale a precio de lista', async (_nombre, extra, monto) => {
    const { service, prisma, preapproval } = armar();
    prisma.subscription.findUnique.mockResolvedValue(sub(extra));

    await service.activatePlan('b1', 'm1');

    expect(preapproval.create.mock.calls[0][0].body.auto_recurring.transaction_amount).toBe(monto);
    expect(prisma.subscriptionActivationDiscount.create).not.toHaveBeenCalled();
  });

  it('tras el primer cobro de dos: baja lo que queda y NO toca el precio en MP', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscriptionActivationDiscount.findFirst.mockResolvedValue(filaCongelada('ACTIVE'));
    prisma.subscriptionPayment.count.mockResolvedValue(1);

    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'b1', mpPreapprovalId: 'PRE-1' },
      data: { frozenChargesLeft: 1 },
    });
    expect(preapproval.update).not.toHaveBeenCalled();
    expect(prisma.subscriptionActivationDiscount.update).not.toHaveBeenCalled();
  });

  it('tras el último cobro congelado: le devuelve a MP el precio de lista', async () => {
    const { service, prisma, preapproval } = armar();
    prisma.subscriptionActivationDiscount.findFirst.mockResolvedValue(filaCongelada('ACTIVE'));
    prisma.subscriptionPayment.count.mockResolvedValue(2);

    await (service as any).avanzarDescuentoDeActivacion('d1', 'b1');

    expect(preapproval.update).toHaveBeenCalledWith({
      id: 'PRE-1',
      body: { auto_recurring: { transaction_amount: LISTA_BASE, currency_id: 'ARS' } },
    });
    expect(prisma.subscription.updateMany).toHaveBeenLastCalledWith({
      where: { businessId: 'b1', mpPreapprovalId: 'PRE-1' },
      data: { amount: LISTA_BASE, frozenChargesLeft: 0 },
    });
  });

  it('el panel ve cuánto paga y cuántos cobros congelados le quedan', async () => {
    const { service, prisma } = armar();
    prisma.subscription.findUnique.mockResolvedValue(sub({ amount: 10000, currency: 'ARS', currentPeriodStart: new Date(), gracePeriodDays: 7, grantReason: null }));
    await expect(service.getForBusiness('b1')).resolves.toMatchObject({ frozen: { amount: 10000, chargesLeft: 2 } });
  });
});
