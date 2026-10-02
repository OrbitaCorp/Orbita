import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SesionesService, mensajesV1 } from './sesiones.service';
import { SesionesController } from './sesiones.controller';
import { EditarSesionDto } from './sesiones.dto';
import { tituloAutomatico, tituloLimpio } from './titulo';

const BIZ = 'biz-1';
const YO = 'member-1';
const ID = '11111111-1111-4111-8111-111111111111';
const HACE = (min: number) => new Date(Date.UTC(2026, 9, 2, 12, 0) - min * 60_000);

function fila(over: Record<string, unknown> = {}) {
  return { id: ID, title: 'Ventas de ayer', pinnedAt: null, archivedAt: null, lastActivityAt: HACE(5), screen: 'pedidos', ...over };
}

function prismaFalso() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = {
    orbiConversation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findFirstOrThrow: jest.fn().mockResolvedValue(fila()),
      create: jest.fn(async ({ data }: any) => ({ ...fila({ title: null, screen: data.screen }), id: 'nueva' })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orbiMessage: { findMany: jest.fn().mockResolvedValue([]) },
    orbiPendingAction: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(p)),
  };
  return p;
}

describe('títulos', () => {
  it('el primer mensaje, en una línea y sin invisibles', () => {
    expect(tituloAutomatico('  ¿Cuánto\nvendí‮ ayer?  ')).toBe('¿Cuánto vendí ayer?');
    expect(tituloLimpio('a​b\tc')).toBe('ab c');
  });

  it('uno largo se corta en el último espacio antes de 60 y lleva "…"', () => {
    const t = tituloAutomatico('Necesito armar un descuento del veinte por ciento para todos los mates de calabaza y madera')!;
    expect(Array.from(t).length).toBeLessThanOrEqual(60);
    expect(t.endsWith('…')).toBe(true);
    expect(t).toBe('Necesito armar un descuento del veinte por ciento para…');
    // Si la palabra termina justo en el borde, entra entera.
    expect(tituloAutomatico(`${'a'.repeat(54)} bcde fghij`)).toBe(`${'a'.repeat(54)} bcde…`);
  });

  it('una palabra larguísima se corta igual; un mensaje vacío no tiene título', () => {
    expect(Array.from(tituloAutomatico('x'.repeat(200))!).length).toBe(60);
    expect(tituloAutomatico(' \n​ ')).toBeNull();
  });
});

