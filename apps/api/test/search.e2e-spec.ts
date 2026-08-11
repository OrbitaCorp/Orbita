import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';

// (Auditoría/Fase 4 — Ale) Integración de la búsqueda global (RBT-644).
// Read-only: no muta nada.

describe('Search global (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

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

  it('GET /search con owner devuelve los 4 grupos como arrays', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'za' })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        query: 'za',
        pedidos: expect.any(Array),
        clientes: expect.any(Array),
        productos: expect.any(Array),
        descuentos: expect.any(Array),
      }),
    );
  });

  it('un término de menos de 2 caracteres no busca nada (grupos vacíos)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'z' })
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.pedidos).toEqual([]);
    expect(res.body.clientes).toEqual([]);
    expect(res.body.productos).toEqual([]);
    expect(res.body.descuentos).toEqual([]);
  });

  it('sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/search').query({ q: 'za' });
    expect(res.status).toBe(401);
  });
});
