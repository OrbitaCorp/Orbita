import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

// Los valores con los que corre Orbi hoy. Se pueden pisar por env — no para
// cambiarlos en caliente en producción, sino para que la suite de evals
// (test/evals/) pueda correr los mismos casos contra otro modelo o con más
// razonamiento y comparar, sin tocar código ni duplicar la lógica del adapter.
// 120b y no 20b desde el 2026-09-04. El 20b escribe el botón como marcado
// (<selectWizardOption .../>, <button data-function=...>) en vez de llamar la
// herramienta: el usuario ve texto raro y el botón de verdad no aparece. Esa es
// la falla más cara del wizard y es la que se va con el modelo más grande.
//
// Medido con test/evals, sobre 17 casos. Dos corridas independientes dan
// totales distintos (16/17 y 13/17 para el 120b; 14/17 y 12/17 para el 20b) —
// el modelo no es determinista y una sola vuelta por caso no alcanza para
// afirmar un número. Lo que SÍ se repite, y es el motivo del cambio, es el
// desglose por regla: las violaciones de `sin-fugas` pasan de 10 a 1. La
// latencia mediana queda igual o mejor, y el costo extra es de ~USD 2 cada mil
// altas completas. Para cerrar los totales hace falta correr con
// --repeticiones=5 de los dos lados. Ver el informe en RBT-686.
const MODELO_POR_DEFECTO = 'openai/gpt-oss-120b';
const TEMPERATURA_POR_DEFECTO = 0.3;
const RAZONAMIENTO_POR_DEFECTO = 'low';

@Injectable()
export class GroqAdapter implements LlmAdapter {
  private readonly logger = new Logger(GroqAdapter.name);
  private client: Groq | null = null;

  constructor(private readonly config: ConfigService) {}

  /** El modelo efectivo de este proceso. La eval lo imprime en el reporte. */
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
      model: this.modelo,
      messages: params.messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId! };
        }
        // Un mensaje de assistant que llamó una tool tiene que reconstruirse
        // con su `tool_calls` original — si se manda como texto plano (sin
        // tool_calls) el siguiente mensaje `tool` queda "huérfano" (responde
        // a un tool_call_id que no aparece en ningún tool_calls anterior) y
        // Groq/harmony rechaza el request entero con un 400 genérico
        // ("Tools should have a name!"), no algo que se vea en un mensaje de
        // validación claro.
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
      tools: groqTools?.length ? groqTools : undefined,
      stream: true,
      // El trabajo de Orbi es elegir de una lista cerrada y llamar la tool con
      // el key exacto — no escribir prosa creativa. Sin este parámetro el
      // default de la API es 1.0, que es justo lo que alimenta los dos
      // síntomas que venimos parcheando a mano: opciones inventadas que no
      // están en availableOptions, y formato que se desvía (JSON/tags como
      // texto, que el front tiene que limpiar en cleanToolLeaks).
      temperature: this.temperatura,
      reasoning_effort: this.razonamiento,
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
