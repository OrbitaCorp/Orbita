import { Prisma } from '@prisma/client';
import { MercadopagoService } from '../../src/mercadopago/mercadopago.service';
import { DomainsService } from '../../src/domains/domains.service';
import { DomainPurchaseService } from '../../src/domains/domain-purchase.service';
import { DiscountsService } from '../../src/discounts/discounts.service';
import { CouponsService } from '../../src/coupons/coupons.service';
import { CancellationsService } from '../../src/cancellations/cancellations.service';

// Hallazgo `auditoria-acciones-sin-registro` (MEDIA), parte 1 de 3.
//
// audit_logs se escribía solo desde productos, equipo, negocio, clientes y
// devoluciones. Conectar o desconectar Mercado Pago, vincular/borrar/comprar
// un dominio, dar de alta/editar/apagar/borrar descuentos y cupones, y
// aprobar/rechazar/reembolsar una cancelación no dejaban rastro. Acá se
// verifica que cada una registra con el entityType/action que corresponde,
// con el actor cuando lo hay (null en webhooks) y SIN tokens en los cambios.

const BIZ = 'biz-1';
const ACTOR = 'm-1';

// La respuesta de OAuth de MP se mockea con tokens reconocibles para poder
// afirmar que ninguno llega al registro.
const ACCESS = 'APP_USR-access-secreto';
const REFRESH = 'TG-refresh-secreto';
const mockOauthCreate = jest.fn();
jest.mock('mercadopago', () => {
  const real = jest.requireActual('mercadopago');
  return {
    ...real,
    OAuth: jest.fn().mockImplementation(() => ({
      // Devuelve el state tal cual para que el test lo pueda mandar al callback.
      getAuthorizationURL: ({ options }: { options: { state: string } }) => options.state,
      create: (...a: unknown[]) => mockOauthCreate(...a),
    })),
    User: jest.fn().mockImplementation(() => ({ get: () => Promise.resolve({ first_name: 'Ana', last_name: 'Paz' }) })),
  };
});

const auditMock = () => ({ registrar: jest.fn().mockResolvedValue(undefined) });
type AuditMock = ReturnType<typeof auditMock>;

const entradas = (audit: AuditMock) => audit.registrar.mock.calls.map((c) => c[0]);
const campos = (audit: AuditMock, n = 0) => (entradas(audit)[n].changes as { field: string }[]).map((c) => c.field);
// Nada de lo registrado puede oler a token o secreto, en ningún campo.
const sinSecretos = (audit: AuditMock) => {
  const todo = JSON.stringify(entradas(audit));
  expect(todo).not.toContain(ACCESS);
  expect(todo).not.toContain(REFRESH);
  expect(todo).not.toMatch(/access_token|refresh_token|public_key/);
};

// ── Mercado Pago ─────────────────────────────────────────────────────────────

const configMp = {
  getOrThrow: (k: string) => ({
    MERCADOPAGO_CLIENT_ID: 'client-id',
    MERCADOPAGO_CLIENT_SECRET: 'client-secret',
    MERCADOPAGO_REDIRECT_URI: 'https://api.orbita.site/api/v1/mercadopago/oauth/callback',
    MERCADOPAGO_TOKEN_KEY: 'token-key',
    JWT_SECRET: 'test-secret-de-al-menos-32-caracteres',
  })[k],
  get: () => undefined,
};

