import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';

// Auditoría interna del super admin (/platform/audit). Corre contra la base
// real (como todos los e2e): crea un ítem a mano, lo edita, lo borra, y toca
// un ítem del seed dejándolo como estaba en afterAll.
describe('Platform audit (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let itemSeedId: string;
  let seedOriginal: { estado: string; responsableId: string | null; checks: { id: string; hecho: boolean }[] };
  let customId: string | null = null;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    app = await createTestApp();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.platformAdmin.email, password: SEED_USERS.platformAdmin.password });
    adminToken = res.body.token;
    const member = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    memberToken = member.body.token;
  });

  afterAll(async () => {
    if (customId) await request(app.getHttpServer()).delete(`/api/v1/platform/audit/items/${customId}`).set(auth());
    if (itemSeedId && seedOriginal) {
      await request(app.getHttpServer()).put(`/api/v1/platform/audit/items/${itemSeedId}`).set(auth()).send({
        estado: seedOriginal.estado,
        responsableId: seedOriginal.responsableId,
        checks: seedOriginal.checks,
      });
    }
    await closeTestApp();
  });

  it('un member de negocio no entra (403)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/audit').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /platform/audit siembra la lista base y devuelve resumen + admins', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/audit').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(100);
    expect(res.body.resumen.total).toBe(res.body.items.length);
    expect(Array.isArray(res.body.admins)).toBe(true);
    const auth_ = res.body.items.find((i: { key: string }) => i.key === 'api.auth');
    expect(auth_).toBeDefined();
    expect(auth_.checks.length).toBeGreaterThan(3);
    itemSeedId = auth_.id;
    seedOriginal = { estado: auth_.estado, responsableId: auth_.responsable?.id ?? null, checks: auth_.checks.map((c: { id: string; hecho: boolean }) => ({ id: c.id, hecho: c.hecho })) };
    // Un segundo GET no duplica nada.
    const res2 = await request(app.getHttpServer()).get('/api/v1/platform/audit').set(auth());
    expect(res2.body.items.length).toBe(res.body.items.length);
  });

  it('PUT tilda checks, cambia estado y registra quién lo hizo', async () => {
    const check = seedOriginal.checks[0];
    const r1 = await request(app.getHttpServer()).put(`/api/v1/platform/audit/items/${itemSeedId}`).set(auth())
      .send({ checks: [{ id: check.id, hecho: true }], estado: 'EN_CURSO' });
    expect(r1.status).toBe(200);
    expect(r1.body.checks.find((c: { id: string }) => c.id === check.id).hecho).toBe(true);
    expect(r1.body.estado).toBe('EN_CURSO');
    expect(r1.body.actualizadoPor?.name).toBeTruthy();

    const r2 = await request(app.getHttpServer()).put(`/api/v1/platform/audit/items/${itemSeedId}`).set(auth()).send({ estado: 'HECHO' });
    expect(r2.body.estado).toBe('HECHO');
    expect(r2.body.hechoPor?.name).toBeTruthy();
    expect(r2.body.hechoAt).toBeTruthy();
  });

  it('PUT rechaza un informe que no sea http(s)', async () => {
    const res = await request(app.getHttpServer()).put(`/api/v1/platform/audit/items/${itemSeedId}`).set(auth()).send({ informeUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('POST crea un ítem a mano y DELETE lo borra; el seed no se borra', async () => {
    const creado = await request(app.getHttpServer()).post('/api/v1/platform/audit/items').set(auth()).send({
      area: 'TRANSVERSAL', grupo: 'Pruebas e2e', titulo: 'Ítem de prueba', foco: 'Creado por el e2e, se borra solo.', checks: ['Primera verificación', 'Segunda verificación'],
    });
    expect(creado.status).toBe(201);
    expect(creado.body.esPersonalizado).toBe(true);
    expect(creado.body.checks).toHaveLength(2);
    customId = creado.body.id;

    const noBorra = await request(app.getHttpServer()).delete(`/api/v1/platform/audit/items/${itemSeedId}`).set(auth());
    expect(noBorra.status).toBe(403);

    const borra = await request(app.getHttpServer()).delete(`/api/v1/platform/audit/items/${customId}`).set(auth());
    expect(borra.status).toBe(200);
    customId = null;
  });
});
