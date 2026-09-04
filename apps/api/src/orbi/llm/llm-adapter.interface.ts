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
  }): AsyncGenerator<LlmEvent>;
}

export const LLM_ADAPTER = Symbol('LLM_ADAPTER');
