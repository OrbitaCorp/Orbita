import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let customerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ── POST /auth/login ────────────────────────────────────────────────────
  // Login tests go first because we need tokens for subsequent tests.

  describe('POST /api/v1/auth/login', () => {
    it('login exitoso como owner (sin header) → 201, type member', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ type: 'member' });
      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBeDefined();
      expect(res.body.permissions).toBeInstanceOf(Array);
      expect(res.body.business).toMatchObject({ subdomain: SEED_BUSINESS_SLUG });
      ownerToken = res.body.token;
    });

    it('login exitoso como empleado (sin header) → 201, type member, rol empleado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ type: 'member' });
      expect(res.body.token).toBeDefined();
    });

    it('login exitoso como customer con cuenta (con header) → 201, type customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-business-slug', SEED_BUSINESS_SLUG)
        .send({
          email: SEED_USERS.customerWithAccount.email,
          password: SEED_USERS.customerWithAccount.password,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ type: 'customer' });
      expect(res.body.token).toBeDefined();
      expect(res.body.customer).toBeDefined();
      customerToken = res.body.token;
    });

    it('login con contraseña incorrecta → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.owner.email, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
    });

    it('login con email inexistente → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'noexiste@example.com', password: 'Test1234!' });

      expect(res.status).toBe(401);
    });

    it('login de member enviando header X-Business-Slug → devuelve type member (ignora header)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-business-slug', SEED_BUSINESS_SLUG)
        .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });

      // Login prioriza member sobre customer — el header se ignora si el usuario es miembro.
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ type: 'member' });
    });
  });

  // ── POST /auth/register ─────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    const uniqueEmail = `test-e2e-${Date.now()}@example.com`;

    it('registro exitoso con email nuevo → 201, devuelve message (sin token)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('x-business-slug', SEED_BUSINESS_SLUG)
        .send({
          email: uniqueEmail,
          password: 'Test1234!',
          firstName: 'TestE2E',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Cuenta creada');
    });

    it('registro sin header X-Business-Slug → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'another@example.com',
          password: 'Test1234!',
          firstName: 'Test',
        });

      expect(res.status).toBe(400);
    });

    it('registro con slug de negocio inexistente → 404', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('x-business-slug', 'negocio-que-no-existe')
        .send({
          email: 'otro@example.com',
          password: 'Test1234!',
          firstName: 'Test',
        });

      expect(res.status).toBe(404);
    });

    it('registro con email de customerWithoutAccount vincula al existente (no duplica)', async () => {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const countBefore = await prisma.customer.count({
          where: { email: SEED_USERS.customerWithoutAccount.email, deletedAt: null },
        });
        expect(countBefore).toBe(1);

        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .set('x-business-slug', SEED_BUSINESS_SLUG)
          .send({
            email: SEED_USERS.customerWithoutAccount.email,
            password: 'Test1234!',
            firstName: 'Vinculado',
          });

        expect(res.status).toBe(201);
        expect(res.body.message).toContain('Cuenta creada');

        // No debe crear un customer duplicado — vinculó al existente
        const countAfter = await prisma.customer.count({
          where: { email: SEED_USERS.customerWithoutAccount.email, deletedAt: null },
        });
        expect(countAfter).toBe(1);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

  // ── GET /auth/me ────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    it('con token de owner (sin header) → 200, type member', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ type: 'member' });
      expect(res.body.business).toMatchObject({ subdomain: SEED_BUSINESS_SLUG });
    });

    it('con token de customer (con header) → 200, type customer', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-business-slug', SEED_BUSINESS_SLUG);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ type: 'customer' });
    });

    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('con token inválido → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token-invalido-random-string');

      expect(res.status).toBe(401);
    });
  });

  // ── Regresión: member con header X-Business-Slug ─────────────────────────

  describe('Regresión: member token + header X-Business-Slug', () => {
    it('GET /auth/me con token de member + header X-Business-Slug → sigue siendo type member', async () => {
      // Login as owner without header
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
      expect(loginRes.status).toBe(201);
      expect(loginRes.body.type).toBe('member');

      // Use that SAME token with X-Business-Slug header — must still resolve as member
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .set('x-business-slug', SEED_BUSINESS_SLUG);

      expect(meRes.status).toBe(200);
      expect(meRes.body.type).toBe('member');
    });

    it('GET /business con token de member + header X-Business-Slug → sigue siendo member (no 403/401)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-business-slug', SEED_BUSINESS_SLUG);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Zapatos Lorena');
    });
  });

  // ── POST /auth/logout ───────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('con refreshToken válido → 201, revoca el token', async () => {
      // Login fresh to get a disposable refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: loginRes.body.refreshToken });

      expect([200, 201]).toContain(res.status);
    });

    it('sin refreshToken → 201 (no-op silencioso)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({});

      expect([200, 201]).toContain(res.status);
    });
  });

  // ── POST /auth/forgot-password ──────────────────────────────────────────

  describe('POST /api/v1/auth/forgot-password', () => {
    it('con email existente + slug → 201, crea token scopeado a ESE negocio', async () => {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .set('x-business-slug', SEED_BUSINESS_SLUG)
          .send({ email: SEED_USERS.owner.email });

        expect(res.status).toBe(201);

        const resetToken = await prisma.passwordResetToken.findFirst({
          where: { email: SEED_USERS.owner.email },
          orderBy: { createdAt: 'desc' },
          include: { business: { select: { subdomain: true } } },
        });
        expect(resetToken).not.toBeNull();
        expect(resetToken.userType).toBe('MEMBER');
        expect(resetToken.business.subdomain).toBe(SEED_BUSINESS_SLUG);
      } finally {
        await prisma.$disconnect();
      }
    });

    it('con email inexistente + slug → 201 (no filtra información), no crea ningún token', async () => {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const email = 'noexiste-forgot@example.com';
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .set('x-business-slug', SEED_BUSINESS_SLUG)
          .send({ email });

        expect(res.status).toBe(201);

        const count = await prisma.passwordResetToken.count({ where: { email } });
        expect(count).toBe(0);
      } finally {
        await prisma.$disconnect();
      }
    });

    it('sin header X-Business-Slug + email de member (dueño) → resuelve GLOBALMENTE, crea token MEMBER para su propio negocio', async () => {
      // Mismo criterio que login(): un dueño que no recuerda el subdominio de
      // su tienda puede pedir el reset desde orbita.com sin slug. Se prueba el
      // efecto real (token creado, con el businessId y userType correctos), no
      // solo el status code — 201 por sí solo no distingue "encontrado" de
      // "no revelado" (ver caso de email inexistente arriba).
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: SEED_USERS.owner.email });

        expect(res.status).toBe(201);

        const resetToken = await prisma.passwordResetToken.findFirst({
          where: { email: SEED_USERS.owner.email },
          orderBy: { createdAt: 'desc' },
          include: { business: { select: { subdomain: true } } },
        });
        expect(resetToken).not.toBeNull();
        expect(resetToken.userType).toBe('MEMBER');
        // Sin slug en el request, igual resuelve el negocio REAL del dueño
        // (member.businessId) — no un negocio arbitrario ni ninguno.
        expect(resetToken.business.subdomain).toBe(SEED_BUSINESS_SLUG);
      } finally {
        await prisma.$disconnect();
      }
    });

    it('sin header X-Business-Slug + email de customer (sin cuenta de member) → NUNCA se resuelve, no crea ningún token', async () => {
      // Confirma la otra mitad del criterio: sin slug, el flujo SOLO busca en
      // `member` — un customer puro (sin ser también member de ningún
      // negocio) nunca genera un token, aunque el email exista y tenga
      // password seteado. Se verifica por conteo antes/después en vez de
      // confiar en el status code, que es 201 en ambos casos (encontrado o
      // no) por diseño anti-enumeración.
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const email = SEED_USERS.customerWithAccount.email;

        const memberWithThisEmail = await prisma.member.findFirst({ where: { email } });
        expect(memberWithThisEmail).toBeNull(); // precondición: no es member de nada

        const countBefore = await prisma.passwordResetToken.count({ where: { email } });

        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email });

        expect(res.status).toBe(201); // no filtra información

        const countAfter = await prisma.passwordResetToken.count({ where: { email } });
        expect(countAfter).toBe(countBefore); // ningún token nuevo — nunca se buscó como customer
      } finally {
        await prisma.$disconnect();
      }
    });

    it('sin header X-Business-Slug + email inexistente → 201 (no filtra información), no crea ningún token', async () => {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const email = 'noexiste-forgot-sin-slug@example.com';
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email });

        expect(res.status).toBe(201);

        const count = await prisma.passwordResetToken.count({ where: { email } });
        expect(count).toBe(0);
      } finally {
        await prisma.$disconnect();
      }
    });

    it('anti-enumeración: respuesta IDÉNTICA entre customer-sin-member y email inexistente (sin slug)', async () => {
      const customerEmail = SEED_USERS.customerWithAccount.email;
      const fakeEmail = 'definitivamente-no-existe@example.com';

      const [resCustomer, resFake] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: customerEmail }),
        request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: fakeEmail }),
      ]);

      expect(resCustomer.status).toBe(201);
      expect(resFake.status).toBe(201);
      expect(resCustomer.status).toBe(resFake.status);
      expect(resCustomer.body).toEqual(resFake.body);
      expect(resCustomer.headers['content-type']).toBe(resFake.headers['content-type']);
    });
  });

  // ── POST /auth/accept-invitation ────────────────────────────────────────
  // NOTE: Not covered automatically — requires a PENDING member with hasTempPassword=true.
  // The seed creates members as ACTIVE. Documenting as uncovered case.

  describe('POST /api/v1/auth/accept-invitation', () => {
    it.todo('flujo completo de aceptar invitación (requiere member PENDING en seed)');
  });
});
