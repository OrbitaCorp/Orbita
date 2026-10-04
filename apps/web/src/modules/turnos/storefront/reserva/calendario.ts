// Calendario de ejemplo de la reserva. "Hoy" es el sábado 26/09/2026 a las
// 10:40 (AHORA_DEMO), fijo: así la demo se ve igual cualquier día y no hace
// falta Date.now() en render, que react-compiler prohíbe.
//
// Los horarios que se ofrecen salen del horario del negocio (el que el dueño
// cargó en el alta o guardó en Configuración → Horarios): cada día tiene su
// mañana y su tarde, y en el corte del mediodía no hay turnos. Cuáles están
// libres y cuáles ocupados sale de una cuenta determinista, no de una agenda real.
import { AHORA_DEMO, tramosDelDia, type Semana, type Tramo } from '@/modules/turnos/horario'
import { DIAS, DIAS_CORTOS, type ClaseCupo } from '@/modules/turnos/datos'

export interface Fecha { mes: number; dia: number }
export interface Franja { m: number; libre: boolean }

export const HOY: Fecha = { mes: 9, dia: 26 }

// primerDia: día de la semana del 1° (0 = lunes). Septiembre 2026 arranca martes; octubre, jueves.
const MESES: Record<number, { nombre: string; corto: string; dias: number; primerDia: number }> = {
  9: { nombre: 'septiembre', corto: 'sep', dias: 30, primerDia: 1 },
  10: { nombre: 'octubre', corto: 'oct', dias: 31, primerDia: 3 },
}

export const mismaFecha = (a: Fecha | null, b: Fecha | null) => !!a && !!b && a.mes === b.mes && a.dia === b.dia
export const diaSemana = (f: Fecha) => (MESES[f.mes].primerDia + f.dia - 1) % 7
export const esHoy = (f: Fecha) => mismaFecha(f, HOY)
/** Los turnos de atención de ese día (mañana y tarde). Sin ninguno, el negocio está cerrado. */
export const tramosDeFecha = (horarios: Semana, f: Fecha): Tramo[] => tramosDelDia(horarios, diaSemana(f))
export const esCerrado = (horarios: Semana, f: Fecha) => tramosDeFecha(horarios, f).length === 0
/** Días desde hoy (0 = hoy). */
export const enDias = (f: Fecha) => (f.mes === HOY.mes ? f.dia - HOY.dia : MESES[HOY.mes].dias - HOY.dia + f.dia)

export function sumarDias(f: Fecha, n: number): Fecha {
  let { mes, dia } = f
  dia += n
  while (MESES[mes] && dia > MESES[mes].dias) { dia -= MESES[mes].dias; mes += 1 }
  return { mes, dia }
}

export const nombreDia = (f: Fecha) => DIAS[diaSemana(f)]
export const nombreDiaCorto = (f: Fecha) => DIAS_CORTOS[diaSemana(f)]
export const mesCorto = (f: Fecha) => MESES[f.mes].corto
export const fechaLarga = (f: Fecha) => `${nombreDia(f)} ${f.dia} de ${MESES[f.mes].nombre}`
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
      if (esHoy(f) && m < AHORA_DEMO + 30) continue // lo que ya pasó (o está por empezar) no se ofrece
      out.push({ m, libre: !completo && (Math.floor(m / 30) + f.dia * 3) % 4 !== 1 })
    }
  }
  return out
}

export const libresDel = (horarios: Semana, f: Fecha, duracion: number) => grillaDel(horarios, f, duracion).filter(x => x.libre)

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

// ─── Clases con cupo ──────────────────────────────────────────────────────────
// La grilla semanal va de lunes (0) a sábado (5). Hoy es sábado: las clases de
// hoy son las del 26 y el resto cae en la semana que arranca el lunes 28.
export const fechaDeClase = (dia: number): Fecha => (dia === 5 ? HOY : sumarDias({ mes: 9, dia: 28 }, dia))
export const clasePasada = (c: ClaseCupo) => c.dia === 5 && c.inicio <= AHORA_DEMO
