import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// Gemini expone un endpoint OpenAI-compatible: mismo `chat.completions.create`,
// mismo formato de `tools`, `response_format` y streaming que ya usaban los tres
// call sites cuando esto era Groq. Por eso la migración fue cambiar el cliente y
// los IDs de modelo, no reescribir la lógica.
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

// Default en las dos superficies de Orbi (panel y wizard) y en product-ai. Se
// pisa por env sin necesidad de deploy de código: ORBI_MODEL / ORBI_MODEL_PANEL
// / ORBI_MODEL_WIZARD / PRODUCT_AI_MODEL. Confirmar el ID vigente en la consola
// de AI Studio antes de subir a un modelo pro para el panel.
export const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Cliente OpenAI apuntado al endpoint OpenAI-compatible de Gemini. Lo comparten
 * el adapter de Orbi, ProductAiService y las tools del wizard. Si
 * GEMINI_API_KEY no está configurada, esos tres flujos responden 503 pero el
 * resto del backend sigue funcionando (mismo criterio lazy que tenía Groq).
 */
export function createGeminiClient(config: ConfigService): OpenAI {
  const apiKey = config.get<string>('GEMINI_API_KEY');
  if (!apiKey) throw new ServiceUnavailableException('GEMINI_API_KEY no configurada');
  return new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
}
