import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-629) CRUD de direcciones del cliente en /me/addresses. Todo scopeado por
// el customerId del token (assertCustomerContext): un cliente nunca ve ni toca
// direcciones de otro cliente ni de otro negocio.
describe('Me addresses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken: string;
  let customerId: string;
  let otherCustomerToken: string;
  let otherCustomerId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: SEED_USERS.customerWithAccount.email, password: SEED_USERS.customerWithAccount.password });
    customerToken = login.body.token;
    customerId = login.body.customer.id;

    // Segundo cliente del MISMO negocio, creado al vuelo, para el test de aislamiento.
    const otherEmail = `addr-other-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: otherEmail, password: 'Test1234!', firstName: 'Otro', lastName: 'Cliente' });
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: otherEmail, password: 'Test1234!' });
    otherCustomerToken = otherLogin.body.token;
    otherCustomerId = otherLogin.body.customer.id;
  });

  afterAll(async () => {
    // Limpieza: borrar las direcciones creadas por los dos clientes de test, y el
    // cliente creado al vuelo (cascadea sus direcciones, pero por las dudas primero).
    await prisma.address.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
    await prisma.customer.deleteMany({ where: { id: otherCustomerId } });
    await closeTestApp();
  });

  it('crea una dirección con todos los campos y aparece en el listado del mismo cliente', async () => {
    const alta = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(customerToken)).send({
      alias: 'Casa', street: 'Falsa 123', floor: '5', depto: 'B', entreCalles: 'Corrientes y Callao',
      provincia: 'Buenos Aires', city: 'CABA', zip: '1000', isDefault: true,
    });
    expect(alta.status).toBe(201);
    expect(alta.body.provincia).toBe('Buenos Aires');
    expect(alta.body.depto).toBe('B');
    expect(alta.body.entreCalles).toBe('Corrientes y Callao');

    const lista = await request(app.getHttpServer()).get('/api/v1/me/addresses').set(auth(customerToken));
    expect(lista.status).toBe(200);
    expect(lista.body.some((a: { id: string }) => a.id === alta.body.id)).toBe(true);
  });

  it('un cliente no puede editar una dirección de otro cliente → 404', async () => {
    const otra = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(otherCustomerToken)).send({
      street: 'Otra calle', city: 'CABA',
    });
    expect(otra.status).toBe(201);

    const editar = await request(app.getHttpServer())
      .put(`/api/v1/me/addresses/${otra.body.id}`)
      .set(auth(customerToken)) // cliente DISTINTO al dueño
      .send({ street: 'Hackeada', city: 'CABA' });
    expect(editar.status).toBe(404); // no revela que existe

    // Y no puede verla en su propio listado.
    const lista = await request(app.getHttpServer()).get('/api/v1/me/addresses').set(auth(customerToken));
    expect(lista.body.some((a: { id: string }) => a.id === otra.body.id)).toBe(false);
  });

  it('marcar una dirección como default desmarca la anterior', async () => {
    const a1 = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(customerToken)).send({ street: 'A', city: 'CABA', isDefault: true });
    const a2 = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(customerToken)).send({ street: 'B', city: 'CABA', isDefault: true });
    expect(a2.body.isDefault).toBe(true);

    const lista = await request(app.getHttpServer()).get('/api/v1/me/addresses').set(auth(customerToken));
    const a1Actualizada = lista.body.find((a: { id: string }) => a.id === a1.body.id);
    expect(a1Actualizada.isDefault).toBe(false);
  });

  it('baja: la dirección deja de aparecer en el listado', async () => {
    const a = await request(app.getHttpServer()).post('/api/v1/me/addresses').set(auth(customerToken)).send({ street: 'Para borrar', city: 'CABA' });
    const del = await request(app.getHttpServer()).delete(`/api/v1/me/addresses/${a.body.id}`).set(auth(customerToken));
    expect(del.status).toBe(200);
    const lista = await request(app.getHttpServer()).get('/api/v1/me/addresses').set(auth(customerToken));
    expect(lista.body.some((x: { id: string }) => x.id === a.body.id)).toBe(false);
  });

  it('sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/addresses');
    expect(res.status).toBe(401);
  });
});
