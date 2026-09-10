import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from '../../src/conversations/conversations.service';

// Auditoría interna 2026-09-10, ítem `api.conversations`.
//
// El chat cliente ↔ tienda ya estaba aislado por negocio y por cliente. Se
// acotó lo que devuelve (antes, todos los mensajes de un hilo) y se sumó
// throttle al envío del cliente.

const BIZ = 'biz-1';

function conversaciones(conv: object | null = { id: 'c-1', businessId: BIZ, customerId: 'cu-1', isUnread: false }) {
  const prisma = {
    conversation: { findFirst: jest.fn().mockResolvedValue(conv), update: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'c-nueva' }) },
    message: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'm2', sender: 'STORE', text: 'segundo', orderId: null, createdAt: new Date(2) },
        { id: 'm1', sender: 'CUSTOMER', text: 'primero', orderId: null, createdAt: new Date(1) },
      ]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm-n', createdAt: new Date(), orderId: null, ...data })),
    },
    order: { findFirst: jest.fn().mockResolvedValue(null) },
    $executeRaw: jest.fn(),
  };
  return { svc: new ConversationsService(prisma as any), prisma };
}

describe('Hilos de mensajes', () => {
  it('el panel solo abre hilos del negocio del token', async () => {
    const { svc, prisma } = conversaciones(null);
    await expect(svc.getMessages(BIZ, 'c-ajena')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({ where: { id: 'c-ajena', businessId: BIZ } });
  });

  it('los mensajes vienen acotados (los últimos 500) y en orden cronológico', async () => {
    const { svc, prisma } = conversaciones();
    const msgs = await svc.getMessages(BIZ, 'c-1');
    expect(prisma.message.findMany).toHaveBeenCalledWith({ where: { conversationId: 'c-1' }, orderBy: { createdAt: 'desc' }, take: 500 });
    expect(msgs.map((m) => m.text)).toEqual(['primero', 'segundo']);
  });

  it('el cliente ve solo su hilo con ESA tienda, también acotado', async () => {
    const { svc, prisma } = conversaciones();
    const r = await svc.myThread(BIZ, 'cu-1');
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({ where: { businessId: BIZ, customerId: 'cu-1' } });
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
    expect(r.messages.map((m) => m.text)).toEqual(['primero', 'segundo']);
  });

  it('mencionar un pedido exige que sea de ese negocio y de ese cliente', async () => {
    const { svc, prisma } = conversaciones();
    await expect(svc.sendMessage(BIZ, 'c-1', { text: 'mirá', orderId: '11111111-1111-4111-8111-111111111111' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: BIZ, customerId: 'cu-1' }) }));
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
