import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-675) "Oferta relámpago": el interruptor de Avanzado, el tipo del
// formulario de Descuentos (PERCENT_PRODUCT + countdown) y lo que ve la
// tienda. Recorre el flujo entero por HTTP, contra la misma DB compartida que
// el resto de las suites e2e.
//
// Todo lo que crea lleva el prefijo PREFIJO y se borra en afterAll. El add-on
// ADVANCED y el interruptor del negocio seed se dejan como estaban al
// terminar (se guardan al arrancar y se restauran).
const PREFIJO = '[e2e-relampago]';

const enHoras = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const hoyISO = () => new Date().toISOString().slice(0, 10);

describe('Oferta relámpago (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let productA: string;
  let productB: string;
  let addonPrevio: { id: string; isActive: boolean; expiresAt: Date | null } | null;
  let flagPrevio: boolean;
  let countdownPrevio: { discountId: string | null; isActive: boolean } | null;
  const creados: string[] = [];

  const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
  const http = () => request(app.getHttpServer());

  function cuerpoRelampago(nombre: string, over: Record<string, unknown> = {}) {
    return {
      name: `${PREFIJO} ${nombre}`,
      type: 'PERCENT_PRODUCT',
      value: 40,
      scope: 'PRODUCT',
      productLevel: 'padre',
      application: 'AUTOMATIC',
      startDate: hoyISO(),
      endDate: enHoras(48),
      productIds: [productA],
      linkActive: true,
      countdown: true,
      ...over,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const ownerRes = await http()
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;

    const productos = await prisma.product.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 2,
    });
    productA = productos[0].id;
    productB = productos[1]?.id ?? productos[0].id;

    // Estado previo del negocio seed, para dejarlo igual al salir.
    const addon = await prisma.businessAddon.findUnique({ where: { businessId_type: { businessId, type: 'ADVANCED' } } });
    addonPrevio = addon ? { id: addon.id, isActive: addon.isActive, expiresAt: addon.expiresAt } : null;
    const negocio = await prisma.business.findUnique({ where: { id: businessId }, select: { flashSaleEnabled: true } });
    flagPrevio = negocio?.flashSaleEnabled ?? false;
    const cd = await prisma.countdownConfig.findUnique({ where: { businessId }, select: { discountId: true, isActive: true } });
    countdownPrevio = cd ? { discountId: cd.discountId, isActive: cd.isActive } : null;

    // El paquete Avanzado, activo y sin vencimiento, para toda la suite.
    await prisma.businessAddon.upsert({
      where: { businessId_type: { businessId, type: 'ADVANCED' } },
      create: { businessId, type: 'ADVANCED', isActive: true },
      update: { isActive: true, expiresAt: null },
    });
  });

  afterAll(async () => {
    // La fila del reloj apunta a un descuento nuestro: devolverla a lo que
    // había (o apagarla) ANTES de borrar los descuentos.
    if (countdownPrevio) {
      await prisma.countdownConfig.updateMany({ where: { businessId }, data: { discountId: countdownPrevio.discountId, isActive: countdownPrevio.isActive } });
    } else {
      await prisma.countdownConfig.updateMany({ where: { businessId }, data: { isActive: false, discountId: null } });
    }
    await prisma.discount.deleteMany({ where: { businessId, name: { startsWith: PREFIJO } } });
    await prisma.business.update({ where: { id: businessId }, data: { flashSaleEnabled: flagPrevio } });
    if (addonPrevio) {
      await prisma.businessAddon.update({ where: { id: addonPrevio.id }, data: { isActive: addonPrevio.isActive, expiresAt: addonPrevio.expiresAt } });
    } else {
      await prisma.businessAddon.deleteMany({ where: { businessId, type: 'ADVANCED' } });
    }
    await closeTestApp();
  });

  // ── Interruptor de Avanzado ───────────────────────────────────────────────

  describe('GET/PUT /api/v1/countdown/settings', () => {
    it('sin token → 401', async () => {
      await http().get('/api/v1/countdown/settings').expect(401);
    });

    it('apagar deja enabled=false y lo refleja /business/addons', async () => {
      const res = await http().put('/api/v1/countdown/settings').set(auth()).send({ enabled: false }).expect(200);
      expect(res.body.enabled).toBe(false);
      const addons = await http().get('/api/v1/business/addons').set(auth()).expect(200);
      expect(addons.body.advanced).toBe(true);
      expect(addons.body.flashSaleEnabled).toBe(false);
    });

    it('con el interruptor apagado, crear una oferta relámpago → 400 con el motivo', async () => {
      const res = await http().post('/api/v1/discounts').set(auth()).send(cuerpoRelampago('apagada')).expect(400);
      expect(res.body.message).toMatch(/deshabilitada/i);
    });

    it('un body inválido → 400', async () => {
      await http().put('/api/v1/countdown/settings').set(auth()).send({ enabled: 'si' }).expect(400);
    });

    it('prender deja enabled=true', async () => {
      const res = await http().put('/api/v1/countdown/settings').set(auth()).send({ enabled: true }).expect(200);
      expect(res.body.enabled).toBe(true);
    });
  });

  // ── El tipo en Descuentos ─────────────────────────────────────────────────

  describe('POST /api/v1/discounts con countdown: true', () => {
    it('crea el descuento marcado como oferta relámpago, con la hora exacta de fin', async () => {
      const fin = enHoras(48);
      const res = await http().post('/api/v1/discounts').set(auth()).send(cuerpoRelampago('Cyber', { endDate: fin })).expect(201);
      creados.push(res.body.id);
      expect(res.body.type).toBe('PERCENT_PRODUCT');
      expect(res.body.countdown).toBe(true);
      expect(new Date(res.body.endDate).toISOString()).toBe(new Date(fin).toISOString());

      const settings = await http().get('/api/v1/countdown/settings').set(auth()).expect(200);
      expect(settings.body.actual.discountId).toBe(res.body.id);
      expect(settings.body.actual.name).toBe(`${PREFIJO} Cyber`);
    });

    it('el listado la marca y el filtro ?countdown=true trae solo esa', async () => {
      const todos = await http().get('/api/v1/discounts?limit=100').set(auth()).expect(200);
      const mia = todos.body.data.find((d: { id: string }) => d.id === creados[0]);
      expect(mia.countdown).toBe(true);

      const filtrado = await http().get('/api/v1/discounts?countdown=true').set(auth()).expect(200);
      expect(filtrado.body.data.map((d: { id: string }) => d.id)).toEqual([creados[0]]);
    });

    it('la tienda la ve con su fecha exacta y sus productos', async () => {
      const res = await http().get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/countdown/active`).expect(200);
      expect(res.body.discountId).toBe(creados[0]);
      expect(res.body.title).toBe(`${PREFIJO} Cyber`);
      expect(res.body.descuentoTipo).toBe('PERCENT');
      expect(res.body.descuentoValor).toBe(40);
      expect(res.body.productIds).toEqual([productA]);
      expect(new Date(res.body.endDate).getTime()).toBeGreaterThan(Date.now());
    });

    it('crear una segunda se la saca a la primera: una sola por negocio', async () => {
      const res = await http().post('/api/v1/discounts').set(auth()).send(cuerpoRelampago('Hot Sale', { productIds: [productB] })).expect(201);
      creados.push(res.body.id);
      expect(res.body.countdown).toBe(true);

      const primera = await http().get(`/api/v1/discounts/${creados[0]}`).set(auth()).expect(200);
      expect(primera.body.countdown).toBe(false);

      const tienda = await http().get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/countdown/active`).expect(200);
      expect(tienda.body.discountId).toBe(creados[1]);
    });

    it('sin fecha de fin → 400', async () => {
      const res = await http().post('/api/v1/discounts').set(auth()).send(cuerpoRelampago('sin fin', { endDate: undefined })).expect(400);
      expect(res.body.message).toMatch(/fecha/i);
    });

    it('con la fecha de fin ya pasada → 400', async () => {
      const res = await http().post('/api/v1/discounts').set(auth()).send(cuerpoRelampago('vencida', { startDate: '2026-01-01', endDate: enHoras(-2) })).expect(400);
      expect(res.body.message).toMatch(/pasó/i);
    });

    it('alcance ticket → 400 (no hay productos que mostrar en la portada)', async () => {
      const res = await http().post('/api/v1/discounts').set(auth()).send(cuerpoRelampago('ticket', { type: 'PERCENT_TICKET', scope: 'TICKET', productIds: undefined, productLevel: undefined })).expect(400);
      expect(res.body.message).toMatch(/productos o categor/i);
    });

    it('un 400 de la oferta relámpago no deja el descuento guardado a medias', async () => {
      const antes = await prisma.discount.count({ where: { businessId, name: { startsWith: PREFIJO } } });
      await http().post('/api/v1/discounts').set(auth()).send(cuerpoRelampago('a medias', { endDate: undefined })).expect(400);
      const despues = await prisma.discount.count({ where: { businessId, name: { startsWith: PREFIJO } } });
      expect(despues).toBe(antes);
    });
  });

  describe('PUT /api/v1/discounts/:id', () => {
    it('cambiar el tipo (countdown: false) apaga el reloj de la tienda', async () => {
      await http().put(`/api/v1/discounts/${creados[1]}`).set(auth())
        .send(cuerpoRelampago('Hot Sale', { productIds: [productB], countdown: false })).expect(200);
      const detalle = await http().get(`/api/v1/discounts/${creados[1]}`).set(auth()).expect(200);
      expect(detalle.body.countdown).toBe(false);
      const tienda = await http().get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/countdown/active`).expect(200);
      expect(tienda.body).toEqual({});
    });

    it('volver a marcarla la prende de nuevo y refresca nombre y fecha', async () => {
      const fin = enHoras(6);
      await http().put(`/api/v1/discounts/${creados[1]}`).set(auth())
        .send(cuerpoRelampago('Hot Sale 2', { productIds: [productB], endDate: fin })).expect(200);
      const tienda = await http().get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/countdown/active`).expect(200);
      expect(tienda.body.discountId).toBe(creados[1]);
      expect(tienda.body.title).toBe(`${PREFIJO} Hot Sale 2`);
      expect(new Date(tienda.body.endDate).toISOString()).toBe(new Date(fin).toISOString());
    });
  });

  // ── Apagar desde Avanzado y borrar ────────────────────────────────────────

  describe('interruptor apagado y baja', () => {
    it('apagar el interruptor esconde el reloj sin tocar el descuento', async () => {
      await http().put('/api/v1/countdown/settings').set(auth()).send({ enabled: false }).expect(200);
      const tienda = await http().get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/countdown/active`).expect(200);
      expect(tienda.body).toEqual({});
      // El descuento sigue ahí, activo y marcado: al prender vuelve solo.
      const detalle = await http().get(`/api/v1/discounts/${creados[1]}`).set(auth()).expect(200);
      expect(detalle.body.isActive).toBe(true);
      expect(detalle.body.countdown).toBe(true);

      await http().put('/api/v1/countdown/settings').set(auth()).send({ enabled: true }).expect(200);
      const deVuelta = await http().get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/countdown/active`).expect(200);
      expect(deVuelta.body.discountId).toBe(creados[1]);
    });

    it('borrar la oferta apaga el reloj', async () => {
      await http().delete(`/api/v1/discounts/${creados[1]}`).set(auth()).expect(200);
      const tienda = await http().get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/countdown/active`).expect(200);
      expect(tienda.body).toEqual({});
      const settings = await http().get('/api/v1/countdown/settings').set(auth()).expect(200);
      expect(settings.body.actual).toBeNull();
    });
  });
});
