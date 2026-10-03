import {
  costoDelEvento,
  costoEstimadoUsd,
  precioTokens,
  PROVEEDORES_INTERNOS,
  redondearUsd,
  tienePrecioPropio,
} from '../../src/platform/costs/precios';
import { InternalCostAdapter } from '../../src/platform/costs/adapters/internal.adapter';

// Precios por modelo y con fecha de vigencia (precios.ts). Valores de
// ai.google.dev/gemini-api/docs/pricing y console.groq.com/docs/models al 2026-10-03.
const OCT_2026 = new Date('2026-10-03T12:00:00Z');
const ULTIMO_INSTANTE_2026 = new Date('2026-12-31T23:59:59.999Z');
const PRIMER_INSTANTE_2027 = new Date('2027-01-01T00:00:00.000Z');

describe('precioTokens (unit)', () => {
  it.each([
    ['gemini', 'gemini-3.6-flash', 0.75, 3.75],
    ['gemini', 'gemini-3.7-flash', 0.75, 3.75],
    ['gemini', 'gemini-3.8-flash', 0.75, 3.75],
    ['gemini', 'gemini-3.5-flash-lite', 0.3, 2.5],
    ['gemini', 'gemini-3.1-pro-preview', 2, 12],
    ['groq', 'openai/gpt-oss-120b', 0.15, 0.6],
    ['groq', 'openai/gpt-oss-20b', 0.075, 0.3],
    ['groq', 'qwen/qwen3.8-27b', 0.8, 4],
  ])('%s %s: %d / %d USD por 1M', (proveedor, modelo, entrada, salida) => {
    expect(precioTokens(proveedor, modelo, OCT_2026)).toEqual({ entrada, salida });
  });

  it('los Flash duplican el precio desde el 1/1/2027 a las 00:00 UTC', () => {
    for (const modelo of ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash']) {
      expect(precioTokens('gemini', modelo, ULTIMO_INSTANTE_2026)).toEqual({ entrada: 0.75, salida: 3.75 });
      expect(precioTokens('gemini', modelo, PRIMER_INSTANTE_2027)).toEqual({ entrada: 1.5, salida: 7.5 });
      expect(precioTokens('gemini', modelo, new Date('2028-06-01T00:00:00Z'))).toEqual({ entrada: 1.5, salida: 7.5 });
    }
  });

  it('los modelos sin corte de precio no cambian en 2027', () => {
    expect(precioTokens('gemini', 'gemini-3.5-flash-lite', PRIMER_INSTANTE_2027)).toEqual({ entrada: 0.3, salida: 2.5 });
    expect(precioTokens('groq', 'openai/gpt-oss-120b', PRIMER_INSTANTE_2027)).toEqual({ entrada: 0.15, salida: 0.6 });
  });

  it('un modelo que no está en la tabla, o un evento sin modelo, se cobra con el default del proveedor', () => {
    expect(precioTokens('gemini', 'gemini-flash-latest', OCT_2026)).toEqual({ entrada: 0.75, salida: 3.75 });
    expect(precioTokens('gemini', null, PRIMER_INSTANTE_2027)).toEqual({ entrada: 1.5, salida: 7.5 });
    expect(precioTokens('groq', 'llama-3.3-70b-versatile', OCT_2026)).toEqual({ entrada: 0.15, salida: 0.6 });
    expect(precioTokens('groq', undefined, OCT_2026)).toEqual({ entrada: 0.15, salida: 0.6 });
    expect(tienePrecioPropio('gemini', 'gemini-flash-latest')).toBe(false);
    expect(tienePrecioPropio('gemini', null)).toBe(false);
    expect(tienePrecioPropio('groq', 'qwen/qwen3.8-27b')).toBe(true);
  });

  it('un proveedor sin tabla de IA no tiene precio de tokens', () => {
    expect(precioTokens('openai', 'gpt-x', OCT_2026)).toBeNull();
    expect(precioTokens('serper', null, OCT_2026)).toBeNull();
  });
});

