import { WhatsappService, type WaWebhookBody } from '../../src/whatsapp/whatsapp.service';

// Coexistencia: el número sigue en la app WhatsApp Business del celular y a la vez está en Órbita. Cubre que lo que el
// dueño escribe desde el celular aparezca como mensaje del negocio (sin marcar nada como sin leer), que se pueda
// editar o borrar, que el historial se guarde sin duplicar ni marcar nada, y que conectar sin el id del número (que en
// coexistencia Meta no da) tome el de la app, sin registrarlo y pidiendo la sincronización.

const BIZ = 'biz-1';
const PHONE = '555666777';
const WABA = '222333444';

function armar(extra: Record<string, any> = {}) {
  const mensajes = new Map<string, any>();
  const prisma: any = {
    whatsappConnection: { findUnique: jest.fn().mockResolvedValue({ businessId: BIZ, status: 'ACTIVE' }) },
    message: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => mensajes.get(where.externalId) ?? null),
      create: jest.fn().mockImplementation(async ({ data }) => { mensajes.set(data.externalId, { id: `m-${data.externalId}`, ...data }); return data; }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      update: jest.fn().mockResolvedValue({}),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cli-1', deletedAt: null }),
      create: jest.fn().mockResolvedValue({ id: 'cli-nuevo' }),
      update: jest.fn().mockResolvedValue({}),
    },
    conversation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cv-1' }),
      create: jest.fn().mockResolvedValue({ id: 'cv-nueva' }),
      update: jest.fn().mockReturnValue('conv-update'),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn().mockResolvedValue([]),
    ...extra,
  };
  const config: any = { get: (k: string) => ({ WHATSAPP_APP_ID: 'app-1', WHATSAPP_APP_SECRET: 'secreto', WHATSAPP_TOKEN_KEY: 'clave' } as Record<string, string>)[k] };
  return { svc: new WhatsappService(prisma, config), prisma, mensajes };
}

const cambio = (campo: string, valor: Record<string, unknown>): WaWebhookBody => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ field: campo, value: { metadata: { phone_number_id: PHONE }, ...valor } as any }] }],
});

describe('mensajes que el dueño escribe desde el celular (smb_message_echoes)', () => {
  const eco = (extra: Record<string, unknown> = {}) => ({ from: '5491100000000', to: '5491122334455', id: 'wamid.E1', timestamp: '1790000000', type: 'text', text: { body: 'Hola, ya te respondo' }, ...extra });

  it('queda en el hilo del cliente como mensaje del negocio, sin marcar la charla como sin leer', async () => {
    const { svc, prisma } = armar();
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco()] }));
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: 'cv-1', sender: 'STORE', text: 'Hola, ya te respondo', channel: 'WHATSAPP', externalId: 'wamid.E1', deliveryStatus: 'sent' }),
    });
    const actualizacion = prisma.conversation.update.mock.calls[0][0];
    expect(actualizacion.data).not.toHaveProperty('isUnread');
  });

  it('el mismo mensaje que llega dos veces (reintento de Meta) no se duplica', async () => {
    const { svc, prisma } = armar();
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco()] }));
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco()] }));
    expect(prisma.message.create).toHaveBeenCalledTimes(1);
  });

  it('si el cliente no tenía charla, se crea sin marcarla como sin leer', async () => {
    const { svc, prisma } = armar();
    prisma.conversation.findFirst.mockResolvedValue(null);
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco()] }));
    expect(prisma.conversation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isUnread: false }) }));
  });

  it('una foto o un video del celular se guarda como etiqueta, igual que los de los clientes', async () => {
    const { svc, prisma } = armar();
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco({ id: 'wamid.E2', type: 'image', text: undefined, image: { caption: 'Mirá esto' } })] }));
    expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ text: '[Imagen] Mirá esto' }) });
  });

  it('editar un mensaje cambia su texto; borrarlo lo marca como eliminado; solo si es de este negocio', async () => {
    const { svc, prisma, mensajes } = armar();
    mensajes.set('wamid.ORIG', { id: 'm-orig', conversationId: 'cv-1' });
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco({ id: 'wamid.E3', type: 'edit', text: undefined, edit: { original_message_id: 'wamid.ORIG', message: { type: 'text', text: { body: 'Texto corregido' } } } })] }));
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm-orig' }, data: { text: 'Texto corregido' } });
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco({ id: 'wamid.E4', type: 'revoke', text: undefined, revoke: { original_message_id: 'wamid.ORIG' } })] }));
    expect(prisma.message.update).toHaveBeenLastCalledWith({ where: { id: 'm-orig' }, data: { text: '[Mensaje eliminado]' } });

    // Un mensaje de la charla de OTRO negocio no se toca.
    prisma.message.update.mockClear();
    prisma.conversation.findFirst.mockResolvedValue(null);
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco({ id: 'wamid.E5', type: 'revoke', text: undefined, revoke: { original_message_id: 'wamid.ORIG' } })] }));
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('un número sin conexión activa se ignora', async () => {
    const { svc, prisma } = armar();
    prisma.whatsappConnection.findUnique.mockResolvedValue({ businessId: BIZ, status: 'DISCONNECTED' });
    await svc.procesarWebhook(cambio('smb_message_echoes', { message_echoes: [eco()] }));
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe('historial de chats (history)', () => {
  const bloque = (threads: unknown[], extra: Record<string, unknown> = {}) => ({ metadata: { phase: 0, chunk_order: 1, progress: 55 }, threads, ...extra });
  const cliente = '5491122334455';

  it('guarda lo del cliente y lo del negocio en su lugar, sin marcar nada como sin leer, y sin duplicar', async () => {
    const { svc, prisma } = armar();
    await svc.procesarWebhook(cambio('history', {
      history: [bloque([{ id: cliente, messages: [
        { from: cliente, id: 'wamid.H1', timestamp: '1790000000', type: 'text', text: { body: '¿Tienen talle M?' }, history_context: { status: 'READ' } },
        { from: '5491100000000', to: cliente, id: 'wamid.H2', timestamp: '1790000100', type: 'text', text: { body: 'Sí, hay' }, history_context: { status: 'READ' } },
        { from: cliente, id: 'wamid.H3', timestamp: '1790000200', type: 'media_placeholder' },
      ] }])],
    }));
    const { data, skipDuplicates } = prisma.message.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data).toHaveLength(3);
    expect(data[0]).toMatchObject({ conversationId: 'cv-1', sender: 'CUSTOMER', text: '¿Tienen talle M?', channel: 'WHATSAPP', externalId: 'wamid.H1', deliveryStatus: null });
    expect(data[1]).toMatchObject({ sender: 'STORE', text: 'Sí, hay', deliveryStatus: 'read' });
    expect(data[2]).toMatchObject({ sender: 'CUSTOMER', text: '[Archivo]' });
    // La charla sube hasta su último mensaje (y nada la marca sin leer).
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'cv-1', businessId: BIZ }) }));
    expect(JSON.stringify(prisma.conversation.updateMany.mock.calls)).not.toContain('isUnread');
  });

  it('las charlas nuevas del historial nacen leídas', async () => {
    const { svc, prisma } = armar();
    prisma.conversation.findFirst.mockResolvedValue(null);
    await svc.procesarWebhook(cambio('history', { history: [bloque([{ id: cliente, messages: [{ from: cliente, id: 'wamid.H9', timestamp: '1790000000', type: 'text', text: { body: 'hola' } }] }])] }));
    expect(prisma.conversation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isUnread: false }) }));
  });

  it('si el dueño no quiso compartir el historial, Meta avisa con un error y no se guarda nada', async () => {
    const { svc, prisma } = armar();
    await svc.procesarWebhook(cambio('history', { history: [{ errors: [{ code: 2593109, title: 'History sync is turned off' }] }] }));
    expect(prisma.message.createMany).not.toHaveBeenCalled();
  });

  it('un mensaje sin texto utilizable (una reacción) no entra', async () => {
    const { svc, prisma } = armar();
    await svc.procesarWebhook(cambio('history', { history: [bloque([{ id: cliente, messages: [{ from: cliente, id: 'wamid.R', timestamp: '1', type: 'reaction' }] }])] }));
    expect(prisma.message.createMany).not.toHaveBeenCalled();
  });
});

