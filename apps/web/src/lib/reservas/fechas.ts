// Fechas de calendario para reservas, sin zona horaria: una fecha es un texto
// "AAAA-MM-DD" y una hora son minutos desde las 00:00. Así una reserva del 14 al
// 16 de noviembre es la misma en el servidor y en el navegador de quien reserva,
// y el día de la demo no depende de Date.now() (react-compiler lo prohíbe en
// render). Todo es puro: no hay Date mutables ni efectos.
//
// Es una librería: la usan Turnos, Alquileres y Gimnasio, pero no sabe nada de
// ninguno de los tres.

/** "AAAA-MM-DD". */
export type ISO = string

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const dd = (n: number) => String(n).padStart(2, '0')

/** Arma un ISO. `mes` va de 1 a 12. */
export const iso = (anio: number, mes: number, dia: number): ISO => `${anio}-${dd(mes)}-${dd(dia)}`

export function partes(f: ISO): { anio: number; mes: number; dia: number } {
  const [a, m, d] = f.split('-').map(Number)
  return { anio: a, mes: m, dia: d }
}

export const esISO = (s: string): s is ISO => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(aDias(s))

/** Días desde el 1970-01-01 (UTC) de una fecha: la unidad para sumar, restar y comparar. */
export function aDias(f: ISO): number {
  const { anio, mes, dia } = partes(f)
  return Math.round(Date.UTC(anio, mes - 1, dia) / 86_400_000)
}

export function deDias(n: number): ISO {
  const d = new Date(n * 86_400_000)
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export const sumarDias = (f: ISO, n: number): ISO => deDias(aDias(f) + n)
/** b - a, en días (positivo si b es después). */
export const diasEntre = (a: ISO, b: ISO): number => aDias(b) - aDias(a)
export const compararFechas = (a: ISO, b: ISO): number => aDias(a) - aDias(b)
export const esAntes = (a: ISO, b: ISO) => aDias(a) < aDias(b)
export const mismaFecha = (a: ISO, b: ISO) => a === b
export const maxFecha = (a: ISO, b: ISO): ISO => (esAntes(a, b) ? b : a)
export const minFecha = (a: ISO, b: ISO): ISO => (esAntes(a, b) ? a : b)

/** 0 = lunes … 6 = domingo. */
export function diaSemana(f: ISO): number {
  // El 1970-01-01 fue jueves (índice 3 con lunes = 0).
  return (((aDias(f) + 3) % 7) + 7) % 7
}
export const esFinDeSemana = (f: ISO) => diaSemana(f) >= 5

export const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

/** `f` está dentro de [desde, hasta], con los dos extremos incluidos. */
export const entre = (f: ISO, desde: ISO, hasta: ISO) => !esAntes(f, desde) && !esAntes(hasta, f)

/** Las fechas de [desde, hasta), sin incluir `hasta`: las noches de una estadía, los días de un bloqueo. */
export function rango(desde: ISO, hasta: ISO): ISO[] {
  const n = diasEntre(desde, hasta)
  return Array.from({ length: Math.max(0, n) }, (_, i) => sumarDias(desde, i))
}

export interface CeldaMes {
  fecha: ISO
  /** false = relleno del mes anterior o siguiente, para completar la semana. */
  delMes: boolean
}

/** Las celdas de un calendario mensual, de lunes a domingo, siempre en semanas completas. */
export function grillaMes(anio: number, mes: number): CeldaMes[] {
  const primero = iso(anio, mes, 1)
  const desde = sumarDias(primero, -diaSemana(primero))
  const total = diasDelMes(anio, mes)
  const semanas = Math.ceil((diaSemana(primero) + total) / 7)
  return Array.from({ length: semanas * 7 }, (_, i) => {
    const fecha = sumarDias(desde, i)
    return { fecha, delMes: partes(fecha).mes === mes && partes(fecha).anio === anio }
  })
}

/**
 * La misma fecha `n` meses después (o antes, con n negativo), con el mismo día del
 * mes: del 15 de enero al 15 de abril. Si ese mes no tiene ese día, el último que
 * tenga: del 31 de enero al 28 de febrero. Es como se cuenta un alquiler por mes.
 */
export function sumarMeses(f: ISO, n: number): ISO {
  const { anio, mes, dia } = partes(f)
  const total = anio * 12 + (mes - 1) + n
  const a = Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12 + 1
  return iso(a, m, Math.min(dia, diasDelMes(a, m)))
}

/** Primer día del mes siguiente o anterior a `f`. */
export function moverMes(f: ISO, pasos: number): ISO {
  const { anio, mes } = partes(f)
  const total = (anio * 12 + (mes - 1)) + pasos
  return iso(Math.floor(total / 12), (total % 12 + 12) % 12 + 1, 1)
}

// ─── Horas ───────────────────────────────────────────────────────────────────

export const hhmm = (m: number) => `${dd(Math.floor(m / 60))}:${dd(((m % 60) + 60) % 60)}`
export const aMinutos = (s: string) => { const [h, m] = s.trim().split(':').map(Number); return (h || 0) * 60 + (m || 0) }

/** Minutos → "1 h 30 min" / "45 min" / "2 h". */
export const duracionTxt = (min: number) =>
  min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`

// ─── Texto ───────────────────────────────────────────────────────────────────

/** "sáb 14 nov". */
export const fechaCorta = (f: ISO) => {
  const p = partes(f)
  return `${DIAS_CORTOS[diaSemana(f)].toLowerCase()} ${p.dia} ${MESES_CORTOS[p.mes - 1]}`
}
/** "Sábado 14 de noviembre". */
export const fechaLarga = (f: ISO) => {
  const p = partes(f)
  return `${DIAS_SEMANA[diaSemana(f)]} ${p.dia} de ${MESES[p.mes - 1]}`
}
/** "14/11". */
export const fechaNumerica = (f: ISO) => { const p = partes(f); return `${dd(p.dia)}/${dd(p.mes)}` }
/** "noviembre 2026". */
export const mesTxt = (f: ISO) => { const p = partes(f); return `${MESES[p.mes - 1]} ${p.anio}` }
/** "14 al 16 de noviembre" o "30 de nov al 2 de dic". */
export function rangoTxt(desde: ISO, hasta: ISO): string {
  const a = partes(desde), b = partes(hasta)
  // Un bloqueo o una temporada de un solo día no es "20 al 20 de noviembre".
  if (desde === hasta) return `${a.dia} de ${MESES[a.mes - 1]}`
  if (a.mes === b.mes) return `${a.dia} al ${b.dia} de ${MESES[a.mes - 1]}`
  return `${a.dia} de ${MESES_CORTOS[a.mes - 1]} al ${b.dia} de ${MESES_CORTOS[b.mes - 1]}`
}
/** "Hoy", "Mañana" o la fecha corta, según cuánto falta desde `hoy`. */
export const fechaRelativa = (f: ISO, hoy: ISO) => {
  const n = diasEntre(hoy, f)
  return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : fechaCorta(f)
}
