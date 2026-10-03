// Orbi en mantenimiento (spec 2026-10-01-orbi-mantenimiento-automatico): la API
// lo avisa de tres formas y el chat las convierte en un solo estado, que se
// muestra como un aviso fijo arriba del input y no como un mensaje más en cada
// envío. Funciones puras: useOrbiChat y useDisponibilidadOrbi solo las aplican.

const CODIGO = 'ORBI_MAINTENANCE'

export const MENSAJE_MANTENIMIENTO_POR_DEFECTO =
  'Orbi está en mantenimiento por un problema técnico. Ya avisamos al equipo.'

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mensajeDe(cuerpo: Record<string, unknown>): string {
  return typeof cuerpo.message === 'string' && cuerpo.message.trim() ? cuerpo.message : MENSAJE_MANTENIMIENTO_POR_DEFECTO
}

/** Respuesta no-OK de POST /orbi/chat: el 503 que corta antes de abrir el stream. */
export function mantenimientoDeLaRespuesta(status: number, cuerpo: unknown): string | null {
  if (status !== 503 || !esRegistro(cuerpo) || cuerpo.error !== CODIGO) return null
  return mensajeDe(cuerpo)
}

/** Evento `error` del stream: la falla de este turno dejó a Orbi en mantenimiento. */
export function mantenimientoDelEvento(datos: unknown): string | null {
  if (!esRegistro(datos) || datos.code !== CODIGO) return null
  return mensajeDe(datos)
}

/**
 * GET /orbi/estado. Devuelve el estado nuevo, o `undefined` si no se sabe: red
 * caída, API vieja sin el endpoint (404) o una respuesta rara. En ese caso no
 * se toca lo que hubiera, para no esconder un aviso real ni inventar uno.
 */
export function disponibilidadDeLaRespuesta(ok: boolean, cuerpo: unknown): { mantenimiento: string | null } | undefined {
  if (!ok || !esRegistro(cuerpo) || typeof cuerpo.disponible !== 'boolean') return undefined
  if (cuerpo.disponible) return { mantenimiento: null }
  const mensaje = typeof cuerpo.mensaje === 'string' && cuerpo.mensaje.trim() ? cuerpo.mensaje : MENSAJE_MANTENIMIENTO_POR_DEFECTO
  return { mantenimiento: mensaje }
}

/** Mientras dura el aviso se vuelve a preguntar cada tanto, para que se vaya solo cuando un admin lo rehabilita. */
export const REVISAR_MANTENIMIENTO_CADA_MS = 60_000
