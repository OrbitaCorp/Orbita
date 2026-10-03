import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { ClasesService } from '../src/appointments/gestion/clases/clases.service';
import { rolesDeFabrica } from '../src/appointments/catalogo/roles';
import { rubroTurnosPorKey } from '../src/appointments/catalogo/rubros';
import { diaDeSemana, instanteDe, sumarDias } from '../src/appointments/horarios/horarios';
import { fechaArgentina } from '../src/common/utils/hora-argentina';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { limpiarNegocios } from './helpers/limpiar-negocio';

// P3 de Turnos & Agenda (CONTRATO § P3) contra Postgres de verdad: clases con
// cupo (incluida la inscripción simultánea al último lugar), clientes, equipo
// y roles, ganancias y liquidaciones. Cada endpoint por HTTP.
//
// Crea sus propios negocios (uno de turnos con clases, otro de turnos para el
// aislamiento y una tienda) y los borra en el afterAll con limpiarNegocios.
// Los tokens se firman con AuthService.signToken: el login no es lo que se
// prueba acá (lo cubre auth.e2e-spec).

describe('Turnos P3 — clases, clientes, equipo y ganancias (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const negocios: string[] = [];
  const sello = Date.now().toString(36);

  const HOY = fechaArgentina(new Date());
  const FECHA = sumarDias(HOY, 2); // una clase que viene, dentro de la ventana de reserva
  const DIA = diaDeSemana(FECHA);
  const PASADA = sumarDias(HOY, -5); // mismo día de la semana, la semana pasada

  const t: Record<'duenio' | 'encargado' | 'profe' | 'recepcion' | 'otroDuenio' | 'tienda', string> = {} as never;
  const id: Record<string, string> = {};
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function negocioDeTurnos(subdomain: string, extra: object = {}) {
    const b = await prisma.business.create({ data: { name: `P3 ${subdomain}`, industry: 'crossfit', subdomain, vertical: 'APPOINTMENTS', isActive: true } });
    negocios.push(b.id);
    await prisma.appointmentSettings.create({
      data: {
        businessId: b.id, rubroKey: 'crossfit', agendaMode: 'CLASS', weekSchedule: Array.from({ length: 7 }, () => [[0, 1440]]),
        waitlistEnabled: true, waitlistAcceptMin: 30, classOpenDays: 14, maxActivePerCustomer: 0, depositEnabled: true, depositPercent: 30, ...extra,
      },
    });
    const owner = await prisma.role.create({ data: { businessId: b.id, name: 'owner', isDefault: true } });
    const roles: Record<string, string> = { owner: owner.id };
    for (const r of rolesDeFabrica(rubroTurnosPorKey('crossfit')!)) {
      const creado = await prisma.role.create({
        data: {
          businessId: b.id, name: r.nombre, description: r.descripcion, appointmentsRoleKey: r.key, takesAppointments: r.atiende,
          rolePermissions: { create: r.permisos.map((code) => ({ permission: { connect: { code } } })) },
        },
      });
      roles[r.key] = creado.id;
    }
    return { business: b, roles };
  }

  async function miembro(businessId: string, roleId: string, nombre: string) {
    const m = await prisma.member.create({ data: { businessId, roleId, name: nombre, email: `${nombre.toLowerCase().replace(/\W/g, '')}-${sello}@p3.test`, status: 'ACTIVE' } });
    return m;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const firmar = (sub: string, businessId: string) => app.get(AuthService).signToken({ sub, type: 'member', businessId });
    http = request(app.getHttpServer()) as never;

    const { business, roles } = await negocioDeTurnos(`p3-${sello}`);
    id.biz = business.id;
    id.slug = business.subdomain;
    id.rolRecepcion = roles.recepcion;
    id.rolProfe = roles.profesional;
    id.rolEncargado = roles.encargado;

    const duenio = await miembro(business.id, roles.owner, 'Dueña');
    const encargado = await miembro(business.id, roles.encargado, 'Encargado');
    const profe = await miembro(business.id, roles.profesional, 'Caro Coach');
    const recepcion = await miembro(business.id, roles.recepcion, 'Recepcion');
    t.duenio = firmar(duenio.id, business.id);
    t.encargado = firmar(encargado.id, business.id);
    t.profe = firmar(profe.id, business.id);
    t.recepcion = firmar(recepcion.id, business.id);

    const hace60 = new Date(Date.now() - 60 * 86_400_000);
    id.resDuenio = (await prisma.appointmentResource.create({ data: { businessId: business.id, kind: 'PERSON', name: 'Dueña', memberId: duenio.id, payForm: null } })).id;
    id.resProfe = (await prisma.appointmentResource.create({
      data: { businessId: business.id, kind: 'PERSON', name: 'Caro Coach', memberId: profe.id, payForm: 'PER_CLASS', perClass: 9000, payEvery: 'MONTH', createdAt: hace60 },
    })).id;
    id.sala = (await prisma.appointmentResource.create({ data: { businessId: business.id, kind: 'SPACE', name: 'Sala 2' } })).id;
    id.servicio = (await prisma.appointmentService.create({ data: { businessId: business.id, name: 'Spinning', durationMin: 45, price: 6000 } })).id;

    const otro = await negocioDeTurnos(`p3b-${sello}`);
    id.bizB = otro.business.id;
    t.otroDuenio = firmar((await miembro(otro.business.id, otro.roles.owner, 'Otro Dueño')).id, otro.business.id);
    id.clienteB = (await prisma.customer.create({ data: { businessId: otro.business.id, firstName: 'De', lastName: 'Otro', phone: '1199990000' } })).id;

    const tienda = await prisma.business.create({ data: { name: 'Tienda P3', industry: 'Indumentaria', subdomain: `p3t-${sello}`, vertical: 'STORE' } });
    negocios.push(tienda.id);
    id.slugTienda = tienda.subdomain;
    const rolTienda = await prisma.role.create({ data: { businessId: tienda.id, name: 'owner', isDefault: true } });
    t.tienda = firmar((await miembro(tienda.id, rolTienda.id, 'Dueño Tienda')).id, tienda.id);
  }, 60_000);

  afterAll(async () => {
    if (prisma) await limpiarNegocios(prisma as never, negocios);
    await closeTestApp();
  });

  it('una tienda (STORE) no usa Turnos: 404 en el panel y en el sitio', async () => {
    for (const ruta of ['/api/v1/appointments/class-templates', '/api/v1/appointments/clients', '/api/v1/appointments/team', '/api/v1/appointments/roles', '/api/v1/appointments/earnings']) {
      const r = await http.get(ruta).set(auth(t.tienda));
      expect([ruta, r.status, r.body.message]).toEqual([ruta, 404, 'Este negocio no usa Turnos']);
    }
    expect((await http.get(`/api/v1/storefront/${id.slugTienda}/appointments/classes`)).status).toBe(404);
  });

  // ── P3.1 Clases con cupo ──────────────────────────────────────────────────

  describe('clases con cupo', () => {
    it('POST class-templates: crea la clase de la grilla', async () => {
      const r = await http.post('/api/v1/appointments/class-templates').set(auth(t.duenio)).send({
        serviceId: id.servicio, weekday: DIA, startMin: 18 * 60, durationMin: 45, instructorResourceId: id.resProfe, roomResourceId: id.sala, capacity: 2,
      });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ serviceName: 'Spinning', instructorName: 'Caro Coach', roomName: 'Sala 2', capacity: 2, weekday: DIA });
      id.tpl = r.body.id;
    });

    it('POST class-templates: misma sala a la misma hora → 400; sin permiso → 403', async () => {
      const r = await http.post('/api/v1/appointments/class-templates').set(auth(t.duenio)).send({
        serviceId: id.servicio, weekday: DIA, startMin: 18 * 60 + 15, durationMin: 45, roomResourceId: id.sala, capacity: 5,
      });
      expect(r.status).toBe(400);
      expect(r.body.message).toBe('A esa hora la Sala 2 ya tiene Spinning.');
      const p = await http.post('/api/v1/appointments/class-templates').set(auth(t.profe)).send({ serviceId: id.servicio, weekday: DIA, startMin: 600, durationMin: 45, capacity: 5 });
      expect(p.status).toBe(403);
    });

    it('PUT class-templates/:id edita; una clase sin profe (para probar el alcance) y otra de cupo 1', async () => {
      const r = await http.put(`/api/v1/appointments/class-templates/${id.tpl}`).set(auth(t.duenio)).send({
        serviceId: id.servicio, weekday: DIA, startMin: 18 * 60, durationMin: 45, instructorResourceId: id.resProfe, roomResourceId: id.sala, capacity: 2,
      });
      expect(r.status).toBe(200);
      const sinProfe = await http.post('/api/v1/appointments/class-templates').set(auth(t.duenio)).send({ serviceId: id.servicio, weekday: DIA, startMin: 8 * 60, durationMin: 60, capacity: 10 });
      expect(sinProfe.status).toBe(201);
      id.tplSinProfe = sinProfe.body.id;
      const unLugar = await http.post('/api/v1/appointments/class-templates').set(auth(t.duenio)).send({ serviceId: id.servicio, weekday: DIA, startMin: 20 * 60, durationMin: 30, capacity: 1, instructorResourceId: id.resProfe });
      expect(unLugar.status).toBe(201);
      id.tplUnLugar = unLugar.body.id;
    });

    it('GET class-templates: el profe (alcance propio) solo ve las que da', async () => {
      const todas = await http.get('/api/v1/appointments/class-templates').set(auth(t.duenio));
      expect(todas.body.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining([id.tpl, id.tplSinProfe, id.tplUnLugar]));
      const suyas = await http.get('/api/v1/appointments/class-templates').set(auth(t.profe));
      expect(suyas.body.map((x: { id: string }) => x.id).sort()).toEqual([id.tpl, id.tplUnLugar].sort());
    });

    it('GET classes: arma las clases del rango (≤14 días)', async () => {
      const r = await http.get(`/api/v1/appointments/classes?from=${HOY}&to=${sumarDias(HOY, 6)}`).set(auth(t.duenio));
      expect(r.status).toBe(200);
      const clase = r.body.find((c: { templateId: string; date: string }) => c.templateId === id.tpl && c.date === FECHA);
      expect(clase).toMatchObject({ sessionId: null, capacity: 2, enrolled: 0, bookable: true, startsAt: instanteDe(FECHA, 18 * 60).toISOString() });
      expect((await http.get(`/api/v1/appointments/classes?from=${HOY}&to=${sumarDias(HOY, 20)}`).set(auth(t.duenio))).status).toBe(400);
    });

    it('POST enrollments: anota a un cliente nuevo (crea la ficha) y materializa la sesión', async () => {
      const r = await http.post(`/api/v1/appointments/classes/${id.tpl}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customer: { name: 'Ana Paz', phone: '11 5555-0101' } });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ enrolled: 1, waitlist: 0 });
      expect(r.body.sessionId).toEqual(expect.any(String));
      expect(r.body.enrollments[0]).toMatchObject({ status: 'ENROLLED', customer: { name: 'Ana Paz', phone: '1155550101' }, depositAmount: 1800 });
      expect(JSON.stringify(r.body)).not.toMatch(/accessToken/);
      id.ana = r.body.enrollments[0].customer.id;
      id.inscAna = r.body.enrollments[0].id;
    });

    it('la misma persona dos veces → 400', async () => {
      const r = await http.post(`/api/v1/appointments/classes/${id.tpl}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customerId: id.ana });
      expect(r.status).toBe(400);
      expect(r.body.message).toBe('Esa persona ya está anotada en esta clase.');
    });

    it('CONCURRENCIA: dos inscripciones simultáneas al último lugar no entran las dos (la otra va a la lista de espera)', async () => {
      const [a, b] = await Promise.all([
        http.post(`/api/v1/appointments/classes/${id.tpl}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customer: { name: 'Bruno Medina', phone: '11 4444-0001' } }),
        http.post(`/api/v1/appointments/classes/${id.tpl}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customer: { name: 'Julieta Sosa', phone: '11 4444-0002' } }),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      const enBase = await prisma.appointmentClassEnrollment.groupBy({ by: ['status'], where: { businessId: id.biz, session: { templateId: id.tpl, date: FECHA } }, _count: { _all: true } });
      const cuenta = Object.fromEntries(enBase.map((g) => [g.status, g._count._all]));
      expect(cuenta).toEqual({ ENROLLED: 2, WAITLIST: 1 });
    });

    it('CONCURRENCIA sin lista de espera: diez a la vez por un solo lugar → uno entra, nueve reciben 409', async () => {
      await prisma.appointmentSettings.updateMany({ where: { businessId: id.biz }, data: { waitlistEnabled: false } });
      try {
        const rs = await Promise.all(Array.from({ length: 10 }, (_, i) =>
          http.post(`/api/v1/appointments/classes/${id.tplUnLugar}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customer: { name: `Persona ${i}`, phone: `11 3333-00${String(i).padStart(2, '0')}` } })));
        expect(rs.map((r) => r.status).sort()).toEqual([201, ...Array(9).fill(409)]);
        expect(rs.filter((r) => r.status === 409).every((r) => r.body.message === 'La clase está completa.')).toBe(true);
        const anotados = await prisma.appointmentClassEnrollment.count({ where: { businessId: id.biz, status: 'ENROLLED', session: { templateId: id.tplUnLugar, date: FECHA } } });
        expect(anotados).toBe(1);
        const sesiones = await prisma.appointmentClassSession.count({ where: { businessId: id.biz, templateId: id.tplUnLugar, date: FECHA } });
        expect(sesiones).toBe(1);
      } finally {
        await prisma.appointmentSettings.updateMany({ where: { businessId: id.biz }, data: { waitlistEnabled: true } });
      }
    });

    it('lista de espera con posición; sacar a alguien anotado le ofrece el lugar al primero', async () => {
      const r = await http.post(`/api/v1/appointments/classes/${id.tpl}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customer: { name: 'Franco Molina', phone: '11 4444-0003' } });
      expect(r.status).toBe(201);
      const espera = r.body.enrollments.filter((e: { status: string }) => e.status === 'WAITLIST');
      expect(espera.map((e: { waitlistPosition: number }) => e.waitlistPosition)).toEqual([1, 2]);
      const primero = espera[0];

      const baja = await http.delete(`/api/v1/appointments/class-enrollments/${id.inscAna}`).set(auth(t.duenio));
      expect(baja.status).toBe(200);
      expect(baja.body.enrolled).toBe(1);
      const ofrecida = await prisma.appointmentClassEnrollment.findFirst({ where: { id: primero.id, businessId: id.biz } });
      expect(ofrecida?.offerExpiresAt?.getTime()).toBeGreaterThan(Date.now() + 25 * 60_000);

      // Mientras corre la oferta, nadie más toma ese lugar.
      const intruso = await http.post(`/api/v1/appointments/classes/${id.tpl}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customer: { name: 'Paula Herrera', phone: '11 4444-0004' } });
      expect(intruso.body.enrollments.find((e: { customer: { name: string } }) => e.customer.name === 'Paula Herrera').status).toBe('WAITLIST');

      // Acepta (lo que llama "mi turno" de P2): pasa a anotada y la lista se renumera.
      await app.get(ClasesService).aceptarOferta(id.biz, primero.id);
      const d = await http.get(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.duenio));
      expect(d.body.enrolled).toBe(2);
      expect(d.body.enrollments.filter((e: { status: string }) => e.status === 'WAITLIST').map((e: { waitlistPosition: number }) => e.waitlistPosition)).toEqual([1, 2]);
    });

    it('una oferta vencida pasa al siguiente al leer la clase (perezoso)', async () => {
      await prisma.appointmentSettings.updateMany({ where: { businessId: id.biz }, data: { waitlistEnabled: true } });
      const d0 = await http.get(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.duenio));
      const anotada = d0.body.enrollments.find((e: { status: string }) => e.status === 'ENROLLED');
      await http.delete(`/api/v1/appointments/class-enrollments/${anotada.id}`).set(auth(t.duenio)).expect(200);
      const ofrecida = await prisma.appointmentClassEnrollment.findFirst({ where: { businessId: id.biz, session: { templateId: id.tpl, date: FECHA }, status: 'WAITLIST', offerExpiresAt: { not: null } } });
      await prisma.appointmentClassEnrollment.updateMany({ where: { id: ofrecida!.id, businessId: id.biz }, data: { offerExpiresAt: new Date(Date.now() - 1000) } });
      const d = await http.get(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.duenio));
      expect(d.body.enrollments.some((e: { id: string }) => e.id === ofrecida!.id)).toBe(false);
      const siguiente = await prisma.appointmentClassEnrollment.findFirst({ where: { businessId: id.biz, session: { templateId: id.tpl, date: FECHA }, status: 'WAITLIST', waitlistPosition: 1 } });
      expect(siguiente?.offerExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    });

    it('el profe ve sus clases con teléfonos tapados; la clase de otro le da 404', async () => {
      const suya = await http.get(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.profe));
      expect(suya.status).toBe(200);
      expect(suya.body.enrollments[0].customer.phone).toMatch(/^•+\d\d$/);
      expect(suya.body.enrollments[0].customer.email).toBeNull();
      expect((await http.get(`/api/v1/appointments/classes/${id.tplSinProfe}/${FECHA}`).set(auth(t.profe))).status).toBe(404);
      const lista = await http.get(`/api/v1/appointments/classes?from=${FECHA}&to=${FECHA}`).set(auth(t.profe));
      expect(lista.body.every((c: { templateId: string }) => c.templateId !== id.tplSinProfe)).toBe(true);
    });

    it('PATCH attendance: antes de la clase → 400; en una clase que ya pasó, se toma', async () => {
      const futura = await http.get(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.duenio));
      const anotada = futura.body.enrollments.find((e: { status: string }) => e.status === 'ENROLLED');
      const antes = await http.patch(`/api/v1/appointments/class-enrollments/${anotada.id}/attendance`).set(auth(t.duenio)).send({ attended: true });
      expect(antes.status).toBe(400);

      const s = await prisma.appointmentClassSession.create({
        data: { businessId: id.biz, templateId: id.tpl, date: PASADA, startsAt: instanteDe(PASADA, 18 * 60), endsAt: instanteDe(PASADA, 18 * 60 + 45) },
      });
      const e = await prisma.appointmentClassEnrollment.create({
        data: { businessId: id.biz, sessionId: s.id, code: `P${sello.slice(-5).toUpperCase()}`, accessToken: `tok-${sello}-pasada`, customerId: id.ana, customerName: 'Ana Paz', customerPhone: '1155550101', origin: 'PANEL', price: 6000 },
      });
      const r = await http.patch(`/api/v1/appointments/class-enrollments/${e.id}/attendance`).set(auth(t.duenio)).send({ attended: true });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ id: e.id, attended: true });
      expect(r.body.accessToken).toBeUndefined();
    });

    it('PUT classes/:t/:date: cupo nuevo y suspensión (cancela las inscripciones); suspendida no se anota', async () => {
      const cupo = await http.put(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.duenio)).send({ capacity: 3 });
      expect(cupo.status).toBe(200);
      expect(cupo.body.capacity).toBe(3);
      const menor = await http.put(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.duenio)).send({ capacity: 1 });
      expect(menor.status).toBe(400);
      const susp = await http.put(`/api/v1/appointments/classes/${id.tpl}/${FECHA}`).set(auth(t.duenio)).send({ cancelled: true, cancelReason: 'Corte de luz' });
      expect(susp.status).toBe(200);
      expect(susp.body).toMatchObject({ isCancelled: true, enrolled: 0, waitlist: 0, bookable: false });
      const canceladas = await prisma.appointmentClassEnrollment.count({ where: { businessId: id.biz, status: 'CANCELLED', cancelledBy: 'SYSTEM', session: { templateId: id.tpl, date: FECHA } } });
      expect(canceladas).toBeGreaterThan(0);
      const r = await http.post(`/api/v1/appointments/classes/${id.tpl}/${FECHA}/enrollments`).set(auth(t.duenio)).send({ customerId: id.ana });
      expect(r.status).toBe(400);
      expect(r.body.message).toBe('Esta clase está suspendida.');
    });

    it('DELETE class-templates: con gente anotada en clases que vienen → 400; sin gente, se borra', async () => {
      const r = await http.delete(`/api/v1/appointments/class-templates/${id.tplUnLugar}`).set(auth(t.duenio));
      expect(r.status).toBe(400);
      expect(r.body.message).toBe('Hay 1 persona anotada en clases que vienen. Suspendé esas clases primero.');
      expect((await http.delete(`/api/v1/appointments/class-templates/${id.tplSinProfe}`).set(auth(t.duenio))).body).toEqual({ ok: true });
    });

    describe('desde el sitio', () => {
      it('GET storefront/:slug/appointments/classes lista las clases que vienen', async () => {
        const r = await http.get(`/api/v1/storefront/${id.slug}/appointments/classes`);
        expect(r.status).toBe(200);
        expect(r.body.some((c: { templateId: string }) => c.templateId === id.tplUnLugar)).toBe(true);
        expect(r.body.some((c: { templateId: string }) => c.templateId === id.tplSinProfe)).toBe(false);
      });

      it('POST enroll: se anota (lista de espera si está completa), devuelve el enlace una vez; repetido → 400; teléfono corto → 400', async () => {
        const r = await http.post(`/api/v1/storefront/${id.slug}/appointments/classes/enroll`).send({ templateId: id.tplUnLugar, date: FECHA, name: 'Delfina Soto', phone: '11 2222-0101', email: 'delfina@p3.test' });
        expect(r.status).toBe(201);
        expect(r.body.accessToken).toHaveLength(43);
        expect(r.body.booking).toMatchObject({ kind: 'class', status: 'WAITLIST', waitlistPosition: 1, serviceName: 'Spinning' });
        expect(r.body.payment).toBeNull();
        const fila = await prisma.appointmentClassEnrollment.findFirst({ where: { businessId: id.biz, accessToken: r.body.accessToken } });
        expect(fila).toMatchObject({ origin: 'STOREFRONT', customerPhone: '1122220101' });

        const otra = await http.post(`/api/v1/storefront/${id.slug}/appointments/classes/enroll`).send({ templateId: id.tplUnLugar, date: FECHA, name: 'Delfina Soto', phone: '011 15 2222-0101' });
        expect(otra.status).toBe(400);
        expect(otra.body.message).toBe('Ya estás anotado en esta clase.');
        const corto = await http.post(`/api/v1/storefront/${id.slug}/appointments/classes/enroll`).send({ templateId: id.tplUnLugar, date: FECHA, name: 'Delfina Soto', phone: '2222-0101' });
        expect(corto.body.message).toBe('Faltan dígitos: son 10 con el código de área.');
      });

      it('sitio pausado → 404', async () => {
        await prisma.business.updateMany({ where: { id: id.biz }, data: { isPaused: true } });
        try {
          expect((await http.get(`/api/v1/storefront/${id.slug}/appointments/classes`)).status).toBe(404);
        } finally {
          await prisma.business.updateMany({ where: { id: id.biz }, data: { isPaused: false } });
        }
      });
    });
  });

  // ── P3.2 Clientes ─────────────────────────────────────────────────────────

  describe('clientes', () => {
    it('POST clients: alta con nota y obra social; teléfono repetido → 400 con el nombre', async () => {
      const r = await http.post('/api/v1/appointments/clients').set(auth(t.duenio)).send({ name: 'José Pérez', phone: '11 6666-0101', email: 'jose@p3.test', note: 'Viene con la hija', insuranceName: 'OSDE' });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ name: 'José Pérez', phone: '1166660101', note: 'Viene con la hija', visits: 0 });
      id.jose = r.body.id;
      const rep = await http.post('/api/v1/appointments/clients').set(auth(t.duenio)).send({ name: 'Otro José', phone: '1166660101' });
      expect(rep.status).toBe(400);
      expect(rep.body.message).toBe('Ya tenés un cliente con ese teléfono: José Pérez.');
    });

    it('GET clients: busca sin acentos ni mayúsculas, por teléfono, y no muestra obra social en la lista', async () => {
      const r = await http.get('/api/v1/appointments/clients?q=jose perez').set(auth(t.duenio));
      expect(r.status).toBe(200);
      expect(r.body.data.map((c: { id: string }) => c.id)).toEqual([id.jose]);
      expect(r.body.data[0].insuranceName).toBeNull();
      const porTel = await http.get('/api/v1/appointments/clients?q=6666').set(auth(t.duenio));
      expect(porTel.body.data.map((c: { id: string }) => c.id)).toEqual([id.jose]);
      const nuevos = await http.get('/api/v1/appointments/clients?filter=nuevos&limit=100').set(auth(t.duenio));
      expect(nuevos.body.data.some((c: { id: string }) => c.id === id.jose)).toBe(true);
      expect((await http.get('/api/v1/appointments/clients?filter=frecuentes').set(auth(t.duenio))).body.total).toBe(0);
    });

    it('el profe (alcance propio) solo ve a quien tiene en sus clases, con el teléfono tapado; otro → 404', async () => {
      const r = await http.get('/api/v1/appointments/clients?limit=100').set(auth(t.profe));
      expect(r.status).toBe(200);
      expect(r.body.data.some((c: { id: string }) => c.id === id.jose)).toBe(false);
      expect(r.body.data.length).toBeGreaterThan(0);
      expect(r.body.data.every((c: { phone: string; email: string | null; spent: number | null }) => /^•+\d\d$/.test(c.phone) && c.email === null && c.spent === null)).toBe(true);
      expect((await http.get(`/api/v1/appointments/clients/${id.jose}`).set(auth(t.profe))).status).toBe(404);
    });

    it('GET clients/:id: la ficha con obra social, visitas e historial', async () => {
      const r = await http.get(`/api/v1/appointments/clients/${id.ana}`).set(auth(t.duenio));
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ name: 'Ana Paz', visits: 1, lastVisit: PASADA, history: [], next: null });
    });

    it('PUT clients/:id: actualiza el perfil', async () => {
      const r = await http.put(`/api/v1/appointments/clients/${id.jose}`).set(auth(t.duenio)).send({ name: 'José Pérez', insuranceNumber: '123-4', dni: '30111222', note: null });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ insuranceName: 'OSDE', insuranceNumber: '123-4', dni: '30111222', note: null, email: 'jose@p3.test' });
    });

    it('aislamiento: el cliente de otro negocio es 404, y el otro negocio no ve los de este', async () => {
      expect((await http.get(`/api/v1/appointments/clients/${id.clienteB}`).set(auth(t.duenio))).status).toBe(404);
      expect((await http.put(`/api/v1/appointments/clients/${id.clienteB}`).set(auth(t.duenio)).send({ name: 'Robado' })).status).toBe(404);
      const delOtro = await http.get('/api/v1/appointments/clients?limit=100').set(auth(t.otroDuenio));
      expect(delOtro.body.data.map((c: { id: string }) => c.id)).toEqual([id.clienteB]);
    });

    it('sin permiso para crear (recepción sí; el profe no edita fichas ajenas) ', async () => {
      expect((await http.post('/api/v1/appointments/clients').set(auth(t.recepcion)).send({ name: 'Rocío Blanco' })).status).toBe(201);
    });
  });

  // ── P3.3 Equipo y roles ───────────────────────────────────────────────────

  describe('equipo y roles', () => {
    it('GET team: el dueño ve a todos con su pago; el profe solo su ficha', async () => {
      const todos = await http.get('/api/v1/appointments/team').set(auth(t.duenio));
      expect(todos.status).toBe(200);
      const caro = todos.body.find((p: { id: string }) => p.id === id.resProfe);
      expect(caro).toMatchObject({ kind: 'PERSON', pay: { payForm: 'PER_CLASS', perClass: 9000 }, member: { roleName: 'Coach' } });
      expect(todos.body.find((p: { id: string }) => p.id === id.resDuenio)).toMatchObject({ pay: null, member: { isOwner: true } });
      const propia = await http.get('/api/v1/appointments/team').set(auth(t.profe));
      expect(propia.body.map((p: { id: string }) => p.id)).toEqual([id.resProfe]);
    });

    it('POST team/invite: el encargado invita con un rol que puede dar (MembersService: misma temporal)', async () => {
      const r = await http.post('/api/v1/appointments/team/invite').set(auth(t.encargado)).send({ name: 'Nueva Recepción', email: `nueva-${sello}@p3.test`, roleId: id.rolRecepcion });
      expect(r.status).toBe(201);
      expect(r.body.tempPassword).toEqual(expect.any(String));
      expect(r.body.person).toMatchObject({ isBookable: false, roleLabel: 'Recepción', member: { status: 'PENDING' }, pay: { payForm: 'PER_CLASS' } });
      const m = await prisma.member.findFirst({ where: { businessId: id.biz, email: `nueva-${sello}@p3.test` } });
      expect(m?.hasTempPassword).toBe(true);
    });

    it('POST team/invite: con un rol que tiene permisos que el encargado no tiene → 403', async () => {
      const jefe = await prisma.role.create({
        data: { businessId: id.biz, name: `Jefe ${sello}`, rolePermissions: { create: [{ permission: { connect: { code: 'appointments.settings.manage' } } }] } },
      });
      const r = await http.post('/api/v1/appointments/team/invite').set(auth(t.encargado)).send({ name: 'Jefe', email: `jefe-${sello}@p3.test`, roleId: jefe.id });
      expect(r.status).toBe(403);
      expect(await prisma.member.count({ where: { businessId: id.biz, email: `jefe-${sello}@p3.test` } })).toBe(0);
      expect((await http.post('/api/v1/appointments/team/invite').set(auth(t.profe)).send({ name: 'X', email: `x-${sello}@p3.test`, roleId: id.rolProfe })).status).toBe(403);
    });

    it('POST team (sin login) y PUT team/:id', async () => {
      const r = await http.post('/api/v1/appointments/team').set(auth(t.duenio)).send({ name: 'Profe Suplente', phone: '1177770000', isBookable: true, workDays: [0, 2, 4] });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ member: null, phone: '1177770000', workDays: [0, 2, 4], pay: { payForm: 'PER_CLASS' } });
      id.suplente = r.body.id;
      const e = await http.put(`/api/v1/appointments/team/${id.suplente}`).set(auth(t.duenio)).send({ name: 'Profe Suplente', bio: 'Yoga y stretching', isBookable: true, workDays: [1], ownSchedule: [[[480, 720]], [], [], [], [], [], []] });
      expect(e.status).toBe(200);
      expect(e.body).toMatchObject({ bio: 'Yoga y stretching', workDays: [1] });
      expect(e.body.ownSchedule[0]).toEqual([[480, 720]]);
      const mal = await http.put(`/api/v1/appointments/team/${id.suplente}`).set(auth(t.duenio)).send({ name: 'X', isBookable: true, workDays: [1], ownSchedule: [[[720, 480]], [], [], [], [], [], []] });
      expect(mal.status).toBe(400);
    });

    it('PUT team/:id/pay: forma del rubro sí, comisión en clases no; el dueño no se liquida', async () => {
      const ok = await http.put(`/api/v1/appointments/team/${id.suplente}/pay`).set(auth(t.duenio)).send({ payForm: 'SALARY', salary: 300000, payEvery: 'MONTH' });
      expect(ok.status).toBe(200);
      expect(ok.body.pay).toMatchObject({ payForm: 'SALARY', salary: 300000 });
      const no = await http.put(`/api/v1/appointments/team/${id.suplente}/pay`).set(auth(t.duenio)).send({ payForm: 'COMMISSION', commissionPercent: 50, payEvery: 'WEEK' });
      expect(no.body.message).toBe('Esa forma de pago no se usa en este tipo de negocio.');
      const duenio = await http.put(`/api/v1/appointments/team/${id.resDuenio}/pay`).set(auth(t.duenio)).send({ payForm: 'SALARY', salary: 1, payEvery: 'MONTH' });
      expect(duenio.status).toBe(400);
      expect(duenio.body.message).toBe('El dueño no se liquida: lo que factura queda para el negocio.');
      expect((await http.put(`/api/v1/appointments/team/${id.suplente}/pay`).set(auth(t.recepcion)).send({ payForm: 'SALARY', payEvery: 'MONTH' })).status).toBe(403);
    });

    it('al dueño no lo toca nadie más', async () => {
      const r = await http.put(`/api/v1/appointments/team/${id.resDuenio}`).set(auth(t.encargado)).send({ name: 'Otra', isBookable: true, workDays: [0] });
      expect(r.status).toBe(403);
      expect((await http.delete(`/api/v1/appointments/team/${id.resDuenio}`).set(auth(t.duenio))).status).toBe(400);
    });

    it('DELETE team: a alguien con login solo lo saca el dueño; sin login, cualquiera con equipo', async () => {
      expect((await http.delete(`/api/v1/appointments/team/${id.resProfe}`).set(auth(t.encargado))).status).toBe(403);
      expect((await http.delete(`/api/v1/appointments/team/${id.suplente}`).set(auth(t.encargado))).body).toEqual({ ok: true });
      const borrada = await prisma.appointmentResource.findFirst({ where: { id: id.suplente, businessId: id.biz } });
      expect(borrada?.deletedAt).not.toBeNull();
    });

    it('roles: lista con alcances y fábrica; crear/editar/volver a fábrica/borrar', async () => {
      const lista = await http.get('/api/v1/appointments/roles').set(auth(t.encargado));
      expect(lista.status).toBe(200);
      const recep = lista.body.find((r: { id: string }) => r.id === id.rolRecepcion);
      expect(recep).toMatchObject({ factoryKey: 'recepcion', changed: false, members: 2, isOwner: false });
      expect(recep.scopes['agenda.ver']).toBe('todo');

      expect((await http.post('/api/v1/appointments/roles').set(auth(t.encargado)).send({ name: 'Raro', takesAppointments: false, permissions: ['catalog.manage'] })).status).toBe(400);
      expect((await http.post('/api/v1/appointments/roles').set(auth(t.encargado)).send({ name: 'Config', takesAppointments: false, permissions: ['appointments.settings.manage'] })).status).toBe(403);
      const creado = await http.post('/api/v1/appointments/roles').set(auth(t.encargado)).send({ name: 'Caja', color: '#10B981', takesAppointments: false, permissions: ['appointments.agenda.view', 'appointments.agenda.view_all', 'appointments.cash.charge'] });
      expect(creado.status).toBe(201);
      expect(creado.body).toMatchObject({ name: 'Caja', factoryKey: null, takesAppointments: false });
      expect(creado.body.scopes['caja.cobrar']).toBe('todo');

      const cambiado = await http.put(`/api/v1/appointments/roles/${id.rolRecepcion}`).set(auth(t.duenio)).send({ name: 'Mostrador', takesAppointments: false, permissions: ['appointments.agenda.view'] });
      expect(cambiado.body).toMatchObject({ name: 'Mostrador', changed: true });
      const vuelto = await http.post(`/api/v1/appointments/roles/${id.rolRecepcion}/reset`).set(auth(t.duenio));
      expect(vuelto.body).toMatchObject({ name: 'Recepción', changed: false });

      const conGente = await http.delete(`/api/v1/appointments/roles/${id.rolProfe}`).set(auth(t.duenio));
      expect(conGente.status).toBe(400);
      expect(conGente.body.message).toBe('Hay 1 persona con este rol. Pasalas a otro antes de borrarlo.');
      expect((await http.delete(`/api/v1/appointments/roles/${creado.body.id}`).set(auth(t.duenio))).body).toEqual({ ok: true });
      expect((await http.get('/api/v1/appointments/roles').set(auth(t.profe))).status).toBe(403);
    });
  });

  // ── P3.4 Ganancias ────────────────────────────────────────────────────────

  describe('ganancias y liquidaciones', () => {
    const desde = sumarDias(HOY, -30);

    beforeAll(async () => {
      // Una clase de la grilla que existe desde hace dos meses, dada por el profe.
      await prisma.appointmentClassTemplate.create({
        data: { businessId: id.biz, serviceId: id.servicio, weekday: diaDeSemana(sumarDias(HOY, -1)), startMin: 7 * 60, durationMin: 60, capacity: 10, instructorResourceId: id.resProfe, createdAt: new Date(Date.now() - 60 * 86_400_000) },
      });
    });

    it('GET earnings: el dueño ve totales y a cada persona; el profe solo lo suyo y sin totales', async () => {
      const r = await http.get(`/api/v1/appointments/earnings?from=${desde}&to=${HOY}`).set(auth(t.duenio));
      expect(r.status).toBe(200);
      expect(r.body.totals).toEqual(expect.objectContaining({ billed: expect.any(Number), toTeam: expect.any(Number) }));
      const caro = r.body.people.find((p: { person: { resourceId: string } }) => p.person.resourceId === id.resProfe);
      expect(caro.period.classes).toBeGreaterThanOrEqual(4);
      expect(caro.period.perClass).toBe(caro.period.classes * 9000);
      expect(caro.paidUntil).toBeNull();
      expect(caro.toPay).toBe(caro.pending.toPerson);

      const propio = await http.get(`/api/v1/appointments/earnings?from=${desde}&to=${HOY}`).set(auth(t.profe));
      expect(propio.body.totals).toBeNull();
      expect(propio.body.people.map((p: { person: { resourceId: string } }) => p.person.resourceId)).toEqual([id.resProfe]);
      expect((await http.get(`/api/v1/appointments/earnings/${id.resDuenio}`).set(auth(t.profe))).status).toBe(404);
      expect((await http.get(`/api/v1/appointments/earnings?from=2020-01-01&to=${HOY}`).set(auth(t.duenio))).status).toBe(400);
    });

    it('POST payouts: paga lo pendiente hasta una fecha; volver a pagar ese período → 400; historial', async () => {
      const hasta = sumarDias(HOY, -1);
      const r = await http.post(`/api/v1/appointments/earnings/${id.resProfe}/payouts`).set(auth(t.duenio)).send({ periodTo: hasta, note: 'Efectivo' });
      expect(r.status).toBe(201);
      expect(r.body.paidUntil).toBe(hasta);
      expect(r.body.pending.from).toBe(HOY);
      const otra = await http.post(`/api/v1/appointments/earnings/${id.resProfe}/payouts`).set(auth(t.duenio)).send({ periodTo: sumarDias(HOY, -2) });
      expect(otra.status).toBe(400);
      expect(otra.body.message).toMatch(/^Ya está pagado hasta el \d\d\/\d\d\/\d{4}\.$/);
      const pagos = await http.get(`/api/v1/appointments/earnings/${id.resProfe}/payouts`).set(auth(t.duenio));
      expect(pagos.body).toMatchObject({ total: 1, page: 1 });
      expect(pagos.body.data[0]).toMatchObject({ periodTo: hasta, direction: 'BUSINESS_TO_PERSON', note: 'Efectivo', registeredByMemberName: 'Dueña' });
      expect(pagos.body.data[0].amount).toBeGreaterThan(0);
      const propio = await http.get(`/api/v1/appointments/earnings/${id.resProfe}/payouts`).set(auth(t.profe));
      expect(propio.status).toBe(200);
      expect((await http.post(`/api/v1/appointments/earnings/${id.resProfe}/payouts`).set(auth(t.profe)).send({})).status).toBe(403);
      expect((await http.post(`/api/v1/appointments/earnings/${id.resDuenio}/payouts`).set(auth(t.duenio)).send({})).body.message).toBe('El dueño no se liquida: lo que factura queda para el negocio.');
    });

    it('auditoría: las escrituras quedaron registradas, sin el enlace personal', async () => {
      const logs = await prisma.auditLog.findMany({ where: { businessId: id.biz, entityType: { startsWith: 'appointment' } } });
      const tipos = new Set(logs.map((l) => l.entityType));
      for (const e of ['appointment_class_template', 'appointment_class_session', 'appointment_enrollment', 'appointment_resource', 'appointment_payout']) expect(tipos.has(e)).toBe(true);
      expect(JSON.stringify(logs)).not.toMatch(/accessToken/);
    });
  });
});
