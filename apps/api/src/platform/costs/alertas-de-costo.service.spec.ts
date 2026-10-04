import { AlertasDeCostoService } from './alertas-de-costo.service';

const AHORA = new Date('2026-10-15T12:00:00.000Z');

function armar(opts: { limites: unknown[]; amountUsd?: number | null; yaAlertados?: number[] }) {
  const yaAlertados = opts.yaAlertados ?? [];
  const prisma = {
    costLimit: { findMany: jest.fn().mockResolvedValue(opts.limites) },
    costSnapshot: {
      findFirst: jest.fn().mockResolvedValue(opts.amountUsd == null ? null : { amountUsd: opts.amountUsd }),
    },
    costAlert: {
      findFirst: jest.fn(async ({ where }: { where: { percentReached: number } }) =>
        yaAlertados.includes(where.percentReached) ? { id: 'a' } : null,
      ),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return { prisma, service: new AlertasDeCostoService(prisma as never) };
}

const limite = (extra: Record<string, unknown> = {}) => ({
  id: 'l1',
  providerId: 'p1',
  type: 'SPEND',
  threshold: 10,
  alertAtPercent: [50, 80, 100],
  active: true,
  ...extra,
});

describe('AlertasDeCostoService.revisar', () => {
  it('con 8,5 de 10 crea las alertas de 50 y 80, no la de 100', async () => {
    const { prisma, service } = armar({ limites: [limite()], amountUsd: 8.5 });
    const r = await service.revisar(AHORA);
    expect(r).toEqual({ creadas: 2 });
    expect(prisma.costAlert.create).toHaveBeenCalledTimes(2);
    expect(prisma.costAlert.create).toHaveBeenCalledWith({ data: { limitId: 'l1', percentReached: 50, currentValue: 8.5 } });
    expect(prisma.costAlert.create).toHaveBeenCalledWith({ data: { limitId: 'l1', percentReached: 80, currentValue: 8.5 } });
    expect(prisma.costSnapshot.findFirst).toHaveBeenCalledWith({ where: { providerId: 'p1', month: '2026-10' } });
  });

  it('no repite un umbral que ya se avisó este mes', async () => {
    const { prisma, service } = armar({ limites: [limite()], amountUsd: 8.5, yaAlertados: [50] });
    const r = await service.revisar(AHORA);
    expect(r).toEqual({ creadas: 1 });
    expect(prisma.costAlert.create).toHaveBeenCalledWith({ data: { limitId: 'l1', percentReached: 80, currentValue: 8.5 } });
    // el borde del "una vez por mes" es el inicio del mes UTC, igual que el snapshot
    expect(prisma.costAlert.findFirst).toHaveBeenCalledWith({
      where: { limitId: 'l1', percentReached: 50, notifiedAt: { gte: new Date('2026-10-01T00:00:00.000Z') } },
      select: { id: true },
    });
  });

  it('busca solo límites activos con proveedor', async () => {
    const { prisma, service } = armar({ limites: [], amountUsd: 9 });
    await service.revisar(AHORA);
    expect(prisma.costLimit.findMany).toHaveBeenCalledWith({ where: { active: true, providerId: { not: null } } });
  });

  it('un límite sin proveedor que llegara igual se ignora', async () => {
    const { prisma, service } = armar({ limites: [limite({ providerId: null })], amountUsd: 9 });
    expect(await service.revisar(AHORA)).toEqual({ creadas: 0 });
    expect(prisma.costAlert.create).not.toHaveBeenCalled();
  });

  it('un límite inactivo que llegara igual se ignora', async () => {
    const { prisma, service } = armar({ limites: [limite({ active: false })], amountUsd: 9 });
    expect(await service.revisar(AHORA)).toEqual({ creadas: 0 });
    expect(prisma.costAlert.create).not.toHaveBeenCalled();
  });

  it('sin snapshot del mes cuenta 0 y no alerta; umbral 0 se saltea', async () => {
    const a = armar({ limites: [limite()], amountUsd: null });
    expect(await a.service.revisar(AHORA)).toEqual({ creadas: 0 });
    const b = armar({ limites: [limite({ threshold: 0 })], amountUsd: 5 });
    expect(await b.service.revisar(AHORA)).toEqual({ creadas: 0 });
  });
});
