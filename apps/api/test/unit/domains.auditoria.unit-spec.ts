import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DomainsService } from '../../src/domains/domains.service';
import { DomainPurchaseService } from '../../src/domains/domain-purchase.service';
import { VercelDomainsService } from '../../src/domains/vercel-domains.service';
import { CheckoutDomainPurchaseDto } from '../../src/domains/dto/checkout-domain-purchase.dto';
import { LinkDomainDto } from '../../src/domains/dto/link-domain.dto';
import { esDominioDeOrbita } from '../../src/domains/dominio-de-orbita';

// Auditoría interna 2026-09-10, ítem `api.domains`.
//
// Lo importante está en la compra de dominios, que cobra con la cuenta de
// PLATAFORMA y después compra en Vercel con la tarjeta de Órbita: el webhook
// aceptaba un pago sin external_reference (cualquier cobro aprobado de la
// plataforma "pagaba" un dominio), no comparaba el monto, procesaba sin
// secreto, y dos avisos simultáneos compraban el dominio dos veces.

const BIZ = 'biz-1';
const PEDIDO = 'pedido-1';

const config = (valores: Record<string, string | undefined>) => ({
  get: (k: string) => valores[k],
  getOrThrow: (k: string) => valores[k] ?? 'https://api.orbita.site/mercadopago/oauth/callback',
});

function compra(opts: { pago?: Record<string, unknown>; claim?: number; secret?: string } = {}) {
  const prisma = {
    domainPurchaseOrder: {
      findUnique: jest.fn().mockResolvedValue({
        id: PEDIDO, businessId: BIZ, domain: 'lenteslindos.store', years: 1, status: 'PENDING_PAYMENT',
        priceVercel: new Prisma.Decimal(1.99), priceCharged: new Prisma.Decimal(4386.24),
        contactFirstName: 'Ana', contactLastName: 'Paz', contactEmail: 'ana@x.com', contactPhone: '+5491122334455',
        contactAddress1: 'Calle 1', contactCity: 'CABA', contactState: 'CABA', contactZip: '1000', contactCountry: 'AR',
      }),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claim ?? 1 }),
      update: jest.fn(),
      create: jest.fn(),
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
    getPlatformPayment: jest.fn().mockResolvedValue({
      external_reference: PEDIDO, status: 'approved', transaction_amount: 4386.24, currency_id: 'ARS', ...opts.pago,
    }),
    refundPlatformPayment: jest.fn(),
    createPlatformPreference: jest.fn(),
  };
  const svc = new DomainPurchaseService(prisma as any, config({ MP_WEBHOOK_SECRET: opts.secret }) as any, vercel as any, mp as any);
  return { svc, prisma, vercel, mp };
}

