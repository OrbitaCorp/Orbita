// La cuenta de la grilla de ocupación (GrillaOcupacion.tsx), aparte y sin
// React para poder probarla: qué días entran en la ventana, en qué columna
// arranca cada barra, cuántas ocupa y si sigue de un lado o del otro.
//
// Una columna es una noche: la del día `f` va de `f` a `f + 1`. Una barra
// [desde, hasta) ocupa las noches desde `desde` hasta la anterior a `hasta`:
// el día de salida queda libre para que entre otro, así dos estadías seguidas
// quedan una al lado de la otra sin pisarse.
import { diasEntre, sumarDias, type ISO } from '@/lib/reservas/fechas'

/** Cómo se pinta una barra. El texto de la barra dice lo mismo: el color no es lo único que lo distingue. */
export type TonoBarra = 'reserva' | 'pendiente' | 'pasada' | 'externo' | 'cerrado' | 'bloqueo'

export interface FilaGrilla {
  id: string
  nombre: string
  /** Segunda línea, chica: "Cabaña · 4 huéspedes". */
  detalle?: string
}

export interface BarraGrilla {
  id: string
  filaId: string
  /** [desde, hasta): el día `hasta` ya está libre. */
  desde: ISO
  hasta: ISO
  /** Lo que se lee primero: el huésped, "Reservado", el motivo del bloqueo. */
  titulo: string
  /** Lo chico a la derecha, en mayúsculas: el canal ("Directo", "Airbnb") o "Bloqueo". */
  etiqueta?: string
  tono: TonoBarra
  /** Lo que lee el lector de pantalla; si falta, título, etiqueta y fechas. */
  aria?: string
}

/** Los días que muestra la ventana, desde `desde`. */
export const diasDeVentana = (desde: ISO, dias: number): ISO[] => Array.from({ length: dias }, (_, i) => sumarDias(desde, i))

export interface Ubicacion {
  /** Primera columna (0 = el primer día de la ventana). */
  col: number
  /** Cuántas columnas ocupa. */
  span: number
  /** Empezó antes de la ventana o sigue después: ese lado va recto. */
  sigueIzq: boolean
  sigueDer: boolean
}

/** Dónde cae una barra en la ventana, o null si no se ve (o no ocupa ninguna noche). */
export function ubicar(b: Pick<BarraGrilla, 'desde' | 'hasta'>, desde: ISO, dias: number): Ubicacion | null {
  const ini = diasEntre(desde, b.desde)
  const fin = diasEntre(desde, b.hasta)
  const col = Math.max(0, ini)
  const hasta = Math.min(dias, fin)
  if (hasta <= col) return null
  return { col, span: hasta - col, sigueIzq: ini < 0, sigueDer: fin > dias }
}

/** Si la noche `f` de la fila está tomada por alguna barra. */
export const nocheTomada = (barras: BarraGrilla[], filaId: string, f: ISO) =>
  barras.some(b => b.filaId === filaId && b.desde <= f && f < b.hasta)

/** "23 nov → 6 dic": el primer y el último día que se ven. */
export function rangoVentana(desde: ISO, dias: number, meses: string[]): string {
  const txt = (f: ISO) => { const [, m, d] = f.split('-').map(Number); return `${d} ${meses[m - 1]}` }
  return `${txt(desde)} → ${txt(sumarDias(desde, dias - 1))}`
}

/** Dónde arranca la ventana para que hoy se vea: un día antes, para ver también quién salió hoy. */
export const inicioConHoy = (hoy: ISO) => sumarDias(hoy, -1)
