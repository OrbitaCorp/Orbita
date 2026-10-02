import { ServiceUnavailableException } from '@nestjs/common';
import { clasificarError, sanitizarDetalle, codigoParaElFront } from '../../src/orbi/salud/clasificar-error';
import { OrbiSaludService, UMBRAL_FALLAS, UMBRAL_FALLAS_UN_ACTOR, VENTANA_MIN } from '../../src/orbi/salud/orbi-salud.service';

// ─── Clasificador ────────────────────────────────────────────────────────────

/** El error REAL del 2026-10-01 (saldo agotado): el SDK mete el cuerpo como JSON dentro de JSON. */
const CUERPO_402 =
  '{"error":{"message":"{\\n  \\"error\\": {\\n    \\"code\\": 402,\\n    \\"message\\": \\"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.\\",\\n    \\"status\\": \\"FAILED_PRECONDITION\\"\\n  }\\n}\\n","code":402,"status":"Payment Required"}}';

describe('clasificarError', () => {
  it('saldo agotado (402, el cuerpo anidado del SDK): inmediata, y no filtra la clave', () => {
    const f = clasificarError(new Error(CUERPO_402));
    expect(f).toMatchObject({ categoria: 'PROVIDER_CREDITS', httpStatus: 402, inmediata: true });
    expect(f.detalle).toMatch(/prepayment credits are depleted/i);
    expect(f.detalle).not.toContain('\\n');
  });

  it('key inválida o sin permiso (401 / 403 / texto de Google) y key sin configurar: inmediatas', () => {
    expect(clasificarError(Object.assign(new Error('x'), { status: 401 }))).toMatchObject({ categoria: 'PROVIDER_AUTH', inmediata: true });
    expect(clasificarError(Object.assign(new Error('x'), { status: 403 }))).toMatchObject({ categoria: 'PROVIDER_AUTH', inmediata: true });
    expect(clasificarError(new Error('API key not valid. Please pass a valid API key.'))).toMatchObject({ categoria: 'PROVIDER_AUTH', inmediata: true });
    expect(clasificarError(new ServiceUnavailableException('GEMINI_API_KEY no configurada'))).toMatchObject({ categoria: 'PROVIDER_AUTH', inmediata: true });
  });

  it('modelo inexistente (404 con texto de modelo): inmediata; el 404 VACÍO de un pico de demanda de Google, no', () => {
    const noExiste = Object.assign(new Error('{"error":{"code":404,"message":"models/gemini-9 is not found for API version v1beta"}}'), { status: 404 });
    expect(clasificarError(noExiste)).toMatchObject({ categoria: 'MODEL_NOT_FOUND', inmediata: true });
    const vacio = Object.assign(new Error('{"error":{"code":404,"message":""}}'), { status: 404 });
    expect(clasificarError(vacio)).toMatchObject({ categoria: 'PROVIDER_DOWN', inmediata: false });
  });

  it('cuota (429), caídas (5xx, red, timeouts), request mal armado (400) y errores propios: no inmediatas', () => {
    expect(clasificarError(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }))).toMatchObject({ categoria: 'PROVIDER_QUOTA', inmediata: false });
    expect(clasificarError(Object.assign(new Error('overloaded'), { status: 503 }))).toMatchObject({ categoria: 'PROVIDER_DOWN', inmediata: false });
    expect(clasificarError(Object.assign(new Error('boom'), { code: 'ECONNRESET' }))).toMatchObject({ categoria: 'PROVIDER_DOWN', inmediata: false });
    expect(clasificarError(new TypeError('fetch failed'))).toMatchObject({ categoria: 'PROVIDER_DOWN', inmediata: false });
    expect(clasificarError(Object.assign(new Error('bad'), { status: 400 }))).toMatchObject({ categoria: 'REQUEST_INVALID', inmediata: false });
    expect(clasificarError(new Error('Prisma: connection pool timeout is not ours'))).toMatchObject({ inmediata: false });
    expect(clasificarError(new Error('algo propio'))).toMatchObject({ categoria: 'INTERNAL', inmediata: false });
  });

  it('sanitizarDetalle saca las claves, compacta y recorta', () => {
    expect(sanitizarDetalle('key AIzaSyA1234567890abcdefghijklmnop usada')).toBe('key [clave] usada');
    expect(sanitizarDetalle('token AQ.Ab8RN6IexampleExampleExample123 listo')).toBe('token [clave] listo');
    expect(sanitizarDetalle('a\n\n  b')).toBe('a b');
    expect(sanitizarDetalle('x'.repeat(1000))).toHaveLength(240);
  });

  it('lo que ve la persona: nunca el error crudo; el front distingue "el proveedor" de "algo nuestro"', () => {
    expect(codigoParaElFront('PROVIDER_DOWN')).toBe('ORBI_PROVIDER_DOWN');
    expect(codigoParaElFront('PROVIDER_CREDITS')).toBe('ORBI_PROVIDER_DOWN');
    expect(codigoParaElFront('INTERNAL')).toBe('ORBI_ERROR');
  });
});

