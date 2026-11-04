import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS, SEED_BUSINESS_SLUG } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';
import { fechaYMinutos, instante, sumarDias } from '../src/reservas/dominio/tiempo';

// El motor de reservas contra Postgres de verdad: lo que ningún mock prueba.
//
// - Dos (o seis) pedidos simultáneos por el mismo lugar: entra uno solo.
// - Repetir el pedido con la misma clave devuelve la misma reserva.
// - Una retenida vencida deja de ocupar lugar aunque nadie la haya barrido.
// - Una clase con cupo 3 y ocho personas a la vez: entran tres.
// - Al cancelar, el primero de la lista de espera toma el lugar.
// - La restricción de exclusión de la base rechaza dos reservas pisadas
//   aunque alguien se saltee el service.
// - Política de cancelación, reprogramación, permisos del panel.
//
// Usa el negocio seed (zapatoslorena) y limpia todo lo que crea en afterAll.
const PUBLICO = `/api/v1/storefront/${SEED_BUSINESS_SLUG}/reservas`;
const PANEL = '/api/v1/reservas';
const HORARIO_TODO_EL_DIA = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, [[0, 1440]]]));
const SESIONES = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, [[600, 660], [1140, 1200]]]));

const uuid = () => crypto.randomUUID();
const mail = (n: string) => `e2e-reservas-${n}@test.orbita`;

