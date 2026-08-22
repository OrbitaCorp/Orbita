import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';

describe('Business (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Login as owner
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;

    // Login as employee
    const employeeRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });
    employeeToken = employeeRes.body.token;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ── GET /business ───────────────────────────────────────────────────────

  describe('GET /api/v1/business', () => {
    it('con token owner → 200, datos del negocio seedeado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'Zapatos Lorena',
        subdomain: SEED_BUSINESS_SLUG,
      });
    });

    it('con token employee → 200 (lectura permitida a cualquier miembro)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Zapatos Lorena');
    });

    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/business');

      expect(res.status).toBe(401);
    });
  });

  // ── PUT /business ───────────────────────────────────────────────────────

  describe('PUT /api/v1/business', () => {
    let originalDescription: string | null;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`);
      originalDescription = res.body.description;
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .put('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ description: originalDescription });
    });

    it('con token owner, cambiando description → 200', async () => {
      const newDesc = 'Descripción actualizada por test e2e';
      const res = await request(app.getHttpServer())
        .put('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ description: newDesc });

      expect(res.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getRes.body.description).toBe(newDesc);
    });

    it('mandar mode en el body → se ignora (whitelist: true)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ mode: 'SHOWCASE' });

      expect(res.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`);
      // mode should remain FULL (seed value), not change to SHOWCASE
      expect(getRes.body.mode).toBe('FULL');
    });

    it('con token employee → 403 (requiere owner o admin)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/business')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ description: 'intento empleado' });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /business/pause ────────────────────────────────────────────────

  describe('POST /api/v1/business/pause', () => {
    afterAll(async () => {
      // Restore isPaused to false
      await request(app.getHttpServer())
        .post('/api/v1/business/pause')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ paused: false });
    });

    it('con token employee → 403 (requiere owner)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/business/pause')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ paused: true });

      expect(res.status).toBe(403);
    });

    it('con token owner, paused: true → 200, negocio pausado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/business/pause')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ paused: true });

      expect(res.status).toBe(201);

      const getRes = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getRes.body.isPaused).toBe(true);
    });

    it('con token owner, paused: false → 200, negocio reanudado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/business/pause')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ paused: false });

      expect(res.status).toBe(201);

      const getRes = await request(app.getHttpServer())
        .get('/api/v1/business')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getRes.body.isPaused).toBe(false);
    });
  });

  // ── GET/PUT /business/config ────────────────────────────────────────────

  describe('GET/PUT /api/v1/business/config', () => {
    let originalConfig: Record<string, unknown>;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business/config')
        .set('Authorization', `Bearer ${ownerToken}`);
      originalConfig = res.body;
    });

    afterAll(async () => {
      // Restore original config
      const { id, businessId, createdAt, updatedAt, ...restoreData } = originalConfig;
      await request(app.getHttpServer())
        .put('/api/v1/business/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(restoreData);
    });

    it('GET con token owner → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business/config')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('businessId');
    });

    // "Coordinar por WhatsApp" (acceptsTransfer) ya no pide CBU/alias — el
    // negocio coordina el pago directo por WhatsApp, sin mostrar datos
    // bancarios en el checkout. Antes esto se llamaba "Transferencia" y
    // exigía transferAlias; esa validación se sacó a propósito.
    it('PUT acceptsTransfer: true sin transferAlias → 200', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/business/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ acceptsTransfer: false, transferAlias: '' });

      const res = await request(app.getHttpServer())
        .put('/api/v1/business/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ acceptsTransfer: true });

      expect(res.status).toBe(200);
    });

    it('PUT acceptsTransfer: true CON transferAlias → 200', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/business/config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ acceptsTransfer: true, transferAlias: 'lorena.cbu.test' });

      expect(res.status).toBe(200);
    });
  });

  // ── GET/PUT /business/storefront-config ─────────────────────────────────

  describe('GET/PUT /api/v1/business/storefront-config', () => {
    it('GET con token owner → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business/storefront-config')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('showReviews');
    });

    it('PUT con heroSlides válido → 200', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/business/storefront-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          heroSlides: [
            { id: 'slide-1', titulo: 'Test', subtitulo: 'Sub', img: null, cta: 'Comprar' },
          ],
        });

      expect(res.status).toBe(200);
    });

    it('PUT con heroSlides inválido (falta titulo) → 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/business/storefront-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          heroSlides: [
            { id: 'slide-bad', subtitulo: 'Sub', img: null, cta: 'Comprar' },
          ],
        });

      expect(res.status).toBe(400);
    });
  });

  // ── GET/PUT /business/notification-config ───────────────────────────────

  describe('GET/PUT /api/v1/business/notification-config', () => {
    let originalMatrix: Record<string, unknown>;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business/notification-config')
        .set('Authorization', `Bearer ${ownerToken}`);
      originalMatrix = res.body.matrix;
    });

    afterAll(async () => {
      if (originalMatrix) {
        await request(app.getHttpServer())
          .put('/api/v1/business/notification-config')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ matrix: originalMatrix });
      }
    });

    it('GET con token owner → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/business/notification-config')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('matrix');
    });

    it('PUT con evento válido → 200', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/business/notification-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          matrix: {
            nuevo_pedido: { panel: true, email: true, whatsapp: false },
          },
        });

      expect(res.status).toBe(200);
    });

    it('PUT con evento inventado → 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/business/notification-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          matrix: {
            evento_que_no_existe: { panel: true, email: true, whatsapp: false },
          },
        });

      expect(res.status).toBe(400);
    });
  });
});
