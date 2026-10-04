/**
 * La ficha ampliada de un turno (spec 2026-10-03 §5.1): `registrar` guarda el
 * id, los pasos y las escrituras rechazadas, y `contarDesenlace` suma cuántas
 * de las acciones que propuso el turno se confirmaron o se cancelaron.
 */

import { Logger } from '@nestjs/common';
import { OrbiTurnService } from '../../src/orbi/orbi-turn.service';

const base = {
  id: 't1',
  businessId: 'biz-1',
  memberId: 'member-1',
  conversationId: 'conv-1' as string | null,
  latencyMs: 1500,
  rounds: 2,
  toolsUsed: ['listOrders'],
  actionsProposed: 1,
  writesRejected: 0,
  status: 'ok' as const,
};

describe('OrbiTurnService — ficha ampliada', () => {
  afterEach(() => jest.restoreAllMocks());

  function servicio(over: Record<string, unknown> = {}) {
    const prisma = { orbiTurn: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }), ...over } };
    return { svc: new OrbiTurnService(prisma as any), prisma };
  }

  it('registrar guarda el id, los pasos y las escrituras rechazadas', async () => {
    const { svc, prisma } = servicio();
    const steps = [{ n: 1, ms: 900, tools: [] }] as any;

    await svc.registrar({ ...base, steps, writesRejected: 2, provider: 'gemini', cachedTokens: 30, thinkingTokens: 5, ttftMs: 400, errorCategory: 'caida', section: 'pedidos', contextChars: { system: 1, tools: 2, history: 3, message: 4 } });

    expect(prisma.orbiTurn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 't1', steps, writesRejected: 2, provider: 'gemini', cachedTokens: 30, thinkingTokens: 5, ttftMs: 400,
        errorCategory: 'caida', section: 'pedidos', contextChars: { system: 1, tools: 2, history: 3, message: 4 },
      }),
    });
  });

  it('lo que no vino queda en null (el costo no se inventa)', async () => {
    const { svc, prisma } = servicio();

    await svc.registrar(base);

    const { data } = prisma.orbiTurn.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data).toEqual(expect.objectContaining({ provider: null, cachedTokens: null, thinkingTokens: null, ttftMs: null, costUsd: null, toolsCostUsd: null, credits: null, errorCategory: null, section: null }));
    // Los Json vacíos no son null de SQL: son el marcador de Prisma.
    expect(data.steps).toBeDefined();
    expect(data.contextChars).toBeDefined();
  });

  it('contarDesenlace suma una confirmada en el turno que propuso la acción', async () => {
    const { svc, prisma } = servicio();

    await svc.contarDesenlace('t1', 'confirmada');

    expect(prisma.orbiTurn.updateMany).toHaveBeenCalledWith({ where: { id: 't1' }, data: { actionsConfirmed: { increment: 1 } } });
  });

  it('contarDesenlace suma una rechazada', async () => {
    const { svc, prisma } = servicio();

    await svc.contarDesenlace('t1', 'rechazada');

    expect(prisma.orbiTurn.updateMany).toHaveBeenCalledWith({ where: { id: 't1' }, data: { actionsRejected: { increment: 1 } } });
  });

  it('si la base falla, contarDesenlace no lanza', async () => {
    const { svc } = servicio({ updateMany: jest.fn().mockRejectedValue(new Error('boom postgres://u:clave@h/db')) });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(svc.contarDesenlace('t1', 'confirmada')).resolves.toBeUndefined();

    expect(String(warn.mock.calls[0][0])).not.toContain('clave');
  });
});
