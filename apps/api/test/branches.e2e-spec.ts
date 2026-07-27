import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';

describe('Branches (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let employeeToken: string;
  let defaultBranchId: string;
  let createdBranchId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;

    const employeeRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });
    employeeToken = employeeRes.body.token;
  });

  afterAll(async () => {
    // Cleanup: delete any test branch that was created
    if (createdBranchId) {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${createdBranchId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
    }
    await closeTestApp();
  });

  // ── GET /branches ───────────────────────────────────────────────────────

  describe('GET /api/v1/branches', () => {
    it('con token owner → 200, incluye sucursal "Principal"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const principal = res.body.find((b: { name: string }) => b.name === 'Principal');
      expect(principal).toBeDefined();
      expect(principal.isDefault).toBe(true);
      defaultBranchId = principal.id;
    });

    it('con token employee → 200 (lectura permitida a cualquier miembro)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
    });
  });

  // ── POST /branches ──────────────────────────────────────────────────────

  describe('POST /api/v1/branches', () => {
    it('con token employee → 403 (requiere owner)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Sucursal Test Empleado' });

      expect(res.status).toBe(403);
    });

    it('con token owner → 201, crea sucursal nueva', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sucursal E2E Test', address: 'Calle Test 123' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Sucursal E2E Test' });
      expect(res.body.id).toBeDefined();
      createdBranchId = res.body.id;
    });
  });

  // ── DELETE /branches/:id ────────────────────────────────────────────────

  describe('DELETE /api/v1/branches/:id', () => {
    it('con token employee → 403 (requiere owner)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${createdBranchId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });

    it('eliminar sucursal creada en test → 200', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${createdBranchId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true });
      createdBranchId = ''; // Already deleted, skip afterAll cleanup
    });

    it('intentar eliminar sucursal "Principal" (default) → 422', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${defaultBranchId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(422);
    });
  });
});
