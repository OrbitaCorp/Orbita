import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createGeminiClient, THINKING_MINIMO } from './gemini-client';
import { createGroqClient, GROQ_AUX_MODEL } from './groq-client';
import { esErrorDeDisponibilidad } from './llm-errors';

const logger = new Logger('generarTexto');

export interface GenerarTextoOpts {
  system: string;
  user: string;
  maxTokens: number;
  /** Fuerza salida JSON (responseMimeType / response_format json_object). */
  json?: boolean;
  /** ID de modelo Gemini a usar (el de fallback es siempre GROQ_AUX_MODEL). */
  geminiModel: string;
}

export interface GenerarTextoResult {
  text: string;
  /** Normalizado: 'MAX_TOKENS' cuando el modelo cortó por tope de tokens. */
  finishReason?: string;
  viaFallback: boolean;
  /** Quién respondió de verdad (si Gemini falló y contestó Groq, es 'groq'). */
  provider?: 'gemini' | 'groq';
  model?: string;
  /** Consumo informado por el proveedor; undefined si no lo informó (un 0
   *  inventado se promediaría como si la llamada hubiera sido gratis). */
  promptTokens?: number;
  /** Incluye los tokens de razonamiento: se cobran como salida. */
  completionTokens?: number;
  /** De promptTokens, los que vinieron de caché. */
  cachedTokens?: number;
  /** De completionTokens, los de pensamiento. */
  thinkingTokens?: number;
}

/**
 * Generación no-streaming de texto/JSON para product-ai y las tools del wizard.
 * Prueba Gemini; si GROQ_API_KEY está seteada y el error es de disponibilidad
 * (429/5xx/red), cae a Groq. Un 400/401/etc. de Gemini se propaga tal cual
 * (el caller decide qué hacer).
 */
export async function generarTexto(
  config: ConfigService,
  opts: GenerarTextoOpts,
): Promise<GenerarTextoResult> {
  try {
    return await conGemini(config, opts);
  } catch (err) {
    if (!config.get<string>('GROQ_API_KEY') || !esErrorDeDisponibilidad(err)) throw err;
    logger.warn(`Gemini no disponible (${(err as Error)?.message ?? err}); generando con Groq`);
    return await conGroq(config, opts);
  }
}

async function conGemini(config: ConfigService, opts: GenerarTextoOpts): Promise<GenerarTextoResult> {
  const client = createGeminiClient(config);
  const response = await client.models.generateContent({
    model: opts.geminiModel,
    contents: [{ role: 'user', parts: [{ text: opts.user }] }],
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens,
      thinkingConfig: { thinkingLevel: THINKING_MINIMO },
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const uso = response.usageMetadata;
  return {
    text: response.text?.trim() ?? '',
    finishReason: response.candidates?.[0]?.finishReason,
    viaFallback: false,
    provider: 'gemini',
    model: opts.geminiModel,
    promptTokens: uso?.promptTokenCount ?? undefined,
    completionTokens: uso ? (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0) : undefined,
    cachedTokens: uso?.cachedContentTokenCount ?? undefined,
    thinkingTokens: uso?.thoughtsTokenCount ?? undefined,
  };
}

async function conGroq(config: ConfigService, opts: GenerarTextoOpts): Promise<GenerarTextoResult> {
  const client = createGroqClient(config);
  const response = await client.chat.completions.create({
    model: GROQ_AUX_MODEL,
    reasoning_effort: 'low',
    max_completion_tokens: opts.maxTokens,
    ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });
  const finish = response.choices[0]?.finish_reason;
  return {
    text: response.choices[0]?.message?.content?.trim() ?? '',
    finishReason: finish === 'length' ? 'MAX_TOKENS' : finish ?? undefined,
    viaFallback: true,
    provider: 'groq',
    model: GROQ_AUX_MODEL,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    cachedTokens: (response.usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)?.prompt_tokens_details?.cached_tokens,
    thinkingTokens: (response.usage as { completion_tokens_details?: { reasoning_tokens?: number } } | undefined)?.completion_tokens_details?.reasoning_tokens,
  };
}
