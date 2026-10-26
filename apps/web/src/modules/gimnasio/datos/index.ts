// Capa de datos de ejemplo de Gimnasio (demo local).
//
// Gimnasio no tiene backend: todo lo que ven las pantallas de /gimnasio-demo
// sale de esta carpeta y vive en memoria o en el navegador. La forma de cada
// cosa (negocio, actividad, clase, plan, socio, inscripción) es la que tendría
// la API: el día que exista, cambia el adaptador y no las pantallas.
//
//   index.ts    tipos, los ocho rubros con sus actividades, profes y planes, y el negocio de ejemplo de cada uno
//   negocio.ts  lo que cambió el dueño y lo que reservaron los socios, en el navegador
//
// Todos los rubros comparten el mismo motor: una grilla semanal de clases con
// cupo, profe y sala; pases y planes (prueba, suelta, pack, membresía); socios
// con su plan y su asistencia; check-in; y lista de espera que avanza sola.
import type { LucideIcon } from 'lucide-react'
import { Dumbbell, Flame, Activity, Flower2, Music, Swords, Waves, Presentation } from 'lucide-react'
import { diaSemana, diasEntre, sumarDias, type ISO } from '@/lib/reservas/fechas'

// ─── El "hoy" de la demo ─────────────────────────────────────────────────────
// Sábado 14/11/2026 a las 10:40, fijo.
export const HOY: ISO = '2026-11-14'
export const AHORA = 10 * 60 + 40

// ─── Rubros ──────────────────────────────────────────────────────────────────

export interface ActividadTipo { nombre: string; duracion: number; cupo: number }
export interface PlanTipo { tipo: TipoPlan; nombre: string; precio: number; clases?: number; porSemana?: number }

export interface RubroGym {
  key: string
  label: string
  descripcion: string
  Icon: LucideIcon
  /** Cómo se llama a quien da la clase y a quien viene. */
  profe: string
  socio: string
  socios: string
  actividades: ActividadTipo[]
  salas: string[]
  profes: string[]
  planes: PlanTipo[]
  fotos: string[]
  /** El nombre del negocio de ejemplo. */
  negocio: string
  tagline: string
}

const DEP = (n: string) => `/plantillas/dep-${n}.jpg`
const FOTOS_GYM = [DEP('pesas'), DEP('press'), DEP('sentadilla'), DEP('abdominales'), DEP('bici')]
const FOTOS_YOGA = ['/turnos/dep-yoga.jpg', DEP('estirar'), '/turnos/dep-hero.jpg']
const FOTOS_BOX = ['/turnos/dep-barra.jpg', '/turnos/dep-soga.jpg', DEP('sentadilla'), DEP('correr')]

const PLANES_CLASES: PlanTipo[] = [
  { tipo: 'prueba', nombre: 'Clase de prueba', precio: 0 },
  { tipo: 'suelta', nombre: 'Clase suelta', precio: 9000 },
  { tipo: 'pack', nombre: 'Pack de 8 clases', precio: 56000, clases: 8 },
  { tipo: 'membresia', nombre: '2 veces por semana', precio: 48000, porSemana: 2 },
  { tipo: 'membresia', nombre: '3 veces por semana', precio: 62000, porSemana: 3 },
  { tipo: 'membresia', nombre: 'Pase libre', precio: 78000, porSemana: 0 },
]

