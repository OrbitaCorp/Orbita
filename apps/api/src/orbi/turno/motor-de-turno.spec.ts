import { correrTurno, nuevoProgresoDelTurno, type EmisorDelTurno } from './motor-de-turno';
import { MAX_VUELTAS_TOOLS, MENSAJE_VUELTAS } from './vuelta';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import type { LlmEvent } from '../llm/llm-adapter.interface';

const ctx = { businessId: 'biz-1', userId: 'm-1', surface: OrbiSurface.PANEL, permissions: [] };
const tool = { name: 'listOrders', description: '', parameters: {} };

function emisor() {
  const eventos: string[] = [];
  const e: EmisorDelTurno = {
    toolPedida: ({ call }) => eventos.push(`pedida:${call.name}`),
    texto: (c) => eventos.push(`texto:${c}`),
    reiniciarTexto: () => eventos.push('reinicio'),
    escrituraRechazada: ({ call }) => eventos.push(`rechazada:${call.name}`),
    propuesta: ({ call, actionId }) => eventos.push(`propuesta:${call.name}:${actionId}`),
    lecturaInicio: ({ call }) => eventos.push(`inicio:${call.name}`),
    lecturaFin: ({ call }) => eventos.push(`fin-lectura:${call.name}`),
    fin: () => eventos.push('fin'),
  };
  return { e, eventos };
}

const registry = (escribe = false) => ({
  proponer: jest.fn(async () => (escribe ? { resumen: 'Crear X' } : null)),
  requiereConfirmacion: jest.fn(() => escribe),
  execute: jest.fn(async () => ({ success: true, label: 'ok', data: {} })),
});

const llamada = (name: string): LlmEvent => ({ type: 'tool_call', call: { id: name, name, arguments: {} } });

function guion(vueltas: LlmEvent[][]) {
  let i = 0;
  return { async *streamChat() { for (const ev of vueltas[i++] ?? [{ type: 'done' as const }]) yield ev; } };
}

const turno = (over: Record<string, unknown>) => ({
  messages: [], tools: [tool], toolCtx: ctx, soloLectura: false,
  crearPendiente: async () => 'accion-1', progreso: nuevoProgresoDelTurno(), ...over,
}) as unknown as Parameters<typeof correrTurno>[0];

describe('correrTurno', () => {
  it('con tools, el preámbulo de una vuelta con tool no se ve; el texto final sale de una al terminar', async () => {
    const { e, eventos } = emisor();
    const t = turno({
      llm: guion([[{ type: 'text', chunk: 'Voy a buscar. ' }, llamada('listOrders'), { type: 'done' }], [{ type: 'text', chunk: 'Hay ' }, { type: 'text', chunk: '4.' }, { type: 'done' }]]),
      registry: registry(), emisor: e,
    });
    await correrTurno(t);
    expect(eventos).toEqual(['pedida:listOrders', 'inicio:listOrders', 'fin-lectura:listOrders', 'texto:Hay 4.', 'fin']);
    expect(t.progreso).toMatchObject({ texto: 'Hay 4.', estado: 'ok', llamadasAlModelo: 2, toolsPedidas: ['listOrders'], propuestas: 0 });
  });

  it('una escritura se propone y se cuenta, no se ejecuta', async () => {
    const { e, eventos } = emisor();
    const reg = registry(true);
    const t = turno({ llm: guion([[llamada('createCoupon'), { type: 'done' }], [{ type: 'text', chunk: 'Listo para confirmar.' }, { type: 'done' }]]), registry: reg, emisor: e });
    await correrTurno(t);
    expect(eventos).toContain('propuesta:createCoupon:accion-1');
    expect(reg.execute).not.toHaveBeenCalled();
    expect(t.progreso.propuestas).toBe(1);
  });

  it('si el turno se corta a mitad, lo avanzado queda en el progreso para la telemetría', async () => {
    const { e } = emisor();
    const corte = new AbortController();
    const reg = registry();
    reg.execute.mockImplementation(async () => { corte.abort(); return { success: true, label: 'ok', data: {} }; });
    const t = turno({ llm: guion([[llamada('listOrders'), { type: 'done' }], [{ type: 'text', chunk: 'nunca' }, { type: 'done' }]]), registry: reg, emisor: e, signal: corte.signal });
    await expect(correrTurno(t)).rejects.toThrow();
    expect(t.progreso).toMatchObject({ llamadasAlModelo: 1, toolsPedidas: ['listOrders'], texto: '' });
  });

  it('al pasar el tope de vueltas corta con el mensaje fijo y lo marca', async () => {
    const { e, eventos } = emisor();
    const vueltas = Array.from({ length: MAX_VUELTAS_TOOLS + 2 }, (): LlmEvent[] => [llamada('listOrders'), { type: 'done' }]);
    const t = turno({ llm: guion(vueltas), registry: registry(), emisor: e });
    await correrTurno(t);
    expect(eventos.slice(-2)).toEqual([`texto:${MENSAJE_VUELTAS}`, 'fin']);
    expect(t.progreso).toMatchObject({ estado: 'max_rounds', texto: MENSAJE_VUELTAS, llamadasAlModelo: MAX_VUELTAS_TOOLS });
  });

  it('suma el consumo por proveedor de cada vuelta', async () => {
    const { e } = emisor();
    const uso = (provider: 'gemini' | 'groq', p: number): LlmEvent => ({ type: 'usage', usage: { model: provider, promptTokens: p, completionTokens: 1, provider } });
    const t = turno({ llm: guion([[llamada('listOrders'), uso('gemini', 10), { type: 'done' }], [uso('groq', 5), uso('gemini', 3), { type: 'done' }]]), registry: registry(), emisor: e });
    await correrTurno(t);
    expect(Object.fromEntries(t.progreso.consumo)).toEqual({
      gemini: { model: 'gemini', promptTokens: 13, completionTokens: 2, cachedTokens: 0, thinkingTokens: 0 },
      groq: { model: 'groq', promptTokens: 5, completionTokens: 1, cachedTokens: 0, thinkingTokens: 0 },
    });
    expect(t.progreso.modeloReportado).toBe('gemini');
  });
});

