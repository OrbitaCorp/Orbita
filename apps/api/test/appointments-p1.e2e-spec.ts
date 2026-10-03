import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { limpiarNegocios } from './helpers/limpiar-negocio';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { AppointmentsSeedService } from '../src/appointments/panel/appointments-seed.service';
import { fechaArgentina } from '../src/common/utils/hora-argentina';
import { diaDeSemana, instanteDe, sumarDias } from '../src/appointments/horarios/horarios';

// P1 — Núcleo del panel de Turnos (src/appointments/CONTRATO.md § P1), por HTTP
// contra una base de verdad: configuración, servicios, agendas, turnos,
// agenda/resumen, alcance por permisos, aislamiento entre negocios y la doble
// reserva simultánea del mismo horario (una gana, la otra recibe 409).
//
// Crea sus propios negocios (prefijo PREFIJO) y los borra en afterAll.
const PREFIJO = '[e2e-turnos-p1]';
const sufijo = randomBytes(3).toString('hex');

describe('Turnos P1 — núcleo del panel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const negocios: string[] = [];

  let bizA: string; // barbería (turnos)
  let bizC: string; // otro negocio de turnos (aislamiento)
  let bizStore: string; // una tienda
  let tokOwner: string; let tokStaff: string; let tokRecepcion: string; let tokOwnerC: string; let tokStore: string;
  let agendaDuena: string; let agendaJuan: string;
  let corte: { id: string; durationMin: number };
  let fecha: string; // un lunes futuro (la barbería abre 9–13 y 16–20)

  const http = () => request(app.getHttpServer());
  const como = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function crearNegocio(nombre: string, extra: { vertical?: 'STORE' | 'APPOINTMENTS' } = {}) {
    const b = await prisma.business.create({
      data: { name: `${PREFIJO} ${nombre}`, industry: 'barberia', subdomain: `e2e-p1-${nombre.toLowerCase().replace(/\W/g, '')}-${sufijo}`, vertical: extra.vertical ?? 'STORE' },
    });
    negocios.push(b.id);
    await prisma.branch.create({ data: { businessId: b.id, name: 'Principal', isDefault: true } });
    const owner = await prisma.role.create({ data: { businessId: b.id, name: 'owner', isDefault: true } });
    const m = await prisma.member.create({ data: { businessId: b.id, name: `Dueña ${nombre}`, email: `duena-${nombre.toLowerCase().replace(/\W/g, '')}-${sufijo}@e2e.test`, roleId: owner.id, status: 'ACTIVE' } });
    return { id: b.id, ownerMemberId: m.id };
  }
  const token = (memberId: string, businessId: string) => app.get(AuthService).signToken({ sub: memberId, type: 'member', businessId });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const seed = app.get(AppointmentsSeedService);

    const a = await crearNegocio('Barberia');
    bizA = a.id;
    const sembrado = await seed.sembrar(bizA, 'barberia');
    expect(sembrado).toEqual({ settingsCreadas: true, servicios: 5, agendas: 1, roles: 4 });
    tokOwner = token(a.ownerMemberId, bizA);

    // Un barbero con login (rol de fábrica "Barbero": agenda propia) y recepción (todo).
    const rolProfesional = await prisma.role.findFirstOrThrow({ where: { businessId: bizA, appointmentsRoleKey: 'profesional' } });
    const rolRecepcion = await prisma.role.findFirstOrThrow({ where: { businessId: bizA, appointmentsRoleKey: 'recepcion' } });
    const juan = await prisma.member.create({ data: { businessId: bizA, name: 'Juan', email: `juan-${sufijo}@e2e.test`, roleId: rolProfesional.id, status: 'ACTIVE' } });
    const recep = await prisma.member.create({ data: { businessId: bizA, name: 'Rocío', email: `rocio-${sufijo}@e2e.test`, roleId: rolRecepcion.id, status: 'ACTIVE' } });
    tokStaff = token(juan.id, bizA);
    tokRecepcion = token(recep.id, bizA);
    agendaDuena = (await prisma.appointmentResource.findFirstOrThrow({ where: { businessId: bizA, memberId: a.ownerMemberId } })).id;
    agendaJuan = (await prisma.appointmentResource.create({
      data: { businessId: bizA, kind: 'PERSON', name: 'Juan', memberId: juan.id, workDays: [0, 1, 2, 3, 4, 5], sortOrder: 5 },
    })).id;
    const s = await prisma.appointmentService.findFirstOrThrow({ where: { businessId: bizA, name: 'Corte clásico' } });
    corte = { id: s.id, durationMin: s.durationMin };

    const c = await crearNegocio('Otra');
    bizC = c.id;
    await seed.sembrar(bizC, 'canchas');
    tokOwnerC = token(c.ownerMemberId, bizC);

    const t = await crearNegocio('Tienda');
    bizStore = t.id;
    tokStore = token(t.ownerMemberId, bizStore);

    fecha = sumarDias(fechaArgentina(new Date()), 3);
    while (diaDeSemana(fecha) !== 0) fecha = sumarDias(fecha, 1);
  });

  afterAll(async () => {
    await limpiarNegocios(prisma, negocios);
    await closeTestApp();
  });

  // ── Vertical y sembrado ────────────────────────────────────────────────────

  it('una tienda responde 404 "Este negocio no usa Turnos"', async () => {
    const res = await http().get('/api/v1/appointments/settings').set(como(tokStore));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Este negocio no usa Turnos');
    expect((await http().get('/api/v1/appointments').set(como(tokStore))).status).toBe(404);
  });

  it('el sembrado es idempotente', async () => {
    const otra = await app.get(AppointmentsSeedService).sembrar(bizA, 'barberia');
    expect(otra).toEqual({ settingsCreadas: false, servicios: 0, agendas: 0, roles: 0 });
  });

  // ── P1.1 Configuración ─────────────────────────────────────────────────────

  describe('Configuración', () => {
    it('GET: cualquier miembro la lee; alias/CBU y WhatsApp solo para quien configura', async () => {
      await http().put('/api/v1/appointments/settings/payments').set(como(tokOwner))
        .send({ onlineCharge: 'deposit', onSiteMethods: ['CASH', 'QR'], transferAlias: 'barberia.mp', transferCbu: '0'.repeat(22), transferHolder: 'Dueña', showTransferData: true })
        .expect(200);
      const owner = await http().get('/api/v1/appointments/settings').set(como(tokOwner)).expect(200);
      expect(owner.body.rubroKey).toBe('barberia');
      expect(owner.body.agendaMode).toBe('PROFESSIONAL');
      expect(owner.body.payments.transferCbu).toBe('0'.repeat(22));
      expect(owner.body.whatsapp.provider).toBe('stub');
      expect(owner.body.messages.mensajes.map((m: { id: string }) => m.id)).toContain('reprogramacion');
      const staff = await http().get('/api/v1/appointments/settings').set(como(tokStaff)).expect(200);
      expect(staff.body.payments.transferCbu).toBeNull();
      expect(staff.body.payments.transferAlias).toBeNull();
    });

    it('sin appointments.settings.manage: 403', async () => {
      const res = await http().put('/api/v1/appointments/settings/whatsapp').set(como(tokStaff)).send({ number: '1155550101' });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Permiso requerido: appointments.settings.manage');
    });

    it('Datos del negocio: valida modalidades y escribe en cada tabla', async () => {
      const base = { name: 'Barbería Lorena', modalities: ['ON_SITE', 'HOME'], address: 'Av. Siempreviva 742', city: 'CABA', whatsapp: '1155550101', email: 'HOLA@barberia.test' };
      expect((await http().put('/api/v1/appointments/settings/business').set(como(tokOwner)).send({ ...base, modalities: [] })).body.message).toBe('Elegí al menos una forma de atender.');
      const ok = await http().put('/api/v1/appointments/settings/business').set(como(tokOwner)).send(base).expect(200);
      expect(ok.body.business).toMatchObject({ name: 'Barbería Lorena', address: 'Av. Siempreviva 742', city: 'CABA', whatsapp: '1155550101', email: 'hola@barberia.test', modalities: ['ON_SITE', 'HOME'] });
      const canchas = await http().put('/api/v1/appointments/settings/business').set(como(tokOwnerC)).send({ name: 'Complejo', modalities: ['HOME'] });
      expect(canchas.status).toBe(400);
      expect(canchas.body.message).toBe('Una cancha o una clase no se llevan a domicilio.');
      const log = await prisma.auditLog.findFirst({ where: { businessId: bizA, entityType: 'appointment_settings' } });
      expect(log).not.toBeNull();
    });

    it('Apariencia: cambiar de plantilla sin Avanzado es 403 ADDON_REQUIRED:ADVANCED', async () => {
      const res = await http().put('/api/v1/appointments/settings/site').set(como(tokOwner)).send({ siteForm: 'web', simpleDesign: 'tarjeta', appearance: { plantilla: 'barberia-nocturno', color: '#112233' } });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('ADDON_REQUIRED:ADVANCED');
      const sinPlantilla = await http().put('/api/v1/appointments/settings/site').set(como(tokOwner)).send({ siteForm: 'simple', simpleDesign: 'portada', appearance: { color: '#112233', radio: 12 } }).expect(200);
      expect(sinPlantilla.body.site).toEqual({ siteForm: 'simple', simpleDesign: 'portada', appearance: { color: '#112233', radio: 12 } });
      expect((await http().put('/api/v1/appointments/settings/site').set(como(tokOwner)).send({ siteForm: 'web', simpleDesign: 'tarjeta', appearance: { color: 'rojo' } })).status).toBe(400);
    });

    it('Horarios: valida con errorSemana / errorTramos y reemplaza los días especiales', async () => {
      const semana = Array.from({ length: 7 }, (_, i) => (i < 6 ? [[540, 780], [960, 1200]] : []));
      const mal = await http().put('/api/v1/appointments/settings/schedule').set(como(tokOwner)).send({ weekSchedule: semana.slice(0, 6), specialDays: [], vacation: { enabled: false } });
      expect(mal.body.message).toBe('La semana tiene que traer los siete días, de lunes a domingo.');
      const cerrada = await http().put('/api/v1/appointments/settings/schedule').set(como(tokOwner)).send({ weekSchedule: Array(7).fill([]), specialDays: [], vacation: { enabled: false } });
      expect(cerrada.body.message).toBe('Dejá abierto al menos un día de la semana.');
      const dobles = await http().put('/api/v1/appointments/settings/schedule').set(como(tokOwner))
        .send({ weekSchedule: semana, specialDays: [{ date: '2030-01-01', kind: 'CLOSED', ranges: [] }, { date: '2030-01-01', kind: 'CLOSED', ranges: [] }], vacation: { enabled: false } });
      expect(dobles.body.message).toBe('Hay dos días especiales con la misma fecha.');
      const vac = await http().put('/api/v1/appointments/settings/schedule').set(como(tokOwner)).send({ weekSchedule: semana, specialDays: [], vacation: { enabled: true, from: '2030-02-10', to: '2030-02-01' } });
      expect(vac.status).toBe(400);
      const ok = await http().put('/api/v1/appointments/settings/schedule').set(como(tokOwner))
        .send({ weekSchedule: semana, specialDays: [{ date: '2030-01-01', kind: 'CLOSED', ranges: [], reason: 'Año nuevo' }, { date: '2030-01-02', kind: 'SPECIAL', ranges: [[600, 720]] }], vacation: { enabled: false } })
        .expect(200);
      expect(ok.body.schedule.specialDays).toHaveLength(2);
      expect(typeof ok.body.affected).toBe('number');
      const otra = await http().put('/api/v1/appointments/settings/schedule').set(como(tokOwner)).send({ weekSchedule: semana, specialDays: [], vacation: { enabled: false } }).expect(200);
      expect(otra.body.schedule.specialDays).toHaveLength(0);
    });

    it('Reglas de reserva: la grilla tiene que ser del rubro', async () => {
      const actual = (await http().get('/api/v1/appointments/settings').set(como(tokOwner))).body;
      const body = { rules: { ...actual.rules, slotMin: 90 }, policy: actual.policy, account: actual.account };
      const mal = await http().put('/api/v1/appointments/settings/booking').set(como(tokOwner)).send(body);
      expect(mal.status).toBe(400);
      expect(mal.body.message).toBe('La grilla tiene que ser de 15, 30, 60 minutos.');
      const fueraDeLista = await http().put('/api/v1/appointments/settings/booking').set(como(tokOwner)).send({ ...body, rules: { ...actual.rules, depositPercent: 33 } });
      expect(fueraDeLista.status).toBe(400);
      const ok = await http().put('/api/v1/appointments/settings/booking').set(como(tokOwner)).send({ ...body, rules: { ...actual.rules, bufferMin: 0 } }).expect(200);
      expect(ok.body.rules.bufferMin).toBe(0);
    });

    it('Mensajes: una variable desconocida es 400 con la lista de las que hay', async () => {
      const actual = (await http().get('/api/v1/appointments/settings').set(como(tokOwner))).body.messages;
      const mal = await http().put('/api/v1/appointments/settings/messages').set(como(tokOwner))
        .send({ ...actual, mensajes: [{ ...actual.mensajes[0], texto: 'Hola {cliente}' }] });
      expect(mal.status).toBe(400);
      expect(mal.body.message).toBe('La variable {cliente} no existe. Podés usar: {nombre}, {servicio}, {fecha}, {hora}, {profesional}, {negocio}, {link}.');
      await http().put('/api/v1/appointments/settings/messages').set(como(tokOwner)).send(actual).expect(200);
    });

    it('WhatsApp: guarda el número; connected no se escribe', async () => {
      const res = await http().put('/api/v1/appointments/settings/whatsapp').set(como(tokOwner)).send({ number: '5491155550101', connected: true }).expect(200);
      expect(res.body.whatsapp).toEqual({ connected: false, number: '5491155550101', provider: 'stub' });
      expect((await http().put('/api/v1/appointments/settings/whatsapp').set(como(tokOwner)).send({ number: '11-5555' })).status).toBe(400);
    });
  });

  // ── P1.2 Servicios ─────────────────────────────────────────────────────────

  describe('Servicios', () => {
    let creado: string;

    it('lista por orden; nombre repetido (sin acentos ni mayúsculas) es 400', async () => {
      const lista = await http().get('/api/v1/appointments/services').set(como(tokStaff)).expect(200);
      expect(lista.body.map((s: { name: string }) => s.name)).toEqual(['Corte clásico', 'Corte + barba', 'Perfilado de barba', 'Afeitado con toalla caliente', 'Corte infantil']);
      const rep = await http().post('/api/v1/appointments/services').set(como(tokOwner)).send({ name: 'CORTE CLASICO', durationMin: 30, price: 1, bookableOnline: true });
      expect(rep.status).toBe(400);
      expect(rep.body.message).toBe('Ya tenés un servicio con ese nombre.');
    });

    it('crea, edita, ordena y borra (soft); sin services.manage es 403', async () => {
      expect((await http().post('/api/v1/appointments/services').set(como(tokStaff)).send({ name: 'X', durationMin: 30, price: 1, bookableOnline: true })).status).toBe(403);
      const c = await http().post('/api/v1/appointments/services').set(como(tokOwner)).send({ name: 'Color', durationMin: 60, price: 15000.5, bookableOnline: false }).expect(201);
      creado = c.body.id;
      expect(c.body).toMatchObject({ name: 'Color', price: 15000.5, sortOrder: 5, isActive: true });
      expect((await http().post('/api/v1/appointments/services').set(como(tokOwner)).send({ name: 'Y', durationMin: 3, price: 1, bookableOnline: true })).status).toBe(400);
      const u = await http().put(`/api/v1/appointments/services/${creado}`).set(como(tokOwner)).send({ name: 'Color completo', durationMin: 90, price: 18000, bookableOnline: true, isActive: false }).expect(200);
      expect(u.body).toMatchObject({ name: 'Color completo', durationMin: 90, isActive: false });
      expect((await http().get('/api/v1/appointments/services').set(como(tokOwner))).body.some((s: { id: string }) => s.id === creado)).toBe(false);
      expect((await http().get('/api/v1/appointments/services?includeInactive=true').set(como(tokOwner))).body.some((s: { id: string }) => s.id === creado)).toBe(true);

      const ids = (await http().get('/api/v1/appointments/services?includeInactive=true').set(como(tokOwner))).body.map((s: { id: string }) => s.id).reverse();
      const orden = await http().put('/api/v1/appointments/services/order').set(como(tokOwner)).send({ ids }).expect(200);
      expect(orden.body.map((s: { id: string }) => s.id)).toEqual(ids);

      const tpl = await prisma.appointmentClassTemplate.create({ data: { businessId: bizA, serviceId: creado, weekday: 0, startMin: 600, durationMin: 60, capacity: 5 } });
      const usado = await http().delete(`/api/v1/appointments/services/${creado}`).set(como(tokOwner));
      expect(usado.status).toBe(400);
      expect(usado.body.message).toBe('Ese servicio se usa en 1 clase de la grilla. Sacalo de ahí primero.');
      await prisma.appointmentClassTemplate.deleteMany({ where: { id: tpl.id, businessId: bizA } });
      await http().delete(`/api/v1/appointments/services/${creado}`).set(como(tokOwner)).expect(200, { ok: true });
      expect((await http().put(`/api/v1/appointments/services/${creado}`).set(como(tokOwner)).send({ name: 'Z', durationMin: 30, price: 1, bookableOnline: true })).status).toBe(404);
    });

    it('otro negocio no ve ni toca estos servicios', async () => {
      const lista = await http().get('/api/v1/appointments/services').set(como(tokOwnerC)).expect(200);
      expect(lista.body.some((s: { id: string }) => s.id === corte.id)).toBe(false);
      expect((await http().put(`/api/v1/appointments/services/${corte.id}`).set(como(tokOwnerC)).send({ name: 'Robo', durationMin: 30, price: 1, bookableOnline: true })).status).toBe(404);
      expect((await http().delete(`/api/v1/appointments/services/${corte.id}`).set(como(tokOwnerC))).status).toBe(404);
    });
  });

  // ── P1.3 Agendas ───────────────────────────────────────────────────────────

  describe('Agendas', () => {
    it('el dueño ve todas; el barbero solo la suya', async () => {
      const todas = await http().get('/api/v1/appointments/resources').set(como(tokOwner)).expect(200);
      expect(todas.body.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([agendaDuena, agendaJuan]));
      const propias = await http().get('/api/v1/appointments/resources').set(como(tokStaff)).expect(200);
      expect(propias.body.map((r: { id: string }) => r.id)).toEqual([agendaJuan]);
    });

    it('espacios: crear, editar, validar días y semana; una persona por acá es 404', async () => {
      const sinDias = await http().post('/api/v1/appointments/resources').set(como(tokOwner)).send({ name: 'Sillón 3', workDays: [] });
      expect(sinDias.body.message).toEqual(expect.arrayContaining(['Elegí al menos un día.']));
      const malaSemana = await http().post('/api/v1/appointments/resources').set(como(tokOwner)).send({ name: 'Sillón 3', workDays: [0], ownSchedule: [[[600, 500]], [], [], [], [], [], []] });
      expect(malaSemana.body.message).toBe('El lunes: A la mañana, el cierre tiene que ser después de la apertura.');
      const c = await http().post('/api/v1/appointments/resources').set(como(tokOwner)).send({ name: 'Sillón 3', color: '#aabbcc', workDays: [2, 0, 1] }).expect(201);
      expect(c.body).toMatchObject({ kind: 'SPACE', workDays: [0, 1, 2], ownSchedule: null });
      const u = await http().put(`/api/v1/appointments/resources/${c.body.id}`).set(como(tokOwner)).send({ name: 'Sillón VIP', workDays: [0], ownSchedule: [[[600, 720]], [], [], [], [], [], []] }).expect(200);
      expect(u.body.ownSchedule[0]).toEqual([[600, 720]]);
      expect((await http().put(`/api/v1/appointments/resources/${agendaJuan}`).set(como(tokOwner)).send({ name: 'Juan', workDays: [0] })).status).toBe(404);
      expect((await http().post('/api/v1/appointments/resources').set(como(tokStaff)).send({ name: 'X', workDays: [0] })).status).toBe(403);
      await http().delete(`/api/v1/appointments/resources/${c.body.id}`).set(como(tokOwner)).expect(200);
    });
  });

  // ── P1.4 Turnos ────────────────────────────────────────────────────────────

  describe('Turnos', () => {
    let turno: { id: string; code: string };

    it('dar un turno con un cliente nuevo: CONFIRMED, snapshot, ficha creada y sin accessToken', async () => {
      const res = await http().post('/api/v1/appointments').set(como(tokRecepcion)).send({
        serviceId: corte.id, resourceId: agendaJuan, date: fecha, startMin: 9 * 60, customer: { name: 'José Pérez Gómez', phone: '011 15 5555-0101', email: 'jose@e2e.test' }, internalNote: 'Primera vez',
      });
      expect(res.status).toBe(201);
      turno = res.body;
      expect(res.body).toMatchObject({ status: 'CONFIRMED', origin: 'PANEL', resourceId: agendaJuan, serviceName: 'Corte clásico', date: fecha, startMin: 540, price: 12000, total: 12000, internalNote: 'Primera vez', createdByMemberName: 'Rocío' });
      expect(res.body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(res.body.customer).toMatchObject({ name: 'José Pérez Gómez', phone: '1155550101', email: 'jose@e2e.test' });
      expect(JSON.stringify(res.body)).not.toMatch(/accessToken/);
      const ficha = await prisma.customer.findFirstOrThrow({ where: { businessId: bizA, phone: '1155550101' } });
      expect(ficha).toMatchObject({ firstName: 'José', lastName: 'Pérez Gómez', email: 'jose@e2e.test', passwordHash: null });
      expect(res.body.customer.id).toBe(ficha.id);
      const fila = await prisma.appointment.findFirstOrThrow({ where: { id: turno.id, businessId: bizA } });
      expect(fila.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('el mismo cliente (mismo teléfono) no duplica la ficha', async () => {
      const res = await http().post('/api/v1/appointments').set(como(tokRecepcion)).send({ serviceId: corte.id, resourceId: agendaDuena, date: fecha, startMin: 9 * 60, customer: { name: 'José P.', phone: '+54 9 11 5555-0101' } }).expect(201);
      expect(await prisma.customer.count({ where: { businessId: bizA, phone: '1155550101' } })).toBe(1);
      await http().patch(`/api/v1/appointments/${res.body.id}/status`).set(como(tokRecepcion)).send({ status: 'CANCELLED' }).expect(200);
    });

    it('errores de alta: cliente doble, horario ocupado (409), fuera de grilla (400), precio a mano sin permiso (403)', async () => {
      const base = { serviceId: corte.id, resourceId: agendaJuan, date: fecha };
      expect((await http().post('/api/v1/appointments').set(como(tokOwner)).send({ ...base, startMin: 600 })).body.message).toBe('Elegí un cliente o cargá uno nuevo.');
      const ocupado = await http().post('/api/v1/appointments').set(como(tokOwner)).send({ ...base, startMin: 540, customer: { name: 'Otra Persona' } });
      expect(ocupado.status).toBe(409);
      expect(ocupado.body.message).toBe('Ese horario se acaba de ocupar. Elegí otro.');
      const fueraDeGrilla = await http().post('/api/v1/appointments').set(como(tokOwner)).send({ ...base, startMin: 545, customer: { name: 'Otra Persona' } });
      expect(fueraDeGrilla.status).toBe(400);
      expect(fueraDeGrilla.body.message).toBe('Ese horario no está disponible.');
      const cerrado = await http().post('/api/v1/appointments').set(como(tokOwner)).send({ ...base, startMin: 14 * 60, customer: { name: 'Otra Persona' } });
      expect(cerrado.body.message).toBe('Ese horario no está disponible.');
      expect((await http().post('/api/v1/appointments').set(como(tokStaff)).send({ ...base, startMin: 660, customer: { name: 'Otra Persona' }, priceOverride: 1 })).status).toBe(403);
      expect((await http().post('/api/v1/appointments').set(como(tokOwnerC)).send({ ...base, startMin: 660, customer: { name: 'Otra Persona' } })).status).toBe(404);
    });

    it('precio a mano y "cualquiera" (asigna la agenda menos cargada)', async () => {
      const res = await http().post('/api/v1/appointments').set(como(tokOwner)).send({ serviceId: corte.id, resourceId: 'cualquiera', date: fecha, startMin: 10 * 60, customer: { name: 'Ana Gómez' }, priceOverride: 9999.99 }).expect(201);
      expect(res.body.price).toBe(9999.99);
      expect([agendaDuena, agendaJuan]).toContain(res.body.resourceId);
    });

    it('la doble reserva simultánea del mismo horario: una gana, la otra recibe 409', async () => {
      for (const startMin of [11 * 60, 11 * 60 + 30, 12 * 60]) {
        const pedir = (n: number) => http().post('/api/v1/appointments').set(como(tokOwner)).send({ serviceId: corte.id, resourceId: agendaJuan, date: fecha, startMin, customer: { name: `Carrera ${n} ${startMin}` } });
        const respuestas = await Promise.all([pedir(1), pedir(2), pedir(3)]);
        const estados = respuestas.map((r) => r.status).sort();
        expect(estados).toEqual([201, 409, 409]);
        expect(respuestas.filter((r) => r.status === 409).every((r) => r.body.message === 'Ese horario se acaba de ocupar. Elegí otro.')).toBe(true);
        expect(await prisma.appointment.count({ where: { businessId: bizA, resourceId: agendaJuan, startsAt: instanteDe(fecha, startMin), status: { not: 'CANCELLED' } } })).toBe(1);
      }
    });

    it('la constraint de la base atrapa un pisado que se saltee el service (23P01)', async () => {
      const existente = await prisma.appointment.findFirstOrThrow({ where: { id: turno.id, businessId: bizA } });
      const err = await prisma.appointment.create({
        data: {
          ...{ businessId: bizA, resourceId: agendaJuan, serviceId: corte.id, customerName: 'Pisa', customerPhone: '', serviceName: 'x', durationMin: 30, price: 0, origin: 'PANEL' },
          code: 'ZZZZZZ', accessToken: randomBytes(32).toString('base64url'), startsAt: new Date(existente.startsAt.getTime() + 10 * 60_000), endsAt: new Date(existente.endsAt.getTime() + 10 * 60_000),
        },
      }).then(() => null, (e: unknown) => e);
      expect(err).not.toBeNull();
      const { esChoqueDeHorario } = await import('../src/appointments/panel/lib/errores');
      expect(esChoqueDeHorario(err)).toBe(true);
    });

    it('disponibilidad (modo panel): el horario tomado no aparece; except lo libera', async () => {
      const dia = await http().get(`/api/v1/appointments/availability?serviceId=${corte.id}&date=${fecha}&resourceId=${agendaJuan}`).set(como(tokOwner)).expect(200);
      const inicios = dia.body.slots.map((s: { startMin: number }) => s.startMin);
      expect(inicios).not.toContain(540);
      expect(inicios).toContain(600);
      expect(dia.body.slots[0]).toMatchObject({ resourceId: agendaJuan, price: 12000, adjustPercent: 0 });
      const salvo = await http().get(`/api/v1/appointments/availability?serviceId=${corte.id}&date=${fecha}&resourceId=${agendaJuan}&except=${turno.id}`).set(como(tokOwner)).expect(200);
      expect(salvo.body.slots.map((s: { startMin: number }) => s.startMin)).toContain(540);
      const domingo = sumarDias(fecha, 6);
      const cerrado = await http().get(`/api/v1/appointments/availability?serviceId=${corte.id}&date=${domingo}`).set(como(tokOwner)).expect(200);
      expect(cerrado.body).toMatchObject({ closed: true, reason: 'no-abre', slots: [] });
      const rango = await http().get(`/api/v1/appointments/availability/range?serviceId=${corte.id}&from=${fecha}&to=${sumarDias(fecha, 6)}`).set(como(tokOwner)).expect(200);
      expect(rango.body.days).toHaveLength(7);
      expect(rango.body.days[6]).toMatchObject({ closed: true, free: 0 });
      expect((await http().get(`/api/v1/appointments/availability/range?serviceId=${corte.id}&from=${fecha}&to=${sumarDias(fecha, 70)}`).set(como(tokOwner))).status).toBe(400);
      // El barbero solo puede consultar su agenda.
      expect((await http().get(`/api/v1/appointments/availability?serviceId=${corte.id}&date=${fecha}&resourceId=${agendaDuena}`).set(como(tokStaff))).status).toBe(404);
    });

    it('listado: filtros, búsqueda sin acentos y alcance propio', async () => {
      const todos = await http().get(`/api/v1/appointments?from=${fecha}&to=${fecha}`).set(como(tokOwner)).expect(200);
      expect(todos.body.total).toBeGreaterThanOrEqual(5);
      expect(todos.body.data.map((t: { startsAt: string }) => t.startsAt)).toEqual([...todos.body.data.map((t: { startsAt: string }) => t.startsAt)].sort());
      const busqueda = await http().get(`/api/v1/appointments?from=${fecha}&to=${fecha}&q=jose perez`).set(como(tokOwner)).expect(200);
      expect(busqueda.body.data.map((t: { id: string }) => t.id)).toContain(turno.id);
      const porTelefono = await http().get(`/api/v1/appointments?from=${fecha}&to=${fecha}&q=5555-01`).set(como(tokOwner)).expect(200);
      expect(porTelefono.body.data.map((t: { id: string }) => t.id)).toContain(turno.id);
      const cancelados = await http().get(`/api/v1/appointments?from=${fecha}&to=${fecha}&status=CANCELLED`).set(como(tokOwner)).expect(200);
      expect(cancelados.body.data.every((t: { status: string }) => t.status === 'CANCELLED')).toBe(true);
      expect((await http().get(`/api/v1/appointments?from=${fecha}&to=${fecha}&status=NADA`).set(como(tokOwner))).status).toBe(400);
      expect((await http().get(`/api/v1/appointments?from=${fecha}&to=${sumarDias(fecha, 100)}`).set(como(tokOwner))).status).toBe(400);
      const delBarbero = await http().get(`/api/v1/appointments?from=${fecha}&to=${fecha}`).set(como(tokStaff)).expect(200);
      expect(delBarbero.body.data.every((t: { resourceId: string }) => t.resourceId === agendaJuan)).toBe(true);
      // Sin clients.contact el teléfono viaja tapado y sin email.
      const suyo = delBarbero.body.data.find((t: { id: string }) => t.id === turno.id);
      expect(suyo.customer).toEqual({ id: expect.any(String), name: 'José Pérez Gómez', phone: '••••••••01', email: null });
      const paginado = await http().get(`/api/v1/appointments?from=${fecha}&to=${fecha}&limit=2&page=2`).set(como(tokOwner)).expect(200);
      expect(paginado.body).toMatchObject({ page: 2, limit: 2 });
      expect(paginado.body.data).toHaveLength(2);
    });

    it('detalle: alcance y aislamiento (404), y las rutas que no son un id siguen de largo', async () => {
      const det = await http().get(`/api/v1/appointments/${turno.id}`).set(como(tokOwner)).expect(200);
      expect(det.body.can).toEqual({ edit: true, charge: true, contact: true, transitions: ['CANCELLED'] });
      expect(det.body.payments).toEqual([]);
      const ajeno = await prisma.appointment.findFirstOrThrow({ where: { businessId: bizA, resourceId: agendaDuena, status: 'CONFIRMED' } });
      expect((await http().get(`/api/v1/appointments/${ajeno.id}`).set(como(tokStaff))).status).toBe(404);
      expect((await http().get(`/api/v1/appointments/${turno.id}`).set(como(tokOwnerC))).status).toBe(404);
      expect((await http().patch(`/api/v1/appointments/${turno.id}/status`).set(como(tokOwnerC)).send({ status: 'CANCELLED' })).status).toBe(404);
      expect((await http().patch(`/api/v1/appointments/${ajeno.id}/status`).set(como(tokStaff)).send({ status: 'CANCELLED' })).status).toBe(404);
      // Una ruta fija de otro paquete (que todavía no existe) no la toma GET :id: 404 de ruta, no 400 de UUID.
      const otra = await http().get('/api/v1/appointments/clients').set(como(tokOwner));
      expect(otra.status).toBe(404);
      expect(otra.body.message).toMatch(/Cannot GET/);
    });

    it('estados: transiciones inválidas, "todavía no es la hora", y los efectos de atendido / ausente / cancelado', async () => {
      const futuro = await http().patch(`/api/v1/appointments/${turno.id}/status`).set(como(tokOwner)).send({ status: 'COMPLETED' });
      expect(futuro.status).toBe(400);
      expect(futuro.body.message).toBe('Todavía no es la hora del turno: no se puede marcar como atendido ni ausente.');
      const confirmado = await http().patch(`/api/v1/appointments/${turno.id}/status`).set(como(tokOwner)).send({ status: 'CONFIRMED' });
      expect(confirmado.body.message).toBe('Un turno confirmado no puede pasar a confirmado.');

      // Turnos que ya empezaron: se cargan directo (el panel no da turnos en el pasado).
      const ayer = sumarDias(fechaArgentina(new Date()), -1);
      const ficha = await prisma.customer.findFirstOrThrow({ where: { businessId: bizA, phone: '1155550101' } });
      const pasado = (startMin: number, code: string) => prisma.appointment.create({
        data: {
          businessId: bizA, resourceId: agendaJuan, serviceId: corte.id, customerId: ficha.id, customerName: 'José Pérez Gómez', customerPhone: '1155550101',
          serviceName: 'Corte clásico', durationMin: 30, price: 12000, depositAmount: 3000, depositPaidAt: new Date(), depositMethod: 'CASH',
          status: 'CONFIRMED', origin: 'PANEL', code, accessToken: randomBytes(32).toString('base64url'),
          startsAt: instanteDe(ayer, startMin), endsAt: instanteDe(ayer, startMin + 30),
        },
      });
      const a = await pasado(600, `A${sufijo.slice(0, 5).toUpperCase()}`);
      const b = await pasado(660, `B${sufijo.slice(0, 5).toUpperCase()}`);
      const atendido = await http().patch(`/api/v1/appointments/${a.id}/status`).set(como(tokOwner)).send({ status: 'COMPLETED' }).expect(200);
      expect(atendido.body.status).toBe('COMPLETED');
      expect(atendido.body.completedAt).not.toBeNull();
      expect(atendido.body.can.transitions).toEqual([]);
      const ausente = await http().patch(`/api/v1/appointments/${b.id}/status`).set(como(tokOwner)).send({ status: 'NO_SHOW' }).expect(200);
      expect(ausente.body.status).toBe('NO_SHOW');
      const perfil = await prisma.appointmentCustomerProfile.findFirstOrThrow({ where: { businessId: bizA, customerId: ficha.id } });
      expect(perfil.noShowCount).toBe(1);
      expect((await http().patch(`/api/v1/appointments/${b.id}/status`).set(como(tokOwner)).send({ status: 'CANCELLED' })).body.message).toBe('Un turno ausente no puede pasar a cancelado.');
    });

    it('seña: se registra una vez; cancelar la devuelve (o no, con keepDeposit)', async () => {
      const t = await http().post('/api/v1/appointments').set(como(tokOwner)).send({ serviceId: corte.id, resourceId: agendaDuena, date: fecha, startMin: 16 * 60, customer: { name: 'Lucía Seña' } }).expect(201);
      const sinMonto = await http().post(`/api/v1/appointments/${t.body.id}/deposit`).set(como(tokOwner)).send({ method: 'CASH' });
      expect(sinMonto.body.message).toBe('El monto tiene que ser mayor a 0 y no puede pasar el total del turno.');
      const pagada = await http().post(`/api/v1/appointments/${t.body.id}/deposit`).set(como(tokOwner)).send({ method: 'TRANSFER', amount: 4000, reference: 'op 123' }).expect(201);
      expect(pagada.body).toMatchObject({ depositPaid: true, depositMethod: 'TRANSFER' });
      expect(pagada.body.payments).toEqual([expect.objectContaining({ kind: 'DEPOSIT', method: 'TRANSFER', status: 'APPROVED', amount: 4000, reference: 'op 123', registeredByMemberName: 'Dueña Barberia' })]);
      const otra = await http().post(`/api/v1/appointments/${t.body.id}/deposit`).set(como(tokOwner)).send({ method: 'CASH', amount: 1000 });
      expect(otra.body.message).toBe('La seña de este turno ya está registrada.');
      const resto = await http().post(`/api/v1/appointments/${t.body.id}/deposit`).set(como(tokOwner)).send({ method: 'CASH', kind: 'BALANCE' }).expect(201);
      expect(resto.body.payments[1]).toMatchObject({ kind: 'BALANCE', amount: 8000 });
      expect((await http().post(`/api/v1/appointments/${t.body.id}/deposit`).set(como(tokOwner)).send({ method: 'CASH', kind: 'FULL', amount: 999999 })).status).toBe(400);

      const cancelado = await http().patch(`/api/v1/appointments/${t.body.id}/status`).set(como(tokOwner)).send({ status: 'CANCELLED', reason: 'Se enfermó el barbero' }).expect(200);
      expect(cancelado.body).toMatchObject({ status: 'CANCELLED', cancelledBy: 'BUSINESS', cancelReason: 'Se enfermó el barbero' });
      expect(cancelado.body.payments.map((p: { status: string }) => p.status)).toEqual(['REFUNDED', 'APPROVED']);
      const otraVez = await http().patch(`/api/v1/appointments/${t.body.id}/status`).set(como(tokOwner)).send({ status: 'CANCELLED' });
      expect(otraVez.body.message).toBe('Un turno cancelado no puede pasar a cancelado.');
      expect((await http().post(`/api/v1/appointments/${t.body.id}/deposit`).set(como(tokOwner)).send({ method: 'CASH', amount: 1 })).body.message).toBe('Ese turno está cancelado: no se puede cobrar.');

      const t2 = await http().post('/api/v1/appointments').set(como(tokOwner)).send({ serviceId: corte.id, resourceId: agendaDuena, date: fecha, startMin: 17 * 60, customer: { name: 'Lucía Seña' } }).expect(201);
      await http().post(`/api/v1/appointments/${t2.body.id}/deposit`).set(como(tokOwner)).send({ method: 'CASH', amount: 2000 }).expect(201);
      const conservada = await http().patch(`/api/v1/appointments/${t2.body.id}/status`).set(como(tokOwner)).send({ status: 'CANCELLED', keepDeposit: true }).expect(200);
      expect(conservada.body.payments[0].status).toBe('APPROVED');
    });

    it('mover: a un horario libre, a uno ocupado (409), y uno cerrado no se mueve', async () => {
      const movido = await http().post(`/api/v1/appointments/${turno.id}/move`).set(como(tokOwner)).send({ date: fecha, startMin: 18 * 60, resourceId: agendaDuena }).expect(201);
      expect(movido.body).toMatchObject({ startMin: 1080, resourceId: agendaDuena, status: 'CONFIRMED', rescheduleCount: 0 });
      const ocupado = await http().post(`/api/v1/appointments/${turno.id}/move`).set(como(tokOwner)).send({ date: fecha, startMin: 11 * 60, resourceId: agendaJuan });
      expect(ocupado.status).toBe(409);
      // Volver a su lugar original (que quedó libre).
      await http().post(`/api/v1/appointments/${turno.id}/move`).set(como(tokOwner)).send({ date: fecha, startMin: 9 * 60, resourceId: agendaJuan }).expect(201);
      const cancelado = await prisma.appointment.findFirstOrThrow({ where: { businessId: bizA, status: 'CANCELLED' } });
      const cerrado = await http().post(`/api/v1/appointments/${cancelado.id}/move`).set(como(tokOwner)).send({ date: fecha, startMin: 19 * 60 });
      expect(cerrado.body.message).toBe('Ese turno ya está cerrado: no se puede mover.');
      expect((await http().post(`/api/v1/appointments/${turno.id}/move`).set(como(tokOwnerC)).send({ date: fecha, startMin: 19 * 60 })).status).toBe(404);
    });

    it('nota interna: se guarda y se borra con null', async () => {
      const con = await http().patch(`/api/v1/appointments/${turno.id}/note`).set(como(tokStaff)).send({ internalNote: 'Trae foto del corte' }).expect(200);
      expect(con.body.internalNote).toBe('Trae foto del corte');
      const sin = await http().patch(`/api/v1/appointments/${turno.id}/note`).set(como(tokStaff)).send({ internalNote: null }).expect(200);
      expect(sin.body.internalNote).toBeNull();
      expect((await http().patch(`/api/v1/appointments/${turno.id}/note`).set(como(tokStaff)).send({})).status).toBe(400);
    });

    it('mensajes: el texto armado con el enlace personal (solo con clients.contact) y el reenvío', async () => {
      expect((await http().get(`/api/v1/appointments/${turno.id}/message?template=confirmacion`).set(como(tokStaff))).status).toBe(403);
      const msj = await http().get(`/api/v1/appointments/${turno.id}/message?template=confirmacion`).set(como(tokRecepcion)).expect(200);
      const fila = await prisma.appointment.findFirstOrThrow({ where: { id: turno.id, businessId: bizA } });
      expect(msj.body.text).toContain('¡Hola José!');
      expect(msj.body.text).toContain(`/mi-turno/${fila.accessToken}`);
      expect(msj.body.text).toContain('— Barbería Lorena');
      expect(msj.body.phone).toBe('541155550101');
      expect(msj.body.waLink).toMatch(/^https:\/\/wa\.me\/541155550101\?text=/);
      expect((await http().get(`/api/v1/appointments/${turno.id}/message?template=otro`).set(como(tokRecepcion))).status).toBe(400);
      const enviados = await http().post(`/api/v1/appointments/${turno.id}/messages`).set(como(tokRecepcion)).send({ template: 'confirmacion' }).expect(201);
      expect(enviados.body.map((m: { channel: string; status: string }) => `${m.channel}:${m.status}`).sort()).toEqual(['EMAIL:SENT', 'WHATSAPP:SIMULATED']);
      const det = await http().get(`/api/v1/appointments/${turno.id}`).set(como(tokRecepcion)).expect(200);
      expect(det.body.messages).toHaveLength(2);
    });
  });

  // ── P1.5 Agenda y resumen ──────────────────────────────────────────────────

  describe('Agenda y resumen', () => {
    it('día: una columna por agenda con sus tramos y turnos (cancelados incluidos)', async () => {
      const dia = await http().get(`/api/v1/appointments/agenda/day?date=${fecha}`).set(como(tokOwner)).expect(200);
      expect(dia.body.businessRanges).toEqual([[540, 780], [960, 1200]]);
      expect(dia.body.resources.map((c: { resource: { id: string } }) => c.resource.id)).toEqual([agendaDuena, agendaJuan]);
      const columnaDuena = dia.body.resources[0];
      expect(columnaDuena.appointments.some((t: { status: string }) => t.status === 'CANCELLED')).toBe(true);
      const delBarbero = await http().get(`/api/v1/appointments/agenda/day?date=${fecha}`).set(como(tokStaff)).expect(200);
      expect(delBarbero.body.resources).toHaveLength(1);
    });

    it('rango: hasta 42 días, los turnos por día', async () => {
      const semana = await http().get(`/api/v1/appointments/agenda/range?from=${fecha}&to=${sumarDias(fecha, 6)}`).set(como(tokOwner)).expect(200);
      expect(semana.body.days).toHaveLength(7);
      expect(semana.body.days[0].appointments.length).toBeGreaterThan(0);
      expect(semana.body.days[6].businessRanges).toEqual([]);
      expect((await http().get(`/api/v1/appointments/agenda/range?from=${fecha}&to=${sumarDias(fecha, 42)}`).set(como(tokOwner))).status).toBe(400);
    });

    it('resumen: kpis, huecos y montos solo con reports.view', async () => {
      const res = await http().get(`/api/v1/appointments/summary?date=${fecha}`).set(como(tokOwner)).expect(200);
      expect(res.body.kpis.appointments).toBeGreaterThan(0);
      expect(res.body.kpis.cancelled).toBeGreaterThan(0);
      expect(res.body.kpis.occupancyPercent).toBeGreaterThan(0);
      expect(typeof res.body.kpis.expectedRevenue).toBe('number');
      expect(res.body.gaps).toHaveLength(2);
      expect(res.body.gaps[0].startMins.length).toBeGreaterThan(0);
      expect(res.body.upcoming.length).toBeLessThanOrEqual(8);
      const recep = await http().get(`/api/v1/appointments/summary?date=${fecha}`).set(como(tokRecepcion)).expect(200);
      expect(recep.body.kpis.expectedRevenue).toBeNull();
      expect(recep.body.kpis.collectedRevenue).toBeNull();
    });
  });
});
