// DEMO — el equipo de un negocio de Turnos: los roles con los que se entra al
// panel, qué puede ver y hacer cada uno, las personas, y cómo cobra cada una
// (comisión, sueldo, las dos cosas, alquiler del sillón o por clase).
//
// Cada rubro trae sus roles de fábrica: una barbería tiene Barbero y Aprendiz,
// un consultorio tiene Secretaría y Administración, un box tiene Coach. El
// dueño los ajusta permiso por permiso, o crea los suyos. Con eso se arma el
// panel de cada persona: quien entra con el rol "Barbero" ve su agenda, sus
// clientes y lo que le corresponde cobrar, y nada más.
//
// Todo es de ejemplo y vive en el estado de PanelTurnos: no hay cuentas ni
// invitaciones de verdad.
import { esSalud, type Recurso, type RubroTurnos } from '@/modules/turnos/datos'
import { AHORA_DEMO } from '@/modules/turnos/horario'
import { fechaDe, fechaLarga, indiceDia, type ClasePanel, type TurnoAgenda } from './agendaDemo'

// ─── Permisos ────────────────────────────────────────────────────────────────

/** Cuánto alcanza un permiso: todo, solo lo propio (su agenda, sus clientes, sus ganancias) o nada. */
export type Alcance = 'todo' | 'propio' | 'no'

export type PermisoId =
  | 'agenda.ver' | 'agenda.editar'
  | 'clientes.ver' | 'clientes.contacto'
  | 'caja.cobrar' | 'ganancias.ver' | 'ganancias.liquidar' | 'reportes.ver'
  | 'servicios.editar' | 'equipo.editar' | 'config.editar'

export interface Permiso {
  id: PermisoId
  grupo: string
  label: string
  ayuda: string
  /** Si admite el punto medio, cómo se llama: "Solo la suya", "Solo los suyos". */
  propio?: string
  /** Cómo se llama el alcance completo cuando hay punto medio: "Toda", "Las de todos". Sin punto medio es "Sí". */
  todo?: string
}

export type Permisos = Record<PermisoId, Alcance>

/** Cómo le dice el rubro a quien reserva, en plural y minúscula. */
export const clientesTxt = (r: RubroTurnos) => (esSalud(r) ? 'pacientes' : r.modo === 'cupo' ? 'alumnos' : 'clientes')
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Los permisos del panel, con las palabras del rubro (clientes, pacientes o alumnos). */
export function permisosDe(r: RubroTurnos): Permiso[] {
  const c = clientesTxt(r)
  const C = cap(c)
  return [
    { id: 'agenda.ver', grupo: 'Agenda', label: 'Ver la agenda', ayuda: 'Los turnos del día, de la semana y del mes.', propio: 'Solo la suya', todo: 'Toda' },
    { id: 'agenda.editar', grupo: 'Agenda', label: 'Dar, mover y cancelar turnos', ayuda: 'También confirmar y marcar atendido o ausente.', propio: 'Solo los suyos', todo: 'Todos' },
    { id: 'clientes.ver', grupo: C, label: `Ver ${c} y su historial`, ayuda: 'Con “solo los suyos” ve únicamente a quienes atendió.', propio: 'Solo los suyos', todo: 'Todos' },
    { id: 'clientes.contacto', grupo: C, label: 'Ver teléfonos y escribirles', ayuda: 'Sin este permiso el teléfono se ve tapado y no puede mandar WhatsApp.' },
    { id: 'caja.cobrar', grupo: 'Plata', label: 'Cobrar y registrar señas', ayuda: 'Marcar una seña como cobrada desde el turno.' },
    { id: 'ganancias.ver', grupo: 'Plata', label: 'Ver ganancias y comisiones', ayuda: 'Con “solo las suyas” ve lo que le corresponde cobrar, no lo del resto.', propio: 'Solo las suyas', todo: 'Las de todos' },
    { id: 'ganancias.liquidar', grupo: 'Plata', label: 'Liquidar y registrar pagos al equipo', ayuda: 'Cerrar un período, marcarlo como pagado y cambiar cómo cobra cada uno.' },
    { id: 'reportes.ver', grupo: 'Plata', label: 'Ver los números del negocio', ayuda: 'Cuánto se factura y los ingresos estimados del día.' },
    { id: 'servicios.editar', grupo: 'Negocio', label: 'Editar servicios y precios', ayuda: 'Lo que se ofrece en la página de reservas.' },
    { id: 'equipo.editar', grupo: 'Negocio', label: 'Sumar gente y cambiar roles', ayuda: 'Invitar, dar de baja y decidir qué puede hacer cada uno.' },
    { id: 'config.editar', grupo: 'Negocio', label: 'Configuración, sitio y suscripción', ayuda: 'El diseño del sitio, los horarios, las reglas de reserva, los cobros y el plan de Órbita.' },
  ]
}

