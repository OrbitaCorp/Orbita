import { ServiceUnavailableException } from '@nestjs/common';
import { ApiError } from '@google/genai';
import { FallbackLlmAdapter } from './fallback.adapter';
import type { LlmAdapter, LlmEvent } from './llm-adapter.interface';

function adapterQue(...actos: (LlmEvent | Error)[]): LlmAdapter & { llamado: boolean } {
  const a = {
    llamado: false,
    async *streamChat(): AsyncGenerator<LlmEvent> {
      a.llamado = true;
      for (const acto of actos) {
        if (acto instanceof Error) throw acto;
        yield acto;
      }
    },
  };
  return a;
}

const TEXTO: LlmEvent = { type: 'text', chunk: 'hola' };
const DONE: LlmEvent = { type: 'done' };

async function drenar(adapter: LlmAdapter): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const ev of adapter.streamChat({ messages: [{ role: 'user', content: 'x' }] })) out.push(ev);
  return out;
}

describe('FallbackLlmAdapter', () => {
  it('usa solo el primario cuando anda', async () => {
    const primary = adapterQue(TEXTO, DONE);
    const secondary = adapterQue(TEXTO, DONE);
    const fb = new FallbackLlmAdapter(primary, secondary);

    const eventos = await drenar(fb);

    expect(eventos).toEqual([TEXTO, DONE]);
    expect(secondary.llamado).toBe(false);
  });

  it('cae al secundario si el primario tira 429 antes de emitir', async () => {
    const primary = adapterQue(new ApiError({ message: 'quota', status: 429 }));
    const secondary = adapterQue({ type: 'text', chunk: 'desde groq' }, DONE);
    const fb = new FallbackLlmAdapter(primary, secondary);

    const eventos = await drenar(fb);

    expect(secondary.llamado).toBe(true);
    expect(eventos).toEqual([{ type: 'text', chunk: 'desde groq' }, DONE]);
  });

  it('cae al secundario si el primario tira 503 (key no configurada)', async () => {
    const primary = adapterQue(new ServiceUnavailableException('GEMINI_API_KEY no configurada'));
    const secondary = adapterQue(DONE);
    const fb = new FallbackLlmAdapter(primary, secondary);

    await drenar(fb);

    expect(secondary.llamado).toBe(true);
  });

  it('NO cae al secundario si el primario tira 400 (bug nuestro) — propaga', async () => {
    const primary = adapterQue(new ApiError({ message: 'invalid argument', status: 400 }));
    const secondary = adapterQue(DONE);
    const fb = new FallbackLlmAdapter(primary, secondary);

    await expect(drenar(fb)).rejects.toMatchObject({ status: 400 });
    expect(secondary.llamado).toBe(false);
  });

  it('NO cae al secundario si el primario ya emitió y después se corta — propaga', async () => {
    const primary = adapterQue(TEXTO, new ApiError({ message: 'boom', status: 500 }));
    const secondary = adapterQue(DONE);
    const fb = new FallbackLlmAdapter(primary, secondary);

    const eventos: LlmEvent[] = [];
    await expect((async () => {
      for await (const ev of fb.streamChat({ messages: [{ role: 'user', content: 'x' }] })) eventos.push(ev);
    })()).rejects.toThrow();

    expect(eventos).toEqual([TEXTO]);
    expect(secondary.llamado).toBe(false);
  });
});
