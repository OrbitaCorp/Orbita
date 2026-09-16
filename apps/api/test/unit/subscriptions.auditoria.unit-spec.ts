import { ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { SubscriptionsController } from '../../src/subscriptions/subscriptions.controller';
import { PendingWizardDto } from '../../src/subscriptions/dto/start-pending-checkout.dto';
import { ConfirmSubscriptionDto } from '../../src/subscriptions/dto/confirm-subscription.dto';

// Auditoría interna 2026-09-10, ítem `api.subscriptions`.
//
// - Activar el plan tomaba el de la suscripción, no el autorizado en MP, y
//   una tienda suspendida por mora quedaba pausada con el plan ya pago.
// - El pago de bienvenida no se comparaba contra el monto esperado.
// - La contraseña del alta quedaba en claro en pending_signups.
// - El webhook procesaba sin MP_WEBHOOK_SECRET.
// - Cambiar de plan no dejaba rastro.

jest.setTimeout(30_000); // argon2 de verdad

const BIZ = 'biz-1';
const MENSUAL = { transaction_amount: 16500, frequency: 1, frequency_type: 'months', currency_id: 'ARS' };

function suscripciones(opts: { sub?: Record<string, unknown>; preapproval?: Record<string, unknown>; suspendidaPorAdmin?: boolean; secret?: string } = {}) {
  const sub = { id: 'sub-1', businessId: BIZ, origin: 'PAID', status: 'ACTIVE', plan: 'mensual', nextPlan: null, planActive: false, mpPreapprovalId: null, currentPeriodEnd: new Date(), ...opts.sub };
  const prisma = {
    subscription: { findUnique: jest.fn().mockResolvedValue(sub), update: jest.fn().mockResolvedValue({}) },
    business: { findUnique: jest.fn().mockResolvedValue({ subdomain: 'tienda' }), update: jest.fn().mockResolvedValue({}) },
    businessAddon: { upsert: jest.fn() },
    platformAdminLog: { findFirst: jest.fn().mockResolvedValue(opts.suspendidaPorAdmin ? { action: 'suspend_business' } : null) },
    pendingSignup: { findUnique: jest.fn(), create: jest.fn().mockResolvedValue({}) },
    platformDiscountCode: { findUnique: jest.fn() },
  };
  const config = { get: (k: string) => (k === 'MP_WEBHOOK_SECRET' ? opts.secret : undefined) };
  const onboarding = { checkEmail: jest.fn().mockResolvedValue({ available: true }), registerBusiness: jest.fn() };
  const businesses = { publish: jest.fn().mockResolvedValue({}) };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  // MailService va 7º y AuditService 8º (ver el constructor del service).
  const svc = new SubscriptionsService(prisma as any, config as any, onboarding as any, businesses as any, {} as any, {} as any, {} as any, audit as any);
  (svc as any)._preapproval = { get: jest.fn().mockResolvedValue({ status: 'authorized', external_reference: BIZ, auto_recurring: MENSUAL, ...opts.preapproval }) };
  return { svc, prisma, onboarding, audit };
}

describe('Activar el plan autorizado en Mercado Pago', () => {
  it('activa el plan de la preapproval aunque la suscripción diga otro (cambió de idea antes de autorizar)', async () => {
    const { svc, prisma, audit } = suscripciones({ sub: { plan: 'anual' } });
    const r = await svc.confirmPlanActivation('pre-1');
    expect(r).toMatchObject({ activated: true, plan: 'mensual' });
    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ plan: 'mensual', amount: 16500, planActive: true, mpPreapprovalId: 'pre-1' });
    // Un mes, no doce.
    expect(data.currentPeriodEnd.getTime() - data.currentPeriodStart.getTime()).toBeLessThan(32 * 86_400_000);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'subscription', action: 'ACTIVATE' }));
  });

  it('una preapproval que no coincide con ningún plan no activa nada', async () => {
    const { svc, prisma } = suscripciones({ preapproval: { auto_recurring: { ...MENSUAL, transaction_amount: 100 } } });
    await expect(svc.confirmPlanActivation('pre-1')).resolves.toMatchObject({ activated: false, status: 'plan_no_coincide' });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('suspendida por mora: al activar el plan la tienda vuelve al aire', async () => {
    const { svc, prisma } = suscripciones({ sub: { status: 'SUSPENDED' } });
    await svc.confirmPlanActivation('pre-1');
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: BIZ }, data: { isPaused: false } });
  });

  it('suspendida por el super admin: pagar el plan no la reabre', async () => {
    const { svc, prisma } = suscripciones({ sub: { status: 'SUSPENDED' }, suspendidaPorAdmin: true });
    await svc.confirmPlanActivation('pre-1');
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
});

