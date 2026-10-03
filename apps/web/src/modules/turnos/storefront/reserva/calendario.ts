// Calendario de la reserva. "Hoy" es el día real (reloj.ts, hora de Argentina):
// lo que depende de él lo arma `calendarioReserva(ahora)` y los componentes lo
// toman con `useCalendarioReserva()`, así no se lee el reloj durante el render
// (react-compiler lo prohíbe) y servidor y navegador dibujan lo mismo.
//
// Los horarios que se ofrecen salen del horario del negocio (el que el dueño
// cargó en el alta o guardó en Configuración → Horarios): cada día tiene su
// mañana y su tarde, y en el corte del mediodía no hay turnos. Cuáles están
// libres y cuáles ocupados sale de una cuenta determinista, no de una agenda real.
import { useMemo } from 'react'
import { tramosDelDia, type Semana, type Tramo } from '@/modules/turnos/horario'
import { DIAS, DIAS_CORTOS, type ClaseCupo } from '@/modules/turnos/datos'
import * as reloj from '@/modules/turnos/reloj'

/** Un día del calendario (mes 1 = enero). */
export interface Fecha { anio: number; mes: number; dia: number }
export interface Franja { m: number; libre: boolean }

/** La fecha de un "YYYY-MM-DD". */
export const fechaDeIso = (iso: reloj.Fecha): Fecha => reloj.partesDe(iso)
/** "YYYY-MM-DD" de una fecha. */
export const isoDe = (f: Fecha): reloj.Fecha => reloj.fechaDePartes(f.anio, f.mes, f.dia)

export const mismaFecha = (a: Fecha | null, b: Fecha | null) => !!a && !!b && a.anio === b.anio && a.mes === b.mes && a.dia === b.dia
export const diaSemana = (f: Fecha) => reloj.diaDeSemana(isoDe(f))
/** Los turnos de atención de ese día (mañana y tarde). Sin ninguno, el negocio está cerrado. */
export const tramosDeFecha = (horarios: Semana, f: Fecha): Tramo[] => tramosDelDia(horarios, diaSemana(f))
export const esCerrado = (horarios: Semana, f: Fecha) => tramosDeFecha(horarios, f).length === 0

export const sumarDias = (f: Fecha, n: number): Fecha => fechaDeIso(reloj.sumarDias(isoDe(f), n))

export const nombreDia = (f: Fecha) => DIAS[diaSemana(f)]
export const nombreDiaCorto = (f: Fecha) => DIAS_CORTOS[diaSemana(f)]
export const mesCorto = (f: Fecha) => reloj.MESES_CORTOS[f.mes - 1]
export const fechaLarga = (f: Fecha) => reloj.fechaLarga(isoDe(f))

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

// ─── Lo que depende de hoy ──────────────────────────────────────────────────

export function calendarioReserva(ahora: reloj.Ahora) {
  const HOY = fechaDeIso(ahora.fecha)
  const esHoy = (f: Fecha) => mismaFecha(f, HOY)
  /** Días desde hoy (0 = hoy). */
  const enDias = (f: Fecha) => reloj.diasEntre(ahora.fecha, isoDe(f))
  /** "hoy", "mañana" o "el martes 29 de septiembre": para armar frases. */
  const fechaRelativa = (f: Fecha) => (esHoy(f) ? 'hoy' : enDias(f) === 1 ? 'mañana' : `el ${fechaLarga(f).toLowerCase()}`)
  /** "Hoy", "Mañana" o "Mar 29": para los carteles de "próximo turno libre". */
  const fechaCortaRelativa = (f: Fecha) => (esHoy(f) ? 'Hoy' : enDias(f) === 1 ? 'Mañana' : `${nombreDiaCorto(f)} ${f.dia}`)

  /**
   * Todas las franjas del día, las libres y las ya tomadas (para mostrarlas
   * tachadas). Solo dentro de la mañana y de la tarde de ese día: un turno tiene
   * que terminar antes de que el negocio cierre.
   */
  function grillaDel(horarios: Semana, f: Fecha, duracion: number): Franja[] {
    const paso = duracion >= 60 ? 60 : 30
    // El cuarto día desde hoy está completo a propósito: muestra cómo se ve un día sin lugar.
    const completo = enDias(f) === 4
    const out: Franja[] = []
    for (const [abre, cierra] of tramosDeFecha(horarios, f)) {
      for (let m = abre; m + duracion <= cierra; m += paso) {
        if (esHoy(f) && m < ahora.minutos + 30) continue // lo que ya pasó (o está por empezar) no se ofrece
        out.push({ m, libre: !completo && (Math.floor(m / 30) + f.dia * 3) % 4 !== 1 })
      }
    }
    return out
  }

  const libresDel = (horarios: Semana, f: Fecha, duracion: number) => grillaDel(horarios, f, duracion).filter(x => x.libre)

  /** Los próximos `cuantos` días, desde hoy, con su disponibilidad. */
  function proximosDias(horarios: Semana, duracion: number, cuantos = 21): DiaAgenda[] {
    return Array.from({ length: cuantos }, (_, i) => {
      const f = sumarDias(HOY, i)
      const grilla = grillaDel(horarios, f, duracion)
      return { f, grilla, libres: grilla.filter(x => x.libre).length, cerrado: esCerrado(horarios, f) }
    })
  }

  /** El primer horario libre de la agenda: día y hora. */
  function primerLibre(horarios: Semana, duracion: number): { f: Fecha; m: number } | null {
    for (const d of proximosDias(horarios, duracion)) {
      const x = d.grilla.find(g => g.libre)
      if (x) return { f: d.f, m: x.m }
    }
    return null
  }

  // Clases con cupo: la grilla semanal va de lunes (0) a sábado (5). Cada clase
  // cae en el próximo día de la semana que le toca, de hoy en adelante (las de
  // hoy, hoy; las de un día que ya pasó esta semana, la semana que viene).
  const fechaDeClase = (dia: number): Fecha => sumarDias(HOY, (dia - ahora.diaSemana + 7) % 7)
  /** La clase de hoy que ya empezó. */
  const clasePasada = (c: ClaseCupo) => c.dia === ahora.diaSemana && c.inicio <= ahora.minutos

  return { ahora, HOY, esHoy, enDias, fechaRelativa, fechaCortaRelativa, grillaDel, libresDel, proximosDias, primerLibre, fechaDeClase, clasePasada }
}

export type CalendarioReserva = ReturnType<typeof calendarioReserva>

/** El calendario de la reserva con la fecha real. Dentro de un <RelojTurnos>. */
export function useCalendarioReserva(): CalendarioReserva {
  const ahora = reloj.useReloj()
  return useMemo(() => calendarioReserva(ahora), [ahora])
}
