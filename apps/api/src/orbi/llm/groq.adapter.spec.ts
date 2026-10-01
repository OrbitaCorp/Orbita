import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqAdapter } from './groq.adapter';

describe('GroqAdapter', () => {
  let adapter: GroqAdapter;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn() };
    adapter = new GroqAdapter(configService as unknown as ConfigService);
  });

  it('throws ServiceUnavailableException when GROQ_API_KEY is missing', async () => {
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

  // Spec §3.6: el metering se clasifica por lo que dice el adapter, no por el
  // nombre del modelo (openai/gpt-oss-120b corre en Groq y no dice "groq").
  it('el evento usage dice provider groq', async () => {
    configService.get.mockImplementation((k: string) => (k === 'GROQ_API_KEY' ? 'test-key' : undefined));
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'ok' } }] };
      yield { choices: [], x_groq: { usage: { prompt_tokens: 7, completion_tokens: 3 } } };
    })();
    (adapter as any).client = { chat: { completions: { create: jest.fn().mockResolvedValue(mockStream) } } };

    const events: any[] = [];
    for await (const event of adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }] })) events.push(event);

    expect(events).toContainEqual({
      type: 'usage',
      usage: { model: 'openai/gpt-oss-120b', promptTokens: 7, completionTokens: 3, provider: 'groq' },
    });
  });

  // Spec §3.7: la señal va en las opciones del request (segundo argumento).
  it('pasa la señal de corte en las opciones del request', async () => {
    configService.get.mockReturnValue('test-key');
    const mockCreate = jest.fn().mockResolvedValue((async function* () { /* vacío */ })());
    (adapter as any).client = { chat: { completions: { create: mockCreate } } };
    const corte = new AbortController();

    for await (const _ of adapter.streamChat({ messages: [{ role: 'user', content: 'hola' }], signal: corte.signal })) {
      // consumir
    }

    expect(mockCreate.mock.calls[0][1]).toEqual({ signal: corte.signal });
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
});
