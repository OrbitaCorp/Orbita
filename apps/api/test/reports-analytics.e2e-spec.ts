import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';

// (Fase 4 — Ale) Integración de Dashboard y Reporte de clientes (RBT-636/639).
// Read-only: valida el shape real de las respuestas contra el seed.

describe('Reports analytics (e2e)', () => {
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

  describe('GET /reports/dashboard', () => {
    it('devuelve KPIs, alertas, serie de la semana, top y actividad', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/dashboard')
        .set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.kpis).toEqual(
        expect.objectContaining({
          ventas: expect.any(Number),
          pedidos: expect.any(Number),
          ticketPromedio: expect.any(Number),
          clientesNuevos: expect.any(Number),
          deltas: expect.any(Object),
        }),
      );
      expect(res.body.alertas).toEqual(
        expect.objectContaining({
          stockCritico: expect.any(Number),
          pagosPorConfirmar: expect.any(Number),
          pedidosPendientes: expect.any(Number),
          pedidosSinAtender: expect.any(Number),
        }),
      );
      expect(res.body.serieSemana.labels).toHaveLength(7);
      expect(res.body.serieSemana.valores).toHaveLength(7);
      expect(res.body.top).toEqual(
        expect.objectContaining({ productos: expect.any(Array), categorias: expect.any(Array), canal: expect.any(Array) }),
      );
      expect(Array.isArray(res.body.actividad)).toBe(true);
    });

    it('acepta un rango from/to', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/dashboard')
        .query({ from: '2026-01-01', to: '2026-12-31' })
        .set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.kpis).toBeDefined();
    });

    it('rango inválido (from > to) → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/dashboard')
        .query({ from: '2026-12-31', to: '2026-01-01' })
        .set(auth(ownerToken));
      expect(res.status).toBe(400);
    });

    it('sin token → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/reports/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /reports/customers', () => {
    it('devuelve métricas, segmentación (4 segmentos) y top', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/customers')
        .set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.metricas).toEqual(
        expect.objectContaining({
          activos: expect.any(Number),
          nuevosMes: expect.any(Number),
          recurrentesPct: expect.any(Number),
          ltvPromedio: expect.any(Number),
          totalClientes: expect.any(Number),
        }),
      );
      const segmentos = res.body.segmentacion.map((s: any) => s.segmento).sort();
      expect(segmentos).toEqual(['inactivo', 'nuevo', 'recurrente', 'vip']);
      expect(Array.isArray(res.body.topClientes)).toBe(true);
      expect(Array.isArray(res.body.clientes)).toBe(true);
    });
  });
});