function mp(opts: { cred?: { mpUserId: string; isActive: boolean } | null; conectadas?: { businessId: string }[] } = {}) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue({ subdomain: 'tienda' }) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    mpCredentials: {
      findUnique: jest.fn().mockResolvedValue(opts.cred === undefined ? { mpUserId: '12345', isActive: true } : opts.cred),
      findMany: jest.fn().mockResolvedValue(opts.conectadas ?? [{ businessId: BIZ }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const audit = auditMock();
  const svc = new MercadopagoService(prisma as any, configMp as any, {} as any, {} as any, audit as any);
  return { svc, prisma, audit };
}

describe('Mercado Pago: conectar y desconectar la cuenta del comercio', () => {
  beforeEach(() => mockOauthCreate.mockReset().mockResolvedValue({ access_token: ACCESS, refresh_token: REFRESH, user_id: 12345, expires_in: 100, scope: 'read write' }));

  it('el callback registra ACTIVATE con el actor que apretó "Conectar" (viaja en el state firmado) y solo el user id de MP', async () => {
    const { svc, audit } = mp();
    const state = svc.getAuthorizationUrl(BIZ, ACTOR);
    await svc.handleCallback('code', state);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'mp_credentials', entityId: BIZ, action: 'ACTIVATE',
      changes: [{ field: 'mpUserId', before: null, after: '12345' }],
    });
    sinSecretos(audit);
  });

  it('un state emitido sin actor (anterior a este cambio) sigue andando y registra sin memberId', async () => {
    const { svc, audit } = mp();
    const state = svc.getAuthorizationUrl(BIZ);
    await svc.handleCallback('code', state);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ memberId: null, action: 'ACTIVATE' }));
  });

  it('el actor no se puede inventar: un state con la firma de otro payload se rechaza antes de tocar MP', async () => {
    const { svc, audit } = mp();
    const [body] = svc.getAuthorizationUrl(BIZ, ACTOR).split('.');
    const otro = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), memberId: 'm-falso' })).toString('base64url');
    await expect(svc.handleCallback('code', `${otro}.firma-invalida`)).rejects.toThrow(/state/);
    expect(mockOauthCreate).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('desconectar desde el panel registra DEACTIVATE con el actor y la cuenta que se soltó', async () => {
    const { svc, prisma, audit } = mp();
    await svc.disconnect(BIZ, ACTOR);
    expect(prisma.mpCredentials.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { isActive: false } });
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'mp_credentials', entityId: BIZ, action: 'DEACTIVATE',
      changes: [{ field: 'mpUserId', before: '12345', after: null }],
    });
    sinSecretos(audit);
  });

  it('desconectar sin nada conectado no registra nada', async () => {
    const { svc, audit } = mp({ cred: null });
    await svc.disconnect(BIZ, ACTOR);
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('el webhook de desautorización registra sin actor, en cada negocio que tenía esa cuenta', async () => {
    const { svc, audit } = mp({ conectadas: [{ businessId: BIZ }, { businessId: 'biz-2' }] });
    await svc.handleOAuthWebhook('12345');
    expect(entradas(audit)).toEqual([
      expect.objectContaining({ businessId: BIZ, memberId: null, entityType: 'mp_credentials', action: 'DEACTIVATE' }),
      expect.objectContaining({ businessId: 'biz-2', memberId: null, entityType: 'mp_credentials', action: 'DEACTIVATE' }),
    ]);
  });
});

// ── Dominios ─────────────────────────────────────────────────────────────────

function dominios(opts: { existente?: { status: string; dnsVerified: boolean } } = {}) {
  const fila = { id: 'cd-1', businessId: BIZ, domain: 'mitienda.com', source: 'LINKED', status: 'PENDING', dnsVerified: false, ...opts.existente };
  const prisma = {
    customDomain: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(fila),
      create: jest.fn().mockResolvedValue({ ...fila }),
      update: jest.fn().mockResolvedValue({ ...fila, status: 'ACTIVE', dnsVerified: true }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const vercel = {
    addDomain: jest.fn().mockResolvedValue({}),
    isDnsConfigured: jest.fn().mockResolvedValue(true),
    getDomainInfo: jest.fn().mockResolvedValue({ verified: true }),
    removeDomain: jest.fn().mockResolvedValue(undefined),
  };
  const audit = auditMock();
  return { svc: new DomainsService(prisma as any, vercel as any, audit as any), prisma, vercel, audit };
}

describe('Dominios: vincular, verificar y borrar', () => {
  it('vincular registra CREATE con el actor y el dominio', async () => {
    const { svc, audit } = dominios();
    await svc.linkDomain(BIZ, { domain: ' MiTienda.com ' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'domain', entityId: 'cd-1', action: 'CREATE',
      changes: [{ field: 'domain', before: null, after: 'mitienda.com' }, { field: 'source', before: null, after: 'LINKED' }],
    });
  });

  it('si Vercel rechaza el dominio no hay fila ni registro', async () => {
    const { svc, prisma, vercel, audit } = dominios();
    vercel.addDomain.mockRejectedValue(new Error('vercel 409'));
    await expect(svc.linkDomain(BIZ, { domain: 'mitienda.com' }, ACTOR)).rejects.toThrow();
    expect(prisma.customDomain.create).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('verificar DNS registra UPDATE solo cuando el estado cambia', async () => {
    const { svc, audit } = dominios();
    await svc.verifyDns(BIZ, 'cd-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      memberId: ACTOR, entityType: 'domain', entityId: 'cd-1', action: 'UPDATE',
      changes: expect.arrayContaining([
        { field: 'status', before: 'PENDING', after: 'ACTIVE' },
        { field: 'dnsVerified', before: false, after: true },
      ]),
    }));

    // Ya estaba activo y verificado: apretar "verificar" de nuevo no suma una fila.
    const repetido = dominios({ existente: { status: 'ACTIVE', dnsVerified: true } });
    await repetido.svc.verifyDns(BIZ, 'cd-1', ACTOR);
    expect(repetido.audit.registrar).not.toHaveBeenCalled();
  });

  it('borrar registra DELETE con el dominio que se fue', async () => {
    const { svc, audit } = dominios();
    await svc.remove(BIZ, 'cd-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      memberId: ACTOR, entityType: 'domain', entityId: 'cd-1', action: 'DELETE',
      changes: expect.arrayContaining([{ field: 'domain', before: 'mitienda.com', after: null }]),
    }));
  });
});

