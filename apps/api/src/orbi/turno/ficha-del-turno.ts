import type { LlmMessage, LlmToolDefinition } from '../llm/llm-adapter.interface';
import type { ConsumoPorProveedor } from './motor-de-turno';

// Piezas puras de la ficha de un turno (spec 2026-10-03 §5.1). Viven aparte del
// controller para poder testearlas sin levantar Nest.

export function proveedorDelTurno(consumo: ConsumoPorProveedor): 'gemini' | 'groq' | 'mixto' | undefined {
  const usados = [...consumo.entries()].filter(([, c]) => c.promptTokens > 0 || c.completionTokens > 0).map(([p]) => p);
  if (usados.length === 0) return undefined;
  return usados.length > 1 ? 'mixto' : usados[0];
}

export function totalesDelConsumo(consumo: ConsumoPorProveedor) {
  const t = { promptTokens: 0, completionTokens: 0, cachedTokens: 0, thinkingTokens: 0 };
  for (const c of consumo.values()) {
    t.promptTokens += c.promptTokens;
    t.completionTokens += c.completionTokens;
    t.cachedTokens += c.cachedTokens;
    t.thinkingTokens += c.thinkingTokens;
  }
  return t;
}

export interface CaracteresDelContexto { system: number; tools: number; history: number; message: number }

/**
 * Tamaño de lo que se manda en la primera vuelta, por partes. En caracteres: contar tokens exactos pediría una llamada al proveedor.
 * `contexto` (lo del negocio y la pantalla, que va como primer mensaje y no en el system) se suma a `system`: antes iba ahí, y así
 * las fichas de antes y de después se comparan.
 */
export function caracteresDelContexto(p: { system: string; contexto?: string; tools: LlmToolDefinition[]; history: LlmMessage[]; message: string }): CaracteresDelContexto {
  return {
    system: p.system.length + (p.contexto?.length ?? 0),
    tools: p.tools.length ? JSON.stringify(p.tools).length : 0,
    history: p.history.reduce((n, m) => n + (m.content?.length ?? 0), 0),
    message: p.message.length,
  };
}
