// Reglas puras del chat de Orbi que dependen de la "sesión" del store y de la
// superficie (panel o wizard). Viven acá, sin fetch ni React, para poder
// probarlas en node: useOrbiChat solo las aplica.
import type { OrbiAction, OrbiMessage, OrbiSurface } from './types'

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
 * Un envío sigue mandando sobre el chat solo si no hubo reset (misma sesión)
 * y ningún envío posterior lo reemplazó (mismo número de envío). Un chip del
 * wizard puede mandar otro mensaje mientras Orbi responde: el envío viejo se
 * corta y desde ahí no puede escribir ni bajar el "escribiendo" del nuevo.
 */
export function esEnvioVigente(
  sesionAlEnviar: number,
  sesionActual: number,
  envioPropio: number,
  envioActual: number,
): boolean {
  return !debeDescartar(sesionAlEnviar, sesionActual) && envioPropio === envioActual
}

/**
 * Envuelve el manejador de eventos del stream: cada evento se chequea con
 * `vigente()` al momento de llegar (no al enviar), así un reset o un envío
 * nuevo en el medio corta todo lo que falta, incluido el `conversation`.
 */
export function soloSiVigente<E>(
  vigente: () => boolean,
  alProcesar: (evento: E) => void,
): (evento: E) => void {
  return (evento) => {
    if (!vigente()) return
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

/**
 * Si un corte deja la burbuja con la marca "Detenido". Apretar Detener entre
 * `done` y el cierre del stream (el wizard todavía manda `turn`) corta la
 * lectura, pero la respuesta ya estaba completa: marcarla sería mentir.
 */
export function seMarcaDetenido(fueCorte: boolean, recibioDone: boolean): boolean {
  return fueCorte && !recibioDone
}

/** La tarjeta de confirmar: toda acción que el servidor dejó pendiente con un id. */
export function esTarjetaDeAccion(a: OrbiAction): boolean {
  return !!a.actionId
}

/** Botón "Ir a …" de navigateTo. */
export function esNavegacion(a: OrbiAction): boolean {
  return a.status === 'complete' && typeof a.data === 'object' && a.data !== null && 'path' in a.data
}

/** Botón "Elegir …" del wizard. */
export function esSeleccionDelWizard(a: OrbiAction): boolean {
  return a.status === 'complete' && a.tool === 'selectWizardOption' && !!a.data
}

/**
 * Una burbuja cortada sin texto dice "No llegué a responder." salvo que ya
 * muestre alguna tarjeta o botón: ahí Orbi sí respondió algo (propuso una
 * acción, ofreció ir a una pantalla) y la frase contradiría lo que se ve.
 */
export function muestraNoLlegueAResponder(msg: OrbiMessage): boolean {
  if (!msg.detenido || msg.content.trim()) return false
  return !(msg.actions ?? []).some(a => esTarjetaDeAccion(a) || esNavegacion(a) || esSeleccionDelWizard(a))
}

// El modelo de 20B a veces escribe la sintaxis del tool call como texto plano
// además de llamar la herramienta real (ej: "selectWizardOption({ key: ... })").
// Lo limpiamos en el render para que el usuario no vea código.
export function cleanToolLeaks(text: string): string {
  return text
    .replace(/\b[a-z][a-zA-Z]*\(\s*\{[\s\S]*?\}\s*\)/g, '')
    .replace(/```(?:json)?\s*\{[^`]*\}\s*```/g, '')
    .replace(/\{\{[a-zA-Z]+[^}]*\}\}/g, '')
    .replace(/<[a-z][a-zA-Z]*\s[^>]*>[\s\S]*?<\/[a-z][a-zA-Z]*>/gi, '')
    .replace(/<\/?[a-z][a-zA-Z]*(?:[:\s][^>]*)?\/?>/gi, '')
    .replace(/\n?\s*\{[^{}]*"?(?:key|label|field|value|rubro|keywords|businessName)"?[^{}]*\}/g, '')
    .replace(/\[(?:Seleccionar|Elegir|Select)[^\]]*\]/gi, '')
    .replace(/\b(?:selectWizardOption|fillWizardField|suggestBusinessName|suggestDescription)\s*\n(?:[a-z]\w*:\s*[^\n]+\n?)+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
