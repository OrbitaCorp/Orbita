// Reglas puras del chat de Orbi que dependen de la "sesión" del store y de la
// superficie (panel o wizard). Viven acá, sin fetch ni React, para poder
// probarlas en node: useOrbiChat solo las aplica.
import type { OrbiSurface } from './types'

/**
 * Un stream arrancó con `sesionAlEnviar`; si mientras tanto hubo un reset
 * (Nueva conversación, logout, login de otra persona) la sesión del store ya
 * es otra y todo lo que llegue de ese stream se tira. Sin esto, la respuesta
 * vieja (o su `conversation`) terminaba escrita en el chat de otra persona.
 */
export function debeDescartar(sesionAlEnviar: number, sesionActual: number): boolean {
  return sesionAlEnviar !== sesionActual
}

/**
 * Envuelve el manejador de eventos del stream: cada evento se chequea contra
 * la sesión ACTUAL al momento de llegar (no la del envío), así un reset en el
 * medio corta todo lo que falta, incluido el `conversation`.
 */
export function filtrarPorSesion<E>(
  sesionAlEnviar: number,
  sesionActual: () => number,
  alProcesar: (evento: E) => void,
): (evento: E) => void {
  return (evento) => {
    if (debeDescartar(sesionAlEnviar, sesionActual())) return
    alProcesar(evento)
  }
}

/**
 * El id que manda el evento `conversation`. Solo cuenta en el panel: el
 * wizard es anónimo y no tiene conversación guardada en el servidor.
 */
export function idDeConversacionDelEvento(surface: OrbiSurface, data: unknown): string | null {
  if (surface !== 'panel') return null
  const id = (data as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
}

/**
 * Qué `conversationId` va en el body del POST. Solo el panel lo manda; sin id
 * (conversación nueva) se omite y el servidor crea una.
 */
export function conversationIdParaEnviar(surface: OrbiSurface, id: string | null): string | undefined {
  return surface === 'panel' && id ? id : undefined
}

/**
 * Un corte pedido por nosotros (Detener, cerrar el panel, reset) llega como
 * `AbortError` desde fetch o desde el lector. No es un error de conexión y no
 * se tiene que mostrar como tal.
 */
export function esAborto(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
}
