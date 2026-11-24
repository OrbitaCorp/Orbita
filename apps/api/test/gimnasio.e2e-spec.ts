import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';
import { diaDeSemana, fechaYMinutos, sumarDias } from '../src/reservas/dominio/tiempo';

// Los planes y los pases de Gimnasio contra Postgres de verdad: lo que ningún
// mock prueba.
//
// - Las clases usadas de un pack se cuentan de las reservas (el campo libre
//   `datos.gimnasio`): al cancelar una, la clase vuelve sola.
// - Dos pedidos a la vez con la última clase de un pack: entra uno solo.
// - Repetir el pedido con la misma clave no descuenta dos veces.
// - El tope semanal de una membresía, la clase de prueba una vez por persona,
//   pasar al plan un lugar reservado desde el sitio, renovar sin perder días.
// - Los permisos del panel y lo que ve el sitio.
//
// Usa el negocio seed (zapatoslorena) y limpia todo lo que crea en afterAll.
const GIM = '/api/v1/gimnasio';
const PANEL = '/api/v1/reservas';
const PUBLICO = `/api/v1/storefront/${SEED_BUSINESS_SLUG}`;
const HORARIO_TODO_EL_DIA = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, [[0, 1440]]]));
const SESIONES = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, [[600, 660], [1140, 1200]]]));

const uuid = () => crypto.randomUUID();
/** Para las pruebas con muchos pedidos seguidos: cada uno va y vuelve a la base de dev. */
const LARGO = 90_000;
const mail = (n: string) => `e2e-gimnasio-${n}@test.orbita`;

interface Plan { id: string; tipo: string; nombre: string; precio: number; clases: number | null; porSemana: number | null; vigenciaDias: number; activo: boolean }
interface Suscripcion { id: string; planId: string; nombre: string; desde: string; hasta: string; usadas: number; restantes: number | null }
interface Alumno { id: string; clienteId: string; nombre: string; probo: boolean; planes: Suscripcion[]; ultimo: Suscripcion | null }

