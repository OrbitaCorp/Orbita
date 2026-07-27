import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';

// Cobertura del tercer tipo de identidad: super admin de plataforma.
// - login en el apex (sin slug) detecta al admin ANTES que a un member
// - el token de admin resuelve en /auth/me como platform_admin
// - el AuthGuard + PlatformAdminGuard protegen /platform/*
describe('Platform admin auth (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /auth/login (apex, sin slug)', () => {
    it('super admin → 201, type platform_admin, sin business', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.platformAdmin.email, password: SEED_USERS.platformAdmin.password });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('platform_admin');
      expect(res.body.token).toBeDefined();
      expect(res.body.admin).toMatchObject({ email: SEED_USERS.platformAdmin.email, role: 'SUPERADMIN' });
      expect(res.body.business).toBeUndefined();
      adminToken = res.body.token;
    });

    it('super admin con contraseña incorrecta → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_USERS.platformAdmin.email, password: 'malísima' });

      expect(res.status).toBe(401);
    });

    it('con X-Business-Slug NO se resuelve como admin (el apex es el único punto)', async () => {
      // Con slug, el login busca member/customer de ESE negocio; el admin no es
      // ninguno de los dos ahí → NO debe loguear como platform_admin.
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-business-slug', SEED_BUSINESS_SLUG)
        .send({ email: SEED_USERS.platformAdmin.email, password: SEED_USERS.platformAdmin.password });

      expect(res.body.type).not.toBe('platform_admin');
    });
  });

  describe('GET /auth/me', () => {
    it('con token de admin → type platform_admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('platform_admin');
      expect(res.body.admin.role).toBe('SUPERADMIN');
    });
  });

  describe('Guards de /platform/*', () => {
    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/platform/businesses');
      expect(res.status).toBe(401);
    });

    it('con token de owner (member) → 403 (no es platform_admin)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/businesses')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(403);
    });

    it('con token de admin → pasa el guard (no 401/403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/businesses')
        .set('Authorization', `Bearer ${adminToken}`);
      // El endpoint todavía es stub (Fase B); lo que se verifica acá es que el
      // guard deja pasar al admin, no el contenido.
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
