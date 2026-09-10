import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GamesPlayService } from '../../src/games/games-play.service';
import { GamesService } from '../../src/games/games.service';

// Auditoría interna 2026-09-10, ítem `api.games`. Los juegos EMITEN
// DESCUENTOS REALES.
//
// - "Un premio por campaña" vivía solo en el localStorage del navegador: un
//   cliente jugaba, ganaba y reclamaba una y otra vez, y cada reclamo creaba
//   un cupón (en producción, un cliente de prueba juntó 5 en un mismo juego).
// - Dos "terminar" o dos "reclamar" simultáneos de la misma sesión creaban
//   dos cupones.

const BIZ = 'biz-1';
const CAMPANIA = new Date('2026-09-01T12:00:00Z');
const juego = {
  id: 'g1', businessId: BIZ, type: 'HOOP', name: 'Encestar', isActive: true, startDate: null, endDate: null,
  percentPerWin: 3, maxPercent: 15, maxAttempts: 5, timeLimitSeconds: 4, campaignVersion: 1, updatedAt: CAMPANIA,
};

function juegos(opts: { yaGano?: number; tomada?: number; terminada?: number; tienda?: object } = {}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    gameSession: {
      count: jest.fn().mockResolvedValue(opts.yaGano ?? 0),
      updateMany: jest.fn().mockResolvedValue({ count: opts.tomada ?? 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    discount: { create: jest.fn().mockResolvedValue({ id: 'd-1', code: 'PREMIO-NUEVO', endDate: null }) },
  };
  const prisma = {
    business: { findUnique: jest.fn().mockImplementation(({ select }) => Promise.resolve(select?.isActive ? { isActive: true, isPaused: false, ...opts.tienda } : { name: 'T', subdomain: 't' })) },
    game: { findUnique: jest.fn().mockResolvedValue(juego) },
    gameSession: {
      count: jest.fn().mockResolvedValue(opts.yaGano ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'ses-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'ses-1', gameId: 'g1', businessId: BIZ, customerId: null, status: 'PLAYING', game: juego }),
      updateMany: jest.fn().mockResolvedValue({ count: opts.terminada ?? 1 }),
    },
    customer: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(true) };
  const svc = new GamesPlayService(prisma as any, { sendGamePrize: jest.fn() } as any, businesses as any);
  return { svc, prisma, tx };
}

describe('Un premio por cliente y por campaña', () => {
  it('con sesión, un cliente que ya ganó esta campaña no puede arrancar otra partida', async () => {
    const { svc, prisma } = juegos({ yaGano: 1 });
    await expect(svc.startSession(BIZ, 'HOOP', 'c-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.gameSession.count).toHaveBeenCalledWith({ where: { businessId: BIZ, gameId: 'g1', customerId: 'c-1', status: 'CLAIMED', claimedAt: { gte: CAMPANIA } } });
    expect(prisma.gameSession.create).not.toHaveBeenCalled();
  });

  it('sin sesión se puede jugar (el tope se aplica al reclamar)', async () => {
    const { svc } = juegos({ yaGano: 1 });
    await expect(svc.startSession(BIZ, 'HOOP', null)).resolves.toMatchObject({ sessionId: 'ses-1' });
  });

  it('reclamar con el premio de la campaña ya cobrado: 403 y no se crea otro cupón', async () => {
    const { svc, prisma, tx } = juegos({ yaGano: 1 });
    prisma.gameSession.findUnique.mockResolvedValue({ id: 'ses-2', gameId: 'g1', businessId: BIZ, customerId: null, status: 'WON', discountPercent: 15 });
    await expect(svc.claimSession(BIZ, 'ses-2', 'c-1')).rejects.toThrow(/Ya ganaste/);
    expect(tx.$executeRaw).toHaveBeenCalled(); // con el lock tomado
    expect(tx.discount.create).not.toHaveBeenCalled();
  });

  it('terminar ganando, logueado, con el premio ya cobrado: la sesión queda ganada, sin cupón nuevo', async () => {
    const { svc, tx } = juegos({ yaGano: 1 });
    await expect(svc.finishSession(BIZ, 'ses-1', 5, 'c-1')).resolves.toEqual({ status: 'WON', discountPercent: 15, code: null, expiresAt: null });
    expect(tx.discount.create).not.toHaveBeenCalled();
  });

  it('el primer premio de la campaña sí se emite', async () => {
    const { svc, tx } = juegos();
    await expect(svc.finishSession(BIZ, 'ses-1', 5, 'c-1')).resolves.toMatchObject({ status: 'CLAIMED', code: expect.stringMatching(/^PREMIO-/) });
    expect(tx.discount.create).toHaveBeenCalledTimes(1);
  });
});

describe('Concurrencia sobre la misma sesión', () => {
  it('terminar se escribe condicionado a que siga en juego; el segundo "terminar" da 400', async () => {
    const { svc, prisma } = juegos({ terminada: 0 });
    await expect(svc.finishSession(BIZ, 'ses-1', 5, null)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.gameSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ses-1', businessId: BIZ, status: 'PLAYING' } }));
  });

  it('dos reclamos a la vez: el segundo no crea cupón y devuelve el del primero', async () => {
    const { svc, prisma, tx } = juegos({ tomada: 0 });
    prisma.gameSession.findUnique.mockResolvedValueOnce({ id: 'ses-3', gameId: 'g1', businessId: BIZ, customerId: null, status: 'WON', discountPercent: 9 });
    (prisma.gameSession as any).findFirst = jest.fn().mockResolvedValue({ id: 'ses-3', customerId: 'c-1', discount: { code: 'PREMIO-PRIMERO', endDate: null } });
    await expect(svc.claimSession(BIZ, 'ses-3', 'c-1')).resolves.toEqual({ code: 'PREMIO-PRIMERO', expiresAt: null });
    expect(tx.discount.create).not.toHaveBeenCalled();
  });

  it('los aciertos se topean: nunca más que los tiros ni más que el techo', async () => {
    const { svc, prisma } = juegos();
    await svc.finishSession(BIZ, 'ses-1', 999, null);
    expect(prisma.gameSession.updateMany.mock.calls[0][0].data).toMatchObject({ hits: 5, discountPercent: 15 });
  });
});

describe('Tienda y configuración', () => {
  it('tienda pausada: no hay juegos ni se puede arrancar', async () => {
    const { svc } = juegos({ tienda: { isPaused: true } });
    await expect(svc.listActive(BIZ)).resolves.toEqual([]);
    await expect(svc.startSession(BIZ, 'HOOP', null)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el tipo de juego tiene forma y la vigencia va por días de Argentina', async () => {
    const prisma = { game: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ ...juego, ...create })) } };
    const svc = new GamesService(prisma as any);
    const dto = { isActive: true, percentPerWin: 3, maxPercent: 15, startDate: '2026-09-01', endDate: '2026-09-04' };
    await expect(svc.upsert(BIZ, '<script>', dto)).rejects.toThrow(/Tipo de juego/);
    await svc.upsert(BIZ, 'HOOP', dto);
    expect(prisma.game.upsert.mock.calls[0][0].create.endDate.toISOString()).toBe('2026-09-05T02:59:59.999Z');
  });
});
