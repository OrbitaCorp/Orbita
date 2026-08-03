import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (RBT-631) Sesiones activas: listar (con dispositivo/IP), cerrar una, y cerrar
// las demás preservando la actual. Todo scopeado al customerId del token.
describe('Me sessions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerId: string;
  let email: string;
  const PASSWORD = 'Test1234!';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  // Un login = una sesión nueva (nuevo refresh token). Devuelve access + refresh.
  async function login(): Promise<{ access: string; refresh: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .set('User-Agent', 'jest-test-agent')
      .send({ email, password: PASSWORD });
    return { access: res.body.token, refresh: res.body.refreshToken };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    email = `me-sessions-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: PASSWORD, firstName: 'Sesiones', lastName: 'Test' });
    const primer = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email, password: PASSWORD });
    customerId = primer.body.customer.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await closeTestApp();
  });

  it('lista las sesiones activas con deviceInfo y marca la actual', async () => {
    const s1 = await login();
    await login(); // segunda sesión

    const res = await request(app.getHttpServer())
      .get('/api/v1/me/sessions')
      .set(auth(s1.access))
      .set('x-refresh-token', s1.refresh);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some((s: { isCurrent: boolean }) => s.isCurrent)).toBe(true);
    const actual = res.body.find((s: { isCurrent: boolean }) => s.isCurrent);
    expect(actual.deviceInfo).toBeTruthy();
    expect(actual.deviceInfo.userAgent).toContain('jest-test-agent');
  });

  it('revoca una sesión específica: su refresh token deja de funcionar', async () => {
    const principal = await login();
    const victima = await login();

    // Encontrar el id de la sesión víctima (pasándola como "actual" al listar).
    const lista = await request(app.getHttpServer())
      .get('/api/v1/me/sessions')
      .set(auth(principal.access))
      .set('x-refresh-token', victima.refresh);
    const victimaSession = lista.body.find((s: { isCurrent: boolean }) => s.isCurrent);
    expect(victimaSession).toBeDefined();

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/me/sessions/${victimaSession.id}`)
      .set(auth(principal.access));
    expect(del.status).toBe(200);

    // El refresh de la sesión revocada ya no sirve; el de la principal sí.
    const refreshVictima = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: victima.refresh });
    expect(refreshVictima.status).toBe(401);
    const refreshPrincipal = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: principal.refresh });
    expect(refreshPrincipal.status).toBe(201);
  });

  it('cerrar las demás sesiones preserva la actual', async () => {
    const actual = await login();
    const otra = await login();

    const res = await request(app.getHttpServer())
      .post('/api/v1/me/sessions/revoke-all')
      .set(auth(actual.access))
      .set('x-refresh-token', actual.refresh);
    expect(res.status).toBe(201);

    // La "otra" sesión murió; la actual sigue viva.
    const refreshOtra = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: otra.refresh });
    expect(refreshOtra.status).toBe(401);
    const refreshActual = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: actual.refresh });
    expect(refreshActual.status).toBe(201);
  });

  it('un cliente no puede revocar una sesión de otro cliente → 404', async () => {
    const otroEmail = `me-sessions-other-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register').set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: otroEmail, password: PASSWORD, firstName: 'Otro' });
    const otroLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login').set('X-Business-Slug', SEED_BUSINESS_SLUG)
      .send({ email: otroEmail, password: PASSWORD });
    const otroCustomerId = otroLogin.body.customer.id;

    // Sesión del cliente principal.
    const principal = await login();
    const lista = await request(app.getHttpServer())
      .get('/api/v1/me/sessions').set(auth(principal.access)).set('x-refresh-token', principal.refresh);
    const sesionAjena = lista.body.find((s: { isCurrent: boolean }) => s.isCurrent);

    // El OTRO cliente intenta revocar la sesión del principal → 404.
    const del = await request(app.getHttpServer())
      .delete(`/api/v1/me/sessions/${sesionAjena.id}`).set(auth(otroLogin.body.token));
    expect(del.status).toBe(404);

    await prisma.refreshToken.deleteMany({ where: { userId: otroCustomerId } });
    await prisma.customer.deleteMany({ where: { id: otroCustomerId } });
  });

  it('sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/sessions');
    expect(res.status).toBe(401);
  });
});
