import { BadRequestException } from '@nestjs/common';
import { ReportsService } from '../../src/reports/reports.service';
import { ReportsController } from '../../src/reports/reports.controller';
import { fechaArgentina, inicioDeDiaArgentina, inicioDeMesArgentina } from '../../src/common/utils/hora-argentina';

// Auditoría interna 2026-09-10, ítem `api.reports`.
//
// "Hoy", "este mes" y las fechas del rango se armaban con la hora del
// servidor (UTC en Cloud Run): el "hoy" del dashboard iba de las 21 h de ayer
// a las 21 h de hoy en Argentina, y los meses empezaban tres horas antes. Las
// ventas de 21 a 24 h se contaban en el día (o el mes) siguiente.

const BIZ = 'biz-1';

describe('Días y meses de Argentina', () => {
  it('a las 23 h de Argentina del 09/09 (02 h UTC del 10/09) el día es el 09/09', () => {
    expect(fechaArgentina(new Date('2026-09-10T02:00:00Z'))).toBe('2026-09-09');
  });

  it('el día arranca a las 00:00 de Argentina', () => {
    expect(inicioDeDiaArgentina('2026-09-09').toISOString()).toBe('2026-09-09T03:00:00.000Z');
  });

  it('el mes de Argentina, y el anterior, aunque en UTC ya sea el mes siguiente', () => {
    const ahora = new Date('2026-10-01T01:00:00Z'); // 30/09 22 h en Argentina
    expect(inicioDeMesArgentina(ahora).toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(inicioDeMesArgentina(ahora, -1).toISOString()).toBe('2026-08-01T03:00:00.000Z');
    expect(inicioDeMesArgentina(new Date('2026-01-15T12:00:00Z'), -1).toISOString()).toBe('2025-12-01T03:00:00.000Z');
  });
});

describe('Rango de los reportes', () => {
  function pagos() {
    const prisma = { payment: { groupBy: jest.fn().mockResolvedValue([]) } };
    return { svc: new ReportsService(prisma as any), prisma };
  }
  const rango = (prisma: { payment: { groupBy: jest.Mock } }) => prisma.payment.groupBy.mock.calls[0][0].where.paidAt;

  afterEach(() => jest.useRealTimers());

  it('sin rango, "hoy" es el día de Argentina aunque en UTC ya sea mañana', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T01:30:00Z') }); // 09/09 22:30 en Argentina
    const { svc, prisma } = pagos();
    await svc.payments(BIZ);
    expect(rango(prisma)).toEqual({ gte: new Date('2026-09-09T03:00:00.000Z'), lt: new Date('2026-09-10T03:00:00.000Z') });
  });

  it('un rango en días va de las 00:00 del primero a las 24:00 del último, en Argentina', async () => {
    const { svc, prisma } = pagos();
    await svc.payments(BIZ, '2026-09-01', '2026-09-30');
    expect(rango(prisma)).toEqual({ gte: new Date('2026-09-01T03:00:00.000Z'), lt: new Date('2026-10-01T03:00:00.000Z') });
  });

  it('un rango inválido o de más de 400 días da 400', async () => {
    const { svc } = pagos();
    await expect(svc.payments(BIZ, 'ayer', '2026-09-30')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.payments(BIZ, '2020-01-01', '2026-09-30')).rejects.toThrow(/400 días/);
  });

  it('el resumen del mes arranca el 1° a las 00:00 de Argentina', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T01:00:00Z') }); // todavía 30/09 en Argentina
    const prisma = {
      order: { groupBy: jest.fn().mockResolvedValue([]) },
      return: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    };
    await new ReportsService(prisma as any).sales(BIZ);
    const desdes = prisma.order.groupBy.mock.calls.map((c) => c[0].where.createdAt.gte.toISOString()).sort();
    expect(desdes).toEqual(['2026-08-01T03:00:00.000Z', '2026-09-01T03:00:00.000Z']);
  });
});

describe('Rutas', () => {
  it('ya no existe el stub GET /reports/inventory (sin permiso y sin implementar)', () => {
    expect((ReportsController.prototype as unknown as Record<string, unknown>).inventory).toBeUndefined();
  });
});