// ─── Servicio ────────────────────────────────────────────────────────────────

const VACIO = { id: 'global', status: 'ACTIVE', reason: null, detail: null, trippedAt: null, trippedBy: null, lastOkAt: null, lastNotifiedAt: null };
const SOLO_FECHA = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] as const;

/** Una base en memoria con la semántica que el servicio necesita (el updateMany condicionado es atómico). */
function baseEnMemoria(opts: { admins?: string[]; falla?: boolean } = {}) {
  let fila: Record<string, any> | null = null;
  const fallas: { actor: string; category: string; detail: string; createdAt: Date }[] = [];
  const admins = (opts.admins ?? ['a@orbita.site', 'b@orbita.site']).map((email) => ({ email }));
  const roto = () => {
    if (opts.falla) throw Object.assign(new Error('db caída'), { name: 'PrismaClientInitializationError' });
  };
  const prisma = {
    orbiServiceState: {
      findUnique: async () => { roto(); return fila && { ...fila }; },
      upsert: async ({ update, create }: any) => { roto(); fila = fila ? { ...fila, ...update } : { ...VACIO, ...create }; return fila; },
      createMany: async ({ data }: any) => { roto(); if (!fila) fila = { ...VACIO, ...data[0] }; return { count: 1 }; },
      updateMany: async ({ where, data }: any) => {
        roto();
        if (!fila) return { count: 0 };
        if (where.status && fila.status !== where.status) return { count: 0 };
        if (where.OR && !where.OR.some((c: any) => ('lastNotifiedAt' in c && c.lastNotifiedAt === null ? fila!.lastNotifiedAt === null : fila!.lastNotifiedAt && fila!.lastNotifiedAt < c.lastNotifiedAt.lt))) return { count: 0 };
        Object.assign(fila, data);
        return { count: 1 };
      },
    },
    orbiProviderFailure: {
      create: async ({ data }: any) => { roto(); fallas.push({ actor: data.actor, category: data.category, detail: data.detail, createdAt: new Date() }); },
      groupBy: async ({ where }: any) => {
        const por = new Map<string, number>();
        for (const f of fallas.filter((x) => x.createdAt > where.createdAt.gt)) por.set(f.actor, (por.get(f.actor) ?? 0) + 1);
        return [...por].map(([actor, n]) => ({ actor, _count: { _all: n } }));
      },
      count: async () => fallas.length,
      findMany: async () => fallas.slice(-10).reverse(),
    },
    platformAdmin: { findMany: async () => admins },
  };
  return { prisma, fila: () => fila, fallas };
}

function armar(opts: { admins?: string[]; dbRota?: boolean; mailOk?: boolean; llm?: (...a: any[]) => AsyncGenerator<any> } = {}) {
  const base = baseEnMemoria({ admins: opts.admins, falla: opts.dbRota });
  const mail = { sendOrbiMantenimiento: jest.fn().mockResolvedValue(opts.mailOk ?? true) };
  const llm = { streamChat: opts.llm ?? (async function* () { yield { type: 'text', chunk: 'ok' }; yield { type: 'done' }; }) };
  const svc = new OrbiSaludService(base.prisma as any, mail as any, { get: () => undefined } as any, llm as any);
  return { svc, mail, llm, ...base };
}

