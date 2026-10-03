import type { Prisma } from '@prisma/client';

// Precios para estimar el gasto de los proveedores que se miden en usage_events.
//
// IA (Gemini y Groq): por MODELO y con fecha de vigencia, en USD por 1M de tokens.
// Antes había un solo precio por proveedor (gemini a $0,10/$0,40, el de un modelo
// viejo) y el panel de Costos subestimaba el gasto de IA. Fuentes, verificadas el
// 2026-10-03:
//   - https://ai.google.dev/gemini-api/docs/pricing ("Last updated 2026-10-01")
//   - https://console.groq.com/docs/models
// La salida de Gemini incluye los tokens de pensamiento (los adapters ya los suman a
// completionTokens). La entrada cacheada (cachedContentTokenCount) tiene su propio precio
// (`cacheada`); si el modelo no lo trae, se cobra como entrada normal.
//
// UsageMeteringService guarda en estimatedCostUsd el costo de cada evento de tokens al
// registrarlo: cambiar un precio acá no reescribe los meses ya registrados. Los eventos
// anteriores, que no lo traen, se estiman con el precio vigente en la fecha del evento.

/** USD por 1M de tokens. `cacheada` es lo que cuesta la parte de la entrada que sale de la caché. */
export type PrecioTokens = { entrada: number; salida: number; cacheada: number };

// Un tramo vale desde `desde` (inclusive, 00:00 UTC) hasta el `desde` del siguiente.
// Van del más viejo al más nuevo; el primero, sin `desde`, vale desde siempre.
type Tramo = Omit<PrecioTokens, 'cacheada'> & { cacheada?: number; desde?: string };

// gemini-3.6/3.7/3.8-flash: precio de lanzamiento hasta el 31/12/2026, el doble desde el 1/1/2027.
const GEMINI_FLASH: Tramo[] = [
  { entrada: 0.75, cacheada: 0.075, salida: 3.75 },
  { desde: '2027-01-01', entrada: 1.5, cacheada: 0.15, salida: 7.5 },
];

export const PRECIOS_IA: Record<string, Record<string, Tramo[]>> = {
  gemini: {
    'gemini-3.6-flash': GEMINI_FLASH,
    'gemini-3.7-flash': GEMINI_FLASH,
    'gemini-3.8-flash': GEMINI_FLASH,
    'gemini-3.5-flash-lite': [{ entrada: 0.3, cacheada: 0.03, salida: 2.5 }],
    // Hasta 200k tokens de entrada por pedido; arriba de eso Google cobra más.
    'gemini-3.1-pro-preview': [{ entrada: 2, cacheada: 0.2, salida: 12 }],
  },
  groq: {
    'openai/gpt-oss-120b': [{ entrada: 0.15, salida: 0.6 }],
    'openai/gpt-oss-20b': [{ entrada: 0.075, salida: 0.3 }],
    'qwen/qwen3.8-27b': [{ entrada: 0.8, salida: 4 }],
  },
};

// Con qué modelo se cobra un evento cuyo modelo no está en la tabla, o que no lo trae
// (los del chat de Orbi anteriores a metadata.model): el default de cada proveedor
// (DEFAULT_MODEL de gemini-client.ts y GROQ_DEFAULT_MODEL de groq-client.ts).
const MODELO_POR_DEFECTO: Record<string, string> = {
  gemini: 'gemini-3.6-flash',
  groq: 'openai/gpt-oss-120b',
};

// El resto: USD por unidad de la categoría del evento.
const PRECIO_POR_UNIDAD: Record<string, Record<string, number>> = {
  // Resend: free tier 100/día, $0.001/email después (estimación gruesa)
  resend: { email_sent: 0 },
  // Serper: 2.500 consultas gratis, después $0.001/consulta
  serper: { search_query: 0.001 },
  // Tavily: 1.000 consultas gratis por mes, después $0.008/consulta
  tavily: { search_query: 0.008 },
};

