import { createHmac } from 'crypto';
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { WhatsappService, WaWebhookBody } from '../../src/whatsapp/whatsapp.service';
import { ConversationsService } from '../../src/conversations/conversations.service';

// WhatsApp dentro de la bandeja de Mensajes. Cubre lo que si falla se nota
// tarde y en producción: que solo Meta pueda escribir en el webhook (firma),
// que un reintento no duplique mensajes, que un cliente no se mezcle con otro,
// y que la respuesta del dueño no quede guardada si WhatsApp no la mandó.

const SECRET = 'secreto-de-prueba';
const PHONE_ID = '1111';
const BIZ = 'biz-1';

function config(extra: Record<string, string> = {}) {
  const valores: Record<string, string> = {
    WHATSAPP_APP_SECRET: SECRET,
    WHATSAPP_VERIFY_TOKEN: 'verify-123',
    WHATSAPP_TOKEN_KEY: 'clave',
    ...extra,
  };
  return { get: (k: string) => valores[k] } as any;
}

function firmar(body: string, secret = SECRET) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function payload(mensajes: unknown[] = [], statuses: unknown[] = []): WaWebhookBody {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: PHONE_ID },
              contacts: [{ wa_id: '5491122334455', profile: { name: 'Lucía' } }],
              messages: mensajes as any,
              statuses: statuses as any,
            },
          },
        ],
      },
    ],
  };
}

const TEXTO = { id: 'wamid.A', from: '5491122334455', timestamp: '1790000000', type: 'text', text: { body: 'Hola, ¿tenés talle M?' } };

function build(overrides: Record<string, any> = {}) {
  const prisma: any = {
    whatsappConnection: { findUnique: jest.fn().mockResolvedValue({ businessId: BIZ, status: 'ACTIVE' }) },
    message: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue('msg-create'),
      update: jest.fn().mockResolvedValue({}),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'cli-nuevo' }),
      update: jest.fn().mockResolvedValue({}),
    },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'cv-nueva' }),
      update: jest.fn().mockReturnValue('conv-update'),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return { svc: new WhatsappService(prisma, config()), prisma };
}