describe('Gimnasio: planes, alumnos y pases (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let employeeToken: string;
  let businessId: string;
  let claseId: string;
  let planes: Record<'prueba' | 'suelta' | 'pack' | 'membresia' | 'oculto', Plan>;

  const hoy = fechaYMinutos(new Date()).fecha;
  // Un lunes bien adelante, para tener una semana entera y la siguiente.
  const lunes = sumarDias(hoy, 7 + ((8 - diaDeSemana(hoy)) % 7));
  const dia = (n: number) => sumarDias(lunes, n);

  const http = () => request(app.getHttpServer());
  const owner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const employee = () => ({ Authorization: `Bearer ${employeeToken}` });

  const alta = async (nombre: string, plan?: Plan): Promise<Alumno> => {
    const res = await http().post(`${GIM}/alumnos`).set(owner()).send({ cliente: { nombre, email: mail(nombre.toLowerCase().replace(/\s+/g, '-')) }, ...(plan ? { planId: plan.id } : {}) });
    expect(res.status).toBe(201);
    return res.body;
  };
  const alumno = async (id: string): Promise<Alumno> => {
    const res = await http().get(`${GIM}/alumnos`).set(owner());
    expect(res.status).toBe(200);
    return res.body.find((a: Alumno) => a.id === id);
  };
  const anotar = (alumnoId: string, fecha: string, over: Record<string, unknown> = {}) =>
    http().post(`${GIM}/reservas`).set(owner()).send({ recursoId: claseId, fecha, inicioMinutos: 600, alumnoId, pago: 'plan', clave: uuid(), ...over });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const ownerRes = await http().post('/api/v1/auth/login').send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;
    const employeeRes = await http().post('/api/v1/auth/login').send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });
    employeeToken = employeeRes.body.token;

    const config = await http().put(`${PANEL}/config`).set(owner()).send({
      modulo: 'GIMNASIO', horario: HORARIO_TODO_EL_DIA, anticipacionMinimaMinutos: 0, anticipacionMaximaDias: 365, retencionMinutos: 10,
      cancelacionHastaHoras: 0, reprogramacionHastaHoras: 0, maximoActivasPorCliente: 0, listaDeEspera: true, confirmacion: 'AUTOMATICA',
    });
    expect(config.status).toBe(200);
    const clase = await http().post(`${PANEL}/recursos`).set(owner()).send({
      modulo: 'GIMNASIO', tipo: 'CLASE', nombre: '[e2e] Gimnasio WOD', duracionMinutos: 60, cupo: 20, precio: 0, horario: SESIONES,
    });
    expect(clase.status).toBe(201);
    claseId = clase.body.id;
  });

  afterAll(async () => {
    if (businessId) {
      if (claseId) {
        const reservas = await prisma.reserva.findMany({ where: { businessId, recursoId: claseId }, select: { id: true } });
        const ids = reservas.map((r) => r.id);
        await prisma.reservaHistorial.deleteMany({ where: { businessId, reservaId: { in: ids } } });
        await prisma.reservaEspera.deleteMany({ where: { businessId, recursoId: claseId } });
        await prisma.reserva.deleteMany({ where: { businessId, id: { in: ids } } });
        await prisma.reservaRecurso.deleteMany({ where: { businessId, id: claseId } });
      }
      // Todo lo de Gimnasio de este negocio es de esta prueba: el negocio seed no usa el módulo.
      await prisma.gimnasioSuscripcion.deleteMany({ where: { businessId } });
      await prisma.gimnasioAlumno.deleteMany({ where: { businessId } });
      await prisma.gimnasioPlan.deleteMany({ where: { businessId } });
      await prisma.reservaConfig.deleteMany({ where: { businessId, modulo: 'GIMNASIO' } });
      await prisma.customer.deleteMany({ where: { businessId, email: { startsWith: 'e2e-gimnasio-' } } });
    }
    await closeTestApp();
  });

  describe('planes y precios', () => {
    it('guarda la lista entera y la devuelve en el mismo orden, con las clases solo en el pack y el tope solo en la membresía', async () => {
      const res = await http().put(`${GIM}/planes`).set(owner()).send({ planes: [
        { tipo: 'PRUEBA', nombre: '[e2e] Clase de prueba', precio: 0, vigenciaDias: 1, activo: true },
        { tipo: 'SUELTA', nombre: '[e2e] Clase suelta', precio: 6000, vigenciaDias: 1, activo: true, clases: 9 },
        { tipo: 'PACK', nombre: '[e2e] Pack de 2', precio: 10000, clases: 2, vigenciaDias: 60, activo: true },
        { tipo: 'MEMBRESIA', nombre: '[e2e] 1 por semana', precio: 20000, porSemana: 1, vigenciaDias: 30, activo: true },
        { tipo: 'MEMBRESIA', nombre: '[e2e] Plan interno', precio: 1, vigenciaDias: 30, activo: false },
      ] });
      expect(res.status).toBe(200);
      const [prueba, suelta, pack, membresia, oculto] = res.body as Plan[];
      planes = { prueba, suelta, pack, membresia, oculto };
      expect(res.body.map((p: Plan) => [p.tipo, p.precio, p.clases, p.porSemana])).toEqual([
        ['PRUEBA', 0, null, null], ['SUELTA', 6000, null, null], ['PACK', 10000, 2, null], ['MEMBRESIA', 20000, null, 1], ['MEMBRESIA', 1, null, 0],
      ]);
    });

    it('volver a guardar cambia los que traen id, y el que ya no viene se quita sin romper nada', async () => {
      const lista = Object.values(planes).map((p) => ({ id: p.id, tipo: p.tipo, nombre: p.nombre, precio: p.precio, clases: p.clases, porSemana: p.porSemana, vigenciaDias: p.vigenciaDias, activo: p.activo }));
      const res = await http().put(`${GIM}/planes`).set(owner()).send({ planes: [...lista.map((p) => (p.tipo === 'SUELTA' ? { ...p, precio: 6500 } : p)), { tipo: 'PACK', nombre: '[e2e] Pack efímero', precio: 1, clases: 1, vigenciaDias: 1, activo: true }] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(6);
      expect(res.body.find((p: Plan) => p.id === planes.suelta.id).precio).toBe(6500);
      const sinElEfimero = await http().put(`${GIM}/planes`).set(owner()).send({ planes: res.body.filter((p: Plan) => p.nombre !== '[e2e] Pack efímero') });
      expect(sinElEfimero.status).toBe(200);
      expect(sinElEfimero.body.map((p: Plan) => p.id)).toEqual(Object.values(planes).map((p) => p.id));
    }, LARGO);

    it('un pack sin clases, un plan que no existe o un precio negativo no se guardan (400), y la lista queda como estaba', async () => {
      const base = { tipo: 'PACK', nombre: '[e2e] Malo', precio: 100, vigenciaDias: 30, activo: true };
      for (const malo of [{ ...base }, { ...base, clases: 4, precio: -1 }, { ...base, clases: 4, id: uuid() }, { ...base, clases: 4, vigenciaDias: 0 }]) {
        const res = await http().put(`${GIM}/planes`).set(owner()).send({ planes: [malo] });
        expect(res.status).toBe(400);
      }
      const despues = await http().get(`${GIM}/planes`).set(owner());
      expect(despues.body.map((p: Plan) => p.id)).toEqual(Object.values(planes).map((p) => p.id));
    });

    it('el sitio ve solo los que se ofrecen, sin sesión; el panel pide permiso para configurar', async () => {
      const sitio = await http().get(`${PUBLICO}/gimnasio/planes`);
      expect(sitio.status).toBe(200);
      expect(sitio.body.map((p: Plan) => p.nombre)).toEqual(['[e2e] Clase de prueba', '[e2e] Clase suelta', '[e2e] Pack de 2', '[e2e] 1 por semana']);
      expect(sitio.body[0]).not.toHaveProperty('activo');
      // El empleado ve y gestiona, no configura.
      expect((await http().get(`${GIM}/planes`).set(employee())).status).toBe(200);
      expect((await http().put(`${GIM}/planes`).set(employee()).send({ planes: [] })).status).toBe(403);
      expect((await http().get(`${GIM}/planes`)).status).toBe(401);
      expect((await http().get(`${GIM}/alumnos`)).status).toBe(401);
    });
  });

  describe('alumnos y su plan', () => {
    it('un alumno dado de alta con un pack queda con su plan, lo que trae y hasta cuándo vale', async () => {
      const a = await alta('Ana Pack', planes.pack);
      expect(a).toMatchObject({ nombre: 'Ana Pack', probo: false, ultimo: null });
      expect(a.planes).toEqual([expect.objectContaining({ planId: planes.pack.id, nombre: '[e2e] Pack de 2', desde: hoy, hasta: sumarDias(hoy, 60), usadas: 0, restantes: 2 })]);
      // En la base: su fila y su suscripción.
      expect(await prisma.gimnasioSuscripcion.count({ where: { businessId, alumnoId: a.id, estado: 'VIGENTE' } })).toBe(1);
    });

    it('dar de alta dos veces a la misma persona no la duplica, tampoco a la vez', async () => {
      const [uno, dos] = await Promise.all([alta('Ana Pack'), alta('Ana Pack')]);
      expect(uno.id).toBe(dos.id);
      expect(await prisma.gimnasioAlumno.count({ where: { businessId, clienteId: uno.clienteId } })).toBe(1);
    });

    it('renovar la misma membresía antes de que venza la continúa: no pierde días', async () => {
      const a = await alta('Beto Membresia', planes.membresia);
      const res = await http().post(`${GIM}/alumnos/${a.id}/plan`).set(employee()).send({ planId: planes.membresia.id });
      expect(res.status).toBe(201);
      expect(res.body.planes.map((s: Suscripcion) => [s.desde, s.hasta])).toEqual([[hoy, sumarDias(hoy, 30)], [sumarDias(hoy, 31), sumarDias(hoy, 61)]]);
    });

    it('pasar a otra membresía reemplaza a la que tenía; un plan que no se asigna (prueba, suelta) es 400', async () => {
      const a = await alta('Caro Cambia', planes.membresia);
      const res = await http().post(`${GIM}/alumnos/${a.id}/plan`).set(owner()).send({ planId: planes.oculto.id });
      expect(res.status).toBe(201);
      expect(res.body.planes.map((s: Suscripcion) => s.planId)).toEqual([planes.oculto.id]);
      expect((await http().post(`${GIM}/alumnos/${a.id}/plan`).set(owner()).send({ planId: planes.prueba.id })).status).toBe(400);
      expect((await http().post(`${GIM}/alumnos/${uuid()}/plan`).set(owner()).send({ planId: planes.pack.id })).status).toBe(404);
    });

    it('quitar un plan asignado por error lo saca; repetirlo no falla', async () => {
      const a = await alta('Dani Error', planes.pack);
      const quitar = () => http().delete(`${GIM}/alumnos/${a.id}/planes/${a.planes[0].id}`).set(owner());
      const res = await quitar();
      expect(res.status).toBe(200);
      expect(res.body.planes).toEqual([]);
      expect((await quitar()).status).toBe(200);
    });
  });

  describe('un pack se descuenta al reservar', () => {
    let ana: Alumno;
    let primera: string;

    it('anotar con el pack descuenta una clase y la reserva dice con qué se pagó', async () => {
      ana = await alta('Ana Pack');
      const res = await anotar(ana.id, dia(0));
      expect(res.status).toBe(201);
      primera = res.body.reserva.id;
      expect(res.body.reserva).toMatchObject({ estado: 'CONFIRMADA', origen: 'PANEL', clienteId: ana.clienteId, datos: { gimnasio: { pago: 'plan', suscripcionId: ana.planes[0].id, planId: planes.pack.id } } });
      expect(res.body.pago).toMatchObject({ pago: 'plan', plan: { usadas: 1, restantes: 1 } });
      expect((await alumno(ana.id)).planes[0]).toMatchObject({ usadas: 1, restantes: 1 });
    });

    it('repetir el pedido con la misma clave devuelve la misma reserva y no descuenta de nuevo', async () => {
      const clave = uuid();
      const uno = await anotar(ana.id, dia(1), { clave });
      const dos = await anotar(ana.id, dia(1), { clave });
      expect(uno.status).toBe(201);
      expect(dos.status).toBe(201);
      expect(dos.body.reserva.id).toBe(uno.body.reserva.id);
      expect((await alumno(ana.id)).planes[0]).toMatchObject({ usadas: 2, restantes: 0 });
    });

    it('sin clases en el pack no deja reservar: 409 con el motivo, y no queda ninguna reserva', async () => {
      const antes = await prisma.reserva.count({ where: { businessId, recursoId: claseId, clienteId: ana.clienteId } });
      const res = await anotar(ana.id, dia(2));
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/No le quedan clases en el pack/);
      expect(await prisma.reserva.count({ where: { businessId, recursoId: claseId, clienteId: ana.clienteId } })).toBe(antes);
    });

    it('igual se lo puede anotar cobrándole la clase aparte: no toca el pack y lleva el precio de la clase suelta', async () => {
      const res = await anotar(ana.id, dia(2), { pago: 'aparte' });
      expect(res.status).toBe(201);
      expect(res.body.reserva).toMatchObject({ precio: 6500, datos: { gimnasio: { pago: 'aparte', planId: planes.suelta.id } } });
      expect(res.body.pago).toEqual({ pago: 'aparte', plan: null, usadasEnLaSemana: null });
      expect((await alumno(ana.id)).planes[0]).toMatchObject({ usadas: 2, restantes: 0 });
    });

    it('al liberar un lugar la clase vuelve sola al pack, y se puede volver a usar', async () => {
      const cancelar = await http().post(`${PANEL}/${primera}/cancelar`).set(owner()).send({ motivo: 'e2e' });
      expect(cancelar.status).toBe(201);
      expect((await alumno(ana.id)).planes[0]).toMatchObject({ usadas: 1, restantes: 1 });
      expect((await anotar(ana.id, dia(3))).status).toBe(201);
    });

    it('dos pedidos a la vez con la última clase del pack: entra uno solo', async () => {
      const eva = await alta('Eva Carrera', planes.pack);
      expect((await anotar(eva.id, dia(0))).status).toBe(201);
      // Le queda una. Dos clases distintas, pedidas a la vez.
      const respuestas = await Promise.all([anotar(eva.id, dia(1)), anotar(eva.id, dia(2)), anotar(eva.id, dia(3)), anotar(eva.id, dia(4))]);
      expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
      expect((await alumno(eva.id)).planes[0]).toMatchObject({ usadas: 2, restantes: 0 });
      expect(await prisma.reserva.count({ where: { businessId, recursoId: claseId, clienteId: eva.clienteId, estado: 'CONFIRMADA' } })).toBe(2);
    }, LARGO);

    it('con dos packs vigentes se gasta primero el que vence antes', async () => {
      const fer = await alta('Fer Dos Packs', planes.pack);
      // El primero se "envejece" en la base: vence antes que el que se le suma ahora.
      await prisma.gimnasioSuscripcion.updateMany({ where: { businessId, id: fer.planes[0].id }, data: { hasta: sumarDias(hoy, 40) } });
      const conDos = await http().post(`${GIM}/alumnos/${fer.id}/plan`).set(owner()).send({ planId: planes.pack.id });
      expect(conDos.body.planes).toHaveLength(2);
      const [viejo, nuevo] = conDos.body.planes as Suscripcion[];
      expect(viejo.id).toBe(fer.planes[0].id);
      for (const n of [0, 1]) expect((await anotar(fer.id, dia(n))).body.reserva.datos.gimnasio.suscripcionId).toBe(viejo.id);
      expect((await anotar(fer.id, dia(2))).body.reserva.datos.gimnasio.suscripcionId).toBe(nuevo.id);
    }, LARGO);
  });

  describe('la membresía, la clase de prueba y los lugares sin definir', () => {
    it('una membresía de 1 por semana deja una clase por semana; la semana siguiente arranca de cero', async () => {
      const gabi = await alta('Gabi Semanal', planes.membresia);
      // El plan arranca hoy y dura 30 días: `lunes` cae adentro.
      const una = await anotar(gabi.id, dia(0));
      expect(una.status).toBe(201);
      expect(una.body.pago).toMatchObject({ pago: 'plan', usadasEnLaSemana: 1, plan: { restantes: null } });
      const otra = await anotar(gabi.id, dia(2));
      expect(otra.status).toBe(409);
      expect(otra.body.message).toMatch(/Ya usó su clase de esa semana/);
      expect((await anotar(gabi.id, dia(7))).status).toBe(201);
      // Dos lugares con la membresía, no: cubre uno.
      expect((await anotar(gabi.id, dia(14), { cantidad: 2 })).status).toBe(409);
    }, LARGO);

    it('la clase de prueba es una sola vez por persona; si la cancela, puede volver a pedirla', async () => {
      const hugo = await alta('Hugo Prueba');
      const una = await anotar(hugo.id, dia(0), { pago: 'prueba' });
      expect(una.status).toBe(201);
      expect((await alumno(hugo.id)).probo).toBe(true);
      const dos = await anotar(hugo.id, dia(1), { pago: 'prueba' });
      expect(dos.status).toBe(409);
      expect(dos.body.message).toMatch(/una sola vez por persona/);
      await http().post(`${PANEL}/${una.body.reserva.id}/cancelar`).set(owner()).send({});
      expect((await alumno(hugo.id)).probo).toBe(false);
      expect((await anotar(hugo.id, dia(1), { pago: 'prueba' })).status).toBe(201);
    }, LARGO);

    describe('un lugar reservado desde el sitio', () => {
      let iris: Alumno;
      const ids: string[] = [];
      const pasar = (id: string, pago = 'plan') => http().post(`${GIM}/reservas/${id}/pago`).set(employee()).send({ pago });

      it('nace sin definir cómo se paga: no toca el pack de quien reservó', async () => {
        iris = await alta('Iris Sitio', planes.pack);
        for (const n of [0, 1, 2]) {
          const res = await http().post(`${PUBLICO}/reservas/reservar`).send({
            modulo: 'GIMNASIO', recursoId: claseId, fecha: dia(n), inicioMinutos: 600, clave: uuid(), cliente: { nombre: 'Iris Sitio', email: mail('iris-sitio') },
          });
          expect(res.status).toBe(201);
          expect(res.body.datos).toBeNull();
          ids.push(res.body.id);
        }
        expect((await alumno(iris.id)).planes[0]).toMatchObject({ usadas: 0, restantes: 2 });
      }, LARGO);

      it('pasarlo al plan descuenta la clase; pasar dos veces el mismo no descuenta dos veces', async () => {
        const una = await pasar(ids[0]);
        expect(una.status).toBe(201);
        expect(una.body.reserva.datos).toEqual({ gimnasio: { pago: 'plan', suscripcionId: iris.planes[0].id, planId: planes.pack.id } });
        expect(una.body.pago).toMatchObject({ pago: 'plan', plan: { usadas: 1, restantes: 1 } });
        expect((await pasar(ids[0])).body.pago.plan).toMatchObject({ usadas: 1, restantes: 1 });
        expect((await pasar(ids[1])).status).toBe(201);
      }, LARGO);

      it('sin clases en el pack no se puede pasar; ese se cobra aparte, y pasar "aparte" uno del pack le devuelve la clase', async () => {
        const tercera = await pasar(ids[2]);
        expect(tercera.status).toBe(409);
        expect(tercera.body.message).toMatch(/No le quedan clases en el pack/);
        expect((await pasar(ids[2], 'aparte')).body.pago.pago).toBe('aparte');
        expect((await pasar(ids[1], 'aparte')).status).toBe(201);
        expect((await alumno(iris.id)).planes[0]).toMatchObject({ usadas: 1, restantes: 1 });
      }, LARGO);
    });

    it('una reserva de otro módulo o que no existe no se toca (404)', async () => {
      expect((await http().post(`${GIM}/reservas/${uuid()}/pago`).set(owner()).send({ pago: 'plan' })).status).toBe(404);
      expect((await anotar(uuid(), dia(0))).status).toBe(404);
    });

    it('un pedido mal armado es 400: sin clave, con un pago que no existe o sin decir quién', async () => {
      const base = { recursoId: claseId, fecha: dia(0), inicioMinutos: 600, pago: 'aparte', clave: uuid() };
      expect((await http().post(`${GIM}/reservas`).set(owner()).send({ ...base, clave: undefined, alumnoId: uuid() })).status).toBe(400);
      expect((await http().post(`${GIM}/reservas`).set(owner()).send({ ...base, pago: 'gratis', alumnoId: uuid() })).status).toBe(400);
      expect((await http().post(`${GIM}/reservas`).set(owner()).send(base)).status).toBe(400);
      expect((await http().post(`${GIM}/reservas`).set(owner()).send({ ...base, cliente: { nombre: 'Sin Contacto' } })).status).toBe(400);
    });
  });
});
