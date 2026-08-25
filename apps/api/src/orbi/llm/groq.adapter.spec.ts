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