export const RUBROS_GYM: RubroGym[] = [
  { key: 'gym', label: 'Gimnasio', descripcion: 'Musculación, clases y membresías', Icon: Dumbbell, profe: 'Profe', socio: 'Socio', socios: 'Socios', negocio: 'Gimnasio Vital', tagline: 'Entrená a tu ritmo, con tu plan.',
    actividades: [{ nombre: 'Musculación', duracion: 60, cupo: 25 }, { nombre: 'Spinning', duracion: 45, cupo: 14 }, { nombre: 'Localizada', duracion: 60, cupo: 20 }, { nombre: 'Zumba', duracion: 60, cupo: 20 }],
    salas: ['Salón principal', 'Sala de spinning'], profes: ['Caro', 'Nico', 'Flor', 'Seba'], fotos: FOTOS_GYM,
    planes: [{ tipo: 'prueba', nombre: 'Pase de prueba', precio: 0 }, { tipo: 'suelta', nombre: 'Pase diario', precio: 6000 }, { tipo: 'pack', nombre: 'Pack de 10 pases', precio: 45000, clases: 10 }, { tipo: 'membresia', nombre: '3 veces por semana', precio: 42000, porSemana: 3 }, { tipo: 'membresia', nombre: 'Pase libre', precio: 55000, porSemana: 0 }] },
  { key: 'crossfit', label: 'Crossfit', descripcion: 'WODs con cupo por horario', Icon: Flame, profe: 'Coach', socio: 'Atleta', socios: 'Atletas', negocio: 'Box Norte', tagline: 'Un WOD por día, un cupo por persona.',
    actividades: [{ nombre: 'WOD', duracion: 60, cupo: 12 }, { nombre: 'Open box', duracion: 90, cupo: 10 }, { nombre: 'Halterofilia', duracion: 60, cupo: 8 }, { nombre: 'Gymnastics', duracion: 60, cupo: 10 }],
    salas: ['Box'], profes: ['Nico', 'Seba', 'Caro'], fotos: FOTOS_BOX,
    planes: [{ tipo: 'prueba', nombre: 'WOD de prueba', precio: 0 }, { tipo: 'suelta', nombre: 'Clase suelta', precio: 10000 }, { tipo: 'pack', nombre: 'Pack de 8 WODs', precio: 64000, clases: 8 }, { tipo: 'membresia', nombre: '3 veces por semana', precio: 68000, porSemana: 3 }, { tipo: 'membresia', nombre: 'Ilimitado', precio: 85000, porSemana: 0 }] },
  { key: 'funcional', label: 'Entrenamiento funcional', descripcion: 'Grupos reducidos', Icon: Activity, profe: 'Entrenador/a', socio: 'Alumno/a', socios: 'Alumnos', negocio: 'Funcional Costanera', tagline: 'Grupos chicos, seguimiento de verdad.',
    actividades: [{ nombre: 'Funcional', duracion: 60, cupo: 10 }, { nombre: 'HIIT', duracion: 45, cupo: 10 }, { nombre: 'Core y movilidad', duracion: 45, cupo: 12 }],
    salas: ['Sala 1', 'Parque'], profes: ['Flor', 'Seba', 'Nico'], fotos: [DEP('correr'), DEP('estirar'), DEP('abdominales')], planes: PLANES_CLASES },
  { key: 'yoga', label: 'Yoga y pilates', descripcion: 'Clases con cupo y reformers', Icon: Flower2, profe: 'Instructora', socio: 'Alumno/a', socios: 'Alumnos', negocio: 'Espacio Sattva', tagline: 'Respirá, movete, volvé.',
    actividades: [{ nombre: 'Hatha yoga', duracion: 60, cupo: 14 }, { nombre: 'Vinyasa', duracion: 60, cupo: 14 }, { nombre: 'Pilates reformer', duracion: 50, cupo: 6 }, { nombre: 'Yin yoga', duracion: 75, cupo: 12 }],
    salas: ['Sala principal', 'Sala reformer'], profes: ['Caro', 'Flor', 'Mica'], fotos: FOTOS_YOGA, planes: PLANES_CLASES.map(p => (p.tipo === 'suelta' ? { ...p, precio: 12000 } : p)) },
  { key: 'danza', label: 'Danza y baile', descripcion: 'Estilos, niveles y cupos', Icon: Music, profe: 'Profe', socio: 'Alumno/a', socios: 'Alumnos', negocio: 'Estudio Compás', tagline: 'Un estilo para cada cuerpo.',
    actividades: [{ nombre: 'Salsa inicial', duracion: 60, cupo: 16 }, { nombre: 'Tango', duracion: 90, cupo: 14 }, { nombre: 'Ritmos urbanos', duracion: 60, cupo: 18 }, { nombre: 'Contemporáneo', duracion: 75, cupo: 12 }],
    salas: ['Salón A', 'Salón B'], profes: ['Mica', 'Nico', 'Flor'], fotos: [DEP('estirar'), '/turnos/dep-hero.jpg', DEP('correr')], planes: PLANES_CLASES.map(p => (p.tipo === 'suelta' ? { ...p, precio: 10000 } : p)) },
  { key: 'artes-marciales', label: 'Artes marciales', descripcion: 'Disciplinas, grupos y graduaciones', Icon: Swords, profe: 'Sensei', socio: 'Alumno/a', socios: 'Alumnos', negocio: 'Dojo Kaizen', tagline: 'Disciplina, respeto, constancia.',
    actividades: [{ nombre: 'Jiu-jitsu', duracion: 90, cupo: 16 }, { nombre: 'Kickboxing', duracion: 60, cupo: 16 }, { nombre: 'Karate infantil', duracion: 60, cupo: 20 }, { nombre: 'Muay thai', duracion: 60, cupo: 14 }],
    salas: ['Tatami', 'Ring'], profes: ['Seba', 'Nico', 'Caro'], fotos: FOTOS_BOX, planes: PLANES_CLASES },
  { key: 'natacion', label: 'Natación', descripcion: 'Andariveles, clases y pileta libre', Icon: Waves, profe: 'Profe', socio: 'Alumno/a', socios: 'Alumnos', negocio: 'Natatorio Delfín', tagline: 'Del primer chapuzón a la competencia.',
    actividades: [{ nombre: 'Natación adultos', duracion: 45, cupo: 10 }, { nombre: 'Matronatación', duracion: 45, cupo: 8 }, { nombre: 'Pileta libre', duracion: 60, cupo: 16 }, { nombre: 'Aquagym', duracion: 45, cupo: 14 }],
    salas: ['Pileta 25 m', 'Pileta chica'], profes: ['Flor', 'Caro', 'Seba'], fotos: ['/turnos/dep-hero.jpg', DEP('correr'), DEP('estirar')], planes: PLANES_CLASES },
  { key: 'talleres', label: 'Clases grupales y talleres', descripcion: 'Talleres con fecha y cupo', Icon: Presentation, profe: 'Tallerista', socio: 'Participante', socios: 'Participantes', negocio: 'Taller Raíz', tagline: 'Aprender con las manos, en grupo.',
    actividades: [{ nombre: 'Cerámica', duracion: 120, cupo: 8 }, { nombre: 'Cocina', duracion: 150, cupo: 10 }, { nombre: 'Acuarela', duracion: 90, cupo: 10 }, { nombre: 'Huerta urbana', duracion: 90, cupo: 12 }],
    salas: ['Taller', 'Cocina'], profes: ['Mica', 'Caro', 'Flor'], fotos: ['/turnos/cla-hero.jpg', '/turnos/cla-torno.jpg', '/turnos/cla-manos.jpg', '/turnos/cla-vasija.jpg'],
    planes: [{ tipo: 'prueba', nombre: 'Clase abierta', precio: 0 }, { tipo: 'suelta', nombre: 'Clase suelta', precio: 25000 }, { tipo: 'pack', nombre: 'Curso de 4 encuentros', precio: 90000, clases: 4 }, { tipo: 'membresia', nombre: 'Un taller por semana', precio: 80000, porSemana: 1 }] },
]
export const RUBRO_DEFAULT = 'crossfit'
export const rubroPorKey = (key: string) => RUBROS_GYM.find(r => r.key === key) ?? RUBROS_GYM[0]

