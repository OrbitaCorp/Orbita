import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GestionContextoService } from '../../src/appointments/gestion/comun/contexto.service';
import { ClasesService } from '../../src/appointments/gestion/clases/clases.service';
import { ClientesService } from '../../src/appointments/gestion/clientes/clientes.service';
import { EquipoService } from '../../src/appointments/gestion/equipo/equipo.service';
import { RolesTurnosService } from '../../src/appointments/gestion/equipo/roles-turnos.service';
import { GananciasService } from '../../src/appointments/gestion/ganancias/ganancias.service';
import { instanteDe } from '../../src/appointments/horarios/horarios';
import type { MemberContext } from '../../src/common/types/auth-context.type';

// P3 — services con Prisma mockeado a mano. Lo que se mira:
// - toda consulta lleva el businessId del token (aislamiento entre negocios);
// - el alcance propio/todo de los pares de permisos (otra persona → 404);
// - teléfono tapado sin clients.contact y nunca el accessToken en el panel;
// - la regla anti-escalada y el dueño;
// - el cupo de las clases (lock, completa → 409, lista de espera);
// - los errores del contrato, con sus mensajes.

const BIZ = 'biz-turnos';
const OTRO_NEGOCIO = 'biz-otro';

type Resp = unknown | ((args: any) => unknown);
interface Llamada { modelo: string; op: string; args: any }

function prismaFalso(respuestas: Record<string, Resp> = {}) {
  const llamadas: Llamada[] = [];
  const raws: { sql: string; valores: unknown[] }[] = [];
  const fns: Record<string, jest.Mock> = {};
  const defecto = (op: string, args: any) => {
    if (op === 'findMany' || op === 'groupBy') return [];
    if (op === 'findFirst' || op === 'findUnique') return null;
    if (op === 'count') return 0;
    if (op === 'updateMany' || op === 'deleteMany') return { count: 1 };
    if (op === 'aggregate') return { _sum: {}, _max: {}, _count: { _all: 0 } };
    if (op === 'create' || op === 'upsert') return { id: `nuevo-${llamadas.length}`, createdAt: new Date(), ...(args?.data ?? args?.create) };
    return undefined;
  };
  const modelo = (m: string) => new Proxy({}, {
    get: (_t, op: string) => (fns[`${m}.${op}`] ??= jest.fn(async (args: any) => {
      llamadas.push({ modelo: m, op, args });
      const r = respuestas[`${m}.${op}`];
      return r === undefined ? defecto(op, args) : typeof r === 'function' ? (r as (a: any) => unknown)(args) : r;
    })),
  });
  const prisma: any = new Proxy({}, {
    get: (_t, k: string) => {
      if (k === '$transaction') return async (x: any) => (Array.isArray(x) ? Promise.all(x) : x(prisma));
      if (k === '$executeRaw' || k === '$queryRaw') {
        return fns[k] ??= jest.fn(async (strings: TemplateStringsArray, ...valores: unknown[]) => {
          raws.push({ sql: strings.join('?'), valores });
          const r = respuestas[k];
          return typeof r === 'function' ? (r as (a: any) => unknown)(valores) : r ?? 1;
        });
      }
      return modelo(k);
    },
  });
  return { prisma, llamadas, raws, fn: (clave: string) => fns[clave] };
}

/** Toda consulta lleva el negocio del token; ninguna toca otro negocio. */
function todasConNegocio(llamadas: Llamada[]) {
  const sinNegocio = llamadas.filter((l) => {
    const json = JSON.stringify(['create', 'upsert'].includes(l.op) ? (l.args.data ?? l.args.create ?? l.args) : (l.args?.where ?? l.args));
    if (l.op === 'upsert' && l.modelo === 'appointmentCustomerProfile') return !JSON.stringify(l.args.create).includes(BIZ);
    if (l.op === 'upsert' && l.modelo === 'appointmentClassSession') return !JSON.stringify(l.args.create).includes(BIZ);
    return !json.includes(BIZ);
  });
  expect(sinNegocio.map((l) => `${l.modelo}.${l.op}`)).toEqual([]);
  expect(JSON.stringify(llamadas)).not.toContain(OTRO_NEGOCIO);
}

const SETTINGS = {
  id: 's', businessId: BIZ, rubroKey: 'crossfit', agendaMode: 'CLASS', weekSchedule: Array.from({ length: 7 }, () => [[420, 1320]]),
  vacationEnabled: false, vacationFrom: null, vacationTo: null, vacationMessage: null, minAdvanceMin: 0, maxAdvanceDays: 30, slotMin: 30,
  bufferMin: 0, confirmation: 'auto', letChooseResource: true, offerAnyResource: true, maxActivePerCustomer: 2, waitlistEnabled: false,
  waitlistAcceptMin: 30, classDefaultCapacity: 15, classOpenDays: 7, classMinEnrolled: 0, depositEnabled: false, depositType: 'percent',
  depositPercent: 30, depositFixed: 0, depositForNoShows: false, cancelUntilHours: 24, depositOutOfWindow: 'forfeit', toleranceMin: 10,
  onlineCharge: 'deposit', showTransferData: true, accountEnabled: true, welcomeDiscountPercent: 0, loyaltyStamps: 0, advanced: null,
};

const negocio = (extra: Partial<typeof SETTINGS> = {}, vertical = 'APPOINTMENTS') => ({
  'business.findFirst': (args: any) => (args.where.id === BIZ ? { vertical, appointmentSettings: { ...SETTINGS, ...extra } } : null),
});

const miembro = (roleName: string, permissions: string[], memberId = 'm-yo'): MemberContext => ({
  type: 'member', memberId, businessId: BIZ, businessMode: 'FULL', roleId: 'r', roleName, permissions,
});
const DUENIO = miembro('owner', [], 'm-duenio');
const PROFE = miembro('Profesional', ['appointments.agenda.view', 'appointments.agenda.manage', 'appointments.clients.view', 'appointments.earnings.view']);

const servicios = (r: Record<string, Resp>) => {
  const f = prismaFalso(r);
  const ctx = new GestionContextoService(f.prisma);
  return { ...f, ctx };
};

