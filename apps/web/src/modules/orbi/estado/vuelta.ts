// Ida y vuelta entre el lateral y la página de Orbi. Al expandir, la página
// recuerda en la URL (`desde`) la pantalla en la que estaba la persona; al
// salir vuelve ahí con Orbi al costado. Así también funciona en una pestaña
// nueva o al recargar, sin depender del historial del navegador.

/** La URL de la página de Orbi que recuerda de dónde se vino. */
export function paginaDesde(pagina: string, desde: string): string {
  return `${pagina}&desde=${encodeURIComponent(desde)}`
}

/**
 * A dónde vuelve "Salir de la pantalla completa". Solo una ruta interna del
 * panel: `desde` viaja en la URL y cualquiera puede armar un link con otro
 * valor, así que nada de dominios ajenos (`//x`, `https://x`) ni de volver a
 * la misma página de Orbi.
 */
export function rutaDeVuelta(desde: unknown, porDefecto: string): string {
  if (typeof desde !== 'string') return porDefecto
  const valida = desde.startsWith('/') && !desde.startsWith('//') && !desde.includes('\\') && !/^\/[^?#]*:/.test(desde)
  if (!valida) return porDefecto
  const camino = desde.split(/[?#]/)[0]
  if (camino.split('/').pop() === 'orbi') return porDefecto
  return desde
}
