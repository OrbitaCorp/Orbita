import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

// Se usa el SDK NATIVO de Gemini (@google/genai), no el endpoint
// OpenAI-compatible: las API keys nuevas de Google AI Studio (prefijo `AQ.`)
// son rechazadas con "Invalid Auth key" en la capa OpenAI-compat, pero andan
// bien en el endpoint nativo. Ver discuss.ai.google.dev sobre el tema.
export const DEFAULT_MODEL = 'gemini-2.5-flash';

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

/**
 * Traduce el knob de razonamiento (bajo/medio/alto) al thinkingBudget de
 * Gemini. 0 = sin thinking (más rápido y barato, y sin riesgo de que el
 * razonamiento se coma el presupuesto de tokens antes de escribir el JSON —
 * el mismo síntoma que ya estaba documentado con Groq). -1 = automático.
 */
export function thinkingBudgetFor(effort: 'low' | 'medium' | 'high'): number {
  if (effort === 'high') return -1;
  if (effort === 'medium') return 4096;
  return 0;
}
