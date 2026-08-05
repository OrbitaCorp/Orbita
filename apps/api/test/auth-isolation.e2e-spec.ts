/**
 * Tests de aislamiento multi-tenant.
 * Requiere: seed corrido (pnpm seed), server corriendo en localhost:3000.
 *
 * Se prueban los 8 escenarios de aislamiento de la spec.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';

const SLUG_A = 'zapatoslorena';
const PASSWORD = 'Test1234!';

const OWNER_B_EMAIL = `ownerb-${Date.now()}@test.com`;

describe('Auth Isolation (8 escenarios)', () => {
  let app: INestApplication;
  let ownerAToken: string;
  let customerBToken: string;
  let SLUG_B: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Limpiar customer stale de Lorena en tiendas B previas
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.customer.deleteMany({
        where: {
          email: 'dueno@zapatoslorena.test',
          business: { subdomain: { startsWith: 'tienda-b-test' } },
        },
      });
    } finally {
      await prisma.$disconnect();
    }

    // Crear tienda B vía onboarding
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/register-business')
      .send({
        ownerName: 'Owner B',
        email: OWNER_B_EMAIL,
        password: PASSWORD,
        businessName: 'Tienda B Test',
      });
    expect(regRes.status).toBe(201);
    SLUG_B = regRes.body.business.subdomain;

    // Login owner de tienda A (sin slug → panel)
    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'dueno@zapatoslorena.test', password: PASSWORD });
    expect(loginA.status).toBe(201);
    ownerAToken = loginA.body.token;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ── Test 1: Member de tienda A hace login en tienda B → error ──
  it('1. Lorena (member de A) hace login en tienda B → NO_ACCOUNT_IN_BUSINESS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-business-slug', SLUG_B)
      .send({ email: 'dueno@zapatoslorena.test', password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NO_ACCOUNT_IN_BUSINESS');
  });

  // ── Test 2: Dueña de A se registra como cliente en B → se crea customer separado ──
  it('2. Lorena (dueña de A) se registra como cliente en B → customer independiente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-business-slug', SLUG_B)
      .send({
        email: 'dueno@zapatoslorena.test',
        password: 'OtraPassword123!',
        firstName: 'Lorena',
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('customer');
  });

  // ── Test 3: Lorena cambia su contraseña en B → no afecta A ──
  it('3. Lorena cambia contraseña en B → A mantiene la original', async () => {
    // Login en B con la contraseña nueva
    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-business-slug', SLUG_B)
      .send({ email: 'dueno@zapatoslorena.test', password: 'OtraPassword123!' });
    expect(loginB.status).toBe(201);
    expect(loginB.body.type).toBe('customer');
    customerBToken = loginB.body.token;

    // Login en A con la contraseña original sigue funcionando
    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-business-slug', SLUG_A)
      .send({ email: 'dueno@zapatoslorena.test', password: PASSWORD });
    expect(loginA.status).toBe(201);
    expect(loginA.body.type).toBe('member');
  });

  // ── Test 4: Lorena es member de A y customer de B, login en B → customer ──
  it('4. Lorena login en B → entra como customer, nunca como member', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-business-slug', SLUG_B)
      .send({ email: 'dueno@zapatoslorena.test', password: 'OtraPassword123!' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('customer');
    expect(res.body.customer).toBeDefined();
    expect(res.body.member).toBeUndefined();
  });

  // ── Test 5: Reset password en B → solo afecta B ──
  it('5. Forgot password en B → solo aplica a customer de B', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .set('x-business-slug', SLUG_B)
      .send({ email: 'dueno@zapatoslorena.test' });

    // Siempre 201 (no revela si el email existe)
    expect(res.status).toBe(201);

    // Verificar que el token creado sea para tienda B
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: { email: 'dueno@zapatoslorena.test' },
        orderBy: { createdAt: 'desc' },
        include: { business: { select: { subdomain: true } } },
      });
      expect(resetToken).not.toBeNull();
      expect(resetToken.business.subdomain).toBe(SLUG_B);
      expect(resetToken.userType).toBe('CUSTOMER');
    } finally {
      await prisma.$disconnect();
    }
  });

  // ── Test 6: 6 intentos fallidos en B → bloqueo, A no afectada ──
  it('6. 5 intentos fallidos en B → bloqueo 15min, A no se bloquea', async () => {
    // 5 intentos fallidos en B
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-business-slug', SLUG_B)
        .send({ email: 'dueno@zapatoslorena.test', password: 'MalaMalaMala!' });
    }

    // El 6to intento (con contraseña correcta) debe fallar por bloqueo
    const blocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-business-slug', SLUG_B)
      .send({ email: 'dueno@zapatoslorena.test', password: 'OtraPassword123!' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toContain('bloqueada');

    // La cuenta en A NO está bloqueada
    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-business-slug', SLUG_A)
      .send({ email: 'dueno@zapatoslorena.test', password: PASSWORD });
    expect(loginA.status).toBe(201);
    expect(loginA.body.type).toBe('member');
  });

  // ── Test 7: JWT de tienda A usado en request a API de tienda B → 401 ──
  it('7. JWT de tienda A usado en tienda B → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('x-business-slug', SLUG_B);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('no válido para este negocio');
  });

  // ── Test 8: Registro duplicado en B → error ──
  it('8. Lorena intenta registrarse de nuevo en B → error "Ya tenés cuenta"', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-business-slug', SLUG_B)
      .send({
        email: 'dueno@zapatoslorena.test',
        password: 'OtraOtra123!',
        firstName: 'Lorena',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Ya tenés cuenta');
  });
});
