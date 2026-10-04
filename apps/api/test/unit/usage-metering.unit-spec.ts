import { UsageMeteringService } from '../../src/platform/costs/usage-metering.service';

// track() guarda el costo de cada evento de tokens con el precio del modelo vigente al
// registrarlo (precios.ts): así cambiar un precio no reescribe los meses ya registrados.
function makeService() {
  const create = jest.fn().mockResolvedValue({});
  const prisma = {
    costProvider: { findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: `prov-${where.slug}` })) },
    usageEvent: { create },
  } as any;
  const svc = new UsageMeteringService(prisma);
  const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => {});
  const guardado = () => create.mock.calls.map((c) => c[0].data);
  return { svc, guardado, warn };
}

describe('UsageMeteringService.track — costo de los eventos de tokens (unit)', () => {
  afterEach(() => jest.useRealTimers());

  // La forma real en que registra cada función (orbi.controller.ts medirConsumo y
  // product-ai.service.ts registrarUso).
  it.each([
    ['orbi-panel', 'gemini', { feature: 'orbi-panel', model: 'gemini-3.6-flash', memberId: 'm-1', conversationId: 'c-1' }, 0.75, 3.75],
    ['orbi-wizard', 'groq', { feature: 'orbi-wizard', model: 'openai/gpt-oss-120b', memberId: null, conversationId: null }, 0.15, 0.6],
    ['ai-assist', 'gemini', { feature: 'ai-assist', model: 'gemini-3.6-flash' }, 0.75, 3.75],
    ['ai-variants', 'groq', { feature: 'ai-variants', model: 'openai/gpt-oss-20b', viaFallback: true }, 0.075, 0.3],
    ['ai-scan', 'gemini', { feature: 'ai-scan', model: 'gemini-3.8-flash' }, 0.75, 3.75],
    ['ai-scan con Groq', 'groq', { feature: 'ai-scan', model: 'qwen/qwen3.8-27b', viaFallback: true }, 0.8, 4],
  ])('%s guarda estimatedCostUsd de entrada y salida', async (_nombre, providerSlug, metadata, entrada, salida) => {
    jest.useFakeTimers({ now: new Date('2026-10-03T12:00:00Z') });
    const { svc, guardado } = makeService();

    await svc.track({ providerSlug, businessId: 'biz-1', category: 'prompt_tokens', quantity: 2000, unit: 'tokens', metadata });
    await svc.track({ providerSlug, businessId: 'biz-1', category: 'completion_tokens', quantity: 400, unit: 'tokens', metadata });

    const [entradaGuardada, salidaGuardada] = guardado();
    expect(entradaGuardada).toMatchObject({ providerId: `prov-${providerSlug}`, category: 'prompt_tokens', quantity: 2000, metadata });
    expect(entradaGuardada.estimatedCostUsd).toBeCloseTo((2000 * entrada) / 1e6, 6);
    expect(salidaGuardada.estimatedCostUsd).toBeCloseTo((400 * salida) / 1e6, 6);
  });

  it('desde el 1/1/2027 guarda el precio nuevo de Flash; lo ya guardado no cambia', async () => {
    const metadata = { feature: 'ai-assist', model: 'gemini-3.6-flash' };
    const { svc, guardado } = makeService();

    jest.useFakeTimers({ now: new Date('2026-12-31T23:59:59Z') });
    await svc.track({ providerSlug: 'gemini', category: 'completion_tokens', quantity: 1_000_000, unit: 'tokens', metadata });
    jest.setSystemTime(new Date('2027-01-01T00:00:01Z'));
    await svc.track({ providerSlug: 'gemini', category: 'completion_tokens', quantity: 1_000_000, unit: 'tokens', metadata });

    expect(guardado().map((d) => d.estimatedCostUsd)).toEqual([3.75, 7.5]);
  });

  it('redondea a 6 decimales, la precisión de la columna', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-03T12:00:00Z') });
    const { svc, guardado } = makeService();
    await svc.track({ providerSlug: 'groq', category: 'prompt_tokens', quantity: 333, unit: 'tokens', metadata: { model: 'openai/gpt-oss-20b' } });
    // 333 × 0,075 / 1M = 0,000024975
    expect(guardado()[0].estimatedCostUsd).toBe(0.000025);
  });

  it('un modelo sin precio propio se cobra con el default del proveedor y avisa una sola vez', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-03T12:00:00Z') });
    const { svc, guardado, warn } = makeService();
    const metadata = { feature: 'orbi-panel', model: 'gemini-flash-latest' };

    await svc.track({ providerSlug: 'gemini', category: 'prompt_tokens', quantity: 1_000_000, unit: 'tokens', metadata });
    await svc.track({ providerSlug: 'gemini', category: 'completion_tokens', quantity: 1_000_000, unit: 'tokens', metadata });

    expect(guardado().map((d) => d.estimatedCostUsd)).toEqual([0.75, 3.75]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('gemini/gemini-flash-latest');
  });

  it('respeta el estimatedCostUsd que manda el llamador', async () => {
    const { svc, guardado } = makeService();
    await svc.track({ providerSlug: 'gemini', category: 'prompt_tokens', quantity: 1000, unit: 'tokens', estimatedCostUsd: 0.5, metadata: { model: 'gemini-3.6-flash' } });
    expect(guardado()[0].estimatedCostUsd).toBe(0.5);
  });

  it('no inventa costo para lo que no es tokens ni para un proveedor sin tabla de IA', async () => {
    const { svc, guardado } = makeService();
    await svc.track({ providerSlug: 'serper', category: 'search_query', quantity: 1, unit: 'queries' });
    await svc.track({ providerSlug: 'openai', category: 'prompt_tokens', quantity: 1000, unit: 'tokens', metadata: { model: 'gpt-x' } });
    expect(guardado().map((d) => d.estimatedCostUsd)).toEqual([null, null]);
  });
});
