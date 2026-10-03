import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { COBRO_ONLINE_TURNOS, CobroOnlineTurnos } from '../src/appointments/avanzado/comun/cobro-online';
import { CrearTurno, NucleoTurnos } from '../src/appointments/avanzado/comun/nucleo-turnos';
import { AUDIENCIA_OFERTA, ListaEsperaService } from '../src/appointments/avanzado/lista-espera/lista-espera.service';
import { TurnoFijoService } from '../src/appointments/avanzado/turno-fijo/turno-fijo.service';
import { PaquetesService } from '../src/appointments/avanzado/paquetes/paquetes.service';
import { GiftCardsService } from '../src/appointments/avanzado/gift-cards/gift-cards.service';
import { FidelidadService } from '../src/appointments/avanzado/fidelidad/fidelidad.service';
import { PreciosHorarioService } from '../src/appointments/avanzado/precios-horario/precios-horario.service';
import { AvanzadoPagosService } from '../src/appointments/avanzado/pagos/pagos.service';
import { MembresiasService } from '../src/appointments/avanzado/membresias/membresias.service';
import { RecuperarService } from '../src/appointments/avanzado/recuperar/recuperar.service';
import { instanteDe, sumarDias } from '../src/appointments/horarios/horarios';
import { fechaArgentina } from '../src/common/utils/hora-argentina';
import { limpiarNegocios } from './helpers/limpiar-negocio';

// Avanzado de Turnos (P4, CONTRATO.md de src/appointments) por HTTP, contra
// Postgres de verdad: cada endpoint con y sin el add-on ADVANCED, los gates de
// permiso, el aislamiento entre negocios, y las operaciones que se enchufan en
// la reserva corriendo en transacciones reales (locks, updates condicionados,
// la constraint de exclusión de turnos y los SAVEPOINT del turno fijo).
//
// Arma su propio negocio de turnos (no depende del seed) y lo borra al final
// con limpiarNegocios. Dos reemplazos, ambos documentados:
// - COBRO_ONLINE_TURNOS: una preferencia de Mercado Pago falsa (no sale a MP).
// - NUCLEO_TURNOS: todavía no existe en la rama (lo registra P1). Para probar
//   el turno fijo y la lista de espera se enchufa un núcleo de PRUEBA que
//   inserta el turno directo; la base rechaza dos turnos pisados con la
//   constraint `appointments_no_overlap`, y eso se traduce a 409.
//
// Se corre como el resto (`pnpm test:e2e -- appointments-p4`, contra la base
// de dev, ver DEPLOYMENT.md) o contra un Postgres descartable con las
// migraciones aplicadas.

const SUF = randomBytes(3).toString('hex');
const SLUG = `e2e-p4-${SUF}`;
const SLUG_B = `e2e-p4b-${SUF}`;
const SLUG_TIENDA = `e2e-p4t-${SUF}`;
const CLAVE = 'Turnos1234!';
const H = (h: number) => h * 60;
const SEMANA = [0, 1, 2, 3, 4].map(() => [[H(9), H(13)], [H(16), H(20)]]).concat([[[H(9), H(13)]], []]);

const lunesQueViene = (semanas = 1) => {
  let f = sumarDias(fechaArgentina(new Date()), 1);
  while (new Date(`${f}T12:00:00Z`).getUTCDay() !== 1) f = sumarDias(f, 1);
  return sumarDias(f, 7 * (semanas - 1));
};

