// Roles de fábrica de un negocio de turnos y cómo se traducen a permisos.
//
// La demo (apps/web/src/modules/turnos/admin/equipoDemo.ts) maneja cada
// permiso con tres alcances: todo, solo lo propio o nada. El sistema de
// permisos de Órbita es binario, así que el alcance se modela con PARES de
// códigos: el código base da lo propio y `_all` lo extiende a todo el negocio.
//
//   alcance 'propio' → [base]            (su agenda, sus clientes, sus ganancias)
//   alcance 'todo'   → [base, base_all]
//   alcance 'no'     → []
//
// Los roles se guardan en la tabla `roles` de siempre (Role +
// role_permissions): `appointmentsRoleKey` recuerda de qué rol de fábrica
// salió cada uno (para "volver a como venía") y `takesAppointments` dice si
// quien lo tiene atiende. El dueño es el rol `owner` que ya existe: pasa por
// todo sin mirar permisos (ver PermissionsGuard) y no figura acá.
import { RubroTurnos, esSalud, vozDe } from './rubros';

export type AlcanceTurnos = 'todo' | 'propio' | 'no';

/** Los permisos de la demo, con el código (o el par de códigos) que le corresponde a cada uno. */
export const PERMISOS_TURNOS = {
  'agenda.ver': { base: 'appointments.agenda.view', todo: 'appointments.agenda.view_all' },
  'agenda.editar': { base: 'appointments.agenda.manage', todo: 'appointments.agenda.manage_all' },
  'clientes.ver': { base: 'appointments.clients.view', todo: 'appointments.clients.view_all' },
  'clientes.contacto': { base: 'appointments.clients.contact', todo: null },
  'caja.cobrar': { base: 'appointments.cash.charge', todo: null },
  'ganancias.ver': { base: 'appointments.earnings.view', todo: 'appointments.earnings.view_all' },
  'ganancias.liquidar': { base: 'appointments.earnings.settle', todo: null },
  'reportes.ver': { base: 'appointments.reports.view', todo: null },
  'servicios.editar': { base: 'appointments.services.manage', todo: null },
  'equipo.editar': { base: 'appointments.team.manage', todo: null },
  'config.editar': { base: 'appointments.settings.manage', todo: null },
} as const;

export type PermisoTurnosId = keyof typeof PERMISOS_TURNOS;
export type AlcancesTurnos = Record<PermisoTurnosId, AlcanceTurnos>;

/** Todos los códigos del grupo "Turnos" del catálogo (common/permisos/catalogo.ts). */
export const CODIGOS_TURNOS: string[] = Object.values(PERMISOS_TURNOS).flatMap((p) => (p.todo ? [p.base, p.todo] : [p.base]));

/** El alcance de un permiso a partir de los códigos que tiene un rol. */
export function alcanceDe(codigos: readonly string[], id: PermisoTurnosId): AlcanceTurnos {
  const p = PERMISOS_TURNOS[id];
  if (!codigos.includes(p.base)) return 'no';
  // Sin punto medio (cobrar, liquidar…), tenerlo es tenerlo entero.
  if (!p.todo) return 'todo';
  return codigos.includes(p.todo) ? 'todo' : 'propio';
}

/** Los alcances de todos los permisos de Turnos de un rol. */
export function alcancesDe(codigos: readonly string[]): AlcancesTurnos {
  return Object.fromEntries((Object.keys(PERMISOS_TURNOS) as PermisoTurnosId[]).map((id) => [id, alcanceDe(codigos, id)])) as AlcancesTurnos;
}

/**
 * Hay permisos que dependen de otro: no se puede mover turnos sin ver la
 * agenda, ni escribirle a un cliente que no se ve, ni liquidar sin ver las
 * ganancias de todos. Deja los alcances coherentes (misma regla que la demo).
 */
export function normalizarAlcances(a: AlcancesTurnos): AlcancesTurnos {
  const tope = (v: AlcanceTurnos, max: AlcanceTurnos): AlcanceTurnos => (max === 'no' ? 'no' : max === 'propio' && v === 'todo' ? 'propio' : v);
  return {
    ...a,
    'agenda.editar': tope(a['agenda.editar'], a['agenda.ver']),
    'clientes.contacto': a['clientes.ver'] === 'no' ? 'no' : a['clientes.contacto'],
    'ganancias.liquidar': a['ganancias.ver'] === 'todo' ? a['ganancias.liquidar'] : 'no',
  };
}

/** Los códigos de permiso que corresponden a un juego de alcances (ya normalizado). */
export function codigosDe(alcances: AlcancesTurnos): string[] {
  const a = normalizarAlcances(alcances);
  return (Object.keys(PERMISOS_TURNOS) as PermisoTurnosId[]).flatMap((id) => {
    const p = PERMISOS_TURNOS[id];
    if (a[id] === 'no') return [];
    return a[id] === 'todo' && p.todo ? [p.base, p.todo] : [p.base];
  });
}

