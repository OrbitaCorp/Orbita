// Calendario de la reserva. En la demo, "hoy" es el sábado 26/09/2026 a las
// 10:40 (AHORA_DEMO), fijo: así la demo se ve igual cualquier día y no hace
// falta Date.now() en render, que react-compiler prohíbe. En el sitio de un
// negocio real (con la API), "hoy" es el de Argentina: lo fija la reserva al
// cargar (fijarHoy), igual que el reloj del panel (horario.ts).
//
// Una Fecha es { mes, dia } con el mes contado desde enero del año de "hoy":
// 13 es enero del año que viene. Así las fechas se comparan sin año y se pasa
// de un año al otro sin casos especiales.
//
// En la demo, los horarios que se ofrecen salen del horario del negocio y
// cuáles están libres sale de una cuenta determinista, no de una agenda real.
// Con la API, los días y los horarios libres los da la disponibilidad.
import { AHORA, tramosDelDia, type Semana, type Tramo } from '@/modules/turnos/horario'
import { DIAS, DIAS_CORTOS } from '@/modules/turnos/datos'

export interface Fecha { mes: number; dia: number }
export interface Franja { m: number; libre: boolean }

const MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MS_DIA = 86_400_000

/** El año desde el que se cuentan los meses (el de "hoy"). */
let ANIO = 2026
export let HOY: Fecha = { mes: 9, dia: 26 }

/** "Hoy" de un negocio real (AAAA-MM-DD de Argentina), o null para el de la demo. */
export function fijarHoy(hoy: string | null) {
  if (!hoy) { ANIO = 2026; HOY = { mes: 9, dia: 26 }; return }
  const [a, m, d] = hoy.split('-').map(Number)
  ANIO = a
  HOY = { mes: m, dia: d }
}

const real = (f: Fecha) => new Date(ANIO, f.mes - 1, f.dia)
const deReal = (d: Date): Fecha => ({ mes: (d.getFullYear() - ANIO) * 12 + d.getMonth() + 1, dia: d.getDate() })
/** AAAA-MM-DD de una fecha (para la API). */
export const isoDe = (f: Fecha) => { const d = real(f); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** La fecha de un AAAA-MM-DD. */
export const fechaDeIso = (iso: string): Fecha => { const [a, m, d] = iso.split('-').map(Number); return deReal(new Date(a, m - 1, d)) }

export const mismaFecha = (a: Fecha | null, b: Fecha | null) => !!a && !!b && a.mes === b.mes && a.dia === b.dia
export const diaSemana = (f: Fecha) => (real(f).getDay() + 6) % 7
export const esHoy = (f: Fecha) => mismaFecha(f, HOY)
/** Los turnos de atención de ese día (mañana y tarde). Sin ninguno, el negocio está cerrado. */
export const tramosDeFecha = (horarios: Semana, f: Fecha): Tramo[] => tramosDelDia(horarios, diaSemana(f))
export const esCerrado = (horarios: Semana, f: Fecha) => tramosDeFecha(horarios, f).length === 0
/** Días desde hoy (0 = hoy). */
export const enDias = (f: Fecha) => Math.round((real(f).getTime() - real(HOY).getTime()) / MS_DIA)

export const sumarDias = (f: Fecha, n: number): Fecha => { const d = real(f); return deReal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)) }

export const nombreDia = (f: Fecha) => DIAS[diaSemana(f)]
export const nombreDiaCorto = (f: Fecha) => DIAS_CORTOS[diaSemana(f)]
export const mesCorto = (f: Fecha) => MESES_CORTO[real(f).getMonth()]
export const fechaLarga = (f: Fecha) => `${nombreDia(f)} ${real(f).getDate()} de ${MESES_TXT[real(f).getMonth()]}`
/** "hoy", "mañana" o "el martes 29 de septiembre": para armar frases. */
export const fechaRelativa = (f: Fecha) => (esHoy(f) ? 'hoy' : enDias(f) === 1 ? 'mañana' : `el ${fechaLarga(f).toLowerCase()}`)
/** "Hoy", "Mañana" o "Mar 29": para los carteles de "próximo turno libre". */
export const fechaCortaRelativa = (f: Fecha) => (esHoy(f) ? 'Hoy' : enDias(f) === 1 ? 'Mañana' : `${nombreDiaCorto(f)} ${f.dia}`)

/**
 * Todas las franjas del día, las libres y las ya tomadas (para mostrarlas
 * tachadas). Solo dentro de la mañana y de la tarde de ese día: un turno tiene
 * que terminar antes de que el negocio cierre.
 */
export function grillaDel(horarios: Semana, f: Fecha, duracion: number): Franja[] {
  const paso = duracion >= 60 ? 60 : 30
  // El miércoles 30 está completo a propósito: muestra cómo se ve un día sin lugar.
  const completo = f.mes === 9 && f.dia === 30
  const out: Franja[] = []
  for (const [abre, cierra] of tramosDeFecha(horarios, f)) {
    for (let m = abre; m + duracion <= cierra; m += paso) {
      if (esHoy(f) && m < AHORA + 30) continue // lo que ya pasó (o está por empezar) no se ofrece
      out.push({ m, libre: !completo && (Math.floor(m / 30) + f.dia * 3) % 4 !== 1 })
    }
  }
  return out
}

export interface GrupoHoras { nombre: 'Mañana' | 'Tarde' | 'Noche'; desde: number; hasta: number; /** "09:00 a 13:00" si es un turno de atención del negocio. */ rango?: string }

const momento = (m: number): GrupoHoras['nombre'] => (m < 12 * 60 ? 'Mañana' : m < 19 * 60 ? 'Tarde' : 'Noche')
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * Cómo se agrupan los horarios de un día. Por turno de atención (la mañana y la
 * tarde, cada una con su rango) si el día va partido, o si se atiende un solo
 * turno corto (quien viene solo a la tarde). Si se atiende de corrido todo el
 * día, por momento del día.
 */
export function gruposDel(horarios: Semana, f: Fecha): GrupoHoras[] {
  const tramos = tramosDeFecha(horarios, f)
  const unTurno = tramos.length === 1 && tramos[0][1] - tramos[0][0] <= 6 * 60
  if (tramos.length > 1 || unTurno) return tramos.map(([a, b]) => ({ nombre: momento(a), desde: a, hasta: b, rango: `${hhmm(a)} a ${hhmm(b)}` }))
  return [{ nombre: 'Mañana', desde: 0, hasta: 13 * 60 }, { nombre: 'Tarde', desde: 13 * 60, hasta: 18 * 60 }, { nombre: 'Noche', desde: 18 * 60, hasta: 24 * 60 }]
}

export interface DiaAgenda { f: Fecha; grilla: Franja[]; libres: number; cerrado: boolean }

/** Los próximos `cuantos` días, desde hoy, con su disponibilidad. */
export function proximosDias(horarios: Semana, duracion: number, cuantos = 21): DiaAgenda[] {
  return Array.from({ length: cuantos }, (_, i) => {
    const f = sumarDias(HOY, i)
    const grilla = grillaDel(horarios, f, duracion)
    return { f, grilla, libres: grilla.filter(x => x.libre).length, cerrado: esCerrado(horarios, f) }
  })
}

/** El primer horario libre de la agenda: día y hora. */
export function primerLibre(horarios: Semana, duracion: number): { f: Fecha; m: number } | null {
  for (const d of proximosDias(horarios, duracion)) {
    const x = d.grilla.find(g => g.libre)
    if (x) return { f: d.f, m: x.m }
  }
  return null
}
