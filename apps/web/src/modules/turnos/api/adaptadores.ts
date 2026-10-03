// Adaptadores PUROS entre lo que habla la API de Turnos (en inglés, con
// enums de Prisma, instantes ISO y la semana como tramos) y el modelo de las
// pantallas de la demo (en español, con la semana como texto y los días
// contados desde hoy). Las pantallas se escribieron contra la demo: cuando se
// conecten a la API, pasan por acá y no cambian.
//
// Sin React ni reloj: el "ahora" llega por parámetro (el de reloj.ts).
import type { EstadoTurno, Turno } from '@/modules/turnos/datos'
import type { Alcance, Permisos } from '@/modules/turnos/admin/equipoDemo'
import type { BeneficiosCuenta, PoliticaReserva } from '@/modules/turnos/demo/negocioDemo'
import { tramosDe, tramosTxt, type Semana } from '@/modules/turnos/horario'
import { diasEntre, instanteIso, sumarDias, type Ahora, type Fecha } from '@/modules/turnos/reloj'
import {
  PERMISOS_TURNOS,
  type AlcancesTurnos, type AppointmentStatus, type BeneficiosCuenta as BeneficiosCuentaApi, type EstadoVisible,
  type PermisoTurnosId, type PoliticaReserva as PoliticaReservaApi, type ReglasReserva, type SemanaTurnos, type TurnoDto,
} from './tipos'

// ─── Horario semanal ────────────────────────────────────────────────────────

export const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** [[[540, 780], [960, 1200]], …] (7 días, 0 = lunes) → [['Lunes', '09:00 – 13:00 · 16:00 – 20:00'], …]. Día sin tramos → ''. */
export function semanaDeApi(semana: SemanaTurnos): Semana {
  return NOMBRES_DIA.map((nombre, i) => [nombre, tramosTxt([...(semana[i] ?? [])].sort((a, b) => a[0] - b[0]))])
}

/** La inversa: el texto de cada día a tramos. Siempre 7 días; '' (cerrado) → []. */
export function semanaAApi(semana: Semana): SemanaTurnos {
  return NOMBRES_DIA.map((_, i) => tramosDe(semana[i]?.[1]))
}

// ─── Estados ────────────────────────────────────────────────────────────────

const A_DEMO: Record<EstadoVisible, EstadoTurno> = {
  PENDING: 'pendiente',
  CONFIRMED: 'confirmado',
  IN_PROGRESS: 'en-curso',
  COMPLETED: 'completado',
  NO_SHOW: 'ausente',
  CANCELLED: 'cancelado',
}

const A_API: Record<EstadoTurno, AppointmentStatus> = {
  pendiente: 'PENDING',
  confirmado: 'CONFIRMED',
  // "En curso" no se guarda: es un turno confirmado cuyo horario contiene a ahora.
  'en-curso': 'CONFIRMED',
  completado: 'COMPLETED',
  ausente: 'NO_SHOW',
  cancelado: 'CANCELLED',
}

export const estadoDeApi = (estado: EstadoVisible): EstadoTurno => A_DEMO[estado]
export const estadoAApi = (estado: EstadoTurno): AppointmentStatus => A_API[estado]

/**
 * El estado que se muestra, con "en curso" calculado contra el reloj (misma
 * regla que `estadoVisible` de la API). Se recalcula en el front porque el
 * `visibleStatus` que manda la API es el del momento en que respondió.
 */
export function estadoVisible(t: { status: AppointmentStatus; startsAt: string; endsAt: string }, ahora: number): EstadoVisible {
  return t.status === 'CONFIRMED' && instanteIso(t.startsAt) <= ahora && ahora < instanteIso(t.endsAt) ? 'IN_PROGRESS' : t.status
}

// ─── Turnos ─────────────────────────────────────────────────────────────────

/** Un turno de la agenda de la demo: el día va contado desde hoy (0 = hoy, -1 = ayer). */
export type TurnoAgendaApi = Turno & { dia: number }

/**
 * Un turno de la API → el de la agenda de la demo. `dia` sale de la fecha
 * argentina del turno contada desde hoy y `inicio` de sus minutos; el estado se
 * recalcula con el reloj. `precio` es lo que se cobra (total, con descuento).
 */
export function turnoDeApi(t: TurnoDto, ahora: Ahora): TurnoAgendaApi {
  const nota = t.internalNote ?? t.customerNote ?? undefined
  return {
    id: t.id,
    recursoId: t.resourceId,
    clienteId: t.customer.id ?? '',
    servicio: t.serviceName,
    dia: diasEntre(ahora.fecha, t.date),
    inicio: t.startMin,
    duracion: t.durationMin,
    precio: t.total,
    estado: estadoDeApi(estadoVisible(t, ahora.instante)),
    senaPagada: t.depositPaid,
    ...(nota ? { nota } : {}),
  }
}

/** La inversa para moverlo o crearlo: el día contado desde hoy → fecha y minutos de la API. */
export function posicionAApi(t: { dia?: number; inicio: number; recursoId?: string }, hoy: Fecha): { date: Fecha; startMin: number; resourceId?: string } {
  return { date: sumarDias(hoy, t.dia ?? 0), startMin: t.inicio, ...(t.recursoId ? { resourceId: t.recursoId } : {}) }
}

// ─── Valores de configuración ───────────────────────────────────────────────

