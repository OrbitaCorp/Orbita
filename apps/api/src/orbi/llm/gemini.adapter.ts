import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import { createGeminiClient, DEFAULT_MODEL } from './gemini-client';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

// Los valores con los que corre Orbi hoy. Se pueden pisar por env — no para
// cambiarlos en caliente en producción, sino para que la suite de evals
// (test/evals/) pueda correr los mismos casos contra otro modelo o con más
// razonamiento y comparar, sin tocar código ni duplicar la lógica del adapter.
//
// Migrado de Groq (openai/gpt-oss-120b) a Gemini el 2026-09-08. El baseline de
// evals de RBT-686 era contra Groq: hay que re-correr la suite
// (`pnpm test:evals --repeticiones=5`) para tener el baseline nuevo con Gemini
// antes de decidir si el panel necesita un modelo pro.
const MODELO_POR_DEFECTO = DEFAULT_MODEL;
const TEMPERATURA_POR_DEFECTO = 0.3;
const RAZONAMIENTO_POR_DEFECTO = 'low';

@Injectable()
export class GeminiAdapter implements LlmAdapter {
  private readonly logger = new Logger(GeminiAdapter.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  /** El modelo por defecto de este proceso. La eval lo imprime en el reporte. */
  get modelo(): string {
    return this.config.get<string>('ORBI_MODEL') ?? MODELO_POR_DEFECTO;
  }

  private get temperatura(): number {
    const crudo = this.config.get<string>('ORBI_TEMPERATURE');
    const n = crudo === undefined ? NaN : Number(crudo);
    return Number.isFinite(n) ? n : TEMPERATURA_POR_DEFECTO;
  }

  private get razonamiento(): 'low' | 'medium' | 'high' {
    const v = this.config.get<string>('ORBI_REASONING_EFFORT');
    return v === 'medium' || v === 'high' || v === 'low' ? v : RAZONAMIENTO_POR_DEFECTO;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = createGeminiClient(this.config);
    }
    return this.client;
  }

  async *streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    model?: string;
  }): AsyncGenerator<LlmEvent> {
    const client = this.getClient();
    const modeloEfectivo = params.model ?? this.modelo;

    const geminiTools = params.tools?.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const stream = await client.chat.completions.create({
      model: modeloEfectivo,
      messages: params.messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId! };
        }
        // Un mensaje de assistant que llamó una tool tiene que reconstruirse
        // con su `tool_calls` original — si se manda como texto plano (sin
        // tool_calls) el siguiente mensaje `tool` queda "huérfano" (responde
        // a un tool_call_id que no aparece en ningún tool_calls anterior) y
        // la API rechaza el request entero.
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant' as const,
            content: m.content || null,
            tool_calls: m.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          };
        }
        return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
      }),
      tools: geminiTools?.length ? geminiTools : undefined,
      stream: true,
      // El trabajo de Orbi es elegir de una lista cerrada y llamar la tool con
      // el key exacto — no escribir prosa creativa. Sin este parámetro el
      // default de la API es alto, que alimenta los dos síntomas que venimos
      // parcheando a mano: opciones inventadas que no están en availableOptions,
      // y formato que se desvía (JSON/tags como texto, que el front tiene que
      // limpiar en cleanToolLeaks).
      temperature: this.temperatura,
      reasoning_effort: this.razonamiento,
      max_completion_tokens: 4096,
      // Sin esto el stream no trae el chunk de consumo (choices vacío + `usage`).
      stream_options: { include_usage: true },
    });

    let currentToolCall: { id: string; name: string; argsJson: string } | null = null;
    let usage: { promptTokens: number; completionTokens: number } | null = null;

    for await (const chunk of stream) {
      // El chunk con el consumo viene con `choices: []`, así que tiene que
      // leerse antes del `continue` de abajo o se pierde entero.
      const u = chunk.usage as
        { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
      if (u?.prompt_tokens !== undefined) {
        usage = {
          promptTokens: u.prompt_tokens ?? 0,
          completionTokens: u.completion_tokens ?? 0,
        };
      }

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

    if (usage) {
      yield { type: 'usage', usage: { model: modeloEfectivo, ...usage } };
    }

    yield { type: 'done' };
  }
}
