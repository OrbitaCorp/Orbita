import { ServiceUnavailableException } from '@nestjs/common';
import type { LlmAdapter, LlmEvent, LlmMessage, LlmToolDefinition } from './llm-adapter.interface';

/**
 * Le pone un tope de tiempo a UN proveedor dentro de una cadena de respaldos. Si no contesta a tiempo, el error es de
 * disponibilidad (503) y el FallbackLlmAdapter pasa al siguiente en vez de esperar hasta el corte general. Si el cliente
 * se fue (la señal de afuera abortada), se propaga el aborto tal cual.
 *
 * Solo corta mientras todavía no salió nada: lo ya emitido no se puede rebobinar.
 */
export class LimiteDeTiempoAdapter implements LlmAdapter {
  constructor(
    private readonly interno: LlmAdapter,
    private readonly ms: number,
    readonly nombre = 'proveedor',
  ) {}

  async *streamChat(params: { messages: LlmMessage[]; tools?: LlmToolDefinition[]; model?: string; signal?: AbortSignal }): AsyncGenerator<LlmEvent> {
    const propia = new AbortController();
    const reloj = setTimeout(() => propia.abort(), this.ms);
    const afuera = params.signal;
    const alAbortarAfuera = () => propia.abort();
    afuera?.addEventListener('abort', alAbortarAfuera, { once: true });
    let emitioAlgo = false;
    try {
      for await (const ev of this.interno.streamChat({ ...params, signal: propia.signal })) {
        emitioAlgo = true;
        yield ev;
      }
    } catch (err) {
      if (!afuera?.aborted && propia.signal.aborted && !emitioAlgo) {
        throw new ServiceUnavailableException(`${this.nombre} no contestó en ${Math.round(this.ms / 1000)} s`);
      }
      throw err;
    } finally {
      clearTimeout(reloj);
      afuera?.removeEventListener('abort', alAbortarAfuera);
    }
  }
}
