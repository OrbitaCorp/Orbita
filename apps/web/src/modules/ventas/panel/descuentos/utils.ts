const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// Hoy en "YYYY-MM-DD", comparable directo con los `fechaFin`/`fechaInicio`
// del formulario (que también son "YYYY-MM-DD"). Se usa la fecha UTC a
// propósito: el backend guarda las fechas del descuento como medianoche UTC
// y compara contra `Date.now()`, así que una fecha de fin igual a hoy (UTC)
// para el backend ya pasó.
export function hoyISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function generarCodigoCupon(): string {
  let codigo = 'PROMO-'
  for (let i = 0; i < 4; i++) {
    codigo += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return codigo
}

export function isoADisplay(iso: string | null): string {
  if (!iso) return ''
  // El backend manda ISO completo ("2025-06-01T00:00:00.000Z"); se corta la
  // parte de fecha ANTES de partir por "-". Sin el split('T') el día quedaba
  // "01T00:00:00.000Z". No se usa `new Date` a propósito: parsear el ISO como
  // UTC y formatear en AR (UTC-3) correría la fecha un día para atrás.
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// Rango compacto para la columna "Vigencia" de las tablas/cards de descuentos y
// cupones: "01/06 – 30/06/2025" (omite el año del inicio si coincide con el
// fin), o "01/06/2025 – ∞" si no hay fecha de fin (sin vencimiento). Antes
// esta lógica estaba duplicada en CuponesTabla.tsx, CuponCardMobile.tsx y
// DescuentosTabla.tsx — dos de esas tres copias nunca recibieron el fix del
// split('T') de isoADisplay y mostraban "01T00:00:00.000Z/06/2025".
export function fmtRangoVigencia(inicio: string, fin: string | null): string {
  const [yi, mi, di] = inicio.split('T')[0].split('-')
  if (!fin) return `${di}/${mi}/${yi} – ∞`
  const [yf, mf, df] = fin.split('T')[0].split('-')
  return yi === yf ? `${di}/${mi} – ${df}/${mf}/${yf}` : `${di}/${mi}/${yi} – ${df}/${mf}/${yf}`
}

// ─── Oferta relámpago: fecha y hora exactas ──────────────────────────────────
// La API guarda el fin de la oferta como un instante ISO (UTC). El formulario
// lo maneja como dos campos en hora LOCAL del navegador ("YYYY-MM-DD" y
// "HH:mm"), que es lo que el dueño tiene en la cabeza. No se usa
// toISOString().slice() para ir al local: en Argentina (UTC-3) mostraría la
// oferta terminando tres horas antes de lo que se cargó.

export function instanteALocal(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { fecha: '', hora: '' }
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    fecha: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

// "YYYY-MM-DD" + "HH:mm" locales → instante ISO. `new Date('YYYY-MM-DDTHH:mm')`
// (sin zona) se interpreta en hora local, que es lo que se quiere acá.
export function localAInstante(fecha: string, hora: string): string | null {
  if (!fecha || !hora) return null
  const d = new Date(`${fecha}T${hora}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// "12/09/2026 23:59" en hora local, para el listado y el detalle.
export function fmtFechaHora(iso: string): string {
  const { fecha, hora } = instanteALocal(iso)
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y} ${hora}`
}

// Cuánto falta, compacto: "2d 4h", "4h 12m", "12m", "menos de 1m". Vacío si ya
// pasó — quien lo llama decide qué mostrar en ese caso.
export function fmtFalta(finMs: number, ahoraMs: number): string {
  const ms = finMs - ahoraMs
  if (ms <= 0) return ''
  const min = Math.floor(ms / 60000)
  const dias = Math.floor(min / 1440)
  const horas = Math.floor((min % 1440) / 60)
  const mins = min % 60
  if (dias > 0) return `${dias}d ${horas}h`
  if (horas > 0) return `${horas}h ${mins}m`
  if (mins > 0) return `${mins}m`
  return 'menos de 1m'
}

export function displayAIso(display: string): string | null {
  if (!display || display.length < 10) return null
  const [d, m, y] = display.split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Restringe lo que se puede escribir en el input de porcentaje: sin signo
// negativo, tope en 100. El atributo min/max del <input type="number"> no
// alcanza — el navegador lo deja escribir igual, solo afecta las flechitas y
// la validación al enviar el form.
export function sanitizarPorcentaje(raw: string): string {
  const sinSigno = raw.replace(/-/g, '')
  if (sinSigno === '') return ''
  const num = Number(sinSigno)
  if (Number.isNaN(num)) return sinSigno
  return num > 100 ? '100' : sinSigno
}

// Mismo problema que sanitizarPorcentaje pero para montos fijos: sin tope
// superior (depende del precio del producto/ticket), pero tampoco negativo.
export function sanitizarMonto(raw: string): string {
  return raw.replace(/-/g, '')
}

// Al enviar el form, los errores de validación se marcan en rojo en su campo,
// pero si ese campo quedó arriba (fuera de la vista tras bajar el scroll) el
// usuario no lo ve y no entiende por qué "Crear" no hizo nada. Esto hace
// scroll suave hasta la primera sección con error, siguiendo el orden visual
// del form (no el de inserción del objeto de errores, que no está garantizado).
export function scrollToFirstErrorSection(
  errores: Record<string, string>,
  mapa: { keys: string[]; sectionId: string }[]
): void {
  const seccion = mapa.find(({ keys }) => keys.some((k) => errores[k]))
  if (!seccion) return
  document.getElementById(seccion.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