/**
 * Deja coherente una lista de códigos que llega del panel: saca los `_all` sin
 * su base y aplica las dependencias. Los códigos que no son de Turnos pasan
 * sin tocar.
 */
export function normalizarCodigos(codigos: readonly string[]): string[] {
  const ajenos = codigos.filter((c) => !CODIGOS_TURNOS.includes(c));
  return [...new Set([...ajenos, ...codigosDe(alcancesDe(codigos))])];
}

const armar = (
  agendaVer: AlcanceTurnos, agendaEditar: AlcanceTurnos, clientesVer: AlcanceTurnos, contacto: AlcanceTurnos, cobrar: AlcanceTurnos,
  gananciasVer: AlcanceTurnos, liquidar: AlcanceTurnos, reportes: AlcanceTurnos, servicios: AlcanceTurnos, equipo: AlcanceTurnos, config: AlcanceTurnos,
): AlcancesTurnos => ({
  'agenda.ver': agendaVer, 'agenda.editar': agendaEditar, 'clientes.ver': clientesVer, 'clientes.contacto': contacto,
  'caja.cobrar': cobrar, 'ganancias.ver': gananciasVer, 'ganancias.liquidar': liquidar, 'reportes.ver': reportes,
  'servicios.editar': servicios, 'equipo.editar': equipo, 'config.editar': config,
});

