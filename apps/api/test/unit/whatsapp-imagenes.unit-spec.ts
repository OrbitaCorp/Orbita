import { BadRequestException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { WhatsappMediosService } from '../../src/whatsapp/whatsapp-medios.service';
import { WhatsappService, type WaWebhookBody } from '../../src/whatsapp/whatsapp.service';
import { ConversationsService } from '../../src/conversations/conversations.service';

// Imágenes en WhatsApp: las que mandan los clientes se bajan de Meta y se ven en el chat, las que manda el negocio salen
// por la API y quedan guardadas, y todo lo que no sea una foto sigue entrando como etiqueta.

const BIZ = 'biz-1';
const PHONE = '555666777';
const WA_ID = '5491122334455';

const png = (ancho = 40, alto = 30) =>
  sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 200, g: 40, b: 40 } } }).png().toBuffer();

function respuesta(json: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => json, arrayBuffer: async () => new ArrayBuffer(0) } as any;
}

// ─── Mensajes entrantes con foto ─────────────────────────────────────────────

function armarWebhook(opciones: { urlDeMeta?: string | null; guardada?: string | null } = {}) {
  const prisma: any = {
    whatsappConnection: { findUnique: jest.fn().mockResolvedValue({ businessId: BIZ, status: 'ACTIVE' }) },
    message: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockReturnValue('msg') },
    customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cli-1', deletedAt: null }) },
    conversation: { findFirst: jest.fn().mockResolvedValue({ id: 'cv-1' }), update: jest.fn().mockReturnValue('upd'), create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ phone_number_id: PHONE, waba_id: 'w', access_token: 'tok-negocio' }]),
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const medios: any = { guardarImagenDeMeta: jest.fn().mockResolvedValue(opciones.guardada === undefined ? 'https://almacen/chats/a.jpg' : opciones.guardada) };
  const config: any = { get: (k: string) => ({ WHATSAPP_TOKEN_KEY: 'clave', WHATSAPP_APP_SECRET: 's' } as Record<string, string>)[k] };
  const svc = new WhatsappService(prisma, config, medios);
  const llamadas: string[] = []
  jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
    llamadas.push(String(url));
    return respuesta(opciones.urlDeMeta === null ? {} : { url: opciones.urlDeMeta ?? 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1' });
  }) as any);
  return { svc, prisma, medios, llamadas };
}

const cambio = (mensajes: unknown[]): WaWebhookBody => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: PHONE }, contacts: [{ wa_id: WA_ID, profile: { name: 'Ana' } }], messages: mensajes as any } }] }],
});
const foto = (extra: Record<string, unknown> = {}) => ({ id: 'wamid.F1', from: WA_ID, timestamp: '1790000000', type: 'image', image: { id: 'media-1', mime_type: 'image/jpeg' }, ...extra });