// ─── El negocio ──────────────────────────────────────────────────────────────

export interface Apertura { dias: number[]; desde: number; hasta: number }
export interface Actividad { id: string; nombre: string; duracion: number; cupo: number; color: string }
export interface Profe { id: string; nombre: string }
/** Una clase de la grilla semanal: se repite todas las semanas el mismo día y a la misma hora. */
export interface ClaseSemanal { id: string; actividadId: string; dia: number; inicio: number; profeId: string; sala: string; cupo: number }

export type TipoPlan = 'prueba' | 'suelta' | 'pack' | 'membresia'
export interface Plan {
  id: string
  tipo: TipoPlan
  nombre: string
  precio: number
  /** Pack: cuántas clases trae. */
  clases?: number
  /** Membresía: clases por semana; 0 = libre. */
  porSemana?: number
  /** Días de vigencia desde la compra. */
  vigenciaDias: number
  /** Se ofrece en el sitio. */
  activo: boolean
}

export interface NegocioGym {
  rubro: string
  nombre: string
  descripcion: string
  telefono: string
  direccion: string
  ciudad: string
  latLng: [number, number]
  slug: string
  logo: string | null
  fotoPortada: string
  galeria: string[]
  apertura: Apertura
  actividades: Actividad[]
  salas: string[]
  profes: Profe[]
  clases: ClaseSemanal[]
  planes: Plan[]
  /** Hasta cuántos días adelante se puede reservar una clase. */
  anticipacionDias: number
  /** Horas antes hasta las que se cancela sin perder la clase. */
  cancelaHastaHoras: number
  /** Minutos antes del inicio desde los que se puede hacer check-in. */
  checkInMin: number
  /** Días en que no hay clases (feriado, cierre, o lo que trajo un calendario externo). */
  bloqueos: BloqueoGym[]
  calendariosExternos: CalendarioExterno[]
}

export interface BloqueoGym {
  id: string
  /** [desde, hasta): el día `hasta` ya hay clases. */
  desde: ISO
  hasta: ISO
  motivo: string
  origen: 'dueno' | 'ical'
}
export interface CalendarioExterno { id: string; nombre: string; url: string; ultimaSync: ISO }

/** Un día sin clases: cae dentro de un bloqueo. */
export const diaBloqueado = (n: NegocioGym, fecha: ISO) => n.bloqueos.find(b => b.desde <= fecha && fecha < b.hasta) ?? null

// ─── Socios e inscripciones ──────────────────────────────────────────────────

export interface Socio {
  id: string
  nombre: string
  telefono: string
  email?: string
  planId: string | null
  /** Desde cuándo y hasta cuándo vale el plan. */
  desde: ISO | null
  vence: ISO | null
  /** Pack: cuántas clases le quedan. null = no aplica (membresía, suelta). */
  clasesRestantes: number | null
  /** Ya usó la clase de prueba. */
  probo: boolean
  nota?: string
  /** Desde cuándo es socio: con eso Ingresos cuenta las renovaciones de antes del plan de ahora. */
  alta?: ISO | null
}

export type EstadoInscripcion = 'reservada' | 'asistio' | 'ausente' | 'cancelada' | 'espera'

export const ESTADO_INSCRIPCION: Record<EstadoInscripcion, { label: string; tono: 'ok' | 'aviso' | 'gris' | 'error' | 'primario' }> = {
  reservada: { label: 'Reservada', tono: 'primario' },
  asistio: { label: 'Asistió', tono: 'ok' },
  ausente: { label: 'Faltó', tono: 'error' },
  cancelada: { label: 'Cancelada', tono: 'gris' },
  espera: { label: 'En espera', tono: 'aviso' },
}

export interface Inscripcion {
  id: string
  claseId: string
  fecha: ISO
  socioId: string
  estado: EstadoInscripcion
  creada: ISO
  /** Con qué se pagó: el plan del socio o una clase suelta. */
  planId: string | null
}

// ─── Negocio de ejemplo de cada rubro ────────────────────────────────────────

