import { WizardAnalyticsService } from '../../src/wizard-analytics/wizard-analytics.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { LlmAdapter } from '../../src/orbi/llm/llm-adapter.interface';

// El endpoint de ingesta es PÚBLICO y sin auth. Estos tests cubren la parte
// que lo hace tolerable: nada que no esté en la lista blanca entra, y por
// `meta` no se cuela texto tipeado por el usuario.

describe('WizardAnalyticsService.ingest', () => {
  let createMany: jest.Mock;
  let service: WizardAnalyticsService;

  beforeEach(() => {
    createMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = { wizardEvent: { createMany } } as unknown as PrismaService;
    service = new WizardAnalyticsService(prisma, {} as LlmAdapter);
  });

  const lote = (events: Record<string, unknown>[]) =>
    ({ sessionId: 'sesion-1234', anonId: 'anon-1234', events }) as never;

  it('descarta tipos de evento que no están en la lista blanca', async () => {
    const r = await service.ingest(
      lote([{ type: 'step_view', step: 1 }, { type: 'inventado_por_alguien' }]),
    );

    expect(r.guardados).toBe(1);
    expect(createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ type: 'step_view' })] });
  });

  it('no toca la base si el lote entero era basura', async () => {
    const r = await service.ingest(lote([{ type: 'drop table' }]));

    expect(r.guardados).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('redacta y recorta los strings de meta — ahí no puede viajar lo que el usuario tipeó', async () => {
    await service.ingest(
      lote([{ type: 'field_error', field: 'email', meta: { valor: 'juan@gmail.com', motivo: 'formato' } }]),
    );

    const [{ data }] = createMany.mock.calls[0];
    expect(data[0].meta).toEqual({ valor: '[email]', motivo: 'formato' });
  });

  it('deja pasar números y booleanos de meta, que son los que sirven', async () => {
    await service.ingest(
      lote([{ type: 'field_blur', field: 'nombre', meta: { vacio: true, intentos: 3 } }]),
    );

    const [{ data }] = createMany.mock.calls[0];
    expect(data[0].meta).toEqual({ vacio: true, intentos: 3 });
  });

  it('tira objetos anidados de meta en vez de guardarlos', async () => {
    await service.ingest(
      lote([{ type: 'field_blur', field: 'nombre', meta: { anidado: { texto: 'lo que sea' } } }]),
    );

    const [{ data }] = createMany.mock.calls[0];
    expect(data[0].meta).toBeUndefined();
  });

  it('copia sessionId/anonId del lote a cada fila', async () => {
    await service.ingest(lote([{ type: 'orbi_open' }]));

    const [{ data }] = createMany.mock.calls[0];
    expect(data[0]).toMatchObject({ sessionId: 'sesion-1234', anonId: 'anon-1234' });
  });
});
