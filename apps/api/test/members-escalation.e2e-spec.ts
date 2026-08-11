import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';

// (Auditoría F1-F4 — Ale) Integración del fix CRÍTICO de escalación de
// privilegios en editar miembro (RBT-641). Los tests son READ-ONLY / de
// permiso denegado / 422 a propósito: NO mutan el seed (no resetean ni
// renombran de verdad), para no romper el login con la contraseña seedeada
// que usan las otras suites ni los re-runs.

describe('Members — escalación de privilegios (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let employeeToken: string;
  let ownerMemberId: string;
  let employeeMemberId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });
    employeeToken = empRes.body.token;

    // Ubico los memberId de owner y employee desde la lista real.
    const lista = await request(app.getHttpServer())
      .get('/api/v1/members')
      .set(auth(ownerToken));
    const members: Array<{ id: string; role: { name: string } }> = lista.body;
    ownerMemberId = members.find((m) => m.role.name === 'owner')!.id;
    employeeMemberId = members.find((m) => m.role.name !== 'owner')!.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /members con owner → 200 y lista al menos al dueño', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/members').set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((m: any) => m.role.name === 'owner')).toBe(true);
  });

  it('un empleado NO puede editar miembros (PUT /members/:id → 403)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/members/${employeeMemberId}`)
      .set(auth(employeeToken))
      .send({ name: 'Hackeado' });
    expect(res.status).toBe(403);
  });

  it('un empleado NO puede resetear contraseñas (POST /members/:id/reset-password → 403)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/members/${employeeMemberId}/reset-password`)
      .set(auth(employeeToken))
      .send({ sendEmail: false });
    expect(res.status).toBe(403);
  });

  it('no se puede resetear la contraseña del dueño desde acá (→ 422)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/members/${ownerMemberId}/reset-password`)
      .set(auth(ownerToken))
      .send({ sendEmail: false });
    expect(res.status).toBe(422);
  });

  it('un empleado NO puede quitar miembros (DELETE /members/:id → 403)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/members/${employeeMemberId}`)
      .set(auth(employeeToken));
    expect(res.status).toBe(403);
  });
});
