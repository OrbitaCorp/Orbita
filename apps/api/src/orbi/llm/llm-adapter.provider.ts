import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_ADAPTER, LLM_ADAPTER_BOT, type LlmAdapter } from './llm-adapter.interface';
import { GeminiAdapter } from './gemini.adapter';
import { GroqAdapter } from './groq.adapter';
import { FallbackLlmAdapter } from './fallback.adapter';
import { WorkersAiAdapter } from './workers-ai.adapter';
import { LimiteDeTiempoAdapter } from './limite-de-tiempo.adapter';

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

/** Cuánto se espera a cada proveedor antes de pasar al siguiente (el último, Gemini, tiene todo el tiempo que quede). */
const ESPERA_POR_PROVEEDOR_MS = 15_000;

/**
 * Arma la cadena de respaldos: de la lista (en orden) se queda con los proveedores que tienen credenciales y los encadena,
 * cada uno con su tope de tiempo salvo el último. Pura y exportada para poder probarla sin Nest.
 */
export function cadenaDeRespaldos(proveedores: { nombre: string; adapter: LlmAdapter; disponible: boolean }[], esperaMs = ESPERA_POR_PROVEEDOR_MS): LlmAdapter {
  const activos = proveedores.filter((p) => p.disponible);
  if (activos.length === 0) throw new Error('No hay ningún proveedor de IA configurado');
  let cadena: LlmAdapter = activos[activos.length - 1].adapter;
  for (let i = activos.length - 2; i >= 0; i--) {
    cadena = new FallbackLlmAdapter(new LimiteDeTiempoAdapter(activos[i].adapter, esperaMs, activos[i].nombre), cadena);
  }
  return cadena;
}

/**
 * LLM del bot de atención de WhatsApp: primero Groq, después Workers AI (Cloudflare) y al final Gemini, que es el más
 * caro. Si uno se cae (429, 5xx, red o no contesta a tiempo) antes de emitir algo, sigue el próximo. Los que no tienen
 * credenciales cargadas se saltean. Gemini va último aunque no tenga clave: es lo que ya pasaba antes con Orbi.
 */
export const llmAdapterDelBotProvider: Provider = {
  provide: LLM_ADAPTER_BOT,
  useFactory: (config: ConfigService) => {
    const workers = new WorkersAiAdapter(config);
    return cadenaDeRespaldos([
      { nombre: 'Groq', adapter: new GroqAdapter(config), disponible: !!config.get<string>('GROQ_API_KEY') },
      { nombre: 'Workers AI', adapter: workers, disponible: workers.configurado },
      { nombre: 'Gemini', adapter: new GeminiAdapter(config), disponible: true },
    ]);
  },
  inject: [ConfigService],
};
