import { CuotaService } from '../../src/common/cuota/cuota.service';

// Cuota diaria compartida en Postgres (reemplaza al contador que era en
// memoria y por instancia de Cloud Run). Ver spec de Orbi fase 1, §3.5.

describe('CuotaService', () => {
  afterEach(() => jest.useRealTimers());

  function servicio(filas: unknown[]) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(filas) };
    return { svc: new CuotaService(prisma as never), prisma };
  }

  // Con un template tagged, Prisma recibe (strings[], ...valores).
  const sqlDe = (llamada: unknown[]) => (llamada[0] as string[]).join('?').replace(/\s+/g, ' ');

  it('con fila devuelta, el uso entra', async () => {
    const { svc } = servicio([{ count: 1 }]);
    await expect(svc.consumir('orbi-panel:biz-1', 5)).resolves.toBe(true);
  });

  it('sin fila (tope alcanzado), no entra', async () => {
    const { svc } = servicio([]);
    await expect(svc.consumir('orbi-panel:biz-1', 5)).resolves.toBe(false);
  });

  it('arma un solo upsert con tope: no infla el contador pasado el límite', async () => {
    const { svc, prisma } = servicio([{ count: 1 }]);
    await svc.consumir('orbi-panel:biz-1', 5);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = sqlDe(prisma.$queryRaw.mock.calls[0]);
    expect(sql).toContain('INSERT INTO daily_quota (key, day, count) VALUES (?, ?, 1)');
    expect(sql).toContain('ON CONFLICT (key, day) DO UPDATE SET count = daily_quota.count + 1');
    expect(sql).toContain('WHERE daily_quota.count < ?');
    expect(sql).toContain('RETURNING count');
  });

  it('pasa la clave, el día de Argentina y el límite como parámetros', async () => {
    // 02:00 UTC del 11/09 todavía es 10/09 en Argentina (UTC-3).
    jest.useFakeTimers({ now: new Date('2026-09-11T02:00:00Z') });
    const { svc, prisma } = servicio([{ count: 1 }]);
    await svc.consumir('image-studio:biz-2', 30);
    expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual(['image-studio:biz-2', '2026-09-10', 30]);
  });

  it('el día cambia a la medianoche de Argentina', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-11T03:00:01Z') });
    const { svc, prisma } = servicio([{ count: 1 }]);
    await svc.consumir('ai-assist:biz-1', 100);
    expect(prisma.$queryRaw.mock.calls[0][2]).toBe('2026-09-11');
  });
});
