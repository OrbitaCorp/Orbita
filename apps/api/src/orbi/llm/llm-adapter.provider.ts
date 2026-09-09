import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_ADAPTER } from './llm-adapter.interface';
import { GeminiAdapter } from './gemini.adapter';
import { GroqAdapter } from './groq.adapter';
import { FallbackLlmAdapter } from './fallback.adapter';

/**
 * Provee LLM_ADAPTER. Gemini es el proveedor primario. Si GROQ_API_KEY está
 * seteada, se envuelve en un FallbackLlmAdapter que cae a Groq cuando Gemini no
 * está disponible (429 / free tier / 5xx / red). Sin GROQ_API_KEY, es solo
 * Gemini — cero cambio de comportamiento.
 *
 * Lo comparten OrbiModule y WizardAnalyticsModule (este último provee su propio
 * adapter para el clasificador de temas, no puede importar OrbiModule sin
 * dependencia circular).
 */
export const llmAdapterProvider: Provider = {
  provide: LLM_ADAPTER,
  useFactory: (config: ConfigService) => {
    const gemini = new GeminiAdapter(config);
    return config.get<string>('GROQ_API_KEY')
      ? new FallbackLlmAdapter(gemini, new GroqAdapter(config))
      : gemini;
  },
  inject: [ConfigService],
};
