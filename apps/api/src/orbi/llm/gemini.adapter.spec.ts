import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiAdapter } from './gemini.adapter';

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn() };
    adapter = new GeminiAdapter(configService as unknown as ConfigService);
  });

  it('throws ServiceUnavailableException when GEMINI_API_KEY is missing', async () => {
    configService.get.mockReturnValue(undefined);

    const gen = adapter.streamChat({
      messages: [{ role: 'user', content: 'hola' }],
    });

    await expect(gen.next()).rejects.toThrow(ServiceUnavailableException);
  });

  it('streams text chunks as LlmEvent with type text', async () => {
    configService.get.mockReturnValue('test-key');

    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'Hola ' } }] };
      yield { choices: [{ delta: { content: 'mundo' } }] };
      yield { choices: [{ delta: {} }] };
    })();

    const mockCreate = jest.fn().mockResolvedValue(mockStream);
    (adapter as any).client = { chat: { completions: { create: mockCreate } } };

    const events: any[] = [];
    for await (const event of adapter.streamChat({
      messages: [{ role: 'user', content: 'hola' }],
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text', chunk: 'Hola ' },
      { type: 'text', chunk: 'mundo' },
      { type: 'done' },
    ]);
  });

  it('parses tool calls from streamed deltas', async () => {
    configService.get.mockReturnValue('test-key');

    const mockStream = (async function* () {
      yield {
        choices: [{
          delta: {
            tool_calls: [{
              id: 'call_1',
              function: { name: 'navigateTo', arguments: '{"module":' },
            }],
          },
        }],
      };
      yield {
        choices: [{
          delta: {
            tool_calls: [{
              function: { arguments: '"productos"}' },
            }],
          },
        }],
      };
    })();

    const mockCreate = jest.fn().mockResolvedValue(mockStream);
    (adapter as any).client = { chat: { completions: { create: mockCreate } } };

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
      {
        type: 'tool_call',
        call: { id: 'call_1', name: 'navigateTo', arguments: { module: 'productos' } },
      },
      { type: 'done' },
    ]);
  });

  it('emits a usage event from the final stream chunk (choices vacío + usage)', async () => {
    // Solo la API key: si ORBI_MODEL también devolviera algo, el modelo del
    // evento usage sería ese y no el default que este caso verifica.
    configService.get.mockImplementation((k: string) => (k === 'GEMINI_API_KEY' ? 'test-key' : undefined));

    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'ok' } }] };
      yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } };
    })();

    const mockCreate = jest.fn().mockResolvedValue(mockStream);
    (adapter as any).client = { chat: { completions: { create: mockCreate } } };

    const events: any[] = [];
    for await (const event of adapter.streamChat({
      messages: [{ role: 'user', content: 'hola' }],
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text', chunk: 'ok' },
      { type: 'usage', usage: { model: 'gemini-2.5-flash', promptTokens: 10, completionTokens: 5 } },
      { type: 'done' },
    ]);
  });

  it('usa el modelo que le pasan por parámetro en vez del default', async () => {
    configService.get.mockReturnValue('test-key');

    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'ok' } }] };
    })();
    const mockCreate = jest.fn().mockResolvedValue(mockStream);
    (adapter as any).client = { chat: { completions: { create: mockCreate } } };

    for await (const _ of adapter.streamChat({
      messages: [{ role: 'user', content: 'hola' }],
      model: 'gemini-2.5-pro',
    })) {
      // consumir
    }

    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-2.5-pro');
  });
});
