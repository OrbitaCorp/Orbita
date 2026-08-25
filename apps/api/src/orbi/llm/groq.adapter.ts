import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

@Injectable()
export class GroqAdapter implements LlmAdapter {
  private readonly logger = new Logger(GroqAdapter.name);
  private client: Groq | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Groq {
    if (!this.client) {
      const apiKey = this.config.get<string>('GROQ_API_KEY');
      if (!apiKey) throw new ServiceUnavailableException('GROQ_API_KEY no configurada');
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  async *streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
  }): AsyncGenerator<LlmEvent> {
    const client = this.getClient();

    const groqTools = params.tools?.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const stream = await client.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: params.messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId! };
        }
        return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
      }),
      tools: groqTools?.length ? groqTools : undefined,
      stream: true,
      max_completion_tokens: 4096,
    });

    let currentToolCall: { id: string; name: string; argsJson: string } | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: 'text', chunk: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) {
            if (currentToolCall) {
              yield {
                type: 'tool_call',
                call: {
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: JSON.parse(currentToolCall.argsJson || '{}'),
                },
              };
            }
            currentToolCall = { id: tc.id, name: tc.function?.name ?? '', argsJson: '' };
          }
          if (tc.function?.arguments) {
            if (currentToolCall) currentToolCall.argsJson += tc.function.arguments;
          }
        }
      }
    }

    if (currentToolCall) {
      yield {
        type: 'tool_call',
        call: {
          id: currentToolCall.id,
          name: currentToolCall.name,
          arguments: JSON.parse(currentToolCall.argsJson || '{}'),
        },
      };
    }

    yield { type: 'done' };
  }
}