describe('Alta paga', () => {
  it('pending_signups guarda el hash, nunca la contraseña', async () => {
    const { svc, prisma } = suscripciones();
    prisma.platformDiscountCode.findUnique.mockResolvedValue({ id: 'dc-1', code: 'GRATIS', isActive: true, expiresAt: null, maxUses: null, usedCount: 0, percentOff: 100 });
    await svc.startCheckoutPending({
      account: { email: 'ana@x.com', password: 'ClaveSegura123', businessName: 'Tienda', ownerName: 'Ana' } as any,
      wizard: {}, plan: 'mensual', discountCode: 'gratis',
    });
    const payload = prisma.pendingSignup.create.mock.calls[0][0].data.payload;
    expect(payload.account.password).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('ClaveSegura123');
    expect(payload.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('pago de bienvenida por menos de lo esperado: no se crea la cuenta', async () => {
    const { svc, prisma, onboarding } = suscripciones();
    prisma.pendingSignup.findUnique.mockResolvedValue({ payload: { account: { email: 'ana@x.com' }, passwordHash: 'h', wizard: {}, plan: 'mensual' } });
    (svc as any)._payment = { search: jest.fn().mockResolvedValue({ results: [{ id: 9, status: 'approved', transaction_amount: 15, currency_id: 'ARS' }] }) };
    await expect(svc.confirmAndCreate('PEND-abc')).resolves.toMatchObject({ activated: false, status: 'monto_no_coincide' });
    expect(onboarding.registerBusiness).not.toHaveBeenCalled();
  });

  it('pago de bienvenida completo: registra el negocio con el hash guardado', async () => {
    const { svc, prisma, onboarding } = suscripciones();
    prisma.pendingSignup.findUnique.mockResolvedValue({ payload: { account: { email: 'ana@x.com' }, passwordHash: 'hash-guardado', wizard: {}, plan: 'mensual' } });
    (svc as any)._payment = { search: jest.fn().mockResolvedValue({ results: [{ id: 9, status: 'approved', transaction_amount: 5500, currency_id: 'ARS' }] }) };
    onboarding.registerBusiness.mockRejectedValue(new Error('corta acá'));
    await svc.confirmAndCreate('PEND-abc').catch(() => undefined);
    expect(onboarding.registerBusiness).toHaveBeenCalledWith({ email: 'ana@x.com' }, 'hash-guardado');
  });
});

// Bug encontrado el 16/09 al investigar "después de crear la cuenta me manda
// al login en vez de al panel", reportado para los dos flujos (pago real y
// alta gratis por código del 100%): registerBusiness() arma el negocio con
// un subdominio AUTO-GENERADO; el updateDraft() de más abajo en
// confirmAndCreate() lo cambia al que el dueño eligió en el wizard, pero la
// respuesta seguía devolviendo el auto-generado (la variable `business`
// nunca se refrescaba). La pantalla de vuelta mandaba a irAlPanel() hacia un
// subdominio que YA NO era el del negocio, y /api/auth/refresh lo rebotaba
// al login (RBT-660, WRONG_TENANT) — justo después de haberse creado la
// cuenta con éxito.
function altaCompleta(opts: { wizardSubdominio?: string; updateDraftFalla?: boolean } = {}) {
  const prisma = {
    pendingSignup: {
      findUnique: jest.fn().mockResolvedValue({
        payload: {
          account: { email: 'ana@x.com', businessName: 'Tienda de Ana' },
          passwordHash: 'hash-guardado',
          wizard: { subdominio: opts.wizardSubdominio ?? 'tienda-de-ana' },
          plan: 'mensual',
        },
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    subscription: { upsert: jest.fn().mockResolvedValue({}) },
    businessAddon: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const onboarding = {
    registerBusiness: jest.fn().mockResolvedValue({
      // El auto-generado de generateUniqueSubdomain() — nunca el elegido.
      business: { id: BIZ, subdomain: 'tienda-de-ana-f3a9c1' },
      member: { id: 'member-1' },
      branch: { id: 'branch-1' },
    }),
    updateDraft: opts.updateDraftFalla
      ? jest.fn().mockRejectedValue(new Error('Ese subdominio ya está en uso'))
      // El subdominio elegido YA aplicado — esto es lo que devuelve
      // prisma.business.update() de verdad, el mismo objeto Business.
      : jest.fn().mockResolvedValue({ id: BIZ, subdomain: opts.wizardSubdominio ?? 'tienda-de-ana' }),
  };
  const businesses = { updateConfig: jest.fn().mockResolvedValue({}), publish: jest.fn().mockResolvedValue({}) };
  const auth = { issueSession: jest.fn().mockResolvedValue({ token: 'acc-1', refreshToken: 'ref-1' }) };
  // Sin esto, bienvenidaParaPlan()/this.currency (que corren SIEMPRE, no solo
  // en el camino pago) revientan con "config.get is not a function".
  const config = { get: () => undefined };
  const svc = new SubscriptionsService(prisma as any, config as any, onboarding as any, businesses as any, {} as any, auth as any, {} as any);
  // Solo lo usa el camino PAGO (esGratis=false busca el pago real por
  // external_reference) — un ref FREE- nunca llega a tocar esto. 5.500 es
  // BIENVENIDA_TIERS.base.amount, lo que confirmAndCreate espera cobrado
  // para el plan 'mensual' de este mock.
  (svc as any)._payment = { search: jest.fn().mockResolvedValue({ results: [{ id: 9, status: 'approved', transaction_amount: 5500, currency_id: 'ARS' }] }) };
  return { svc, prisma, onboarding, businesses };
}

describe('Alta — subdominio en la respuesta (bug del 16/09)', () => {
  it('con el subdominio elegido disponible, la respuesta trae ESE subdominio, no el auto-generado', async () => {
    const { svc, onboarding } = altaCompleta({ wizardSubdominio: 'tienda-de-ana' });
    const r = await svc.confirmAndCreate('PEND-abc');
    expect(r).toMatchObject({ activated: true, subdomain: 'tienda-de-ana', businessId: BIZ });
    expect(onboarding.updateDraft).toHaveBeenCalledWith(BIZ, expect.objectContaining({ subdomain: 'tienda-de-ana' }));
  });

  it('mismo caso para un alta gratis (FREE-...), no solo la pagada', async () => {
    const { svc } = altaCompleta({ wizardSubdominio: 'otra-tienda' });
    const r = await svc.confirmAndCreate('FREE-xyz');
    expect(r).toMatchObject({ activated: true, subdomain: 'otra-tienda', free: true });
  });

  it('si el subdominio elegido ya estaba tomado, se devuelve el auto-generado (el que de verdad quedó)', async () => {
    const { svc } = altaCompleta({ updateDraftFalla: true });
    const r = await svc.confirmAndCreate('PEND-abc');
    expect(r).toMatchObject({ activated: true, subdomain: 'tienda-de-ana-f3a9c1' });
  });
});

describe('Webhook, cambios de plan y entradas', () => {
  it('webhook sin MP_WEBHOOK_SECRET: 503', async () => {
    const { svc } = suscripciones();
    await expect(svc.handleWebhook({ type: 'payment', data: { id: '1' } })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('cambiar de plan queda registrado con quién', async () => {
    const { svc, audit } = suscripciones();
    await svc.changePlan(BIZ, 'anual', 'm-1');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ memberId: 'm-1', action: 'UPDATE', changes: [{ field: 'plan', before: 'mensual', after: 'anual' }] }));
  });

  it('la paginación del historial de cobros está acotada', () => {
    const svc = { getPayments: jest.fn() };
    const ctrl = new SubscriptionsController(svc as any);
    ctrl.payments({ type: 'member', businessId: BIZ, memberId: 'm-1' } as any, 'abc', '1000000');
    expect(svc.getPayments).toHaveBeenCalledWith(BIZ, 1, 100);
  });

  it('el wizard tiene topes y el logo tiene que ser una imagen', async () => {
    const errores = async (body: object) => (await validate(plainToInstance(PendingWizardDto, body))).map((e) => e.property);
    expect(await errores({ pagos: ['efectivo', 'mercadopago'], logoDataUrl: 'data:image/png;base64,AAAA' })).toEqual([]);
    expect(await errores({ pagos: ['bitcoin'] })).toContain('pagos');
    expect(await errores({ logoDataUrl: 'data:text/html;base64,PHNjcmlwdD4=' })).toContain('logoDataUrl');
    expect(await errores({ descripcion: 'x'.repeat(2001) })).toContain('descripcion');
    expect((await validate(plainToInstance(ConfirmSubscriptionDto, { preapprovalId: '../../x' }))).length).toBeGreaterThan(0);
  });
});
