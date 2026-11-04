// Qué se puede reservar en un día: los horarios de inicio donde entra un turno,
// las franjas consecutivas de una cancha y los bloques fijos de un salón. Todo
// sale de la apertura del día (tramos), de lo que ya está ocupado y de las
// reglas del negocio (paso, duración, margen de limpieza). Puro, sin fechas
// relativas: el "ahora" entra como parámetro.
import { restar, seSolapan, type Tramo } from './solapamiento'

export interface ReglasFranjas {
  /** Cada cuántos minutos arranca una franja (30, 60…). */
  paso: number
  /** Cuánto dura lo que se reserva, en minutos. */
  duracion: number
  /** Minutos que se dejan libres antes y después de cada ocupación. */
  margen?: number
  /** Minutos del día antes de los cuales no se ofrece nada (si el día es hoy). */
  desde?: number
}

export interface Franja {
  inicio: number
  fin: number
  libre: boolean
}

/**
 * Las franjas del día dentro de la apertura, cada `paso` minutos, marcadas
 * libres u ocupadas. Una franja está libre si lo que se reserva entra entero
 * en la apertura y no pisa ninguna ocupación (con su margen).
 */
export function franjasDelDia(apertura: Tramo[], ocupadas: Tramo[], r: ReglasFranjas): Franja[] {
  const out: Franja[] = []
  const margen = r.margen ?? 0
  const conMargen: Tramo[] = ocupadas.map(([a, b]) => [a - margen, b + margen])
  for (const [abre, cierra] of apertura) {
    for (let m = abre; m + r.duracion <= cierra; m += r.paso) {
      const fin = m + r.duracion
      const pasada = r.desde !== undefined && m < r.desde
      const choca = conMargen.some(o => seSolapan([m, fin], o))
      out.push({ inicio: m, fin, libre: !pasada && !choca })
    }
  }
  return out
}

/** Solo los inicios libres. */
export const inicioslibres = (apertura: Tramo[], ocupadas: Tramo[], r: ReglasFranjas) =>
  franjasDelDia(apertura, ocupadas, r).filter(f => f.libre).map(f => f.inicio)

/**
 * Para una cancha: cuántas franjas seguidas se pueden tomar a partir de una
 * (hasta `maximo`). La primera cuenta. La siguiente es la que arranca justo
 * donde termina la anterior (con turnos de 60 cada 30, no es la de al lado en
 * la lista); se corta si no existe o está ocupada.
 */
export function consecutivasDesde(franjas: Franja[], inicio: number, maximo = 4): number {
  const porInicio = new Map(franjas.map(f => [f.inicio, f]))
  let f = porInicio.get(inicio)
  let n = 0
  while (f && f.libre && n < maximo) {
    n++
    f = porInicio.get(f.fin)
  }
  return n
}

/** Los huecos libres del día (lo que queda de la apertura al sacar lo ocupado), para dibujar la agenda. */
export const huecosDelDia = (apertura: Tramo[], ocupadas: Tramo[]): Tramo[] => apertura.flatMap(a => restar(a, ocupadas))

// ─── Bloques fijos (salones) ─────────────────────────────────────────────────

export interface Bloque {
  id: string
  /** "Tarde", "Noche". */
  nombre: string
  inicio: number
  fin: number
}

/**
 * Arma los bloques de un día a partir de una apertura: bloques de `duracion`
 * minutos, con `limpieza` minutos entre uno y otro que no se pueden reservar.
 * Los nombres se eligen por la hora en que arrancan.
 */
export function armarBloques(apertura: Tramo, duracion: number, limpieza: number): Bloque[] {
  const out: Bloque[] = []
  let n = 1
  for (let m = apertura[0]; m + duracion <= apertura[1]; m += duracion + limpieza) {
    out.push({ id: `b${n++}`, nombre: nombreDeBloque(m), inicio: m, fin: m + duracion })
  }
  return out
}

export const nombreDeBloque = (inicio: number) => (inicio < 12 * 60 ? 'Mañana' : inicio < 17 * 60 ? 'Tarde' : 'Noche')

/**
 * Qué bloques del día se pueden reservar: los que no están tomados y, si hay
 * margen de limpieza, los que no quedan pegados a uno tomado sin ese margen.
 */
export function bloquesLibres(bloques: Bloque[], tomados: string[], limpieza = 0): Bloque[] {
  const ocupados = bloques.filter(b => tomados.includes(b.id))
  return bloques.filter(b => !tomados.includes(b.id) && !ocupados.some(o => seSolapan([b.inicio, b.fin], [o.inicio - limpieza, o.fin + limpieza])))
}

/** Cuánto de la apertura está tomado (0 a 1), para medir ocupación. */
export function ocupacion(apertura: Tramo[], ocupadas: Tramo[]): number {
  const total = apertura.reduce((s, [a, b]) => s + (b - a), 0)
  if (!total) return 0
  const libre = huecosDelDia(apertura, ocupadas).reduce((s, [a, b]) => s + (b - a), 0)
  return Math.min(1, Math.max(0, 1 - libre / total))
}