describe('fotos que mandan los clientes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('se baja de Meta con el token del negocio, se guarda y queda como adjunto del mensaje', async () => {
    const { svc, prisma, medios, llamadas } = armarWebhook();
    await svc.procesarWebhook(cambio([foto()]));
    expect(llamadas[0]).toMatch(/\/media-1$/);
    expect(medios.guardarImagenDeMeta).toHaveBeenCalledWith(BIZ, 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1', 'tok-negocio');
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sender: 'CUSTOMER', channel: 'WHATSAPP', text: '[Imagen]', attachments: [{ tipo: 'image', url: 'https://almacen/chats/a.jpg' }] }),
    });
  });

  it('el pie de foto del cliente es el texto del mensaje (sin el "[Imagen]" delante)', async () => {
    const { svc, prisma } = armarWebhook();
    await svc.procesarWebhook(cambio([foto({ image: { id: 'media-1', caption: 'Quiero este talle' } })]));
    expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ text: 'Quiero este talle', attachments: expect.any(Array) }) });
  });

  it('si no se pudo guardar la foto, el mensaje entra igual como etiqueta (no se pierde)', async () => {
    const { svc, prisma } = armarWebhook({ guardada: null });
    await svc.procesarWebhook(cambio([foto({ image: { id: 'media-1', caption: 'mirá' } })]));
    const { data } = prisma.message.create.mock.calls[0][0];
    expect(data.text).toBe('[Imagen] mirá');
    expect(data).not.toHaveProperty('attachments');
  });

  it('si Meta no da la dirección de la foto, también entra como etiqueta', async () => {
    const { svc, prisma, medios } = armarWebhook({ urlDeMeta: null });
    await svc.procesarWebhook(cambio([foto()]));
    expect(medios.guardarImagenDeMeta).not.toHaveBeenCalled();
    expect(prisma.message.create.mock.calls[0][0].data).not.toHaveProperty('attachments');
  });

  it('audio, video y documentos siguen entrando solo como etiqueta (solo se ven fotos)', async () => {
    const { svc, prisma, medios } = armarWebhook();
    await svc.procesarWebhook(cambio([
      { id: 'wamid.A', from: WA_ID, timestamp: '1', type: 'audio' },
      { id: 'wamid.V', from: WA_ID, timestamp: '2', type: 'video', video: { id: 'v1' } },
    ]));
    expect(medios.guardarImagenDeMeta).not.toHaveBeenCalled();
    expect(prisma.message.create.mock.calls.map((c: any[]) => c[0].data.text)).toEqual(['[Audio]', '[Video]']);
  });

  it('una foto que el dueño manda desde el celular (coexistencia) también se ve', async () => {
    const { svc, prisma } = armarWebhook();
    await svc.procesarWebhook({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'smb_message_echoes', value: { metadata: { phone_number_id: PHONE }, message_echoes: [{ from: '5491100000000', to: WA_ID, id: 'wamid.E1', timestamp: '1790000000', type: 'image', image: { id: 'media-2', caption: 'Así queda' } }] } as any }] }],
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sender: 'STORE', text: 'Así queda', attachments: [{ tipo: 'image', url: 'https://almacen/chats/a.jpg' }] }),
    });
  });
});

// ─── Foto que manda el negocio ───────────────────────────────────────────────

