import { Logger } from '@nestjs/common';
import { esErrorDeDisponibilidad } from './llm-errors';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

/**
 * Envuelve dos adapters: `primary` (Gemini) y `secondary` (Groq). Prueba el
 * primario; si falla ANTES de emitir el primer evento y el error es de
 * disponibilidad (429/5xx/red — ver esErrorDeDisponibilidad), arranca de cero
 * con el secundario y el usuario ni se entera.
 *
 * Si el primario ya emitió algo y después se corta, no se puede rebobinar el
 * stream ya enviado: se propaga el error. El caso real (429 / free tier) siempre
 * ocurre en la primera llamada, antes del primer token, así que esto lo cubre.
 */
export class FallbackLlmAdapter implements LlmAdapter {
  private readonly logger = new Logger(FallbackLlmAdapter.name);

  constructor(
    private readonly primary: LlmAdapter,
    private readonly secondary: LlmAdapter,
  ) {}

  async *streamChat(params: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    model?: string;
  }): AsyncGenerator<LlmEvent> {
    let emitioAlgo = false;
    try {
      for await (const ev of this.primary.streamChat(params)) {
        emitioAlgo = true;
        yield ev;
      }
      return;
    } catch (err) {
      if (emitioAlgo || !esErrorDeDisponibilidad(err)) throw err;
      this.logger.warn(
        `Proveedor primario no disponible antes del primer token (${describir(err)}); ` +
        `cayendo al fallback`,
      );
    }

    yield* this.secondary.streamChat(params);
  }
}

function describir(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 200);
  return String(err).slice(0, 200);
}
