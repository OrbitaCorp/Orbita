import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { PlatformService } from '../src/platform/platform.service';

// Precios de lista editables desde el superadmin (tabla plan_prices, 2026-10).
// Estos tests fijan que un precio guardado es el que se cobra de ahí en más,
// que quien autorizó su débito al precio viejo no queda afuera, y que el
// superadmin no puede guardar una combinación que rompa el cobro.

const fila = (plan: string, amount: number, minutos: number) => ({ plan, amount, createdAt: new Date(Date.UTC(2026, 9, 6, 12, minutos)) });

function armar(filas: { plan: string; amount: number }[] = []) {
  const prisma: any = {
    planPrice: { findMany: jest.fn().mockResolvedValue(filas) },
    priceCampaign: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    platformDiscountCode: { findUnique: jest.fn().mockResolvedValue(null) },
    pendingSignup: { create: jest.fn().mockResolvedValue({}) },
    subscription: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    subscriptionActivationDiscount: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    business: { findUnique: jest.fn().mockResolvedValue({ subdomain: 'tienda' }) },
    member: { findUnique: jest.fn().mockResolvedValue({ email: 'ana@x.com' }) },
  };
  const cfg: any = { get: jest.fn((k: string) => ({ MP_ACCESS_TOKEN: 'tok', FRONTEND_URL: 'https://orbita.site' } as Record<string, string>)[k]) };
  const onboarding: any = { checkEmail: jest.fn().mockResolvedValue({ available: true }) };
  const businesses: any = { publish: jest.fn().mockResolvedValue({}) };
  const service = new SubscriptionsService(prisma, cfg, onboarding, businesses, {} as any, {} as any, {} as any);
  const preference = { create: jest.fn().mockResolvedValue({ id: 'PREF-1', init_point: 'https://mp/pagar' }) };
  const preapproval = { create: jest.fn().mockResolvedValue({ id: 'PRE-1', init_point: 'https://mp/debito' }), get: jest.fn() };
  (service as any)._preference = preference;
  (service as any)._preapproval = preapproval;
  jest.spyOn(service as any, 'syncAddonAvanzado').mockResolvedValue(undefined);
  jest.spyOn(service as any, 'notificarReactivacion').mockResolvedValue(undefined);
  return { service, prisma, preference, preapproval };
}

const alta = (plan: 'mensual' | 'mensualAvanzado' = 'mensual') => ({
  account: { email: 'ana@x.com', password: 'ClaveSegura123', businessName: 'Tienda', ownerName: 'Ana' } as any,
  wizard: {},
  plan,
});
const cobrado = (preference: { create: jest.Mock }) => preference.create.mock.calls[0][0].body.items[0].unit_price;

describe('precios de lista vigentes', () => {
  it('con la tabla vacía son los de siempre', async () => {
    const { service } = armar();
    await expect(service.preciosVigentes()).resolves.toMatchObject({
      mensual: { amount: 16500, months: 1 },
      anualAvanzado: { amount: 205000, months: 12 },
    });
  });

  it('el vigente de un plan es su fila más nueva, y los demás no cambian', async () => {
    const { service } = armar([fila('mensual', 18000, 1), fila('mensual', 19900, 2)]);
    await expect(service.preciosVigentes()).resolves.toMatchObject({
      mensual: { amount: 19900, months: 1 },
      mensualAvanzado: { amount: 21700, months: 1 },
    });
  });

  it('el alta cobra el primer mes al precio nuevo', async () => {
    const { service, preference } = armar([fila('mensual', 19900, 1)]);
    await service.startCheckoutPending(alta());
    expect(cobrado(preference)).toBe(19900);
  });

  it('la oferta pública trae los seis planes, para que el frontend no los tenga escritos', async () => {
    const { service } = armar([fila('semestral', 95000, 1)]);
    const o = await service.ofertaPublica();
    expect(Object.keys(o.plans)).toHaveLength(6);
    expect(o.plans.semestral).toEqual({ amount: 95000, months: 6 });
    expect(o.list).toEqual({ base: 16500, avanzado: 21700 });
  });

  it('al activar el plan, el débito sale al precio nuevo', async () => {
    const { service, prisma, preapproval } = armar([fila('mensual', 19900, 1)]);
    prisma.subscription.findUnique.mockResolvedValue({
      id: 's1', businessId: 'b1', plan: 'mensual', nextPlan: null, origin: 'PAID', status: 'ACTIVE', planActive: false,
      mpPreapprovalId: null, frozenAmount: null, frozenChargesLeft: 0, currentPeriodEnd: new Date(Date.now() - 86_400_000),
    });
    await service.activatePlan('b1', 'm1');
    expect(preapproval.create.mock.calls[0][0].body.auto_recurring.transaction_amount).toBe(19900);
  });

  it('una campaña que quedó más cara que la lista no se aplica ni gasta un lugar', async () => {
    const { service, prisma, preference } = armar([fila('mensual', 9000, 1), fila('mensualAvanzado', 12000, 1)]);
    prisma.priceCampaign.findMany.mockResolvedValue([{
      id: 'c1', name: 'Vieja', code: null, isActive: true, priceBase: 10000, priceAdvanced: 10000, months: 3,
      maxSlots: null, usedSlots: 0, startsAt: null, endsAt: null,
    }]);
    await service.startCheckoutPending(alta());
    expect(cobrado(preference)).toBe(9000);
    expect(prisma.pendingSignup.create.mock.calls[0][0].data.payload.campaign).toBeUndefined();
    // Tampoco se anuncia: la landing tacharía un precio para mostrar uno más alto.
    await expect(service.ofertaPublica()).resolves.toMatchObject({ campaign: null });
  });
});

