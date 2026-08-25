export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
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
