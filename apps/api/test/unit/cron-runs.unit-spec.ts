import { Prisma } from '@prisma/client';
import { CronRunsService } from '../../src/internal-cron/cron-runs.service';
import { InternalCronSecretGuard } from '../../src/internal-cron/internal-cron-secret.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

// Jobs de Cloud Scheduler (auditoría interna 2026-09-09/10, ítem
// `api.internal-cron`).
//
// Cloud Scheduler REINTENTA cuando una corrida devuelve error o tarda de más.
// Sin una marca persistente, el reintento repetía el trabajo entero: el
// resumen diario le manda un mail a cada negocio, así que un reintento
// significaba el mail duplicado para todos. Dos disparos simultáneos, igual.

const P2002 = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });

function servicio(previa: Record<string, unknown> | null) {
  const filas: Record<string, unknown>[] = [];
  const prisma = {
    cronRun: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        if (previa) return Promise.reject(P2002);
        filas.push({ ...data, startedAt: new Date(), finishedAt: null, ok: null });
        return Promise.resolve(filas[0]);
      }),
      findUnique: jest.fn().mockResolvedValue(previa),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        filas.push(data);
        return Promise.resolve(data);
      }),
    },
  } as never;
  return { svc: new CronRunsService(prisma), prisma: prisma as unknown as { cronRun: { update: jest.Mock } }, filas };
}

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000);

describe('Jobs de cron — una corrida por ventana', () => {
  it('sin corrida previa, corre y queda marcada como ok', async () => {
    const { svc, prisma } = servicio(null);
    const trabajo = jest.fn().mockResolvedValue(undefined);

    await expect(svc.correrUnaVez('resumen-diario', '2026-09-10', trabajo))
      .resolves.toEqual({ ok: true, corrio: true, runKey: '2026-09-10' });
    expect(trabajo).toHaveBeenCalledTimes(1);
    expect(prisma.cronRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ok: true }) }));
  });

  it('si la ventana ya corrió bien, NO vuelve a correr', async () => {
    const { svc } = servicio({ id: 'r1', ok: true, startedAt: hace(60), finishedAt: hace(59) });
    const trabajo = jest.fn();

    await expect(svc.correrUnaVez('resumen-diario', '2026-09-10', trabajo))
      .resolves.toEqual({ ok: true, corrio: false, motivo: 'ya_corrio', runKey: '2026-09-10' });
    expect(trabajo).not.toHaveBeenCalled();
  });

  it('si hay otra corrida en curso, el segundo disparo no hace nada', async () => {
    const { svc } = servicio({ id: 'r1', ok: null, startedAt: hace(2), finishedAt: null });
    const trabajo = jest.fn();

    await expect(svc.correrUnaVez('resumen-diario', '2026-09-10', trabajo))
      .resolves.toEqual({ ok: true, corrio: false, motivo: 'en_curso', runKey: '2026-09-10' });
    expect(trabajo).not.toHaveBeenCalled();
  });

  it('una corrida que falló se reintenta', async () => {
    const { svc } = servicio({ id: 'r1', ok: false, startedAt: hace(10), finishedAt: hace(9) });
    const trabajo = jest.fn().mockResolvedValue(undefined);

    await expect(svc.correrUnaVez('resumen-diario', '2026-09-10', trabajo))
      .resolves.toMatchObject({ corrio: true });
    expect(trabajo).toHaveBeenCalledTimes(1);
  });

  it('una corrida colgada hace más de 30 minutos se retoma', async () => {
    const { svc } = servicio({ id: 'r1', ok: null, startedAt: hace(45), finishedAt: null });
    const trabajo = jest.fn().mockResolvedValue(undefined);

    await expect(svc.correrUnaVez('resumen-diario', '2026-09-10', trabajo))
      .resolves.toMatchObject({ corrio: true });
    expect(trabajo).toHaveBeenCalledTimes(1);
  });

  it('si el trabajo falla, queda registrado y el error se propaga (para que Scheduler reintente)', async () => {
    const { svc, prisma } = servicio(null);
    const trabajo = jest.fn().mockRejectedValue(new Error('se cayó el SMTP'));

    await expect(svc.correrUnaVez('resumen-diario', '2026-09-10', trabajo)).rejects.toThrow('se cayó el SMTP');
    expect(prisma.cronRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ok: false, detalle: expect.stringContaining('SMTP') }) }),
    );
  });

  it('las claves de ventana son el día y la semana ISO', () => {
    const d = new Date('2026-09-10T14:00:00Z');
    expect(CronRunsService.claveDelDia(d)).toBe('2026-09-10');
    expect(CronRunsService.claveDeLaSemana(d)).toBe('2026-W37');
    // Cambio de año: el 1 de enero de 2027 cae jueves → semana 53 de 2026.
    expect(CronRunsService.claveDeLaSemana(new Date('2026-12-31T12:00:00Z'))).toBe('2026-W53');
  });
});

describe('Secreto de los endpoints de cron', () => {
  const contexto = (header?: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ header: () => header }) }) }) as unknown as ExecutionContext;
  const guard = (secreto?: string) =>
    new InternalCronSecretGuard({ get: () => secreto } as never);

  it('sin CRON_SECRET configurado no pasa nadie', () => {
    expect(() => guard(undefined).canActivate(contexto('lo-que-sea'))).toThrow(UnauthorizedException);
  });

  it('con el secreto correcto pasa; con uno incorrecto o ausente, no', () => {
    expect(guard('s3cr3t').canActivate(contexto('s3cr3t'))).toBe(true);
    expect(() => guard('s3cr3t').canActivate(contexto('otro'))).toThrow(UnauthorizedException);
    expect(() => guard('s3cr3t').canActivate(contexto(undefined))).toThrow(UnauthorizedException);
    // Largo distinto: timingSafeEqual tira si los buffers no miden igual, por
    // eso se comparan los SHA-256 y no los strings crudos.
    expect(() => guard('s3cr3t').canActivate(contexto('s'))).toThrow(UnauthorizedException);
    expect(() => guard('s3cr3t').canActivate(contexto('s3cr3t-de-mas'))).toThrow(UnauthorizedException);
  });
});
