import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from '../../src/conversations/conversations.service';

// Unit test del chat cliente↔tienda. El módulo no tenía ningún test (ver
// docs/superpowers/plans/2026-09-08-mensajeria-deuda-tecnica.md). Cubre lo que
// arregló la auditoría: el mark-as-read no debe bumpear updatedAt (si no,
// abrir una conversación la reordena en la bandeja), y las validaciones de
// aislamiento / orderId.

type PrismaMock = {
  conversation: Record<string, jest.Mock>;
  message: Record<string, jest.Mock>;
  order: Record<string, jest.Mock>;
  $executeRaw: jest.Mock;
};

const CONV = { id: 'cv-1', businessId: 'biz-1', customerId: 'cli-1', isUnread: true, isArchived: false, updatedAt: new Date() };
const MSG_STORE = { id: 'm-1', sender: 'STORE', text: 'hola', orderId: null, createdAt: new Date() };
const MSG_CUSTOMER = { id: 'm-2', sender: 'CUSTOMER', text: 'consulta', orderId: null, createdAt: new Date() };

function build(overrides: Partial<PrismaMock> = {}) {
  const prisma: PrismaMock = {
    conversation: {
      findFirst: jest.fn().mockResolvedValue(CONV),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(CONV),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ ...CONV, id: 'cv-nueva' }),
      ...(overrides.conversation ?? {}),
    },
    message: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(MSG_STORE),
      ...(overrides.message ?? {}),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ord-1' }),
      ...(overrides.order ?? {}),
    },
    $executeRaw: overrides.$executeRaw ?? jest.fn().mockResolvedValue(1),
  };
  return { svc: new ConversationsService(prisma as any), prisma };
}

describe('ConversationsService (unit)', () => {
  describe('getMessages()', () => {
    it('marca leída con $executeRaw, NO con conversation.update (para no bumpear updatedAt)', async () => {
      const { svc, prisma } = build();
      await svc.getMessages('biz-1', 'cv-1');
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });

    it('no toca nada si la conversación ya estaba leída', async () => {
      const { svc, prisma } = build({
        conversation: { findFirst: jest.fn().mockResolvedValue({ ...CONV, isUnread: false }) },
      });
      await svc.getMessages('biz-1', 'cv-1');
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });

    it('tira 404 si la conversación no es de ese negocio', async () => {
      const { svc } = build({ conversation: { findFirst: jest.fn().mockResolvedValue(null) } });
      await expect(svc.getMessages('biz-1', 'cv-ajena')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('sendMessage()', () => {
    it('rechaza con 404 un orderId que no es del negocio/cliente', async () => {
      const { svc } = build({ order: { findFirst: jest.fn().mockResolvedValue(null) } });
      await expect(
        svc.sendMessage('biz-1', 'cv-1', { text: 'sobre tu pedido', orderId: 'ord-ajeno' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('valida el orderId contra businessId + customerId de la conversación', async () => {
      const { svc, prisma } = build();
      await svc.sendMessage('biz-1', 'cv-1', { text: 'x', orderId: 'ord-1' } as any);
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'ord-1', businessId: 'biz-1', customerId: 'cli-1' },
        select: { id: true },
      });
    });

    it('sin orderId no consulta la tabla de pedidos', async () => {
      const { svc, prisma } = build();
      await svc.sendMessage('biz-1', 'cv-1', { text: 'hola' } as any);
      expect(prisma.order.findFirst).not.toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalled();
    });
  });

  describe('sendMyMessage()', () => {
    it('crea la conversación si no existe y la deja no-leída (isUnread: true)', async () => {
      const { svc, prisma } = build({
        conversation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'cv-nueva' }) },
        message: { create: jest.fn().mockResolvedValue(MSG_CUSTOMER) },
      });
      await svc.sendMyMessage('biz-1', 'cli-1', { text: 'consulta' } as any);
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { businessId: 'biz-1', customerId: 'cli-1', isUnread: true },
      });
    });

    it('si la conversación ya existe, la reactiva (isUnread: true) en vez de crear otra', async () => {
      const { svc, prisma } = build({
        conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'cv-1' }), update: jest.fn(), create: jest.fn() },
        message: { create: jest.fn().mockResolvedValue(MSG_CUSTOMER) },
      });
      await svc.sendMyMessage('biz-1', 'cli-1', { text: 'otra consulta' } as any);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isUnread: true }) }),
      );
    });
  });

  describe('myThread()', () => {
    it('devuelve id null y sin mensajes cuando el cliente nunca escribió', async () => {
      const { svc } = build({ conversation: { findFirst: jest.fn().mockResolvedValue(null) } });
      const res = await svc.myThread('biz-1', 'cli-1');
      expect(res).toEqual({ id: null, messages: [] });
    });
  });
});
