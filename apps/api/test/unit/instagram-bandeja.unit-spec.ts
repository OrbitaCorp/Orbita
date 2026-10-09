import { NotFoundException } from '@nestjs/common';
import { InstagramBandejaService } from '../../src/marketing/instagram-bandeja.service';

// La bandeja de Instagram de la empresa dentro del super panel. Desde acá solo se ven y se contestan las
// conversaciones de Instagram del negocio de la empresa: nunca las de otro negocio, ni el chat de la tienda.

const NEGOCIO = { id: 'b-orbita' };

function armar(over: { negocio?: object | null; conversacion?: object | null; filas?: object[] } = {}) {
  const prisma = {
    business: { findFirst: jest.fn().mockResolvedValue(over.negocio === undefined ? NEGOCIO : over.negocio) },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(over.conversacion === undefined ? { id: 'c-1' } : over.conversacion),
      findMany: jest.fn().mockResolvedValue(over.filas ?? []),
    },
  };
  const conversations = {
    getMessages: jest.fn().mockResolvedValue([{ id: 'm-1', text: 'hola' }]),
    sendMessage: jest.fn().mockResolvedValue({ id: 'm-2', text: 'hola, gracias' }),
  };
  const config = { get: (k: string) => (k === 'MARKETING_NEGOCIO' ? undefined : undefined) };
  return { svc: new InstagramBandejaService(prisma as any, config as any, conversations as any), prisma, conversations };
}

const fila = (over: object = {}) => ({
  id: 'c-1', isUnread: true, updatedAt: new Date('2026-10-09T10:00:00Z'),
  customer: { firstName: 'Lucía', lastName: 'Pérez', avatarUrl: null },
  messages: [{ text: '¿Tienen planes para tiendas de ropa?', sender: 'CUSTOMER', createdAt: new Date('2026-10-09T10:00:00Z') }],
  ...over,
});

describe('conversaciones', () => {
  it('solo trae las del negocio de la empresa que tienen mensajes de Instagram y no están archivadas', async () => {
    const { svc, prisma } = armar();
    await svc.conversaciones();
    expect(prisma.business.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { subdomain: 'negocio', deletedAt: null } }));
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: 'b-orbita', isArchived: false, messages: { some: { channel: 'INSTAGRAM' } } },
      orderBy: { updatedAt: 'desc' },
    }));
  });

  it('arma la lista: nombre, si está sin leer y el último mensaje (de quién es)', async () => {
    const { svc } = armar({
      filas: [
        fila(),
        fila({ id: 'c-2', isUnread: false, customer: { firstName: 'Instagram 4821', lastName: null, avatarUrl: 'https://x/a.jpg' }, messages: [{ text: 'Gracias, te escribo mañana', sender: 'STORE', createdAt: new Date('2026-10-08T09:00:00Z') }] }),
      ],
    });
    const r = await svc.conversaciones();
    expect(r[0]).toMatchObject({ id: 'c-1', nombre: 'Lucía Pérez', sinLeer: true, ultimo: { texto: '¿Tienen planes para tiendas de ropa?', esMio: false } });
    expect(r[1]).toMatchObject({ id: 'c-2', nombre: 'Instagram 4821', avatar: 'https://x/a.jpg', sinLeer: false, ultimo: { esMio: true } });
  });

  it('una conversación sin mensajes no rompe la lista', async () => {
    const { svc } = armar({ filas: [fila({ messages: [] })] });
    expect((await svc.conversaciones())[0].ultimo).toBeNull();
  });

  it('el tope de la lista no pasa de 200', async () => {
    const { svc, prisma } = armar();
    await svc.conversaciones(5000);
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });

  it('si el negocio de la empresa no existe, avisa', async () => {
    const { svc } = armar({ negocio: null });
    await expect(svc.conversaciones()).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('mensajes y respuestas', () => {
  it('abrir un hilo usa el servicio del panel con el negocio de la empresa (y así lo marca leído)', async () => {
    const { svc, conversations } = armar();
    await expect(svc.mensajes('c-1')).resolves.toEqual([{ id: 'm-1', text: 'hola' }]);
    expect(conversations.getMessages).toHaveBeenCalledWith('b-orbita', 'c-1');
  });

  it('antes de abrir, comprueba que la conversación sea del negocio de la empresa y de Instagram', async () => {
    const { svc, prisma } = armar();
    await svc.mensajes('c-1');
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c-1', businessId: 'b-orbita', messages: { some: { channel: 'INSTAGRAM' } } },
    }));
  });

  it('una conversación ajena o que no es de Instagram no se lee ni se contesta', async () => {
    const { svc, conversations } = armar({ conversacion: null });
    await expect(svc.mensajes('otra')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.responder('otra', { text: 'hola' })).rejects.toBeInstanceOf(NotFoundException);
    expect(conversations.getMessages).not.toHaveBeenCalled();
    expect(conversations.sendMessage).not.toHaveBeenCalled();
  });

  it('contestar manda solo el texto, por el servicio del panel y con el negocio de la empresa', async () => {
    const { svc, conversations } = armar();
    await expect(svc.responder('c-1', { text: 'hola, gracias', orderId: '3b8f6a58-1a2b-4c3d-8e9f-0a1b2c3d4e5f' })).resolves.toMatchObject({ id: 'm-2' });
    // Nunca se menciona un pedido desde acá: es la cuenta de la empresa, no la atención de un comercio.
    expect(conversations.sendMessage).toHaveBeenCalledWith('b-orbita', 'c-1', { text: 'hola, gracias' });
  });
});
