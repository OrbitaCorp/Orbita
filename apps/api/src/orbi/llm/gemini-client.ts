import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Se usa el SDK NATIVO de Gemini (@google/genai), no el endpoint
// OpenAI-compatible: las API keys nuevas de Google AI Studio (prefijo `AQ.`)
// son rechazadas con "Invalid Auth key" en la capa OpenAI-compat, pero andan
// bien en el endpoint nativo. Ver discuss.ai.google.dev sobre el tema.
// gemini-3.6-flash y no 2.5-flash: al 2026-09 el 2.5-flash ya no está
// disponible para cuentas nuevas ("no longer available to new users", 404) y
// Google recomienda 3.6-flash como reemplazo. Hay 3.7 y 3.8 también; subir por
// env (ORBI_MODEL / ORBI_MODEL_PANEL / ORBI_MODEL_WIZARD / PRODUCT_AI_MODEL) si
// se quiere. Para el panel se puede poner un pro con ORBI_MODEL_PANEL.
export const DEFAULT_MODEL = 'gemini-3.6-flash';

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
export const THINKING_MINIMO = ThinkingLevel.MINIMAL;

export function thinkingLevelFor(effort: 'low' | 'medium' | 'high'): ThinkingLevel {
  if (effort === 'high') return ThinkingLevel.HIGH;
  if (effort === 'medium') return ThinkingLevel.MEDIUM;
  return ThinkingLevel.LOW;
}
