import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

// Workers AI de Cloudflare como proveedor de chat con herramientas, por su endpoint compatible con OpenAI. Misma cuenta y
// mismo token que ya usa la generación de imágenes (R2_ACCOUNT_ID + CF_WORKERS_AI_API_TOKEN, que necesita el permiso de
// Workers AI). Sin streaming a propósito: las respuestas de WhatsApp son cortas y se mandan enteras.
//
// Es un eslabón de respaldo (ver llmAdapterDelBotProvider): si Groq se cae, sigue este; si este también, Gemini.

export const WORKERS_AI_MODELO_POR_DEFECTO = '@cf/openai/gpt-oss-120b';

interface RespuestaCompatible {
  choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; completion_tokens_details?: { reasoning_tokens?: number } };
}

@Injectable()
export class WorkersAiAdapter implements LlmAdapter {
  constructor(private readonly config: ConfigService) {}

  get modelo(): string {
    return this.config.get<string>('CF_LLM_MODEL') ?? WORKERS_AI_MODELO_POR_DEFECTO;
  }

  /** Si hay con qué hablar con Workers AI (cuenta y token cargados). */
  get configurado(): boolean {
    return !!this.config.get<string>('R2_ACCOUNT_ID') && !!this.config.get<string>('CF_WORKERS_AI_API_TOKEN');
  }

  async *streamChat(params: { messages: LlmMessage[]; tools?: LlmToolDefinition[]; model?: string; signal?: AbortSignal }): AsyncGenerator<LlmEvent> {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const token = this.config.get<string>('CF_WORKERS_AI_API_TOKEN');
    if (!accountId || !token) throw new ServiceUnavailableException('Workers AI no está configurado');

    const modelo = this.modelo; // el `model` que llega es un ID de Gemini: se ignora
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: params.signal,
      body: JSON.stringify({
        model: modelo,
        messages: params.messages.map((m) => {
          if (m.role === 'tool') return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
          if (m.role === 'assistant' && m.toolCalls?.length) {
            return {
              role: 'assistant',
              content: m.content || null,
              tool_calls: m.toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } })),
            };
          }
          return { role: m.role, content: m.content };
        }),
        ...(params.tools?.length ? { tools: params.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) } : {}),
        temperature: 0.3,
        max_tokens: 1024,
        stream: false,
      }),
    });
    if (!res.ok) {
      // Con el status, esErrorDeDisponibilidad decide si se cae al siguiente proveedor (429 y 5xx sí; un 400 o 401 no).
      throw new HttpException(`Workers AI respondió ${res.status}`, res.status);
    }
    const json = (await res.json()) as RespuestaCompatible & { result?: RespuestaCompatible };
    const data = json.result ?? json;
    const mensaje = data.choices?.[0]?.message;

    if (mensaje?.content) yield { type: 'text', chunk: mensaje.content };
    for (const [i, tc] of (mensaje?.tool_calls ?? []).entries()) {
      if (!tc.function?.name) continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        /* argumentos mal formados: la herramienta los valida y devuelve el error al modelo */
      }
      yield { type: 'tool_call', call: { id: tc.id ?? `wai-${i}`, name: tc.function.name, arguments: args } };
    }
    if (data.usage?.prompt_tokens !== undefined) {
      yield {
        type: 'usage',
        usage: {
          model: modelo,
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          cachedTokens: data.usage.prompt_tokens_details?.cached_tokens ?? 0,
          thinkingTokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
          provider: 'workers-ai',
        },
      };
    }
    yield { type: 'done' };
  }
}