const COLORES = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2']
const IGUAZU: [number, number] = [-25.5972, -54.5786]
const slugDe = (n: string) => n.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** A qué hora cae cada clase: [es de la tarde, minutos desde que abre ese turno]. */
const CUANDO: [boolean, number][] = [[false, 0], [false, 90], [false, 180], [true, 0], [true, 75], [true, 150], [true, 225]]

/** La grilla semanal de ejemplo: unas 25 clases repartidas de lunes a sábado, sin pisarse en la misma sala. */
function grillaDe(r: RubroGym, actividades: Actividad[], profes: Profe[], apertura: Apertura): ClaseSemanal[] {
  const out: ClaseSemanal[] = []
  let n = 0
  const medio = 13 * 60
  for (let dia = 0; dia < 7; dia++) {
    if (!apertura.dias.includes(dia)) continue
    for (let k = 0; k < CUANDO.length; k++) {
      if ((dia + k) % 3 === 2 && k !== 3) continue // huecos para que la grilla respire
      if (dia >= 5 && k > 3) continue // el fin de semana se cierra temprano
      const [tarde, en] = CUANDO[k]
      const inicio = (tarde ? Math.max(medio + 4 * 60, apertura.desde) : apertura.desde) + en
      const act = actividades[(dia + k) % actividades.length]
      if (inicio + act.duracion > apertura.hasta) continue
      out.push({ id: `k${n++}`, actividadId: act.id, dia, inicio, profeId: profes[(dia + k) % profes.length].id, sala: r.salas[(dia + k) % r.salas.length], cupo: act.cupo })
    }
  }
  return out
}

export function negocioDe(r: RubroGym): NegocioGym {
  const actividades: Actividad[] = r.actividades.map((a, i) => ({ id: `a${i + 1}`, nombre: a.nombre, duracion: a.duracion, cupo: a.cupo, color: COLORES[i % COLORES.length] }))
  const profes: Profe[] = r.profes.map((p, i) => ({ id: `p${i + 1}`, nombre: p }))
  const apertura: Apertura = { dias: [0, 1, 2, 3, 4, 5], desde: 7 * 60, hasta: 22 * 60 }
  return {
    // Sin repetir la descripción del rubro ("WODs con cupo por horario, con cupo por clase…").
    rubro: r.key, nombre: r.negocio, descripcion: `${r.tagline} Reservá tu lugar en cada clase desde el celular.`,
    telefono: '3757 55-0202', direccion: 'Av. Misiones 310', ciudad: 'Puerto Iguazú', latLng: IGUAZU, slug: slugDe(r.negocio), logo: null,
    fotoPortada: r.fotos[0], galeria: r.fotos, apertura, actividades, salas: r.salas, profes,
    clases: grillaDe(r, actividades, profes, apertura),
    planes: r.planes.map((p, i) => ({ id: `pl${i + 1}`, ...p, vigenciaDias: p.tipo === 'membresia' ? 30 : p.tipo === 'pack' ? 90 : p.tipo === 'suelta' ? 1 : 30, activo: true })),
    anticipacionDias: 14, cancelaHastaHoras: 2, checkInMin: 30,
    bloqueos: [{ id: 'bg1', desde: '2026-11-20', hasta: '2026-11-21', motivo: 'Feriado: Día de la Soberanía', origen: 'dueno' }],
    calendariosExternos: [],
  }
}

const NOMBRES = ['Sofía Ramírez', 'Juan Pérez', 'Valentina Gómez', 'Nicolás Torres', 'Camila López', 'Mateo Díaz', 'Agustina Ruiz', 'Lautaro Castro', 'Brenda Ojeda', 'Ezequiel Funes', 'Rocío Medina', 'Tomás Ferreyra', 'Lucía Benítez', 'Martín Sosa', 'Julieta Sosa', 'Paula Ortiz']

// El resto del plantel. Con los 16 de arriba solos, para llenar unas 25 clases
// por semana cada uno "venía" a dos o tres clases por día: 65 clases en un mes
// con un plan de 3 por semana, y gente sin plan con 50 asistencias. Los nombres
// salen de cruzar estas dos listas (30 × 31: no se repiten hasta 930 socios).
const PILA = ['Abril', 'Bruno', 'Carla', 'Diego', 'Elena', 'Facundo', 'Gabriela', 'Hernán', 'Inés', 'Joaquín', 'Karen', 'Leandro', 'Milagros', 'Nahuel', 'Olivia', 'Pablo', 'Romina', 'Santiago', 'Tamara', 'Ulises', 'Vanesa', 'Walter', 'Ximena', 'Yamila', 'Zoe', 'Gonzalo', 'Micaela', 'Franco', 'Daiana', 'Emiliano']
const APELLIDOS = ['Acosta', 'Barrios', 'Cabrera', 'Domínguez', 'Escobar', 'Figueroa', 'Giménez', 'Herrera', 'Ibarra', 'Juárez', 'Ledesma', 'Molina', 'Núñez', 'Olivera', 'Paz', 'Quiroga', 'Ríos', 'Silva', 'Toledo', 'Vera', 'Zalazar', 'Aguirre', 'Bravo', 'Correa', 'Duarte', 'Ferreira', 'Godoy', 'Luna', 'Méndez', 'Pereyra', 'Romero']
const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Cuántos socios hacen falta para llenar la grilla sin que nadie pase su plan:
 * los lugares de la semana (con un 10 % de aire: no todos usan todas sus
 * clases, y si no las últimas clases del día quedaban vacías) sobre las clases
 * por semana que viene un socio en promedio (tres cuartos con membresía, un
 * quinto con pack, que viene una vez por semana). En un taller de una vez por
 * semana hacen falta más que en un box.
 */