/** Con qué arranca un rol que el dueño crea de cero: ve su agenda y nada más. */
export const ALCANCES_MINIMOS: AlcancesTurnos = armar('propio', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no');

// Puntos de partida de los roles de fábrica.
const BASE = {
  encargado: armar('todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'no'),
  recepcion: armar('todo', 'todo', 'todo', 'todo', 'todo', 'no', 'no', 'no', 'no', 'no', 'no'),
  administracion: armar('todo', 'no', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'no', 'no', 'no'),
  /** Quien atiende: su agenda, sus clientes y lo que le toca cobrar. */
  atiende: armar('propio', 'propio', 'propio', 'no', 'todo', 'propio', 'no', 'no', 'no', 'no', 'no'),
  /** En salud el profesional sí ve cómo contactar a sus pacientes, y no cobra él. */
  atiendeSalud: armar('propio', 'propio', 'propio', 'todo', 'no', 'propio', 'no', 'no', 'no', 'no', 'no'),
  aprendiz: armar('propio', 'no', 'propio', 'no', 'no', 'propio', 'no', 'no', 'no', 'no', 'no'),
  /** Ayuda sin atender: necesita saber quién viene, y nada más. */
  asistente: armar('todo', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no'),
  caja: armar('todo', 'no', 'no', 'no', 'todo', 'no', 'no', 'no', 'no', 'no', 'no'),
};

export interface RolDeFabrica {
  /** Va a Role.appointmentsRoleKey. */
  key: string;
  nombre: string;
  descripcion: string;
  /** Va a Role.takesAppointments: quien tiene este rol atiende turnos o da clases. */
  atiende: boolean;
  alcances: AlcancesTurnos;
  /** Los códigos de permiso que se le siembran. */
  permisos: string[];
}

type Extra = [key: string, nombre: string, descripcion: string, base: keyof typeof BASE, atiende: boolean];

// Lo propio de cada rubro, además de Encargado, Recepción y quien atiende.
const EXTRAS: Record<string, Extra[]> = {
  barberia: [['aprendiz', 'Aprendiz', 'Corta con supervisión. Ve su agenda y lo que le toca cobrar; no da turnos ni ve teléfonos.', 'aprendiz', true]],
  peluqueria: [
    ['colorista', 'Colorista', 'Hace color y mechas. Ve su agenda, sus clientes y su comisión.', 'atiende', true],
    ['asistente', 'Asistente', 'Lava, prepara y asiste. Ve la agenda del salón para saber quién sigue; sin precios ni ganancias.', 'asistente', false],
  ],
  estilista: [['asistente', 'Asistente', 'Te acompaña en los servicios. Ve la agenda para saber adónde y a qué hora; nada más.', 'asistente', false]],
  maquillaje: [['asistente', 'Asistente', 'Te acompaña en eventos y producciones. Ve la agenda; sin precios ni ganancias.', 'asistente', false]],
  estetica: [['masajista', 'Masajista', 'Atiende en cabina. Ve su agenda, sus clientes y su comisión.', 'atiende', true]],
  unas: [['aprendiz', 'Aprendiz', 'Atiende con supervisión. Ve su agenda y lo que le toca cobrar; no da turnos.', 'aprendiz', true]],
  pestanas: [['aprendiz', 'Aprendiz', 'Atiende con supervisión. Ve su agenda y lo que le toca cobrar; no da turnos.', 'aprendiz', true]],
  spa: [['cosmetologa', 'Cosmetóloga', 'Hace los tratamientos faciales. Ve su agenda, sus clientes y su comisión.', 'atiende', true]],
  tatuajes: [
    ['perforador', 'Perforador/a', 'Hace los piercings. Ve su agenda, sus clientes y su comisión.', 'atiende', true],
    ['aprendiz', 'Aprendiz', 'Tatúa con supervisión. Ve su agenda y lo que le toca cobrar; no da turnos.', 'aprendiz', true],
  ],
  'centro-medico': [['enfermeria', 'Enfermería', 'Asiste en los consultorios. Ve la agenda del centro; no da turnos ni ve la caja.', 'asistente', false]],
  clinica: [['enfermeria', 'Enfermería', 'Asiste en consultorios y estudios. Ve la agenda de la clínica; no da turnos ni ve la caja.', 'asistente', false]],
  odonto: [['asistente', 'Asistente dental', 'Prepara el sillón y asiste en la atención. Ve la agenda; no da turnos ni ve la caja.', 'asistente', false]],
  gym: [['trainer', 'Personal trainer', 'Da sus clases particulares. Ve su agenda, sus alumnos y lo que le corresponde.', 'atiende', true]],
  crossfit: [['asistente', 'Coach asistente', 'Acompaña al coach en la clase. Ve la grilla de clases; nada más.', 'asistente', false]],
  'artes-marciales': [['asistente', 'Instructor/a ayudante', 'Acompaña al sensei en la clase. Ve la grilla de clases; nada más.', 'asistente', false]],
  natacion: [['guardavidas', 'Guardavidas', 'Cuida la pileta. Ve qué clases hay y cuánta gente; nada más.', 'asistente', false]],
  talleres: [['coordinacion', 'Coordinación', 'Arma los grupos y cobra las señas. No ve ganancias.', 'recepcion', false]],
};

const rol = (key: string, nombre: string, descripcion: string, atiende: boolean, alcances: AlcancesTurnos): RolDeFabrica =>
  ({ key, nombre, descripcion, atiende, alcances, permisos: codigosDe(alcances) });

/**
 * Los roles con los que arranca el equipo de un negocio de ese rubro, sin
 * contar al dueño (que es el rol `owner` de siempre).
 */
export function rolesDeFabrica(r: RubroTurnos): RolDeFabrica[] {
  const c = vozDe(r).clientes;
  const salud = esSalud(r);

  // Un complejo de canchas no tiene "profesionales": tiene gente que abre, cobra y mantiene.
  if (r.modo === 'COURT') {
    return [
      rol('encargado', 'Encargado/a de turno', 'Abre el complejo, entrega las canchas, toma reservas y cobra. No toca la configuración ni ve ganancias.', false, BASE.recepcion),
      rol('cantina', 'Cantina y caja', 'Atiende la cantina y cobra. Ve las reservas del día para saber quién llega.', false, BASE.caja),
      rol('mantenimiento', 'Mantenimiento', 'Cuida las canchas. Ve qué canchas están ocupadas y cuándo; nada más.', false, BASE.asistente),
      rol('administracion', 'Administración', 'Lleva los números: ve lo que se factura y liquida los sueldos. No toma reservas.', false, BASE.administracion),
    ];
  }

  const queAtiende = r.modo === 'CLASS' ? 'da sus clases' : 'atiende';
  const roles: RolDeFabrica[] = [
    rol('encargado', 'Encargado/a', 'Maneja el día a día cuando no estás: agenda, equipo y caja. No toca el sitio ni la suscripción.', false, BASE.encargado),
    rol(
      'recepcion', salud ? 'Secretaría' : 'Recepción',
      salud ? 'Da los turnos, recibe a los pacientes y cobra. No ve ganancias ni cambia la configuración.' : `Atiende el mostrador y el teléfono: da turnos, recibe a los ${c} y cobra. No ve ganancias.`,
      false, BASE.recepcion,
    ),
    rol(
      'profesional', r.profesional,
      `Entra a su panel y ${queAtiende}: ve su agenda, sus ${c} y lo que le corresponde cobrar. No ve lo del resto.`,
      true, salud ? BASE.atiendeSalud : BASE.atiende,
    ),
    ...(EXTRAS[r.key] ?? []).map(([key, nombre, descripcion, base, atiende]) => rol(key, nombre, descripcion, atiende, BASE[base])),
  ];
  if (salud) roles.push(rol('administracion', 'Administración', 'Factura a las obras sociales y cierra la caja. Ve los números; no da turnos.', false, BASE.administracion));
  return roles;
}

/** Cómo viene de fábrica un rol del rubro (para "volver a como venía"). undefined si lo creó el dueño. */
export const rolDeFabrica = (r: RubroTurnos, key: string): RolDeFabrica | undefined => rolesDeFabrica(r).find((x) => x.key === key);