describe('pasos del turno', () => {
  const reloj = () => { let t = 1000; return () => (t += 10); };

  it('anota una entrada por vuelta con su consumo y sus tools', async () => {
    const { e } = emisor();
    const t = turno({
      llm: guion([
        [llamada('listOrders'), { type: 'usage', usage: { model: 'm', provider: 'gemini', promptTokens: 5000, completionTokens: 30, cachedTokens: 0, thinkingTokens: 10 } }, { type: 'done' }],
        [{ type: 'text', chunk: 'Hay 4.' }, { type: 'usage', usage: { model: 'm', provider: 'gemini', promptTokens: 5600, completionTokens: 20, cachedTokens: 4096, thinkingTokens: 5 } }, { type: 'done' }],
      ]),
      registry: registry(), emisor: e, reloj: reloj(), inicio: 1000,
    });
    await correrTurno(t);
    expect(t.progreso.pasos).toHaveLength(2);
    expect(t.progreso.pasos[0]).toMatchObject({ n: 1, provider: 'gemini', promptTokens: 5000, thinkingTokens: 10, tools: [{ name: 'listOrders', tipo: 'lectura', ok: true }] });
    expect(t.progreso.pasos[1]).toMatchObject({ n: 2, cachedTokens: 4096, tools: [] });
    expect(t.progreso.consumo.get('gemini')).toMatchObject({ promptTokens: 10600, cachedTokens: 4096, thinkingTokens: 15 });
    expect(t.progreso.ttftMs).toBeGreaterThan(0);
  });

  it('cuenta las escrituras rechazadas', async () => {
    const { e } = emisor();
    const reg = { proponer: jest.fn(async () => ({ error: 'falta la categoría' })), requiereConfirmacion: jest.fn(() => true), execute: jest.fn() };
    const t = turno({ llm: guion([[llamada('createProduct'), { type: 'done' }], [{ type: 'text', chunk: 'No pude.' }, { type: 'done' }]]), registry: reg, emisor: e });
    await correrTurno(t);
    expect(t.progreso.escriturasRechazadas).toBe(1);
    expect(t.progreso.pasos[0].tools[0]).toMatchObject({ tipo: 'rechazada', ok: false });
  });

  it('el consumo de IA de una tool se suma aparte y no viaja al modelo', async () => {
    const { e } = emisor();
    const reg = registry();
    reg.execute.mockResolvedValue({ success: true, label: 'ok', data: { d: 1 }, consumo: { model: 'm', provider: 'gemini', promptTokens: 800, completionTokens: 500 } } as never);
    const messages: any[] = [];
    const t = turno({ llm: guion([[llamada('generateDescription'), { type: 'done' }], [{ type: 'text', chunk: 'Listo' }, { type: 'done' }]]), registry: reg, emisor: e, messages });
    await correrTurno(t);
    expect(t.progreso.consumoDeTools.get('gemini')).toMatchObject({ promptTokens: 800, completionTokens: 500 });
    const resultadoAlModelo = messages.find(m => m.role === 'tool').content;
    expect(resultadoAlModelo).not.toContain('consumo');
  });
});
