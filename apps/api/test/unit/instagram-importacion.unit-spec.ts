import { UnprocessableEntityException } from '@nestjs/common';
import { InstagramApiError } from '../../src/instagram/instagram.service';
import { fechaDeMeta, InstagramImportacionService, textoDeMensaje } from '../../src/instagram/instagram-importacion.service';

// Importación de las charlas que la cuenta de Instagram ya tenía al conectarla. Cubre lo que si falla se nota tarde:
// que lo viejo no quede como sin leer ni dispare respuestas, que volver a correrla no duplique, que respete el tope y
// los 20 mensajes que da Meta, que un error de Meta no la tire, y que en Cloud Run corra dentro de un pedido.

const BIZ = 'biz-1';
const CUENTA = '17841400000000000';
const IGSID = '9988776655';

function config(extra: Record<string, string> = {}) {
  const valores: Record<string, string> = { INSTAGRAM_IMPORTAR_PAUSA_MS: '0', INSTAGRAM_IMPORTAR_DESPACHO_MS: '20', ...extra };
  return { get: (k: string) => valores[k] } as any;
}

const deCliente = (id: string, texto: string, cuando: string, extra: Record<string, unknown> = {}) => ({
  id, created_time: cuando, from: { id: IGSID, username: 'ana.compra' }, to: { data: [{ id: CUENTA, username: 'mitienda' }] }, message: texto, ...extra,
});
const deLaCuenta = (id: string, texto: string, cuando: string) => ({
  id, created_time: cuando, from: { id: CUENTA, username: 'mitienda' }, to: { data: [{ id: IGSID, username: 'ana.compra' }] }, message: texto,
});

/** Meta simulado: rutas → respuesta (o función que la arma). */
function meta(rutas: Record<string, unknown>) {
  return jest.fn(async (_biz: string, _permiso: string, ruta: string, init: { query?: Record<string, string> } = {}) => {
    const clave = ruta === '{ig}/conversations' ? `conversations:${init.query?.after ?? ''}` : ruta;
    const r = rutas[clave];
    if (r === undefined) throw new InstagramApiError(`ruta no simulada: ${clave}`, 100);
    if (r instanceof Error) throw r;
    return typeof r === 'function' ? (r as (q?: Record<string, string>) => unknown)(init.query) : r;
  });
}

