export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Para role 'tool': a qué tool_call responde. */
  toolCallId?: string;
  /** Para role 'assistant': las tools que llamó en este turno (si las hubo). */
  toolCalls?: LlmToolCall[];
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /**
   * Firma opaca que Gemini 3.x adjunta a cada functionCall. Hay que devolverla
   * tal cual al reconstruir el historial del turno o la API tira 400
   * ("Function call is missing a thought_signature"). Otros proveedores no la
   * usan: queda undefined.
   */
  thoughtSignature?: string;
}

/** Consumo de un turno. Un turno con tools son varias llamadas: se suman. */
export interface LlmUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export type LlmEvent =
  | { type: 'text'; chunk: string }
  | { type: 'tool_call'; call: LlmToolCall }
  // Llega al final del stream, antes de 'done'. Opcional por contrato: un
  // adapter que no pueda informar consumo simplemente no lo emite, y quien
  // escucha guarda null en vez de un número inventado.
  | { type: 'usage'; usage: LlmUsage }
  | { type: 'done' };

export interface LlmAdapter {
  streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    /**
     * Modelo a usar en esta llamada. Si no viene, el adapter usa su default
     * (env ORBI_MODEL o el hardcodeado). Lo pasa el controller para elegir un
     * modelo distinto por superficie (panel vs wizard).
     */
    model?: string;
  }): AsyncGenerator<LlmEvent>;
}

export const LLM_ADAPTER = Symbol('LLM_ADAPTER');
