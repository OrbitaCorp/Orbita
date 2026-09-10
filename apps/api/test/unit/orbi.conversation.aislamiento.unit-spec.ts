import { NotFoundException } from '@nestjs/common';
import { ConversationService } from '../../src/orbi/conversation/conversation.service';

// Aislamiento de las conversaciones del panel de Orbi (auditoría interna
// 2026-09-09, verificación 2 del ítem `api.prisma`).
//
// El id de la conversación lo manda el cliente en cada mensaje
// (`dto.conversationId`). Buscarlo solo por id era un IDOR entre negocios:
// con el id de la conversación de otra tienda, Orbi la leía entera y la usaba
// como historial del turno — o sea que se la contaba al que preguntara — y
// además le escribía mensajes adentro. Que los uuid no se adivinen es un
// obstáculo, no un control de acceso.

const CONV = {
  id: 'conv-1',
  businessId: 'biz-1',
  userId: 'member-1',
  surface: 'panel',
  messages: [{ role: 'user', content: 'cuánto vendí este mes', timestamp: '2026-09-09T10:00:00.000Z' }],
};

function servicio() {
  // Simula el filtro real de Prisma: devuelve la fila solo si los tres campos
  // del where coinciden, que es exactamente lo que el bug no hacía.
  const findFirst = jest.fn(({ where }: { where: { id: string; businessId: string; userId: string } }) =>
    Promise.resolve(
      where.id === CONV.id && where.businessId === CONV.businessId && where.userId === CONV.userId ? { ...CONV } : null,
    ),
  );
  const update = jest.fn().mockResolvedValue({ ...CONV });
  const prisma = { orbiConversation: { findFirst, update, findUnique: jest.fn(), create: jest.fn() } } as never;
  return { svc: new ConversationService(prisma), findFirst, update };
}

const MENSAJE = { role: 'user' as const, content: 'hola', timestamp: '2026-09-09T11:00:00.000Z' };

describe('Conversaciones de Orbi — son de un negocio y de una persona', () => {
  it('el dueño de la conversación la lee y le escribe', async () => {
    const { svc, update } = servicio();
    await expect(svc.getMessages('conv-1', 'biz-1', 'member-1')).resolves.toHaveLength(1);
    await expect(svc.appendMessage('conv-1', 'biz-1', 'member-1', MENSAJE)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
  });

  it('otro NEGOCIO no puede leerla ni escribirle', async () => {
    const { svc, update } = servicio();
    await expect(svc.getMessages('conv-1', 'biz-2', 'member-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.appendMessage('conv-1', 'biz-2', 'member-1', MENSAJE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.assertPropia('conv-1', 'biz-2', 'member-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('otra PERSONA del mismo negocio tampoco', async () => {
    const { svc, update } = servicio();
    await expect(svc.getMessages('conv-1', 'biz-1', 'member-2')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.appendMessage('conv-1', 'biz-1', 'member-2', MENSAJE)).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('una conversación que no existe se trata igual que una ajena', async () => {
    const { svc } = servicio();
    await expect(svc.assertPropia('conv-inventada', 'biz-1', 'member-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el filtro va en la consulta, no después de traer la fila', async () => {
    const { svc, findFirst } = servicio();
    await svc.getMessages('conv-1', 'biz-1', 'member-1');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'conv-1', businessId: 'biz-1', userId: 'member-1' } });
  });
});