describe('WhatsappService (unit)', () => {
  describe('verificación y firma del webhook', () => {
    it('devuelve el challenge solo con el verify token correcto', () => {
      const { svc } = build();
      expect(svc.verificarSuscripcion('subscribe', 'verify-123', 'abc')).toBe('abc');
      expect(svc.verificarSuscripcion('subscribe', 'otro', 'abc')).toBeNull();
      expect(svc.verificarSuscripcion('unsubscribe', 'verify-123', 'abc')).toBeNull();
      expect(svc.verificarSuscripcion(undefined, undefined, undefined)).toBeNull();
    });

    it('acepta la firma del App Secret y rechaza cualquier otra', () => {
      const { svc } = build();
      const body = JSON.stringify(payload([TEXTO]));
      expect(svc.firmaValida(Buffer.from(body), firmar(body))).toBe(true);
      expect(svc.firmaValida(Buffer.from(body), firmar(body, 'otro-secreto'))).toBe(false);
      expect(svc.firmaValida(Buffer.from(body + ' '), firmar(body))).toBe(false); // body alterado
      expect(svc.firmaValida(Buffer.from(body), undefined)).toBe(false);
      expect(svc.firmaValida(undefined, firmar(body))).toBe(false);
    });

    it('sin App Secret configurado rechaza todo en vez de aceptar sin firma', () => {
      const svc = new WhatsappService({} as any, { get: () => undefined } as any);
      expect(() => svc.firmaValida(Buffer.from('{}'), 'sha256=00')).toThrow();
    });
  });

  describe('mensajes entrantes', () => {
    it('crea cliente, conversación y mensaje WHATSAPP, y deja la conversación sin leer', async () => {
      const { svc, prisma } = build();
      await svc.procesarWebhook(payload([TEXTO]));

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { businessId: BIZ, firstName: 'Lucía', phone: '+5491122334455', whatsappId: '5491122334455' },
        select: { id: true },
      });
      expect(prisma.conversation.create).toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'cv-nueva',
          sender: 'CUSTOMER',
          text: 'Hola, ¿tenés talle M?',
          channel: 'WHATSAPP',
          externalId: 'wamid.A',
        }),
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cv-nueva' }, data: expect.objectContaining({ isUnread: true }) }),
      );
    });

    it('un reintento de Meta (mismo wamid) no guarda el mensaje dos veces', async () => {
      const { svc, prisma } = build();
      prisma.message.findUnique.mockResolvedValue({ id: 'ya-existe' });
      await svc.procesarWebhook(payload([TEXTO]));
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('reusa al cliente que ya tiene ese wa_id y la conversación existente', async () => {
      const { svc, prisma } = build();
      prisma.customer.findUnique.mockResolvedValue({ id: 'cli-1', deletedAt: null });
      prisma.conversation.findFirst.mockResolvedValue({ id: 'cv-1' });
      await svc.procesarWebhook(payload([TEXTO]));
      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.conversation.create).not.toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ conversationId: 'cv-1' }) });
    });

    it('vincula al cliente existente cuando el teléfono coincide con UNO solo', async () => {
      const { svc, prisma } = build();
      prisma.$queryRaw.mockResolvedValue([{ id: 'cli-tienda' }]);
      await svc.procesarWebhook(payload([TEXTO]));
      expect(prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'cli-tienda' }, data: { whatsappId: '5491122334455' } });
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('si el teléfono coincide con VARIOS clientes no mezcla: crea uno nuevo', async () => {
      const { svc, prisma } = build();
      prisma.$queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      await svc.procesarWebhook(payload([TEXTO]));
      expect(prisma.customer.update).not.toHaveBeenCalled();
      expect(prisma.customer.create).toHaveBeenCalled();
    });

    it('no resucita a un cliente eliminado', async () => {
      const { svc, prisma } = build();
      prisma.customer.findUnique.mockResolvedValue({ id: 'cli-borrado', deletedAt: new Date() });
      await svc.procesarWebhook(payload([TEXTO]));
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('ignora eventos de un número sin conexión activa', async () => {
      const { svc, prisma } = build();
      prisma.whatsappConnection.findUnique.mockResolvedValue({ businessId: BIZ, status: 'DISCONNECTED' });
      await svc.procesarWebhook(payload([TEXTO]));
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('las reacciones no son mensajes; las imágenes quedan con una etiqueta', async () => {
      const { svc, prisma } = build();
      await svc.procesarWebhook(payload([{ ...TEXTO, id: 'w1', type: 'reaction', text: undefined }]));
      expect(prisma.message.create).not.toHaveBeenCalled();

      await svc.procesarWebhook(payload([{ ...TEXTO, id: 'w2', type: 'image', text: undefined, image: { caption: 'así lo quiero' } }]));
      expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ text: '[Imagen] así lo quiero' }) });
    });

    it('un mensaje que falla no corta a los siguientes', async () => {
      const { svc, prisma } = build();
      prisma.customer.create.mockRejectedValueOnce(new Error('boom'));
      await svc.procesarWebhook(payload([TEXTO, { ...TEXTO, id: 'wamid.B' }]));
      expect(prisma.customer.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('negocios habilitados', () => {
    function conLista(valores: Record<string, string>, negocio: { subdomain: string } | null = { subdomain: 'mitienda' }) {
      const prisma: any = { business: { findUnique: jest.fn().mockResolvedValue(negocio) } };
      return new WhatsappService(prisma, { get: (k: string) => valores[k] } as any);
    }

    it('en producción sin lista no habilita a nadie', async () => {
      await expect(conLista({ NODE_ENV: 'production' }).asegurarHabilitado(BIZ)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('fuera de producción sin lista habilita a todos (para poder probar)', async () => {
      await expect(conLista({}).asegurarHabilitado(BIZ)).resolves.toBeUndefined();
    });

    it('con lista, solo pasa el subdominio listado (sin importar mayúsculas ni espacios)', async () => {
      const lista = { WHATSAPP_NEGOCIOS_HABILITADOS: ' Otra , MiTienda ', NODE_ENV: 'production' };
      await expect(conLista(lista).asegurarHabilitado(BIZ)).resolves.toBeUndefined();
      await expect(conLista(lista, { subdomain: 'ajena' }).asegurarHabilitado(BIZ)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(conLista(lista, null).asegurarHabilitado(BIZ)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('estados de entrega', () => {
    it('avanza sent → delivered → read y nunca retrocede', async () => {
      const { svc, prisma } = build();
      prisma.message.findUnique.mockResolvedValue({ id: 'm1', deliveryStatus: 'read' });
      await svc.procesarWebhook(payload([], [{ id: 'wamid.X', status: 'delivered' }]));
      expect(prisma.message.update).not.toHaveBeenCalled();

      prisma.message.findUnique.mockResolvedValue({ id: 'm1', deliveryStatus: 'sent' });
      await svc.procesarWebhook(payload([], [{ id: 'wamid.X', status: 'read' }]));
      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { deliveryStatus: 'read' } });
    });

    it('un failed siempre se registra', async () => {
      const { svc, prisma } = build();
      prisma.message.findUnique.mockResolvedValue({ id: 'm1', deliveryStatus: 'sent' });
      await svc.procesarWebhook(payload([], [{ id: 'wamid.X', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement' }] }]));
      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { deliveryStatus: 'failed' } });
    });
  });

  describe('envío', () => {
    it('rechaza responder pasadas las 24 h del último mensaje del cliente, sin llamar a Meta', async () => {
      const { svc, prisma } = build();
      const fetchSpy = jest.spyOn(global, 'fetch');
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 25 * 3600_000) });
      await expect(svc.enviarTexto(BIZ, 'cv-1', '5491122334455', 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('rechaza si el cliente nunca escribió por WhatsApp', async () => {
      const { svc } = build();
      await expect(svc.enviarTexto(BIZ, 'cv-1', '5491122334455', 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('sin conexión activa avisa que WhatsApp no está conectado', async () => {
      const { svc, prisma } = build();
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date() });
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(svc.enviarTexto(BIZ, 'cv-1', '5491122334455', 'hola')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('dentro de la ventana manda el texto a Meta y devuelve el wamid', async () => {
      const { svc, prisma } = build();
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date() });
      prisma.$queryRaw.mockResolvedValue([{ phone_number_id: PHONE_ID, waba_id: '9', access_token: 'tok' }]);
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ id: 'wamid.OUT' }] }),
      } as any);
      await expect(svc.enviarTexto(BIZ, 'cv-1', '5491122334455', 'hola')).resolves.toBe('wamid.OUT');
      const [url, init] = fetchSpy.mock.calls[0] as [string, any];
      expect(url).toContain(`/${PHONE_ID}/messages`);
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(JSON.parse(init.body)).toMatchObject({ to: '5491122334455', type: 'text', text: { body: 'hola' } });
      fetchSpy.mockRestore();
    });

    it('en Argentina reintenta sin el 9 cuando Meta dice que el destinatario no está permitido (131030)', async () => {
      const { svc, prisma } = build();
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date() });
      prisma.$queryRaw.mockResolvedValue([{ phone_number_id: PHONE_ID, waba_id: '9', access_token: 'tok' }]);
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { code: 131030, message: 'not in allowed list' } }) } as any)
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.OK' }] }) } as any);
      await expect(svc.enviarTexto(BIZ, 'cv-1', '5491122334455', 'hola')).resolves.toBe('wamid.OK');
      expect(JSON.parse((fetchSpy.mock.calls[1] as [string, any])[1].body).to).toBe('541122334455');
      fetchSpy.mockRestore();
    });
  });
});

describe('ConversationsService → lo que ve el cliente en la tienda', () => {
  it('el cliente solo recibe los mensajes del chat de la tienda, no los de WhatsApp', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'cv-1', businessId: BIZ, customerId: 'cli-1' }) },
      message: { findMany },
    };
    const svc = new ConversationsService(prisma, {} as any);
    await svc.myThread(BIZ, 'cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: 'cv-1', channel: 'STOREFRONT' } }));
  });

  it('el panel del negocio sigue viendo todos los canales', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'cv-1', businessId: BIZ, customerId: 'cli-1', isUnread: false }) },
      message: { findMany },
      $executeRaw: jest.fn(),
    };
    const svc = new ConversationsService(prisma, {} as any);
    await svc.getMessages(BIZ, 'cv-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: 'cv-1' } }));
  });
});

