import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-630 datos personales + RBT-631 cambio de contraseña) /me y /me/change-password.
// Todo scopeado por el customerId del token. El avatar (POST /me/avatar) sube a
// Supabase Storage real — no se cubre por e2e acá (ver PENDIENTES.md).
describe('Me profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken: string;
  let customerId: string;
  let businessId: string;
  let otherEmailSameBusiness: string;
  let createdIds: string[] = [];

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  // Registra + loguea un customer nuevo en un negocio dado; devuelve token + id.
  async function nuevoCliente(email: string, slug: string) {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Business-Slug', slug)
      .send({ email, password: 'Test1234!', firstName: 'Test', lastName: 'User' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Business-Slug', slug)
      .send({ email, password: 'Test1234!' });
    return { token: login.body.token as string, id: login.body.customer.id as string };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    businessId = ownerRes.body.business.id;

    // Cliente principal del test (creado al vuelo para no ensuciar la fixture del seed).
    const email = `me-profile-${Date.now()}@example.com`;
    const c = await nuevoCliente(email, SEED_BUSINESS_SLUG);
    customerToken = c.token;
    customerId = c.id;
    createdIds.push(customerId);

    // Otro cliente del MISMO negocio, para probar el email único por tienda.
    otherEmailSameBusiness = `me-profile-other-${Date.now()}@example.com`;
    const other = await nuevoCliente(otherEmailSameBusiness, SEED_BUSINESS_SLUG);
    createdIds.push(other.id);
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
    await closeTestApp();
  });

  it('GET /me devuelve el perfil del cliente logueado', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me').set(auth(customerToken));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(customerId);
    expect(res.body).toHaveProperty('phone');
    expect(res.body).toHaveProperty('birthDate');
    expect(res.body).toHaveProperty('avatarUrl');
  });

  it('actualiza nombre/telefono/fecha de nacimiento/DNI', async () => {
    const res = await request(app.getHttpServer()).patch('/api/v1/me').set(auth(customerToken)).send({
      firstName: 'Nuevo Nombre', phone: '+54 9 11 0000-0000', birthDate: '1995-03-20', dni: '30111222',
    });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Nuevo Nombre');
    expect(res.body.dni).toBe('30111222');
    expect(new Date(res.body.birthDate).getUTCFullYear()).toBe(1995);
  });

  it('cambiar el email a uno ya usado por otro cliente DEL MISMO negocio → 400', async () => {
    const res = await request(app.getHttpServer()).patch('/api/v1/me').set(auth(customerToken)).send({
      email: otherEmailSameBusiness,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ya está en uso/);
  });

  it('cambia la contraseña con la actual correcta', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/me/change-password').set(auth(customerToken)).send({
      currentPassword: 'Test1234!', newPassword: 'NuevaPassword456!',
    });
    expect(res.status).toBe(201);

    // La contraseña vieja ya no sirve; la nueva sí.
    const loginViejo = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: (await prisma.customer.findUnique({ where: { id: customerId } }))!.email, password: 'Test1234!' });
    expect(loginViejo.status).toBe(401);
  });

  it('cambiar contraseña con la actual incorrecta → 401', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/me/change-password').set(auth(customerToken)).send({
      currentPassword: 'Incorrecta', newPassword: 'OtraMas789!',
    });
    expect(res.status).toBe(401);
  });

  it('GET /me sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me');
    expect(res.status).toBe(401);
  });
});
