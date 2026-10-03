import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { PERMISSION_KEY } from '../../src/common/decorators/require-permission.decorator';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../../src/common/decorators/optional-auth.decorator';
import { ClasesController, ClasesPublicoController } from '../../src/appointments/gestion/clases/clases.controller';
import { ClientesController } from '../../src/appointments/gestion/clientes/clientes.controller';
import { EquipoController, RolesTurnosController } from '../../src/appointments/gestion/equipo/equipo.controller';
import { GananciasController } from '../../src/appointments/gestion/ganancias/ganancias.controller';
import { AttendanceDto, EnrollDto, PublicEnrollDto, UpdateClassSessionDto, UpsertClassTemplateDto } from '../../src/appointments/gestion/clases/dto/clases.dto';
import { CreateClientDto, ListClientsQueryDto, UpdateClientDto } from '../../src/appointments/gestion/clientes/dto/clientes.dto';
import { InvitePersonDto, PayFormDto, UpsertPersonDto, UpsertTurnosRoleDto } from '../../src/appointments/gestion/equipo/dto/equipo.dto';
import { RegisterPayoutDto } from '../../src/appointments/gestion/ganancias/dto/ganancias.dto';
import { RangoQueryDto } from '../../src/appointments/gestion/comun/rango';

// P3 — Gates de permiso por metadata (mismo enfoque que
// funciones-pagas.gates.unit-spec.ts: lo que se olvida es el decorador, no la
// lógica del guard) y validación de los DTOs de entrada.

type Ctor = new (...args: never[]) => object;
type Handler = (...args: never[]) => unknown;

function meta(controller: Ctor, metodo: string) {
  const handler = (controller.prototype as Record<string, Handler>)[metodo];
  expect(typeof handler).toBe('function'); // atrapa un método renombrado
  return {
    permiso: Reflect.getMetadata(PERMISSION_KEY, handler) as string | undefined,
    roles: Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined,
    publico: Reflect.getMetadata(IS_PUBLIC_KEY, handler) as boolean | undefined,
    opcional: Reflect.getMetadata(IS_OPTIONAL_AUTH_KEY, handler) as boolean | undefined,
    limite: Reflect.getMetadata('THROTTLER:LIMITdefault', handler) as number | undefined,
    ruta: `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number]} ${Reflect.getMetadata(PATH_METADATA, controller)}/${Reflect.getMetadata(PATH_METADATA, handler)}`.replace(/\/\/?$/, '').replace(/\/+/g, '/'),
  };
}