describe('ConversationsService → WhatsApp', () => {
  function bandeja(ultimoCanal: 'WHATSAPP' | 'STOREFRONT' | null, enviarTexto: jest.Mock) {
    const prisma: any = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cv-1', businessId: BIZ, customerId: 'cli-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      message: {
        findFirst: jest.fn().mockResolvedValue(ultimoCanal ? { channel: ultimoCanal } : null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm', createdAt: new Date(), orderId: null, deliveryStatus: null, channel: 'STOREFRONT', ...data })),
      },
      customer: { findUnique: jest.fn().mockResolvedValue({ whatsappId: '5491122334455' }) },
    };
    return { svc: new ConversationsService(prisma, { enviarTexto } as any), prisma };
  }

  it('si el cliente escribió por WhatsApp, responde por WhatsApp y guarda el wamid', async () => {
    const enviar = jest.fn().mockResolvedValue('wamid.OUT');
    const { svc, prisma } = bandeja('WHATSAPP', enviar);
    const r = await svc.sendMessage(BIZ, 'cv-1', { text: 'Sí, hay talle M' });
    expect(enviar).toHaveBeenCalledWith(BIZ, 'cv-1', '5491122334455', 'Sí, hay talle M');
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'WHATSAPP', externalId: 'wamid.OUT', deliveryStatus: 'sent' }),
    });
    expect(r.channel).toBe('WHATSAPP');
  });

  it('si WhatsApp rechaza el envío NO queda el mensaje guardado en el hilo', async () => {
    const enviar = jest.fn().mockRejectedValue(new UnprocessableEntityException('ventana vencida'));
    const { svc, prisma } = bandeja('WHATSAPP', enviar);
    await expect(svc.sendMessage(BIZ, 'cv-1', { text: 'hola' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('si el cliente escribió por la tienda, no toca WhatsApp', async () => {
    const enviar = jest.fn();
    const { svc, prisma } = bandeja('STOREFRONT', enviar);
    await svc.sendMessage(BIZ, 'cv-1', { text: 'hola' });
    expect(enviar).not.toHaveBeenCalled();
    expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ channel: 'WHATSAPP' }) });
  });
});
