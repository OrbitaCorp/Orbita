import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-616) POST /discounts/validate — el endpoint real de "validar cupón":
// existe, está vigente, no agotó sus usos totales ni el límite por cliente.
// No tiene efectos secundarios (no canjea) — eso lo hace OrdersService.create()
// al crear el pedido (ver orders-coupon-redemption.e2e-spec.ts).
const PREFIJO = '[e2e-cupones-validate]';

describe('Coupons validate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let customerToken: string;
  let customerId: string;
  let variantA: string;

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

    const customerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: SEED_USERS.customerWithAccount.email, password: SEED_USERS.customerWithAccount.password });
    customerToken = customerRes.body.token;
    customerId = customerRes.body.customer.id;

    const variantes = await prisma.productVariant.findMany({
      where: { product: { businessId, deletedAt: null } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 1,
    });
    variantA = variantes[0].id;
  });

  afterAll(async () => {
    await prisma.discount.deleteMany({ where: { businessId, name: { startsWith: PREFIJO } } });
    await closeTestApp();
  });

  const itemsCarrito = () => [{ variantId: variantA, quantity: 1 }];

  it('cupón inexistente → valid:false', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/discounts/validate')
      .set(auth(customerToken))
      .send({ code: `${PREFIJO}-NOEXISTE`, items: itemsCarrito() });
    expect(res.status).toBe(201);
    expect(res.body.valid).toBe(false);
  });

  it('cupón vigente y dentro de límites → valid:true con discountTotal > 0', async () => {
    const code = `${PREFIJO}-OK`;
    await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
      code, name: `${PREFIJO} ok`, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: inicio(),
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/discounts/validate')
      .set(auth(customerToken))
      .send({ code, items: itemsCarrito() });
    expect(res.status).toBe(201);
    expect(res.body.valid).toBe(true);
    expect(res.body.discount.discountTotal).toBeGreaterThan(0);
  });

  it('cupón expirado → valid:false', async () => {
    const code = `${PREFIJO}-EXP`;
    await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
      code, name: `${PREFIJO} exp`, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET',
      startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      endDate: new Date(Date.now() - 86400000).toISOString(),
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/discounts/validate')
      .set(auth(customerToken))
      .send({ code, items: itemsCarrito() });
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/expiró/);
  });

  it('cupón que ya alcanzó maxUsesTotal → valid:false', async () => {
    const alta = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
      code: `${PREFIJO}-AGOTADO`, name: `${PREFIJO} agotado`, type: 'PERCENT_TICKET', value: 10,
      scope: 'TICKET', startDate: inicio(), maxUsesTotal: 1,
    });
    await prisma.discount.update({ where: { id: alta.body.id }, data: { usesConsumed: 1 } });
    const res = await request(app.getHttpServer())
      .post('/api/v1/discounts/validate')
      .set(auth(customerToken))
      .send({ code: `${PREFIJO}-AGOTADO`, items: itemsCarrito() });
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/agotó/);
  });

  it('cliente que ya usó su límite personal → valid:false', async () => {
    const alta = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
      code: `${PREFIJO}-PERCLIENTE`, name: `${PREFIJO} percliente`, type: 'PERCENT_TICKET', value: 10,
      scope: 'TICKET', startDate: inicio(), maxUsesPerCustomer: 1,
    });
    const branch = await prisma.branch.findFirst({ where: { businessId }, select: { id: true } });
    const maxNum = await prisma.order.aggregate({ where: { businessId }, _max: { orderNumber: true } });
    const order = await prisma.order.create({
      data: {
        businessId, branchId: branch!.id, orderNumber: (maxNum._max.orderNumber ?? 0) + 1,
        channel: 'ONLINE', subtotal: 1000, discountTotal: 100, total: 900, customerId,
      },
    });
    await prisma.discountRedemption.create({
      data: { businessId, orderId: order.id, discountId: alta.body.id, customerId, channel: 'STOREFRONT', amount: 100 },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/discounts/validate')
      .set(auth(customerToken))
      .send({ code: `${PREFIJO}-PERCLIENTE`, items: itemsCarrito(), customerId });
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/máximo de veces/);

    await prisma.order.deleteMany({ where: { id: order.id } });
  });

  it('sin token → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/discounts/validate')
      .send({ code: `${PREFIJO}-OK`, items: itemsCarrito() });
    expect(res.status).toBe(401);
  });
});