describe('SesionesService', () => {
  it('listar: solo las del panel de ESTE negocio y ESTA persona, sin archivadas, las fijadas aparte', async () => {
    const prisma = prismaFalso();
    prisma.orbiConversation.findMany
      .mockResolvedValueOnce([fila({ id: 'fijada', pinnedAt: HACE(100) })])
      .mockResolvedValueOnce([fila()]);
    const r = await new SesionesService(prisma as any).listar(BIZ, YO);
    for (const [arg] of prisma.orbiConversation.findMany.mock.calls) {
      expect(arg.where).toMatchObject({ businessId: BIZ, userId: YO, surface: 'panel', archivedAt: null });
    }
    expect(prisma.orbiConversation.findMany.mock.calls[0][0].where.pinnedAt).toEqual({ not: null });
    expect(prisma.orbiConversation.findMany.mock.calls[1][0].where.pinnedAt).toBeNull();
    expect(r.fijadas.map((s) => s.id)).toEqual(['fijada']);
    expect(r.sesiones).toEqual([{ id: ID, titulo: 'Ventas de ayer', fijada: false, archivada: false, ultimaActividad: HACE(5).toISOString(), pantalla: 'pedidos', esperandoAprobacion: false }]);
    expect(r.siguiente).toBeNull();
  });

  it('listar: con más de una página devuelve el cursor, y el cursor pagina por fecha y desempata por id', async () => {
    const prisma = prismaFalso();
    const muchas = Array.from({ length: 31 }, (_, i) => fila({ id: `s-${String(i).padStart(2, '0')}`, lastActivityAt: HACE(i) }));
    prisma.orbiConversation.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(muchas);
    const svc = new SesionesService(prisma as any);
    const r = await svc.listar(BIZ, YO);
    expect(r.sesiones).toHaveLength(30);
    expect(r.siguiente).toBe(`${HACE(29).toISOString()}|s-29`);

    prisma.orbiConversation.findMany.mockClear().mockResolvedValue([]);
    await svc.listar(BIZ, YO, { cursor: r.siguiente! });
    // Con cursor no se vuelven a pedir las fijadas.
    expect(prisma.orbiConversation.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.orbiConversation.findMany.mock.calls[0][0].where.OR).toEqual([
      { lastActivityAt: { lt: HACE(29) } },
      { lastActivityAt: HACE(29), id: { lt: 's-29' } },
    ]);
  });

  it('listar archivadas: solo esas, sin fijadas aparte; la búsqueda va por título sin mayúsculas', async () => {
    const prisma = prismaFalso();
    await new SesionesService(prisma as any).listar(BIZ, YO, { archivadas: true, q: ' ventas ' });
    expect(prisma.orbiConversation.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.orbiConversation.findMany.mock.calls[0][0].where).toMatchObject({
      archivedAt: { not: null },
      title: { contains: 'ventas', mode: 'insensitive' },
    });
  });

  it('marca las sesiones con una tarjeta todavía vigente, buscando en su negocio', async () => {
    const prisma = prismaFalso();
    prisma.orbiConversation.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([fila()]);
    prisma.orbiPendingAction.findMany.mockResolvedValueOnce([{ conversationId: ID }]);
    const r = await new SesionesService(prisma as any).listar(BIZ, YO);
    expect(r.sesiones[0].esperandoAprobacion).toBe(true);
    expect(prisma.orbiPendingAction.findMany.mock.calls[0][0].where).toMatchObject({ businessId: BIZ, status: 'pending', conversationId: { in: [ID] } });
  });

  it('las conversaciones de antes sin título lo toman del primer mensaje y se guarda una sola vez', async () => {
    const prisma = prismaFalso();
    prisma.orbiConversation.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([fila({ title: null })]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: ID, primero: '¿cuántos pedidos tengo sin enviar?' }]);
    const r = await new SesionesService(prisma as any).listar(BIZ, YO);
    expect(r.sesiones[0].titulo).toBe('¿cuántos pedidos tengo sin enviar?');
    expect(prisma.orbiConversation.updateMany).toHaveBeenCalledWith({
      where: { id: ID, businessId: BIZ, userId: YO, title: null, titleAuto: true },
      data: { title: '¿cuántos pedidos tengo sin enviar?' },
    });
  });

  it('si completar títulos falla, la lista sale igual (sin título)', async () => {
    const prisma = prismaFalso();
    prisma.orbiConversation.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([fila({ title: null })]);
    prisma.$queryRaw.mockRejectedValueOnce(new Error('db'));
    const r = await new SesionesService(prisma as any).listar(BIZ, YO);
    expect(r.sesiones[0].titulo).toBeNull();
  });

  it('abrir una ajena o inexistente: 404 (se ven igual)', async () => {
    const prisma = prismaFalso();
    await expect(new SesionesService(prisma as any).abrir(BIZ, YO, ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.orbiConversation.findFirst.mock.calls[0][0].where).toEqual({ id: ID, businessId: BIZ, userId: YO, surface: 'panel' });
  });

  it('abrir una v1: los mensajes del Json como partes de texto, sin los vacíos ni los de tools', async () => {
    const prisma = prismaFalso();
    prisma.orbiConversation.findFirst.mockResolvedValueOnce({
      ...fila(), version: 1,
      messages: [
        { role: 'user', content: 'hola', timestamp: '2026-10-02T11:00:00Z' },
        { role: 'assistant', content: '' },
        { role: 'tool', content: '{"x":1}' },
        { role: 'assistant', content: 'Hola, ¿en qué te ayudo?' },
      ],
    });
    const r = await new SesionesService(prisma as any).abrir(BIZ, YO, ID);
    expect(r.mensajes).toEqual([
      { id: 'v1-0', rol: 'user', partes: [{ tipo: 'texto', texto: 'hola' }], creadoEl: '2026-10-02T11:00:00Z' },
      { id: 'v1-3', rol: 'assistant', partes: [{ tipo: 'texto', texto: 'Hola, ¿en qué te ayudo?' }], creadoEl: null },
    ]);
    expect(prisma.orbiMessage.findMany).not.toHaveBeenCalled();
  });

  it('abrir una v2: las partes guardadas, y cada tarjeta con su estado de HOY (vigente, vencida, aplicada)', async () => {
    jest.useFakeTimers({ now: HACE(0) });
    try {
      const prisma = prismaFalso();
      prisma.orbiConversation.findFirst.mockResolvedValueOnce({ ...fila(), version: 2, messages: [] });
      const aprobacion = (actionId: string) => ({ tipo: 'aprobacion', actionId, tool: 'createCoupon', resumen: 'Crear el cupón' });
      prisma.orbiMessage.findMany.mockResolvedValueOnce([
        { id: 'm1', role: 'user', parts: [{ tipo: 'texto', texto: 'armá 3 cupones' }], createdAt: HACE(10) },
        { id: 'm2', role: 'assistant', parts: [aprobacion('a1'), aprobacion('a2'), aprobacion('a3'), aprobacion('a4')], createdAt: HACE(9) },
      ]);
      prisma.orbiPendingAction.findMany.mockImplementation(async ({ where }: any) => (where.id
        ? [
          { id: 'a1', status: 'pending', expiresAt: HACE(-5) },
          { id: 'a2', status: 'pending', expiresAt: HACE(1) },
          { id: 'a3', status: 'executed', expiresAt: HACE(-5) },
        ]
        : []));
      const r = await new SesionesService(prisma as any).abrir(BIZ, YO, ID);
      expect(r.mensajes[1].partes.map((p: any) => p.estadoActual)).toEqual(['pendiente', 'vencida', 'aplicada', 'desconocida']);
      expect(prisma.orbiMessage.findMany.mock.calls[0][0].where).toEqual({ conversationId: ID, businessId: BIZ });
      expect(prisma.orbiPendingAction.findMany.mock.calls[0][0].where).toMatchObject({ businessId: BIZ });
    } finally {
      jest.useRealTimers();
    }
  });

  it('editar: renombrar deja de ser automático; vaciar vuelve al automático; todo acotado a la persona', async () => {
    const prisma = prismaFalso();
    const svc = new SesionesService(prisma as any);
    await svc.editar(BIZ, YO, ID, { titulo: 'Cupones‮ de invierno' });
    expect(prisma.orbiConversation.updateMany).toHaveBeenLastCalledWith({
      where: { id: ID, businessId: BIZ, userId: YO, surface: 'panel' },
      data: { title: 'Cupones de invierno', titleAuto: false },
    });
    await svc.editar(BIZ, YO, ID, { titulo: '' });
    expect(prisma.orbiConversation.updateMany.mock.lastCall![0].data).toEqual({ title: null, titleAuto: true });
  });

  it('editar: fijar y archivar ponen la fecha; desfijar y desarchivar la sacan', async () => {
    jest.useFakeTimers({ now: HACE(0) });
    try {
      const prisma = prismaFalso();
      const svc = new SesionesService(prisma as any);
      await svc.editar(BIZ, YO, ID, { fijada: true, archivada: false });
      expect(prisma.orbiConversation.updateMany.mock.lastCall![0].data).toEqual({ pinnedAt: HACE(0), archivedAt: null });
    } finally {
      jest.useRealTimers();
    }
  });

  it('editar o borrar una ajena: 404, y borrar no cancela nada', async () => {
    const prisma = prismaFalso();
    prisma.orbiConversation.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.orbiConversation.deleteMany.mockResolvedValueOnce({ count: 0 });
    const svc = new SesionesService(prisma as any);
    await expect(svc.editar(BIZ, YO, ID, { fijada: true })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.borrar(BIZ, YO, ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.orbiPendingAction.updateMany).not.toHaveBeenCalled();
  });

  it('borrar cancela, en la misma transacción, las tarjetas todavía pendientes de esa sesión', async () => {
    const prisma = prismaFalso();
    await new SesionesService(prisma as any).borrar(BIZ, YO, ID);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.orbiConversation.deleteMany).toHaveBeenCalledWith({ where: { id: ID, businessId: BIZ, userId: YO, surface: 'panel' } });
    expect(prisma.orbiPendingAction.updateMany).toHaveBeenCalledWith({
      where: { conversationId: ID, businessId: BIZ, memberId: YO, status: 'pending' },
      data: { status: 'rejected', resolvedAt: expect.any(Date) },
    });
  });

  it('crear: vacía, del panel, con la pantalla', async () => {
    const prisma = prismaFalso();
    const r = await new SesionesService(prisma as any).crear(BIZ, YO, 'pedidos');
    expect(prisma.orbiConversation.create.mock.calls[0][0].data).toEqual({ businessId: BIZ, userId: YO, surface: 'panel', messages: [], screen: 'pedidos' });
    expect(r).toMatchObject({ id: 'nueva', titulo: null, pantalla: 'pedidos', esperandoAprobacion: false });
  });

  it('mensajesV1 tolera un Json que no es lista', () => {
    expect(mensajesV1(null)).toEqual([]);
    expect(mensajesV1({ a: 1 } as any)).toEqual([]);
  });
});

