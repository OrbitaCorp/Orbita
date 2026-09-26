import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Se usa el SDK NATIVO de Gemini (@google/genai), no el endpoint
// OpenAI-compatible: las API keys nuevas de Google AI Studio (prefijo `AQ.`)
// son rechazadas con "Invalid Auth key" en la capa OpenAI-compat, pero andan
// bien en el endpoint nativo. Ver discuss.ai.google.dev sobre el tema.
// gemini-3.7-flash: alta disponibilidad y soporte nativo multimodal en el free tier.
// Hay 3.8 también; subir por env (ORBI_MODEL / PRODUCT_AI_MODEL) si se quiere.
export const DEFAULT_MODEL = 'gemini-3.7-flash';

/**
 * Cliente Gemini lazy compartido por el adapter de Orbi, ProductAiService y las
 * tools del wizard. Si GEMINI_API_KEY no está configurada, esos tres flujos
 * responden 503 pero el resto del backend sigue funcionando.
 */
export function createGeminiClient(config: ConfigService): GoogleGenAI {
  const apiKey = config.get<string>('GEMINI_API_KEY');
  if (!apiKey) throw new ServiceUnavailableException('GEMINI_API_KEY no configurada');
  return new GoogleGenAI({ apiKey });
}

// Gemini 3.x usa thinkingLevel (LOW/MEDIUM/HIGH/MINIMAL), no thinkingBudget —
// y a diferencia del 2.5 no deja apagar el thinking del todo (thinkingBudget: 0
// da 400). Las tareas estructuradas (product-ai, tools del wizard) van con
// MINIMAL; el chat de Orbi con el knob traducido.
export const THINKING_MINIMO = ThinkingLevel.LOW;

export function thinkingLevelFor(effort: 'low' | 'medium' | 'high'): ThinkingLevel {
  if (effort === 'high') return ThinkingLevel.HIGH;
  if (effort === 'medium') return ThinkingLevel.MEDIUM;
  return ThinkingLevel.LOW;
}
