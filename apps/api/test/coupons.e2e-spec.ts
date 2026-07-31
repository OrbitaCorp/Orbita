import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-615) CRUD de cupones. Los cupones son filas de `discounts` con code≠null;
// esta suite verifica que se crean/listan/editan/borran scopeados por negocio y
// que nunca se cruzan con los descuentos (code=null).
//
// Prefijo + cleanup en afterAll: la DB de dev es compartida.
const PREFIJO = '[e2e-cupones]';

describe('Coupons (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let employeeToken: string;
  let businessId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const inicio = () => new Date(Date.now() - 86400000).toISOString();

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
  });

  afterAll(async () => {
    // Borra tanto los cupones como cualquier descuento con el prefijo (comparten tabla).
    await prisma.discount.deleteMany({ where: { businessId, name: { startsWith: PREFIJO } } });
    await closeTestApp();
  });

  // ── Listado ─────────────────────────────────────────────────────────────────
  describe('GET /api/v1/coupons', () => {
    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/coupons');
      expect(res.status).toBe(401);
    });

    it('con token owner → 200, lista paginada', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/coupons').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toMatchObject({ page: 1, limit: 20 });
    });

    it('estado inválido en el filtro → 400', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/coupons?status=agotado').set(auth(ownerToken));
      expect(res.status).toBe(400);
    });

    it('lista solo cupones (code != null) del negocio, no descuentos', async () => {
      await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
        code: `${PREFIJO}-BIENVENIDO`, name: `${PREFIJO} bienvenida`, type: 'PERCENT_TICKET',
        value: 10, scope: 'TICKET', startDate: inicio(),
      });
      const res = await request(app.getHttpServer()).get('/api/v1/coupons').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.data.every((c: { code: string | null }) => c.code !== null)).toBe(true);
      expect(res.body.data.some((c: { code: string | null }) => c.code === `${PREFIJO}-BIENVENIDO`)).toBe(true);
    });

    it('busca por código y por nombre', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/coupons?search=${encodeURIComponent(`${PREFIJO}-BIENVENIDO`)}`)
        .set(auth(ownerToken));
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((c: { code: string }) => c.code.includes(`${PREFIJO}-BIENVENIDO`))).toBe(true);
    });
  });

  // ── Alta ──────────────────────────────────────────────────────────────────
  describe('POST /api/v1/coupons', () => {
    it('crea un cupón y aparece en el detalle', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
        code: `${PREFIJO}-X10`, name: `${PREFIJO} x10`, type: 'PERCENT_TICKET', value: 10,
        scope: 'TICKET', startDate: inicio(), maxUsesPerCustomer: 1, isPrivate: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe(`${PREFIJO}-X10`);
      expect(res.body.maxUsesPerCustomer).toBe(1);
      expect(res.body.isPrivate).toBe(true);
      expect(res.body.estado).toBe('activo');
      expect(res.body.alcanceResumen).toBe('Ticket completo');

      const detalle = await request(app.getHttpServer()).get(`/api/v1/coupons/${res.body.id}`).set(auth(ownerToken));
      expect(detalle.status).toBe(200);
      expect(detalle.body.code).toBe(`${PREFIJO}-X10`);
    });

    it('código repetido en el mismo negocio → 400', async () => {
      const body = { code: `${PREFIJO}-DUP`, name: `${PREFIJO} dup`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: inicio() };
      await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send(body);
      const dup = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({ ...body, name: `${PREFIJO} dup 2` });
      expect(dup.status).toBe(400);
      expect(dup.body.message).toContain('código');
    });

    it('porcentaje fuera de rango → 400', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
        code: `${PREFIJO}-BAD`, name: `${PREFIJO} bad`, type: 'PERCENT_TICKET', value: 150, scope: 'TICKET', startDate: inicio(),
      });
      expect(res.status).toBe(400);
    });

    it('empleado (sin rol owner/admin) → 403', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(employeeToken)).send({
        code: `${PREFIJO}-EMP`, name: `${PREFIJO} emp`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: inicio(),
      });
      expect(res.status).toBe(403);
    });
  });

  // ── Edición ─────────────────────────────────────────────────────────────────
  describe('PUT /api/v1/coupons/:id', () => {
    it('edita nombre y valor', async () => {
      const c = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
        code: `${PREFIJO}-ED`, name: `${PREFIJO} ed`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: inicio(),
      });
      const upd = await request(app.getHttpServer()).put(`/api/v1/coupons/${c.body.id}`).set(auth(ownerToken)).send({
        code: `${PREFIJO}-ED`, name: `${PREFIJO} ed v2`, type: 'PERCENT_TICKET', value: 15, scope: 'TICKET', startDate: inicio(),
      });
      expect(upd.status).toBe(200);
      expect(upd.body.name).toBe(`${PREFIJO} ed v2`);
      expect(upd.body.value).toBe(15);
    });
  });

  // ── Toggle + baja ─────────────────────────────────────────────────────────
  describe('PATCH /toggle + DELETE', () => {
    it('toggle invierte isActive y el estado', async () => {
      const c = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
        code: `${PREFIJO}-TG`, name: `${PREFIJO} tg`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: inicio(),
      });
      const off = await request(app.getHttpServer()).patch(`/api/v1/coupons/${c.body.id}/toggle`).set(auth(ownerToken));
      expect(off.body.estado).toBe('inactivo');
      const on = await request(app.getHttpServer()).patch(`/api/v1/coupons/${c.body.id}/toggle`).set(auth(ownerToken));
      expect(on.body.estado).toBe('activo');
    });

    it('baja: soft-delete, deja de aparecer en el listado', async () => {
      const c = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
        code: `${PREFIJO}-DEL`, name: `${PREFIJO} del`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: inicio(),
      });
      const del = await request(app.getHttpServer()).delete(`/api/v1/coupons/${c.body.id}`).set(auth(ownerToken));
      expect(del.status).toBe(200);
      const list = await request(app.getHttpServer()).get('/api/v1/coupons?limit=100').set(auth(ownerToken));
      expect(list.body.data.some((x: { id: string }) => x.id === c.body.id)).toBe(false);
      // El código de un cupón dado de baja queda tomado (el @@unique del schema
      // incluye las filas soft-deleted): recrearlo da 400 legible, no un 500.
      const reuso = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
        code: `${PREFIJO}-DEL`, name: `${PREFIJO} del reuso`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET', startDate: inicio(),
      });
      expect(reuso.status).toBe(400);
    });
  });
});
