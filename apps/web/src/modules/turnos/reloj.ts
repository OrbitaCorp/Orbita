// La fecha y la hora de Turnos: el "ahora" real, siempre en hora de Argentina.
//
// Dos partes:
//
// (a) Funciones PURAS de calendario. Reciben el instante o la fecha por
//     parámetro y nunca miran el reloj ni la zona del navegador: Argentina es
//     UTC-3 fijo (sin horario de verano desde 2009), así que un instante se pasa
//     a hora argentina restando 3 h y leyendo en UTC. Son las mismas
//     convenciones que la API (apps/api/src/appointments/horarios/horarios.ts):
//     fecha "YYYY-MM-DD" del día argentino, horas en minutos desde las 00:00 y
//     día de la semana con 0 = lunes … 6 = domingo.
//
// (b) El hook `useAhora()`, para leer la hora en un componente. React Compiler
//     prohíbe `Date.now()` / `new Date()` durante el render, y el HTML del
//     servidor tiene que coincidir con el primer pintado del navegador. Por eso
//     el reloj es un store externo (`useSyncExternalStore`) que avanza de a un
//     minuto, y en el servidor (y en la hidratación) vale la SEMILLA: el minuto
//     que calculó `getServerSideProps` y viajó en las props de la página, igual
//     en los dos lados. Sin semilla, en el servidor vale null y quien lo usa no
//     dibuja lo que depende de la hora hasta que el navegador la conoce.
//
// Para que los componentes no tengan que lidiar con el null, la página envuelve
// todo en <RelojTurnos semilla={...}> y adentro se usa `useReloj()`.
import { createContext, createElement, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'

/** "YYYY-MM-DD" de un día de Argentina. */
export type Fecha = string

const MS_MINUTO = 60_000
const MS_DIA = 24 * 60 * MS_MINUTO
/** Argentina está 3 horas detrás de UTC, todo el año. */
const DESFASE_ARGENTINA_MS = 3 * 60 * MS_MINUTO

export const MINUTOS_DEL_DIA = 24 * 60
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const DIAS_SEMANA_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const dos = (n: number) => String(n).padStart(2, '0')

// ─── Instantes ↔ hora de Argentina ──────────────────────────────────────────

/** El día argentino en el que cae un instante (ms desde 1970). */
export function fechaArgentina(instante: number): Fecha {
  return new Date(instante - DESFASE_ARGENTINA_MS).toISOString().slice(0, 10)
}

/** Los minutos desde las 00:00 de Argentina de un instante. */
export function minutosArgentina(instante: number): number {
  const local = instante - DESFASE_ARGENTINA_MS
  return Math.floor((((local % MS_DIA) + MS_DIA) % MS_DIA) / MS_MINUTO)
}

/** En qué día argentino cae un instante y a qué hora. */
export function fechaYMinutos(instante: number): { fecha: Fecha; minutos: number } {
  return { fecha: fechaArgentina(instante), minutos: minutosArgentina(instante) }
}

/** El instante (ms) de una hora del día argentino: instanteDe('2026-10-05', 600) = 10:00 en Argentina = 13:00 UTC. */
export function instanteDe(fecha: Fecha, minutos = 0): number {
  return Date.parse(`${fecha}T00:00:00.000Z`) + DESFASE_ARGENTINA_MS + minutos * MS_MINUTO
}

/** Lo mismo en ISO UTC, como viaja en la API. */
export const isoDe = (fecha: Fecha, minutos = 0) => new Date(instanteDe(fecha, minutos)).toISOString()

/** El instante de un ISO de la API, en ms. */
export const instanteIso = (iso: string) => Date.parse(iso)

// ─── Fechas (día calendario) ────────────────────────────────────────────────
// Se calcula al mediodía UTC: ese instante es el mismo día calendario en
// cualquier zona, así que nada depende de dónde corre el código.

const mediodia = (fecha: Fecha) => Date.parse(`${fecha}T12:00:00.000Z`)
const deMediodia = (ms: number): Fecha => new Date(ms).toISOString().slice(0, 10)

/** "YYYY-MM-DD" de un día que existe (rechaza 2026-02-30). */
export function esFecha(valor: unknown): valor is Fecha {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const ms = mediodia(valor)
  return !Number.isNaN(ms) && deMediodia(ms) === valor
}

/** Año, mes (1 = enero) y día de una fecha. */
export function partesDe(fecha: Fecha): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return { anio, mes, dia }
}

