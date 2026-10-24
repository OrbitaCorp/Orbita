import { HttpException } from '@nestjs/common';
import type { LlmAdapter, LlmEvent } from '../../src/orbi/llm/llm-adapter.interface';
import { cadenaDeRespaldos } from '../../src/orbi/llm/llm-adapter.provider';
import { LimiteDeTiempoAdapter } from '../../src/orbi/llm/limite-de-tiempo.adapter';
import { WorkersAiAdapter } from '../../src/orbi/llm/workers-ai.adapter';
import { costoDeConsumoUsd } from '../../src/platform/costs/precios';

// El LLM del bot de WhatsApp: Groq → Workers AI (Cloudflare) → Gemini, del más barato al más caro, cayendo al siguiente
// cuando uno no está disponible.

const juntar = async (a: LlmAdapter, signal?: AbortSignal) => {
  const eventos: LlmEvent[] = [];
  for await (const ev of a.streamChat({ messages: [{ role: 'user', content: 'hola' }], signal })) eventos.push(ev);
  return eventos;
};
const texto = (eventos: LlmEvent[]) => eventos.filter((e) => e.type === 'text').map((e) => (e as { chunk: string }).chunk).join('');

const responde = (t: string): LlmAdapter => ({ streamChat: async function* () { yield { type: 'text', chunk: t }; yield { type: 'done' }; } });
const falla = (status: number): LlmAdapter => ({ streamChat: async function* () { throw new HttpException('x', status); } });
const colgado = (): LlmAdapter => ({
  streamChat: async function* ({ signal }) {
    await new Promise((_, rej) => signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    yield { type: 'done' };
  },
});

describe('cadenaDeRespaldos', () => {
  const todos = (g: LlmAdapter, w: LlmAdapter, m: LlmAdapter, disp = [true, true, true]) => [
    { nombre: 'Groq', adapter: g, disponible: disp[0] },
    { nombre: 'Workers AI', adapter: w, disponible: disp[1] },
    { nombre: 'Gemini', adapter: m, disponible: disp[2] },
  ];

  it('con todos sanos, contesta Groq y no se toca a los demás', async () => {
    const w = { streamChat: jest.fn() }; const m = { streamChat: jest.fn() };
    expect(texto(await juntar(cadenaDeRespaldos(todos(responde('groq'), w as any, m as any))))).toBe('groq');
    expect(w.streamChat).not.toHaveBeenCalled();
    expect(m.streamChat).not.toHaveBeenCalled();
  });

  it('si Groq se cae (429 o 5xx), sigue Workers AI; si también, Gemini', async () => {
    expect(texto(await juntar(cadenaDeRespaldos(todos(falla(429), responde('cloudflare'), responde('gemini')))))).toBe('cloudflare');
    expect(texto(await juntar(cadenaDeRespaldos(todos(falla(503), falla(500), responde('gemini')))))).toBe('gemini');
  });

  it('un error duro (400) no se tapa con otro proveedor', async () => {
    await expect(juntar(cadenaDeRespaldos(todos(falla(400), responde('cloudflare'), responde('gemini'))))).rejects.toBeInstanceOf(HttpException);
  });

  it('los proveedores sin credenciales se saltean', async () => {
    expect(texto(await juntar(cadenaDeRespaldos(todos(responde('groq'), responde('cloudflare'), responde('gemini'), [false, true, true]))))).toBe('cloudflare');
    expect(texto(await juntar(cadenaDeRespaldos(todos(responde('groq'), responde('cloudflare'), responde('gemini'), [false, false, true]))))).toBe('gemini');
  });

  it('un proveedor que no contesta a tiempo se salta y sigue el próximo (sin esperar hasta el corte general)', async () => {
    const t0 = Date.now();
    const r = await juntar(cadenaDeRespaldos(todos(colgado(), responde('cloudflare'), responde('gemini')), 40));
    expect(texto(r)).toBe('cloudflare');
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('si no hay ningún proveedor, avisa', () => {
    expect(() => cadenaDeRespaldos(todos(responde('a'), responde('b'), responde('c'), [false, false, false]))).toThrow(/ningún proveedor/);
  });
});

describe('LimiteDeTiempoAdapter', () => {
  it('si el cliente se fue (la señal de afuera), propaga el aborto y no lo disfraza de caída del proveedor', async () => {
    const afuera = new AbortController();
    const p = juntar(new LimiteDeTiempoAdapter(colgado(), 5_000), afuera.signal);
    setTimeout(() => afuera.abort(), 10);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('lo que sí contesta pasa tal cual', async () => {
    expect(texto(await juntar(new LimiteDeTiempoAdapter(responde('ok'), 1000)))).toBe('ok');
  });
});

describe('WorkersAiAdapter', () => {
  const config = (v: Record<string, string> = { R2_ACCOUNT_ID: 'acc123', CF_WORKERS_AI_API_TOKEN: 'tok' }) => ({ get: (k: string) => v[k] }) as any;
  afterEach(() => jest.restoreAllMocks());
  const mockFetch = (cuerpo: unknown, ok = true, status = 200) =>
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok, status, json: async () => cuerpo } as any);

  it('habla con el endpoint compatible de la cuenta, con el token, y no manda el modelo de Gemini', async () => {
    const f = mockFetch({ choices: [{ message: { content: 'Hola!' } }], usage: { prompt_tokens: 100, completion_tokens: 20 } });
    const a = new WorkersAiAdapter(config());
    const eventos: LlmEvent[] = [];
    for await (const ev of a.streamChat({ messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'hola' }], model: 'gemini-3.6-flash' })) eventos.push(ev);
    const [url, init] = f.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc123/ai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.model).toBe('@cf/openai/gpt-oss-120b');
    expect(cuerpo.stream).toBe(false);
    expect(eventos.map((e) => e.type)).toEqual(['text', 'usage', 'done']);
    expect(eventos[1]).toMatchObject({ usage: { provider: 'workers-ai', promptTokens: 100, completionTokens: 20 } });
  });

  it('traduce las herramientas y devuelve los pedidos del modelo con sus argumentos', async () => {
    const f = mockFetch({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'buscar_productos', arguments: '{"consulta":"remera"}' } }, { id: 'c2', function: { name: 'datos_de_la_tienda', arguments: 'basura' } }] } }] });
    const a = new WorkersAiAdapter(config());
    const eventos: LlmEvent[] = [];
    for await (const ev of a.streamChat({
      messages: [
        { role: 'user', content: 'x' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c0', name: 'buscar_productos', arguments: { consulta: 'a' } }] },
        { role: 'tool', content: '{"ok":true}', toolCallId: 'c0' },
      ],
      tools: [{ name: 'buscar_productos', description: 'd', parameters: { type: 'object', properties: {} } }],
    })) eventos.push(ev);
    const cuerpo = JSON.parse((f.mock.calls[0][1] as any).body);
    expect(cuerpo.tools[0]).toMatchObject({ type: 'function', function: { name: 'buscar_productos' } });
    expect(cuerpo.messages[1]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'c0', function: { name: 'buscar_productos', arguments: '{"consulta":"a"}' } }] });
    expect(cuerpo.messages[2]).toMatchObject({ role: 'tool', tool_call_id: 'c0' });
    const llamadas = eventos.filter((e) => e.type === 'tool_call') as { call: { name: string; arguments: unknown } }[];
    expect(llamadas.map((l) => l.call.name)).toEqual(['buscar_productos', 'datos_de_la_tienda']);
    expect(llamadas[0].call.arguments).toEqual({ consulta: 'remera' });
    expect(llamadas[1].call.arguments).toEqual({}); // argumentos mal formados: la herramienta los rechaza, no se cae todo
  });

  it('un 429 o 5xx es de disponibilidad (con su status); sin credenciales no se usa', async () => {
    mockFetch({}, false, 429);
    await expect(juntar(new WorkersAiAdapter(config()))).rejects.toMatchObject({ status: 429 });
    expect(new WorkersAiAdapter(config({})).configurado).toBe(false);
    expect(new WorkersAiAdapter(config()).configurado).toBe(true);
  });
});

describe('precio de Workers AI', () => {
  it('se cobra por su tabla y sale más barato que Gemini para el mismo consumo', () => {
    const consumo = { promptTokens: 3000, completionTokens: 300 };
    const fecha = new Date('2026-10-19');
    const groq = costoDeConsumoUsd({ provider: 'groq', model: 'openai/gpt-oss-120b', ...consumo }, fecha);
    const cf = costoDeConsumoUsd({ provider: 'workers-ai', model: '@cf/openai/gpt-oss-120b', ...consumo }, fecha);
    const gemini = costoDeConsumoUsd({ provider: 'gemini', model: 'gemini-3.6-flash', ...consumo }, fecha);
    expect(cf).toBeGreaterThan(0);
    expect(groq).toBeLessThan(cf);
    expect(cf).toBeLessThan(gemini);
  });
});