const armar = (agendaVer: Alcance, agendaEditar: Alcance, clientesVer: Alcance, contacto: Alcance, cobrar: Alcance, gananciasVer: Alcance, liquidar: Alcance, reportes: Alcance, servicios: Alcance, equipo: Alcance, config: Alcance): Permisos => ({
  'agenda.ver': agendaVer, 'agenda.editar': agendaEditar, 'clientes.ver': clientesVer, 'clientes.contacto': contacto,
  'caja.cobrar': cobrar, 'ganancias.ver': gananciasVer, 'ganancias.liquidar': liquidar, 'reportes.ver': reportes,
  'servicios.editar': servicios, 'equipo.editar': equipo, 'config.editar': config,
})

export const TODO: Permisos = armar('todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo')
/** Con qué arranca un rol que el dueño crea de cero: ve su agenda y nada más. */
export const PERMISOS_MINIMOS: Permisos = armar('propio', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no')

/**
 * Hay permisos que dependen de otro: no se puede mover turnos sin ver la agenda,
 * ni escribirle a un cliente que no se ve, ni liquidar sin ver las ganancias de
 * todos. Deja los permisos coherentes después de cada cambio.
 */
export function normalizar(p: Permisos): Permisos {
  const tope = (v: Alcance, max: Alcance): Alcance => (max === 'no' ? 'no' : max === 'propio' && v === 'todo' ? 'propio' : v)
  return {
    ...p,
    'agenda.editar': tope(p['agenda.editar'], p['agenda.ver']),
    'clientes.contacto': p['clientes.ver'] === 'no' ? 'no' : p['clientes.contacto'],
    'ganancias.liquidar': p['ganancias.ver'] === 'todo' ? p['ganancias.liquidar'] : 'no',
  }
}

/** Qué alcances de un permiso están trabados por otro, y por qué. */
export function trabaDe(id: PermisoId, p: Permisos, r: RubroTurnos): { alcances: Alcance[]; motivo: string } | null {
  if (id === 'agenda.editar') {
    if (p['agenda.ver'] === 'no') return { alcances: ['propio', 'todo'], motivo: 'Primero tiene que poder ver la agenda.' }
    if (p['agenda.ver'] === 'propio') return { alcances: ['todo'], motivo: 'Ve solo su agenda: no puede cambiar la de otros.' }
  }
  if (id === 'clientes.contacto' && p['clientes.ver'] === 'no') return { alcances: ['todo'], motivo: `Primero tiene que poder ver ${clientesTxt(r)}.` }
  if (id === 'ganancias.liquidar' && p['ganancias.ver'] !== 'todo') return { alcances: ['todo'], motivo: 'Primero tiene que ver las ganancias de todos.' }
  return null
}

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
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export interface Rol {
  id: string
  nombre: string
  descripcion: string
  /** Viene con el rubro: se puede ajustar y volver a como venía. Los que crea el dueño, no. */
  deFabrica: boolean
  /** El del dueño: puede todo, no se cambia ni se borra. */
  fijo?: boolean
  /** Quien tiene este rol atiende turnos (o da clases): tiene agenda propia. */
  atiende: boolean
  permisos: Permisos
}

type RolExtra = [id: string, nombre: string, descripcion: string, base: keyof typeof BASE, atiende: boolean]

// Lo propio de cada rubro, además de Dueño, Encargado, Recepción y quien atiende.
const EXTRAS: Record<string, RolExtra[]> = {
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
}

/** Los roles con los que arranca un negocio de ese rubro. */
export function rolesDe(r: RubroTurnos): Rol[] {
  const c = clientesTxt(r)
  const salud = esSalud(r)
  const dueno: Rol = { id: 'dueno', nombre: 'Dueño/a', descripcion: 'Ve y puede todo. Es la cuenta con la que se creó el negocio.', deFabrica: true, fijo: true, atiende: r.modo === 'profesional', permisos: TODO }

  // Un complejo de canchas no tiene "profesionales": tiene gente que abre, cobra y mantiene.
  if (r.modo === 'cancha') {
    return [
      dueno,
      { id: 'encargado', nombre: 'Encargado/a de turno', descripcion: 'Abre el complejo, entrega las canchas, toma reservas y cobra. No toca la configuración ni ve ganancias.', deFabrica: true, atiende: false, permisos: BASE.recepcion },
      { id: 'cantina', nombre: 'Cantina y caja', descripcion: 'Atiende la cantina y cobra. Ve las reservas del día para saber quién llega.', deFabrica: true, atiende: false, permisos: BASE.caja },
      { id: 'mantenimiento', nombre: 'Mantenimiento', descripcion: 'Cuida las canchas. Ve qué canchas están ocupadas y cuándo; nada más.', deFabrica: true, atiende: false, permisos: BASE.asistente },
      { id: 'administracion', nombre: 'Administración', descripcion: 'Lleva los números: ve lo que se factura y liquida los sueldos. No toma reservas.', deFabrica: true, atiende: false, permisos: BASE.administracion },
    ]
  }

  const queAtiende = r.modo === 'cupo' ? 'da sus clases' : 'atiende'
  const roles: Rol[] = [
    dueno,
    { id: 'encargado', nombre: 'Encargado/a', descripcion: 'Maneja el día a día cuando no estás: agenda, equipo y caja. No toca el sitio ni la suscripción.', deFabrica: true, atiende: false, permisos: BASE.encargado },
    {
      id: 'recepcion', nombre: salud ? 'Secretaría' : 'Recepción', deFabrica: true, atiende: false, permisos: BASE.recepcion,
      descripcion: salud ? 'Da los turnos, recibe a los pacientes y cobra. No ve ganancias ni cambia la configuración.' : `Atiende el mostrador y el teléfono: da turnos, recibe a los ${c} y cobra. No ve ganancias.`,
    },
    {
      id: 'profesional', nombre: r.profesional, deFabrica: true, atiende: true, permisos: salud ? BASE.atiendeSalud : BASE.atiende,
      descripcion: `Entra a su panel y ${queAtiende}: ve su agenda, sus ${c} y lo que le corresponde cobrar. No ve lo del resto.`,
    },
    ...(EXTRAS[r.key] ?? []).map(([id, nombre, descripcion, base, atiende]): Rol => ({ id, nombre, descripcion, deFabrica: true, atiende, permisos: BASE[base] })),
  ]
  if (salud) roles.push({ id: 'administracion', nombre: 'Administración', descripcion: 'Factura a las obras sociales y cierra la caja. Ve los números; no da turnos.', deFabrica: true, atiende: false, permisos: BASE.administracion })
  return roles
}

/** Lo que puede un rol, en frases cortas (para la tarjeta del rol). */
export function resumenRol(rol: Rol, r: RubroTurnos): string[] {
  const p = rol.permisos
  const c = clientesTxt(r)
  if (rol.fijo) return ['Toda la agenda', `Todos los ${c}`, 'Ganancias y pagos', 'Equipo y configuración']
  const out: string[] = []
  if (p['agenda.ver'] !== 'no') out.push(`${p['agenda.ver'] === 'todo' ? 'Toda la agenda' : 'Solo su agenda'}${p['agenda.editar'] === 'no' ? ', sin cambiarla' : ''}`)
  if (p['clientes.ver'] !== 'no') out.push(`${p['clientes.ver'] === 'todo' ? `Todos los ${c}` : `Sus ${c}`}${p['clientes.contacto'] === 'no' ? ', sin teléfonos' : ''}`)
  if (p['caja.cobrar'] !== 'no') out.push('Cobra')
  out.push(p['ganancias.ver'] === 'todo' ? `Ve las ganancias de todos${p['ganancias.liquidar'] !== 'no' ? ' y liquida' : ''}` : p['ganancias.ver'] === 'propio' ? 'Ve lo que le corresponde' : 'No ve ganancias')
  if (p['equipo.editar'] !== 'no') out.push('Maneja el equipo')
  if (p['config.editar'] !== 'no') out.push('Configura el negocio')
  return out
}

/** Cómo viene de fábrica un rol del rubro (para "volver a como venía"). null si lo creó el dueño. */
export const rolDeFabrica = (id: string, r: RubroTurnos): Rol | null => rolesDe(r).find(x => x.id === id) ?? null

/** Un rol de fábrica ¿se cambió? (compara con cómo viene para ese rubro). */
export function rolCambiado(rol: Rol, r: RubroTurnos): boolean {
  const original = rolDeFabrica(rol.id, r)
  return !!original && (original.nombre !== rol.nombre || original.descripcion !== rol.descripcion || original.atiende !== rol.atiende || JSON.stringify(original.permisos) !== JSON.stringify(rol.permisos))
}

// ─── Cómo cobra cada uno ─────────────────────────────────────────────────────

export type FormaPago = 'comision' | 'sueldo' | 'mixto' | 'alquiler' | 'clase'
export type Cada = 'semana' | 'quincena' | 'mes'

export interface Pago {
  forma: FormaPago
  /** % de cada turno que atiende. */
  comision: number
  /** Fijo por mes. */
  sueldo: number
  /** Lo que la persona le paga al negocio por mes para usar el sillón o el consultorio. */
  alquiler: number
  /** Monto por cada clase que da. */
  porClase: number
  /** Cada cuánto se le liquida. */
  cada: Cada
}

export const PAGO_INICIAL: Pago = { forma: 'comision', comision: 50, sueldo: 0, alquiler: 0, porClase: 0, cada: 'semana' }
export const CADA_TXT: Record<Cada, string> = { semana: 'por semana', quincena: 'por quincena', mes: 'por mes' }

/** Qué alquila quien alquila, según el rubro: "el sillón", "el consultorio". */
export function lugarAlquiler(r: RubroTurnos) {
  if (esSalud(r)) return 'el consultorio'
  if (['barberia', 'peluqueria', 'estilista', 'maquillaje'].includes(r.key)) return 'el sillón'
  if (['unas', 'pestanas'].includes(r.key)) return 'la mesa'
  if (r.familia === 'belleza') return 'la cabina'
  return 'el espacio'
}

/** Las formas de pago que tienen sentido en el rubro. "Por clase" solo donde hay clases; comisión y alquiler, donde se cobra por turno. */
export function formasDe(r: RubroTurnos): { id: FormaPago; label: string; ayuda: string }[] {
  const porTurno = r.modo === 'profesional' || r.modo === 'recurso'
  return [
    ...(porTurno ? [{ id: 'comision' as const, label: 'Comisión', ayuda: 'Un porcentaje de cada turno que atiende. Si no atiende, no cobra.' }] : []),
    { id: 'sueldo' as const, label: 'Sueldo fijo', ayuda: 'Lo mismo todos los meses, atienda lo que atienda.' },
    ...(porTurno ? [{ id: 'mixto' as const, label: 'Sueldo + comisión', ayuda: 'Un fijo más chico y, encima, un porcentaje de lo que atiende.' }] : []),
    ...(porTurno ? [{ id: 'alquiler' as const, label: `Alquila ${lugarAlquiler(r)}`, ayuda: 'Se queda con lo que factura y te paga un fijo por mes.' }] : []),
    ...(r.modo === 'cupo' ? [{ id: 'clase' as const, label: 'Por clase', ayuda: 'Un monto fijo por cada clase que da.' }] : []),
  ]
}

/** La forma de pago con la que arranca alguien nuevo en ese rubro. */
export const pagoInicialDe = (r: RubroTurnos): Pago =>
  r.modo === 'cupo' ? { ...PAGO_INICIAL, forma: 'clase', porClase: 9000, cada: 'mes' }
    : r.modo === 'cancha' ? { ...PAGO_INICIAL, forma: 'sueldo', sueldo: 480000, cada: 'mes' }
      : PAGO_INICIAL

export const plata = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('es-AR')}`

/** La forma de pago, en una frase. */
export function pagoTxt(p: Pago | null, r: RubroTurnos): string {
  if (!p) return 'Es el dueño: no se liquida'
  if (p.forma === 'comision') return `Comisión del ${p.comision}%`
  if (p.forma === 'sueldo') return `Sueldo de ${plata(p.sueldo)}`
  if (p.forma === 'mixto') return `Sueldo de ${plata(p.sueldo)} + ${p.comision}%`
  if (p.forma === 'alquiler') return `Alquila ${lugarAlquiler(r)}: ${plata(p.alquiler)}`
  return `${plata(p.porClase)} por clase`
}
/** La forma, en una o dos palabras (para el chip). */
export const formaCorta = (p: Pago | null): string =>
  !p ? 'Dueño' : p.forma === 'comision' ? `Comisión ${p.comision}%` : p.forma === 'sueldo' ? 'Sueldo fijo' : p.forma === 'mixto' ? `Sueldo + ${p.comision}%` : p.forma === 'alquiler' ? 'Alquila' : 'Por clase'

// ─── Personas ────────────────────────────────────────────────────────────────

export interface Persona {
  id: string
  nombre: string
  rolId: string
  email: string
  telefono: string
  color: string
  /** Su columna en la agenda (rubros por profesional) o la cabina donde atiende. */
  recursoId?: string
  /** null = el dueño: lo que factura queda para el negocio. */
  pago: Pago | null
  /** Se la invitó y todavía no entró. */
  pendiente?: boolean
}

export const COLORES_EQUIPO = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444']

const mail = (nombre: string, dominio: string) => `${nombre.split(' ')[0].normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}@${dominio}`

/** El equipo de ejemplo del rubro. `dominio` arma los mails ("lucia@estudionorte.com.ar"). */
export function personasDe(r: RubroTurnos, recursos: Recurso[], dominio: string): Persona[] {
  const p = (id: string, nombre: string, rolId: string, color: string, pago: Pago | null, recursoId?: string): Persona =>
    ({ id, nombre, rolId, email: mail(nombre, dominio), telefono: '', color, pago, ...(recursoId ? { recursoId } : {}) })
  const pago = (forma: FormaPago, v: Partial<Pago>): Pago => ({ ...PAGO_INICIAL, forma, ...v })
  const [c0, c1, c2, c3, c4] = COLORES_EQUIPO

  if (r.modo === 'profesional') {
    const [a, b, c] = recursos
    // El tercero cobra distinto según el rubro: aprendiz con un fijo, o alquila su consultorio.
    const tercero = !c ? [] : [
      EXTRAS[r.key]?.some(x => x[0] === 'aprendiz') ? p('p3', c.nombre, 'aprendiz', c.color, pago('mixto', { sueldo: 160000, comision: 15, cada: 'mes' }), c.id)
        : esSalud(r) ? p('p3', c.nombre, 'profesional', c.color, pago('alquiler', { alquiler: 260000, cada: 'mes' }), c.id)
          : p('p3', c.nombre, 'profesional', c.color, pago('comision', { comision: 40, cada: 'quincena' }), c.id),
    ]
    return [
      ...(a ? [p('p1', a.nombre, 'dueno', a.color, null, a.id)] : []),
      ...(b ? [p('p2', b.nombre, 'profesional', b.color, pago('comision', { comision: 50, cada: 'semana' }), b.id)] : []),
      ...tercero,
      p('p4', 'Caro Gómez', 'recepcion', c3, pago('sueldo', { sueldo: 520000, cada: 'mes' })),
    ]
  }
  if (r.modo === 'recurso') {
    return [
      p('p1', 'Carla Méndez', 'dueno', c0, null),
      p('p2', 'Lucía Benítez', 'profesional', c1, pago('comision', { comision: 45, cada: 'semana' }), recursos[0]?.id),
      p('p3', 'Julieta Sosa', 'profesional', c2, pago('mixto', { sueldo: 300000, comision: 25, cada: 'mes' }), recursos[1]?.id),
      p('p4', 'Paula Ortiz', 'recepcion', c3, pago('sueldo', { sueldo: 520000, cada: 'mes' })),
    ]
  }
  if (r.modo === 'cancha') {
    return [
      p('p1', 'Nico Ríos', 'dueno', c0, null),
      p('p2', 'Caro Gómez', 'encargado', c1, pago('sueldo', { sueldo: 560000, cada: 'mes' })),
      p('p3', 'Seba López', 'cantina', c2, pago('sueldo', { sueldo: 480000, cada: 'mes' })),
      p('p4', 'Flor Díaz', 'mantenimiento', c3, pago('sueldo', { sueldo: 450000, cada: 'mes' })),
    ]
  }
  // Clases con cupo: los nombres de pila son los de la grilla de clases (clasesDe).
  return [
    p('p1', 'Nico Ríos', 'dueno', c0, null),
    p('p2', 'Caro Gómez', 'profesional', c1, pago('clase', { porClase: 9000, cada: 'mes' })),
    p('p3', 'Flor Díaz', 'profesional', c2, pago('clase', { porClase: 9000, cada: 'quincena' })),
    p('p4', 'Seba López', 'profesional', c3, pago('sueldo', { sueldo: 540000, cada: 'mes' })),
    p('p5', 'Mica Torres', 'recepcion', c4, pago('sueldo', { sueldo: 500000, cada: 'mes' })),
  ]
}

// ─── Ganancias ───────────────────────────────────────────────────────────────

export type Periodo = 'hoy' | 'semana' | 'mes' | 'anterior'

/** Cada período, como días contados desde hoy (sábado 26/09): [desde, hasta]. */
export const RANGO: Record<Periodo, [number, number]> = {
  hoy: [0, 0],
  semana: [-5, 0],      // del lunes 21 a hoy
  mes: [-25, 0],        // del 1 de septiembre a hoy
  anterior: [-56, -26], // agosto entero
}
export const PERIODO_LABEL: Record<Periodo, string> = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', anterior: 'Mes pasado' }

const mesDe = (f: Date) => f.toLocaleDateString('es-AR', { month: 'long' })
/** "Del 21 al 26 de septiembre", "Del 28 de septiembre al 3 de octubre". */
export function entreTxt(desde: number, hasta: number): string {
  if (desde === hasta) return fechaLarga(desde)
  const a = fechaDe(desde), b = fechaDe(hasta)
  return a.getMonth() === b.getMonth() ? `Del ${a.getDate()} al ${b.getDate()} de ${mesDe(b)}` : `Del ${a.getDate()} de ${mesDe(a)} al ${b.getDate()} de ${mesDe(b)}`
}
export const periodoTxt = (p: Periodo) => entreTxt(...RANGO[p])

/** Los días que tiene el mes en el que cae ese día: un sueldo mensual se reparte entre todos. */
const diasDelMes = (dia: number) => { const f = fechaDe(dia); return new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate() }

export interface Renglon { dia: number; inicio: number; clienteId: string; servicio: string; precio: number; /** Lo que le toca a la persona de ese turno. */ parte: number }

export interface Liquidacion {
  desde: number
  hasta: number
  /** Turnos atendidos de su agenda. */
  turnos: number
  /** Clases que dio (donde hay clases con cupo). */
  clases: number
  /** Lo que se cobró por los turnos que atendió. */
  facturado: number
  comision: number
  /** La parte del sueldo que corresponde a los días del período. */
  fijo: number
  porClases: number
  /** Lo que le paga al negocio por el alquiler en el período. */
  alquiler: number
  /** Lo que se lleva la persona. */
  paraLaPersona: number
  /** Lo que le deja al negocio. Puede ser negativo: un sueldo sin turnos propios. */
  paraElNegocio: number
  renglones: Renglon[]
}

const VACIA: Omit<Liquidacion, 'desde' | 'hasta'> = { turnos: 0, clases: 0, facturado: 0, comision: 0, fijo: 0, porClases: 0, alquiler: 0, paraLaPersona: 0, paraElNegocio: 0, renglones: [] }

/**
 * Lo que le corresponde a una persona entre dos días (contados desde hoy), según
 * cómo cobra. Cuenta los turnos ATENDIDOS de su agenda (los cancelados y las
 * ausencias no suman) y las clases que dio. El sueldo y el alquiler son
 * mensuales: se llevan la parte de los días que entran en el rango.
 */
export function liquidarEntre(persona: Persona, desde: number, hasta: number, turnosDelDia: (dia: number) => TurnoAgenda[], clases: ClasePanel[]): Liquidacion {
  if (hasta < desde) return { desde, hasta, ...VACIA }
  const p = persona.pago
  const pct = !p ? 0 : p.forma === 'comision' || p.forma === 'mixto' ? p.comision : p.forma === 'alquiler' ? 100 : 0
  const pila = persona.nombre.split(' ')[0]
  const renglones: Renglon[] = []
  let dadas = 0, fijo = 0, alquiler = 0
  for (let d = desde; d <= hasta; d++) {
    if (p && (p.forma === 'sueldo' || p.forma === 'mixto')) fijo += p.sueldo / diasDelMes(d)
    if (p?.forma === 'alquiler') alquiler += p.alquiler / diasDelMes(d)
    if (persona.recursoId) {
      for (const t of turnosDelDia(d)) {
        if (t.recursoId !== persona.recursoId || t.estado !== 'completado') continue
        renglones.push({ dia: d, inicio: t.inicio, clienteId: t.clienteId, servicio: t.servicio, precio: t.precio, parte: Math.round(t.precio * pct / 100) })
      }
    }
    if (d <= 0) {
      const semana = indiceDia(d)
      dadas += clases.filter(c => c.dia === semana && c.profe === pila && (d < 0 || c.inicio + c.duracion <= AHORA_DEMO)).length
    }
  }
  renglones.sort((a, b) => b.dia - a.dia || b.inicio - a.inicio)
  fijo = Math.round(fijo)
  alquiler = Math.round(alquiler)
  const facturado = renglones.reduce((s, x) => s + x.precio, 0)
  const comision = p && (p.forma === 'comision' || p.forma === 'mixto') ? renglones.reduce((s, x) => s + x.parte, 0) : 0
  const porClases = p?.forma === 'clase' ? dadas * p.porClase : 0
  const paraLaPersona = !p ? 0 : p.forma === 'alquiler' ? facturado - alquiler : comision + fijo + porClases
  return { desde, hasta, turnos: renglones.length, clases: dadas, facturado, comision, fijo, porClases, alquiler, paraLaPersona, paraElNegocio: facturado - paraLaPersona, renglones }
}

export const liquidar = (persona: Persona, periodo: Periodo, turnosDelDia: (dia: number) => TurnoAgenda[], clases: ClasePanel[]) =>
  liquidarEntre(persona, RANGO[periodo][0], RANGO[periodo][1], turnosDelDia, clases)

/**
 * Hasta qué día (contado desde hoy) se le pagó a alguien cuando arranca la demo:
 * el último cierre según cada cuánto cobra. Por semana, el domingo 20; por
 * quincena, el 15; por mes, el 31 de agosto. De ahí en adelante está pendiente.
 */
export const pagadoHastaInicial = (p: Persona): number => (p.pago?.cada === 'semana' ? -6 : p.pago?.cada === 'quincena' ? -11 : -26)

/** La plata que se mueve entre el negocio y la persona: el negocio le paga (comisión, sueldo, clases) o ella le paga el alquiler. */
export const aPagar = (persona: Persona, l: Liquidacion) => (!persona.pago || persona.pago.forma === 'alquiler' ? 0 : l.paraLaPersona)
export const aCobrar = (persona: Persona, l: Liquidacion) => (persona.pago?.forma === 'alquiler' ? l.alquiler : 0)

/** Todo lo que se facturó entre dos días: los turnos atendidos de todas las agendas. */
export function facturadoEntre(desde: number, hasta: number, turnosDelDia: (dia: number) => TurnoAgenda[]) {
  let total = 0, turnos = 0
  for (let d = desde; d <= hasta; d++) for (const t of turnosDelDia(d)) if (t.estado === 'completado') { total += t.precio; turnos++ }
  return { total, turnos }
}

/** A quiénes atendió una persona (para "ve solo sus clientes"): los de su agenda, de la semana pasada a las dos que vienen. */
export function clientesDeLaAgenda(recursoId: string | undefined, turnosDelDia: (dia: number) => TurnoAgenda[]): Set<string> {
  const ids = new Set<string>()
  if (!recursoId) return ids
  for (let d = -7; d <= 14; d++) for (const t of turnosDelDia(d)) if (t.recursoId === recursoId) ids.add(t.clienteId)
  return ids
}

// ─── Con qué rol se mira el panel ────────────────────────────────────────────

/** "Ver el panel como…": una persona del equipo, o un rol sin nadie en particular. */
export interface VerComo { rolId: string; personaId?: string }

/** Lo que puede quien está mirando el panel. Sin `como` es el dueño: todo. */
export function puedeDe(como: VerComo | null, roles: Rol[]): (id: PermisoId) => Alcance {
  const rol = como ? roles.find(r => r.id === como.rolId) : null
  return id => (rol ? rol.permisos[id] ?? 'no' : 'todo')
}

/** El teléfono con los números tapados (quedan los dos últimos): para quien no puede ver cómo contactar. */
export const taparTelefono = (telefono: string) => telefono.replace(/\d(?=(?:\D*\d){2})/g, '•')

/** Lo que el panel le pasa a Configuración → Equipo y permisos: los mismos roles y personas de la pantalla Equipo. */
export interface EquipoConfig {
  roles: Rol[]
  personas: Persona[]
  onGuardarRol: (r: Rol) => void
  onBorrarRol: (id: string) => void
  onVerComo: (c: VerComo) => void
  onIrEquipo: () => void
}