describe('enviarImagen', () => {
  afterEach(() => jest.restoreAllMocks());

  function armar(ultimoDelCliente: Date | null) {
    const prisma: any = {
      message: { findFirst: jest.fn().mockResolvedValue(ultimoDelCliente ? { createdAt: ultimoDelCliente } : null) },
      $queryRaw: jest.fn().mockResolvedValue([{ phone_number_id: PHONE, waba_id: 'w', access_token: 'tok-negocio' }]),
    };
    const svc = new WhatsappService(prisma, { get: (k: string) => ({ WHATSAPP_TOKEN_KEY: 'clave' } as Record<string, string>)[k] } as any);
    const cuerpos: any[] = [];
    jest.spyOn(global, 'fetch').mockImplementation((async (_url: string, init: any) => {
      cuerpos.push(JSON.parse(init.body));
      return respuesta({ messages: [{ id: 'wamid.OUT' }] });
    }) as any);
    return { svc, cuerpos };
  }

  it('manda la imagen por su dirección pública con el pie de foto, y devuelve el id del mensaje', async () => {
    const { svc, cuerpos } = armar(new Date());
    await expect(svc.enviarImagen(BIZ, 'cv-1', WA_ID, 'https://almacen/chats/a.jpg', '  Mirá  ')).resolves.toBe('wamid.OUT');
    expect(cuerpos[0]).toMatchObject({ messaging_product: 'whatsapp', to: WA_ID, type: 'image', image: { link: 'https://almacen/chats/a.jpg', caption: 'Mirá' } });
  });

  it('sin pie de foto no manda el campo', async () => {
    const { svc, cuerpos } = armar(new Date());
    await svc.enviarImagen(BIZ, 'cv-1', WA_ID, 'https://almacen/chats/a.jpg');
    expect(cuerpos[0].image).toEqual({ link: 'https://almacen/chats/a.jpg' });
  });

  it('pasadas 24 horas del último mensaje del cliente no se manda (regla de WhatsApp)', async () => {
    const { svc, cuerpos } = armar(new Date(Date.now() - 25 * 3600_000));
    await expect(svc.enviarImagen(BIZ, 'cv-1', WA_ID, 'https://almacen/chats/a.jpg')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(cuerpos).toHaveLength(0);
  });
});

// ─── Almacenamiento de las fotos ─────────────────────────────────────────────

function armarMedios() {
  const upload = jest.fn().mockResolvedValue({ error: null });
  const storage = {
    createBucket: jest.fn().mockResolvedValue({ error: null }),
    from: jest.fn().mockReturnValue({ upload, getPublicUrl: (ruta: string) => ({ data: { publicUrl: `https://almacen/${ruta}` } }) }),
  };
  const svc = new WhatsappMediosService({ adminClient: { storage } } as any);
  return { svc, upload, storage };
}
const archivo = (buffer: Buffer, mimetype = 'image/png', size = buffer.length) => ({ buffer, mimetype, size }) as Express.Multer.File;

describe('WhatsappMediosService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('prepararFotoDeProducto', () => {
    const SUPA = 'https://proyecto.supabase.co/storage/v1/object/public/products/b/p/uno.webp';
    const armarProducto = (fetchMock: jest.Mock) => {
      const t = armarMedios();
      process.env.SUPABASE_URL = 'https://proyecto.supabase.co';
      jest.spyOn(global, 'fetch').mockImplementation(fetchMock as never);
      return t;
    };

    it('baja la foto del catálogo, la convierte a JPEG, la guarda con una ruta que sale de la original y devuelve su dirección', async () => {
      const original = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#cc3333' } }).webp().toBuffer();
      const fetchMock = jest.fn().mockImplementation(async (_u: unknown, init?: { method?: string }) =>
        init?.method === 'HEAD' ? { ok: false } : { ok: true, arrayBuffer: async () => original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength) });
      const { svc, upload } = armarProducto(fetchMock);
      const url = await svc.prepararFotoDeProducto(BIZ, SUPA);
      expect(url).toMatch(new RegExp(`^https://almacen/${BIZ}/productos/[0-9a-f]{40}\\.jpg$`));
      const [ruta, cuerpo, opts] = upload.mock.calls[0];
      expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: false });
      expect((await sharp(cuerpo).metadata()).format).toBe('jpeg');
      // La misma foto da la misma ruta.
      await svc.prepararFotoDeProducto(BIZ, SUPA);
      expect(upload.mock.calls[1][0]).toBe(ruta);
    });

    it('si la foto ya está convertida, la reutiliza sin bajarla ni subirla otra vez', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      const { svc, upload } = armarProducto(fetchMock);
      const url = await svc.prepararFotoDeProducto(BIZ, SUPA);
      expect(url).toContain('/productos/');
      expect(upload).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('solo baja fotos de nuestro almacenamiento: ni otro servidor ni http', async () => {
      const fetchMock = jest.fn();
      const { svc, upload } = armarProducto(fetchMock);
      await expect(svc.prepararFotoDeProducto(BIZ, 'https://otro-sitio.com/x.webp')).resolves.toBeNull();
      await expect(svc.prepararFotoDeProducto(BIZ, 'http://proyecto.supabase.co/x.webp')).resolves.toBeNull();
      await expect(svc.prepararFotoDeProducto(BIZ, 'https://proyecto.supabase.co.malo.com/x.webp')).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(upload).not.toHaveBeenCalled();
    });

    it('si la descarga falla devuelve null (la foto es un extra, no rompe la respuesta)', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: false });
      const { svc } = armarProducto(fetchMock);
      await expect(svc.prepararFotoDeProducto(BIZ, SUPA)).resolves.toBeNull();
    });
  });

  describe('prepararFotoDelPanel', () => {
    it('guarda la foto como JPEG en la carpeta de chats del negocio y devuelve su dirección', async () => {
      const { svc, upload } = armarMedios();
      const url = await svc.prepararFotoDelPanel(BIZ, archivo(await png()));
      expect(url).toMatch(new RegExp(`^https://almacen/${BIZ}/chats/[0-9a-f-]+\\.jpg$`));
      const [ruta, contenido, opciones] = upload.mock.calls[0];
      expect(ruta).toMatch(/\.jpg$/);
      expect(opciones.contentType).toBe('image/jpeg');
      expect((await sharp(contenido).metadata()).format).toBe('jpeg');
    });

    it('una foto enorme se achica a 2048 px', async () => {
      const { svc, upload } = armarMedios();
      await svc.prepararFotoDelPanel(BIZ, archivo(await png(4000, 3000)));
      const meta = await sharp(upload.mock.calls[0][1]).metadata();
      expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2048);
    });

    it('rechaza lo que no es una foto, lo que pesa de más y lo que no se puede leer', async () => {
      const { svc, upload } = armarMedios();
      await expect(svc.prepararFotoDelPanel(BIZ, undefined)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.prepararFotoDelPanel(BIZ, archivo(Buffer.from('x'), 'application/pdf'))).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.prepararFotoDelPanel(BIZ, archivo(Buffer.from('x'), 'image/png', 11 * 1024 * 1024))).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.prepararFotoDelPanel(BIZ, archivo(Buffer.from('no es una imagen')))).rejects.toBeInstanceOf(BadRequestException);
      expect(upload).not.toHaveBeenCalled();
    });
  });

  describe('guardarImagenDeMeta', () => {
    const conFetch = (cuerpo: Buffer, ok = true) =>
      jest.spyOn(global, 'fetch').mockImplementation((async () => ({ ok, status: ok ? 200 : 404, arrayBuffer: async () => cuerpo.buffer.slice(cuerpo.byteOffset, cuerpo.byteOffset + cuerpo.byteLength) })) as any);

    it('baja la foto con el token del negocio y la guarda', async () => {
      const { svc, upload } = armarMedios();
      const f = conFetch(await png());
      const url = await svc.guardarImagenDeMeta(BIZ, 'https://lookaside.fbsbx.com/x?mid=1', 'tok-negocio');
      expect(url).toMatch(new RegExp(`^https://almacen/${BIZ}/chats/`));
      expect((f.mock.calls[0][1] as any).headers.Authorization).toBe('Bearer tok-negocio');
      expect(upload).toHaveBeenCalledTimes(1);
    });

    it('solo baja de direcciones https de Meta (nunca de cualquier lado, ni mandando el token)', async () => {
      const { svc } = armarMedios();
      const f = conFetch(await png());
      for (const url of ['http://lookaside.fbsbx.com/x', 'https://evil.example/x', 'https://fbsbx.com.evil.example/x', 'https://localhost/x', 'no es una url']) {
        await expect(svc.guardarImagenDeMeta(BIZ, url, 'tok')).resolves.toBeNull();
      }
      expect(f).not.toHaveBeenCalled();
    });

    it('si Meta responde un error o lo que llega no es una imagen, devuelve null en vez de tirar', async () => {
      const { svc, upload } = armarMedios();
      conFetch(await png(), false);
      await expect(svc.guardarImagenDeMeta(BIZ, 'https://lookaside.fbsbx.com/x', 'tok')).resolves.toBeNull();
      conFetch(Buffer.from('basura'));
      await expect(svc.guardarImagenDeMeta(BIZ, 'https://lookaside.fbsbx.com/x', 'tok')).resolves.toBeNull();
      expect(upload).not.toHaveBeenCalled();
    });
  });
});