describe('Webhook de compra de dominio', () => {
  it('sin MP_WEBHOOK_SECRET responde 503 y no procesa nada', async () => {
    const { svc, mp } = compra({ secret: undefined });
    await expect(svc.handleWebhookRequest({ type: 'payment', data: { id: 'p1' } }, {}, { orderId: PEDIDO })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mp.getPlatformPayment).not.toHaveBeenCalled();
  });

  it('con firma inválida se ignora sin procesar', async () => {
    const { svc, mp } = compra({ secret: 'secreto' });
    await expect(svc.handleWebhookRequest({ type: 'payment', data: { id: 'p1' } }, { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'r' }, { orderId: PEDIDO })).resolves.toEqual({ received: true });
    expect(mp.getPlatformPayment).not.toHaveBeenCalled();
  });

  it.each([
    ['sin external_reference', { external_reference: null }],
    ['de otro pedido', { external_reference: 'otro-pedido' }],
    ['por menos plata', { transaction_amount: 100 }],
    ['en otra moneda', { currency_id: 'USD' }],
    ['no aprobado', { status: 'pending' }],
  ])('un pago %s no compra nada', async (_caso, pago) => {
    const { svc, prisma, vercel } = compra({ pago });
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(prisma.domainPurchaseOrder.updateMany).not.toHaveBeenCalled();
    expect(vercel.buyDomain).not.toHaveBeenCalled();
  });

  it('el pago correcto pasa el pedido a PAID solo si seguía pendiente, y compra una vez', async () => {
    const { svc, prisma, vercel } = compra();
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(prisma.domainPurchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: PEDIDO, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', mpPaymentId: 'p1' },
    });
    expect(vercel.buyDomain).toHaveBeenCalledTimes(1);
  });

  it('si Vercel no pudo comprar, se reembolsa y el pedido queda FAILED', async () => {
    const { svc, prisma, vercel, mp } = compra();
    vercel.buyDomain.mockRejectedValue(new Error('domain not available'));
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(mp.refundPlatformPayment).toHaveBeenCalledWith('p1');
    expect(prisma.domainPurchaseOrder.update).toHaveBeenCalledWith({ where: { id: PEDIDO }, data: { status: 'FAILED', failReason: 'domain not available' } });
  });

  it('si Vercel YA compró y falla la vinculación, NO se reembolsa: queda PAID para resolver a mano', async () => {
    const { svc, prisma, vercel, mp } = compra();
    vercel.addDomain.mockRejectedValue(new Error('vercel 500'));
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(mp.refundPlatformPayment).not.toHaveBeenCalled();
    expect(prisma.domainPurchaseOrder.update).toHaveBeenCalledWith({ where: { id: PEDIDO }, data: { vercelOrderId: 'v-1' } });
    expect(prisma.domainPurchaseOrder.update).toHaveBeenCalledWith({ where: { id: PEDIDO }, data: { failReason: 'Comprado en Vercel, falta vincular: vercel 500' } });
    expect(prisma.domainPurchaseOrder.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
  });

  it('si otro aviso simultáneo ya lo tomó (count 0), no se compra de nuevo', async () => {
    const { svc, vercel } = compra({ claim: 0 });
    await svc.handlePaymentConfirmed(PEDIDO, 'p1');
    expect(vercel.buyDomain).not.toHaveBeenCalled();
  });
});

