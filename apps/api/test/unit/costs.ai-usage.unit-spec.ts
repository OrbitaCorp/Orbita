import { CostsService } from '../../src/platform/costs/costs.service';

// getAiUsageByFeature agrupa usage_events de Gemini/Groq por función (metadata.feature),
// proveedor y modelo. Sin base de datos: prisma es un objeto simple.
function makeService(events: any[]) {
  const prisma = { usageEvent: { findMany: jest.fn().mockResolvedValue(events) } } as any;
  return { svc: new CostsService(prisma, [] as any), prisma };
}

const SEPT_2026 = new Date('2026-09-15T12:00:00Z');
const ev = (provider: string, category: string, quantity: number, metadata: unknown, estimatedCostUsd: number | null = null, timestamp = SEPT_2026) => ({
  provider: { slug: provider }, category, quantity, estimatedCostUsd, metadata, timestamp,
});

describe('CostsService.getAiUsageByFeature (unit)', () => {
  it('agrupa por función, proveedor y modelo, y cuenta una request por cada evento de entrada', async () => {
    const { svc } = makeService([
      ev('gemini', 'prompt_tokens', 1000, { feature: 'ai-assist', model: 'gemini-3.6-flash' }),
      ev('gemini', 'completion_tokens', 500, { feature: 'ai-assist', model: 'gemini-3.6-flash' }),
      ev('gemini', 'prompt_tokens', 2000, { feature: 'ai-assist', model: 'gemini-3.6-flash' }),
      ev('gemini', 'completion_tokens', 100, { feature: 'ai-assist', model: 'gemini-3.6-flash' }),
      ev('groq', 'prompt_tokens', 300, { feature: 'ai-variants', model: 'openai/gpt-oss-20b', viaFallback: true }),
      ev('groq', 'completion_tokens', 80, { feature: 'ai-variants', model: 'openai/gpt-oss-20b', viaFallback: true }),
    ]);

    const r = await svc.getAiUsageByFeature('2026-09');

    expect(r.rows).toHaveLength(2);
    const assist = r.rows.find((x) => x.feature === 'ai-assist')!;
    expect(assist).toMatchObject({ provider: 'gemini', model: 'gemini-3.6-flash', requests: 2, promptTokens: 3000, completionTokens: 600 });
    // Eventos sin estimatedCostUsd: precio del modelo (precios.ts). gemini-3.6-flash: $0,75/M entrada + $3,75/M salida.
    expect(assist.costUsd).toBeCloseTo(3000 * 0.75 / 1e6 + 600 * 3.75 / 1e6, 8);
    const variantes = r.rows.find((x) => x.feature === 'ai-variants')!;
    expect(variantes).toMatchObject({ provider: 'groq', requests: 1, promptTokens: 300, completionTokens: 80 });
    // openai/gpt-oss-20b: $0,075/M entrada + $0,30/M salida = 0,0000465, y la fila va a 6 decimales.
    expect(variantes.costUsd).toBe(0.000047);
    expect(r.totalUsd).toBeCloseTo(assist.costUsd + variantes.costUsd, 8);
  });

  it('los eventos del chat de Orbi (sin metadata) se agrupan como orbi-chat', async () => {
    const { svc } = makeService([
      ev('gemini', 'prompt_tokens', 100, null),
      ev('gemini', 'completion_tokens', 10, null),
    ]);
    const r = await svc.getAiUsageByFeature('2026-09');
    expect(r.rows).toEqual([expect.objectContaining({ feature: 'orbi-chat', model: null, requests: 1 })]);
  });

  it('usa el estimatedCostUsd del evento cuando lo trae, en vez de tokens × precio', async () => {
    const { svc } = makeService([ev('gemini', 'prompt_tokens', 1_000_000, { feature: 'ai-scan' }, 0.5)]);
    const r = await svc.getAiUsageByFeature('2026-09');
    expect(r.rows[0].costUsd).toBe(0.5);
  });

  it('un evento viejo sin estimatedCostUsd se estima con el precio vigente en su fecha (Flash se duplica en 2027)', async () => {
    const { svc } = makeService([
      ev('gemini', 'completion_tokens', 1_000_000, { feature: 'orbi-panel', model: 'gemini-3.6-flash' }, null, new Date('2026-12-31T23:00:00Z')),
      ev('gemini', 'completion_tokens', 1_000_000, { feature: 'orbi-panel', model: 'gemini-3.6-flash' }, null, new Date('2027-01-01T01:00:00Z')),
    ]);
    const r = await svc.getAiUsageByFeature('2027-01');
    expect(r.rows[0].costUsd).toBeCloseTo(3.75 + 7.5, 6);
  });

  it('ordena de mayor a menor costo y pide solo tokens de Gemini y Groq del mes', async () => {
    const { svc, prisma } = makeService([
      ev('gemini', 'prompt_tokens', 10, { feature: 'chica' }),
      ev('gemini', 'prompt_tokens', 10_000_000, { feature: 'grande' }),
    ]);
    const r = await svc.getAiUsageByFeature('2026-09');
    expect(r.rows.map((x) => x.feature)).toEqual(['grande', 'chica']);
    const where = prisma.usageEvent.findMany.mock.calls[0][0].where;
    expect(where.category).toEqual({ in: ['prompt_tokens', 'completion_tokens'] });
    expect(where.provider).toEqual({ slug: { in: ['gemini', 'groq'] } });
  });
});
