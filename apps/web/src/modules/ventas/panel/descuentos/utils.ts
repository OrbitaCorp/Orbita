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

export function displayAIso(display: string): string | null {
  if (!display || display.length < 10) return null
  const [d, m, y] = display.split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}