describe('el negocio tiene que ser de turnos', () => {
  it('una tienda (STORE) recibe 404 "Este negocio no usa Turnos" en todos los services de P3', async () => {
    const { prisma, ctx } = servicios(negocio({}, 'STORE'));
    const members = { invite: jest.fn() };
    const casos: Promise<unknown>[] = [
      new ClasesService(prisma, ctx, {} as any).plantillas(DUENIO),
      new ClientesService(prisma, ctx).listar(DUENIO, {}),
      new EquipoService(prisma, ctx, members as any).listar(DUENIO),
      new RolesTurnosService(prisma, ctx, {} as any).listar(DUENIO),
      new GananciasService(prisma, ctx).resumen(DUENIO, {}),
    ];
    for (const p of casos) await expect(p).rejects.toThrow('Este negocio no usa Turnos');
  });
});

describe('Ganancias', () => {
  const persona = (id: string, extra: object = {}) => ({
    id, name: id, color: null, roleLabel: 'Coach', assignedSpaceId: null, createdAt: instanteDe('2026-09-01', 0),
    payForm: 'COMMISSION', commissionPercent: 50, salary: 0, rent: 0, perClass: 0, payEvery: 'WEEK', member: null, ...extra,
  });
  const AHORA = instanteDe('2026-09-30', 20 * 60);

  it('sin earnings.view_all: solo la propia, sin totales, y todo con el businessId', async () => {
    const { prisma, ctx, llamadas } = servicios({
      ...negocio(),
      'appointmentResource.findFirst': { id: 'res-yo', assignedSpaceId: null },
      'appointmentResource.findMany': (args: any) => (args.where.id === 'res-yo' ? [persona('res-yo')] : [persona('res-yo'), persona('res-otro')]),
    });
    const r = await new GananciasService(prisma, ctx).resumen(PROFE, { from: '2026-09-01', to: '2026-09-30' }, AHORA);
    expect(r.totals).toBeNull();
    expect(r.people.map((p) => p.person.resourceId)).toEqual(['res-yo']);
    todasConNegocio(llamadas);
  });

  it('sin earnings.view_all, pedir la de otra persona da 404 (no se revela que existe)', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'appointmentResource.findFirst': { id: 'res-yo', assignedSpaceId: null } });
    await expect(new GananciasService(prisma, ctx).persona(PROFE, 'res-otro', {}, AHORA)).rejects.toBeInstanceOf(NotFoundException);
    await expect(new GananciasService(prisma, ctx).pagos(PROFE, 'res-otro', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el rango no puede pasar de 366 días ni estar al revés', async () => {
    const { prisma, ctx } = servicios(negocio());
    const svc = new GananciasService(prisma, ctx);
    await expect(svc.resumen(DUENIO, { from: '2025-01-01', to: '2026-09-30' }, AHORA)).rejects.toThrow('366');
    await expect(svc.resumen(DUENIO, { from: '2026-09-30', to: '2026-09-01' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('con view_all: totales con lo facturado de todo el negocio y pendiente desde el último pago', async () => {
    const { prisma, ctx, llamadas } = servicios({
      ...negocio(),
      'appointmentResource.findMany': [persona('res-a')],
      'appointmentStaffPayout.groupBy': [{ resourceId: 'res-a', _max: { periodTo: '2026-09-20' } }],
      'appointment.findMany': [
        { id: 't1', resourceId: 'res-a', status: 'COMPLETED', startsAt: instanteDe('2026-09-15', 600), price: 10_000, discountAmount: 0, customerName: 'X', serviceName: 'S' },
        { id: 't2', resourceId: 'res-a', status: 'COMPLETED', startsAt: instanteDe('2026-09-25', 600), price: 20_000, discountAmount: 0, customerName: 'X', serviceName: 'S' },
      ],
      'appointment.aggregate': { _sum: { price: 50_000, discountAmount: 0 }, _count: { _all: 3 } },
    });
    const r = await new GananciasService(prisma, ctx).resumen(DUENIO, { from: '2026-09-01', to: '2026-09-30' }, AHORA);
    const [p] = r.people;
    expect(p.period).toMatchObject({ appointments: 2, billed: 30_000, commission: 15_000 });
    expect(p.paidUntil).toBe('2026-09-20');
    expect(p.pending).toMatchObject({ from: '2026-09-21', to: '2026-09-30', appointments: 1, commission: 10_000 });
    expect(p.toPay).toBe(10_000);
    expect(r.totals).toEqual({ billed: 50_000, appointments: 3, toTeam: 15_000, toBusiness: 35_000 });
    todasConNegocio(llamadas);
  });

  describe('registrar un pago', () => {
    const conPersona = (p: object, extra: Record<string, Resp> = {}) => servicios({ ...negocio(), 'appointmentResource.findFirst': persona('res-a', p), ...extra });

    it('al dueño no se le liquida', async () => {
      const { prisma, ctx } = conPersona({ payForm: null });
      await expect(new GananciasService(prisma, ctx).registrarPago(DUENIO, 'res-a', {}, AHORA)).rejects.toThrow('El dueño no se liquida: lo que factura queda para el negocio.');
    });

    it('un período ya pagado → 400 "Ya está pagado hasta el …"', async () => {
      const { prisma, ctx } = conPersona({}, { 'appointmentStaffPayout.findFirst': { periodTo: '2026-09-30' } });
      await expect(new GananciasService(prisma, ctx).registrarPago(DUENIO, 'res-a', { periodTo: '2026-09-25' }, AHORA)).rejects.toThrow('Ya está pagado hasta el 30/09/2026.');
    });

    it('sin nada pendiente → 400; una fecha futura → 400', async () => {
      const { prisma, ctx } = conPersona({});
      const svc = new GananciasService(prisma, ctx);
      await expect(svc.registrarPago(DUENIO, 'res-a', {}, AHORA)).rejects.toThrow('No hay nada pendiente para liquidar.');
      await expect(svc.registrarPago(DUENIO, 'res-a', { periodTo: '2026-10-01' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('quien alquila: el pago va de la persona al negocio, por el alquiler pendiente desde el alta, con lock por persona', async () => {
      const audit = { registrar: jest.fn() };
      const { prisma, ctx, llamadas, raws } = conPersona({ payForm: 'RENT', rent: 300_000 });
      await new GananciasService(prisma, ctx, audit as any).registrarPago(DUENIO, 'res-a', { periodTo: '2026-09-15', note: 'Transferencia' }, AHORA);
      const creado = llamadas.find((l) => l.modelo === 'appointmentStaffPayout' && l.op === 'create')!.args.data;
      expect(creado).toMatchObject({ businessId: BIZ, resourceId: 'res-a', periodFrom: '2026-09-01', periodTo: '2026-09-15', amount: 150_000, direction: 'PERSON_TO_BUSINESS', note: 'Transferencia', registeredByMemberId: 'm-duenio' });
      expect(creado.breakdown).toMatchObject({ rent: 150_000, from: '2026-09-01', to: '2026-09-15' });
      expect(raws.some((r) => r.sql.includes('pg_advisory_xact_lock') && r.valores.includes('payout:res-a'))).toBe(true);
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'appointment_payout', action: 'CREATE', businessId: BIZ }));
      todasConNegocio(llamadas);
    });

    it('sin view_all no se registra (404), aunque tenga liquidar', async () => {
      const { prisma, ctx } = conPersona({});
      const raro = miembro('Raro', ['appointments.earnings.view', 'appointments.earnings.settle']);
      await expect(new GananciasService(prisma, ctx).registrarPago(raro, 'res-a', {}, AHORA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('Clientes', () => {
  const cliente = (extra: object = {}) => ({
    id: 'c1', businessId: BIZ, firstName: 'Ana', lastName: 'Paz', phone: '1155550101', email: 'ana@x.com', dni: '30111222',
    passwordHash: null, googleId: null, deletedAt: null, appointmentProfile: { note: 'Prefiere mañana', insuranceName: 'OSDE', insuranceNumber: '123', noShowCount: 1, depositCredit: 0 },
    ...extra,
  });

  it('sin clients.view_all: solo quienes tienen turnos en su agenda; teléfono tapado, sin email, sin montos y sin obra social en la lista', async () => {
    const { prisma, ctx, llamadas } = servicios({
      ...negocio(),
      'appointmentResource.findFirst': { id: 'res-yo', assignedSpaceId: null },
      'appointment.findMany': [{ customerId: 'c1' }],
      'customer.count': 1,
      'customer.findMany': [cliente()],
      'appointment.groupBy': [{ customerId: 'c1', _count: { _all: 6 }, _max: { startsAt: instanteDe('2026-09-10', 600) }, _sum: { price: 60_000, discountAmount: 0 } }],
    });
    const r = await new ClientesService(prisma, ctx).listar(PROFE, {});
    expect(r.total).toBe(1);
    expect(r.data[0]).toMatchObject({ name: 'Ana Paz', phone: '••••••••01', email: null, spent: null, visits: 6, lastVisit: '2026-09-10', insuranceName: null, noShows: 1 });
    const alcance = llamadas.find((l) => l.modelo === 'appointment' && l.op === 'findMany')!.args.where;
    expect(alcance).toMatchObject({ businessId: BIZ, resourceId: { in: ['res-yo'] }, status: { not: 'CANCELLED' } });
    const lista = llamadas.find((l) => l.modelo === 'customer' && l.op === 'findMany')!.args.where;
    expect(JSON.stringify(lista)).toContain('"c1"');
    todasConNegocio(llamadas);
  });

  it('un cliente fuera de su alcance → 404', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'appointmentResource.findFirst': { id: 'res-yo', assignedSpaceId: null }, 'customer.findFirst': cliente() });
    await expect(new ClientesService(prisma, ctx).ficha(PROFE, 'c1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la ficha con contacto y reports.view trae todo, obra social incluida; el historial nunca trae accessToken', async () => {
    const turno = {
      id: 't1', code: 'ABC234', accessToken: 'SECRETO-DEL-ENLACE', resourceId: 'res-a', resource: { name: 'Caro' }, serviceId: 's', serviceName: 'Corte',
      customerId: 'c1', customerName: 'Ana Paz', customerPhone: '1155550101', customerEmail: 'ana@x.com', status: 'COMPLETED', origin: 'PANEL', modality: 'ON_SITE',
      startsAt: instanteDe('2026-09-10', 600), endsAt: instanteDe('2026-09-10', 630), durationMin: 30, price: 10_000, discountAmount: 0, depositAmount: 0,
      depositPaidAt: null, depositMethod: null, rescheduleCount: 0, customerNote: null, internalNote: null, recurringSeriesId: null,
    };
    const { prisma, ctx, llamadas } = servicios({ ...negocio(), 'customer.findFirst': cliente(), 'appointment.findMany': [turno] });
    const f = await new ClientesService(prisma, ctx).ficha(DUENIO, 'c1');
    expect(f).toMatchObject({ phone: '1155550101', email: 'ana@x.com', insuranceName: 'OSDE', insuranceNumber: '123', dni: '30111222' });
    expect(f.history).toHaveLength(1);
    expect(JSON.stringify(f)).not.toContain('SECRETO-DEL-ENLACE');
    todasConNegocio(llamadas);
  });

  it('alta con teléfono repetido → 400 con el nombre del otro cliente', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'customer.findFirst': { firstName: 'Ana', lastName: 'Paz' } });
    await expect(new ClientesService(prisma, ctx).crear(DUENIO, { name: 'Otra Ana', phone: '11 5555-0101' })).rejects.toThrow('Ya tenés un cliente con ese teléfono: Ana Paz.');
  });

  it('alta con teléfono corto → 400', async () => {
    const { prisma, ctx } = servicios(negocio());
    await expect(new ClientesService(prisma, ctx).crear(DUENIO, { name: 'Ana Paz', phone: '1234' })).rejects.toThrow('El teléfono tiene que tener al menos 8 dígitos.');
  });

  it('alta: crea la ficha y el perfil del negocio, y lo registra sin datos de salud', async () => {
    const audit = { registrar: jest.fn() };
    const { prisma, ctx, llamadas } = servicios(negocio());
    const c = await new ClientesService(prisma, ctx, audit as any).crear(DUENIO, { name: 'Ana María Paz', phone: '11 5555-0101', email: 'ana@x.com', insuranceName: 'OSDE' });
    expect(llamadas.find((l) => l.modelo === 'customer' && l.op === 'create')!.args.data).toEqual({ businessId: BIZ, firstName: 'Ana', lastName: 'María Paz', phone: '1155550101', email: 'ana@x.com' });
    expect(llamadas.find((l) => l.modelo === 'appointmentCustomerProfile' && l.op === 'create')!.args.data).toMatchObject({ businessId: BIZ, insuranceName: 'OSDE' });
    expect(c).toMatchObject({ name: 'Ana María Paz', visits: 0, hasAccount: false });
    expect(JSON.stringify(audit.registrar.mock.calls)).not.toContain('OSDE');
    todasConNegocio(llamadas);
  });

  it('a un cliente con cuenta no se le cambia el email desde el panel', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'customer.findFirst': cliente({ passwordHash: 'hash' }) });
    await expect(new ClientesService(prisma, ctx).editar(DUENIO, 'c1', { name: 'Ana Paz', email: 'otra@x.com' })).rejects.toThrow('Ese cliente tiene cuenta');
  });
});

describe('Equipo', () => {
  const ENCARGADO = miembro('Encargado/a', ['appointments.agenda.view', 'appointments.agenda.view_all', 'appointments.team.manage'], 'm-enc');
  const rol = (codigos: string[], extra: object = {}) => ({
    id: 'rol-1', businessId: BIZ, name: 'Coach', takesAppointments: true, rolePermissions: codigos.map((code) => ({ permission: { code } })), ...extra,
  });
  const fila = (extra: object = {}) => ({
    id: 'res-1', businessId: BIZ, kind: 'PERSON', name: 'Caro', roleLabel: 'Coach', color: '#3B82F6', photoUrl: null, bio: null, isBookable: true,
    assignedSpaceId: null, workDays: [0, 1], ownSchedule: null, isActive: true, sortOrder: 0, email: null, phone: '1155550101', memberId: 'mem-caro',
    payForm: 'PER_CLASS', commissionPercent: 50, salary: 0, rent: 0, perClass: 9000, payEvery: 'MONTH', createdAt: new Date(),
    member: { id: 'mem-caro', email: 'caro@x.com', status: 'ACTIVE', roleId: 'rol-1', role: { name: 'Coach' } }, ...extra,
  });

  it('invitar con un rol que tiene permisos que quien invita no tiene → 403 y no se invita a nadie', async () => {
    const members = { invite: jest.fn() };
    const { prisma, ctx } = servicios({ ...negocio(), 'role.findFirst': rol(['appointments.agenda.view', 'appointments.settings.manage']) });
    await expect(new EquipoService(prisma, ctx, members as any).invitar(ENCARGADO, { name: 'Caro', email: 'caro@x.com', roleId: 'rol-1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(members.invite).not.toHaveBeenCalled();
  });

  it('invitar al rol de dueño solo lo puede el dueño', async () => {
    const members = { invite: jest.fn() };
    const { prisma, ctx } = servicios({ ...negocio(), 'role.findFirst': rol([], { name: 'owner' }) });
    await expect(new EquipoService(prisma, ctx, members as any).invitar(ENCARGADO, { name: 'X', email: 'x@x.com', roleId: 'rol-1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(members.invite).not.toHaveBeenCalled();
  });

  it('invitar: llama a MembersService.invite y crea la agenda con su memberId, si atiende según el rol y el pago inicial del rubro', async () => {
    const members = { invite: jest.fn().mockResolvedValue({ id: 'mem-nuevo', tempPassword: 'TEMP1234' }) };
    const { prisma, ctx, llamadas } = servicios({
      ...negocio(),
      'role.findFirst': rol(['appointments.agenda.view']),
      'appointmentResource.create': (args: any) => fila({ ...args.data, id: 'res-nuevo', member: { id: 'mem-nuevo', email: 'caro@x.com', status: 'PENDING', roleId: 'rol-1', role: { name: 'Coach' } } }),
    });
    const r = await new EquipoService(prisma, ctx, members as any).invitar(ENCARGADO, { name: 'Caro', email: 'caro@x.com', roleId: 'rol-1' });
    expect(members.invite).toHaveBeenCalledWith(BIZ, 'Encargado/a', { name: 'Caro', email: 'caro@x.com', roleId: 'rol-1' }, 'm-enc');
    const data = llamadas.find((l) => l.modelo === 'appointmentResource' && l.op === 'create')!.args.data;
    expect(data).toMatchObject({ businessId: BIZ, kind: 'PERSON', memberId: 'mem-nuevo', isBookable: true, roleLabel: 'Coach', payForm: 'PER_CLASS', perClass: 9000, workDays: [0, 1, 2, 3, 4, 5, 6] });
    expect(r.tempPassword).toBe('TEMP1234');
    expect(r.person.member).toMatchObject({ id: 'mem-nuevo', status: 'PENDING' });
  });

  it('si no se pudo crear la agenda, se deshace el miembro invitado', async () => {
    const members = { invite: jest.fn().mockResolvedValue({ id: 'mem-nuevo', tempPassword: 'X' }) };
    const { prisma, ctx, llamadas } = servicios({
      ...negocio(), 'role.findFirst': rol([]), 'appointmentResource.create': () => { throw new Error('se cayó la base'); },
    });
    await expect(new EquipoService(prisma, ctx, members as any).invitar(DUENIO, { name: 'Caro', email: 'caro@x.com', roleId: 'rol-1' })).rejects.toThrow('se cayó la base');
    expect(llamadas.find((l) => l.modelo === 'member' && l.op === 'deleteMany')!.args).toEqual({ where: { id: 'mem-nuevo', businessId: BIZ } });
  });

  it('sin agenda.view_all solo ve su propia ficha; el pago de otros no, el propio con earnings.view sí', async () => {
    const { prisma, ctx, llamadas } = servicios({ ...negocio(), 'appointmentResource.findMany': [fila({ memberId: 'm-yo' })] });
    const r = await new EquipoService(prisma, ctx, {} as any).listar(PROFE);
    expect(llamadas.find((l) => l.modelo === 'appointmentResource' && l.op === 'findMany')!.args.where).toMatchObject({ businessId: BIZ, memberId: 'm-yo' });
    expect(r[0].pay).toMatchObject({ payForm: 'PER_CLASS' });
    const { prisma: p2, ctx: c2 } = servicios({ ...negocio(), 'appointmentResource.findMany': [fila()] });
    const otro = await new EquipoService(p2, c2, {} as any).listar(miembro('Recepción', ['appointments.agenda.view', 'appointments.agenda.view_all']));
    expect(otro[0].pay).toBeNull();
    expect(otro[0].email).toBeNull();
    expect(otro[0].phone).toBeNull();
  });

  it('al dueño no se le pone forma de pago; una forma que no es del rubro → 400', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'appointmentResource.findFirst': fila({ member: { id: 'm', email: 'd@x.com', status: 'ACTIVE', roleId: 'o', role: { name: 'owner' } } }) });
    await expect(new EquipoService(prisma, ctx, {} as any).cambiarPago(DUENIO, 'res-1', { payForm: 'SALARY', payEvery: 'MONTH' })).rejects.toThrow('El dueño no se liquida');
    const { prisma: p2, ctx: c2 } = servicios({ ...negocio(), 'appointmentResource.findFirst': fila() });
    await expect(new EquipoService(p2, c2, {} as any).cambiarPago(DUENIO, 'res-1', { payForm: 'COMMISSION', commissionPercent: 50, payEvery: 'WEEK' })).rejects.toThrow('Esa forma de pago no se usa en este tipo de negocio.');
  });

  it('sacar a alguien con login: solo el dueño (403 para el resto, sin tocar nada)', async () => {
    const members = { remove: jest.fn() };
    const { prisma, ctx, llamadas } = servicios({ ...negocio(), 'appointmentResource.findFirst': fila() });
    await expect(new EquipoService(prisma, ctx, members as any).borrar(ENCARGADO, 'res-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(members.remove).not.toHaveBeenCalled();
    expect(llamadas.some((l) => l.op === 'updateMany')).toBe(false);
  });

  it('con turnos por delante no se borra', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'appointmentResource.findFirst': fila(), 'appointment.count': 3 });
    await expect(new EquipoService(prisma, ctx, { remove: jest.fn() } as any).borrar(DUENIO, 'res-1')).rejects.toThrow('Tiene 3 turnos por delante. Movelos o cancelalos antes de borrarla.');
  });

  it('modo PROFESSIONAL: no puede quedar el negocio sin nadie que atienda', async () => {
    const { prisma, ctx } = servicios({ ...negocio({ agendaMode: 'PROFESSIONAL' }), 'appointmentResource.findFirst': fila({ memberId: null, member: null }), 'appointmentResource.count': 0 });
    await expect(new EquipoService(prisma, ctx, {} as any).borrar(DUENIO, 'res-1')).rejects.toThrow('Tiene que quedar al menos una persona que atienda.');
  });

  it('borrar: saca el acceso con MembersService.remove y deja la agenda borrada (soft) y sus clases sin profe', async () => {
    const members = { remove: jest.fn().mockResolvedValue({ ok: true }) };
    const { prisma, ctx, llamadas } = servicios({ ...negocio(), 'appointmentResource.findFirst': fila() });
    await new EquipoService(prisma, ctx, members as any).borrar(DUENIO, 'res-1');
    expect(members.remove).toHaveBeenCalledWith(BIZ, 'mem-caro', 'm-duenio');
    const borrado = llamadas.find((l) => l.modelo === 'appointmentResource' && l.op === 'updateMany')!.args;
    expect(borrado.where).toMatchObject({ id: 'res-1', businessId: BIZ });
    expect(borrado.data).toMatchObject({ isActive: false, isBookable: false });
    expect(llamadas.find((l) => l.modelo === 'appointmentClassTemplate' && l.op === 'updateMany')!.args).toEqual({ where: { businessId: BIZ, instructorResourceId: 'res-1' }, data: { instructorResourceId: null } });
    todasConNegocio(llamadas);
  });

  it('editar la ficha del dueño: solo el dueño', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'appointmentResource.findFirst': fila({ member: { id: 'm', email: 'd@x.com', status: 'ACTIVE', roleId: 'o', role: { name: 'owner' } } }) });
    await expect(new EquipoService(prisma, ctx, {} as any).editar(ENCARGADO, 'res-1', { name: 'Yo', isBookable: true, workDays: [0] })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Roles de Turnos', () => {
  const ENCARGADO = miembro('Encargado/a', ['appointments.agenda.view', 'appointments.agenda.view_all', 'appointments.team.manage'], 'm-enc');
  const fila = (extra: object = {}) => ({
    id: 'rol-1', businessId: BIZ, name: 'Recepción', description: null, color: null, isDefault: false, appointmentsRoleKey: 'recepcion', takesAppointments: false,
    notificationEvents: ['pedido_nuevo'], rolePermissions: [{ permission: { code: 'config.team.view' } }, { permission: { code: 'appointments.agenda.view' } }],
    _count: { members: 0 }, ...extra,
  });

  it('solo códigos appointments.*', async () => {
    const roles = { create: jest.fn() };
    const { prisma, ctx } = servicios(negocio());
    await expect(new RolesTurnosService(prisma, ctx, roles as any).crear(DUENIO, { name: 'Caja', takesAppointments: false, permissions: ['catalog.manage'] }))
      .rejects.toThrow('Solo se pueden usar permisos de Turnos');
    expect(roles.create).not.toHaveBeenCalled();
  });

  it('crear un rol con permisos que uno no tiene → 403', async () => {
    const roles = { create: jest.fn() };
    const { prisma, ctx } = servicios(negocio());
    await expect(new RolesTurnosService(prisma, ctx, roles as any).crear(ENCARGADO, { name: 'Jefe', takesAppointments: false, permissions: ['appointments.settings.manage'] }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(roles.create).not.toHaveBeenCalled();
  });

  it('crear: normaliza los códigos (editar todo con ver solo lo propio queda en lo propio), usa RolesService y guarda si atiende', async () => {
    const roles = { create: jest.fn().mockResolvedValue({ id: 'rol-n' }) };
    const { prisma, ctx, llamadas } = servicios({ ...negocio(), 'role.findFirst': fila({ id: 'rol-n', appointmentsRoleKey: null, takesAppointments: true }) });
    await new RolesTurnosService(prisma, ctx, roles as any).crear(DUENIO, { name: 'Coach', takesAppointments: true, permissions: ['appointments.agenda.view', 'appointments.agenda.manage', 'appointments.agenda.manage_all', 'appointments.clients.view_all'] });
    expect(roles.create.mock.calls[0][1].permissions.sort()).toEqual(['appointments.agenda.manage', 'appointments.agenda.view']);
    expect(llamadas.find((l) => l.modelo === 'role' && l.op === 'updateMany')!.args).toEqual({ where: { id: 'rol-n', businessId: BIZ }, data: { takesAppointments: true } });
  });

  it('editar conserva los avisos por email y los códigos que no son de Turnos', async () => {
    const roles = { update: jest.fn().mockResolvedValue({}) };
    const { prisma, ctx } = servicios({ ...negocio(), 'role.findFirst': fila() });
    await new RolesTurnosService(prisma, ctx, roles as any).editar(DUENIO, 'rol-1', { name: 'Recepción', takesAppointments: false, permissions: ['appointments.agenda.view'] });
    const dto = roles.update.mock.calls[0][2];
    expect(dto.permissions).toEqual(expect.arrayContaining(['config.team.view', 'appointments.agenda.view']));
    expect(dto.notificationEvents).toEqual(['pedido_nuevo']);
  });

  it('el rol del dueño no se cambia ni se borra; un rol con gente no se borra', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'role.findFirst': fila({ name: 'owner', isDefault: true }) });
    const svc = new RolesTurnosService(prisma, ctx, { update: jest.fn(), remove: jest.fn() } as any);
    await expect(svc.editar(DUENIO, 'rol-1', { name: 'x', takesAppointments: false, permissions: [] })).rejects.toThrow('El rol del dueño no se cambia.');
    await expect(svc.borrar(DUENIO, 'rol-1')).rejects.toThrow('El rol del dueño no se borra.');
    const { prisma: p2, ctx: c2 } = servicios({ ...negocio(), 'role.findFirst': fila({ _count: { members: 2 } }) });
    await expect(new RolesTurnosService(p2, c2, { remove: jest.fn() } as any).borrar(DUENIO, 'rol-1')).rejects.toThrow('Hay 2 personas con este rol. Pasalas a otro antes de borrarlo.');
  });

  it('volver a fábrica usa el rol del rubro; un rol creado por el dueño no tiene fábrica', async () => {
    const roles = { update: jest.fn().mockResolvedValue({}) };
    const { prisma, ctx } = servicios({ ...negocio(), 'role.findFirst': fila() });
    await new RolesTurnosService(prisma, ctx, roles as any).restablecer(DUENIO, 'rol-1');
    expect(roles.update.mock.calls[0][2].name).toBe('Recepción');
    const { prisma: p2, ctx: c2 } = servicios({ ...negocio(), 'role.findFirst': fila({ appointmentsRoleKey: null }) });
    await expect(new RolesTurnosService(p2, c2, roles as any).restablecer(DUENIO, 'rol-1')).rejects.toThrow('Este rol no es de fábrica');
  });

  it('la lista trae alcances y si el rol de fábrica cambió', async () => {
    const { prisma, ctx } = servicios({ ...negocio(), 'role.findMany': [fila(), fila({ id: 'o', name: 'owner', isDefault: true, appointmentsRoleKey: null })] });
    const [recepcion, duenio] = await new RolesTurnosService(prisma, ctx, {} as any).listar(DUENIO);
    expect(recepcion).toMatchObject({ factoryKey: 'recepcion', changed: true, permissions: ['appointments.agenda.view'], isOwner: false });
    expect(recepcion.scopes['agenda.ver']).toBe('propio');
    expect(duenio.isOwner).toBe(true);
    expect(duenio.scopes['config.editar']).toBe('todo');
  });
});

describe('Clases con cupo', () => {
  const AHORA = instanteDe('2026-10-01', 12 * 60); // jueves
  const FECHA = '2026-10-05'; // lunes
  const plantilla = (extra: object = {}) => ({
    id: 'tpl-1', businessId: BIZ, serviceId: 'svc', weekday: 0, startMin: 18 * 60, durationMin: 45, instructorResourceId: 'res-caro', roomResourceId: null,
    capacity: 2, isActive: true, deletedAt: null, createdAt: new Date(), service: { name: 'Spinning', price: 6_000 }, instructor: { name: 'Caro' }, room: null, ...extra,
  });
  const sesion = (extra: object = {}) => ({
    id: 'ses-1', businessId: BIZ, templateId: 'tpl-1', date: FECHA, startsAt: instanteDe(FECHA, 1080), endsAt: instanteDe(FECHA, 1125),
    capacity: null, isCancelled: false, ...extra,
  });
  const base = (extra: Record<string, Resp> = {}, settings: Partial<typeof SETTINGS> = {}) => servicios({
    ...negocio(settings),
    'appointmentClassTemplate.findFirst': plantilla(),
    'appointmentClassSession.upsert': sesion(),
    'appointmentClassSession.findFirst': sesion(),
    ...extra,
  });
  const anotarNueva = (svc: ClasesService, quien = DUENIO) =>
    svc.anotar(quien, 'tpl-1', FECHA, { customer: { name: 'Ana Paz', phone: '11 5555-0101' } }, AHORA);

  it('anotar toma el lock de la clase (plantilla + fecha) dentro de la transacción', async () => {
    const { prisma, ctx, raws, llamadas } = base();
    await anotarNueva(new ClasesService(prisma, ctx, {} as any));
    expect(raws.some((r) => r.sql.includes('pg_advisory_xact_lock') && r.valores.includes(`clase:tpl-1:${FECHA}`))).toBe(true);
    const creada = llamadas.find((l) => l.modelo === 'appointmentClassEnrollment' && l.op === 'create')!.args.data;
    expect(creada).toMatchObject({ businessId: BIZ, sessionId: 'ses-1', status: 'ENROLLED', customerPhone: '1155550101', origin: 'PANEL', price: 6_000, createdByMemberId: 'm-duenio' });
    expect(creada.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(creada.accessToken).toHaveLength(43);
    todasConNegocio(llamadas);
  });

  it('clase completa y sin lista de espera → 409 "La clase está completa."', async () => {
    const { prisma, ctx, llamadas } = base({ 'appointmentClassEnrollment.count': (a: any) => (a.where.status === 'ENROLLED' ? 2 : 0) });
    await expect(anotarNueva(new ClasesService(prisma, ctx, {} as any))).rejects.toBeInstanceOf(ConflictException);
    expect(llamadas.some((l) => l.modelo === 'appointmentClassEnrollment' && l.op === 'create')).toBe(false);
  });

  it('completa con lista de espera → entra a la lista con la posición siguiente y sin seña', async () => {
    const { prisma, ctx, llamadas } = base({
      'appointmentClassEnrollment.count': (a: any) => (a.where.status === 'ENROLLED' ? 2 : 0),
      'appointmentClassEnrollment.aggregate': { _max: { waitlistPosition: 3 } },
    }, { waitlistEnabled: true, depositEnabled: true });
    await anotarNueva(new ClasesService(prisma, ctx, {} as any));
    expect(llamadas.find((l) => l.op === 'create' && l.modelo === 'appointmentClassEnrollment')!.args.data).toMatchObject({ status: 'WAITLIST', waitlistPosition: 4, depositAmount: 0 });
  });

  it('un lugar ofrecido a la lista de espera (oferta vigente) no lo toma otro', async () => {
    const { prisma, ctx } = base({
      'appointmentClassEnrollment.count': (a: any) => (a.where.status === 'ENROLLED' ? 1 : a.where.offerExpiresAt?.gt ? 1 : 0),
    });
    await expect(anotarNueva(new ClasesService(prisma, ctx, {} as any))).rejects.toThrow('La clase está completa.');
  });

  it('ya anotado con ese teléfono → 400', async () => {
    const { prisma, ctx } = base({ 'appointmentClassEnrollment.findFirst': { id: 'e-viejo' } });
    await expect(anotarNueva(new ClasesService(prisma, ctx, {} as any))).rejects.toThrow('Esa persona ya está anotada en esta clase.');
  });

  it('cliente existente O nuevo, no los dos ni ninguno', async () => {
    const { prisma, ctx } = base();
    const svc = new ClasesService(prisma, ctx, {} as any);
    await expect(svc.anotar(DUENIO, 'tpl-1', FECHA, {}, AHORA)).rejects.toThrow('Elegí un cliente o cargá uno nuevo.');
    await expect(svc.anotar(DUENIO, 'tpl-1', FECHA, { customerId: 'c1', customer: { name: 'Ana Paz' } }, AHORA)).rejects.toThrow('Elegí un cliente o cargá uno nuevo.');
  });

  it('suspendida → 400; una fecha que no es de esa clase → 404', async () => {
    const { prisma, ctx } = base({ 'appointmentClassSession.upsert': sesion({ isCancelled: true }) });
    const svc = new ClasesService(prisma, ctx, {} as any);
    await expect(anotarNueva(svc)).rejects.toThrow('Esta clase está suspendida.');
    await expect(svc.anotar(DUENIO, 'tpl-1', '2026-10-06', { customer: { name: 'Ana Paz' } }, AHORA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin agenda.manage_all solo anota en las clases que da (otra → 404)', async () => {
    const { prisma, ctx, llamadas } = base({
      'appointmentResource.findFirst': { id: 'res-yo', assignedSpaceId: null },
      'appointmentClassTemplate.findFirst': (a: any) => (JSON.stringify(a.where).includes('res-yo') ? null : plantilla()),
    });
    await expect(anotarNueva(new ClasesService(prisma, ctx, {} as any), PROFE)).rejects.toBeInstanceOf(NotFoundException);
    expect(llamadas.find((l) => l.modelo === 'appointmentClassTemplate')!.args.where).toMatchObject({
      businessId: BIZ, OR: [{ instructorResourceId: { in: ['res-yo'] } }, { roomResourceId: { in: ['res-yo'] } }],
    });
  });

  it('el detalle del panel tapa teléfonos sin clients.contact y nunca trae el accessToken', async () => {
    const inscripcion = {
      id: 'e1', businessId: BIZ, sessionId: 'ses-1', code: 'ABC234', accessToken: 'SECRETO-DEL-ENLACE', customerId: 'c1', customerName: 'Ana Paz',
      customerPhone: '1155550101', customerEmail: 'ana@x.com', status: 'ENROLLED', waitlistPosition: null, attended: null, depositAmount: 0,
      depositPaidAt: null, createdAt: new Date(),
    };
    const { prisma, ctx } = base({
      'appointmentResource.findFirst': { id: 'res-caro', assignedSpaceId: null },
      'appointmentClassEnrollment.findMany': [inscripcion],
      'appointmentClassEnrollment.groupBy': [{ sessionId: 'ses-1', status: 'ENROLLED', _count: { _all: 1 } }],
    });
    const d = await new ClasesService(prisma, ctx, {} as any).detalle(PROFE, 'tpl-1', FECHA, AHORA);
    expect(d).toMatchObject({ enrolled: 1, capacity: 2, sessionId: 'ses-1' });
    expect(d.enrollments[0].customer).toEqual({ id: 'c1', name: 'Ana Paz', phone: '••••••••01', email: null });
    expect(JSON.stringify(d)).not.toContain('SECRETO-DEL-ENLACE');
  });

  it('sacar a alguien anotado le ofrece el lugar al primero de la lista de espera', async () => {
    const { prisma, ctx, llamadas } = base({
      'appointmentClassEnrollment.findFirst': { id: 'e1', businessId: BIZ, status: 'ENROLLED', customerName: 'Ana', session: { ...sesion(), template: { capacity: 2 } } },
      'appointmentClassEnrollment.count': (a: any) => (a.where.status === 'ENROLLED' ? 1 : 0),
      'appointmentClassEnrollment.findMany': (a: any) => (a.where.offerExpiresAt === null ? [{ id: 'e-espera-1' }] : []),
    });
    await new ClasesService(prisma, ctx, {} as any).sacar(DUENIO, 'e1', AHORA).catch(() => undefined);
    const baja = llamadas.find((l) => l.op === 'updateMany' && l.args.data?.status === 'CANCELLED' && l.args.where.id === 'e1')!;
    expect(baja.args.data).toMatchObject({ cancelledBy: 'BUSINESS' });
    const oferta = llamadas.find((l) => l.op === 'updateMany' && l.args.data?.offerExpiresAt instanceof Date)!;
    expect(oferta.args.where).toMatchObject({ businessId: BIZ, id: { in: ['e-espera-1'] } });
    expect(oferta.args.data.offerExpiresAt.getTime() - AHORA.getTime()).toBe(30 * 60_000);
  });

  it('aceptar una oferta vencida o sin lugar → 400 "El lugar ya se ocupó."', async () => {
    const vencida = { id: 'e2', businessId: BIZ, sessionId: 'ses-1', status: 'WAITLIST', offerExpiresAt: new Date(AHORA.getTime() - 1), customerId: null, price: 6000, discountAmount: 0 };
    const { prisma, ctx } = base({
      'appointmentClassEnrollment.findFirst': (a: any) => (a.include ? { ...vencida, session: { ...sesion(), template: plantilla() } } : vencida),
    });
    await expect(new ClasesService(prisma, ctx, {} as any).aceptarOferta(BIZ, 'e2', AHORA)).rejects.toThrow('El lugar ya se ocupó.');
  });

  it('borrar una plantilla con gente anotada en clases que vienen → 400', async () => {
    const { prisma, ctx } = base({ 'appointmentClassEnrollment.count': 3 });
    await expect(new ClasesService(prisma, ctx, {} as any).borrarPlantilla(DUENIO, 'tpl-1', AHORA)).rejects.toThrow('Hay 3 personas anotadas en clases que vienen. Suspendé esas clases primero.');
  });

  it('la plantilla tiene que entrar en el horario del negocio y no pisarse con otra de la misma sala', async () => {
    const { prisma, ctx } = base({
      'appointmentService.findFirst': { name: 'Spinning' },
      'appointmentResource.findFirst': { name: 'Sala 2' },
      'appointmentClassTemplate.findMany': [plantilla({ id: 'otra', roomResourceId: 'sala-2', startMin: 18 * 60 + 30, service: { name: 'Yoga', price: 0 } })],
    });
    const svc = new ClasesService(prisma, ctx, {} as any);
    const dto = { serviceId: 'svc', weekday: 0, startMin: 21 * 60 + 30, durationMin: 60, capacity: 10, roomResourceId: 'sala-2' };
    await expect(svc.crearPlantilla(DUENIO, dto)).rejects.toThrow('Ese día el negocio atiende de 07:00 a 22:00. La clase tiene que entrar ahí.');
    await expect(svc.crearPlantilla(DUENIO, { ...dto, startMin: 18 * 60 })).rejects.toThrow('A esa hora la Sala 2 ya tiene Yoga.');
  });

  it('las plantillas son solo para negocios con clases', async () => {
    const { prisma, ctx } = base({}, { agendaMode: 'PROFESSIONAL' });
    await expect(new ClasesService(prisma, ctx, {} as any).crearPlantilla(DUENIO, { serviceId: 'svc', weekday: 0, startMin: 600, durationMin: 60, capacity: 10 }))
      .rejects.toThrow('Las clases con cupo son para negocios que trabajan con clases.');
  });

  describe('desde el sitio', () => {
    const storefront = { resolveBusinessId: jest.fn().mockResolvedValue(BIZ) };
    const pub = (extra: Record<string, Resp> = {}, settings: Partial<typeof SETTINGS> = {}) => {
      const s = base({ ...extra }, settings);
      return { ...s, svc: new ClasesService(s.prisma, s.ctx, storefront as any) };
    };
    const dto = { templateId: 'tpl-1', date: FECHA, name: 'Ana Paz', phone: '11 5555-0101' };

    it('teléfono con menos de 10 dígitos → el mensaje de la demo', async () => {
      const { svc } = pub({ 'business.findFirst': (a: any) => (a.where.isActive ? { id: BIZ } : { vertical: 'APPOINTMENTS', appointmentSettings: SETTINGS }) });
      await expect(svc.anotarPublico('gym', { ...dto, phone: '11 5555-010' }, undefined, AHORA)).rejects.toThrow('Faltan dígitos: son 10 con el código de área.');
    });

    it('la reserva se abre classOpenDays antes', async () => {
      const { svc } = pub({ 'business.findFirst': (a: any) => (a.where.isActive ? { id: BIZ } : { vertical: 'APPOINTMENTS', appointmentSettings: { ...SETTINGS, classOpenDays: 2 } }) });
      await expect(svc.anotarPublico('gym', dto, undefined, AHORA)).rejects.toThrow('La reserva de esta clase se abre el 03/10/2026.');
    });

    it('sitio pausado o sin publicar → 404', async () => {
      const { svc } = pub({ 'business.findFirst': (a: any) => (a.where.isActive ? null : { vertical: 'APPOINTMENTS', appointmentSettings: SETTINGS }) });
      await expect(svc.anotarPublico('gym', dto, undefined, AHORA)).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.clasesPublicas('gym', {}, AHORA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('límite de reservas activas por cliente', async () => {
      const { svc } = pub({
        'business.findFirst': (a: any) => (a.where.isActive ? { id: BIZ } : { vertical: 'APPOINTMENTS', appointmentSettings: SETTINGS }),
        'appointment.count': 1, 'appointmentClassEnrollment.count': 1,
      });
      await expect(svc.anotarPublico('gym', dto, undefined, AHORA)).rejects.toThrow('Ya tenés 2 turnos reservados. Cuando uses o canceles alguno vas a poder sacar otro.');
    });

    it('anota, devuelve el accessToken UNA vez y "mi turno" sin datos del cliente; un JWT de otro negocio se ignora', async () => {
      const { svc, llamadas } = pub({ 'business.findFirst': (a: any) => (a.where.isActive ? { id: BIZ } : { vertical: 'APPOINTMENTS', appointmentSettings: SETTINGS }) });
      const otro = { type: 'customer' as const, customerId: 'c-de-otro', businessId: 'biz-otro-negocio', businessMode: 'FULL' as const };
      const r = await svc.anotarPublico('gym', dto, otro, AHORA);
      expect(r.accessToken).toHaveLength(43);
      expect(r.booking).toMatchObject({ kind: 'class', status: 'ENROLLED', serviceName: 'Spinning', resourceName: 'Caro', date: FECHA, startMin: 1080 });
      expect(JSON.stringify(r.booking)).not.toContain(r.accessToken);
      expect(r.payment).toBeNull();
      const creada = llamadas.find((l) => l.modelo === 'appointmentClassEnrollment' && l.op === 'create')!.args.data;
      expect(creada).toMatchObject({ origin: 'STOREFRONT', customerPhone: '1155550101', customerName: 'Ana Paz' });
      expect(creada.customerId).not.toBe('c-de-otro');
    });
  });
});
