// DEMO INTERNA — horarios de atención de un negocio de turnos.
//
// Un negocio atiende de mañana y de tarde: dos tramos por día, con el corte del
// mediodía en el medio. Cada tramo se puede apagar (hay quien abre solo a la
// mañana) y cada día puede tener los suyos. Lo define el dueño: en el alta, y
// después en Configuración → Horarios.
//
// En todos lados el horario de un día viaja como texto, que es lo que se
// muestra: "09:00 – 13:00 · 16:00 – 20:00" ('' = cerrado). Acá está cómo se lee
// y se escribe ese texto.
//
// No importa nada de datos.ts a propósito: datos.ts arma la agenda de ejemplo
// con lo de acá.

/** [desde, hasta] en minutos desde las 00:00. */
export type Tramo = [number, number]
/** Los siete días, de lunes (0) a domingo (6): [nombre del día, horario en texto]. */
export type Semana = [string, string][]

/** Un turno de atención (la mañana o la tarde) en el formulario. */
export interface Bloque { on: boolean; desde: number; hasta: number }
export interface Jornada { manana: Bloque; tarde: Bloque }

// La fecha y la hora actuales no viven acá: son las reales, de reloj.ts.

// ─── Texto ↔ minutos ─────────────────────────────────────────────────────────

const dd = (n: number) => String(n).padStart(2, '0')
export const hhmm = (m: number) => `${dd(Math.floor(m / 60))}:${dd(m % 60)}`
export const aMinutos = (s: string) => { const [h, m] = s.trim().split(':').map(Number); return (h || 0) * 60 + (m || 0) }

/** "09:00 – 13:00 · 16:00 – 20:00" → [[540, 780], [960, 1200]]. Cerrado ('' o nada) → []. */
export function tramosDe(texto: string | null | undefined): Tramo[] {
  if (!texto) return []
  return texto.split('·')
    .map(p => p.split('–').map(aMinutos))
    .filter((p): p is Tramo => p.length === 2 && p[1] > p[0])
    .sort((a, b) => a[0] - b[0])
}

export const tramosTxt = (tramos: Tramo[]) => tramos.map(([a, b]) => `${hhmm(a)} – ${hhmm(b)}`).join(' · ')

/** Los tramos de un día de la semana (0 = lunes). */
export const tramosDelDia = (semana: Semana, indice: number): Tramo[] => tramosDe(semana[indice]?.[1])

export const abiertoA = (tramos: Tramo[], m: number) => tramos.some(([a, b]) => m >= a && m < b)
export const minutosAbiertos = (tramos: Tramo[]) => tramos.reduce((s, [a, b]) => s + (b - a), 0)

/** El corte del mediodía de un día partido, o null si atiende de un tirón. */
export function corteDe(tramos: Tramo[]): Tramo | null {
  for (let i = 1; i < tramos.length; i++) if (tramos[i][0] > tramos[i - 1][1]) return [tramos[i - 1][1], tramos[i][0]]
  return null
}

/** Lo que tienen en común dos listas de tramos: cuándo atiende alguien DENTRO del horario del negocio. */
export function cruzar(a: Tramo[], b: Tramo[]): Tramo[] {
  const out: Tramo[] = []
  for (const [a0, a1] of a) for (const [b0, b1] of b) {
    const desde = Math.max(a0, b0), hasta = Math.min(a1, b1)
    if (hasta > desde) out.push([desde, hasta])
  }
  return out.sort((x, y) => x[0] - y[0])
}

/** Los días de la semana que abre (0 = lunes). */
export const diasAbiertos = (semana: Semana): number[] => semana.map(([, h], i) => (h ? i : -1)).filter(i => i >= 0)

const CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
/** [0,1,2,3,4,5] → "Lun a sáb"; [0,2,4] → "Lun, mié y vie"; los siete → "Todos los días". */
export function diasTxt(indices: number[]): string {
  const d = [...new Set(indices)].filter(i => i >= 0 && i < 7).sort((a, b) => a - b)
  if (d.length === 0) return 'Sin días'
  if (d.length === 7) return 'Todos los días'
  const n = (i: number, primero: boolean) => (primero ? CORTOS[i] : CORTOS[i].toLowerCase())
  if (d.length === 1) return n(d[0], true)
  const corridos = d.every((x, i) => i === 0 || x === d[i - 1] + 1)
  if (corridos && d.length > 2) return `${n(d[0], true)} a ${n(d[d.length - 1], false)}`
  return `${d.slice(0, -1).map((x, k) => n(x, k === 0)).join(', ')} y ${n(d[d.length - 1], false)}`
}

/** "9" o "9:30": la hora como se dice, sin los ceros. */
const horaCorta = (m: number) => (m % 60 === 0 ? String(m / 60) : `${Math.floor(m / 60)}:${dd(m % 60)}`)
/** [[540,780],[960,1200]] → "de 9 a 13 y de 16 a 20 h". Para decir el horario en una frase. */
export const tramosFrase = (tramos: Tramo[]) =>
  tramos.length === 0 ? 'cerrado' : `${tramos.map(([a, b]) => `de ${horaCorta(a)} a ${horaCorta(b)}`).join(' y ')} h`