const PEDIDO = 'pedido-1';

function compra() {
  const orden = {
    id: PEDIDO, businessId: BIZ, domain: 'lenteslindos.store', years: 1, status: 'PENDING_PAYMENT',
    priceVercel: new Prisma.Decimal(1.99), priceCharged: new Prisma.Decimal(4386.24),
    contactFirstName: 'Ana', contactLastName: 'Paz', contactEmail: 'ana@x.com', contactPhone: '+5491122334455',
    contactAddress1: 'Calle 1', contactCity: 'CABA', contactState: 'CABA', contactZip: '1000', contactCountry: 'AR',
  };
  const prisma = {
    domainPurchaseOrder: {
      findUnique: jest.fn().mockResolvedValue(orden),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: PEDIDO }),
    },
    customDomain: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'cd-1' }) },
  };
  const vercel = {
    buyDomain: jest.fn().mockResolvedValue({ orderId: 'v-1' }),
    addDomain: jest.fn().mockResolvedValue({}),
    checkAvailability: jest.fn().mockResolvedValue(true),
    getPrice: jest.fn().mockResolvedValue(1.99),
  };
  const mp = {
    getPlatformPayment: jest.fn().mockResolvedValue({ external_reference: PEDIDO, status: 'approved', transaction_amount: 4386.24, currency_id: 'ARS' }),
    refundPlatformPayment: jest.fn().mockResolvedValue({ id: 'ref-1' }),
    createPlatformPreference: jest.fn().mockResolvedValue({ mpPreferenceId: 'pref-1', initPoint: 'https://mp/pagar' }),
  };
  const config = { get: (k: string) => (k === 'USD_ARS_RATE_FALLBACK' ? '1000' : undefined), getOrThrow: () => 'https://api.orbita.site/mercadopago/oauth/callback' };
  const audit = auditMock();
  const svc = new DomainPurchaseService(prisma as any, config as any, vercel as any, mp as any, audit as any);
  // El dólar viene de una API externa: se corta acá.
  jest.spyOn(svc as any, 'getDolarVenta').mockResolvedValue(1000);
  return { svc, prisma, vercel, mp, audit };
}

describe('Dominios: compra', () => {
  const contacto = { firstName: 'Ana', lastName: 'Paz', email: 'ana@x.com', phone: '+5491122334455', address1: 'C 1', city: 'CABA', state: 'CABA', zip: '1000', country: 'AR' };

  it('iniciar el pago registra CREATE con el actor, el dominio y lo cobrado', async () => {
    const { svc, audit } = compra();
    await svc.startCheckout(BIZ, { domain: 'lenteslindos.store', contact: contacto, returnUrl: 'https://orbita.site/x' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      businessId: BIZ, memberId: ACTOR, entityType: 'domain', entityId: PEDIDO, action: 'CREATE',
      changes: expect.arrayContaining([{ field: 'domain', before: null, after: 'lenteslindos.store' }, { field: 'status', before: null, after: 'PENDING_PAYMENT' }]),
    }));
    expect(campos(audit)).toContain('priceCharged');
  });

  it('el webhook que termina la compra registra UPDATE sin actor, sobre el mismo pedido', async () => {
    const { svc, audit } = compra();
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      businessId: BIZ, memberId: null, entityType: 'domain', entityId: PEDIDO, action: 'UPDATE',
      changes: expect.arrayContaining([{ field: 'status', before: 'PENDING_PAYMENT', after: 'COMPLETED' }, { field: 'customDomainId', before: null, after: 'cd-1' }]),
    }));
  });

  it('si Vercel no pudo comprar, el reembolso queda registrado con monto e id de MP', async () => {
    const { svc, vercel, audit } = compra();
    vercel.buyDomain.mockRejectedValue(new Error('domain not available'));
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      memberId: null, entityType: 'domain', entityId: PEDIDO, action: 'UPDATE',
      changes: expect.arrayContaining([
        { field: 'status', before: 'PENDING_PAYMENT', after: 'FAILED' },
        { field: 'refund', before: null, after: { monto: 4386.24, mpRefundId: 'ref-1' } },
      ]),
    }));
  });

  it('comprado en Vercel pero sin vincular: queda el motivo, sin reembolso', async () => {
    const { svc, vercel, mp, audit } = compra();
    vercel.addDomain.mockRejectedValue(new Error('vercel 500'));
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(mp.refundPlatformPayment).not.toHaveBeenCalled();
    expect(campos(audit)).toEqual(['domain', 'failReason']);
    expect(JSON.stringify(entradas(audit))).not.toContain('"refund"');
  });
});