describe('Reservas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let employeeToken: string;
  let businessId: string;
  let canchaId: string;
  let claseId: string;
  // Un día futuro cualquiera, lejos del "ahora" del test.
  const hoy = fechaYMinutos(new Date()).fecha;
  const dia = sumarDias(hoy, 5);
  const otroDia = sumarDias(hoy, 6);

  const http = () => request(app.getHttpServer());
  const owner = () => ({ Authorization: `Bearer ${ownerToken}` });
  const employee = () => ({ Authorization: `Bearer ${employeeToken}` });

  const retener = (over: Record<string, unknown> = {}) =>
    http().post(`${PUBLICO}/retener`).send({ modulo: 'ALQUILERES', recursoId: canchaId, fecha: dia, inicioMinutos: 600, clave: uuid(), ...over });
  const reservar = (nombre: string, over: Record<string, unknown> = {}) =>
    http().post(`${PUBLICO}/reservar`).send({
      modulo: 'GIMNASIO', recursoId: claseId, fecha: dia, inicioMinutos: 600, clave: uuid(),
      cliente: { nombre, email: mail(nombre.toLowerCase().replace(/\s+/g, '-')) }, ...over,
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const ownerRes = await http().post('/api/v1/auth/login').send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;
    const employeeRes = await http().post('/api/v1/auth/login').send({ email: SEED_USERS.employee.email, password: SEED_USERS.employee.password });
    employeeToken = employeeRes.body.token;

    // Reglas: abierto todo el día, sin anticipación mínima, sin tope de reservas por persona.
    for (const modulo of ['ALQUILERES', 'GIMNASIO']) {
      const res = await http().put(`${PANEL}/config`).set(owner()).send({
        modulo, horario: HORARIO_TODO_EL_DIA, anticipacionMinimaMinutos: 0, anticipacionMaximaDias: 365, retencionMinutos: 10,
        cancelacionHastaHoras: 0, reprogramacionHastaHoras: 0, maximoActivasPorCliente: 0, listaDeEspera: true, confirmacion: 'AUTOMATICA',
      });
      expect(res.status).toBe(200);
    }
    const cancha = await http().post(`${PANEL}/recursos`).set(owner()).send({
      modulo: 'ALQUILERES', tipo: 'CANCHA', nombre: '[e2e] Cancha 1', duracionMinutos: 60, precio: 8000, maximoSeguidos: 2,
    });
    expect(cancha.status).toBe(201);
    canchaId = cancha.body.id;
    const clase = await http().post(`${PANEL}/recursos`).set(owner()).send({
      modulo: 'GIMNASIO', tipo: 'CLASE', nombre: '[e2e] Funcional', duracionMinutos: 60, cupo: 3, precio: 2500, horario: SESIONES,
    });
    expect(clase.status).toBe(201);
    claseId = clase.body.id;
  });

  afterAll(async () => {
    const recursos = [canchaId, claseId].filter(Boolean);
    if (recursos.length) {
      const reservas = await prisma.reserva.findMany({ where: { businessId, recursoId: { in: recursos } }, select: { id: true } });
      const ids = reservas.map((r) => r.id);
      await prisma.reservaHistorial.deleteMany({ where: { businessId, reservaId: { in: ids } } });
      await prisma.reservaEspera.deleteMany({ where: { businessId, recursoId: { in: recursos } } });
      await prisma.reservaBloqueo.deleteMany({ where: { businessId, recursoId: { in: recursos } } });
      await prisma.reserva.deleteMany({ where: { businessId, id: { in: ids } } });
      await prisma.reservaRecurso.deleteMany({ where: { businessId, id: { in: recursos } } });
    }
    await prisma.reservaConfig.deleteMany({ where: { businessId, modulo: { in: ['ALQUILERES', 'GIMNASIO'] } } });
    await prisma.customer.deleteMany({ where: { businessId, email: { startsWith: 'e2e-reservas-' } } });
    await closeTestApp();
  });

  describe('una cancha (cupo 1)', () => {
    it('la disponibilidad del día ofrece la franja de las 10 libre', async () => {
      const res = await http().get(`${PUBLICO}/disponibilidad`).query({ modulo: 'ALQUILERES', recursoId: canchaId, fecha: dia });
      expect(res.status).toBe(200);
      const diez = res.body.franjas.find((f: { inicioMinutos: number }) => f.inicioMinutos === 600);
      expect(diez).toMatchObject({ libres: 1, cupo: 1, seguidas: 2 });
    });

    let tokenGanador: string;

    it('seis personas tocan el botón a la vez: entra una sola, las demás reciben 409', async () => {
      const respuestas = await Promise.all(Array.from({ length: 6 }, () => retener()));
      const ok = respuestas.filter((r) => r.status === 201);
      const chocaron = respuestas.filter((r) => r.status === 409);
      expect(ok).toHaveLength(1);
      expect(chocaron).toHaveLength(5);
      expect(chocaron[0].body.message).toMatch(/se acaba de ocupar/);
      expect(ok[0].body.estado).toBe('RETENIDA');
      expect(ok[0].body.token).toHaveLength(32);
      tokenGanador = ok[0].body.token;
      // La franja ya no se ofrece.
      const disp = await http().get(`${PUBLICO}/disponibilidad`).query({ modulo: 'ALQUILERES', recursoId: canchaId, fecha: dia });
      expect(disp.body.franjas.find((f: { inicioMinutos: number }) => f.inicioMinutos === 600).libres).toBe(0);
    });

    it('repetir el pedido con la misma clave devuelve la misma reserva (doble clic)', async () => {
      const clave = uuid();
      const a = await retener({ inicioMinutos: 720, clave });
      const b = await retener({ inicioMinutos: 720, clave });
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(b.body.id).toBe(a.body.id);
    });

    it('confirmar la retenida la deja firme; confirmarla dos veces no la toca', async () => {
      const cliente = { nombre: 'Ana Pérez', email: mail('ana'), telefono: '11 5555 0001' };
      const a = await http().post(`${PUBLICO}/mi/${tokenGanador}/confirmar`).send({ cliente, notas: 'Vamos cuatro' });
      expect(a.status).toBe(201);
      expect(a.body).toMatchObject({ estado: 'CONFIRMADA', clienteNombre: 'Ana Pérez', precio: 8000, retenidaHasta: null });
      const b = await http().post(`${PUBLICO}/mi/${tokenGanador}/confirmar`).send({ cliente });
      expect(b.status).toBe(201);
      expect(b.body.version).toBe(a.body.version);
      // Quedó la ficha del cliente, vinculada.
      const ficha = await prisma.customer.findFirst({ where: { businessId, email: mail('ana') } });
      expect(ficha).not.toBeNull();
      expect(a.body.clienteId).toBe(ficha!.id);
    });

    it('una retenida vencida deja de ocupar lugar aunque nadie la haya barrido', async () => {
      const vieja = await retener({ inicioMinutos: 840 });
      expect(vieja.status).toBe(201);
      // El tiempo pasa: la retención venció hace un minuto.
      await prisma.reserva.update({ where: { id: vieja.body.id }, data: { retenidaHasta: new Date(Date.now() - 60_000) } });
      const nueva = await retener({ inicioMinutos: 840 });
      expect(nueva.status).toBe(201);
      expect(nueva.body.id).not.toBe(vieja.body.id);
      const estadoVieja = await prisma.reserva.findUnique({ where: { id: vieja.body.id }, select: { estado: true } });
      expect(estadoVieja?.estado).toBe('VENCIDA');
      // Y confirmar la vencida ya no se puede.
      const tarde = await http().post(`${PUBLICO}/mi/${vieja.body.token}/confirmar`).send({ cliente: { nombre: 'Tarde', email: mail('tarde') } });
      expect(tarde.status).toBe(409);
    });

    it('la restricción de exclusión de la base rechaza dos reservas pisadas aunque alguien se saltee el service', async () => {
      const base = {
        businessId, modulo: 'ALQUILERES' as const, recursoId: canchaId, estado: 'CONFIRMADA' as const, origen: 'PANEL' as const,
        inicio: instante(otroDia, 1200), fin: instante(otroDia, 1260), fecha: otroDia, exclusivo: true, clienteNombre: 'Directo',
      };
      const primera = await prisma.reserva.create({ data: { ...base, codigo: 'E2EAAA', tokenAcceso: `e2e-${uuid()}` } });
      await expect(prisma.reserva.create({ data: { ...base, codigo: 'E2EBBB', tokenAcceso: `e2e-${uuid()}`, inicio: instante(otroDia, 1230), fin: instante(otroDia, 1290) } }))
        .rejects.toThrow(/reservas_sin_solapamiento|23P01|exclusion/);
      // Cancelada, deja de contar: ahora sí entra.
      await prisma.reserva.update({ where: { id: primera.id }, data: { estado: 'CANCELADA' } });
      const segunda = await prisma.reserva.create({ data: { ...base, codigo: 'E2ECCC', tokenAcceso: `e2e-${uuid()}`, inicio: instante(otroDia, 1230), fin: instante(otroDia, 1290) } });
      expect(segunda.id).toBeDefined();
    });

    it('reprogramar a un horario libre mueve la reserva; a uno ocupado, 409', async () => {
      const libre = await http().post(`${PUBLICO}/mi/${tokenGanador}/reprogramar`).send({ fecha: dia, inicioMinutos: 900 });
      expect(libre.status).toBe(201);
      expect(libre.body).toMatchObject({ inicioMinutos: 900, finMinutos: 960, reprogramaciones: 1 });
      // Las 10 quedaron libres y las 15 ocupadas.
      const disp = await http().get(`${PUBLICO}/disponibilidad`).query({ modulo: 'ALQUILERES', recursoId: canchaId, fecha: dia });
      const por = Object.fromEntries(disp.body.franjas.map((f: { inicioMinutos: number; libres: number }) => [f.inicioMinutos, f.libres]));
      expect(por[600]).toBe(1);
      expect(por[900]).toBe(0);
      // Otra persona toma las 10 y la primera quiere volver: ya no puede.
      const otra = await retener({ inicioMinutos: 600 });
      expect(otra.status).toBe(201);
      const choque = await http().post(`${PUBLICO}/mi/${tokenGanador}/reprogramar`).send({ fecha: dia, inicioMinutos: 600 });
      expect(choque.status).toBe(409);
    });

    it('la política de cancelación se respeta: con 48 h de plazo, mañana ya no se cancela', async () => {
      await http().put(`${PANEL}/config`).set(owner()).send({ modulo: 'ALQUILERES', cancelacionHastaHoras: 48 });
      const manana = sumarDias(hoy, 1);
      const r = await http().post(`${PUBLICO}/reservar`).send({
        modulo: 'ALQUILERES', recursoId: canchaId, fecha: manana, inicioMinutos: 1380, clave: uuid(), cliente: { nombre: 'Beto', email: mail('beto') },
      });
      expect(r.status).toBe(201);
      const mi = await http().get(`${PUBLICO}/mi/${r.body.token}`);
      expect(mi.status).toBe(200);
      expect(mi.body.politica.puedeCancelar).toBe(false);
      const cancel = await http().post(`${PUBLICO}/mi/${r.body.token}/cancelar`).send({});
      expect(cancel.status).toBe(400);
      // El negocio sí puede, siempre.
      const delPanel = await http().post(`${PANEL}/${r.body.id}/cancelar`).set(owner()).send({ motivo: 'Lluvia' });
      expect(delPanel.status).toBe(201);
      expect(delPanel.body.estado).toBe('CANCELADA');
      // Y cancelar lo ya cancelado no rompe nada.
      const otraVez = await http().post(`${PUBLICO}/mi/${r.body.token}/cancelar`).send({});
      expect(otraVez.status).toBe(201);
      expect(otraVez.body.estado).toBe('CANCELADA');
      await http().put(`${PANEL}/config`).set(owner()).send({ modulo: 'ALQUILERES', cancelacionHastaHoras: 0 });
    });
  });

  describe('una clase con cupo 3', () => {
    const tokens: string[] = [];

    it('ocho personas a la vez: entran tres, el resto recibe 409', async () => {
      const respuestas = await Promise.all(Array.from({ length: 8 }, (_, i) => reservar(`Socio ${i}`)));
      const ok = respuestas.filter((r) => r.status === 201);
      const llenas = respuestas.filter((r) => r.status === 409);
      expect(ok).toHaveLength(3);
      expect(llenas).toHaveLength(5);
      expect(llenas[0].body.message).toMatch(/lugar/);
      tokens.push(...ok.map((r) => r.body.token as string));
      const disp = await http().get(`${PUBLICO}/disponibilidad`).query({ modulo: 'GIMNASIO', recursoId: claseId, fecha: dia });
      const diez = disp.body.franjas.find((f: { inicioMinutos: number }) => f.inicioMinutos === 600);
      expect(diez).toMatchObject({ libres: 0, cupo: 3 });
    });

    it('con la clase llena se entra en lista de espera, y al cancelar uno el primero toma el lugar', async () => {
      const directo = await reservar('Tarde');
      expect(directo.status).toBe(409);
      const espera = await http().post(`${PUBLICO}/espera`).send({ modulo: 'GIMNASIO', recursoId: claseId, fecha: dia, inicioMinutos: 600, cliente: { nombre: 'En Espera', email: mail('espera') } });
      expect(espera.status).toBe(201);
      expect(espera.body.posicion).toBe(1);
      // Con lugar no se puede anotar en la lista (hay que reservar directo).
      const sinSentido = await http().post(`${PUBLICO}/espera`).send({ modulo: 'GIMNASIO', recursoId: claseId, fecha: dia, inicioMinutos: 1140, cliente: { nombre: 'Nadie', email: mail('nadie') } });
      expect(sinSentido.status).toBe(400);

      const cancel = await http().post(`${PUBLICO}/mi/${tokens[0]}/cancelar`).send({ motivo: 'Me surgió algo' });
      expect(cancel.status).toBe(201);
      expect(cancel.body.estado).toBe('CANCELADA');

      const miEspera = await http().get(`${PUBLICO}/espera/${espera.body.token}`);
      expect(miEspera.status).toBe(200);
      expect(miEspera.body.estado).toBe('TOMADA');
      expect(miEspera.body.reserva).toMatchObject({ estado: 'CONFIRMADA', clienteNombre: 'En Espera', inicioMinutos: 600 });
      // La clase sigue llena.
      const disp = await http().get(`${PUBLICO}/disponibilidad`).query({ modulo: 'GIMNASIO', recursoId: claseId, fecha: dia });
      expect(disp.body.franjas.find((f: { inicioMinutos: number }) => f.inicioMinutos === 600).libres).toBe(0);
    });

    it('una sesión que no existe no se reserva', async () => {
      const res = await reservar('Fuera', { inicioMinutos: 630 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no hay clase/);
    });
  });

  describe('el panel', () => {
    let creadaId: string;

    it('el empleado ve la agenda y da reservas, pero no configura', async () => {
      const lista = await http().get(PANEL).set(employee()).query({ modulo: 'ALQUILERES', desde: dia, hasta: dia });
      expect(lista.status).toBe(200);
      expect(lista.body.total).toBeGreaterThan(0);
      expect(lista.body.data[0].notaInterna).toBeDefined(); // el panel ve la nota interna; el sitio, no
      const config = await http().put(`${PANEL}/config`).set(employee()).send({ modulo: 'ALQUILERES' });
      expect(config.status).toBe(403);
      const creada = await http().post(PANEL).set(employee()).send({
        modulo: 'ALQUILERES', recursoId: canchaId, fecha: otroDia, inicioMinutos: 540, cliente: { nombre: 'Walk-in', telefono: '11 4444 0000' }, notaInterna: 'Paga en efectivo',
      });
      expect(creada.status).toBe(201);
      expect(creada.body).toMatchObject({ estado: 'CONFIRMADA', origen: 'PANEL', notaInterna: 'Paga en efectivo' });
      creadaId = creada.body.id;
      // Un precio a mano exige reservas.config.
      const conPrecio = await http().post(PANEL).set(employee()).send({ modulo: 'ALQUILERES', recursoId: canchaId, fecha: otroDia, inicioMinutos: 660, cliente: { nombre: 'Equis' }, precio: 1 });
      expect(conPrecio.status).toBe(403);
    });

    it('no se marca atendida antes de la hora; el pago no puede pasarse del total', async () => {
      const temprano = await http().post(`${PANEL}/${creadaId}/completar`).set(owner()).send({});
      expect(temprano.status).toBe(400);
      const pago = await http().post(`${PANEL}/${creadaId}/pago`).set(owner()).send({ monto: 3000, metodo: 'EFECTIVO' });
      expect(pago.status).toBe(201);
      expect(pago.body.pagado).toBe(3000);
      const deMas = await http().post(`${PANEL}/${creadaId}/pago`).set(owner()).send({ monto: 6000, metodo: 'EFECTIVO' });
      expect(deMas.status).toBe(400);
      const detalle = await http().get(`${PANEL}/${creadaId}`).set(owner());
      expect(detalle.status).toBe(200);
      expect(detalle.body.historial.length).toBeGreaterThanOrEqual(2);
    });

    it('un bloqueo avisa cuántas reservas quedaron adentro y después no deja reservar', async () => {
      const bloqueo = await http().post(`${PANEL}/bloqueos`).set(owner()).send({ modulo: 'ALQUILERES', recursoId: canchaId, fechaDesde: otroDia, minutoDesde: 480, minutoHasta: 600, motivo: 'Mantenimiento' });
      expect(bloqueo.status).toBe(201);
      expect(bloqueo.body.afectadas).toBe(1); // la de las 9 que dio el empleado
      const tapado = await retener({ fecha: otroDia, inicioMinutos: 480 });
      expect(tapado.status).toBe(400);
      expect(tapado.body.message).toMatch(/bloqueado/);
    });

    it('el resumen cuenta por estado', async () => {
      const res = await http().get(`${PANEL}/resumen`).set(owner()).query({ modulo: 'GIMNASIO', desde: dia, hasta: dia });
      expect(res.status).toBe(200);
      expect(res.body.porEstado.CONFIRMADA).toBe(3);
      expect(res.body.porEstado.CANCELADA).toBe(1);
    });
  });
});
