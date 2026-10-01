import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiAdapter } from './gemini.adapter';

// Mockea client.models.generateContentStream con un async generator de chunks
// con la forma nativa de @google/genai (candidates[0].content.parts + usageMetadata).
function mockStream(svc: GeminiAdapter, chunks: any[]) {
  const generateContentStream = jest.fn().mockResolvedValue((async function* () {
    for (const c of chunks) yield c;
  })());
  (svc as any).client = { models: { generateContentStream } };
  return generateContentStream;
}

const textChunk = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn() };
    adapter = new GeminiAdapter(configService as unknown as ConfigService);
  });

  it('throws ServiceUnavailableException when GEMINI_API_KEY is missing', async () => {
    configService.get.mockReturnValue(undefined);

    const gen = adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }] });

    await expect(gen.next()).rejects.toThrow(ServiceUnavailableException);
  });

  it('streams text parts as LlmEvent with type text', async () => {
    configService.get.mockReturnValue('test-key');
    mockStream(adapter, [textChunk('Hola '), textChunk('mundo')]);

    const events: any[] = [];
    for await (const event of adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }] })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text', chunk: 'Hola ' },
      { type: 'text', chunk: 'mundo' },
      { type: 'done' },
    ]);
  });

  it('parses function calls from stream parts', async () => {
    configService.get.mockReturnValue('test-key');
    mockStream(adapter, [
      { candidates: [{ content: { parts: [{ functionCall: { name: 'navigateTo', args: { module: 'productos' } } }] } }] },
    ]);

    const events: any[] = [];
    for await (const event of adapter.streamChat({
      messages: [{ role: 'user', content: 'llevame a productos' }],
      tools: [{
        name: 'navigateTo',
        description: 'Navigate to a module',
        parameters: { type: 'object', properties: { module: { type: 'string' } } },
      }],
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'tool_call', call: { id: 'call_1', name: 'navigateTo', arguments: { module: 'productos' } } },
      { type: 'done' },
    ]);
  });

  it('captura y devuelve el thoughtSignature del functionCall (Gemini 3.x)', async () => {
    configService.get.mockReturnValue('test-key');
    mockStream(adapter, [
      { candidates: [{ content: { parts: [{ functionCall: { name: 'navigateTo', args: {} }, thoughtSignature: 'SIG-123' }] } }] },
    ]);

    // Primera vuelta: capturamos la firma.
    let firma: string | undefined;
    for await (const e of adapter.streamChat({ messages: [{ role: 'user', content: 'x' }] })) {
      if (e.type === 'tool_call') firma = e.call.thoughtSignature;
    }
    expect(firma).toBe('SIG-123');

    // Segunda vuelta: al reconstruir el historial, la firma vuelve en el part.
    mockStream(adapter, [textChunk('ok')]);
    const gen2 = (adapter as any).client.models.generateContentStream as jest.Mock;
    for await (const _ of adapter.streamChat({
      messages: [
        { role: 'user', content: 'x' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'navigateTo', arguments: {}, thoughtSignature: 'SIG-123' }] },
        { role: 'tool', content: '{"ok":true}', toolCallId: 'call_1' },
      ],
    })) {
      // consumir
    }
    const modelMsg = gen2.mock.calls[0][0].contents.find((c: any) => c.role === 'model');
    expect(modelMsg.parts[0].thoughtSignature).toBe('SIG-123');
    expect(modelMsg.parts[0].functionCall).toEqual({ name: 'navigateTo', args: {} });
  });

  it('ignora los parts de thinking', async () => {
    configService.get.mockReturnValue('test-key');
    mockStream(adapter, [
      { candidates: [{ content: { parts: [{ text: 'razonando...', thought: true }, { text: 'respuesta' }] } }] },
    ]);

    const events: any[] = [];
    for await (const event of adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }] })) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'text', chunk: 'respuesta' }, { type: 'done' }]);
  });

  it('emite un evento usage desde usageMetadata (thinking cuenta como salida)', async () => {
    configService.get.mockImplementation((k: string) => (k === 'GEMINI_API_KEY' ? 'test-key' : undefined));
    mockStream(adapter, [
      textChunk('ok'),
      { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 3 } },
    ]);

    const events: any[] = [];
    for await (const event of adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }] })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text', chunk: 'ok' },
      { type: 'usage', usage: { model: 'gemini-3.6-flash', promptTokens: 10, completionTokens: 8, provider: 'gemini' } },
      { type: 'done' },
    ]);
  });

  // Spec §3.7. Ojo: el abortSignal de @google/genai corta del lado del
  // cliente (deja de leer y cierra la conexión); lo ya generado se factura.
  it('pasa la señal de corte como config.abortSignal', async () => {
    configService.get.mockReturnValue('test-key');
    const gen = mockStream(adapter, [textChunk('ok')]);
    const corte = new AbortController();

    for await (const _ of adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }], signal: corte.signal })) {
      // consumir
    }

    expect(gen.mock.calls[0][0].config.abortSignal).toBe(corte.signal);
  });

  it('usa el modelo que le pasan por parámetro en vez del default', async () => {
    configService.get.mockReturnValue('test-key');
    const gen = mockStream(adapter, [textChunk('ok')]);

    for await (const _ of adapter.streamChat({
      messages: [{ role: 'user', content: 'hola' }],
      model: 'gemini-2.5-pro',
    })) {
      // consumir
    }

    expect(gen.mock.calls[0][0].model).toBe('gemini-2.5-pro');
  });

  it('mapea system a systemInstruction y assistant a role model', async () => {
    configService.get.mockReturnValue('test-key');
    const gen = mockStream(adapter, [textChunk('ok')]);

    for await (const _ of adapter.streamChat({
      messages: [
        { role: 'system', content: 'Sos Orbi.' },
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'buenas' },
      ],
    })) {
      // consumir
    }

    const arg = gen.mock.calls[0][0];
    expect(arg.config.systemInstruction).toBe('Sos Orbi.');
    expect(arg.contents).toEqual([
      { role: 'user', parts: [{ text: 'hola' }] },
      { role: 'model', parts: [{ text: 'buenas' }] },
    ]);
  });

  // Spec §3.3, "Historial bien formado". Un turno fallido o cortado deja dos
  // `user` seguidos en la conversación guardada, y una respuesta vacía queda
  // como `assistant` vacío. Gemini espera turnos alternados y sin partes
  // vacías: se unen los consecutivos del mismo rol y se tiran los vacíos.
  it('une entradas consecutivas del mismo rol en un solo content y descarta las vacías', async () => {
    configService.get.mockReturnValue('test-key');
    const gen = mockStream(adapter, [textChunk('ok')]);

    for await (const _ of adapter.streamChat({
      messages: [
        { role: 'system', content: 'Sos Orbi.' },
        { role: 'user', content: 'hola' },
        { role: 'user', content: 'sigo acá?' },
        { role: 'assistant', content: '' },
        { role: 'assistant', content: 'uno' },
        { role: 'assistant', content: 'dos' },
        { role: 'user', content: '  ' },
        { role: 'user', content: 'chau' },
      ],
    })) {
      // consumir
    }

    expect(gen.mock.calls[0][0].contents).toEqual([
      { role: 'user', parts: [{ text: 'hola' }, { text: 'sigo acá?' }] },
      { role: 'model', parts: [{ text: 'uno' }, { text: 'dos' }] },
      { role: 'user', parts: [{ text: 'chau' }] },
    ]);
  });

  // 'tool' y 'user' son los dos 'user' en Gemini: se unen por el rol de
  // Gemini, no por el nuestro. Hoy el chat no deja un user después de un
  // resultado de tool, pero si pasara no pueden salir dos 'user' seguidos.
  it('un resultado de tool seguido de un user sale como un solo content user', async () => {
    configService.get.mockReturnValue('test-key');
    const gen = mockStream(adapter, [textChunk('ok')]);

    for await (const _ of adapter.streamChat({
      messages: [
        { role: 'user', content: 'x' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'listProducts', arguments: {} }] },
        { role: 'tool', content: '{"ok":1}', toolCallId: 'c1' },
        { role: 'user', content: 'y ahora?' },
      ],
    })) {
      // consumir
    }

    expect(gen.mock.calls[0][0].contents).toEqual([
      { role: 'user', parts: [{ text: 'x' }] },
      { role: 'model', parts: [{ functionCall: { name: 'listProducts', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'listProducts', response: { output: { ok: 1 } } } }, { text: 'y ahora?' }] },
    ]);
  });

  it('un assistant sin texto pero con tool call no se descarta, y la vuelta de tools sigue alternando', async () => {
    configService.get.mockReturnValue('test-key');
    const gen = mockStream(adapter, [textChunk('ok')]);

    for await (const _ of adapter.streamChat({
      messages: [
        { role: 'user', content: 'x' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'listProducts', arguments: {} }] },
        { role: 'tool', content: '{"ok":1}', toolCallId: 'c1' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c2', name: 'listOrders', arguments: {} }] },
        { role: 'tool', content: '{"ok":2}', toolCallId: 'c2' },
      ],
    })) {
      // consumir
    }

    expect(gen.mock.calls[0][0].contents).toEqual([
      { role: 'user', parts: [{ text: 'x' }] },
      { role: 'model', parts: [{ functionCall: { name: 'listProducts', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'listProducts', response: { output: { ok: 1 } } } }] },
      { role: 'model', parts: [{ functionCall: { name: 'listOrders', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'listOrders', response: { output: { ok: 2 } } } }] },
    ]);
  });
  // Tool calls paralelas de Gemini 3.x (bug de producción del 2026-09-30): un
  // assistant con varias calls + un tool por call tiene que salir como UN
  // content model con todos los functionCall (la firma solo en el primero,
  // tal como llegó) y UN content user con los functionResponse en el mismo
  // orden. Si no, Gemini rechaza el segundo functionCall por no tener firma.
  it('calls paralelas: un content model con todos los functionCall y un content user con las respuestas en orden', async () => {
    configService.get.mockReturnValue('test-key');
    const generateContentStream = mockStream(adapter, [textChunk('ok')]);

    for await (const _ of adapter.streamChat({
      messages: [
        { role: 'user', content: 'resumen de 7 días' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'c1', name: 'getSalesReport', arguments: { days: 7 }, thoughtSignature: 'sig-1' },
            { id: 'c2', name: 'getProductReport', arguments: { days: 7 } },
          ],
        },
        { role: 'tool', content: '{"total":100}', toolCallId: 'c1' },
        { role: 'tool', content: '{"top":["Remera"]}', toolCallId: 'c2' },
      ],
    })) {
      // consumir
    }

    expect(generateContentStream.mock.calls[0][0].contents).toEqual([
      { role: 'user', parts: [{ text: 'resumen de 7 días' }] },
      {
        role: 'model',
        parts: [
          { functionCall: { name: 'getSalesReport', args: { days: 7 } }, thoughtSignature: 'sig-1' },
          { functionCall: { name: 'getProductReport', args: { days: 7 } } },
        ],
      },
      {
        role: 'user',
        parts: [
          { functionResponse: { name: 'getSalesReport', response: { output: { total: 100 } } } },
          { functionResponse: { name: 'getProductReport', response: { output: { top: ['Remera'] } } } },
        ],
      },
    ]);
  });
});
