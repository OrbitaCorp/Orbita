import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Content, GoogleGenAI, Part } from '@google/genai';
import { createGeminiClient, DEFAULT_MODEL, thinkingLevelFor } from './gemini-client';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

// Migrado de Groq a Gemini el 2026-09-08, SDK nativo @google/genai (no el
// endpoint OpenAI-compat: rechaza las API keys nuevas `AQ.`). El baseline de
// evals de RBT-686 era contra Groq: hay que re-correr `pnpm test:evals
// --repeticiones=5` con Gemini antes de decidir si el panel necesita otro modelo.
const MODELO_POR_DEFECTO = DEFAULT_MODEL;
const TEMPERATURA_POR_DEFECTO = 0.3;
const RAZONAMIENTO_POR_DEFECTO = 'low';

@Injectable()
export class GeminiAdapter implements LlmAdapter {
  private readonly logger = new Logger(GeminiAdapter.name);
  private client: GoogleGenAI | null = null;

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

  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = createGeminiClient(this.config);
    }
    return this.client;
  }

  async *streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    model?: string;
    signal?: AbortSignal;
  }): AsyncGenerator<LlmEvent> {
    const client = this.getClient();
    const modeloEfectivo = params.model ?? this.modelo;

    // Gemini separa el system prompt (systemInstruction) del historial, y el
    // rol del asistente se llama 'model'. Una tool call es un `functionCall`
    // part en un mensaje 'model'; su resultado es un `functionResponse` part en
    // el mensaje 'user' siguiente, correlacionado por NOMBRE (no por id como en
    // OpenAI) — de ahí este map id→nombre.
    const nombrePorId = new Map<string, string>();
    for (const m of params.messages) {
      for (const tc of m.toolCalls ?? []) nombrePorId.set(tc.id, tc.name);
    }

    const systemInstruction = params.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n') || undefined;

    // Historial bien formado (spec §3.3): un turno fallido o cortado deja dos
    // `user` seguidos en la conversación guardada, y una respuesta vacía queda
    // como `assistant` vacío. Gemini espera turnos que alternan y sin partes
    // vacías, así que los mensajes vacíos se descartan y los consecutivos del
    // MISMO rol de Gemini se unen en un solo content, con sus parts en orden.
    // El rol de Gemini y no el nuestro: un resultado de tool y un mensaje del
    // usuario son los dos 'user' para Gemini, y seguidos también rompen la
    // alternancia.
    const contents: Content[] = [];
    const agregar = (content: Content) => {
      const ultimo = contents[contents.length - 1];
      if (ultimo && ultimo.role === content.role) {
        ultimo.parts = [...(ultimo.parts ?? []), ...(content.parts ?? [])];
      } else {
        contents.push(content);
      }
    };

    for (const m of params.messages) {
      if (m.role === 'system') continue;

      if (m.role === 'user') {
        if (!m.content?.trim()) continue;
        agregar({ role: 'user', parts: [{ text: m.content }] });
        continue;
      }

      if (m.role === 'assistant') {
        const parts: Part[] = [];
        if (m.content?.trim()) parts.push({ text: m.content });
        for (const tc of m.toolCalls ?? []) {
          parts.push({
            functionCall: { name: tc.name, args: tc.arguments },
            ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
          });
        }
        if (!parts.length) continue;
        agregar({ role: 'model', parts });
        continue;
      }

      // role === 'tool'
      let parsed: unknown;
      try {
        parsed = JSON.parse(m.content);
      } catch {
        parsed = m.content;
      }
      agregar({
        role: 'user',
        parts: [{
          functionResponse: {
            name: (m.toolCallId && nombrePorId.get(m.toolCallId)) || 'unknown',
            response: { output: parsed },
          },
        }],
      });
    }

    const functionDeclarations = params.tools?.map(t => ({
      name: t.name,
      description: t.description,
      parametersJsonSchema: t.parameters,
    }));

    // Caché implícita: Gemini reusa el prefijo idéntico más largo entre
    // requests (desde 4096 tokens en 3.x Flash). En el panel el system es
    // solo lo fijo y lo que cambia por negocio y pantalla llega como primer
    // mensaje de `contents` (mensajesDelTurno), y las tools van en orden fijo
    // (ToolRegistryService.getTools): systemInstruction + tools son idénticos
    // entre requests, pongan Google el orden que ponga.
    const stream = await client.models.generateContentStream({
      model: modeloEfectivo,
      contents,
      config: {
        systemInstruction,
        // El trabajo de Orbi es elegir de una lista cerrada y llamar la tool
        // con el key exacto — no escribir prosa creativa. Temperatura baja para
        // no alimentar los síntomas que veníamos parcheando a mano (opciones
        // inventadas, formato que se desvía).
        temperature: this.temperatura,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: thinkingLevelFor(this.razonamiento) },
        ...(functionDeclarations?.length ? { tools: [{ functionDeclarations }] } : {}),
        // Spec §3.7: el cliente se fue. En @google/genai el corte es solo del
        // lado nuestro (deja de leer y cierra la conexión): Google no cancela
        // la generación, así que lo ya generado se factura igual. Sirve para
        // no seguir esperando ni pedir la vuelta siguiente.
        abortSignal: params.signal,
      },
    });

    let usage: { promptTokens: number; completionTokens: number; cachedTokens: number; thinkingTokens: number } | null = null;
    let toolCallSeq = 0;

    for await (const chunk of stream) {
      // Se leen los parts directo en vez de los getters chunk.text /
      // chunk.functionCalls: esos loguean un warning cuando un chunk trae parts
      // mezclados (texto + functionCall), que es un caso normal acá.
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const p of parts) {
        if (p.thought) continue;
        if (p.text) {
          yield { type: 'text', chunk: p.text };
        }
        if (p.functionCall) {
          yield {
            type: 'tool_call',
            call: {
              id: p.functionCall.id ?? `call_${++toolCallSeq}`,
              name: p.functionCall.name ?? '',
              arguments: (p.functionCall.args as Record<string, unknown>) ?? {},
              // Gemini 3.x la adjunta al mismo part que el functionCall; hay que
              // devolverla al reconstruir el historial (ver el rebuild de arriba).
              thoughtSignature: p.thoughtSignature,
            },
          };
        }
      }

      const um = chunk.usageMetadata;
      if (um?.promptTokenCount != null) {
        usage = {
          promptTokens: um.promptTokenCount ?? 0,
          // El thinking cuenta como tokens de salida y se factura como tal.
          completionTokens: (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0),
          cachedTokens: um.cachedContentTokenCount ?? 0,
          thinkingTokens: um.thoughtsTokenCount ?? 0,
        };
      }
    }

    if (usage) {
      yield { type: 'usage', usage: { model: modeloEfectivo, ...usage, provider: 'gemini' } };
    }

    yield { type: 'done' };
  }
}
