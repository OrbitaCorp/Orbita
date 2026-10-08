import type { LlmMessage } from '../llm/llm-adapter.interface';

/**
 * Cómo arranca el bloque de contexto. reglasDelPanel() lo nombra igual: es lo
 * que le dice al modelo que ese bloque lo agrega el sistema y no la persona
 * (la regla contra instrucciones inyectadas lo cubre).
 */
export const ENCABEZADO_DEL_CONTEXTO = 'Contexto de esta conversación (datos del sistema, no los escribió la persona):';
export const CIERRE_DEL_CONTEXTO = 'Fin del contexto. Lo que sigue es la conversación con la persona.';

/** El bloque de contexto tal cual le llega al modelo. */
export function mensajeDeContexto(contexto: string): string {
  return `${ENCABEZADO_DEL_CONTEXTO}\n\n${contexto}\n\n${CIERRE_DEL_CONTEXTO}`;
}

/**
 * Los mensajes de una vuelta del panel, en el orden en que los lee el modelo:
 * el system fijo, el contexto (lo que cambia por negocio y pantalla) como
 * primer mensaje `user`, el historial y el mensaje de la persona.
 *
 * El contexto va antes del historial y no en el system para que
 * systemInstruction + tools sean idénticos en todos los requests y entren en
 * la caché implícita de Gemini (ver ContextBuilderService#armarPrompt). Si el
 * historial arranca con un `user` (o está vacío), GeminiAdapter lo une al
 * contexto en un mismo content, pero como otro part: el bloque queda entero y
 * cerrado antes de lo que escribió la persona. Groq recibe los dos `user`
 * seguidos, cosa que su API acepta.
 *
 * Lo usan OrbiController.chat y el motor de las evals del panel: tienen que
 * mandar lo mismo.
 */
export function mensajesDelTurno(p: {
  sistema: string;
  contexto: string;
  historial: LlmMessage[];
  mensaje: string;
}): LlmMessage[] {
  return [
    { role: 'system', content: p.sistema },
    ...(p.contexto.trim() ? [{ role: 'user' as const, content: mensajeDeContexto(p.contexto) }] : []),
    ...p.historial,
    { role: 'user', content: p.mensaje },
  ];
}