describe('SesionesController', () => {
  const svc = { listar: jest.fn(), crear: jest.fn(), abrir: jest.fn(), editar: jest.fn(), borrar: jest.fn() };
  const ctrl = new SesionesController(svc as any);
  const miembro = { type: 'member', businessId: BIZ, memberId: YO } as any;

  it('un cliente de la tienda no tiene sesiones de Orbi', () => {
    expect(() => ctrl.listar({ type: 'customer', businessId: BIZ, customerId: 'c' } as any, {})).toThrow(ForbiddenException);
  });

  it('negocio y miembro salen del token', () => {
    ctrl.listar(miembro, { archivadas: '1', q: 'x' });
    expect(svc.listar).toHaveBeenCalledWith(BIZ, YO, { archivadas: true, q: 'x', cursor: undefined });
  });

  it('un PATCH sin nada para cambiar es un 400', () => {
    expect(() => ctrl.editar(miembro, ID, {})).toThrow(BadRequestException);
  });

  it('el título es de una línea y hasta 80 caracteres', async () => {
    const errores = async (titulo: string) => validate(plainToInstance(EditarSesionDto, { titulo }));
    expect(await errores('Cupones de invierno')).toHaveLength(0);
    expect(await errores('dos\nlíneas')).not.toHaveLength(0);
    expect(await errores('x'.repeat(81))).not.toHaveLength(0);
  });
});