describe('un débito autorizado al precio de antes', () => {
  const autorizada = (monto: number) => ({
    status: 'authorized', external_reference: 'b1',
    auto_recurring: { transaction_amount: monto, frequency: 1, frequency_type: 'months', currency_id: 'ARS' },
  });
  const sub = { id: 's1', businessId: 'b1', plan: 'mensual', nextPlan: null, origin: 'PAID', status: 'ACTIVE', planActive: false, mpPreapprovalId: null };

  it('se activa igual, y queda pagando lo que aceptó', async () => {
    const { service, prisma, preapproval } = armar([fila('mensual', 19900, 1)]);
    prisma.subscription.findUnique.mockResolvedValue(sub);
    preapproval.get.mockResolvedValue(autorizada(16500));

    const r = await service.confirmPlanActivation('PRE-1');

    expect(r).toMatchObject({ activated: true, plan: 'mensual' });
    expect(prisma.subscription.update.mock.calls[0][0].data.amount).toBe(16500);
  });

  it('también con un precio intermedio que ya no es el vigente', async () => {
    const { service, prisma, preapproval } = armar([fila('mensual', 18000, 1), fila('mensual', 19900, 2)]);
    prisma.subscription.findUnique.mockResolvedValue(sub);
    preapproval.get.mockResolvedValue(autorizada(18000));
    await expect(service.confirmPlanActivation('PRE-1')).resolves.toMatchObject({ activated: true, plan: 'mensual' });
  });

  it('un monto que ningún plan tuvo nunca sigue sin activar nada', async () => {
    const { service, prisma, preapproval } = armar([fila('mensual', 19900, 1)]);
    prisma.subscription.findUnique.mockResolvedValue(sub);
    preapproval.get.mockResolvedValue(autorizada(100));
    await expect(service.confirmPlanActivation('PRE-1')).resolves.toMatchObject({ activated: false, status: 'plan_no_coincide' });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});

describe('guardar precios desde el superadmin', () => {
  const VIGENTES = {
    mensual: { amount: 16500, months: 1 }, semestral: { amount: 88000, months: 6 }, anual: { amount: 156000, months: 12 },
    mensualAvanzado: { amount: 21700, months: 1 }, semestralAvanzado: { amount: 116000, months: 6 }, anualAvanzado: { amount: 205000, months: 12 },
  };
  const DTO = { mensual: 16500, semestral: 88000, anual: 156000, mensualAvanzado: 21700, semestralAvanzado: 116000, anualAvanzado: 205000 };

  function plataforma(campaniasPrendidas: Record<string, unknown>[] = []) {
    const prisma: any = {
      planPrice: { createMany: jest.fn().mockReturnValue('alta-de-precios'), findFirst: jest.fn().mockResolvedValue(null) },
      platformAdminLog: { create: jest.fn().mockReturnValue('log') },
      priceCampaign: { findMany: jest.fn().mockResolvedValue(campaniasPrendidas) },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const subscriptions: any = {
      cargarPrecios: jest.fn().mockResolvedValue(undefined),
      preciosVigentes: jest.fn().mockResolvedValue(VIGENTES),
      preciosDeLista: () => ({ base: 16500, avanzado: 21700, minAmount: 15 }),
      preciosPorDefecto: () => DTO,
    };
    const service = new PlatformService(prisma, {} as any, subscriptions, {} as any);
    return { service, prisma, subscriptions };
  }

  it('guarda solo los planes que cambiaron, deja registro y refresca los precios', async () => {
    const { service, prisma, subscriptions } = plataforma();
    await service.updatePlanPrices('admin-1', { ...DTO, mensual: 19900 });

    const filas = prisma.planPrice.createMany.mock.calls[0][0].data;
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ plan: 'mensual', createdBy: 'admin-1' });
    expect(Number(filas[0].amount)).toBe(19900);
    expect(prisma.platformAdminLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'update_plan_prices',
      details: { mensual: { antes: 16500, despues: 19900 } },
    });
    expect(subscriptions.cargarPrecios).toHaveBeenCalledWith(true);
  });

  it('sin cambios no escribe nada', async () => {
    const { service, prisma } = plataforma();
    await service.updatePlanPrices('admin-1', DTO);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['Avanzado no puede costar igual o menos que Base', { ...DTO, mensualAvanzado: 16500 }],
    ['un anual más caro por mes que el mensual es un error de tipeo', { ...DTO, anual: 1560000 }],
    ['por debajo del mínimo de Mercado Pago', { ...DTO, mensual: 10 }],
  ])('rechaza: %s', async (_nombre, dto) => {
    const { service, prisma } = plataforma();
    await expect(service.updatePlanPrices('admin-1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza bajar la lista por debajo de una campaña prendida', async () => {
    const { service, prisma } = plataforma([{ name: 'Primeros 30', priceBase: 10000, priceAdvanced: 10000 }]);
    await expect(service.updatePlanPrices('admin-1', { ...DTO, mensual: 9900, semestral: 54000, anual: 96000 })).rejects.toThrow('Primeros 30');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
