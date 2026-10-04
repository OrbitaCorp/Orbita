import type { UsageMeteringService } from './usage-metering.service';

/**
 * Registra en usage_events el consumo de una llamada de texto (no streaming).
 * Mismo formato que ProductAiService.registrarUso: dos eventos, entrada y salida.
 * Sin consumo informado no escribe nada (un 0 se promediaría como gratis).
 */
export function medirConsumoDeTexto(
  metering: Pick<UsageMeteringService, 'track'>,
  r: { provider?: 'gemini' | 'groq'; model?: string; promptTokens?: number; completionTokens?: number; cachedTokens?: number; thinkingTokens?: number },
  ctx: { feature: string; businessId?: string; metadata?: Record<string, unknown> },
): void {
  if (!r.provider || !r.promptTokens) return;
  const metadata = { feature: ctx.feature, model: r.model, cachedTokens: r.cachedTokens, thinkingTokens: r.thinkingTokens, ...ctx.metadata };
  const comun = { providerSlug: r.provider, businessId: ctx.businessId, unit: 'tokens', metadata };
  void metering.track({ ...comun, category: 'prompt_tokens', quantity: r.promptTokens });
  void metering.track({ ...comun, category: 'completion_tokens', quantity: r.completionTokens ?? 0 });
}
