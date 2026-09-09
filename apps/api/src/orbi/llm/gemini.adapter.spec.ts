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
      { type: 'usage', usage: { model: 'gemini-3.6-flash', promptTokens: 10, completionTokens: 8 } },
      { type: 'done' },
    ]);
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
});
