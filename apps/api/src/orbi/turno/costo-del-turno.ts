import { costoDeConsumoUsd, redondearUsd } from '../../platform/costs/precios';
import type { ConsumoPorProveedor } from './motor-de-turno';

/** 1 crédito = USD 0,001 a precio de lista (spec 2026-10-03, D2). */
export const USD_POR_CREDITO = 0.001;

/** Créditos de un costo: redondea para arriba (el épsilon absorbe el ruido de punto flotante) y 0 si no costó nada. */
export function creditosDe(costUsd: number): number {
  return costUsd > 0 ? Math.ceil(costUsd / USD_POR_CREDITO - 1e-9) : 0;
}

function sumar(consumo: ConsumoPorProveedor, fecha: Date): number {
  let usd = 0;
  for (const [provider, c] of consumo) {
    usd += costoDeConsumoUsd(
      { provider, model: c.model, promptTokens: c.promptTokens, cachedTokens: c.cachedTokens, completionTokens: c.completionTokens },
      fecha,
    );
  }
  return usd;
}

/** Costo total del mensaje (vueltas del modelo + IA que dispararon las tools) y su parte de tools. */
export function costoDelTurno(consumo: ConsumoPorProveedor, consumoDeTools: ConsumoPorProveedor, fecha: Date) {
  const toolsCostUsd = sumar(consumoDeTools, fecha);
  const costUsd = sumar(consumo, fecha) + toolsCostUsd;
  return { costUsd: redondearUsd(costUsd), toolsCostUsd: redondearUsd(toolsCostUsd), credits: creditosDe(costUsd) };
}
