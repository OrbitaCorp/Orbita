import { RetencionLogsService, RETENCION_MINIMA_DIAS } from '../../src/internal-cron/retencion-logs.service';
import { InternalCronController } from '../../src/internal-cron/internal-cron.controller';

// Hallazgo `logs-sin-retencion` de la auditoría interna (detectado el 10/09
// en trans.logging, cerrado el 14/09).
//
// platform_admin_logs, audit_logs y email_logs crecían para siempre. Ahora el
// mantenimiento nocturno borra por antigüedad: 365 / 365 / 180 días por
// defecto, cada tabla con su variable de entorno, nunca menos de 30, y "0" u
// "off" apaga la purga de esa tabla sola.

const DIA_MS = 24 * 60 * 60 * 1000;
const AHORA = new Date('2026-09-14T12:00:00Z');
const VARIABLES = ['PLATFORM_ADMIN_LOGS_RETENTION_DAYS', 'AUDIT_LOGS_RETENTION_DAYS', 'EMAIL_LOGS_RETENTION_DAYS'];

function servicio(env: Record<string, string> = {}, opts: { fallaAudit?: boolean } = {}) {
  const prisma = {
    platformAdminLog: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
    auditLog: {
      deleteMany: opts.fallaAudit ? jest.fn().mockRejectedValue(new Error('db caída')) : jest.fn().mockResolvedValue({ count: 7 }),
    },
    emailLog: { deleteMany: jest.fn().mockResolvedValue({ count: 12 }) },
  };
  const original = { ...process.env };
  // Que lo que tenga el .env de quien corre los tests no cambie el resultado.
  for (const v of VARIABLES) delete process.env[v];
  Object.assign(process.env, env);
  const svc = new RetencionLogsService(prisma as any);
  return { svc, prisma, restaurar: () => { process.env = original; } };
}

const corteHace = (dias: number) => ({ where: { createdAt: { lt: new Date(AHORA.getTime() - dias * DIA_MS) } } });