function cuantosSocios(n: NegocioGym): number {
  const membresias = n.planes.filter(p => p.tipo === 'membresia').map(p => p.porSemana || 4)
  const ritmo = 0.75 * (membresias.length ? membresias.reduce((s, x) => s + x, 0) / membresias.length : 2) + 0.2 * 1 + 0.05 * 0.5
  return Math.max(24, Math.min(200, Math.round((n.clases.reduce((s, c) => s + c.cupo, 0) * 1.1) / ritmo)))
}

// Los ids de ejemplo llevan el rubro adelante: los cambios de la demo se
// guardan por id (un check-in, un plan renovado), y con "s1" o "i5" a secas
// un cambio hecho en el box se veía también en el estudio de yoga.

/** El socio con el que se entra en la demo ("Ya tengo plan", Mis clases): el primero, que tiene membresía. */
export const idSocioDemo = (rubro: string) => `${rubro}-s1`

/**
 * Los socios de ejemplo de un negocio. Los 16 primeros cuentan la historia de
 * la demo, con planes en distintos estados: vigentes (dos vencen esta semana),
 * packs a medio usar, vencidos, uno que vino a la de prueba, dos que pagan
 * clase suelta y dos que nunca vinieron. Los demás son el plantel que llena
 * las clases: casi todos con membresía al día, algunos con pack, pocos
 * vencidos o con clase suelta.
 */
export function sociosDe(n: NegocioGym): Socio[] {
  const planes = n.planes
  const membresias = planes.filter(p => p.tipo === 'membresia')
  const pack = planes.find(p => p.tipo === 'pack')
  const prueba = planes.find(p => p.tipo === 'prueba')
  const tel = (i: number) => `3757 55-2${String(100 + i).slice(-3)}`
  const destacados: Socio[] = NOMBRES.map((nombre, i) => {
    const id = `${n.rubro}-s${i + 1}`
    // 0..5: membresía vigente (dos vencen dentro de 7 días); 6..8: pack; 9..10: vencidos; 11: prueba usada; 12..13: clase suelta; 14..15: nunca vinieron.
    if (i < 6 && membresias.length) {
      const plan = membresias[i % membresias.length]
      const vence = sumarDias(HOY, i === 2 ? 3 : i === 4 ? 6 : 10 + i * 4)
      const desde = sumarDias(vence, -30)
      return { id, nombre, telefono: tel(i), email: i % 2 ? `${nombre.split(' ')[0].toLowerCase()}@ejemplo.com` : undefined, planId: plan.id, desde, vence, clasesRestantes: null, probo: true, nota: i === 0 ? 'Viene a la mañana' : undefined, alta: sumarDias(desde, -30 * (1 + i)) }
    }
    if (i < 9 && pack) { const desde = sumarDias(HOY, -20 - i); return { id, nombre, telefono: tel(i), planId: pack.id, desde, vence: sumarDias(desde, pack.vigenciaDias), clasesRestantes: Math.max(1, (pack.clases ?? 8) - (i - 4)), probo: true, alta: desde } }
    if (i < 11 && membresias.length) { const vence = sumarDias(HOY, -(i - 8) * 5); const desde = sumarDias(vence, -30); return { id, nombre, telefono: tel(i), planId: membresias[0].id, desde, vence, clasesRestantes: null, probo: true, nota: i === 9 ? 'Pidió congelar en enero' : undefined, alta: sumarDias(desde, -60) } }
    if (i === 11 && prueba) return { id, nombre, telefono: tel(i), planId: null, desde: null, vence: null, clasesRestantes: null, probo: true, nota: 'Vino a la de prueba, no se anotó', alta: sumarDias(HOY, -12) }
    if (i < 14) return { id, nombre, telefono: tel(i), planId: null, desde: null, vence: null, clasesRestantes: null, probo: true, nota: 'Paga la clase suelta cuando viene', alta: sumarDias(HOY, i === 12 ? -40 : -26) }
    return { id, nombre, telefono: tel(i), planId: null, desde: null, vence: null, clasesRestantes: null, probo: false, alta: null }
  })
  const resto: Socio[] = Array.from({ length: Math.max(0, cuantosSocios(n) - NOMBRES.length) }, (_, j) => {
    const i = NOMBRES.length + j
    const pila = PILA[j % PILA.length]
    const apellido = APELLIDOS[(j * 7) % APELLIDOS.length]
    const base = { id: `${n.rubro}-s${i + 1}`, nombre: `${pila} ${apellido}`, telefono: tel(i), email: j % 3 === 0 ? `${sinTildes(pila)}.${sinTildes(apellido)}@ejemplo.com` : undefined, probo: true }
    const tipo = j % 20
    // Pack: 4 de cada 20, comprado en los últimos dos meses.
    if (tipo >= 13 && tipo <= 16 && pack) {
      const desde = sumarDias(HOY, -((j * 13) % 60))
      return { ...base, planId: pack.id, desde, vence: sumarDias(desde, pack.vigenciaDias), clasesRestantes: Math.max(1, (pack.clases ?? 8) - 1 - (j % 5)), alta: sumarDias(desde, -pack.vigenciaDias * (j % 3)) }
    }
    // Clase suelta: 1 de cada 20.
    if (tipo === 18 || !membresias.length) return { ...base, planId: null, desde: null, vence: null, clasesRestantes: null, alta: sumarDias(HOY, -(20 + (j % 60))) }
    // Membresía: al día (vence entre 8 y 30 días) o, 1 de cada 20, vencida hace poco.
    // (Los vencidos, cada uno con su fecha: con j % 20 caían todos el mismo día.)
    const plan = membresias[(j + Math.floor(j / 20)) % membresias.length]
    const vence = tipo === 17 ? sumarDias(HOY, -(2 + 5 * Math.floor(j / 20))) : sumarDias(HOY, 8 + ((j * 11) % 23))
    const desde = sumarDias(vence, -plan.vigenciaDias)
    return { ...base, planId: plan.id, desde, vence, clasesRestantes: null, alta: sumarDias(desde, -plan.vigenciaDias * (j % 7)) }
  })
  return [...destacados, ...resto]
}

