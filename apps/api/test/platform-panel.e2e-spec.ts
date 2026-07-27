import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';

// Verifica que los endpoints de lectura del super panel corran de verdad contra
// la DB (las queries de Prisma con groupBy/aggregate no las cacha el typecheck).
describe('Platform panel — lecturas (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    app = await createTestApp();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.platformAdmin.email, password: SEED_USERS.platformAdmin.password });
    adminToken = res.body.token;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /platform/overview → KPIs coherentes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/overview').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.businesses.total).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.subscriptions.mrr).toBe('number');
    expect(res.body.domains.subdomainsInUse).toBe(res.body.businesses.total);
    expect(Array.isArray(res.body.businesses.byIndustry)).toBe(true);
  });

  it('GET /platform/businesses → lista paginada con dueño y contadores', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/businesses?limit=5').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    const zapatos = res.body.data.find((b: { subdomain: string }) => b.subdomain === 'zapatoslorena');
    // El negocio seedeado tiene dueño y contadores.
    if (zapatos) {
      expect(zapatos.owner).not.toBeNull();
      expect(zapatos.counts).toHaveProperty('products');
    }
  });

  it('GET /platform/businesses?search= filtra', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/platform/businesses?search=zapatoslorena')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.some((b: { subdomain: string }) => b.subdomain === 'zapatoslorena')).toBe(true);
  });

  it('GET /platform/domains → subdominios + dominios custom', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/domains').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.subdomains)).toBe(true);
    expect(Array.isArray(res.body.customDomains)).toBe(true);
    expect(res.body.subdomains.some((s: { subdomain: string }) => s.subdomain === 'zapatoslorena')).toBe(true);
  });

  it('GET /platform/owners → dueños cross-negocio', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/owners').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((o: { email: string }) => o.email === SEED_USERS.owner.email)).toBe(true);
  });

  it('GET /platform/subscriptions → 200 lista', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/subscriptions').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /platform/businesses/:id → detalle con métricas y equipo', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/platform/businesses?search=zapatoslorena')
      .set(auth());
    const target = list.body.data.find((b: { subdomain: string }) => b.subdomain === 'zapatoslorena');
    expect(target).toBeDefined();

    const res = await request(app.getHttpServer()).get(`/api/v1/platform/businesses/${target.id}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.subdomain).toBe('zapatoslorena');
    expect(res.body.metrics).toHaveProperty('salesAllTime');
    expect(Array.isArray(res.body.team)).toBe(true);
    expect(res.body.team.some((m: { role: string }) => m.role === 'owner')).toBe(true);
  });

  it('GET /platform/admins → me incluye a mí', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/admins').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.some((a: { email: string }) => a.email === SEED_USERS.platformAdmin.email)).toBe(true);
  });
});
