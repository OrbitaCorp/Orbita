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

export type LlmEvent =
  | { type: 'text'; chunk: string }
  | { type: 'tool_call'; call: LlmToolCall }
  | { type: 'done' };

export interface LlmAdapter {
  streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
  }): AsyncGenerator<LlmEvent>;
}

export const LLM_ADAPTER = Symbol('LLM_ADAPTER');
