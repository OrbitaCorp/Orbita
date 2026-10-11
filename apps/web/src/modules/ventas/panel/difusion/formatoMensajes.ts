// Cómo se muestran las fechas y los nombres en la bandeja de mensajes de Instagram (Difusión → Mensajes).

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** "14:32" */
export function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "Hoy", "Ayer" o "12 oct" (con el año si es de otro año): el separador entre días de una conversación. */
export function diaDe(iso: string, ahora: number = Date.now()): string {
  const fecha = new Date(iso)
  const hoy = new Date(ahora)
  if (mismoDia(fecha, hoy)) return 'Hoy'
  if (mismoDia(fecha, new Date(ahora - DIA))) return 'Ayer'
  const base = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
  return fecha.getFullYear() === hoy.getFullYear() ? base : `${base} ${fecha.getFullYear()}`
}

/** Hace cuánto fue, corto, para la lista de conversaciones: "ahora", "5 min", "3 h", "2 d" o la fecha. */
export function cuandoFue(iso: string, ahora: number = Date.now()): string {
  const pasado = Math.max(0, ahora - new Date(iso).getTime())
  if (pasado < MIN) return 'ahora'
  if (pasado < HORA) return `${Math.floor(pasado / MIN)} min`
  if (pasado < DIA) return `${Math.floor(pasado / HORA)} h`
  if (pasado < 7 * DIA) return `${Math.floor(pasado / DIA)} d`
  return diaDe(iso, ahora)
}

/** Hasta dos letras para el avatar: "Ana Paz" → "AP", "@tienda_x" → "T". */
export function iniciales(nombre: string): string {
  const palabras = nombre.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean)
  const letras = palabras.slice(0, 2).map((p) => p.charAt(0))
  return (letras.join('') || '?').toUpperCase()
}
