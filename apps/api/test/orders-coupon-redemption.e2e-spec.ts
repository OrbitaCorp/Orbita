import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-616) Canje automático al crear el pedido: si `discountCode` viene en el
// body de POST /orders, se valida server-side y se escribe el
// DiscountRedemption + se incrementa Discount.usesConsumed en la MISMA
// transacción que crea el pedido (no al confirmarlo — así lo pide el ticket).
const PREFIJO = '[e2e-canje-pedido]';

describe('Orders coupon redemption (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
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

    const customer = await prisma.customer.findFirst({
      where: { businessId, email: SEED_USERS.customerWithAccount.email, deletedAt: null },
      select: { id: true },
    });
    customerId = customer!.id;

    const variantes = await prisma.productVariant.findMany({
      where: { product: { businessId, deletedAt: null } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 1,
    });
    variantA = variantes[0].id;
  });

  afterAll(async () => {
    // Borrar primero las órdenes (cascadea sus DiscountRedemption) y recién
    // después los cupones — al revés, la FK de discount_redemptions lo impide.
    await prisma.order.deleteMany({ where: { businessId, redemptions: { some: { discount: { name: { startsWith: PREFIJO } } } } } });
    await prisma.discount.deleteMany({ where: { businessId, name: { startsWith: PREFIJO } } });
    await closeTestApp();
  });

  it('crea orden con discountCode válido: registra el canje y descuenta el total', async () => {
    const code = `${PREFIJO}-CANJE`;
    const cupon = await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
      code, name: `${PREFIJO} canje`, type: 'PERCENT_TICKET', value: 10, scope: 'TICKET', startDate: inicio(),
    });
    expect(cupon.status).toBe(201);

    const orden = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken)).send({
      channel: 'ONLINE',
      customerId,
      items: [{ variantId: variantA, quantity: 1 }],
      discountCode: code,
    });
    expect(orden.status).toBe(201);
    expect(Number(orden.body.discountTotal)).toBeGreaterThan(0);
    expect(Number(orden.body.total)).toBe(Number(orden.body.subtotal) - Number(orden.body.discountTotal));

    const redencion = await prisma.discountRedemption.findFirst({ where: { orderId: orden.body.id } });
    expect(redencion).not.toBeNull();
    expect(redencion!.discountId).toBe(cupon.body.id);
    expect(redencion!.channel).toBe('STOREFRONT');
    expect(redencion!.customerId).toBe(customerId);

    const cuponActualizado = await prisma.discount.findUnique({ where: { id: cupon.body.id } });
    expect(cuponActualizado!.usesConsumed).toBe(1);
  });

  it('crea orden con discountCode inválido → 400, no crea la orden ni la redención', async () => {
    const conteoAntes = await prisma.order.count({ where: { businessId } });
    const res = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken)).send({
      channel: 'ONLINE',
      customerId,
      items: [{ variantId: variantA, quantity: 1 }],
      discountCode: `${PREFIJO}-NOEXISTE`,
    });
    expect(res.status).toBe(400);
    const conteoDespues = await prisma.order.count({ where: { businessId } });
    expect(conteoDespues).toBe(conteoAntes);
  });

  it('respeta maxUsesPerCustomer: la segunda orden del mismo cliente con el mismo cupón → 400', async () => {
    const code = `${PREFIJO}-UNOPORCLIENTE`;
    await request(app.getHttpServer()).post('/api/v1/coupons').set(auth(ownerToken)).send({
      code, name: `${PREFIJO} unopor`, type: 'PERCENT_TICKET', value: 5, scope: 'TICKET',
      startDate: inicio(), maxUsesPerCustomer: 1,
    });

    const primera = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken)).send({
      channel: 'ONLINE', customerId, items: [{ variantId: variantA, quantity: 1 }], discountCode: code,
    });
    expect(primera.status).toBe(201);

    const segunda = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken)).send({
      channel: 'ONLINE', customerId, items: [{ variantId: variantA, quantity: 1 }], discountCode: code,
    });
    expect(segunda.status).toBe(400);
  });
});