const falla5xx = () => Object.assign(new Error('overloaded'), { status: 503 });
const fallaSaldo = () => new Error(CUERPO_402);
const flush = () => new Promise((r) => setImmediate(r));

describe('OrbiSaludService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: [...SOLO_FECHA], now: new Date('2026-10-01T15:00:00Z') });
  });
  afterEach(() => jest.useRealTimers());
  const avanzar = (seg: number) => jest.setSystemTime(Date.now() + seg * 1000);

  it('saldo agotado: Orbi pasa a mantenimiento a la PRIMERA y se avisa a todos los admins activos', async () => {
    const { svc, mail, fila } = armar();
    const f = await svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' });
    await flush();
    expect(f.categoria).toBe('PROVIDER_CREDITS');
    expect(fila()).toMatchObject({ status: 'MAINTENANCE', reason: 'PROVIDER_CREDITS', trippedBy: 'auto' });
    expect(mail.sendOrbiMantenimiento).toHaveBeenCalledTimes(2);
    expect(mail.sendOrbiMantenimiento.mock.calls.map((c) => c[0]).sort()).toEqual(['a@orbita.site', 'b@orbita.site']);
    expect(mail.sendOrbiMantenimiento.mock.calls[0][1]).toMatchObject({ recordatorio: false, motivo: expect.stringContaining('saldo') });
  });

  it('varias instancias fallando a la vez: UNA sola gana la transición y manda los mails (no se duplican)', async () => {
    const { svc, mail } = armar();
    await Promise.all([1, 2, 3].map((n) => svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: `neg-${n}` })));
    await flush();
    expect(mail.sendOrbiMantenimiento).toHaveBeenCalledTimes(2); // 2 admins, una sola vez
  });

  it('un 503 suelto no apaga nada; sí lo hace una racha sostenida de varios actores', async () => {
    const { svc, fila } = armar();
    for (let i = 0; i < UMBRAL_FALLAS - 1; i++) {
      await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: `neg-${i % 3}` });
      avanzar(10);
    }
    expect(fila()?.status ?? 'ACTIVE').toBe('ACTIVE');
    await svc.registrarFalla({ error: falla5xx(), surface: 'wizard', actor: 'wizard:ip1' });
    expect(fila()).toMatchObject({ status: 'MAINTENANCE', reason: 'PROVIDER_DOWN' });
    expect(fila()?.detail).toMatch(new RegExp(`${UMBRAL_FALLAS} fallas de \\d actores en ${VENTANA_MIN} min`));
  });

  it('una respuesta buena en el medio corta la racha (1 % de errores con tráfico nunca lo apaga)', async () => {
    const { svc, fila } = armar();
    for (let i = 0; i < UMBRAL_FALLAS - 1; i++) {
      await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: `neg-${i % 3}` });
      avanzar(10);
    }
    await svc.registrarOk();
    avanzar(10);
    for (let i = 0; i < UMBRAL_FALLAS - 1; i++) {
      await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: `neg-${i % 3}` });
      avanzar(10);
    }
    expect(fila()?.status).toBe('ACTIVE');
  });

  it('las fallas de hace más de la ventana no cuentan', async () => {
    const { svc, fila } = armar();
    for (let i = 0; i < UMBRAL_FALLAS - 1; i++) await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: `neg-${i % 3}` });
    avanzar(VENTANA_MIN * 60 + 5);
    await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: 'neg-9' });
    expect(fila()?.status ?? 'ACTIVE').toBe('ACTIVE');
  });

  it('una sola persona insistiendo no apaga Orbi para todos (hace falta mucho más)', async () => {
    const { svc, fila } = armar();
    for (let i = 0; i < UMBRAL_FALLAS_UN_ACTOR - 1; i++) await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: 'neg-1' });
    expect(fila()?.status ?? 'ACTIVE').toBe('ACTIVE');
    await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: 'neg-1' });
    expect(fila()?.status).toBe('MAINTENANCE');
  });

  it('que el cliente se vaya a mitad de la respuesta no es una falla', async () => {
    const { svc, fallas } = armar();
    const aborto = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await svc.registrarFalla({ error: aborto, surface: 'panel', actor: 'neg-1' });
    expect(fallas).toHaveLength(0);
  });

  it('en mantenimiento, el chat recibe un 503 con code ORBI_MAINTENANCE; activo, pasa', async () => {
    const { svc } = armar();
    await expect(svc.exigirDisponible('panel')).resolves.toBeUndefined();
    await svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' });
    avanzar(30); // vence el cache de 15 s
    const err = await svc.exigirDisponible('panel').catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getResponse()).toMatchObject({ error: 'ORBI_MAINTENANCE', message: expect.stringContaining('Manual del panel') });
    // En el alta de negocios no hay manual del panel: se puede seguir sin Orbi.
    const enWizard = await svc.exigirDisponible('wizard').catch((e) => e);
    expect(enWizard.getResponse()).toMatchObject({ error: 'ORBI_MAINTENANCE', message: expect.stringContaining('sin su ayuda') });
  });

  it('si la base falla, Orbi sigue funcionando (fail-open): medir la salud no puede romper lo que mide', async () => {
    const { svc } = armar({ dbRota: true });
    await expect(svc.exigirDisponible('panel')).resolves.toBeUndefined();
    await expect(svc.registrarOk()).resolves.toBeUndefined();
    const f = await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: 'neg-1' });
    expect(f.categoria).toBe('PROVIDER_DOWN');
  });

  it('rehabilitar: si la llamada de prueba falla, SIGUE en mantenimiento y se dice por qué', async () => {
    const { svc, fila } = armar({ llm: async function* () { throw fallaSaldo(); } });
    await svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' });
    const r = await svc.rehabilitar('admin-1');
    expect(r).toMatchObject({ ok: false, categoria: 'PROVIDER_CREDITS' });
    expect(fila()?.status).toBe('MAINTENANCE');
  });

  it('rehabilitar: si el proveedor contesta, vuelve a activo y las fallas viejas ya no cuentan', async () => {
    const { svc, fila } = armar();
    await svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' });
    avanzar(5);
    expect(await svc.rehabilitar('admin-1')).toEqual({ ok: true });
    expect(fila()).toMatchObject({ status: 'ACTIVE', reason: null, trippedBy: 'admin-1' });
    avanzar(5);
    // Un 503 después de rehabilitar no hereda las fallas anteriores.
    await svc.registrarFalla({ error: falla5xx(), surface: 'panel', actor: 'neg-2' });
    expect(fila()?.status).toBe('ACTIVE');
  });

  it('la llamada de prueba que no contesta a tiempo cuenta como caída', async () => {
    const { svc } = armar({ llm: async function* () { /* sin eventos */ } });
    expect(await svc.sondear()).toMatchObject({ ok: false, categoria: 'PROVIDER_DOWN' });
  });

  it('mantenimiento manual: lo pone un admin, con su motivo, y no pisa a uno ya activo', async () => {
    const { svc, fila, mail } = armar();
    expect(await svc.activarManual('admin-1', 'Cambio de modelo')).toBe(true);
    await flush();
    expect(fila()).toMatchObject({ status: 'MAINTENANCE', reason: 'MANUAL', trippedBy: 'admin-1', detail: 'Cambio de modelo' });
    expect(mail.sendOrbiMantenimiento).toHaveBeenCalledTimes(2);
    expect(await svc.activarManual('admin-2')).toBe(false);
  });

  it('recordatorio: mientras siga apagado, un mail cada 24 h, disparado por el primer pedido que llegue', async () => {
    const { svc, mail } = armar();
    await svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' });
    await flush();
    mail.sendOrbiMantenimiento.mockClear();

    avanzar(23 * 3600);
    await svc.exigirDisponible('panel').catch(() => undefined);
    await flush();
    expect(mail.sendOrbiMantenimiento).not.toHaveBeenCalled(); // todavía no pasó un día

    avanzar(2 * 3600);
    await svc.exigirDisponible('panel').catch(() => undefined);
    await flush();
    expect(mail.sendOrbiMantenimiento).toHaveBeenCalledTimes(2);
    expect(mail.sendOrbiMantenimiento.mock.calls[0][1]).toMatchObject({ recordatorio: true });

    // Y no se repite en la misma tanda de pedidos.
    mail.sendOrbiMantenimiento.mockClear();
    avanzar(120);
    await svc.exigirDisponible('panel').catch(() => undefined);
    await flush();
    expect(mail.sendOrbiMantenimiento).not.toHaveBeenCalled();
  });

  it('si ningún mail sale, el aviso se reintenta en 15 minutos y no recién mañana', async () => {
    const { svc, mail, fila } = armar({ mailOk: false });
    await svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' });
    await flush();
    mail.sendOrbiMantenimiento.mockClear();
    mail.sendOrbiMantenimiento.mockResolvedValue(true);

    avanzar(10 * 60);
    await svc.exigirDisponible('panel').catch(() => undefined);
    await flush();
    expect(mail.sendOrbiMantenimiento).not.toHaveBeenCalled();

    avanzar(6 * 60);
    await svc.exigirDisponible('panel').catch(() => undefined);
    await flush();
    expect(mail.sendOrbiMantenimiento).toHaveBeenCalledTimes(2);
    expect(fila()?.status).toBe('MAINTENANCE');
  });

  it('el estado se cachea 15 s: un pedido tras otro no pega a la base', async () => {
    const { svc, prisma } = armar();
    const spy = jest.spyOn(prisma.orbiServiceState, 'findUnique');
    await svc.exigirDisponible('panel');
    await svc.exigirDisponible('panel');
    await svc.exigirDisponible('panel');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('registrarOk escribe a lo sumo cada 30 s', async () => {
    const { svc, prisma } = armar();
    const spy = jest.spyOn(prisma.orbiServiceState, 'upsert');
    await svc.registrarOk();
    await svc.registrarOk();
    avanzar(31);
    await svc.registrarOk();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('disponibilidad: activo → disponible; en mantenimiento → el mensaje de su superficie y nada de la causa', async () => {
    const { svc } = armar();
    expect(await svc.disponibilidad('panel')).toEqual({ disponible: true });
    await svc.registrarFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' });
    const panel = await svc.disponibilidad('panel');
    const wizard = await svc.disponibilidad('wizard');
    expect(panel).toEqual({ disponible: false, mensaje: expect.stringContaining('Manual del panel') });
    expect(wizard).toEqual({ disponible: false, mensaje: expect.stringContaining('completando los pasos') });
    expect(JSON.stringify([panel, wizard])).not.toMatch(/saldo|credits|402|Gemini/i);
  });

  it('disponibilidad con la base caída: disponible (fail-open)', async () => {
    const { svc } = armar({ dbRota: true });
    expect(await svc.disponibilidad('panel')).toEqual({ disponible: true });
  });

  it('avisoDeFalla: la falla que apaga Orbi le avisa a la persona que está en mantenimiento, no "probá en unos minutos"', async () => {
    const { svc } = armar();
    expect(await svc.avisoDeFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' })).toEqual({
      code: 'ORBI_MAINTENANCE',
      message: expect.stringContaining('mantenimiento'),
    });
  });

  it('avisoDeFalla: una falla suelta que no apaga Orbi es una falla pasajera', async () => {
    const { svc, fila } = armar();
    const aviso = await svc.avisoDeFalla({ error: falla5xx(), surface: 'wizard', actor: 'w-1' });
    expect(fila()?.status ?? 'ACTIVE').toBe('ACTIVE');
    expect(aviso).toEqual({ code: 'ORBI_PROVIDER_DOWN', message: expect.stringContaining('Probá de nuevo') });
  });

  it('avisoDeFalla: un error nuestro (no del proveedor) sale como ORBI_ERROR', async () => {
    const { svc } = armar();
    expect((await svc.avisoDeFalla({ error: new TypeError('x is undefined'), surface: 'panel', actor: 'neg-1' })).code).toBe('ORBI_ERROR');
  });

  it('avisoDeFalla con la base caída: aviso de falla pasajera, nunca tira', async () => {
    const { svc } = armar({ dbRota: true });
    expect((await svc.avisoDeFalla({ error: fallaSaldo(), surface: 'panel', actor: 'neg-1' })).code).toBe('ORBI_PROVIDER_DOWN');
  });
});

// ─── Cableado de Nest ────────────────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MailService } from '../../src/mail/mail.service';
import { OrbiSaludModule } from '../../src/orbi/salud/orbi-salud.module';
import { OrbiSaludController } from '../../src/platform/orbi-salud.controller';
import { PlatformAdminLogService } from '../../src/platform/platform-admin-log.service';

@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: {} },
    { provide: MailService, useValue: { sendOrbiMantenimiento: jest.fn() } },
  ],
  exports: [PrismaService, MailService],
})
class GlobalesDeMentira {}