// ── Descuentos y cupones ─────────────────────────────────────────────────────

const DESCUENTO = {
  id: 'd-1', businessId: BIZ, name: 'Promo', type: 'PERCENT_TICKET', value: new Prisma.Decimal(10), scope: 'TICKET', productLevel: null,
  minQuantity: null, minAmount: null, application: 'AUTOMATIC', startDate: new Date('2026-09-10T03:00:00.000Z'), endDate: null,
  activeDays: [], startTime: null, endTime: null, maxUsesTotal: null, maxUsesPerCustomer: null, isPrivate: false, priority: 0,
  linkActive: false, linkRedirect: null, isActive: true, code: null,
};
const DTO_DESCUENTO = { name: 'Promo', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: '2026-09-10' } as any;

function descuentos(opts: { existente?: Partial<typeof DESCUENTO> } = {}) {
  const fila = { ...DESCUENTO, ...opts.existente };
  const tx = {
    discount: { create: jest.fn().mockResolvedValue(fila), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    discountProduct: { createMany: jest.fn(), deleteMany: jest.fn() },
    discountCategory: { createMany: jest.fn(), deleteMany: jest.fn() },
  };
  const prisma = {
    // Primera lectura: el existente (update/toggle/remove); las siguientes,
    // los chequeos de duplicado.
    discount: { findFirst: jest.fn().mockResolvedValueOnce(fila).mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const countdown = {
    validarAntesDeGuardar: jest.fn().mockResolvedValue(undefined),
    aplicar: jest.fn(),
    discountIdConCountdown: jest.fn().mockResolvedValue(null),
    apagarSiEsDe: jest.fn().mockResolvedValue(undefined),
  };
  const audit = auditMock();
  const svc = new DiscountsService(prisma as any, countdown as any, { hasActiveAddon: jest.fn() } as any, audit as any);
  jest.spyOn(svc, 'findOne').mockResolvedValue({} as any);
  return { svc, prisma, tx, audit };
}

describe('Descuentos: alta, edición, activación y baja', () => {
  it('crear registra CREATE con el actor y la foto del descuento (nombre, tipo, valor, vigencia)', async () => {
    const { svc, prisma, audit } = descuentos();
    prisma.discount.findFirst.mockReset().mockResolvedValue(null); // sin existente: solo el chequeo de duplicado
    await svc.create(BIZ, ACTOR, DTO_DESCUENTO);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      businessId: BIZ, memberId: ACTOR, entityType: 'discount', entityId: 'd-1', action: 'CREATE',
      changes: expect.arrayContaining([
        { field: 'name', before: null, after: 'Promo' },
        { field: 'type', before: null, after: 'PERCENT_TICKET' },
        { field: 'value', before: null, after: 10 },
        { field: 'startDate', before: null, after: '2026-09-10T03:00:00.000Z' },
      ]),
    }));
  });

  it('editar registra UPDATE solo con lo que cambió (el valor sí, el nombre no)', async () => {
    const { svc, audit } = descuentos();
    await svc.update(BIZ, 'd-1', { ...DTO_DESCUENTO, value: 25, endDate: '2026-09-30' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      memberId: ACTOR, entityType: 'discount', entityId: 'd-1', action: 'UPDATE',
      changes: [
        { field: 'value', before: 10, after: 25 },
        { field: 'endDate', before: null, after: '2026-10-01T02:59:59.999Z' },
      ],
    }));
  });

  it('editar sin cambiar nada no registra', async () => {
    const { svc, audit } = descuentos();
    await svc.update(BIZ, 'd-1', DTO_DESCUENTO, ACTOR);
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('apagar registra DEACTIVATE y prender ACTIVATE', async () => {
    const apagar = descuentos();
    await apagar.svc.toggle(BIZ, 'd-1', ACTOR);
    expect(apagar.audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      memberId: ACTOR, entityType: 'discount', entityId: 'd-1', action: 'DEACTIVATE',
      changes: expect.arrayContaining([{ field: 'isActive', before: true, after: false }]),
    }));

    const prender = descuentos({ existente: { isActive: false } });
    await prender.svc.toggle(BIZ, 'd-1', ACTOR);
    expect(prender.audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACTIVATE' }));
  });

  it('borrar registra DELETE con el nombre', async () => {
    const { svc, audit } = descuentos();
    await svc.remove(BIZ, 'd-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'discount', entityId: 'd-1', action: 'DELETE',
      changes: [{ field: 'name', before: 'Promo', after: null }],
    });
  });
});

