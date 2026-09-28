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
// Escaneo de producto por foto: único modelo de Groq que acepta imágenes (los
// gpt-oss son solo texto). Último recurso si TODOS los modelos Gemini están
// caídos. Límite de la cuenta on_demand al 2026-09-28: 1000 tokens de salida por
// minuto, o sea 1-2 escaneos por minuto: alcanza de emergencia, no de carga normal.
export const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';
// Groq rechaza imágenes en base64 de más de 4 MB.
export const GROQ_MAX_IMAGE_BASE64 = 4 * 1024 * 1024;

export function createGroqClient(config: ConfigService): Groq {
  const apiKey = config.get<string>('GROQ_API_KEY');
  if (!apiKey) throw new ServiceUnavailableException('GROQ_API_KEY no configurada');
  return new Groq({ apiKey });
}