describe('costoEstimadoUsd (unit)', () => {
  const tokens = (proveedor: string, modelo: string | null, categoria: string, cantidad: number, fecha = OCT_2026) =>
    costoEstimadoUsd({ proveedor, modelo, categoria, cantidad, fecha });

  it('entrada y salida de gemini-3.6-flash', () => {
    expect(tokens('gemini', 'gemini-3.6-flash', 'prompt_tokens', 1_000_000)).toBeCloseTo(0.75, 10);
    expect(tokens('gemini', 'gemini-3.6-flash', 'completion_tokens', 1_000_000)).toBeCloseTo(3.75, 10);
    expect(tokens('gemini', 'gemini-3.6-flash', 'prompt_tokens', 2000)).toBeCloseTo(0.0015, 10);
  });

  it('la misma llamada cuesta el doble en 2027', () => {
    const antes = tokens('gemini', 'gemini-3.6-flash', 'completion_tokens', 420, ULTIMO_INSTANTE_2026)!;
    const despues = tokens('gemini', 'gemini-3.6-flash', 'completion_tokens', 420, PRIMER_INSTANTE_2027)!;
    expect(antes).toBeCloseTo(420 * 3.75 / 1e6, 12);
    expect(despues).toBeCloseTo(420 * 7.5 / 1e6, 12);
  });

  it('Groq por modelo: el 20b es más barato que el de visión', () => {
    expect(tokens('groq', 'openai/gpt-oss-20b', 'prompt_tokens', 1_000_000)).toBeCloseTo(0.075, 10);
    expect(tokens('groq', 'qwen/qwen3.8-27b', 'completion_tokens', 1_000_000)).toBeCloseTo(4, 10);
  });

  it('las categorías por unidad siguen con su precio y lo que no tiene precio da null', () => {
    expect(costoEstimadoUsd({ proveedor: 'tavily', categoria: 'search_query', cantidad: 10, fecha: OCT_2026 })).toBeCloseTo(0.08, 10);
    expect(costoEstimadoUsd({ proveedor: 'serper', categoria: 'search_query', cantidad: 3, fecha: OCT_2026 })).toBeCloseTo(0.003, 10);
    expect(costoEstimadoUsd({ proveedor: 'resend', categoria: 'email_sent', cantidad: 50, fecha: OCT_2026 })).toBe(0);
    expect(costoEstimadoUsd({ proveedor: 'serper', categoria: 'search_error', cantidad: 1, fecha: OCT_2026 })).toBeNull();
    expect(costoEstimadoUsd({ proveedor: 'openai', categoria: 'prompt_tokens', cantidad: 1, fecha: OCT_2026 })).toBeNull();
  });
});

describe('costoDelEvento (unit)', () => {
  const evento = (over: Partial<Parameters<typeof costoDelEvento>[1]>) => ({
    category: 'prompt_tokens',
    quantity: 1_000_000,
    estimatedCostUsd: null,
    metadata: { feature: 'ai-assist', model: 'gemini-3.6-flash' },
    timestamp: OCT_2026,
    ...over,
  });

  it('usa el estimatedCostUsd guardado aunque la tabla diga otra cosa', () => {
    expect(costoDelEvento('gemini', evento({ estimatedCostUsd: 0.1 }))).toBe(0.1);
    expect(costoDelEvento('gemini', evento({ estimatedCostUsd: 0 }))).toBe(0);
  });

  it('sin estimatedCostUsd, estima con el modelo de metadata y el precio vigente en la fecha del evento', () => {
    expect(costoDelEvento('gemini', evento({}))).toBeCloseTo(0.75, 10);
    expect(costoDelEvento('gemini', evento({ timestamp: PRIMER_INSTANTE_2027 }))).toBeCloseTo(1.5, 10);
    expect(costoDelEvento('groq', evento({ metadata: { model: 'openai/gpt-oss-20b' } }))).toBeCloseTo(0.075, 10);
  });

  it('sin metadata usa el default del proveedor, y sin precio suma 0', () => {
    expect(costoDelEvento('gemini', evento({ metadata: null }))).toBeCloseTo(0.75, 10);
    expect(costoDelEvento('serper', evento({ category: 'search_error', quantity: 1 }))).toBe(0);
  });
});

describe('redondearUsd (unit)', () => {
  it('redondea a 6 decimales, la precisión de estimated_cost_usd', () => {
    expect(redondearUsd(0.0015749)).toBe(0.001575);
    expect(redondearUsd(420 * 3.75 / 1e6)).toBe(0.001575);
    expect(redondearUsd(0.0000004)).toBe(0);
  });
});

describe('InternalCostAdapter (unit)', () => {
  it('suma por categoría con el precio de cada modelo y respeta el costo guardado', async () => {
    const prisma = {
      costProvider: { findUnique: jest.fn().mockResolvedValue({ id: 'prov-gemini' }) },
      usageEvent: {
        findMany: jest.fn().mockResolvedValue([
          { category: 'prompt_tokens', quantity: 1_000_000, estimatedCostUsd: null, metadata: { model: 'gemini-3.1-pro-preview' }, timestamp: OCT_2026 },
          { category: 'completion_tokens', quantity: 1_000_000, estimatedCostUsd: null, metadata: { model: 'gemini-3.6-flash' }, timestamp: OCT_2026 },
          { category: 'completion_tokens', quantity: 1_000_000, estimatedCostUsd: 3, metadata: { model: 'gemini-3.6-flash' }, timestamp: OCT_2026 },
        ]),
      },
    } as any;
    const adapter = new InternalCostAdapter(prisma);
    jest.spyOn((adapter as any).logger, 'log').mockImplementation(() => {});

    const r = await adapter.fetchMonthlyCostForSlug('gemini', '2026-10');

    expect(r.breakdown.prompt_tokens).toBeCloseTo(2, 10);
    expect(r.breakdown.completion_tokens).toBeCloseTo(3.75 + 3, 10);
    expect(r.amountUsd).toBe(8.75);
    const select = prisma.usageEvent.findMany.mock.calls[0][0].select;
    expect(select).toMatchObject({ metadata: true, timestamp: true });
  });

  it('sincroniza los mismos proveedores que antes', () => {
    expect([...PROVEEDORES_INTERNOS].sort()).toEqual(['gemini', 'groq', 'resend', 'serper', 'tavily']);
  });
});
