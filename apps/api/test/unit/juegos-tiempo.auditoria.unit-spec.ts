import { GamesPlayService } from '../../src/games/games-play.service';

// Auditoría interna 10/09, ítem web.cliente.juegos: la física del juego corre
// en el cliente, así que el servidor no acepta más aciertos de los que entran
// en el tiempo que duró la sesión (uno cada MIN_MS_POR_ACIERTO).

const BIZ = 'biz-1';
const juego = { id: 'g1', businessId: BIZ, percentPerWin: 3, maxPercent: 15, maxAttempts: 5, updatedAt: new Date('2026-09-01T12:00:00Z') };

function armar(arrancoHaceMs: number) {
  const prisma = {
    gameSession: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ses-1', gameId: 'g1', businessId: BIZ, customerId: null, status: 'PLAYING', game: juego,
        createdAt: new Date(Date.now() - arrancoHaceMs),
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(true) };
  const svc = new GamesPlayService(prisma as any, { sendGamePrize: jest.fn() } as any, businesses as any);
  return { svc, prisma };
}

const guardado = (prisma: ReturnType<typeof armar>['prisma']) => prisma.gameSession.updateMany.mock.calls[0][0].data;

describe('Juegos: aciertos plausibles según el tiempo de la sesión', () => {
  it('"terminar" al instante con todos los aciertos no gana nada', async () => {
    const { svc, prisma } = armar(50);
    await svc.finishSession(BIZ, 'ses-1', 5, null);
    expect(guardado(prisma)).toMatchObject({ hits: 0, status: 'LOST', discountPercent: null });
  });

  it('solo cuentan los aciertos que entran en el tiempo transcurrido', async () => {
    const { svc, prisma } = armar(GamesPlayService.MIN_MS_POR_ACIERTO * 2 + 100);
    await svc.finishSession(BIZ, 'ses-1', 5, null);
    expect(guardado(prisma)).toMatchObject({ hits: 2, status: 'WON', discountPercent: 6 });
  });

  it('una partida normal (varios segundos) conserva todos sus aciertos, con el techo de siempre', async () => {
    const { svc, prisma } = armar(20_000);
    await svc.finishSession(BIZ, 'ses-1', 5, null);
    expect(guardado(prisma)).toMatchObject({ hits: 5, discountPercent: 15 });
  });

  it('el mínimo por acierto queda por debajo de la animación de un tiro (640 ms)', () => {
    expect(GamesPlayService.MIN_MS_POR_ACIERTO).toBeLessThan(640);
  });
});