/** Proveedores cuyo costo sale de usage_events (los sincroniza InternalCostAdapter). */
export const PROVEEDORES_INTERNOS = [...Object.keys(PRECIOS_IA), ...Object.keys(PRECIO_POR_UNIDAD)];

const LADO_DE_LA_CATEGORIA: Record<string, 'entrada' | 'salida'> = {
  prompt_tokens: 'entrada',
  completion_tokens: 'salida',
};

export function esEventoDeTokens(categoria: string): boolean {
  return categoria in LADO_DE_LA_CATEGORIA;
}

/** Si el modelo tiene precio propio en la tabla (si no, se cobra con el default del proveedor). */
export function tienePrecioPropio(proveedor: string, modelo: string | null | undefined): boolean {
  return !!modelo && !!PRECIOS_IA[proveedor]?.[modelo];
}

/** Precio por 1M de tokens de un modelo en una fecha. null si el proveedor no tiene tabla de IA. */
export function precioTokens(proveedor: string, modelo: string | null | undefined, fecha: Date): PrecioTokens | null {
  const tabla = PRECIOS_IA[proveedor];
  if (!tabla) return null;
  const tramos = (modelo ? tabla[modelo] : undefined) ?? tabla[MODELO_POR_DEFECTO[proveedor]];
  let vigente = tramos[0];
  for (const t of tramos) {
    if (!t.desde || fecha.getTime() >= Date.parse(t.desde)) vigente = t;
  }
  return { entrada: vigente.entrada, salida: vigente.salida, cacheada: vigente.cacheada ?? vigente.entrada };
}

/** Costo en USD de un consumo de tokens con caché. promptTokens INCLUYE los cacheados. */
export function costoDeConsumoUsd(
  c: { provider: string; model: string | null; promptTokens: number; cachedTokens?: number; completionTokens: number },
  fecha: Date,
): number {
  const p = precioTokens(c.provider, c.model, fecha);
  if (!p) return 0;
  const cacheados = Math.min(c.cachedTokens ?? 0, c.promptTokens);
  return ((c.promptTokens - cacheados) * p.entrada + cacheados * p.cacheada + c.completionTokens * p.salida) / 1_000_000;
}

/**
 * Costo estimado en USD de `cantidad` unidades de una categoría. null si no hay precio
 * para ese proveedor y categoría.
 */
export function costoEstimadoUsd(e: {
  proveedor: string;
  categoria: string;
  cantidad: number;
  modelo?: string | null;
  fecha: Date;
}): number | null {
  const lado = LADO_DE_LA_CATEGORIA[e.categoria];
  if (lado) {
    const precio = precioTokens(e.proveedor, e.modelo, e.fecha);
    return precio ? (e.cantidad * precio[lado]) / 1_000_000 : null;
  }
  const unitario = PRECIO_POR_UNIDAD[e.proveedor]?.[e.categoria];
  return unitario != null ? e.cantidad * unitario : null;
}

/** El modelo que guardó el evento en metadata.model, si lo trae. */
export function modeloDelEvento(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const model = (metadata as Record<string, unknown>).model;
  return typeof model === 'string' ? model : null;
}

/**
 * Lo que costó un evento de usage_events: el estimatedCostUsd que se guardó al
 * registrarlo y, si no lo trae, la estimación con el precio vigente en su fecha.
 */
export function costoDelEvento(
  proveedor: string,
  e: {
    category: string;
    quantity: Prisma.Decimal | number;
    estimatedCostUsd: Prisma.Decimal | number | null;
    metadata: Prisma.JsonValue | null;
    timestamp: Date;
  },
): number {
  if (e.estimatedCostUsd != null) return Number(e.estimatedCostUsd);
  return (
    costoEstimadoUsd({
      proveedor,
      categoria: e.category,
      cantidad: Number(e.quantity),
      modelo: modeloDelEvento(e.metadata),
      fecha: e.timestamp,
    }) ?? 0
  );
}

/** Redondeo a la precisión de usage_events.estimated_cost_usd (DECIMAL(12,6)). */
export function redondearUsd(usd: number): number {
  return Math.round(usd * 1_000_000) / 1_000_000;
}