// ─── Desde la bandeja de conversaciones ──────────────────────────────────────

describe('ConversationsService.enviarImagen', () => {
  const CONV = { id: 'cv-1', businessId: BIZ, customerId: 'cli-1', isUnread: true };

  function armar(opciones: { whatsappId?: string | null; ultimoDelCliente?: string | null } = {}) {
    const whatsapp: any = {
      prepararFoto: jest.fn().mockResolvedValue('https://almacen/chats/a.jpg'),
      enviarImagen: jest.fn().mockResolvedValue('wamid.OUT'),
    };
    const prisma: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue(CONV), update: jest.fn().mockResolvedValue(CONV) },
      customer: { findUnique: jest.fn().mockResolvedValue({ whatsappId: opciones.whatsappId === undefined ? WA_ID : opciones.whatsappId }) },
      message: {
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'nuevo', orderId: null, createdAt: new Date(), ...data })),
        findFirst: jest.fn().mockResolvedValue(opciones.ultimoDelCliente === null ? null : { channel: opciones.ultimoDelCliente ?? 'WHATSAPP' }),
      },
    };
    return { svc: new ConversationsService(prisma, whatsapp), prisma, whatsapp };
  }
  const file = { buffer: Buffer.from('x'), mimetype: 'image/png', size: 1 } as Express.Multer.File;

  it('manda la foto primero y recién después la guarda, con su adjunto y su id de WhatsApp', async () => {
    const { svc, prisma, whatsapp } = armar();
    const m = await svc.enviarImagen(BIZ, 'cv-1', file, '  Así queda  ');
    expect(whatsapp.prepararFoto).toHaveBeenCalledWith(BIZ, file);
    expect(whatsapp.enviarImagen).toHaveBeenCalledWith(BIZ, 'cv-1', WA_ID, 'https://almacen/chats/a.jpg', 'Así queda');
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sender: 'STORE', channel: 'WHATSAPP', text: 'Así queda', externalId: 'wamid.OUT', deliveryStatus: 'sent', attachments: [{ tipo: 'image', url: 'https://almacen/chats/a.jpg' }] }),
    });
    expect(m.attachments).toEqual([{ tipo: 'image', url: 'https://almacen/chats/a.jpg' }]);
  });

  it('sin pie de foto el texto es la etiqueta', async () => {
    const { svc, prisma } = armar();
    await svc.enviarImagen(BIZ, 'cv-1', file);
    expect(prisma.message.create.mock.calls[0][0].data.text).toBe('[Imagen]');
  });

  it('si WhatsApp la rechaza (plazo vencido) no queda guardada en el hilo', async () => {
    const { svc, prisma, whatsapp } = armar();
    whatsapp.enviarImagen.mockRejectedValue(new UnprocessableEntityException('Pasaron más de 24 horas'));
    await expect(svc.enviarImagen(BIZ, 'cv-1', file)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('un cliente sin WhatsApp no puede recibir una foto, y la charla tiene que ser de este negocio', async () => {
    const sin = armar({ whatsappId: null });
    await expect(sin.svc.enviarImagen(BIZ, 'cv-1', file)).rejects.toBeInstanceOf(BadRequestException);
    expect(sin.whatsapp.prepararFoto).not.toHaveBeenCalled();
    const ajena = armar();
    ajena.prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(ajena.svc.enviarImagen(BIZ, 'otra', file)).rejects.toThrow('Conversación no encontrada');
  });

  it('contestar con una foto no apaga el sin leer del chat de la tienda', async () => {
    const { svc, prisma } = armar({ ultimoDelCliente: 'STOREFRONT' });
    await svc.enviarImagen(BIZ, 'cv-1', file);
    expect(prisma.conversation.update.mock.calls[0][0].data).not.toHaveProperty('isUnread');
  });
});

describe('token de WhatsApp vencido (error 190 de Meta)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('se le explica al dueño que tiene que volver a conectar la cuenta, sin reintentar', async () => {
    const prisma: any = {
      message: { findFirst: jest.fn().mockResolvedValue({ createdAt: new Date() }) },
      $queryRaw: jest.fn().mockResolvedValue([{ phone_number_id: PHONE, waba_id: 'w', access_token: 'tok-vencido' }]),
    };
    const svc = new WhatsappService(prisma, { get: (k: string) => ({ WHATSAPP_TOKEN_KEY: 'clave' } as Record<string, string>)[k] } as any);
    const f = jest.spyOn(global, 'fetch').mockResolvedValue(respuesta({ error: { code: 190, message: 'Authentication Error' } }, false, 401));
    await expect(svc.enviarTexto(BIZ, 'cv-1', WA_ID, 'hola')).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.enviarTexto(BIZ, 'cv-1', WA_ID, 'hola')).rejects.toThrow(/Volvé a conectar tu cuenta/);
    expect(f).toHaveBeenCalledTimes(2); // un intento por llamada: no se reintenta con otro formato de número
  });
});
