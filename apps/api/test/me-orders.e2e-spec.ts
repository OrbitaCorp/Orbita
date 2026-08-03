import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-628) "Mis pedidos" del storefront: GET /me/orders (lista + resumen) y
// GET /me/orders/:id (detalle). Scopeado por businessId + customerId del token:
// un cliente solo ve SUS pedidos.
describe('Me orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let variantA: string;
  let customerToken: string;
  let customerId: string;
  let otherToken: string;
  let otherCustomerId: string;
  const createdCustomerIds: string[] = [];

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function nuevoCliente(): Promise<{ token: string; id: string; email: string }> {
    const email = `me-orders-${Date.now()}-${Math.round(Number(String(Date.now()).slice(-4)))}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register').set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: 'Test1234!', firstName: 'Pedidos', lastName: 'Test' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: 'Test1234!' });
    return { token: login.body.token, id: login.body.customer.id, email };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = owner.body.token;
    businessId = owner.body.business.id;

    const variantes = await prisma.productVariant.findMany({
      where: { product: { businessId, deletedAt: null } }, select: { id: true }, orderBy: { id: 'asc' }, take: 1,
    });
    variantA = variantes[0].id;

    const c = await nuevoCliente();
    customerToken = c.token; customerId = c.id; createdCustomerIds.push(customerId);
    const o = await nuevoCliente();
    otherToken = o.token; otherCustomerId = o.id; createdCustomerIds.push(otherCustomerId);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { businessId, customerId: { in: createdCustomerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await closeTestApp();
  });

  // Crea un pedido para `customerId` vía el panel (owner). Devuelve el pedido.
  async function crearPedidoPara(cid: string) {
    const res = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken)).send({
      channel: 'ONLINE', customerId: cid, items: [{ variantId: variantA, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    return res.body;
  }

  it('lista solo los pedidos del cliente logueado, con resumen', async () => {
    await crearPedidoPara(customerId);
    await crearPedidoPara(customerId);

    const res = await request(app.getHttpServer()).get('/api/v1/me/orders').set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.resumen.cantidadPedidos).toBe(res.body.data.length);
    expect(res.body.resumen.totalGastado).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('itemCount');
  });

  it('el detalle de un pedido propio trae items y estado', async () => {
    const pedido = await crearPedidoPara(customerId);
    const res = await request(app.getHttpServer()).get(`/api/v1/me/orders/${pedido.id}`).set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pedido.id);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('un cliente NO puede ver el detalle del pedido de otro cliente → 404', async () => {
    const pedidoAjeno = await crearPedidoPara(otherCustomerId);
    const res = await request(app.getHttpServer()).get(`/api/v1/me/orders/${pedidoAjeno.id}`).set(auth(customerToken));
    expect(res.status).toBe(404);
  });

  it('un cliente NO ve en su listado los pedidos de otro cliente', async () => {
    const pedidoAjeno = await crearPedidoPara(otherCustomerId);
    const res = await request(app.getHttpServer()).get('/api/v1/me/orders').set(auth(customerToken));
    expect(res.body.data.some((o: { id: string }) => o.id === pedidoAjeno.id)).toBe(false);
  });

  it('sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/orders');
    expect(res.status).toBe(401);
  });
});