// ─── Inscripciones de ejemplo ────────────────────────────────────────────────
// Patrón fijo (nada de Math.random): las mismas en el servidor y en el
// navegador. Cubren un mes para atrás y dos semanas para adelante. Algunas
// clases quedan llenas, con lista de espera.
//
// Cada socio viene según su plan, en sus días fijos: la membresía de X por
// semana, X clases (la libre, cuatro); el pack, una por semana (le dura los 90
// días); quien paga suelta, una cada dos semanas; quien vino a la de prueba,
// esa sola vez; y nadie más de una clase por día ni fuera de las fechas de su plan.
//
// El socio de la demo (Sofía, con membresía de X por semana) no entra en el
// reparto: ella va a la primera clase de sus días fijos (lunes, miércoles,
// sábado, recortados a su tope); esta semana completa el tope (y hoy está en
// la clase que se puede hacer check-in); las que vienen tiene una menos
// reservada, para que "Ya tengo plan" la deje reservar con su plan.

const PATRON = [3, 7, 1, 9, 4, 8, 2, 6, 5, 0]
const rota = (i: number) => PATRON[((i % PATRON.length) + PATRON.length) % PATRON.length]
const DIAS_DEL_SOCIO_DEMO = [0, 2, 5]
/** Cuánto se llena cada clase: entre la mitad y todo, y a veces se pasa (lista de espera). */
const LLENO = [0.5, 1, 0.7, 1.15, 0.85, 0.6, 1]

/** Cómo viene un socio a clase: cuántas por semana, qué días, entre qué fechas y con qué plan queda anotado. */
interface Ritmo { porSemana: number; dias: number[]; desde: ISO; hasta: ISO; planId: string | null; cadaDosSemanas?: boolean }

/**
 * Los días de la semana en que suele venir: `cuantos` días repartidos entre
 * los que abre el negocio, arrancando en uno distinto para cada socio. Sin
 * días fijos, el reparto gastaba el tope de todos de lunes a jueves y las
 * clases del sábado quedaban vacías.
 */
function diasFijos(n: NegocioGym, i: number, cuantos: number): number[] {
  const abiertos = [...n.apertura.dias].sort((a, b) => a - b)
  if (!abiertos.length) return []
  if (cuantos >= abiertos.length) return abiertos
  // Un hash del índice (y no i * algo): los socios pares e impares tienen planes distintos y caían todos en los mismos días.
  // (Los bits altos: el módulo de un número par conserva la paridad de los bajos.)
  const inicio = (Math.imul(i + 1, 2654435761) >>> 16) % abiertos.length
  return Array.from({ length: cuantos }, (_, k) => abiertos[(inicio + Math.floor((k * abiertos.length) / cuantos)) % abiertos.length])
}

function ritmoDe(n: NegocioGym, s: Socio, i: number): Ritmo | null {
  const plan = planDe(n, s.planId)
  if (plan && s.vence && (plan.tipo === 'membresia' || plan.tipo === 'pack')) {
    const porSemana = plan.tipo === 'pack' ? 1 : plan.porSemana || 4
    return { porSemana, dias: diasFijos(n, i, porSemana), desde: s.alta ?? s.desde ?? s.vence, hasta: s.vence, planId: plan.id }
  }
  // Sin plan pero ya vino: si llegó hace menos de dos semanas, solo tomó la de prueba ese día; si no, viene cada tanto y paga la suelta.
  if (!s.planId && s.probo && s.alta) {
    if (s.alta >= sumarDias(HOY, -14)) return { porSemana: 1, dias: [diaSemana(s.alta)], desde: s.alta, hasta: s.alta, planId: n.planes.find(p => p.tipo === 'prueba')?.id ?? null }
    const suelta = n.planes.find(p => p.tipo === 'suelta')
    return suelta ? { porSemana: 1, dias: diasFijos(n, i, 1), desde: s.alta, hasta: sumarDias(HOY, 14), planId: suelta.id, cadaDosSemanas: true } : null
  }
  return null
}