const CUPON = { ...DESCUENTO, id: 'c-1', code: 'PROMO10', application: 'MANUAL' };
const DTO_CUPON = { code: 'promo10', name: 'Promo', type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: '2026-09-10' } as any;

function cupones(opts: { existente?: Partial<typeof CUPON> } = {}) {
  const fila = { ...CUPON, ...opts.existente };
  const tx = {
    discount: { create: jest.fn().mockResolvedValue(fila), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    discountProduct: { createMany: jest.fn(), deleteMany: jest.fn() },
    discountCategory: { createMany: jest.fn(), deleteMany: jest.fn() },
  };
  const prisma = {
    discount: { findFirst: jest.fn().mockResolvedValueOnce(fila).mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const audit = auditMock();
  const svc = new CouponsService(prisma as any, {} as any, audit as any);
  jest.spyOn(svc, 'findOne').mockResolvedValue({} as any);
  return { svc, prisma, audit };
}

describe('Cupones: alta, edición, activación y baja', () => {
  it('crear registra CREATE con el código', async () => {
    const { svc, prisma, audit } = cupones();
    prisma.discount.findFirst.mockReset().mockResolvedValue(null);
    await svc.create(BIZ, ACTOR, DTO_CUPON);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      businessId: BIZ, memberId: ACTOR, entityType: 'coupon', entityId: 'c-1', action: 'CREATE',
      changes: expect.arrayContaining([{ field: 'code', before: null, after: 'PROMO10' }, { field: 'value', before: null, after: 10 }]),
    }));
  });

  it('editar registra UPDATE con el cambio de código (ya en mayúsculas) y de tope', async () => {
    const { svc, audit } = cupones();
    await svc.update(BIZ, 'c-1', { ...DTO_CUPON, code: 'promo20', maxUsesTotal: 50 }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      memberId: ACTOR, entityType: 'coupon', entityId: 'c-1', action: 'UPDATE',
      changes: [{ field: 'code', before: 'PROMO10', after: 'PROMO20' }, { field: 'maxUsesTotal', before: null, after: 50 }],
    }));
  });

  it('apagar registra DEACTIVATE con el código', async () => {
    const { svc, audit } = cupones();
    await svc.toggle(BIZ, 'c-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'coupon', action: 'DEACTIVATE',
      changes: [{ field: 'code', before: null, after: 'PROMO10' }, { field: 'isActive', before: true, after: false }],
    }));
  });

  it('borrar registra DELETE', async () => {
    const { svc, audit } = cupones();
    await svc.remove(BIZ, 'c-1', ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
      memberId: ACTOR, entityType: 'coupon', entityId: 'c-1', action: 'DELETE',
      changes: expect.arrayContaining([{ field: 'code', before: 'PROMO10', after: null }]),
    }));
  });
});

// ── Cancelaciones ────────────────────────────────────────────────────────────

