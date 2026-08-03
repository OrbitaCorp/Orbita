import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-615/616 — vista del cliente) GET /storefront/:slug/coupons: lista pública
// (sin auth) de los cupones que el comprador puede copiar. Solo públicos, activos,
// vigentes y no agotados.
const PREFIJO = '[e2e-sf-cupones]';

describe('Storefront public coupons (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const inicio = () => new Date(Date.now() - 86400000).toISOString();

  const crearCupon = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = owner.body.token;
    businessId = owner.body.business.id;
  });

  afterAll(async () => {
    await prisma.discount.deleteMany({ where: { businessId, name: { startsWith: PREFIJO } } });
    await closeTestApp();
  });

  it('lista los cupones públicos y excluye privados y expirados (sin auth)', async () => {
    await crearCupon({ code: `${PREFIJO}-PUB`, name: `${PREFIJO} publico`, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: inicio() });
    await crearCupon({ code: `${PREFIJO}-PRIV`, name: `${PREFIJO} privado`, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: inicio(), isPrivate: true });
    await crearCupon({
      code: `${PREFIJO}-EXP`, name: `${PREFIJO} expirado`, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET',
      startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      endDate: new Date(Date.now() - 86400000).toISOString(),
    });

    const res = await request(app.getHttpServer()).get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/coupons`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const codigos = res.body.map((c: { code: string }) => c.code);
    expect(codigos).toContain(`${PREFIJO}-PUB`);
    expect(codigos).not.toContain(`${PREFIJO}-PRIV`);
    expect(codigos).not.toContain(`${PREFIJO}-EXP`);

    const pub = res.body.find((c: { code: string }) => c.code === `${PREFIJO}-PUB`);
    expect(pub).toMatchObject({ type: 'PERCENT_TICKET', value: 10 });
    // No se filtran datos internos.
    expect(pub).not.toHaveProperty('usesConsumed');
    expect(pub).not.toHaveProperty('createdBy');
  });

  it('cupón agotado (usesConsumed >= maxUsesTotal) no aparece', async () => {
    const alta = await crearCupon({
      code: `${PREFIJO}-AGOT`, name: `${PREFIJO} agotado`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET',
      startDate: inicio(), maxUsesTotal: 1,
    });
    await prisma.discount.update({ where: { id: alta.body.id }, data: { usesConsumed: 1 } });

    const res = await request(app.getHttpServer()).get(`/api/v1/storefront/${SEED_BUSINESS_SLUG}/coupons`);
    const codigos = res.body.map((c: { code: string }) => c.code);
    expect(codigos).not.toContain(`${PREFIJO}-AGOT`);
  });

  it('negocio inexistente → 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/storefront/no-existe-jamas/coupons');
    expect(res.status).toBe(404);
  });
});
