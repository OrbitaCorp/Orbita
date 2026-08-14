import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-645) Endpoints de la campana del panel: listar, contar no leídas,
// marcar una/todas como leídas. El motor de despacho (dispatch()) se cubre
// aparte en notifications.service.unit-spec.ts — acá solo la capa HTTP.
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { businessId, title: { startsWith: '[e2e-notif]' } } });
    await closeTestApp();
  });

  describe('GET /api/v1/notifications', () => {
    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('con token → 200, lista paginada', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/notifications').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toMatchObject({ page: 1, limit: 20 });
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('devuelve un contador numérico', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/notifications/unread-count').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(typeof res.body.count).toBe('number');
    });
  });

  describe('PATCH /api/v1/notifications/:id/read y /read-all', () => {
    it('marca una notificación como leída', async () => {
      const n = await prisma.notification.create({
        data: { businessId, event: 'nuevo_pedido', title: '[e2e-notif] test', body: 'body', isRead: false },
      });
      const res = await request(app.getHttpServer()).patch(`/api/v1/notifications/${n.id}/read`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const updated = await prisma.notification.findUnique({ where: { id: n.id } });
      expect(updated?.isRead).toBe(true);
    });

    it('notificación de otro negocio → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read')
        .set(auth(ownerToken));
      expect(res.status).toBe(404);
    });

    it('marca todas como leídas', async () => {
      await prisma.notification.create({
        data: { businessId, event: 'nuevo_pedido', title: '[e2e-notif] test2', body: 'body', isRead: false },
      });
      const res = await request(app.getHttpServer()).patch('/api/v1/notifications/read-all').set(auth(ownerToken));
      expect(res.status).toBe(200);
      const count = await prisma.notification.count({ where: { businessId, isRead: false, title: { startsWith: '[e2e-notif]' } } });
      expect(count).toBe(0);
    });
  });
});
