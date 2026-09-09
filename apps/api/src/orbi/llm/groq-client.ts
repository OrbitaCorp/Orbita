import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

// Groq es el proveedor de FALLBACK: se usa solo cuando Gemini no está
// disponible (429/5xx/red). Ver FallbackLlmAdapter y esErrorDeDisponibilidad.
// Si GROQ_API_KEY no está seteada, no hay fallback (Orbi corre solo con Gemini).

// Chat de Orbi. 120b y no 20b: el 20b escribe el botón como texto
// (<selectWizardOption .../>) en vez de llamar la tool — la falla `sin-fugas`
// más cara del wizard (ver RBT-686).
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
// product-ai y las tools del wizard: llamadas chicas, JSON acotado.
export const GROQ_AUX_MODEL = 'openai/gpt-oss-20b';

export function createGroqClient(config: ConfigService): Groq {
  const apiKey = config.get<string>('GROQ_API_KEY');
  if (!apiKey) throw new ServiceUnavailableException('GROQ_API_KEY no configurada');
  return new Groq({ apiKey });
}