/** La fecha de un año, mes (1 = enero) y día. Se desborda como `Date.UTC`: (2026, 13, 1) es el 1/1/2027. */
export function fechaDePartes(anio: number, mes: number, dia: number): Fecha {
  return deMediodia(Date.UTC(anio, mes - 1, dia, 12))
}

/** Día de la semana: 0 = lunes … 6 = domingo. */
export function diaDeSemana(fecha: Fecha): number {
  return (new Date(mediodia(fecha)).getUTCDay() + 6) % 7
}

/** La fecha `dias` días después (o antes, con negativo). */
export function sumarDias(fecha: Fecha, dias: number): Fecha {
  return deMediodia(mediodia(fecha) + dias * MS_DIA)
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: Fecha, hasta: Fecha): number {
  return Math.round((mediodia(hasta) - mediodia(desde)) / MS_DIA)
}

/** Cuántos días tiene un mes (mes 1 = enero). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0, 12)).getUTCDate()
}

/** Cuántos días tiene el mes de una fecha. */
export const diasDelMesDe = (fecha: Fecha) => { const p = partesDe(fecha); return diasDelMes(p.anio, p.mes) }

export const primeroDelMes = (fecha: Fecha): Fecha => { const p = partesDe(fecha); return fechaDePartes(p.anio, p.mes, 1) }
export const ultimoDelMes = (fecha: Fecha): Fecha => { const p = partesDe(fecha); return fechaDePartes(p.anio, p.mes, diasDelMes(p.anio, p.mes)) }

/** El mismo día del mes `pasos` meses más adelante (o atrás). Si ese mes es más corto, su último día (31/01 + 1 → 28/02). */
export function moverMes(fecha: Fecha, pasos: number): Fecha {
  const p = partesDe(fecha)
  const destino = fechaDePartes(p.anio, p.mes + pasos, 1)
  const d = partesDe(destino)
  return fechaDePartes(d.anio, d.mes, Math.min(p.dia, diasDelMes(d.anio, d.mes)))
}

export const mismoMes = (a: Fecha, b: Fecha) => a.slice(0, 7) === b.slice(0, 7)

/** El lunes de la semana de una fecha. */
export const lunesDe = (fecha: Fecha): Fecha => sumarDias(fecha, -diaDeSemana(fecha))

/** Del primero al último día, inclusive. */
export interface Rango { desde: Fecha; hasta: Fecha }

/** La semana de una fecha, de lunes a domingo. */
export const semanaDe = (fecha: Fecha): Rango => ({ desde: lunesDe(fecha), hasta: sumarDias(lunesDe(fecha), 6) })
/** El mes de una fecha, del 1 al último día. */
export const mesDe = (fecha: Fecha): Rango => ({ desde: primeroDelMes(fecha), hasta: ultimoDelMes(fecha) })
/** El mes anterior al de una fecha, entero. */
export const mesAnterior = (fecha: Fecha): Rango => mesDe(sumarDias(primeroDelMes(fecha), -1))

/** Los días de un rango, en orden. Vacío si `hasta` es anterior a `desde`. */
export function diasDe(r: Rango): Fecha[] {
  const n = diasEntre(r.desde, r.hasta)
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => sumarDias(r.desde, i))
}

/** La grilla de un calendario mensual: semanas enteras de lunes a domingo (trae días del mes anterior y del siguiente). */
export function grillaDelMes(fecha: Fecha): Fecha[] {
  return diasDe({ desde: lunesDe(primeroDelMes(fecha)), hasta: sumarDias(lunesDe(ultimoDelMes(fecha)), 6) })
}

// ─── Texto ──────────────────────────────────────────────────────────────────

export const hhmm = (minutos: number) => `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`

/** "Sábado 26 de septiembre". */
export function fechaLarga(fecha: Fecha): string {
  const p = partesDe(fecha)
  return `${DIAS_SEMANA[diaDeSemana(fecha)]} ${p.dia} de ${MESES[p.mes - 1]}`
}

/** "26/09". */
export const fechaCorta = (fecha: Fecha) => { const p = partesDe(fecha); return `${dos(p.dia)}/${dos(p.mes)}` }

/** "26/09/2026". */
export const fechaNumerica = (fecha: Fecha) => { const p = partesDe(fecha); return `${dos(p.dia)}/${dos(p.mes)}/${p.anio}` }

/** "Sáb 26 sep · 10:40". */
export function fechaHoraCorta(fecha: Fecha, minutos: number): string {
  const p = partesDe(fecha)
  return `${DIAS_SEMANA_CORTOS[diaDeSemana(fecha)]} ${p.dia} ${MESES_CORTOS[p.mes - 1]} · ${hhmm(minutos)}`
}