// [ruta del contrato, controller, método, permiso]
const PANEL: [string, Ctor, string, string][] = [
  ['GET appointments/class-templates', ClasesController, 'plantillas', 'appointments.agenda.view'],
  ['POST appointments/class-templates', ClasesController, 'crearPlantilla', 'appointments.services.manage'],
  ['PUT appointments/class-templates/:id', ClasesController, 'editarPlantilla', 'appointments.services.manage'],
  ['DELETE appointments/class-templates/:id', ClasesController, 'borrarPlantilla', 'appointments.services.manage'],
  ['GET appointments/classes', ClasesController, 'listar', 'appointments.agenda.view'],
  ['GET appointments/classes/:templateId/:date', ClasesController, 'detalle', 'appointments.agenda.view'],
  ['PUT appointments/classes/:templateId/:date', ClasesController, 'actualizar', 'appointments.agenda.manage'],
  ['POST appointments/classes/:templateId/:date/enrollments', ClasesController, 'anotar', 'appointments.agenda.manage'],
  ['DELETE appointments/class-enrollments/:id', ClasesController, 'sacar', 'appointments.agenda.manage'],
  ['PATCH appointments/class-enrollments/:id/attendance', ClasesController, 'asistencia', 'appointments.agenda.manage'],
  ['GET appointments/clients', ClientesController, 'listar', 'appointments.clients.view'],
  ['GET appointments/clients/:id', ClientesController, 'ficha', 'appointments.clients.view'],
  ['POST appointments/clients', ClientesController, 'crear', 'appointments.agenda.manage'],
  ['PUT appointments/clients/:id', ClientesController, 'editar', 'appointments.agenda.manage'],
  ['GET appointments/team', EquipoController, 'listar', 'appointments.agenda.view'],
  ['POST appointments/team/invite', EquipoController, 'invitar', 'appointments.team.manage'],
  ['POST appointments/team', EquipoController, 'crear', 'appointments.team.manage'],
  ['PUT appointments/team/:resourceId', EquipoController, 'editar', 'appointments.team.manage'],
  ['PUT appointments/team/:resourceId/pay', EquipoController, 'cambiarPago', 'appointments.earnings.settle'],
  ['DELETE appointments/team/:resourceId', EquipoController, 'borrar', 'appointments.team.manage'],
  ['GET appointments/roles', RolesTurnosController, 'listar', 'appointments.team.manage'],
  ['POST appointments/roles', RolesTurnosController, 'crear', 'appointments.team.manage'],
  ['PUT appointments/roles/:id', RolesTurnosController, 'editar', 'appointments.team.manage'],
  ['POST appointments/roles/:id/reset', RolesTurnosController, 'restablecer', 'appointments.team.manage'],
  ['DELETE appointments/roles/:id', RolesTurnosController, 'borrar', 'appointments.team.manage'],
  ['GET appointments/earnings', GananciasController, 'resumen', 'appointments.earnings.view'],
  ['GET appointments/earnings/:resourceId', GananciasController, 'persona', 'appointments.earnings.view'],
  ['GET appointments/earnings/:resourceId/payouts', GananciasController, 'pagos', 'appointments.earnings.view'],
  ['POST appointments/earnings/:resourceId/payouts', GananciasController, 'registrarPago', 'appointments.earnings.settle'],
];

describe('P3 — gates de permiso del panel', () => {
  it.each(PANEL)('%s pide %s (ni más, ni menos)', (ruta, controller, metodo, permiso) => {
    const m = meta(controller, metodo);
    expect(m.ruta).toBe(ruta);
    expect(m.permiso).toBe(permiso);
    expect(m.publico).toBeUndefined();
    expect(m.opcional).toBeUndefined();
  });

  it('invitar NO exige @Roles(owner, admin): se abre con appointments.team.manage (CONTRATO § P3.3)', () => {
    expect(meta(EquipoController, 'invitar').roles).toBeUndefined();
  });

  it('todos los endpoints del panel de P3 tienen permiso (ninguno quedó solo con "ser miembro")', () => {
    for (const c of [ClasesController, ClientesController, EquipoController, RolesTurnosController, GananciasController]) {
      for (const metodo of Object.getOwnPropertyNames(c.prototype).filter((x) => x !== 'constructor')) {
        expect([metodo, meta(c as Ctor, metodo).permiso]).toEqual([metodo, expect.stringMatching(/^appointments\./)]);
      }
    }
  });
});

describe('P3 — endpoints públicos de clases', () => {
  it('GET storefront/:slug/appointments/classes: @Public con throttle 60/min', () => {
    const m = meta(ClasesPublicoController, 'listar');
    expect(m.ruta).toBe('GET storefront/:slug/appointments/classes');
    expect(m).toMatchObject({ publico: true, limite: 60, permiso: undefined });
  });

  it('POST storefront/:slug/appointments/classes/enroll: @OptionalAuth (no @Public) con throttle 10/min', () => {
    const m = meta(ClasesPublicoController, 'anotar');
    expect(m.ruta).toBe('POST storefront/:slug/appointments/classes/enroll');
    expect(m).toMatchObject({ opcional: true, publico: undefined, limite: 10, permiso: undefined });
  });
});

const errores = async (cls: Ctor, body: object) => (await validate(plainToInstance(cls as never, body) as object)).map((e) => e.property);
const UUID = '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e';