describe('conectar en coexistencia (sin id del número)', () => {
  function conMeta(numeros: unknown[]) {
    const { svc, prisma } = armar();
    const llamadas: { url: string; init?: any }[] = [];
    jest.spyOn(global, 'fetch').mockImplementation((async (url: string, init?: any) => {
      llamadas.push({ url: String(url), init });
      const u = String(url);
      const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as any;
      if (u.includes('/oauth/access_token')) return ok({ access_token: 'tok' });
      if (u.includes(`/${WABA}/phone_numbers`)) return ok({ data: numeros });
      return ok({ success: true });
    }) as any);
    return { svc, prisma, llamadas };
  }
  afterEach(() => jest.restoreAllMocks());

  it('toma el número que sigue en la app, no lo registra y pide los contactos y el historial', async () => {
    const { svc, prisma, llamadas } = conMeta([{ id: '999', display_phone_number: '+54 9 11 0000-0000', is_on_biz_app: false }, { id: PHONE, display_phone_number: '+54 9 11 5555-0000', is_on_biz_app: true }]);
    const r = await svc.conectarConEmbeddedSignup(BIZ, { code: 'c', wabaId: WABA });
    expect(r).toMatchObject({ connected: true, displayPhone: '+54 9 11 5555-0000', coexistencia: true });
    expect(llamadas.some((l) => l.url.includes('/register'))).toBe(false);
    const syncs = llamadas.filter((l) => l.url.includes(`/${PHONE}/smb_app_data`)).map((l) => JSON.parse(l.init.body).sync_type);
    expect(syncs).toEqual(['smb_app_state_sync', 'history']);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('una cuenta sin números da un mensaje claro y no guarda nada', async () => {
    const { svc, prisma } = conMeta([]);
    await expect(svc.conectarConEmbeddedSignup(BIZ, { code: 'c', wabaId: WABA })).rejects.toThrow(/No encontramos ningún número/);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('un número nuevo (no estaba en la app) sí se registra y no pide sincronización', async () => {
    const { svc, llamadas } = conMeta([{ id: PHONE, display_phone_number: '+54 9 11 5555-0000', is_on_biz_app: false }]);
    const r = await svc.conectarConEmbeddedSignup(BIZ, { code: 'c', wabaId: WABA, phoneNumberId: PHONE });
    expect(r).toMatchObject({ coexistencia: false });
    expect(llamadas.some((l) => l.url.includes(`/${PHONE}/register`))).toBe(true);
    expect(llamadas.some((l) => l.url.includes('/smb_app_data'))).toBe(false);
  });
});
