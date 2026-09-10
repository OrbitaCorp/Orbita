import { WizardAnalyticsService } from '../../src/wizard-analytics/wizard-analytics.service';
import { InternalCronController } from '../../src/internal-cron/internal-cron.controller';

// Auditoría interna 2026-09-10, ítem `api.wizard-analytics`.
//
// - Los eventos del wizard y los turnos de Orbi (con las preguntas de gente
//   que todavía no tiene cuenta) no se borraban nunca.
// - `rubro` se guardaba tal cual llegaba, sin pasar por la redacción.

const DIA_MS = 24 * 60 * 60 * 1000;

function servicio(env: Record<string, string> = {}) {
  const prisma = {
    wizardEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    wizardAiTurn: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const original = { ...process.env };
  Object.assign(process.env, env);
  const svc = new WizardAnalyticsService(prisma as any, {} as any);
  return { svc, prisma, restaurar: () => { process.env = original; } };
}

describe('Retención', () => {
  afterEach(() => jest.useRealTimers());

  it('borra eventos y turnos de Orbi más viejos que la retención (180 días por defecto)', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T12:00:00Z') });
    const { svc, prisma, restaurar } = servicio();
    try {
      const r = await svc.purgarAntiguos();
      const corte = new Date(Date.now() - 180 * DIA_MS);
      expect(prisma.wizardEvent.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: corte } } });
      expect(prisma.wizardAiTurn.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: corte } } });
      expect(r).toEqual({ eventos: 3, turnos: 2 });
    } finally {
      restaurar();
    }
  });

  it('la retención se puede ajustar por entorno, con un mínimo de 30 días', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T12:00:00Z') });
    const { svc, prisma, restaurar } = servicio({ WIZARD_ANALYTICS_RETENTION_DAYS: '7' });
    try {
      await svc.purgarAntiguos();
      expect(prisma.wizardEvent.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date(Date.now() - 30 * DIA_MS) } } });
    } finally {
      restaurar();
    }
  });

  it('el mantenimiento nocturno la corre', async () => {
    const analytics = { classifyPendingTurns: jest.fn(), purgarAntiguos: jest.fn() };
    const subs = { reconcileOverdueSubscriptions: jest.fn(), cleanupExpiredPendingSignups: jest.fn() };
    const corridas = { correrUnaVez: jest.fn((_n: string, _k: string, fn: () => Promise<unknown>) => fn()) };
    const ctrl = new InternalCronController(subs as any, {} as any, analytics as any, corridas as any);
    await ctrl.nightlySubscriptionsMaintenance();
    expect(analytics.purgarAntiguos).toHaveBeenCalled();
  });
});

describe('Ingesta', () => {
  it('rubro pasa por la redacción y los tipos desconocidos se descartan', async () => {
    const { svc, prisma, restaurar } = servicio();
    try {
      await svc.ingest({
        sessionId: 'sesion-123', anonId: 'anon-12345',
        events: [
          { type: 'step_view', step: 1, rubro: 'ana@x.com' },
          { type: 'inventado' },
        ],
      });
      const filas = prisma.wizardEvent.createMany.mock.calls[0][0].data;
      expect(filas).toHaveLength(1);
      expect(filas[0].rubro).toBe('[email]');
    } finally {
      restaurar();
    }
  });
});
