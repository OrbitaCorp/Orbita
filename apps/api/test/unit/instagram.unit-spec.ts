import { createHmac } from 'crypto';
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { InstagramService, IgWebhookBody } from '../../src/instagram/instagram.service';
import { ConversationsService } from '../../src/conversations/conversations.service';

// Instagram dentro de la bandeja de Mensajes. Cubre lo que si falla se nota
// tarde y en producción: que solo Meta pueda escribir en el webhook (firma), que
// un reintento no duplique mensajes, que el negocio salga del state firmado y no
// de lo que mande el navegador, que la respuesta no quede guardada si Instagram
// no la mandó, y que el token se renueve antes de vencer.

const APP_SECRET = 'secreto-instagram';
const BIZ = 'biz-1';
const IG_CUENTA = '17841400000000000';
const IGSID = '9988776655';

function config(extra: Record<string, string> = {}) {
  const valores: Record<string, string> = {
    INSTAGRAM_APP_ID: '1111',
    INSTAGRAM_APP_SECRET: APP_SECRET,
    INSTAGRAM_VERIFY_TOKEN: 'verify-ig',
    INSTAGRAM_TOKEN_KEY: 'clave',
    JWT_SECRET: 'jwt-secreto',
    ...extra,
  };
  return { get: (k: string) => valores[k] } as any;
}

function firmar(body: string, secret = APP_SECRET) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function mensaje(mid: string, texto: string, extra: Record<string, unknown> = {}) {
  return {
    sender: { id: IGSID },
    recipient: { id: IG_CUENTA },
    timestamp: 1790000000000,
    message: { mid, text: texto },
    ...extra,
  };
}
const evento = (...mensajes: unknown[]): IgWebhookBody => ({ object: 'instagram', entry: [{ id: IG_CUENTA, messaging: mensajes as any }] });

function build(overrides: Record<string, any> = {}, cfg: Record<string, string> = {}) {
  const prisma: any = {
    business: { findUnique: jest.fn().mockResolvedValue({ subdomain: 'mitienda' }) },
    instagramConnection: {
      findUnique: jest.fn().mockResolvedValue({ businessId: BIZ, status: 'ACTIVE' }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    message: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue('msg-create'),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'cli-nuevo' }),
    },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'cv-nueva' }),
      update: jest.fn().mockReturnValue('conv-update'),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return { svc: new InstagramService(prisma, config(cfg)), prisma };
}

function respuesta(json: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => json } as any;
}