function cancelaciones(opts: { refundMethod?: string; pagoMp?: boolean } = {}) {
  const orden = { orderNumber: 7, customerId: 'c-1', customer: { firstName: 'Ana', lastName: null, email: 'ana@x.com' }, onlineOrderDetails: null };
  const solicitud = {
    id: 'cr-1', orderId: 'o-1', reason: 'me equivoqué', status: 'PENDING', refundMethod: opts.refundMethod ?? 'REFUND',
    refundStatus: null, createdAt: new Date(), order: { ...orden, id: 'o-1', total: new Prisma.Decimal(15000) },
  };
  const prisma = {
    cancellationRequest: {
      findFirst: jest.fn().mockResolvedValue(solicitud),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      findFirstOrThrow: jest.fn().mockResolvedValue({ ...solicitud, status: 'APPROVED' }),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(opts.pagoMp === false ? null : { id: 'pay-9', mpPaymentId: 'mp-9', amount: new Prisma.Decimal(15000) }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    creditNote: { create: jest.fn().mockResolvedValue({}) },
  };
  const mp = { refundPayment: jest.fn().mockResolvedValue({ id: 'r-1' }) };
  const audit = auditMock();
  const svc = new CancellationsService(
    prisma as any,
    { sendCustomEmail: jest.fn().mockResolvedValue(true) } as any,
    { emit: jest.fn() } as any,
    { updateStatus: jest.fn().mockResolvedValue(undefined) } as any,
    mp as any,
    audit as any,
  );
  return { svc, prisma, mp, audit };
}

describe('Cancelaciones: aprobar, rechazar y reembolsar', () => {
  it('aprobar con reembolso por MP registra ACTIVATE y después el reembolso como UPDATE con monto e id', async () => {
    const { svc, audit } = cancelaciones();
    await svc.approve(BIZ, ACTOR, 'cr-1');
    expect(entradas(audit)).toEqual([
      {
        businessId: BIZ, memberId: ACTOR, entityType: 'cancellation', entityId: 'cr-1', action: 'ACTIVATE',
        changes: [{ field: 'status', before: 'PENDING', after: 'APPROVED' }, { field: 'refundMethod', before: null, after: 'REFUND' }],
      },
      {
        businessId: BIZ, memberId: ACTOR, entityType: 'cancellation', entityId: 'cr-1', action: 'UPDATE',
        changes: [{ field: 'refund', before: null, after: { monto: 15000, mpRefundId: 'r-1' } }],
      },
    ]);
  });

  it('si el reembolso falla queda registrado como fallido, sin id de MP', async () => {
    const { svc, mp, audit } = cancelaciones();
    mp.refundPayment.mockRejectedValue(new Error('MP caído'));
    await svc.approve(BIZ, ACTOR, 'cr-1');
    expect(entradas(audit)[1]).toEqual(expect.objectContaining({
      action: 'UPDATE', changes: [{ field: 'refundStatus', before: null, after: 'FAILED' }],
    }));
    expect(JSON.stringify(entradas(audit))).not.toContain('"refund"');
  });

  it('sin pago de MP (efectivo/transferencia) solo queda la aprobación', async () => {
    const { svc, audit } = cancelaciones({ pagoMp: false });
    await svc.approve(BIZ, ACTOR, 'cr-1');
    expect(entradas(audit)).toHaveLength(1);
    expect(entradas(audit)[0]).toEqual(expect.objectContaining({ action: 'ACTIVATE' }));
  });

  it('con nota de crédito queda por cuánto se emitió', async () => {
    const { svc, audit } = cancelaciones({ refundMethod: 'CREDIT_NOTE' });
    await svc.approve(BIZ, ACTOR, 'cr-1');
    expect(entradas(audit)[1]).toEqual(expect.objectContaining({
      action: 'UPDATE', changes: [{ field: 'creditNote', before: null, after: { monto: 15000 } }],
    }));
  });

  it('si el pedido no se pudo cancelar no se registra nada', async () => {
    const { svc, audit } = cancelaciones();
    const orders = (svc as any).orders as { updateStatus: jest.Mock };
    orders.updateStatus.mockRejectedValue(new Error('No se puede pasar de "Enviado" a "Cancelado"'));
    await expect(svc.approve(BIZ, ACTOR, 'cr-1')).rejects.toThrow();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('rechazar registra DEACTIVATE con el actor, el pedido y lo que se le dijo al cliente', async () => {
    const { svc, audit } = cancelaciones();
    await svc.reject(BIZ, 'cr-1', { rejectionMessage: '  Ya salió del depósito ' }, ACTOR);
    expect(audit.registrar).toHaveBeenCalledWith({
      businessId: BIZ, memberId: ACTOR, entityType: 'cancellation', entityId: 'cr-1', action: 'DEACTIVATE',
      changes: [
        { field: 'status', before: 'PENDING', after: 'REJECTED' },
        { field: 'orderNumber', before: null, after: 7 },
        { field: 'rejectionMessage', before: null, after: 'Ya salió del depósito' },
      ],
    });
  });
});
