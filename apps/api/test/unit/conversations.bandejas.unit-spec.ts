import { ConversationsService } from '../../src/conversations/conversations.service';

// Las dos bandejas del panel (Mensajes locales y WhatsApp) no se mezclan: cada una ve solo los mensajes de su canal,
// el "sin leer" es de la bandeja donde llegó el último mensaje del cliente, y la respuesta sale siempre por el canal de
// la bandeja desde la que se contesta, aunque el cliente haya escrito después por el otro.

const BIZ = 'biz-1';
const CONV = { id: 'cv-1', businessId: BIZ, customerId: 'cli-1', isUnread: true, isArchived: false, updatedAt: new Date() };
const msg = (id: string, sender: 'CUSTOMER' | 'STORE', channel: string, extra: Record<string, unknown> = {}) =>
  ({ id, sender, text: id, orderId: null, channel, deliveryStatus: null, createdAt: new Date(), ...extra });

function armar(opciones: { ultimoDelCliente?: string | null; mensajes?: unknown[]; filas?: unknown[]; porCanal?: unknown[]; ultimoCliente?: unknown[] } = {}) {
  const whatsapp: any = { enviarTexto: jest.fn().mockResolvedValue('wamid.OUT') };
  const prisma: any = {
    conversation: {
      findFirst: jest.fn().mockResolvedValue(CONV),
      findMany: jest.fn().mockResolvedValue(opciones.filas ?? []),
      update: jest.fn().mockResolvedValue(CONV),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    message: {
      findMany: jest.fn().mockResolvedValue(opciones.mensajes ?? []),
      findFirst: jest.fn().mockResolvedValue(opciones.ultimoDelCliente === null ? null : { channel: opciones.ultimoDelCliente ?? 'STOREFRONT' }),
      create: jest.fn().mockImplementation(async ({ data }) => msg('nuevo', 'STORE', data.channel ?? 'STOREFRONT', data)),
    },
    customer: { findUnique: jest.fn().mockResolvedValue({ whatsappId: '5491122334455' }) },
    order: { findFirst: jest.fn() },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValueOnce(opciones.porCanal ?? []).mockResolvedValueOnce(opciones.ultimoCliente ?? []),
  };
  return { svc: new ConversationsService(prisma, whatsapp), prisma, whatsapp };
}

describe('lista: cada bandeja con lo suyo', () => {
  const fila = { ...CONV, customer: { firstName: 'Ana', lastName: null, avatarUrl: null, email: null }, messages: [msg('ultimo', 'CUSTOMER', 'WHATSAPP')] };
  const raw = (canal: string, id: string, texto: string) => ({
    conversation_id: 'cv-1', id, sender: 'CUSTOMER', text: texto, order_id: null, channel: canal, delivery_status: null, created_at: new Date(),
  });

  it('trae el último mensaje de CADA canal y marca "sin leer" solo en el canal del último mensaje del cliente', async () => {
    const { svc } = armar({
      filas: [fila],
      porCanal: [raw('STOREFRONT', 'm-tienda', 'hola desde la tienda'), raw('WHATSAPP', 'm-wa', 'hola por wpp')],
      ultimoCliente: [{ conversation_id: 'cv-1', channel: 'WHATSAPP' }],
    });
    const [c] = await svc.findAllForBusiness(BIZ);
    expect(c.canales.WHATSAPP).toMatchObject({ isUnread: true, lastMessage: { id: 'm-wa', text: 'hola por wpp' } });
    expect(c.canales.STOREFRONT).toMatchObject({ isUnread: false, lastMessage: { id: 'm-tienda', text: 'hola desde la tienda' } });
  });

  it('una charla leída no tiene sin leer en ningún canal, y una que solo existe en un canal no aparece en el otro', async () => {
    const { svc } = armar({
      filas: [{ ...fila, isUnread: false }],
      porCanal: [raw('STOREFRONT', 'm-tienda', 'solo tienda')],
      ultimoCliente: [{ conversation_id: 'cv-1', channel: 'STOREFRONT' }],
    });
    const [c] = await svc.findAllForBusiness(BIZ);
    expect(c.canales.STOREFRONT?.isUnread).toBe(false);
    expect(c.canales.WHATSAPP).toBeUndefined();
  });

  it('sin charlas no hace consultas de más', async () => {
    const { svc, prisma } = armar();
    await expect(svc.findAllForBusiness(BIZ)).resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('abrir una charla desde una bandeja', () => {
  it('pide solo los mensajes de ese canal', async () => {
    const { svc, prisma } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.getMessages(BIZ, 'cv-1', true, 'WHATSAPP');
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: 'cv-1', channel: 'WHATSAPP' } }));
  });

  it('la marca leída si lo pendiente es de esa bandeja', async () => {
    const { svc, prisma } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.getMessages(BIZ, 'cv-1', true, 'WHATSAPP');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('NO la marca leída si lo pendiente es del otro canal (abrir la local no apaga el sin leer de WhatsApp)', async () => {
    const { svc, prisma } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.getMessages(BIZ, 'cv-1', true, 'STOREFRONT');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('sin bandeja elegida se comporta como siempre: todos los mensajes y la marca como leída', async () => {
    const { svc, prisma } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.getMessages(BIZ, 'cv-1');
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: 'cv-1' } }));
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe('responder desde una bandeja', () => {
  it('desde la local sale por el chat de la tienda aunque el cliente haya escrito después por WhatsApp', async () => {
    const { svc, prisma, whatsapp } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.sendMessage(BIZ, 'cv-1', { text: 'Hola', canal: 'STOREFRONT' });
    expect(whatsapp.enviarTexto).not.toHaveBeenCalled();
    expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ channel: 'WHATSAPP' }) });
  });

  it('desde la de WhatsApp sale siempre por WhatsApp, y se guarda con su id', async () => {
    const { svc, prisma, whatsapp } = armar({ ultimoDelCliente: 'STOREFRONT' });
    await svc.sendMessage(BIZ, 'cv-1', { text: 'Hola', canal: 'WHATSAPP' });
    expect(whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, 'cv-1', '5491122334455', 'Hola');
    expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ channel: 'WHATSAPP', externalId: 'wamid.OUT', deliveryStatus: 'sent' }) });
  });

  it('contestar en una bandeja no apaga el sin leer de la otra', async () => {
    const { svc, prisma } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.sendMessage(BIZ, 'cv-1', { text: 'Hola', canal: 'STOREFRONT' });
    expect(prisma.conversation.update.mock.calls[0][0].data).not.toHaveProperty('isUnread');
  });

  it('contestar donde estaba lo pendiente sí lo apaga', async () => {
    const { svc, prisma } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.sendMessage(BIZ, 'cv-1', { text: 'Hola', canal: 'WHATSAPP' });
    expect(prisma.conversation.update.mock.calls[0][0].data).toMatchObject({ isUnread: false });
  });

  it('sin bandeja elegida (otros llamadores) sigue saliendo por el canal del último mensaje del cliente', async () => {
    const { svc, whatsapp } = armar({ ultimoDelCliente: 'WHATSAPP' });
    await svc.sendMessage(BIZ, 'cv-1', { text: 'Hola' });
    expect(whatsapp.enviarTexto).toHaveBeenCalled();
  });
});