function build(graph: jest.Mock, opts: { cfg?: Record<string, string>; conexion?: unknown; existentes?: string[]; conversacion?: unknown; cliente?: unknown } = {}) {
  const prisma: any = {
    instagramConnection: { findUnique: jest.fn().mockResolvedValue(opts.conexion === undefined ? { igUserId: CUENTA, status: 'ACTIVE' } : opts.conexion) },
    message: {
      findMany: jest.fn().mockResolvedValue((opts.existentes ?? []).map((externalId) => ({ externalId }))),
      create: jest.fn().mockResolvedValue({ id: 'm' }),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue(opts.cliente ?? null),
      create: jest.fn().mockResolvedValue({ id: 'cli-nuevo' }),
    },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(opts.conversacion ?? null),
      create: jest.fn().mockResolvedValue({ id: 'cv-nueva' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
  };
  const instagram: any = { graph, enviarTexto: jest.fn(), enviarConRespuestasRapidas: jest.fn() };
  const medios: any = { guardarImagenEntrante: jest.fn().mockResolvedValue('https://almacen/foto.jpg') };
  return { svc: new InstagramImportacionService(prisma, config(opts.cfg), instagram, medios), prisma, instagram, medios };
}

const unaCharla = (mensajes: unknown[]) => ({
  'conversations:': { data: [{ id: 'conv-1', updated_time: '2026-11-20T10:00:00+0000' }] },
  'conv-1': { messages: { data: mensajes }, id: 'conv-1' },
});

describe('InstagramImportacionService.importar', () => {
  it('crea el cliente, la charla leída con sus fechas reales y los mensajes con quién los escribió', async () => {
    const graph = meta(unaCharla([
      deLaCuenta('mid-2', 'Sí, en talle M', '2026-11-20T10:00:00+0000'),
      deCliente('mid-1', 'Hola, ¿tienen la remera?', '2026-11-20T09:58:00+0000'),
    ]));
    const { svc, prisma, instagram } = build(graph);

    const r = await svc.importar(BIZ);

    expect(r).toEqual({ conversaciones: 1, mensajes: 2, siguiente: null });
    expect(graph).toHaveBeenCalledWith(BIZ, 'instagram_business_manage_messages', '{ig}/conversations', expect.objectContaining({ query: expect.objectContaining({ platform: 'instagram' }) }));
    expect(prisma.customer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { businessId: BIZ, firstName: '@ana.compra', instagramId: IGSID, isChatContact: true },
    }));
    expect(prisma.conversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        businessId: BIZ, customerId: 'cli-nuevo', isUnread: false, instagramCuenta: CUENTA,
        createdAt: new Date('2026-11-20T09:58:00Z'), updatedAt: new Date('2026-11-20T10:00:00Z'),
      },
    }));
    const creados = prisma.message.create.mock.calls.map((c: any[]) => c[0].data);
    // Del más viejo al más nuevo, con la fecha real y el mid como externalId.
    expect(creados).toEqual([
      expect.objectContaining({ conversationId: 'cv-nueva', sender: 'CUSTOMER', text: 'Hola, ¿tienen la remera?', channel: 'INSTAGRAM', externalId: 'mid-1', createdAt: new Date('2026-11-20T09:58:00Z') }),
      expect.objectContaining({ sender: 'STORE', text: 'Sí, en talle M', externalId: 'mid-2' }),
    ]);
    // Es historia: no contesta nada ni toca si la charla está leída.
    expect(instagram.enviarTexto).not.toHaveBeenCalled();
    expect(instagram.enviarConRespuestasRapidas).not.toHaveBeenCalled();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('pide a Meta solo los 20 mensajes más recientes de cada charla', async () => {
    const muchos = Array.from({ length: 25 }, (_, i) => deCliente(`mid-${i}`, `msg ${i}`, `2026-11-20T10:${String(59 - i).padStart(2, '0')}:00+0000`));
    const graph = meta(unaCharla(muchos));
    const { svc, prisma } = build(graph);
    await svc.importar(BIZ);
    expect(graph).toHaveBeenCalledWith(BIZ, expect.any(String), 'conv-1', { query: { fields: expect.stringMatching(/^messages\.limit\(20\)\{/) } });
    expect(prisma.message.create).toHaveBeenCalledTimes(20);
  });

  it('volver a correrla no duplica: lo que ya está guardado se saltea y no se crea otra charla', async () => {
    const graph = meta(unaCharla([deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')]));
    const { svc, prisma } = build(graph, { existentes: ['mid-1'] });
    const r = await svc.importar(BIZ);
    expect(r.mensajes).toBe(0);
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('si el webhook guarda el mismo mensaje en el medio, no falla', async () => {
    const graph = meta(unaCharla([deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000'), deCliente('mid-0', 'Buenas', '2026-11-20T09:57:00+0000')]));
    const { svc, prisma } = build(graph);
    prisma.message.create.mockRejectedValueOnce(Object.assign(new Error('Unique'), { code: 'P2002' }));
    const r = await svc.importar(BIZ);
    expect(r).toEqual({ conversaciones: 1, mensajes: 1, siguiente: null });
  });

  it('usa la charla que ya existe sin marcarla sin leer, y la ata a la cuenta conectada', async () => {
    const graph = meta(unaCharla([deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')]));
    const { svc, prisma } = build(graph, { cliente: { id: 'cli-1', deletedAt: null }, conversacion: { id: 'cv-1' } });
    await svc.importar(BIZ);
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({ where: { id: 'cv-1', businessId: BIZ }, data: { instagramCuenta: CUENTA } });
    expect(prisma.conversation.update).not.toHaveBeenCalled();
    expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ conversationId: 'cv-1', externalId: 'mid-1' });
  });

  it('no revive la charla de un cliente eliminado', async () => {
    const graph = meta(unaCharla([deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')]));
    const { svc, prisma } = build(graph, { cliente: { id: 'cli-1', deletedAt: new Date() } });
    await svc.importar(BIZ);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('respeta el tope de 50 charlas aunque Meta tenga más páginas', async () => {
    const pagina = (desde: number, after?: string) => ({
      data: Array.from({ length: 25 }, (_, i) => ({ id: `conv-${desde + i}` })),
      ...(after ? { paging: { cursors: { after }, next: 'https://graph.instagram.com/…' } } : {}),
    });
    const rutas: Record<string, unknown> = { 'conversations:': pagina(0, 'c1'), 'conversations:c1': pagina(25, 'c2'), 'conversations:c2': pagina(50, 'c3') };
    for (let i = 0; i < 75; i++) rutas[`conv-${i}`] = { messages: { data: [{ ...deCliente(`mid-${i}`, 'Hola', '2026-11-20T09:58:00+0000'), from: { id: `${IGSID}${i}` } }] } };
    const graph = meta(rutas);
    const { svc, prisma } = build(graph);
    const r = await svc.importar(BIZ);
    expect(r.conversaciones).toBe(50);
    expect(graph.mock.calls.filter((c) => c[2] === '{ig}/conversations')).toHaveLength(2);
    expect(prisma.message.create).toHaveBeenCalledTimes(50);
  });

  it('si Meta no da el detalle anidado, lo pide mensaje por mensaje', async () => {
    const graph = meta({
      ...unaCharla([{ id: 'mid-1', created_time: '2026-11-20T09:58:00+0000' }, { id: 'mid-viejo' }]),
      'mid-1': deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000'),
      // Meta contesta "mensaje eliminado" para los que ya no deja leer.
      'mid-viejo': new InstagramApiError('The message has been deleted', 100),
    });
    const { svc, prisma } = build(graph);
    const r = await svc.importar(BIZ);
    expect(r.mensajes).toBe(1);
    expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ externalId: 'mid-1', text: 'Hola', sender: 'CUSTOMER' });
  });

  it('guarda las imágenes en el almacenamiento propio y etiqueta lo que no es texto', async () => {
    const graph = meta(unaCharla([
      { ...deCliente('mid-1', '', '2026-11-20T09:58:00+0000'), attachments: { data: [{ image_data: { url: 'https://lookaside.fbsbx.com/x.jpg' } }] } },
    ]));
    const { svc, prisma, medios } = build(graph);
    await svc.importar(BIZ);
    expect(medios.guardarImagenEntrante).toHaveBeenCalledWith(BIZ, 'https://lookaside.fbsbx.com/x.jpg');
    expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ text: '[Imagen]', attachments: [{ tipo: 'image', url: 'https://almacen/foto.jpg' }] });
  });

  it('una charla que falla no corta las demás', async () => {
    const graph = meta({
      'conversations:': { data: [{ id: 'conv-1' }, { id: 'conv-2' }] },
      'conv-1': new Error('algo raro'),
      'conv-2': { messages: { data: [deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')] } },
    });
    const { svc } = build(graph);
    // conv-1 falla en el pedido anidado y en el de respaldo.
    const r = await svc.importar(BIZ);
    expect(r).toEqual({ conversaciones: 1, mensajes: 1, siguiente: null });
  });

  it('si Meta pide frenar, corta sin tirar y no sigue llamando', async () => {
    const graph = meta({
      'conversations:': { data: [{ id: 'conv-1' }, { id: 'conv-2' }] },
      'conv-1': new InstagramApiError('Application request limit reached', 4),
      'conv-2': { messages: { data: [deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')] } },
    });
    const { svc } = build(graph);
    const r = await svc.importar(BIZ);
    expect(r.corte).toBe('limite');
    expect(r.siguiente).toBeNull();
    expect(graph.mock.calls.some((c) => c[2] === 'conv-2')).toBe(false);
  });

  it('si Instagram ya no acepta la conexión al listar, termina sin tirar', async () => {
    const graph = meta({ 'conversations:': new UnprocessableEntityException('Volvé a conectar') });
    const { svc } = build(graph);
    await expect(svc.importar(BIZ)).resolves.toMatchObject({ corte: 'conexion', mensajes: 0 });
  });

  it('sin conexión activa no llama a Meta', async () => {
    const graph = meta({});
    const { svc } = build(graph, { conexion: { igUserId: CUENTA, status: 'DISCONNECTED' } });
    await expect(svc.importar(BIZ)).resolves.toMatchObject({ corte: 'sin-conexion' });
    expect(graph).not.toHaveBeenCalled();
  });

  it('al agotar el presupuesto de tiempo deja anotado desde dónde seguir (y siempre avanza una)', async () => {
    const graph = meta({
      'conversations:': { data: [{ id: 'conv-1' }, { id: 'conv-2' }] },
      'conv-1': { messages: { data: [deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')] } },
      'conv-2': { messages: { data: [] } },
    });
    const { svc } = build(graph);
    const r = await svc.importar(BIZ, 0, -1);
    expect(r).toMatchObject({ conversaciones: 1, siguiente: 1 });
  });
});

describe('InstagramImportacionService.lanzar', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('le pega al endpoint interno con el secreto de cron y no espera a que termine', async () => {
    let cerrar!: (r: Response) => void;
    const fetchMock = jest.fn(() => new Promise<Response>((r) => (cerrar = r)));
    global.fetch = fetchMock as any;
    const { svc } = build(meta({}), { cfg: { CRON_SECRET: 's3cr3to', INSTAGRAM_REDIRECT_URI: 'https://api.orbita.site/api/v1/instagram/oauth/callback' } });

    await svc.lanzar(BIZ, 3);

    expect(fetchMock).toHaveBeenCalledWith('https://api.orbita.site/api/v1/instagram/importacion/biz-1?desde=3', expect.objectContaining({
      method: 'POST', headers: { 'x-cron-secret': 's3cr3to' },
    }));
    cerrar({ ok: true, status: 200 } as Response);
  });

  it('sin CRON_SECRET (en local) corre en el mismo proceso', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    const graph = meta(unaCharla([deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')]));
    const { svc, prisma } = build(graph);
    await svc.lanzar(BIZ);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.message.create).toHaveBeenCalledTimes(1);
  });

  it('si el endpoint interno la rechaza, corre en el mismo proceso', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as any;
    const graph = meta(unaCharla([deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')]));
    const { svc, prisma } = build(graph, { cfg: { CRON_SECRET: 's' } });
    await svc.lanzar(BIZ);
    await new Promise((r) => setTimeout(r, 20));
    expect(prisma.message.create).toHaveBeenCalledTimes(1);
  });

  it('nunca tira, aunque falle todo', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('sin red')) as any;
    const { svc, prisma } = build(meta({}), { cfg: { CRON_SECRET: 's' } });
    prisma.instagramConnection.findUnique.mockRejectedValue(new Error('base caída'));
    await expect(svc.lanzar(BIZ)).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 20));
  });

  it('una tanda que no terminó pide la siguiente', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;
    const graph = meta({
      'conversations:': { data: [{ id: 'conv-1' }, { id: 'conv-2' }] },
      'conv-1': { messages: { data: [deCliente('mid-1', 'Hola', '2026-11-20T09:58:00+0000')] } },
      'conv-2': { messages: { data: [] } },
    });
    const { svc } = build(graph, { cfg: { CRON_SECRET: 's', INSTAGRAM_IMPORTAR_PRESUPUESTO_MS: '0' } });
    // Presupuesto 0: hace la primera y encadena el resto.
    jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(10);
    const r = await svc.tanda(BIZ, 0);
    jest.restoreAllMocks();
    expect(r.siguiente).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.orbita.site/api/v1/instagram/importacion/biz-1?desde=1', expect.anything());
  });
});

describe('formato de Meta', () => {
  it('entiende las fechas ISO con +0000 y los timestamps Unix', () => {
    expect(fechaDeMeta('2022-07-12T19:11:07+0000')).toEqual(new Date('2022-07-12T19:11:07Z'));
    expect(fechaDeMeta('1790000000')).toEqual(new Date(1790000000 * 1000));
    expect(fechaDeMeta(1790000000000)).toEqual(new Date(1790000000000));
    expect(fechaDeMeta('cualquier cosa')).toBeNull();
  });

  it('etiqueta lo que no es texto como el webhook', () => {
    expect(textoDeMensaje({ message: '  hola ' })).toBe('hola');
    expect(textoDeMensaje({ story: { mention: { link: 'x' } } })).toBe('[Mención en una historia]');
    expect(textoDeMensaje({ shares: { data: [{}] } })).toBe('[Publicación compartida]');
    expect(textoDeMensaje({ attachments: { data: [{ video_data: { url: 'v' } }] } })).toBe('[Video]');
    expect(textoDeMensaje({ is_unsupported: true })).toBe('[Mensaje no compatible]');
    expect(textoDeMensaje({ message: '' })).toBeNull();
  });
});

describe('InstagramController.callback', () => {
  // Import diferido: el controller arrastra todo el módulo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { InstagramController } = require('../../src/instagram/instagram.controller');

  function armar(manejarCallback: jest.Mock) {
    const instagram: any = { manejarCallback, retornoDelState: jest.fn().mockResolvedValue(undefined) };
    const importacion: any = { lanzar: jest.fn().mockResolvedValue(undefined) };
    const n: any = null;
    const ctrl = new InstagramController(instagram, n, n, n, n, n, n, n, n, config(), importacion);
    const res = { redirect: jest.fn() };
    return { ctrl, importacion, res };
  }

  it('al conectar lanza la importación del negocio y vuelve al panel', async () => {
    const { ctrl, importacion, res } = armar(jest.fn().mockResolvedValue({ businessId: BIZ, subdomain: 'mitienda', suscripta: true, retorno: 'https://mitienda.orbita.site/panel' }));
    await ctrl.callback('code', 'state', undefined, res);
    expect(importacion.lanzar).toHaveBeenCalledWith(BIZ);
    expect(res.redirect).toHaveBeenCalledWith('https://mitienda.orbita.site/panel?ig=conectado');
  });

  it('si la conexión falla no importa nada', async () => {
    const { ctrl, importacion, res } = armar(jest.fn().mockRejectedValue(new Error('code vencido')));
    await ctrl.callback('code', 'state', undefined, res);
    expect(importacion.lanzar).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('ig=error'));
  });
});
