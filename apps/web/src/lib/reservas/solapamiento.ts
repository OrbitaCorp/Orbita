// Si dos cosas se pisan en el tiempo. Un tramo es [desde, hasta) en minutos del
// día: el final no está incluido, así un turno de 10:00 a 10:30 y otro de 10:30
// a 11:00 no chocan. Una ocupación puede llevar fecha, para comparar reservas
// de distintos días sin mezclarlas.

/** [desde, hasta) en minutos desde las 00:00. */
export type Tramo = [number, number]

export interface Ocupacion {
  /** "AAAA-MM-DD". */
  fecha: string
  inicio: number
  fin: number
  /** Para no compararse consigo misma al editar. */
  id?: string
}

export const tramoValido = (t: Tramo) => Number.isFinite(t[0]) && Number.isFinite(t[1]) && t[1] > t[0]

/** Dos tramos se pisan si comparten al menos un minuto. Tocarse en el borde no es pisarse. */
export const seSolapan = (a: Tramo, b: Tramo) => a[0] < b[1] && b[0] < a[1]

/** Un tramo entra entero dentro de otro. */
export const contiene = (afuera: Tramo, adentro: Tramo) => adentro[0] >= afuera[0] && adentro[1] <= afuera[1]

/**
 * Lo que se quiere reservar choca con alguna ocupación del mismo día. Con
 * `margen` (minutos de limpieza o descanso), cada ocupación se agranda hacia
 * los dos lados antes de comparar.
 */
export function chocaCon(nueva: Ocupacion, ocupadas: Ocupacion[], margen = 0): Ocupacion | null {
  for (const o of ocupadas) {
    if (o.fecha !== nueva.fecha) continue
    if (nueva.id && o.id === nueva.id) continue
    if (seSolapan([nueva.inicio, nueva.fin], [o.inicio - margen, o.fin + margen])) return o
  }
  return null
}

/** Une tramos que se tocan o se pisan, ordenados. */
export function unir(tramos: Tramo[]): Tramo[] {
  const orden = [...tramos].filter(tramoValido).sort((a, b) => a[0] - b[0])
  const out: Tramo[] = []
  for (const t of orden) {
    const ultimo = out[out.length - 1]
    if (ultimo && t[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], t[1])
    else out.push([t[0], t[1]])
  }
  return out
}

/** Lo que queda de `base` después de sacarle `quitar`. */
export function restar(base: Tramo, quitar: Tramo[]): Tramo[] {
  let libres: Tramo[] = [base]
  for (const q of unir(quitar)) {
    libres = libres.flatMap(l => {
      if (!seSolapan(l, q)) return [l]
      const out: Tramo[] = []
      if (q[0] > l[0]) out.push([l[0], q[0]])
      if (q[1] < l[1]) out.push([q[1], l[1]])
      return out
    })
  }
  return libres
}

/** Cuántos minutos suman los tramos (ya unidos). */
export const minutosDe = (tramos: Tramo[]) => unir(tramos).reduce((s, [a, b]) => s + (b - a), 0)