describe('InstagramService (unit)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('verificación y firma del webhook', () => {
    it('devuelve el challenge solo con el verify token correcto', () => {
      const { svc } = build();
      expect(svc.verificarSuscripcion('subscribe', 'verify-ig', 'abc')).toBe('abc');
      expect(svc.verificarSuscripcion('subscribe', 'otro', 'abc')).toBeNull();
      expect(svc.verificarSuscripcion('unsubscribe', 'verify-ig', 'abc')).toBeNull();
    });

    it('acepta la firma del App Secret y rechaza cualquier otra', () => {
      const { svc } = build();
      const body = JSON.stringify(evento(mensaje('m1', 'hola')));
      expect(svc.firmaValida(Buffer.from(body), firmar(body))).toBe(true);
      expect(svc.firmaValida(Buffer.from(body), firmar(body, 'otro'))).toBe(false);
      expect(svc.firmaValida(Buffer.from(body + ' '), firmar(body))).toBe(false);
      expect(svc.firmaValida(Buffer.from(body), undefined)).toBe(false);
      expect(svc.firmaValida(undefined, firmar(body))).toBe(false);
    });

    it('sin App Secret configurado rechaza todo en vez de aceptar sin firma', () => {
      const svc = new InstagramService({} as any, { get: () => undefined } as any);
      expect(() => svc.firmaValida(Buffer.from('{}'), 'sha256=00')).toThrow();
    });
  });

  describe('login de Instagram', () => {
    it('la dirección de autorización lleva los permisos, la redirección y un state firmado', () => {
      const { svc } = build();
      const url = new URL(svc.urlDeAutorizacion(BIZ, 'mem-1'));
      expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe('1111');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_manage_messages');
      const [body, sig] = (url.searchParams.get('state') ?? '').split('.');
      expect(JSON.parse(Buffer.from(body, 'base64url').toString()).businessId).toBe(BIZ);
      expect(sig).toBe(createHmac('sha256', 'jwt-secreto').update(body).digest('base64url'));
    });

    it('un state alterado o inventado se rechaza antes de tocar nada', async () => {
      const { svc, prisma } = build();
      const state = new URL(svc.urlDeAutorizacion(BIZ)).searchParams.get('state') as string;
      const otroNegocio = Buffer.from(JSON.stringify({ businessId: 'biz-ajeno', nonce: 'x', exp: Date.now() + 60_000 })).toString('base64url');
      await expect(svc.manejarCallback('code', `${otroNegocio}.${state.split('.')[1]}`)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.manejarCallback('code', 'basura')).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.manejarCallback('code', undefined)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('un state vencido se rechaza', async () => {
      const { svc } = build();
      const body = Buffer.from(JSON.stringify({ businessId: BIZ, nonce: 'x', exp: Date.now() - 1 })).toString('base64url');
      const sig = createHmac('sha256', 'jwt-secreto').update(body).digest('base64url');
      await expect(svc.manejarCallback('code', `${body}.${sig}`)).rejects.toThrow('state expirado');
    });

    it('con code y state válidos guarda el token LARGO cifrado y suscribe la cuenta', async () => {
      const { svc, prisma } = build();
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(respuesta({ data: [{ access_token: 'corto', user_id: IGSID }] })) // code → corto
        .mockResolvedValueOnce(respuesta({ access_token: 'largo', expires_in: 5_184_000 })) // corto → largo
        .mockResolvedValueOnce(respuesta({ id: 'id-app', user_id: IG_CUENTA, username: 'mitienda' })) // /me
        .mockResolvedValueOnce(respuesta({ success: true })); // subscribed_apps
      const state = new URL(svc.urlDeAutorizacion(BIZ)).searchParams.get('state') as string;

      const r = await svc.manejarCallback('code-1', state);

      expect(r).toEqual({ businessId: BIZ, subdomain: 'mitienda', suscripta: true });
      const urls = fetchSpy.mock.calls.map((c) => c[0] as string);
      expect(urls[0]).toBe('https://api.instagram.com/oauth/access_token');
      expect(urls[1]).toContain('ig_exchange_token');
      expect(urls[3]).toContain('/me/subscribed_apps');
      // el id que se guarda es el de la cuenta profesional (el de los webhooks), no el de la app
      const valores = prisma.$executeRaw.mock.calls[0].slice(1);
      expect(valores).toContain(IG_CUENTA);
      expect(valores).toContain('largo');
      expect(valores).not.toContain('corto');
    });

    it('si falla la suscripción igual conecta, pero lo informa', async () => {
      const { svc } = build();
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(respuesta({ access_token: 'corto' }))
        .mockResolvedValueOnce(respuesta({ access_token: 'largo', expires_in: 5_184_000 }))
        .mockResolvedValueOnce(respuesta({ user_id: IG_CUENTA, username: 'mitienda' }))
        .mockResolvedValueOnce(respuesta({ error: { message: 'no', code: 10 } }, false, 400));
      const state = new URL(svc.urlDeAutorizacion(BIZ)).searchParams.get('state') as string;
      await expect(svc.manejarCallback('code-1', state)).resolves.toMatchObject({ suscripta: false });
    });
  });

  describe('mensajes entrantes', () => {
    it('crea cliente, conversación y mensaje INSTAGRAM, y deja la conversación sin leer', async () => {
      const { svc, prisma } = build();
      await svc.procesarWebhook(evento(mensaje('mid.A', 'Hola, ¿tienen talle M?')));

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessId: BIZ, instagramId: IGSID }),
        select: { id: true },
      });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'cv-nueva',
          sender: 'CUSTOMER',
          text: 'Hola, ¿tienen talle M?',
          channel: 'INSTAGRAM',
          externalId: 'mid.A',
        }),
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cv-nueva' }, data: expect.objectContaining({ isUnread: true }) }),
      );
    });

    it('resuelve el negocio por la cuenta del evento: una cuenta sin conexión activa se ignora', async () => {
      const { svc, prisma } = build();
      prisma.instagramConnection.findUnique.mockResolvedValue({ businessId: BIZ, status: 'DISCONNECTED' });
      await svc.procesarWebhook(evento(mensaje('mid.A', 'hola')));
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('un reintento de Meta (mismo mid) no guarda el mensaje dos veces', async () => {
      const { svc, prisma } = build();
      prisma.message.findUnique.mockResolvedValue({ id: 'ya-existe' });
      await svc.procesarWebhook(evento(mensaje('mid.A', 'hola')));
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('reusa al cliente con ese IGSID y la conversación existente', async () => {
      const { svc, prisma } = build();
      prisma.customer.findUnique.mockResolvedValue({ id: 'cli-1', deletedAt: null });
      prisma.conversation.findFirst.mockResolvedValue({ id: 'cv-1' });
      await svc.procesarWebhook(evento(mensaje('mid.A', 'hola')));
      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ conversationId: 'cv-1' }) });
    });

    it('no resucita a un cliente eliminado', async () => {
      const { svc, prisma } = build();
      prisma.customer.findUnique.mockResolvedValue({ id: 'cli-borrado', deletedAt: new Date() });
      await svc.procesarWebhook(evento(mensaje('mid.A', 'hola')));
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('el eco (lo que el dueño contestó desde la app de Instagram) entra como mensaje de la tienda y NO marca sin leer', async () => {
      const { svc, prisma } = build();
      prisma.customer.findUnique.mockResolvedValue({ id: 'cli-1', deletedAt: null });
      prisma.conversation.findFirst.mockResolvedValue({ id: 'cv-1' });
      await svc.procesarWebhook(
        evento({ sender: { id: IG_CUENTA }, recipient: { id: IGSID }, timestamp: 1790000000000, message: { mid: 'mid.E', text: 'te respondo', is_echo: true } }),
      );
      expect(prisma.customer.findUnique).toHaveBeenCalledWith({ where: { businessId_instagramId: { businessId: BIZ, instagramId: IGSID } }, select: { id: true, deletedAt: true } });
      expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sender: 'STORE', channel: 'INSTAGRAM', externalId: 'mid.E' }) });
      expect(prisma.conversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ isUnread: true }) }));
    });

    it('los adjuntos quedan con una etiqueta y los mensajes borrados se ignoran', async () => {
      const { svc, prisma } = build();
      await svc.procesarWebhook(evento({ ...mensaje('mid.F', ''), message: { mid: 'mid.F', attachments: [{ type: 'image' }] } }));
      expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ text: '[Imagen]' }) });
      prisma.message.create.mockClear();
      await svc.procesarWebhook(evento({ ...mensaje('mid.G', ''), message: { mid: 'mid.G', is_deleted: true } }));
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('un mensaje que falla no corta a los siguientes', async () => {
      const { svc, prisma } = build();
      prisma.customer.create.mockRejectedValueOnce(new Error('boom'));
      await svc.procesarWebhook(evento(mensaje('mid.A', 'uno'), mensaje('mid.B', 'dos')));
      expect(prisma.customer.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('envío', () => {
    it('rechaza responder pasadas las 24 h, sin llamar a Instagram', async () => {
      const { svc, prisma } = build();
      const fetchSpy = jest.spyOn(global, 'fetch');
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 25 * 3600_000) });
      await expect(svc.enviarTexto(BIZ, 'cv-1', IGSID, 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rechaza un texto de más de 1000 bytes antes de llamar a Instagram (el límite de su API)', async () => {
      const { svc, prisma } = build();
      const fetchSpy = jest.spyOn(global, 'fetch');
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date() });
      await expect(svc.enviarTexto(BIZ, 'cv-1', IGSID, 'á'.repeat(600))).rejects.toBeInstanceOf(BadRequestException); // 1200 bytes
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rechaza si el cliente nunca escribió por Instagram', async () => {
      const { svc } = build();
      await expect(svc.enviarTexto(BIZ, 'cv-1', IGSID, 'hola')).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('sin conexión activa avisa que Instagram no está conectado', async () => {
      const { svc, prisma } = build();
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date() });
      await expect(svc.enviarTexto(BIZ, 'cv-1', IGSID, 'hola')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('dentro de la ventana manda el texto y devuelve el id del mensaje', async () => {
      const { svc, prisma } = build();
      prisma.message.findFirst.mockResolvedValue({ createdAt: new Date() });
      prisma.$queryRaw.mockResolvedValue([{ ig_user_id: IG_CUENTA, access_token: 'tok' }]);
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(respuesta({ message_id: 'mid.OUT', recipient_id: IGSID }));
      await expect(svc.enviarTexto(BIZ, 'cv-1', IGSID, 'hola')).resolves.toBe('mid.OUT');
      const [url, init] = fetchSpy.mock.calls[0] as [string, any];
      expect(url).toContain(`/${IG_CUENTA}/messages`);
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(JSON.parse(init.body)).toEqual({ recipient: { id: IGSID }, message: { text: 'hola' } });
    });
  });

  describe('desautorización', () => {
    const signed = (payload: object, secret = APP_SECRET) => {
      const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${createHmac('sha256', secret).update(p).digest('base64url')}.${p}`;
    };

    it('con firma válida corta la conexión y borra el token', async () => {
      const { svc, prisma } = build();
      await svc.desautorizar(signed({ user_id: IG_CUENTA }));
      expect(prisma.instagramConnection.findUnique).toHaveBeenCalledWith({ where: { igUserId: IG_CUENTA }, select: { businessId: true } });
      expect(prisma.instagramConnection.update).toHaveBeenCalledWith({
        where: { businessId: BIZ },
        data: { status: 'DISCONNECTED', accessToken: '' },
      });
    });

    it('con firma inválida no toca nada', async () => {
      const { svc, prisma } = build();
      await expect(svc.desautorizar(signed({ user_id: IG_CUENTA }, 'otro'))).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.desautorizar('basura')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.instagramConnection.update).not.toHaveBeenCalled();
    });
  });

  describe('renovación del token', () => {
    it('renueva los que vencen pronto y guarda el nuevo vencimiento', async () => {
      const { svc, prisma } = build();
      prisma.instagramConnection.findMany.mockResolvedValue([{ businessId: BIZ }]);
      prisma.$queryRaw.mockResolvedValue([{ ig_user_id: IG_CUENTA, access_token: 'viejo' }]);
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(respuesta({ access_token: 'nuevo', expires_in: 5_184_000 }));
      await expect(svc.renovarTokens()).resolves.toEqual({ renovadas: 1, desconectadas: 0, fallidas: 0 });
      expect(fetchSpy.mock.calls[0][0]).toContain('refresh_access_token');
      expect(prisma.$executeRaw.mock.calls[0].slice(1)).toContain('nuevo');
    });

    it('si Instagram rechaza el token marca la conexión como desconectada', async () => {
      const { svc, prisma } = build();
      prisma.instagramConnection.findMany.mockResolvedValue([{ businessId: BIZ }]);
      prisma.$queryRaw.mockResolvedValue([{ ig_user_id: IG_CUENTA, access_token: 'viejo' }]);
      jest.spyOn(global, 'fetch').mockResolvedValue(respuesta({ error: { message: 'Session expired', code: 190, type: 'OAuthException' } }, false, 400));
      await expect(svc.renovarTokens()).resolves.toEqual({ renovadas: 0, desconectadas: 1, fallidas: 0 });
      expect(prisma.instagramConnection.update).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { status: 'DISCONNECTED', accessToken: '' } });
    });

    it('un error pasajero (red, 5xx) no desconecta: queda para la noche siguiente', async () => {
      const { svc, prisma } = build();
      prisma.instagramConnection.findMany.mockResolvedValue([{ businessId: BIZ }]);
      prisma.$queryRaw.mockResolvedValue([{ ig_user_id: IG_CUENTA, access_token: 'viejo' }]);
      jest.spyOn(global, 'fetch').mockResolvedValue(respuesta({ error: { message: 'down' } }, false, 503));
      await expect(svc.renovarTokens()).resolves.toEqual({ renovadas: 0, desconectadas: 0, fallidas: 1 });
      expect(prisma.instagramConnection.update).not.toHaveBeenCalled();
    });
  });

  describe('negocios habilitados', () => {
    it('en producción sin lista no habilita a nadie; con lista, solo al subdominio listado', async () => {
      await expect(build({}, { NODE_ENV: 'production' }).svc.asegurarHabilitado(BIZ)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(build({}, {}).svc.asegurarHabilitado(BIZ)).resolves.toBeUndefined();
      const lista = { INSTAGRAM_NEGOCIOS_HABILITADOS: ' Otra , MiTienda ', NODE_ENV: 'production' };
      await expect(build({}, lista).svc.asegurarHabilitado(BIZ)).resolves.toBeUndefined();
      const ajeno = build({ business: { findUnique: jest.fn().mockResolvedValue({ subdomain: 'ajena' }) } }, lista);
      await expect(ajeno.svc.asegurarHabilitado(BIZ)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

describe('ConversationsService → Instagram', () => {
  function bandeja(ultimoCanal: 'INSTAGRAM' | 'STOREFRONT' | 'WHATSAPP', enviar: jest.Mock) {
    const prisma: any = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cv-1', businessId: BIZ, customerId: 'cli-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      message: {
        findFirst: jest.fn().mockResolvedValue({ channel: ultimoCanal }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm', createdAt: new Date(), orderId: null, deliveryStatus: null, channel: 'STOREFRONT', ...data })),
      },
      customer: { findUnique: jest.fn().mockResolvedValue({ instagramId: IGSID, whatsappId: '549' }) },
    };
    return { svc: new ConversationsService(prisma, { enviarTexto: jest.fn() } as any, { enviarTexto: enviar } as any), prisma };
  }

  it('si el cliente escribió por Instagram, responde por Instagram y guarda el id del mensaje', async () => {
    const enviar = jest.fn().mockResolvedValue('mid.OUT');
    const { svc, prisma } = bandeja('INSTAGRAM', enviar);
    const r = await svc.sendMessage(BIZ, 'cv-1', { text: 'Sí, hay' });
    expect(enviar).toHaveBeenCalledWith(BIZ, 'cv-1', IGSID, 'Sí, hay');
    expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ channel: 'INSTAGRAM', externalId: 'mid.OUT', deliveryStatus: 'sent' }) });
    expect(r.channel).toBe('INSTAGRAM');
  });

  it('si Instagram rechaza el envío NO queda el mensaje guardado', async () => {
    const enviar = jest.fn().mockRejectedValue(new UnprocessableEntityException('ventana vencida'));
    const { svc, prisma } = bandeja('INSTAGRAM', enviar);
    await expect(svc.sendMessage(BIZ, 'cv-1', { text: 'hola' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('si el cliente escribió por la tienda, no toca Instagram', async () => {
    const enviar = jest.fn();
    const { svc } = bandeja('STOREFRONT', enviar);
    await svc.sendMessage(BIZ, 'cv-1', { text: 'hola' });
    expect(enviar).not.toHaveBeenCalled();
  });
});
