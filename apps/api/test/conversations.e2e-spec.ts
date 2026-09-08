import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// Chat cliente↔tienda (RBT-657). El módulo no tenía ningún test — ver
// docs/superpowers/plans/2026-09-08-mensajeria-deuda-tecnica.md. Cubre el flujo
// completo, el aislamiento negocio/cliente, y las regresiones de la auditoría
// (abrir una conversación no debe reordenar la bandeja; validación de texto y
// de orderId de mención).
describe('Conversations / mensajería (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let variantA: string;
  let clienteAToken: string;
  let clienteAId: string;
  let clienteBToken: string;
  let clienteBId: string;
  const creados: string[] = [];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function nuevoCliente(tag: string) {
    const email = `conv-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
    await request(app.getHttpServer()).post('/api/v1/auth/register')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: 'Test1234!', firstName: tag, lastName: 'Test' });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: 'Test1234!' });
    return { token: login.body.token as string, id: login.body.customer.id as string };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const owner = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = owner.body.token;
    businessId = owner.body.business.id;

    const variantes = await prisma.productVariant.findMany({
      where: { product: { businessId, deletedAt: null } }, select: { id: true }, orderBy: { id: 'asc' }, take: 1,
    });
    variantA = variantes[0].id;

    const a = await nuevoCliente('a'); clienteAToken = a.token; clienteAId = a.id; creados.push(clienteAId);
    const b = await nuevoCliente('b'); clienteBToken = b.token; clienteBId = b.id; creados.push(clienteBId);
  });

  afterAll(async () => {
    // Conversation → Customer es onDelete: RESTRICT, así que hay que borrar
    // las conversaciones (y por cascada sus mensajes) antes que los clientes.
    await prisma.conversation.deleteMany({ where: { customerId: { in: creados } } });
    await prisma.order.deleteMany({ where: { businessId, customerId: { in: creados } } });
    await prisma.customer.deleteMany({ where: { id: { in: creados } } });
    await closeTestApp();
  });

  // ── Flujo cliente → tienda → cliente ──────────────────────────────────────

  it('cliente sin mensajes: GET /me/conversation devuelve id null y sin mensajes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/conversation')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(200);
    expect(res.body).toEqual({ id: null, messages: [] });
  });

  it('el primer mensaje del cliente crea la conversación y aparece en la bandeja como no leída', async () => {
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ text: 'Hola, consulta por mi pedido' }).expect(201);

    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations')
      .set(auth(ownerToken)).expect(200);
    const conv = bandeja.body.find((c: any) => c.customerId === clienteAId);
    expect(conv).toBeTruthy();
    expect(conv.isUnread).toBe(true);
    expect(conv.lastMessage.text).toBe('Hola, consulta por mi pedido');
  });

  it('abrir la conversación (GET messages) la marca leída SIN cambiar updatedAt', async () => {
    const bandeja1 = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const conv = bandeja1.body.find((c: any) => c.customerId === clienteAId);
    const updatedAtAntes = conv.updatedAt;

    const msgs = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${conv.id}/messages`).set(auth(ownerToken)).expect(200);
    expect(Array.isArray(msgs.body)).toBe(true);

    const bandeja2 = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const convDespues = bandeja2.body.find((c: any) => c.id === conv.id);
    expect(convDespues.isUnread).toBe(false);
    expect(convDespues.updatedAt).toBe(updatedAtAntes); // el mark-as-read NO bumpeó updatedAt
  });

  it('la respuesta del staff se guarda y el cliente ve el hilo en orden', async () => {
    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const conv = bandeja.body.find((c: any) => c.customerId === clienteAId);
    await request(app.getHttpServer()).post(`/api/v1/conversations/${conv.id}/messages`)
      .set(auth(ownerToken)).send({ text: 'Hola! Ya lo despachamos' }).expect(201);

    const hilo = await request(app.getHttpServer()).get('/api/v1/me/conversation')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(200);
    expect(hilo.body.messages.map((m: any) => [m.sender, m.text])).toEqual([
      ['CUSTOMER', 'Hola, consulta por mi pedido'],
      ['STORE', 'Hola! Ya lo despachamos'],
    ]);
  });

  it('mención válida: un pedido del propio cliente se acepta', async () => {
    const pedido = await request(app.getHttpServer()).post('/api/v1/orders').set(auth(ownerToken))
      .send({ channel: 'ONLINE', customerId: clienteAId, items: [{ variantId: variantA, quantity: 1 }] });
    expect(pedido.status).toBe(201);

    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const conv = bandeja.body.find((c: any) => c.customerId === clienteAId);
    await request(app.getHttpServer()).post(`/api/v1/conversations/${conv.id}/messages`)
      .set(auth(ownerToken)).send({ text: `Sobre tu pedido #${pedido.body.orderNumber}`, orderId: pedido.body.id })
      .expect(201);
  });

  // ── Aislamiento ──────────────────────────────────────────────────────────

  it('cliente B no ve el hilo de cliente A', async () => {
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteBToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ text: 'soy otro cliente' }).expect(201);
    const hiloB = await request(app.getHttpServer()).get('/api/v1/me/conversation')
      .set(auth(clienteBToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(200);
    expect(hiloB.body.messages).toHaveLength(1);
    expect(hiloB.body.messages[0].text).toBe('soy otro cliente');
  });

  it('un customer no puede pegarle a la bandeja del panel (403)', async () => {
    await request(app.getHttpServer()).get('/api/v1/conversations')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).expect(403);
  });

  it('GET de una conversación inexistente devuelve 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/conversations/00000000-0000-0000-0000-000000000000/messages')
      .set(auth(ownerToken)).expect(404);
  });

  // ── Validación ───────────────────────────────────────────────────────────

  it('mensaje vacío o de solo espacios → 400', async () => {
    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const convId = bandeja.body.find((c: any) => c.customerId === clienteAId).id;
    await request(app.getHttpServer()).post(`/api/v1/conversations/${convId}/messages`)
      .set(auth(ownerToken)).send({ text: '   ' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG).send({ text: '' }).expect(400);
  });

  it('mensaje de más de 5000 caracteres → 400', async () => {
    await request(app.getHttpServer()).post('/api/v1/me/conversation/messages')
      .set(auth(clienteAToken)).set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ text: 'x'.repeat(5001) }).expect(400);
  });

  it('sendMessage del staff con un orderId que no es del cliente → 404', async () => {
    const bandeja = await request(app.getHttpServer()).get('/api/v1/conversations').set(auth(ownerToken)).expect(200);
    const convId = bandeja.body.find((c: any) => c.customerId === clienteAId).id;
    await request(app.getHttpServer()).post(`/api/v1/conversations/${convId}/messages`)
      .set(auth(ownerToken))
      .send({ text: 'sobre un pedido', orderId: '00000000-0000-0000-0000-000000000000' }).expect(404);
  });

  it('GET /customers/:id expone tracking en cada pedido', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/customers/${clienteAId}`).set(auth(ownerToken)).expect(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(res.body.orders[0]).toHaveProperty('tracking');
  });

  it('unread-count devuelve un número', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/conversations/unread-count').set(auth(ownerToken)).expect(200);
    expect(typeof res.body.count).toBe('number');
  });
});