describe('cableado de Nest', () => {
  it('OrbiSaludModule resuelve sus dependencias (Prisma, Mail y config globales + su propio adaptador de IA)', async () => {
    const mod = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true }), GlobalesDeMentira, OrbiSaludModule] }).compile();
    expect(mod.get(OrbiSaludService)).toBeInstanceOf(OrbiSaludService);
  });

  it('el controller de plataforma recibe el servicio exportado por el módulo', async () => {
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), GlobalesDeMentira, OrbiSaludModule],
      controllers: [OrbiSaludController],
      providers: [{ provide: PlatformAdminLogService, useValue: { orbiMantenimiento: jest.fn() } }],
    })
      // El guard real necesita el servicio de auth: acá se prueba solo el cableado.
      .overrideGuard((await import('../../src/common/guards/platform-admin.guard')).PlatformAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    expect(mod.get(OrbiSaludController)).toBeDefined();
  });
});

describe('OrbiSaludController', () => {
  const salud = { rehabilitar: jest.fn(), activarManual: jest.fn(), resumen: jest.fn() };
  const log = { orbiMantenimiento: jest.fn() };
  const ctrl = new OrbiSaludController(salud as any, log as any);
  const req = { user: { adminId: 'admin-1' } } as any;
  beforeEach(() => jest.clearAllMocks());

  it('rehabilitar registra en el log del admin si salió y si la prueba lo rechazó (con el motivo)', async () => {
    salud.rehabilitar.mockResolvedValueOnce({ ok: true });
    expect(await ctrl.rehabilitar(req)).toEqual({ ok: true });
    expect(log.orbiMantenimiento).toHaveBeenLastCalledWith({ adminId: 'admin-1', accion: 'rehabilitado', detalle: undefined });

    salud.rehabilitar.mockResolvedValueOnce({ ok: false, categoria: 'PROVIDER_CREDITS', detalle: 'sin saldo' });
    const r = await ctrl.rehabilitar(req);
    expect(r).toMatchObject({ ok: false });
    expect(log.orbiMantenimiento).toHaveBeenLastCalledWith({ adminId: 'admin-1', accion: 'rehabilitacion_rechazada', detalle: 'PROVIDER_CREDITS: sin saldo' });
  });

  it('poner en mantenimiento: registra solo si cambió algo; si ya estaba apagado, lo dice sin error', async () => {
    salud.activarManual.mockResolvedValueOnce(true);
    expect(await ctrl.mantenimiento(req, { motivo: 'Cambio de modelo' })).toEqual({ ok: true, yaEstabaEnMantenimiento: false });
    expect(log.orbiMantenimiento).toHaveBeenCalledWith({ adminId: 'admin-1', accion: 'activado', detalle: 'Cambio de modelo' });

    log.orbiMantenimiento.mockClear();
    salud.activarManual.mockResolvedValueOnce(false);
    expect(await ctrl.mantenimiento(req, {})).toEqual({ ok: true, yaEstabaEnMantenimiento: true });
    expect(log.orbiMantenimiento).not.toHaveBeenCalled();
  });
});