export function inscripcionesDe(n: NegocioGym, socios: Socio[]): Inscripcion[] {
  const out: Inscripcion[] = []
  let k = 0
  const yo = socios.find(s => s.id === idSocioDemo(n.rubro))
  const ritmos = new Map(socios.map((s, i) => [s.id, ritmoDe(n, s, i)]))
  /** Clases que ya tiene cada socio en cada semana: "socio|lunes". */
  const usadas = new Map<string, number>()
  const planYo = yo ? planDe(n, yo.planId) : null
  const tope = planYo?.tipo === 'membresia' && planYo.porSemana ? planYo.porSemana : 3
  const susDias = DIAS_DEL_SOCIO_DEMO.slice(-Math.min(tope, DIAS_DEL_SOCIO_DEMO.length))
  const finDeEstaSemana = sumarDias(HOY, 6 - diaSemana(HOY))
  /** La clase a la que va el socio de la demo ese día, si va. */
  const suClase = (fecha: ISO, delDia: ClaseSemanal[]) => {
    const dias = fecha > finDeEstaSemana ? susDias.slice(0, tope - 1) : susDias
    if (!yo || !dias.includes(diaSemana(fecha)) || !delDia.length) return null
    const orden = [...delDia].sort((a, b) => a.inicio - b.inicio)
    if (fecha !== HOY) return orden[0]
    // Hoy: la que está abierta para el check-in, así "Mis clases" lo muestra.
    return orden.find(c => c.inicio - n.checkInMin <= AHORA && AHORA < c.inicio + (actividadDe(n, c.actividadId)?.duracion ?? 60)) ?? orden.find(c => c.inicio > AHORA) ?? orden[0]
  }
  const total = socios.length
  for (let d = -30; d <= 14; d++) {
    const fecha = sumarDias(HOY, d)
    const dia = diaSemana(fecha)
    const lunes = sumarDias(fecha, -dia)
    const semanaPar = Math.round(diasEntre(HOY, lunes) / 7) % 2 === 0
    const clasesDelDia = n.clases.filter(c => c.dia === dia)
    const suya = suClase(fecha, clasesDelDia)
    const vinoHoy = new Set<string>()
    clasesDelDia.forEach((c, ci) => {
      const cuantos = Math.round(c.cupo * LLENO[(d * 2 + ci + 100) % 7])
      const pasada = d < 0 || (d === 0 && c.inicio + 60 <= AHORA)
      // Quiénes vienen, en orden de llegada: el socio de la demo primero (si es su clase) y el resto en una
      // rueda que arranca en otro lugar en cada clase, cada uno hasta su tope de la semana.
      const vienen: Socio[] = yo && suya?.id === c.id ? [yo] : []
      // Quien vino a la clase de prueba ese día entra en la primera clase (si no, la rueda podía no llegar a él).
      if (ci === 0) for (const s of socios) { const r = ritmos.get(s.id); if (r && r.desde === fecha && r.hasta === fecha && s !== yo) { vienen.push(s); vinoHoy.add(s.id) } }
      const arranque = (((d * 7 + ci * 13) % total) + total) % total
      for (let j = 0; j < total && vienen.length < cuantos; j++) {
        const s = socios[(arranque + j) % total]
        const r = ritmos.get(s.id)
        if (s === yo || !r || vinoHoy.has(s.id) || !r.dias.includes(dia) || fecha < r.desde || fecha > r.hasta || (r.cadaDosSemanas && !semanaPar)) continue
        const clave = `${s.id}|${lunes}`
        const ya = usadas.get(clave) ?? 0
        if (ya >= r.porSemana) continue
        usadas.set(clave, ya + 1)
        vinoHoy.add(s.id)
        vienen.push(s)
      }
      vienen.forEach((socio, j) => {
        const enEspera = j >= c.cupo
        const estado: EstadoInscripcion = enEspera ? 'espera' : pasada ? (rota(k) === 0 ? 'ausente' : 'asistio') : 'reservada'
        // Se reserva unos días antes, pero nunca después de hoy.
        const creada = sumarDias(fecha, -(1 + rota(k) % 4))
        out.push({ id: `${n.rubro}-i${k++}`, claseId: c.id, fecha, socioId: socio.id, estado, creada: creada > HOY ? HOY : creada, planId: socio === yo ? socio.planId : ritmos.get(socio.id)?.planId ?? socio.planId })
      })
    })
  }
  return out
}

// ─── Lecturas que usan el sitio y el panel ───────────────────────────────────

export const actividadDe = (n: NegocioGym, id: string) => n.actividades.find(a => a.id === id)
export const profeDe = (n: NegocioGym, id: string) => n.profes.find(p => p.id === id)
export const planDe = (n: NegocioGym, id: string | null) => (id ? n.planes.find(p => p.id === id) ?? null : null)
export const socioPorId = (id: string, lista: Socio[]) => lista.find(s => s.id === id)

