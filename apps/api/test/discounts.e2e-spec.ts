import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-613 / RBT-614) CRUD de descuentos + motor de evaluación.
//
// Los descuentos que crea esta suite llevan el prefijo PREFIJO y se borran en
// afterAll — la DB de dev es compartida y ya arrastra basura de corridas viejas,
// así que no se le suma más.
const PREFIJO = '[e2e-descuentos]';

describe('Discounts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let employeeToken: string;
  let businessId: string;
  let variantA: string; // la apunta el descuento
  let variantB: string; // NO la apunta ningún descuento
  let createdId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });
    employeeToken = empRes.body.token;

    // El listado de productos no expone ids de variante, así que se leen directo.
    const variantes = await prisma.productVariant.findMany({
      where: { product: { businessId, deletedAt: null } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 2,
    });
    variantA = variantes[0].id;
    variantB = variantes[1].id;
  });

  afterAll(async () => {
    await prisma.discount.deleteMany({ where: { businessId, name: { startsWith: PREFIJO } } });
    await closeTestApp();
  });

  // ── Listado y detalle ─────────────────────────────────────────────────────

  describe('GET /api/v1/discounts', () => {
    it('con token owner → 200, lista paginada', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/discounts').set(auth(ownerToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toMatchObject({ page: 1, limit: 20 });
      expect(typeof res.body.total).toBe('number');
    });

    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/discounts');
      expect(res.status).toBe(401);
    });

    it('estado inválido en el filtro → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/discounts?status=inventado')
        .set(auth(ownerToken));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/discounts/:id', () => {
    it('id inexistente → 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/discounts/00000000-0000-0000-0000-000000000000')
        .set(auth(ownerToken));
      expect(res.status).toBe(404);
    });
  });

  // ── Alta ──────────────────────────────────────────────────────────────────

  describe('POST /api/v1/discounts', () => {
    it('PERCENT_TICKET válido → 201, nace activo', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} 10% ticket`,
          type: 'PERCENT_TICKET',
          value: 10,
          scope: 'TICKET',
          minAmount: 1000,
          startDate: new Date(Date.now() - 86400000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe(`${PREFIJO} 10% ticket`);
      expect(res.body.estado).toBe('activo');
      expect(res.body.alcanceResumen).toBe('Ticket completo');
      createdId = res.body.id;
    });

    it('nombre repetido → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} 10% ticket`,
          type: 'PERCENT_TICKET',
          value: 5,
          scope: 'TICKET',
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('porcentaje > 100 → 400 (RF-11)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} invalido pct`,
          type: 'PERCENT_TICKET',
          value: 150,
          scope: 'TICKET',
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('scope PRODUCT sin productos → 400 (RF-11)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} sin productos`,
          type: 'PERCENT_PRODUCT',
          value: 10,
          scope: 'PRODUCT',
          productLevel: 'variante',
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('fecha fin anterior a la de inicio → 400 (RF-11)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} fechas dadas vuelta`,
          type: 'PERCENT_TICKET',
          value: 10,
          scope: 'TICKET',
          startDate: new Date('2026-06-01').toISOString(),
          endDate: new Date('2026-05-01').toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('tipo avanzado (V2) → 400, no está soportado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} lleva x paga y`,
          type: 'BUY_X_PAY_Y',
          value: 1,
          scope: 'PRODUCT',
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('producto de otro negocio → 400 (RF-15)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} producto ajeno`,
          type: 'PERCENT_PRODUCT',
          value: 10,
          scope: 'PRODUCT',
          productLevel: 'variante',
          productIds: ['00000000-0000-0000-0000-000000000000'],
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it('con token empleado → 403 (RF-04: solo owner/admin gestionan)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(employeeToken))
        .send({
          name: `${PREFIJO} desde empleado`,
          type: 'PERCENT_TICKET',
          value: 5,
          scope: 'TICKET',
          startDate: new Date().toISOString(),
        });
      expect(res.status).toBe(403);
    });
  });

  // ── Edición y toggle ──────────────────────────────────────────────────────

  describe('PUT /api/v1/discounts/:id', () => {
    it('cambia el valor → 200', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/discounts/${createdId}`)
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} 15% ticket`,
          type: 'PERCENT_TICKET',
          value: 15,
          scope: 'TICKET',
          minAmount: 1000,
          startDate: new Date(Date.now() - 86400000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe(15);
      expect(res.body.name).toBe(`${PREFIJO} 15% ticket`);
    });
  });

  describe('PATCH /api/v1/discounts/:id/toggle', () => {
    it('invierte isActive y el estado pasa a inactivo', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/discounts/${createdId}/toggle`)
        .set(auth(ownerToken));

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
      expect(res.body.estado).toBe('inactivo');

      // Y vuelve a activarse.
      const back = await request(app.getHttpServer())
        .patch(`/api/v1/discounts/${createdId}/toggle`)
        .set(auth(ownerToken));
      expect(back.body.isActive).toBe(true);
      expect(back.body.estado).toBe('activo');
    });
  });

  // ── Motor de evaluación ───────────────────────────────────────────────────

  describe('POST /api/v1/discounts/evaluate', () => {
    let productDiscountId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts')
        .set(auth(ownerToken))
        .send({
          name: `${PREFIJO} 20% en variante A`,
          type: 'PERCENT_PRODUCT',
          value: 20,
          scope: 'PRODUCT',
          productLevel: 'variante',
          productIds: [variantA],
          startDate: new Date(Date.now() - 86400000).toISOString(),
        });
      productDiscountId = res.body.id;
    });

    it('ítem que matchea → aplica el descuento, 20% del subtotal', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts/evaluate')
        .set(auth(ownerToken))
        .send({ items: [{ variantId: variantA, quantity: 2 }] });

      expect(res.status).toBe(201);
      expect(res.body.itemDiscounts).toHaveLength(1);
      expect(res.body.itemDiscounts[0].discountId).toBe(productDiscountId);
      // El precio lo pone la BASE (ProductVariant.price): el request ni siquiera
      // acepta un unitPrice (ver EvaluateDiscountsDto).
      expect(res.body.subtotal).toBeGreaterThan(1);
      expect(res.body.itemDiscounts[0].amount).toBeCloseTo(res.body.subtotal * 0.2, 2);
      expect(res.body.total).toBeCloseTo(res.body.subtotal - res.body.discountTotal, 2);
    });

    it('ítem sin descuento de producto que lo apunte → no recibe descuento de ítem', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts/evaluate')
        .set(auth(ownerToken))
        .send({ items: [{ variantId: variantB, quantity: 1 }] });

      expect(res.status).toBe(201);
      expect(res.body.itemDiscounts).toHaveLength(0);
      // Puede haber un descuento de TICKET vigente (lo crea el bloque de alta de
      // esta misma suite) y es correcto que aplique: alcanza al carrito entero,
      // no al producto. Lo que se verifica acá es que ningún descuento de
      // producto se filtró hacia una variante que no apunta.
      expect(res.body.discountTotal).toBe(res.body.ticketDiscount?.amount ?? 0);
      expect(res.body.total).toBeCloseTo(res.body.subtotal - res.body.discountTotal, 2);
    });

    it('variante de otro negocio → 400 (no se infla el subtotal)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts/evaluate')
        .set(auth(ownerToken))
        .send({
          items: [{ variantId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it('quantity < 1 → 400 (validación @Min(1))', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts/evaluate')
        .set(auth(ownerToken))
        .send({ items: [{ variantId: variantA, quantity: 0 }] });

      expect(res.status).toBe(400);
    });

    it('es idempotente: dos llamadas iguales dan el mismo resultado (RNF-07)', async () => {
      const payload = { items: [{ variantId: variantA, quantity: 1 }] };
      const r1 = await request(app.getHttpServer()).post('/api/v1/discounts/evaluate').set(auth(ownerToken)).send(payload);
      const r2 = await request(app.getHttpServer()).post('/api/v1/discounts/evaluate').set(auth(ownerToken)).send(payload);

      expect(r1.body).toEqual(r2.body);
      // Y no consumió usos: evaluar no tiene efectos secundarios.
      const d = await request(app.getHttpServer()).get(`/api/v1/discounts/${productDiscountId}`).set(auth(ownerToken));
      expect(d.body.usesConsumed).toBe(0);
    });

    it('descuento desactivado deja de aplicar', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/discounts/${productDiscountId}/toggle`)
        .set(auth(ownerToken));

      const res = await request(app.getHttpServer())
        .post('/api/v1/discounts/evaluate')
        .set(auth(ownerToken))
        .send({ items: [{ variantId: variantA, quantity: 1 }] });

      expect(res.body.itemDiscounts).toHaveLength(0);
    });
  });

  // ── Baja ──────────────────────────────────────────────────────────────────

  describe('DELETE /api/v1/discounts/:id', () => {
    it('con token owner → 200 y deja de aparecer en el listado', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/discounts/${createdId}`)
        .set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true });

      const detalle = await request(app.getHttpServer())
        .get(`/api/v1/discounts/${createdId}`)
        .set(auth(ownerToken));
      expect(detalle.status).toBe(404);
    });

    it('id inexistente → 404', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/discounts/00000000-0000-0000-0000-000000000000')
        .set(auth(ownerToken));
      expect(res.status).toBe(404);
    });
  });
});
