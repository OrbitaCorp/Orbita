// Formatos chicos que comparten las pantallas de Difusión (comentarios y estadísticas).

/** "recién", "hace 5 min", "hace 3 h", "ayer", "hace 4 días" o la fecha ("12 oct") si pasó más de una semana. */
export function haceCuanto(iso: string | null | undefined, ahora: number = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const min = Math.floor((ahora - t) / 60_000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 2) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
}

/** Número con puntos de miles; "—" si todavía no hay dato. */
export function numero(n: number | null | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('es-AR') : '—'
}

/** Cuánto cambió respecto del período anterior, en %; null si falta alguno de los dos números o el anterior es cero. */
export function variacion(actual: number | null | undefined, anterior: number | null | undefined): number | null {
  if (actual === null || actual === undefined || anterior === null || anterior === undefined || anterior <= 0) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}

/** Recorta un texto largo a `max` caracteres (sin cortar a mitad de palabra si se puede) y lo marca con "…". */
export function resumir(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max - 1)
  const ultimoEspacio = corte.lastIndexOf(' ')
  return `${(ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`
}
