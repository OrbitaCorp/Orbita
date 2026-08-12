const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

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