/** "Septiembre de 2026". */
export function mesTxt(fecha: Fecha): string {
  const p = partesDe(fecha)
  const m = MESES[p.mes - 1]
  return `${m[0].toUpperCase()}${m.slice(1)} de ${p.anio}`
}

/** "del 21 al 26 de septiembre", "del 28 de septiembre al 3 de octubre", "del 29 de diciembre de 2026 al 2 de enero de 2027". */
export function rangoTxt(desde: Fecha, hasta: Fecha): string {
  const a = partesDe(desde), b = partesDe(hasta)
  if (a.anio !== b.anio) return `del ${a.dia} de ${MESES[a.mes - 1]} de ${a.anio} al ${b.dia} de ${MESES[b.mes - 1]} de ${b.anio}`
  if (a.mes !== b.mes) return `del ${a.dia} de ${MESES[a.mes - 1]} al ${b.dia} de ${MESES[b.mes - 1]}`
  return `del ${a.dia} al ${b.dia} de ${MESES[b.mes - 1]}`
}

// ─── El ahora ───────────────────────────────────────────────────────────────

/** Un momento ya traducido a Argentina, redondeado al minuto. */
export interface Ahora {
  /** ms desde 1970, al minuto. */
  instante: number
  fecha: Fecha
  /** Minutos desde las 00:00 de Argentina. */
  minutos: number
  /** 0 = lunes … 6 = domingo. */
  diaSemana: number
}

/** El instante redondeado al minuto (hacia atrás). */
export const alMinuto = (instante: number) => Math.floor(instante / MS_MINUTO) * MS_MINUTO

export function ahoraDe(instante: number): Ahora {
  const ms = alMinuto(instante)
  const fecha = fechaArgentina(ms)
  return { instante: ms, fecha, minutos: minutosArgentina(ms), diaSemana: diaDeSemana(fecha) }
}

/**
 * La semilla del reloj para el render del servidor: llamarla en
 * `getServerSideProps` y pasarla a <RelojTurnos semilla={...}>. Viaja en las
 * props, así que el navegador hidrata con el mismo minuto que dibujó el servidor.
 */
export const semillaReloj = () => alMinuto(Date.now())

// Store del reloj: un solo temporizador para toda la página, que avisa al
// cambiar el minuto (y al volver a la pestaña, por si estuvo dormida).
const oyentes = new Set<() => void>()
let temporizador: ReturnType<typeof setTimeout> | null = null

function avisar() { oyentes.forEach(o => o()) }

function programar() {
  temporizador = setTimeout(() => { avisar(); programar() }, MS_MINUTO - (Date.now() % MS_MINUTO) + 20)
}

function alVolver() { if (document.visibilityState === 'visible') avisar() }

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  if (oyentes.size === 1) {
    programar()
    document.addEventListener('visibilitychange', alVolver)
  }
  return () => {
    oyentes.delete(oyente)
    if (oyentes.size === 0) {
      if (temporizador) clearTimeout(temporizador)
      temporizador = null
      document.removeEventListener('visibilitychange', alVolver)
    }
  }
}

// Un número: dentro del mismo minuto es el mismo valor, así React no re-renderiza de más.
const leerReloj = () => alMinuto(Date.now())

const SemillaReloj = createContext<number | null>(null)

/**
 * La hora actual de Argentina, al minuto. En el servidor y en la hidratación es
 * la semilla del <RelojTurnos> que envuelve al componente; sin semilla, null.
 * Después de hidratar sigue al reloj del navegador y se actualiza cada minuto.
 */
export function useAhora(): Ahora | null {
  const semilla = useContext(SemillaReloj)
  const instante = useSyncExternalStore(suscribir, leerReloj, () => semilla)
  return useMemo(() => (instante === null ? null : ahoraDe(instante)), [instante])
}

/** La hora actual dentro de un <RelojTurnos> (que no dibuja a sus hijos hasta conocerla). */
export function useReloj(): Ahora {
  const ahora = useAhora()
  if (!ahora) throw new Error('useReloj() se usa dentro de <RelojTurnos>.')
  return ahora
}

function Puerta({ children }: { children: ReactNode }) {
  return useAhora() ? children : null
}

/**
 * Pone la hora a disposición de todo lo de adentro. Con `semilla` (la de
 * `getServerSideProps`) dibuja desde el servidor; sin ella, los hijos aparecen
 * recién en el navegador.
 */
export function RelojTurnos({ semilla, children }: { semilla?: number | null; children: ReactNode }) {
  return createElement(SemillaReloj.Provider, { value: semilla ?? null }, createElement(Puerta, null, children))
}