describe('P3 — DTOs', () => {
  it('plantilla de clase: día 0–6, inicio 0–1439, duración 15–600, cupo 1–500, ids uuid', async () => {
    const ok = { serviceId: UUID, weekday: 0, startMin: 1080, durationMin: 45, capacity: 15 };
    expect(await errores(UpsertClassTemplateDto, ok)).toEqual([]);
    expect(await errores(UpsertClassTemplateDto, { ...ok, weekday: 7 })).toContain('weekday');
    expect(await errores(UpsertClassTemplateDto, { ...ok, startMin: 1440 })).toContain('startMin');
    expect(await errores(UpsertClassTemplateDto, { ...ok, durationMin: 10 })).toContain('durationMin');
    expect(await errores(UpsertClassTemplateDto, { ...ok, durationMin: 601 })).toContain('durationMin');
    expect(await errores(UpsertClassTemplateDto, { ...ok, capacity: 0 })).toContain('capacity');
    expect(await errores(UpsertClassTemplateDto, { ...ok, capacity: 501 })).toContain('capacity');
    expect(await errores(UpsertClassTemplateDto, { ...ok, serviceId: 'x' })).toContain('serviceId');
    expect(await errores(UpsertClassTemplateDto, { ...ok, instructorResourceId: 'x' })).toContain('instructorResourceId');
  });

  it('sesión: cupo 1–500 o null; motivo ≤300', async () => {
    expect(await errores(UpdateClassSessionDto, { capacity: null, cancelled: true, cancelReason: 'Lluvia' })).toEqual([]);
    expect(await errores(UpdateClassSessionDto, { capacity: 0 })).toContain('capacity');
    expect(await errores(UpdateClassSessionDto, { cancelReason: 'x'.repeat(301) })).toContain('cancelReason');
  });

  it('anotar: el cliente nuevo valida nombre y email', async () => {
    expect(await errores(EnrollDto, { customerId: UUID })).toEqual([]);
    expect(await errores(EnrollDto, { customer: { name: 'Ana Paz', phone: '1155550101' } })).toEqual([]);
    expect(await errores(EnrollDto, { customer: { name: 'An' } })).toContain('customer');
    expect(await errores(EnrollDto, { customer: { name: 'Ana Paz', email: 'no-es-mail' } })).toContain('customer');
  });

  it('asistencia: true, false o null; nada más', async () => {
    expect(await errores(AttendanceDto, { attended: true })).toEqual([]);
    expect(await errores(AttendanceDto, { attended: null })).toEqual([]);
    expect(await errores(AttendanceDto, {})).toContain('attended');
    expect(await errores(AttendanceDto, { attended: 'si' })).toContain('attended');
  });

  it('anotarse desde el sitio: plantilla uuid, fecha AAAA-MM-DD, nombre ≥3, nota ≤500, email válido', async () => {
    const ok = { templateId: UUID, date: '2026-10-05', name: 'Ana Paz', phone: '11 5555-0101' };
    expect(await errores(PublicEnrollDto, ok)).toEqual([]);
    expect(await errores(PublicEnrollDto, { ...ok, date: '05/10/2026' })).toContain('date');
    expect(await errores(PublicEnrollDto, { ...ok, name: ' A ' })).toContain('name');
    expect(await errores(PublicEnrollDto, { ...ok, note: 'x'.repeat(501) })).toContain('note');
    expect(await errores(PublicEnrollDto, { ...ok, email: 'nope' })).toContain('email');
  });

  it('clientes: nombre 3–120, nota ≤1000, filtro de la lista cerrado, límite ≤100', async () => {
    expect(await errores(CreateClientDto, { name: 'Ana Paz', phone: '1155550101', email: 'ANA@X.COM' })).toEqual([]);
    expect(await errores(CreateClientDto, { name: 'An' })).toContain('name');
    expect(await errores(CreateClientDto, { name: 'x'.repeat(121) })).toContain('name');
    expect(await errores(CreateClientDto, { name: 'Ana Paz', note: 'x'.repeat(1001) })).toContain('note');
    expect(await errores(UpdateClientDto, { name: 'Ana Paz', dni: 'x'.repeat(21) })).toContain('dni');
    expect(await errores(UpdateClientDto, { name: 'Ana Paz', insuranceNumber: 'x'.repeat(61) })).toContain('insuranceNumber');
    expect(await errores(ListClientsQueryDto, { filter: 'vip' })).toContain('filter');
    expect(await errores(ListClientsQueryDto, { limit: '101' })).toContain('limit');
    // El email se normaliza a minúsculas antes de validar.
    expect((plainToInstance(CreateClientDto, { name: 'Ana Paz', email: ' ANA@X.COM ' }) as CreateClientDto).email).toBe('ana@x.com');
  });

  it('equipo: días 0–6 sin repetir y al menos uno; color #RRGGBB; bio ≤400', async () => {
    const ok = { name: 'Caro', isBookable: true, workDays: [0, 1, 2] };
    expect(await errores(UpsertPersonDto, ok)).toEqual([]);
    expect(await errores(UpsertPersonDto, { ...ok, workDays: [] })).toContain('workDays');
    expect(await errores(UpsertPersonDto, { ...ok, workDays: [1, 1] })).toContain('workDays');
    expect(await errores(UpsertPersonDto, { ...ok, workDays: [7] })).toContain('workDays');
    expect(await errores(UpsertPersonDto, { ...ok, color: 'red' })).toContain('color');
    expect(await errores(UpsertPersonDto, { ...ok, bio: 'x'.repeat(401) })).toContain('bio');
    expect(await errores(InvitePersonDto, { name: 'Caro', email: 'caro@x.com', roleId: UUID })).toEqual([]);
    expect(await errores(InvitePersonDto, { name: 'Caro', email: 'caro', roleId: 'x' })).toEqual(expect.arrayContaining(['email', 'roleId']));
  });

  it('forma de pago: forma y frecuencia cerradas, comisión 0–100, montos ≥0', async () => {
    const ok = { payForm: 'COMMISSION', commissionPercent: 50, payEvery: 'WEEK' };
    expect(await errores(PayFormDto, ok)).toEqual([]);
    expect(await errores(PayFormDto, { ...ok, payForm: 'TIPS' })).toContain('payForm');
    expect(await errores(PayFormDto, { ...ok, commissionPercent: 101 })).toContain('commissionPercent');
    expect(await errores(PayFormDto, { ...ok, salary: -1 })).toContain('salary');
    expect(await errores(PayFormDto, { ...ok, payEvery: 'DAY' })).toContain('payEvery');
  });

  it('roles: nombre 2–40, descripción ≤200, color hex, permisos lista de textos', async () => {
    const ok = { name: 'Caja', takesAppointments: false, permissions: ['appointments.cash.charge'] };
    expect(await errores(UpsertTurnosRoleDto, ok)).toEqual([]);
    expect(await errores(UpsertTurnosRoleDto, { ...ok, name: 'C' })).toContain('name');
    expect(await errores(UpsertTurnosRoleDto, { ...ok, name: 'x'.repeat(41) })).toContain('name');
    expect(await errores(UpsertTurnosRoleDto, { ...ok, description: 'x'.repeat(201) })).toContain('description');
    expect(await errores(UpsertTurnosRoleDto, { ...ok, permissions: 'todo' })).toContain('permissions');
  });

  it('pagos al equipo: fecha AAAA-MM-DD, monto > 0 con 2 decimales, nota ≤300', async () => {
    expect(await errores(RegisterPayoutDto, {})).toEqual([]);
    expect(await errores(RegisterPayoutDto, { periodTo: '2026-09-30', amount: 1500.5, note: 'Efectivo' })).toEqual([]);
    expect(await errores(RegisterPayoutDto, { periodTo: '30/09' })).toContain('periodTo');
    expect(await errores(RegisterPayoutDto, { amount: 0 })).toContain('amount');
    expect(await errores(RegisterPayoutDto, { amount: 1.234 })).toContain('amount');
    expect(await errores(RegisterPayoutDto, { note: 'x'.repeat(301) })).toContain('note');
  });

  it('rangos de fechas', async () => {
    expect(await errores(RangoQueryDto, { from: '2026-10-01', to: '2026-10-14' })).toEqual([]);
    expect(await errores(RangoQueryDto, { from: 'hoy' })).toContain('from');
  });
});