describe('Avanzado de Turnos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const negocios: string[] = [];
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  let preferencia: { preferenceId: string; initPoint: string } | null = { preferenceId: 'pref-e2e', initPoint: 'https://mp.test/checkout' };

  const http = () => request(app.getHttpServer());
  const como = (quien: string, slug = SLUG) => ({ Authorization: `Bearer ${tokens[quien]}`, 'X-Business-Slug': slug });
  const api = (ruta: string) => `/api/v1/${ruta}`;

  /** El núcleo de prueba: inserta el turno con el tx que recibe; un turno pisado lo rechaza la base (23P01) → 409. */
  const crearTurnoDePrueba: CrearTurno = async (d, tx) => {
    const servicio = await tx.appointmentService.findFirst({ where: { id: d.serviceId, businessId: d.businessId } });
    const resourceId = d.resourceId === 'cualquiera' ? ids.recurso : d.resourceId;
    const startsAt = instanteDe(d.date, d.startMin);
    try {
      const t = await tx.appointment.create({
        data: {
          businessId: d.businessId, code: randomBytes(3).toString('hex').toUpperCase(), accessToken: randomBytes(32).toString('base64url'),
          resourceId, serviceId: d.serviceId, customerId: d.customerId, customerName: d.customerName, customerPhone: d.customerPhone,
          customerEmail: d.customerEmail, serviceName: servicio!.name, startsAt, endsAt: new Date(startsAt.getTime() + servicio!.durationMin * 60_000),
          durationMin: servicio!.durationMin, price: servicio!.price, status: 'CONFIRMED', origin: d.origin, createdByMemberId: d.createdByMemberId,
          recurringSeriesId: d.recurringSeriesId ?? null,
        },
      });
      return { id: t.id, startsAt: t.startsAt };
    } catch (err) {
      if (/23P01|appointments_no_overlap/.test(String((err as Error).message))) throw new ConflictException('Ese horario se acaba de ocupar. Elegí otro.');
      throw err;
    }
  };

  async function crearNegocio(slug: string, vertical: 'APPOINTMENTS' | 'STORE') {
    const b = await prisma.business.create({ data: { name: `E2E P4 ${slug}`, industry: vertical === 'APPOINTMENTS' ? 'barberia' : 'Indumentaria', subdomain: slug, vertical } });
    negocios.push(b.id);
    if (vertical === 'APPOINTMENTS') {
      await prisma.appointmentSettings.create({
        data: { businessId: b.id, rubroKey: 'barberia', agendaMode: 'PROFESSIONAL', weekSchedule: SEMANA, minAdvanceMin: 0, waitlistEnabled: true, waitlistAcceptMin: 30 },
      });
    }
    const owner = await prisma.role.create({ data: { businessId: b.id, name: 'owner', isDefault: true } });
    const hash = await argon2.hash(CLAVE);
    await prisma.member.create({ data: { businessId: b.id, name: 'Dueño', email: `dueno@${slug}.test`, roleId: owner.id, status: 'ACTIVE', passwordHash: hash, emailVerified: true } });
    return b;
  }

  async function login(email: string, slug: string) {
    const r = await http().post(api('auth/login')).set('X-Business-Slug', slug).send({ email, password: CLAVE }).expect(201);
    return r.body.token as string;
  }

  const ponerAddon = (businessId: string, isActive: boolean) => prisma.businessAddon.upsert({
    where: { businessId_type: { businessId, type: 'ADVANCED' } },
    create: { businessId, type: 'ADVANCED', isActive },
    update: { isActive, expiresAt: null },
  });

  beforeAll(async () => {
    const cobro: CobroOnlineTurnos = { crearPreferencia: async () => preferencia };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('THROTTLER:MODULE_OPTIONS').useValue({ throttlers: [{ name: 'default', ttl: 60000, limit: 10000 }], skipIf: () => true })
      .overrideProvider(COBRO_ONLINE_TURNOS).useValue(cobro)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const a = await crearNegocio(SLUG, 'APPOINTMENTS');
    const b = await crearNegocio(SLUG_B, 'APPOINTMENTS');
    const t = await crearNegocio(SLUG_TIENDA, 'STORE');
    ids.biz = a.id; ids.bizB = b.id; ids.tienda = t.id;

    // Un rol de recepción: ve la agenda pero no configura (sin appointments.settings.manage).
    const permiso = await prisma.permission.findFirstOrThrow({ where: { code: 'appointments.agenda.view' } });
    const recepcion = await prisma.role.create({ data: { businessId: a.id, name: 'Recepción', rolePermissions: { create: [{ permissionId: permiso.id }] } } });
    await prisma.member.create({ data: { businessId: a.id, name: 'Recepción', email: `recepcion@${SLUG}.test`, roleId: recepcion.id, status: 'ACTIVE', passwordHash: await argon2.hash(CLAVE), emailVerified: true } });

    const srv = await prisma.appointmentService.create({ data: { businessId: a.id, name: 'Corte', durationMin: 30, price: 10_000 } });
    const srvB = await prisma.appointmentService.create({ data: { businessId: b.id, name: 'Corte B', durationMin: 30, price: 9_000 } });
    const rec = await prisma.appointmentResource.create({ data: { businessId: a.id, kind: 'PERSON', name: 'Julio', workDays: [0, 1, 2, 3, 4, 5] } });
    ids.servicio = srv.id; ids.servicioB = srvB.id; ids.recurso = rec.id;

    const cliente = await prisma.customer.create({ data: { businessId: a.id, firstName: 'Ana', lastName: 'Paz', phone: '1155550101', email: `ana@${SLUG}.test`, passwordHash: await argon2.hash(CLAVE) } });
    ids.cliente = cliente.id;

    tokens.owner = await login(`dueno@${SLUG}.test`, SLUG);
    tokens.recepcion = await login(`recepcion@${SLUG}.test`, SLUG);
    tokens.ownerB = await login(`dueno@${SLUG_B}.test`, SLUG_B);
    tokens.tienda = await login(`dueno@${SLUG_TIENDA}.test`, SLUG_TIENDA);
    tokens.cliente = await login(`ana@${SLUG}.test`, SLUG);
    await ponerAddon(b.id, true);
  }, 60_000);

  afterAll(async () => {
    if (prisma) await limpiarNegocios(prisma as never, negocios);
    if (app) await app.close();
  });

  // ── Sin el add-on ─────────────────────────────────────────────────────────

  describe('sin el add-on ADVANCED', () => {
    it('el hub se ve (con el candado) y dice hasAdvanced: false', async () => {
      const r = await http().get(api('appointments/advanced')).set(como('owner')).expect(200);
      expect(r.body.hasAdvanced).toBe(false);
      expect(r.body.functions.paquetes).toEqual({ on: false, config: { compartir: false, avisoUltimas: true, avisoVence: true } });
      expect(r.body.recommended).toEqual(expect.arrayContaining(['fidelidad']));
    });

    it('lecturas y escrituras del panel: 403 ADDON_REQUIRED:ADVANCED', async () => {
      for (const [metodo, ruta] of [
        ['put', 'appointments/advanced/paquetes'], ['get', 'appointments/packages'], ['post', 'appointments/packages'], ['get', 'appointments/package-purchases'],
        ['get', 'appointments/membership-plans'], ['get', 'appointments/memberships'], ['get', 'appointments/gift-cards'], ['post', 'appointments/gift-cards'],
        ['get', 'appointments/price-rules'], ['post', 'appointments/price-rules'], ['get', 'appointments/loyalty'], ['get', 'appointments/recurring'],
        ['post', 'appointments/recurring'], ['get', 'appointments/winback'], ['put', 'appointments/winback'], ['post', 'appointments/winback/send'],
      ] as const) {
        const r = await http()[metodo](api(ruta)).set(como('owner')).send({});
        expect([ruta, r.status, r.body.message]).toEqual([ruta, 403, 'ADDON_REQUIRED:ADVANCED']);
      }
    });

    it('lo público responde como si la función no existiera (vacío / 404, nunca 403)', async () => {
      await http().get(api(`storefront/${SLUG}/appointments/packages`)).expect(200).expect([]);
      await http().get(api(`storefront/${SLUG}/appointments/membership-plans`)).expect(200).expect([]);
      await http().get(api(`storefront/${SLUG}/appointments/gift-cards/ABCDEFGH23`)).expect(404);
      await http().post(api(`storefront/${SLUG}/appointments/gift-cards`)).send({ kind: 'AMOUNT', amount: 10_000, style: 'noche', buyerName: 'Juli', buyerPhone: '1155550101', buyerEmail: 'j@mail.com' }).expect(404);
    });

    it('la lista de espera no es de Avanzado: anda sin el add-on', async () => {
      await http().get(api('appointments/waitlist')).set(como('owner')).expect(200).expect([]);
    });
  });

  // ── Con el add-on ─────────────────────────────────────────────────────────

  describe('con el add-on', () => {
    beforeAll(async () => { await ponerAddon(ids.biz, true); });

    it('una tienda (STORE) no usa Turnos: 404 en el panel y en el sitio', async () => {
      const r = await http().get(api('appointments/advanced')).set(como('tienda', SLUG_TIENDA)).expect(404);
      expect(r.body.message).toBe('Este negocio no usa Turnos');
      await http().get(api(`storefront/${SLUG_TIENDA}/appointments/packages`)).expect(404);
    });

    it('quien no tiene appointments.settings.manage lee pero no configura (403 Permiso requerido)', async () => {
      await http().get(api('appointments/packages')).set(como('recepcion')).expect(200);
      const r = await http().put(api('appointments/advanced/paquetes')).set(como('recepcion')).send({ on: true }).expect(403);
      expect(r.body.message).toBe('Permiso requerido: appointments.settings.manage');
      await http().post(api('appointments/packages')).set(como('recepcion')).send({ serviceId: ids.servicio, sessions: 4, price: 30_000, validDays: 60 }).expect(403);
    });

    it('hub: prender funciones y validar su config', async () => {
      await http().put(api('appointments/advanced/paquetes')).set(como('owner')).send({ on: true, config: { inventado: 1 } }).expect(400);
      await http().put(api('appointments/advanced/no-existe')).set(como('owner')).send({ on: true }).expect(404);
      for (const [f, config] of [
        ['paquetes', undefined], ['membresias', { diaCobro: 1, matricula: 5_000 }], ['gift-cards', { montoLibre: true }],
        ['precios-horario', undefined], ['fidelidad', { sellos: 3 }], ['recuperar', undefined],
        ['turno-fijo', { serviceIds: [ids.servicio], frecuencias: ['WEEKLY', 'BIWEEKLY'], saltearFeriados: true }],
      ] as const) {
        const r = await http().put(api(`appointments/advanced/${f}`)).set(como('owner')).send({ on: true, ...(config ? { config } : {}) }).expect(200);
        expect(r.body[f].on).toBe(true);
      }
      const hub = await http().get(api('appointments/advanced')).set(como('owner')).expect(200);
      expect(hub.body.hasAdvanced).toBe(true);
      expect(hub.body.functions.membresias.config).toMatchObject({ diaCobro: 1, matricula: 5_000, pausa: true, diasPausa: 15 });
      const log = await prisma.auditLog.findFirst({ where: { businessId: ids.biz, entityType: 'appointment_settings', action: 'ACTIVATE' } });
      expect(log).not.toBeNull();
    });

    // ── Paquetes ────────────────────────────────────────────────────────────

    it('paquetes: CRUD, venta en el local y lista de compras activas', async () => {
      await http().post(api('appointments/packages')).set(como('owner')).send({ serviceId: ids.servicio, sessions: 1, price: 0, validDays: 9999 }).expect(400);
      await http().post(api('appointments/packages')).set(como('owner')).send({ serviceId: ids.servicioB, sessions: 4, price: 30_000, validDays: 60 }).expect(400); // servicio de OTRO negocio
      const p = await http().post(api('appointments/packages')).set(como('owner')).send({ serviceId: ids.servicio, sessions: 4, price: 36_000, validDays: 60 }).expect(201);
      ids.paquete = p.body.id;
      expect(p.body).toMatchObject({ serviceName: 'Corte', sessions: 4, price: 36_000, sold: 0, isActive: true });
      await http().put(api(`appointments/packages/${ids.paquete}`)).set(como('owner')).send({ serviceId: ids.servicio, sessions: 2, price: 18_000, validDays: 30 }).expect(200);

      const venta = await http().post(api('appointments/package-purchases')).set(como('owner')).send({ packageId: ids.paquete, customerId: ids.cliente, method: 'CASH' }).expect(201);
      ids.compra = venta.body.id;
      expect(venta.body).toMatchObject({ sessionsTotal: 2, sessionsUsed: 0, paid: true, customerName: 'Ana Paz' });
      const pago = await prisma.appointmentPayment.findFirst({ where: { businessId: ids.biz, packagePurchaseId: ids.compra } });
      expect(pago).toMatchObject({ kind: 'PACKAGE', status: 'APPROVED', method: 'CASH' });

      const activas = await http().get(api(`appointments/package-purchases?active=true&customerId=${ids.cliente}`)).set(como('owner')).expect(200);
      expect(activas.body).toMatchObject({ total: 1, page: 1 });
      const lista = await http().get(api('appointments/packages')).set(como('owner')).expect(200);
      expect(lista.body[0]).toMatchObject({ id: ids.paquete, sold: 1 });
    });

    it('paquetes: CONCURRENCIA real — dos reservas a la vez por la última sesión → una sola entra', async () => {
      const svc = app.get(PaquetesService);
      const inicio = (h: number) => instanteDe(lunesQueViene(3), H(h));
      // Ya hay un turno activo que toma una de las 2 sesiones.
      await prisma.appointment.create({ data: turnoFila(inicio(9), { packagePurchaseId: ids.compra }) });
      const reservar = (h: number) => prisma.$transaction(async (tx) => {
        await svc.canjearSesionDePaquete({ businessId: ids.biz, packagePurchaseId: ids.compra, customerId: ids.cliente, serviceId: ids.servicio, startsAt: inicio(h) }, tx);
        await new Promise((r) => setTimeout(r, 150)); // el otro llega mientras este tiene el lock
        return tx.appointment.create({ data: turnoFila(inicio(h), { packagePurchaseId: ids.compra }) });
      });
      const r = await Promise.allSettled([reservar(10), reservar(11)]);
      expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect((r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason.message).toBe('Ese paquete ya no tiene sesiones libres.');
      // Atender consume (condicionado: nunca pasa del total).
      expect(await svc.consumirSesionDePaquete(ids.biz, ids.compra)).toBe(true);
      expect(await svc.consumirSesionDePaquete(ids.biz, ids.compra)).toBe(true);
      expect(await svc.consumirSesionDePaquete(ids.biz, ids.compra)).toBe(false);
      await prisma.appointment.deleteMany({ where: { businessId: ids.biz, packagePurchaseId: ids.compra } });
    });

    it('paquetes: sitio público y compra con Mercado Pago (con y sin MP conectado)', async () => {
      const pub = await http().get(api(`storefront/${SLUG}/appointments/packages`)).expect(200);
      expect(pub.body).toEqual([expect.objectContaining({ id: ids.paquete, serviceName: 'Corte', sessions: 2 })]);
      expect(pub.body[0].sold).toBeUndefined();
      const compra = await http().post(api(`storefront/${SLUG}/appointments/packages/${ids.paquete}/buy`)).send({ name: 'Ana Paz', phone: '11 5555-0101' }).expect(201);
      expect(compra.body.payment).toEqual({ paymentId: expect.any(String), amount: 18_000, initPoint: 'https://mp.test/checkout' });
      const fila = await prisma.appointmentPackagePurchase.findFirst({ where: { id: compra.body.purchaseId, businessId: ids.biz } });
      expect(fila).toMatchObject({ paidAt: null, customerId: ids.cliente }); // se encontró la ficha por teléfono
      // El webhook (P2) aprueba el pago → la compra queda paga.
      await expect(app.get(AvanzadoPagosService).aplicarPagoAprobado(ids.biz, compra.body.payment.paymentId)).resolves.toEqual({ kind: 'PACKAGE', aplicado: true });
      await expect(app.get(AvanzadoPagosService).aplicarPagoAprobado(ids.biz, compra.body.payment.paymentId)).resolves.toEqual({ kind: 'PACKAGE', aplicado: false });

      preferencia = null;
      const sinMp = await http().post(api(`storefront/${SLUG}/appointments/packages/${ids.paquete}/buy`)).send({ name: 'Ana Paz', phone: '1155550101' }).expect(400);
      expect(sinMp.body.message).toBe('Este negocio no cobra online. Coordiná el pago con ellos.');
      preferencia = { preferenceId: 'pref-e2e', initPoint: 'https://mp.test/checkout' };
    });

    it('paquetes: un negocio no ve ni toca los paquetes de otro (404)', async () => {
      await http().put(api(`appointments/packages/${ids.paquete}`)).set(como('ownerB', SLUG_B)).send({ serviceId: ids.servicioB, sessions: 3, price: 1, validDays: 0 }).expect(404);
      await http().delete(api(`appointments/packages/${ids.paquete}`)).set(como('ownerB', SLUG_B)).expect(404);
      const r = await http().get(api('appointments/packages')).set(como('ownerB', SLUG_B)).expect(200);
      expect(r.body).toEqual([]);
      await http().post(api('appointments/package-purchases')).set(como('ownerB', SLUG_B)).send({ packageId: ids.paquete, customerId: ids.cliente, method: 'CASH' }).expect(400); // la función está apagada en B
    });

    // ── Membresías ──────────────────────────────────────────────────────────

    it('membresías: planes, alta con matrícula, pausa, reanudar, cuota y cancelar', async () => {
      const plan = await http().post(api('appointments/membership-plans')).set(como('owner')).send({ name: '2 por semana', perWeek: 2, price: 30_000, isFeatured: true }).expect(201);
      ids.plan = plan.body.id;
      await http().put(api(`appointments/membership-plans/${ids.plan}`)).set(como('owner')).send({ name: '2 veces por semana', perWeek: 2, price: 32_000 }).expect(200);
      const pub = await http().get(api(`storefront/${SLUG}/appointments/membership-plans`)).expect(200);
      expect(pub.body).toEqual([expect.objectContaining({ name: '2 veces por semana', price: 32_000, perWeek: 2 })]);

      const m = await http().post(api('appointments/memberships')).set(como('owner')).send({ planId: ids.plan, customerId: ids.cliente, method: 'TRANSFER' }).expect(201);
      ids.membresia = m.body.id;
      expect(m.body).toMatchObject({ status: 'ACTIVE', planName: '2 veces por semana', customerName: 'Ana Paz' });
      expect(fechaArgentina(new Date(m.body.nextChargeAt)).slice(8)).toBe('01');
      const pago = await prisma.appointmentPayment.findFirst({ where: { businessId: ids.biz, membershipId: ids.membresia } });
      expect(Number(pago!.amount)).toBe(37_000); // cuota + matrícula
      await http().post(api('appointments/memberships')).set(como('owner')).send({ planId: ids.plan, customerId: ids.cliente, method: 'CASH' }).expect(400);

      // Cubre hasta 2 por semana.
      const svc = app.get(MembresiasService);
      const inicio = instanteDe(lunesQueViene(2), H(10));
      await expect(svc.turnoCubiertoPorMembresia({ businessId: ids.biz, customerId: ids.cliente, startsAt: inicio })).resolves.toMatchObject({ membershipId: ids.membresia, usadasEnLaSemana: 0 });
      await prisma.appointment.create({ data: turnoFila(inicio, { membershipId: ids.membresia }) });
      await prisma.appointment.create({ data: turnoFila(new Date(inicio.getTime() + 3600_000), { membershipId: ids.membresia }) });
      await expect(svc.turnoCubiertoPorMembresia({ businessId: ids.biz, customerId: ids.cliente, startsAt: new Date(inicio.getTime() + 2 * 86_400_000) })).resolves.toBeNull();
      await prisma.appointment.deleteMany({ where: { businessId: ids.biz, membershipId: ids.membresia } });

      const hasta = sumarDias(fechaArgentina(new Date()), 7);
      await http().post(api(`appointments/memberships/${ids.membresia}/pause`)).set(como('owner')).send({ until: sumarDias(hasta, 30) }).expect(400);
      const pausada = await http().post(api(`appointments/memberships/${ids.membresia}/pause`)).set(como('owner')).send({ until: hasta }).expect(201);
      expect(pausada.body.status).toBe('PAUSED');
      await http().post(api(`appointments/memberships/${ids.membresia}/resume`)).set(como('owner')).expect(201);
      await http().post(api(`appointments/memberships/${ids.membresia}/payments`)).set(como('owner')).send({ method: 'CASH' }).expect(201);
      await http().post(api(`appointments/memberships/${ids.membresia}/payments`)).set(como('recepcion')).send({ method: 'CASH' }).expect(403);
      const lista = await http().get(api('appointments/memberships?status=ACTIVE')).set(como('owner')).expect(200);
      expect(lista.body.total).toBe(1);
      await http().delete(api(`appointments/membership-plans/${ids.plan}`)).set(como('owner')).expect(400); // tiene gente
      const c = await http().post(api(`appointments/memberships/${ids.membresia}/cancel`)).set(como('owner')).expect(201);
      expect(c.body.status).toBe('CANCELLED');
      await http().delete(api(`appointments/membership-plans/${ids.plan}`)).set(como('owner')).expect(200);
    });

    // ── Gift cards ──────────────────────────────────────────────────────────

    it('gift cards: emitir, buscar, consultar por código, CONCURRENCIA de saldo real, anular', async () => {
      const g = await http().post(api('appointments/gift-cards')).set(como('owner')).send({ kind: 'AMOUNT', amount: 10_000, style: 'noche', recipientName: 'Caro', method: 'CASH' }).expect(201);
      expect(g.body.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      ids.giftCard = g.body.id;
      const busca = await http().get(api('appointments/gift-cards?q=caro&status=active')).set(como('owner')).expect(200);
      expect(busca.body.data.map((x: { id: string }) => x.id)).toEqual([ids.giftCard]);
      const pub = await http().get(api(`storefront/${SLUG}/appointments/gift-cards/${g.body.code.toLowerCase()}`)).expect(200);
      expect(pub.body).toEqual({ kind: 'AMOUNT', balance: 10_000, serviceName: null, expiresAt: expect.any(String) });
      // El mismo código no existe en otro negocio.
      await http().get(api(`storefront/${SLUG_B}/appointments/gift-cards/${g.body.code}`)).expect(404);

      const svc = app.get(GiftCardsService);
      const canje = () => prisma.$transaction((tx) => svc.usarSaldoGiftCard({ businessId: ids.biz, code: g.body.code, serviceId: ids.servicio, aPagar: 8_000 }, tx));
      const r = await Promise.allSettled([canje(), canje(), canje()]);
      const gastado = r.filter((x) => x.status === 'fulfilled').reduce((s, x) => s + (x as PromiseFulfilledResult<{ descontado: number }>).value.descontado, 0);
      const fila = await prisma.appointmentGiftCard.findFirst({ where: { id: ids.giftCard, businessId: ids.biz } });
      expect(Number(fila!.balance)).toBeGreaterThanOrEqual(0);
      expect(gastado + Number(fila!.balance)).toBe(10_000);
      expect(gastado).toBe(10_000);
      await svc.devolverSaldoGiftCard({ businessId: ids.biz, giftCardId: ids.giftCard, monto: 2_000 });
      expect(Number((await prisma.appointmentGiftCard.findFirst({ where: { id: ids.giftCard, businessId: ids.biz } }))!.balance)).toBe(2_000);

      await http().post(api(`appointments/gift-cards/${ids.giftCard}/void`)).set(como('owner')).expect(201);
      await http().get(api(`storefront/${SLUG}/appointments/gift-cards/${g.body.code}`)).expect(404);
      await http().post(api(`appointments/gift-cards/${ids.giftCard}/void`)).set(como('ownerB', SLUG_B)).expect(404);
    });

    it('gift cards: compra desde el sitio con sesión de cliente, impaga hasta el webhook', async () => {
      const r = await http().post(api(`storefront/${SLUG}/appointments/gift-cards`)).set(como('cliente'))
        .send({ kind: 'SERVICE', serviceId: ids.servicio, style: 'aurora', buyerName: 'Ana Paz', buyerPhone: '1155550101', buyerEmail: 'ana@mail.com' }).expect(201);
      const fila = await prisma.appointmentGiftCard.findFirst({ where: { id: r.body.giftCardId, businessId: ids.biz } });
      expect(fila).toMatchObject({ paidAt: null, customerId: ids.cliente, kind: 'SERVICE' });
      expect(r.body.payment.amount).toBe(10_000);
      await http().get(api(`storefront/${SLUG}/appointments/gift-cards/${fila!.code}`)).expect(404);
      await app.get(AvanzadoPagosService).aplicarPagoAprobado(ids.biz, r.body.payment.paymentId);
      const ok = await http().get(api(`storefront/${SLUG}/appointments/gift-cards/${fila!.code}`)).expect(200);
      expect(ok.body).toMatchObject({ kind: 'SERVICE', serviceName: 'Corte', balance: null });
    });

    // ── Precios por horario ─────────────────────────────────────────────────

    it('precios por horario: CRUD y el ajuste que usa la reserva', async () => {
      await http().post(api('appointments/price-rules')).set(como('owner')).send({ weekdays: [0], fromMin: 720, toMin: 540, adjustPercent: -10 }).expect(400);
      await http().post(api('appointments/price-rules')).set(como('owner')).send({ weekdays: [0], fromMin: 540, toMin: 720, adjustPercent: 0 }).expect(400);
      const r = await http().post(api('appointments/price-rules')).set(como('owner')).send({ weekdays: [0, 1, 2], fromMin: 540, toMin: 720, adjustPercent: -15 }).expect(201);
      await http().put(api(`appointments/price-rules/${r.body.id}`)).set(como('owner')).send({ weekdays: [0, 1, 2, 3], fromMin: 540, toMin: 720, adjustPercent: -20 }).expect(200);
      const lista = await http().get(api('appointments/price-rules')).set(como('owner')).expect(200);
      expect(lista.body).toEqual([expect.objectContaining({ weekdays: [0, 1, 2, 3], adjustPercent: -20 })]);
      const svc = app.get(PreciosHorarioService);
      await expect(svc.ajustarPrecio(ids.biz, 10_000, instanteDe(lunesQueViene(), H(10)))).resolves.toMatchObject({ precio: 8_000, adjustPercent: -20 });
      await expect(svc.ajustarPrecio(ids.biz, 10_000, instanteDe(lunesQueViene(), H(17)))).resolves.toMatchObject({ precio: 10_000, adjustPercent: 0 });
      await http().delete(api(`appointments/price-rules/${r.body.id}`)).set(como('ownerB', SLUG_B)).expect(404);
      await http().delete(api(`appointments/price-rules/${r.body.id}`)).set(como('owner')).expect(200);
    });

    // ── Fidelidad ───────────────────────────────────────────────────────────

    it('fidelidad: sellos al completar (con cuenta), premio y canje', async () => {
      const svc = app.get(FidelidadService);
      const sello = () => prisma.$transaction((tx) => svc.sumarSello({ businessId: ids.biz, customerId: ids.cliente, monto: 10_000 }, tx));
      await sello();
      // Dos turnos completados a la vez: el lock por cliente no pierde ningún sello.
      const [a, b] = await Promise.all([sello(), sello()]);
      expect([a.completo, b.completo].filter(Boolean)).toHaveLength(1);
      const lista = await http().get(api('appointments/loyalty')).set(como('owner')).expect(200);
      expect(lista.body.data).toEqual([expect.objectContaining({ customerId: ids.cliente, customerName: 'Ana Paz', stamps: 0, needed: 3, rewardsAvailable: 1 })]);
      await http().post(api(`appointments/loyalty/${ids.cliente}/redeem`)).set(como('owner')).expect(201);
      const otra = await http().post(api(`appointments/loyalty/${ids.cliente}/redeem`)).set(como('owner')).expect(400);
      expect(otra.body.message).toBe('No tiene premios para canjear.');
      await http().post(api(`appointments/loyalty/${ids.cliente}/redeem`)).set(como('ownerB', SLUG_B)).expect(404);
    });

    // ── Turno fijo ──────────────────────────────────────────────────────────

    it('turno fijo: sin el núcleo de turnos (P1) responde 503', async () => {
      const r = await http().post(api('appointments/recurring')).set(como('owner'))
        .send({ customerId: ids.cliente, resourceId: ids.recurso, serviceId: ids.servicio, frequency: 'WEEKLY', startDate: lunesQueViene(), startMin: 600, occurrences: 4 }).expect(503);
      expect(r.body.message).toMatch(/turnos fijos/);
    });

    it('turno fijo: la serie saltea el feriado y el horario ocupado (constraint real + SAVEPOINT) y "end" cancela lo que viene', async () => {
      (app.get(TurnoFijoService) as unknown as { nucleo: NucleoTurnos }).nucleo = { crearTurno: crearTurnoDePrueba };
      const inicio = lunesQueViene();
      await prisma.appointmentSpecialDay.create({ data: { businessId: ids.biz, date: sumarDias(inicio, 7), kind: 'CLOSED', reason: 'Feriado' } });
      // Alguien ya tiene ese horario la tercera semana.
      await prisma.appointment.create({ data: turnoFila(instanteDe(sumarDias(inicio, 14), H(10))) });

      await http().post(api('appointments/recurring')).set(como('owner'))
        .send({ customerId: ids.cliente, resourceId: ids.recurso, serviceId: ids.servicio, frequency: 'MONTHLY', startDate: inicio, startMin: H(10), occurrences: 4 }).expect(400);
      const r = await http().post(api('appointments/recurring')).set(como('owner'))
        .send({ customerId: ids.cliente, resourceId: ids.recurso, serviceId: ids.servicio, frequency: 'WEEKLY', startDate: inicio, startMin: H(10), occurrences: 4 }).expect(201);
      expect(r.body.created.map((x: { date: string }) => x.date)).toEqual([inicio, sumarDias(inicio, 21)]);
      expect(r.body.skipped).toEqual([sumarDias(inicio, 7), sumarDias(inicio, 14)]);
      expect(r.body.series).toMatchObject({ frequency: 'WEEKLY', weekday: 0, startMin: 600, isActive: true, upcoming: [expect.objectContaining({ status: 'CONFIRMED' }), expect.anything()] });
      ids.serie = r.body.series.id;
      const enBase = await prisma.appointment.count({ where: { businessId: ids.biz, recurringSeriesId: ids.serie } });
      expect(enBase).toBe(2);

      const lista = await http().get(api('appointments/recurring')).set(como('owner')).expect(200);
      expect(lista.body.map((s: { id: string }) => s.id)).toContain(ids.serie);
      await http().post(api(`appointments/recurring/${ids.serie}/end`)).set(como('ownerB', SLUG_B)).expect(404);
      const fin = await http().post(api(`appointments/recurring/${ids.serie}/end`)).set(como('owner')).expect(201);
      expect(fin.body.isActive).toBe(false);
      expect(await prisma.appointment.count({ where: { businessId: ids.biz, recurringSeriesId: ids.serie, status: 'CANCELLED' } })).toBe(2);
      await prisma.appointment.deleteMany({ where: { businessId: ids.biz } });
      await prisma.appointmentSpecialDay.deleteMany({ where: { businessId: ids.biz } });
    });

    // ── Recuperar clientes ──────────────────────────────────────────────────

    it('recuperar clientes: audiencia, envío una sola vez por persona y cupón personal', async () => {
      await prisma.appointment.create({ data: turnoFila(new Date(Date.now() - 100 * 86_400_000), { status: 'COMPLETED' }) });
      await prisma.appointmentCustomerProfile.create({ data: { businessId: ids.biz, customerId: ids.cliente, acceptsPromos: true } });

      await http().get(api('appointments/winback')).set(como('owner')).expect(200).expect({});
      await http().put(api('appointments/winback')).set(como('owner')).send({ inactiveDays: 60, message: 'Hola {apodo}', couponEnabled: true, couponPercent: 15, couponValidDays: 15, mode: 'manual', isActive: true }).expect(400);
      const c = await http().put(api('appointments/winback')).set(como('owner'))
        .send({ inactiveDays: 60, message: '¡Hola {nombre}! Te extrañamos en {negocio}.', couponEnabled: true, couponPercent: 15, couponValidDays: 15, mode: 'manual', isActive: true }).expect(200);
      expect(c.body).toMatchObject({ inactiveDays: 60, audience: 1, sentCount: 0 });
      const aud = await http().get(api('appointments/winback/audience?inactiveDays=90')).set(como('owner')).expect(200);
      expect(aud.body).toEqual({ count: 1, sample: [expect.objectContaining({ name: 'Ana Paz', visits: 1 })] });
      await http().get(api('appointments/winback/audience?inactiveDays=120')).set(como('owner')).expect(200).expect({ count: 0, sample: [] });

      await http().post(api('appointments/winback/send')).set(como('owner')).expect(201).expect({ sent: 1, skipped: 0 });
      await http().post(api('appointments/winback/send')).set(como('owner')).expect(201).expect({ sent: 0, skipped: 0 });
      const envios = await prisma.appointmentWinbackSend.findMany({ where: { businessId: ids.biz } });
      expect(envios).toHaveLength(1);
      expect(envios[0].couponCode).toMatch(/^[A-Z2-9]{8}$/);
      const log = await prisma.appointmentMessageLog.findMany({ where: { businessId: ids.biz, template: 'extranamos' } });
      expect(log).toEqual([expect.objectContaining({ channel: 'WHATSAPP', status: 'SIMULATED', recipient: '1155550101' })]);
      const despues = await http().get(api('appointments/winback')).set(como('owner')).expect(200);
      expect(despues.body).toMatchObject({ sentCount: 1, audience: 0 });

      const svc = app.get(RecuperarService);
      await expect(svc.canjearCuponRecuperar({ businessId: ids.biz, code: envios[0].couponCode!, customerId: ids.cliente })).resolves.toEqual({ percent: 15, sendId: envios[0].id });
      await expect(svc.canjearCuponRecuperar({ businessId: ids.biz, code: envios[0].couponCode!, customerId: ids.cliente })).rejects.toBeInstanceOf(ConflictException);
      await prisma.appointment.deleteMany({ where: { businessId: ids.biz } });
    });

    // ── Lista de espera ─────────────────────────────────────────────────────

    it('lista de espera: anotarse con el día lleno, ofrecer al cancelar, aceptar con el enlace firmado', async () => {
      (app.get(ListaEsperaService) as unknown as { nucleo: NucleoTurnos }).nucleo = { crearTurno: crearTurnoDePrueba };
      const dia = lunesQueViene(2);
      const pedido = { serviceId: ids.servicio, date: dia, name: 'Sofía Ramírez', phone: '11 4444-0202', fromMin: H(9), toMin: H(13) };
      // Con horarios libres, no.
      const libre = await http().post(api(`storefront/${SLUG}/appointments/waitlist`)).send(pedido).expect(400);
      expect(libre.body.message).toBe('Ese día todavía tiene horarios.');
      // La mañana llena.
      const bloque = await prisma.appointment.create({ data: { ...turnoFila(instanteDe(dia, H(9))), endsAt: instanteDe(dia, H(13)), durationMin: 240 } });
      const r = await http().post(api(`storefront/${SLUG}/appointments/waitlist`)).send(pedido).expect(201);
      expect(r.body).toEqual({ id: expect.any(String), date: dia, status: 'WAITING' });
      ids.espera = r.body.id;
      await http().post(api(`storefront/${SLUG}/appointments/waitlist`)).send(pedido).expect(400); // ya anotada

      const panel = await http().get(api(`appointments/waitlist?date=${dia}`)).set(como('recepcion')).expect(200);
      expect(panel.body).toEqual([expect.objectContaining({ id: ids.espera, status: 'WAITING', customer: expect.objectContaining({ phone: '••••••••02', email: null }) })]);

      // Se cancela el bloque: el núcleo (P1) llama a ofrecerLugarLiberado en la misma transacción.
      const svc = app.get(ListaEsperaService);
      const oferta = await prisma.$transaction(async (tx) => {
        await tx.appointment.updateMany({ where: { id: bloque.id, businessId: ids.biz }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'CUSTOMER' } });
        return svc.ofrecerLugarLiberado({ businessId: ids.biz, resourceId: ids.recurso, startsAt: instanteDe(dia, H(10)) }, tx);
      });
      expect(oferta?.entryId).toBe(ids.espera);
      const msg = await prisma.appointmentMessageLog.findFirst({ where: { businessId: ids.biz, template: 'espera' } });
      expect(msg).toMatchObject({ status: 'SIMULATED', recipient: '1144440202' });

      // El enlace: un token firmado con JWT_SECRET (no hay columna para guardarlo).
      const token = jwt.sign({ rid: ids.recurso, st: instanteDe(dia, H(10)).toISOString() }, process.env.JWT_SECRET!, { audience: AUDIENCIA_OFERTA, subject: ids.espera, expiresIn: 600 });
      await http().post(api(`storefront/${SLUG}/appointments/waitlist/accept`)).send({ offer: jwt.sign({ sub: ids.espera, type: 'customer' }, process.env.JWT_SECRET!) }).expect(404);
      await http().post(api(`storefront/${SLUG_B}/appointments/waitlist/accept`)).send({ offer: token }).expect(404);
      const ok = await http().post(api(`storefront/${SLUG}/appointments/waitlist/accept`)).send({ offer: token }).expect(201);
      expect(ok.body).toEqual({ appointmentId: expect.any(String), startsAt: instanteDe(dia, H(10)).toISOString() });
      const entrada = await prisma.appointmentWaitlistEntry.findFirst({ where: { id: ids.espera, businessId: ids.biz } });
      expect(entrada).toMatchObject({ status: 'ACCEPTED', appointmentId: ok.body.appointmentId });
      // Aceptar de nuevo devuelve lo mismo.
      await http().post(api(`storefront/${SLUG}/appointments/waitlist/accept`)).send({ offer: token }).expect(201).expect(ok.body);

      await http().delete(api(`appointments/waitlist/${ids.espera}`)).set(como('ownerB', SLUG_B)).expect(404);
      await http().delete(api(`appointments/waitlist/${ids.espera}`)).set(como('owner')).expect(200);
      await prisma.appointment.deleteMany({ where: { businessId: ids.biz } });
    });

    it('lista de espera: ofrecer a mano desde el panel y quien no puede gestionar la agenda no ofrece', async () => {
      const dia = lunesQueViene(3);
      await prisma.appointment.create({ data: { ...turnoFila(instanteDe(dia, H(9))), endsAt: instanteDe(dia, H(20)), durationMin: 660 } });
      const r = await http().post(api(`storefront/${SLUG}/appointments/waitlist`)).send({ serviceId: ids.servicio, date: dia, name: 'Nico Torres', phone: '1133330303' }).expect(201);
      await prisma.appointment.deleteMany({ where: { businessId: ids.biz } });
      await http().post(api(`appointments/waitlist/${r.body.id}/offer`)).set(como('recepcion')).send({ date: dia, startMin: H(16), resourceId: ids.recurso }).expect(403);
      const o = await http().post(api(`appointments/waitlist/${r.body.id}/offer`)).set(como('owner')).send({ date: dia, startMin: H(16), resourceId: ids.recurso }).expect(201);
      expect(o.body).toMatchObject({ status: 'OFFERED', offerExpiresAt: expect.any(String) });
    });
  });

  /** Una fila de turno mínima del negocio A (para armar escenarios). */
  function turnoFila(startsAt: Date, extra: Record<string, unknown> = {}) {
    return {
      businessId: ids.biz, code: randomBytes(3).toString('hex').toUpperCase(), accessToken: randomBytes(32).toString('base64url'),
      resourceId: ids.recurso, serviceId: ids.servicio, customerId: ids.cliente, customerName: 'Ana Paz', customerPhone: '1155550101',
      serviceName: 'Corte', startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), durationMin: 30, price: 10_000,
      status: 'CONFIRMED' as const, origin: 'PANEL' as const, ...extra,
    };
  }
});
