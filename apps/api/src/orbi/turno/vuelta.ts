import type { LlmMessage, LlmToolCall } from '../llm/llm-adapter.interface';

// Piezas del loop de un turno de Orbi que comparten OrbiController y el runner
// de evals del panel (test/evals/panel/run.ts). Viven acá y no en el controller
// para que la eval mida exactamente lo que corre en producción: una copia del
// mensaje que recibe el modelo, o del armado del historial, se desactualiza en
// silencio y la eval pasa a medir un Orbi que no existe.

/** Llamadas al modelo por mensaje (cada tool es otra vuelta). */
export const MAX_VUELTAS_TOOLS = 6;

/** Lo que ve la persona cuando una respuesta encadena más vueltas que el tope. */
export const MENSAJE_VUELTAS = 'No pude terminar esto en un solo paso. Probá pidiéndolo de nuevo, más concreto.';

/**
 * Lo que recibe el modelo cuando pide una escritura que no puede proponerse
 * (demo, sin permiso, fuera del panel). Fijo y sin detalles. Dice que NO hay
 * tarjeta: en una corrida, con el texto viejo, Orbi le contestó a un empleado
 * sin permiso "te dejo la confirmación en la tarjeta" sin que hubiera ninguna.
 */
export const ESCRITURA_NO_DISPONIBLE = 'No se hizo nada y no hay tarjeta para confirmar: esta persona no tiene permiso para esa acción o no está disponible desde acá. Decíselo así, sin prometer una tarjeta.';
export const ESCRITURA_EN_DEMO = 'En la demo no se pueden hacer cambios';

/**
 * Lo que ve el modelo cuando una escritura quedó propuesta. Importa que diga
 * que quedó PENDIENTE y no que falló: si le decimos que falló, reintenta en
 * loop; si le decimos que salió bien, le cuenta al usuario que ya está hecho
 * cuando todavía no apretó nada.
 */
export const RESPUESTA_DE_PROPUESTA = {
  estado: 'pendiente_de_confirmacion',
  mensaje:
    'La acción NO se ejecutó todavía. El usuario tiene en pantalla un botón para confirmarla. ' +
    'Contale en una línea qué va a pasar si lo aprieta. No digas que ya está hecho.',
} as const;

/**
 * Junta las tool calls de UNA vuelta del modelo y sus resultados, para
 * devolverlos al historial todos juntos cuando la vuelta termina.
 *
 * Gemini 3.x pide varias tools en paralelo en una misma vuelta (ej.
 * getSalesReport + getProductReport para "resumen de los últimos 7 días") y
 * solo la PRIMERA functionCall trae thoughtSignature. Si cada call vuelve como
 * su propio par assistant/tool, la segunda queda primera de su turno sin firma
 * y Gemini rechaza el request entero con 400 INVALID_ARGUMENT ("Function call
 * is missing a thought_signature"): el usuario ve "Error procesando tu
 * mensaje". La regla de Gemini es UN turno del modelo con todas las calls en
 * el orden en que llegaron (cada una con la firma tal cual vino) y después las
 * respuestas en ese mismo orden. Por eso: un solo assistant con todas las
 * calls y un tool por call; GeminiAdapter une los tool consecutivos en un solo
 * content con todos los functionResponse, y para Groq es el formato nativo.
 *
 * Las tools se siguen ejecutando (o proponiendo) apenas llega cada call, con
 * los mismos eventos al front: lo único que se difiere es el armado del
 * historial.
 */
export function vueltaDeTools() {
  const calls: LlmToolCall[] = [];
  const resultados: LlmMessage[] = [];
  return {
    responder(call: LlmToolCall, content: string) {
      calls.push({ id: call.id, name: call.name, arguments: call.arguments, thoughtSignature: call.thoughtSignature });
      resultados.push({ role: 'tool', content, toolCallId: call.id });
    },
    volcarEn(messages: LlmMessage[]) {
      if (!calls.length) return;
      messages.push({ role: 'assistant', content: '', toolCalls: calls }, ...resultados);
    },
  };
}
