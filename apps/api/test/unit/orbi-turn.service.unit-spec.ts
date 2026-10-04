/**
 * Telemetría de los turnos del panel (spec §3.6): una fila en orbi_turns por
 * mensaje, sin texto. Es best-effort: el controller la llama sin esperarla en
 * el `finally` del chat, así que si la base falla no puede lanzar (sería una
 * promesa rechazada sin manejar) ni loguear datos del turno.
 */

import { Logger } from '@nestjs/common';
import { OrbiTurnService } from '../../src/orbi/orbi-turn.service';

const turno = {
  id: 't-1',
  businessId: 'biz-1',
  memberId: 'member-1',
  conversationId: 'conv-1' as string | null,
  module: 'pedidos',
  model: 'gemini-3.6-flash',
  promptTokens: 120,
  completionTokens: 40,
  latencyMs: 1830,
  rounds: 2,
  toolsUsed: ['listOrders'],
  actionsProposed: 0,
  writesRejected: 0,
  status: 'ok' as const,
};

describe('OrbiTurnService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('guarda el turno en orbi_turns con los datos que recibe', async () => {
    const prisma = { orbiTurn: { create: jest.fn().mockResolvedValue({ id: 't-1' }) } };

    await new OrbiTurnService(prisma as any).registrar(turno);

    expect(prisma.orbiTurn.create).toHaveBeenCalledWith({ data: expect.objectContaining(turno) });
  });

  it('lo que no vino queda en null (no en 0: un 0 se promedia como turno gratis)', async () => {
    const prisma = { orbiTurn: { create: jest.fn().mockResolvedValue({ id: 't-1' }) } };

    await new OrbiTurnService(prisma as any).registrar({
      id: 't-2', businessId: 'biz-1', memberId: 'member-1', conversationId: null,
      latencyMs: 10, rounds: 0, toolsUsed: [], actionsProposed: 0, writesRejected: 0, status: 'cancelled',
    });

    expect(prisma.orbiTurn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: null, module: null, model: null, promptTokens: null, completionTokens: null }),
    });
  });

  it('si la base falla no lanza, y el log no trae el mensaje del error', async () => {
    const prisma = { orbiTurn: { create: jest.fn().mockRejectedValue(new Error('connect failed postgres://usuario:clave@host/db')) } };
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(new OrbiTurnService(prisma as any).registrar(turno)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain('clave');
  });
});