describe('Retención de logs y registros', () => {
  beforeEach(() => jest.useFakeTimers({ now: AHORA }));
  afterEach(() => jest.useRealTimers());

  it('por defecto borra platform_admin_logs y audit_logs de más de 365 días, y email_logs de más de 180', async () => {
    const { svc, prisma, restaurar } = servicio();
    try {
      const r = await svc.purgar();
      expect(prisma.platformAdminLog.deleteMany).toHaveBeenCalledWith(corteHace(365));
      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith(corteHace(365));
      expect(prisma.emailLog.deleteMany).toHaveBeenCalledWith(corteHace(180));
      expect(r).toEqual({ platform_admin_logs: 4, audit_logs: 7, email_logs: 12 });
    } finally {
      restaurar();
    }
  });

  it('cada tabla se ajusta por su propia variable, sin tocar a las otras', async () => {
    const { svc, prisma, restaurar } = servicio({ PLATFORM_ADMIN_LOGS_RETENTION_DAYS: '730', EMAIL_LOGS_RETENTION_DAYS: '90' });
    try {
      await svc.purgar();
      expect(prisma.platformAdminLog.deleteMany).toHaveBeenCalledWith(corteHace(730));
      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith(corteHace(365));
      expect(prisma.emailLog.deleteMany).toHaveBeenCalledWith(corteHace(90));
    } finally {
      restaurar();
    }
  });

  it('nunca menos de 30 días, y un valor inválido cae al default', async () => {
    const { svc, prisma, restaurar } = servicio({ AUDIT_LOGS_RETENTION_DAYS: '7', EMAIL_LOGS_RETENTION_DAYS: 'muchos' });
    try {
      await svc.purgar();
      expect(RETENCION_MINIMA_DIAS).toBe(30);
      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith(corteHace(30));
      expect(prisma.emailLog.deleteMany).toHaveBeenCalledWith(corteHace(180));
    } finally {
      restaurar();
    }
  });

  it('"0" u "off" apagan la purga de esa tabla; las demás siguen', async () => {
    const { svc, prisma, restaurar } = servicio({ AUDIT_LOGS_RETENTION_DAYS: '0', EMAIL_LOGS_RETENTION_DAYS: 'off' });
    try {
      const r = await svc.purgar();
      expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
      expect(prisma.emailLog.deleteMany).not.toHaveBeenCalled();
      expect(prisma.platformAdminLog.deleteMany).toHaveBeenCalledWith(corteHace(365));
      expect(r).toEqual({ platform_admin_logs: 4, audit_logs: 'apagada', email_logs: 'apagada' });
    } finally {
      restaurar();
    }
  });

  it('si una tabla falla, las otras se purgan igual y purgar() no tira', async () => {
    const { svc, prisma, restaurar } = servicio({}, { fallaAudit: true });
    try {
      const r = await svc.purgar();
      expect(prisma.platformAdminLog.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.emailLog.deleteMany).toHaveBeenCalledTimes(1);
      expect(r).toEqual({ platform_admin_logs: 4, audit_logs: 'fallo', email_logs: 12 });
    } finally {
      restaurar();
    }
  });

  it('diasDeRetencion(): vacía = default, "off"/"0"/negativo = apagada, número = número con piso de 30', () => {
    const { restaurar } = servicio({
      R_VACIA: '', R_OFF: ' OFF ', R_CERO: '0', R_NEG: '-5', R_BASURA: 'un año', R_INF: 'Infinity',
      R_CHICA: '29', R_JUSTA: '30', R_DECIMAL: '45.9', R_GRANDE: '1000',
    });
    try {
      const d = (v: string) => RetencionLogsService.diasDeRetencion(v, 365);
      expect(d('R_NO_EXISTE')).toBe(365);
      expect(d('R_VACIA')).toBe(365);
      expect(d('R_OFF')).toBeNull();
      expect(d('R_CERO')).toBeNull();
      expect(d('R_NEG')).toBeNull();
      expect(d('R_BASURA')).toBe(365);
      expect(d('R_INF')).toBe(365);
      expect(d('R_CHICA')).toBe(30);
      expect(d('R_JUSTA')).toBe(30);
      expect(d('R_DECIMAL')).toBe(45);
      expect(d('R_GRANDE')).toBe(1000);
    } finally {
      restaurar();
    }
  });
});

describe('El mantenimiento nocturno la corre', () => {
  function controller(retencion: { purgar: jest.Mock }) {
    const subs = {
      reconcileOverdueSubscriptions: jest.fn(),
      processLifecycleNotices: jest.fn(),
      processCancellationWindow: jest.fn(),
      cleanupExpiredPendingSignups: jest.fn(),
    };
    const analytics = { classifyPendingTurns: jest.fn(), purgarAntiguos: jest.fn() };
    const corridas = { correrUnaVez: jest.fn((_n: string, _k: string, fn: () => Promise<unknown>) => fn()) };
    const ctrl = new InternalCronController(subs as any, {} as any, analytics as any, corridas as any, retencion as any);
    return { ctrl, analytics };
  }

  it('después de la purga del wizard, en el mismo disparo', async () => {
    const orden: string[] = [];
    const retencion = { purgar: jest.fn(async () => { orden.push('logs'); }) };
    const { ctrl, analytics } = controller(retencion);
    analytics.purgarAntiguos.mockImplementation(async () => { orden.push('wizard'); });
    await ctrl.nightlySubscriptionsMaintenance();
    expect(retencion.purgar).toHaveBeenCalledTimes(1);
    expect(orden).toEqual(['wizard', 'logs']);
  });

  it('si la purga revienta entera, la corrida nocturna igual termina bien', async () => {
    const retencion = { purgar: jest.fn().mockRejectedValue(new Error('sin conexión')) };
    const { ctrl } = controller(retencion);
    await expect(ctrl.nightlySubscriptionsMaintenance()).resolves.toBeUndefined();
  });
});
