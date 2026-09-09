import type { ConfigService } from '@nestjs/config';
import { llmAdapterProvider } from './llm-adapter.provider';
import { FallbackLlmAdapter } from './fallback.adapter';
import { GeminiAdapter } from './gemini.adapter';

const factory = (llmAdapterProvider as { useFactory: (c: ConfigService) => unknown }).useFactory;
const cfg = (map: Record<string, string | undefined>) =>
  ({ get: (k: string) => map[k] }) as unknown as ConfigService;

describe('llmAdapterProvider', () => {
  it('envuelve Gemini en FallbackLlmAdapter cuando GROQ_API_KEY está seteada', () => {
    expect(factory(cfg({ GROQ_API_KEY: 'gsk-x' }))).toBeInstanceOf(FallbackLlmAdapter);
  });

  it('devuelve GeminiAdapter solo cuando no hay GROQ_API_KEY', () => {
    expect(factory(cfg({}))).toBeInstanceOf(GeminiAdapter);
  });
});