export type TipoSenaDemo = 'pct' | 'fijo'
export type CobroOnlineDemo = 'sena' | 'total' | 'elige'
export type SenaFueraDePlazoDemo = PoliticaReserva['senaFueraDePlazo']
export type ConfirmacionDemo = 'auto' | 'manual'

const invertir = <A extends string, B extends string>(m: Record<A, B>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<B, A>

const TIPO_SENA: Record<ReglasReserva['depositType'], TipoSenaDemo> = { percent: 'pct', fixed: 'fijo' }
const COBRO_ONLINE: Record<'deposit' | 'total' | 'customer_choice', CobroOnlineDemo> = { deposit: 'sena', total: 'total', customer_choice: 'elige' }
const FUERA_DE_PLAZO: Record<PoliticaReservaApi['depositOutOfWindow'], SenaFueraDePlazoDemo> = { forfeit: 'se-pierde', credit: 'queda-a-favor' }
const CONFIRMACION: Record<ReglasReserva['confirmation'], ConfirmacionDemo> = { auto: 'auto', manual: 'manual' }

export const tipoSenaDeApi = (v: ReglasReserva['depositType']) => TIPO_SENA[v]
export const tipoSenaAApi = (v: TipoSenaDemo) => invertir(TIPO_SENA)[v]
export const cobroOnlineDeApi = (v: keyof typeof COBRO_ONLINE) => COBRO_ONLINE[v]
export const cobroOnlineAApi = (v: CobroOnlineDemo) => invertir(COBRO_ONLINE)[v]
export const fueraDePlazoDeApi = (v: PoliticaReservaApi['depositOutOfWindow']) => FUERA_DE_PLAZO[v]
export const fueraDePlazoAApi = (v: SenaFueraDePlazoDemo) => invertir(FUERA_DE_PLAZO)[v]
export const confirmacionDeApi = (v: ReglasReserva['confirmation']) => CONFIRMACION[v]
export const confirmacionAApi = (v: ConfirmacionDemo) => invertir(CONFIRMACION)[v]

/** La política del sitio (cancelación, seña fuera de plazo, tolerancia). */
export const politicaDeApi = (p: PoliticaReservaApi): PoliticaReserva => ({
  cancelaHasta: p.cancelUntilHours, senaFueraDePlazo: fueraDePlazoDeApi(p.depositOutOfWindow), tolerancia: p.toleranceMin,
})
export const politicaAApi = (p: PoliticaReserva): PoliticaReservaApi => ({
  cancelUntilHours: p.cancelaHasta, depositOutOfWindow: fueraDePlazoAApi(p.senaFueraDePlazo), toleranceMin: p.tolerancia,
})

/** Cuenta del cliente y beneficios. */
export const beneficiosDeApi = (b: BeneficiosCuentaApi): BeneficiosCuenta => ({
  activo: b.accountEnabled, bienvenida: b.welcomeDiscountPercent, sellos: b.loyaltyStamps, promos: b.promosEnabled,
})
export const beneficiosAApi = (b: BeneficiosCuenta): BeneficiosCuentaApi => ({
  accountEnabled: b.activo, welcomeDiscountPercent: b.bienvenida, loyaltyStamps: b.sellos, promosEnabled: b.promos,
})

// ─── Permisos: pares de códigos ↔ alcance ───────────────────────────────────
// Misma regla que apps/api/src/appointments/catalogo/roles.ts: el código base
// da lo propio y `_all` lo extiende a todo; un permiso sin punto medio (cobrar,
// liquidar…) es todo o nada.

const IDS = Object.keys(PERMISOS_TURNOS) as PermisoTurnosId[]

/** El alcance de un permiso según los códigos de un rol. */
export function alcanceDe(codigos: readonly string[], id: PermisoTurnosId): Alcance {
  const p = PERMISOS_TURNOS[id]
  if (!codigos.includes(p.base)) return 'no'
  if (!p.todo) return 'todo'
  return codigos.includes(p.todo) ? 'todo' : 'propio'
}

/** Los códigos de un rol → los permisos de la demo (`Permisos` de equipoDemo). */
export const permisosDeApi = (codigos: readonly string[]): Permisos => Object.fromEntries(IDS.map(id => [id, alcanceDe(codigos, id)])) as AlcancesTurnos

/**
 * Los permisos de la demo → los códigos que se guardan. Aplica antes las
 * dependencias (no se edita la agenda más allá de lo que se ve, no se contacta
 * a quien no se ve, no se liquida sin ver las ganancias de todos).
 */
export function permisosAApi(permisos: Permisos): string[] {
  const tope = (v: Alcance, max: Alcance): Alcance => (max === 'no' ? 'no' : max === 'propio' && v === 'todo' ? 'propio' : v)
  const a: Permisos = {
    ...permisos,
    'agenda.editar': tope(permisos['agenda.editar'], permisos['agenda.ver']),
    'clientes.contacto': permisos['clientes.ver'] === 'no' ? 'no' : permisos['clientes.contacto'],
    'ganancias.liquidar': permisos['ganancias.ver'] === 'todo' ? permisos['ganancias.liquidar'] : 'no',
  }
  return IDS.flatMap(id => {
    const p = PERMISOS_TURNOS[id]
    if (a[id] === 'no') return []
    return a[id] === 'todo' && p.todo ? [p.base, p.todo] : [p.base]
  })
}