/** Desde la primera apertura hasta el último cierre de toda la semana (para dibujar la grilla). */
export function extremos(semana: Semana, porDefecto: Tramo = [9 * 60, 20 * 60]): Tramo {
  const todos = semana.flatMap(([, h]) => tramosDe(h))
  if (todos.length === 0) return porDefecto
  return [Math.min(...todos.map(t => t[0])), Math.max(...todos.map(t => t[1]))]
}

// ─── Mañana y tarde ──────────────────────────────────────────────────────────

/** Lo que propone el alta: de 9 a 13 y de 16 a 20. */
export const JORNADA_INICIAL: Jornada = {
  manana: { on: true, desde: 9 * 60, hasta: 13 * 60 },
  tarde: { on: true, desde: 16 * 60, hasta: 20 * 60 },
}
export const HORARIO_PARTIDO = '09:00 – 13:00 · 16:00 – 20:00'

// ─── La semana de ejemplo ────────────────────────────────────────────────────
// Con qué horario arranca un negocio que todavía no tocó nada. Lo usan el sitio,
// la reserva y el panel: es una sola semana para todos.

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
/** Arma la semana: de lunes a viernes, el sábado y el domingo ('' = cerrado). */
export const semanaCon = (lunesAViernes: string, sabado: string, domingo = ''): Semana =>
  NOMBRES_DIA.map((d, i) => [d, i < 5 ? lunesAViernes : i === 5 ? sabado : domingo])

/** Mañana y tarde, con el corte del mediodía: así atiende el negocio de ejemplo. */
export const SEMANA_PARTIDA: Semana = semanaCon(HORARIO_PARTIDO, HORARIO_PARTIDO)
/** Donde hay clases con cupo se abre temprano y se cierra tarde. */
export const SEMANA_CLASES: Semana = semanaCon('07:00 – 13:00 · 17:00 – 22:00', '07:00 – 13:00 · 17:00 – 20:00')
/** Las canchas se alquilan sobre todo a la tarde y a la noche. */
export const SEMANA_CANCHAS: Semana = semanaCon('09:00 – 13:00 · 16:00 – 23:00', '09:00 – 13:00 · 15:00 – 23:00')

export const tramosDeJornada = (j: Jornada): Tramo[] =>
  [j.manana, j.tarde].filter(b => b.on && b.hasta > b.desde).map(b => [b.desde, b.hasta] as Tramo)

export const jornadaTxt = (j: Jornada) => tramosTxt(tramosDeJornada(j))

/** Dos tramos → mañana y tarde. Uno solo va a la mañana o a la tarde según a qué hora arranca. */
export function jornadaDe(tramos: Tramo[], base: Jornada = JORNADA_INICIAL): Jornada {
  if (tramos.length === 0) return { manana: { ...base.manana, on: false }, tarde: { ...base.tarde, on: false } }
  if (tramos.length === 1) {
    const [a, b] = tramos[0]
    return a >= 13 * 60
      ? { manana: { ...base.manana, on: false }, tarde: { on: true, desde: a, hasta: b } }
      : { manana: { on: true, desde: a, hasta: b }, tarde: { ...base.tarde, on: false } }
  }
  const ultimo = tramos[tramos.length - 1]
  return { manana: { on: true, desde: tramos[0][0], hasta: tramos[0][1] }, tarde: { on: true, desde: ultimo[0], hasta: ultimo[1] } }
}

/** Qué le falta a una jornada para poder guardarse, en palabras. null = está bien. */
export function errorJornada(j: Jornada): string | null {
  if (!j.manana.on && !j.tarde.on) return 'Dejá prendido al menos un turno: la mañana o la tarde.'
  if (j.manana.on && j.manana.hasta <= j.manana.desde) return 'A la mañana, el cierre tiene que ser después de la apertura.'
  if (j.tarde.on && j.tarde.hasta <= j.tarde.desde) return 'A la tarde, el cierre tiene que ser después de la apertura.'
  if (j.manana.on && j.tarde.on && j.tarde.desde < j.manana.hasta) return 'La tarde tiene que empezar cuando termina la mañana, o después.'
  return null
}

/** Cada media hora de 06:00 a 24:00, para los desplegables de apertura y cierre. */
export const MEDIAS_HORAS: number[] = Array.from({ length: 37 }, (_, i) => 6 * 60 + i * 30)

// ─── Abierto / cerrado ───────────────────────────────────────────────────────

/** Cómo está el negocio a una hora: abierto (y hasta cuándo) o cerrado (y a qué hora vuelve a abrir hoy). */
export function estadoA(tramos: Tramo[], m: number): { abierto: boolean; cierra: string; abre: string } {
  const actual = tramos.find(([a, b]) => m >= a && m < b)
  const proximo = tramos.find(([a]) => a > m)
  return { abierto: !!actual, cierra: actual ? hhmm(actual[1]) : '', abre: !actual && proximo ? hhmm(proximo[0]) : '' }
}