/** Las clases de un día (fecha), con su actividad y su profe, ordenadas por hora. */
export function clasesDelDia(n: NegocioGym, fecha: ISO) {
  const dia = diaSemana(fecha)
  return n.clases.filter(c => c.dia === dia).sort((a, b) => a.inicio - b.inicio).map(c => ({ ...c, actividad: actividadDe(n, c.actividadId), profe: profeDe(n, c.profeId) }))
}

export interface Cupo { anotados: number; cupo: number; libres: number; espera: number; lleno: boolean }

/** Cuánto se llenó una clase en una fecha: anotados (reservados y asistidos), lugares libres y cuántos esperan. */
export function cupoDe(clase: ClaseSemanal, fecha: ISO, inscripciones: Inscripcion[]): Cupo {
  const suyas = inscripciones.filter(i => i.claseId === clase.id && i.fecha === fecha)
  const anotados = suyas.filter(i => i.estado === 'reservada' || i.estado === 'asistio' || i.estado === 'ausente').length
  const espera = suyas.filter(i => i.estado === 'espera').length
  return { anotados, cupo: clase.cupo, libres: Math.max(0, clase.cupo - anotados), espera, lleno: anotados >= clase.cupo }
}

/** El plan del socio hoy: vigente, por vencer (7 días), vencido, pack agotado o sin plan. */
export type EstadoPlan = 'vigente' | 'por-vencer' | 'vencido' | 'agotado' | 'sin-plan'
export function estadoPlanDe(s: Socio, hoy: ISO = HOY): EstadoPlan {
  if (!s.planId || !s.vence) return 'sin-plan'
  if (s.clasesRestantes !== null && s.clasesRestantes <= 0) return 'agotado'
  if (s.vence < hoy) return 'vencido'
  const dias = (Date.parse(s.vence) - Date.parse(hoy)) / 86_400_000
  return dias <= 7 ? 'por-vencer' : 'vigente'
}
export const ESTADO_PLAN: Record<EstadoPlan, { label: string; tono: 'ok' | 'aviso' | 'error' | 'gris' }> = {
  vigente: { label: 'Al día', tono: 'ok' }, 'por-vencer': { label: 'Vence pronto', tono: 'aviso' }, vencido: { label: 'Vencido', tono: 'error' }, agotado: { label: 'Pack agotado', tono: 'error' }, 'sin-plan': { label: 'Sin plan', tono: 'gris' },
}

/** Cuántas clases reservó o tomó un socio en la semana de una fecha (para el tope de la membresía). */
export function clasesEnLaSemana(socioId: string, fecha: ISO, inscripciones: Inscripcion[]): number {
  const lunes = sumarDias(fecha, -diaSemana(fecha))
  const domingo = sumarDias(lunes, 6)
  return inscripciones.filter(i => i.socioId === socioId && i.fecha >= lunes && i.fecha <= domingo && (i.estado === 'reservada' || i.estado === 'asistio' || i.estado === 'ausente')).length
}

/**
 * El tope semanal de la membresía de un socio en la semana de `fecha`: cuántas
 * clases trae por semana y cuántas ya usó. null si su plan no tiene tope (pase
 * libre, pack, suelta o sin plan).
 */
export function topeSemanal(n: NegocioGym, s: Socio, fecha: ISO, inscripciones: Inscripcion[]): { porSemana: number; usadas: number; lleno: boolean } | null {
  const plan = planDe(n, s.planId)
  if (plan?.tipo !== 'membresia' || !plan.porSemana) return null
  const usadas = clasesEnLaSemana(s.id, fecha, inscripciones)
  return { porSemana: plan.porSemana, usadas, lleno: usadas >= plan.porSemana }
}

// ─── Clase de prueba: una vez por persona ────────────────────────────────────
// La persona se reconoce por el celular (los últimos 8 dígitos: con o sin 0,
// 15 o código de país es el mismo número) o por el email. No alcanza con el
// "ya probó" de un socio: quien vuelve a reservar sin registrarse es un socio
// nuevo para la demo, pero trae el mismo celular.

const ultimos8 = (tel: string) => tel.replace(/\D/g, '').slice(-8)
const emailPlano = (e?: string) => (e ?? '').trim().toLowerCase()

/** Los socios que son esa persona: mismo celular o mismo email. */
export function mismaPersona(socios: Socio[], datos: { telefono: string; email?: string }): Socio[] {
  const tel = ultimos8(datos.telefono)
  const mail = emailPlano(datos.email)
  return socios.filter(s => (tel.length === 8 && ultimos8(s.telefono) === tel) || (!!mail && emailPlano(s.email) === mail))
}

/** Si esa persona ya usó la clase de prueba: algún socio con su celular o su email la tomó (o reservó con el plan de prueba). */
export function yaUsoLaPrueba(n: NegocioGym, socios: Socio[], inscripciones: Inscripcion[], datos: { telefono: string; email?: string }): boolean {
  const prueba = new Set(n.planes.filter(p => p.tipo === 'prueba').map(p => p.id))
  return mismaPersona(socios, datos).some(s => s.probo || inscripciones.some(i => i.socioId === s.id && i.estado !== 'cancelada' && !!i.planId && prueba.has(i.planId)))
}