describe('Checkout de compra', () => {
  const contacto = { firstName: 'Ana', lastName: 'Paz', email: 'ana@x.com', phone: '+5491122334455', address1: 'C 1', city: 'CABA', state: 'CABA', zip: '1000', country: 'AR' };

  it('un dominio de Órbita no se cotiza ni se cobra', async () => {
    const { svc, vercel, mp } = compra();
    await expect(svc.startCheckout(BIZ, { domain: 'tienda.orbita.site', contact: contacto, returnUrl: 'https://orbita.site/x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(vercel.checkAvailability).not.toHaveBeenCalled();
    expect(mp.createPlatformPreference).not.toHaveBeenCalled();
  });

  it('un dominio que ya vinculó otra tienda se rechaza ANTES de cobrar', async () => {
    const { svc, prisma, mp } = compra();
    prisma.customDomain.findUnique.mockResolvedValue({ id: 'cd-otro' });
    await expect(svc.startCheckout(BIZ, { domain: 'tomado.com', contact: contacto, returnUrl: 'https://orbita.site/x' })).rejects.toThrow(/vinculado/);
    expect(prisma.domainPurchaseOrder.create).not.toHaveBeenCalled();
    expect(mp.createPlatformPreference).not.toHaveBeenCalled();
  });

  it('el DTO exige contacto, acota largos y no acepta un returnUrl sin http(s)', async () => {
    const errores = async (body: object) => (await validate(plainToInstance(CheckoutDomainPurchaseDto, body))).map((e) => e.property);
    const ok = { domain: 'tutienda.com', contact: contacto, returnUrl: 'https://orbita.site/admin/x/configuracion' };
    expect(await errores(ok)).toEqual([]);
    expect(await errores({ ...ok, contact: undefined })).toContain('contact');
    expect(await errores({ ...ok, returnUrl: 'javascript:alert(1)' })).toContain('returnUrl');
    expect(await errores({ ...ok, domain: 'a.com/../../v9/projects' })).toContain('domain');
    expect(await errores({ ...ok, contact: { ...contacto, address1: 'x'.repeat(201) } })).toContain('contact');
  });
});

describe('Dominios vinculados', () => {
  function dominios(opts: { existente?: unknown; create?: jest.Mock } = {}) {
    const prisma = {
      customDomain: {
        findUnique: jest.fn().mockResolvedValue(opts.existente ?? null),
        findFirst: jest.fn().mockResolvedValue({ id: 'cd-1', businessId: BIZ, domain: 'mitienda.com' }),
        create: opts.create ?? jest.fn().mockResolvedValue({ id: 'cd-1' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const vercel = {
      addDomain: jest.fn().mockResolvedValue({}),
      isDnsConfigured: jest.fn().mockResolvedValue(true),
      getDomainInfo: jest.fn().mockResolvedValue({ verified: true }),
      removeDomain: jest.fn().mockResolvedValue(undefined),
    };
    return { svc: new DomainsService(prisma as any, vercel as any), prisma, vercel };
  }

  it.each(['orbita.site', 'otratienda.orbita.site', 'api.orbita.site', 'mail.orbita-corp.com'])('no deja vincular %s', async (d) => {
    const { svc, vercel } = dominios();
    await expect(svc.linkDomain(BIZ, { domain: d })).rejects.toBeInstanceOf(BadRequestException);
    expect(vercel.addDomain).not.toHaveBeenCalled();
  });

  it('esDominioDeOrbita no se confunde con dominios parecidos', () => {
    expect(esDominioDeOrbita('miorbita.site')).toBe(false);
    expect(esDominioDeOrbita('orbita.site.com')).toBe(false);
    expect(esDominioDeOrbita('ORBITA.SITE.')).toBe(true);
  });

  it('dos vinculaciones simultáneas del mismo dominio: la segunda recibe 409, no 500', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
    const { svc } = dominios({ create: jest.fn().mockRejectedValue(p2002) });
    await expect(svc.linkDomain(BIZ, { domain: 'mitienda.com' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('verificar DNS, SSL y borrar escriben con { id, businessId }', async () => {
    const { svc, prisma } = dominios();
    await svc.verifyDns(BIZ, 'cd-1');
    await svc.sslStatus(BIZ, 'cd-1');
    await svc.remove(BIZ, 'cd-1');
    expect(prisma.customDomain.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'cd-1', businessId: BIZ } }));
    expect(prisma.customDomain.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'cd-1', businessId: BIZ } }));
    expect(prisma.customDomain.delete).toHaveBeenCalledWith({ where: { id: 'cd-1', businessId: BIZ } });
  });

  it('el dominio vinculado no puede traer caracteres de ruta ni pasar de 253', async () => {
    const errores = async (domain: string) => (await validate(plainToInstance(LinkDomainDto, { domain }))).length;
    expect(await errores('mitienda.com')).toBe(0);
    expect(await errores('x.com/../v9/projects/prj/env')).toBeGreaterThan(0);
    expect(await errores('x.com?teamId=otro')).toBeGreaterThan(0);
    expect(await errores(`${'a'.repeat(250)}.com`)).toBeGreaterThan(0);
  });
});

describe('Errores de Vercel hacia el panel', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => { global.fetch = fetchOriginal; });

  function responder(status: number, message: string) {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve({ error: { message } }) }) as any;
  }

  it('un 401/403/5xx no muestra el texto de Vercel', async () => {
    responder(403, 'Not authorized: team_GDb8Fq token scope');
    const svc = new VercelDomainsService(config({ VERCEL_TOKEN: 't' }) as any);
    const err = await svc.getDomainInfo('mitienda.com').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).not.toMatch(/team_|token/);
  });

  it('un 409 (el dominio ya está en otro proyecto) sí se le muestra al dueño', async () => {
    responder(409, 'Cannot add mitienda.com since it is already assigned to another project');
    const svc = new VercelDomainsService(config({ VERCEL_TOKEN: 't' }) as any);
    await expect(svc.addDomain('mitienda.com')).rejects.toThrow(/already assigned/);
  });

  it('sin VERCEL_TOKEN, 503 sin nombrar la variable', async () => {
    const svc = new VercelDomainsService(config({}) as any);
    const err = await svc.getDomainInfo('mitienda.com').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).not.toMatch(/VERCEL_TOKEN/);
  });
});
