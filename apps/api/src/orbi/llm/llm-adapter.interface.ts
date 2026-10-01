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
  /**
   * Quién respondió de verdad esta llamada. Lo pone cada adapter (mismo
   * criterio que generarTexto en text-generation.ts): el nombre del modelo no
   * alcanza para saberlo (openai/gpt-oss-120b corre en Groq y no dice "groq"),
   * y como el fallback se decide por llamada, un mismo turno puede mezclar los
   * dos. El metering se separa por esto (spec §3.6).
   */
  provider: 'gemini' | 'groq';
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
    /**
     * Se aborta cuando el cliente cierra la conexión (spec §3.7). El adapter
     * se la pasa al SDK para dejar de leer la respuesta; lo que el proveedor ya
     * generó se factura igual.
     */
    signal?: AbortSignal;
  }): AsyncGenerator<LlmEvent>;
}

export const LLM_ADAPTER = Symbol('LLM_ADAPTER');
