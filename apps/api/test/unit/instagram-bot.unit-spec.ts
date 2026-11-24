import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import type { LlmEvent } from '../../src/orbi/llm/llm-adapter.interface';
import { InstagramBotService, recortarABytes } from '../../src/instagram/instagram-bot.service';
import { InstagramService } from '../../src/instagram/instagram.service';
import { InstagramBandejaService } from '../../src/instagram/instagram-bandeja.service';
import { nombreDePila } from '../../src/orbi/atencion/atencion-de-orbi';
import { pausarSiAtendiaOrbi, type MensajeDeCliente } from '../../src/orbi/atencion/estado';
import { ID_CAMBIAR, ID_CONFIRMAR, PedidosPorChatService, textoDelResumen, type Borrador } from '../../src/orbi/atencion/pedidos';
import { MENSAJE_DE_DERIVACION, promptDelBot } from '../../src/orbi/atencion/prompt';

// Orbi atiende los mensajes directos de Instagram con el mismo flujo que WhatsApp (orbi/atencion/atencion-de-orbi.ts). Acá
// se prueba lo que cambia en Instagram: el envío (texto de hasta 1000 bytes, foto sin pie, respuestas rápidas), el pedido
// sin teléfono, los avisos con el plazo de 24 h, el cupo compartido con WhatsApp, y el webhook (ecos, bienvenida).

const BIZ = 'biz-1';
const CONV = 'cv-ig';
const IGSID = '9988776655';
const MSG: MensajeDeCliente = { businessId: BIZ, conversationId: CONV, customerId: 'cli-ig', messageId: 'm-1', destinatario: IGSID, esTexto: true, texto: 'hola' };

const uso = (): LlmEvent => ({ type: 'usage', usage: { model: 'groq-x', promptTokens: 1000, completionTokens: 200, provider: 'groq' } });
const llamada = (name: string, args: Record<string, unknown> = {}): LlmEvent => ({ type: 'tool_call', call: { id: `c-${name}`, name, arguments: args } });

type Opciones = {
  cfg?: Record<string, unknown> | null;
  botEstado?: string;
  eventos?: LlmEvent[][];
  borrador?: unknown;
  /** Créditos del mes: todos los canales y solo Instagram. */
  usadosTodos?: number;
  usadosIg?: number;
  conectado?: boolean;
  pack?: boolean;
  falloRapidas?: Error;
  firstName?: string;
};

function armar(o: Opciones = {}) {
  const cfg = o.cfg === null ? null : { id: 'c', businessId: BIZ, enabled: true, modo: 'TODOS', instrucciones: null, topeCreditos: null, tomaPedidos: false, maxUnidades: 10, maxMonto: 200000, ...o.cfg };
  const prisma: any = {
    instagramBotConfig: { findUnique: jest.fn().mockResolvedValue(cfg), upsert: jest.fn().mockResolvedValue({}) },
    instagramConnection: { findUnique: jest.fn().mockResolvedValue(o.conectado === false ? null : { status: 'ACTIVE' }) },
    whatsappBotTurn: {
      aggregate: jest.fn().mockImplementation(async ({ where }: any) => ({ _sum: { credits: where.canal ? (o.usadosIg ?? 0) : (o.usadosTodos ?? o.usadosIg ?? 0) } })),
      create: jest.fn().mockResolvedValue({}),
    },
    businessAddon: { findFirst: jest.fn().mockResolvedValue(o.pack === false ? null : { id: 'a' }) },
    business: { findFirst: jest.fn().mockResolvedValue({ name: 'Rama', subdomain: 'rama' }) },
    customer: { findFirst: jest.fn().mockResolvedValue({ firstName: o.firstName ?? 'Ana' }) },
    conversation: {
      findFirst: jest.fn().mockResolvedValue({ botEstado: o.botEstado ?? 'DEFAULT', isArchived: false, botBorrador: o.borrador ?? null, customer: { firstName: 'Ana', lastName: null } }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    message: {
      findFirst: jest.fn().mockResolvedValue({ id: MSG.messageId, sender: 'CUSTOMER', text: 'hola' }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([{ sender: 'CUSTOMER', text: '¿Tienen zapatillas?' }]),
      create: jest.fn().mockImplementation(({ data }) => ({ create: data })),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const config: any = { get: (k: string) => ({ WHATSAPP_BOT_ESPERA_MS: '0' } as Record<string, string>)[k] };
  const instagram: any = {
    enviarTexto: jest.fn().mockResolvedValue('mid.ORBI'),
    enviarImagen: jest.fn().mockResolvedValue('mid.FOTO'),
    enviarConRespuestasRapidas: o.falloRapidas ? jest.fn().mockRejectedValue(o.falloRapidas) : jest.fn().mockResolvedValue('mid.RESUMEN'),
  };
  const medios: any = { fotoDeProductoParaMensaje: jest.fn().mockResolvedValue('https://almacen/ig.jpg') };
  const storefront: any = {
    getProduct: jest.fn().mockResolvedValue({ id: 'abcdef12-0000-4000-8000-000000000000', name: 'Zapatilla Run', variants: [], images: [{ url: 'https://supa/a.webp', isPrimary: true, optionValueId: null }] }),
    listProducts: jest.fn(), getConfig: jest.fn(), listCoupons: jest.fn(),
  };
  const vueltas = [...(o.eventos ?? [[{ type: 'text', chunk: 'Sí, tenemos.' }, uso(), { type: 'done' }]])];
  const llm: any = {
    streamChat: jest.fn().mockImplementation(async function* () {
      for (const ev of vueltas.shift() ?? [{ type: 'text', chunk: 'ok' }, { type: 'done' }]) yield ev;
    }),
  };
  const pedidos: any = {
    disponibilidad: jest.fn().mockResolvedValue({ ok: true }),
    preparar: jest.fn().mockResolvedValue({ ok: true, datos: { listo: true } }),
    descartar: jest.fn().mockResolvedValue(undefined),
    confirmar: jest.fn().mockResolvedValue({ ok: true, texto: '¡Listo, Ana! Tu pedido #57 quedó registrado ✅', pedido: { id: 'ord-1', numero: 57, total: 20000 } }),
  };
  const notificaciones: any = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const bot = new InstagramBotService(prisma, config, instagram, medios, storefront, llm, pedidos, notificaciones);
  return { bot, prisma, instagram, medios, llm, pedidos, notificaciones };
}

const BORRADOR: Borrador = {
  lineas: [{ variantId: '11111111-1111-4111-8111-111111111111', nombre: 'Remera', variante: 'M', cantidad: 2, precio: 10000 }],
  subtotal: 20000, descuento: 0, total: 20000, creadoEn: new Date().toISOString(),
};

describe('InstagramBotService.atender', () => {
  it('contesta por Instagram, guarda el mensaje como de Orbi en el canal Instagram y anota el turno de Instagram', async () => {
    const t = armar();
    await t.bot.atender([MSG]);
    expect(t.instagram.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, IGSID, 'Sí, tenemos.');
    const guardado = t.prisma.message.create.mock.calls.find((c: any) => c[0].data.viaOrbi)[0].data;
    expect(guardado).toMatchObject({ channel: 'INSTAGRAM', sender: 'STORE', externalId: 'mid.ORBI', viaOrbi: true });
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data).toMatchObject({ canal: 'INSTAGRAM', status: 'ok' });
    // El historial y "¿ya se presentó?" son los del chat de Instagram.
    expect(t.prisma.message.findMany.mock.calls[0][0].where).toMatchObject({ conversationId: CONV, channel: 'INSTAGRAM' });
  });

  it('con Orbi apagado, en "solo los que active" sin activarlo, pausado o derivado, no contesta', async () => {
    for (const o of [{ cfg: null }, { cfg: { enabled: false } }, { cfg: { modo: 'SELECCIONADOS' } }, { botEstado: 'PAUSADO' }, { botEstado: 'DERIVADO' }, { botEstado: 'OFF' }] as Opciones[]) {
      const t = armar(o);
      await t.bot.atender([MSG]);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
      expect(t.instagram.enviarTexto).not.toHaveBeenCalled();
    }
  });

  it('sin el paquete Avanzado no contesta', async () => {
    const t = armar({ pack: false });
    await t.bot.atender([MSG]);
    expect(t.instagram.enviarTexto).not.toHaveBeenCalled();
  });

  it('el prompt es el de Instagram: sin asteriscos y sin usar "@usuario" como nombre', async () => {
    const t = armar({ firstName: '@ana.paz' });
    const prompts: string[] = [];
    t.llm.streamChat.mockImplementation(async function* ({ messages }: any) {
      prompts.push(messages[0].content);
      yield { type: 'text', chunk: 'Hola' };
      yield { type: 'done' };
    });
    await t.bot.atender([MSG]);
    expect(prompts[0]).toContain('por mensajes directos de Instagram');
    expect(prompts[0]).toContain('ni asteriscos');
    expect(prompts[0]).not.toContain('se llama @ana.paz');
  });

  it('una respuesta larga se corta para que entre en los 1000 bytes de Instagram', async () => {
    const t = armar({ eventos: [[{ type: 'text', chunk: 'ñ'.repeat(900) }, { type: 'done' }]] });
    await t.bot.atender([MSG]);
    const enviado = t.instagram.enviarTexto.mock.calls[0][3] as string;
    expect(Buffer.byteLength(enviado, 'utf8')).toBeLessThanOrEqual(1000);
    expect(enviado.endsWith('…')).toBe(true);
  });

  it('deriva: deja el chat para una persona y avisa al dueño con el link a Difusión y el plazo de 24 h', async () => {
    const t = armar({ eventos: [[llamada('derivar_a_una_persona', { motivo: 'Reclamo por un envío' })], [{ type: 'text', chunk: 'Ya avisé al equipo.' }, { type: 'done' }]] });
    await t.bot.atender([MSG]);
    const estado = t.prisma.conversation.updateMany.mock.calls.map((c: any) => c[0]).find((c: any) => c.data.botEstado);
    expect(estado.data).toMatchObject({ botEstado: 'DERIVADO', botMotivo: 'Reclamo por un envío' });
    expect(t.notificaciones.dispatch).toHaveBeenCalledWith('orbi_necesita_atencion', BIZ, expect.objectContaining({
      title: 'Ana necesita atención en Instagram',
      emailBody: expect.stringMatching(/24 horas[\s\S]*\/ventas\/difusion\?vista=mensajes&charla=cv-ig/),
    }));
  });

  it('manda la foto sola (Instagram no lleva pie) y le pide al modelo que nombre el producto', async () => {
    const t = armar({ eventos: [[llamada('mostrar_foto_producto', { producto_id: 'abcdef12-0000-4000-8000-000000000000' })], [{ type: 'text', chunk: 'Es la Zapatilla Run.' }, { type: 'done' }]] });
    const resultados: string[] = [];
    const original = t.llm.streamChat.getMockImplementation();
    t.llm.streamChat.mockImplementation(async function* (args: any) {
      const tool = args.messages.find((m: any) => m.role === 'tool');
      if (tool) resultados.push(tool.content);
      yield* original(args);
    });
    await t.bot.atender([MSG]);
    expect(t.medios.fotoDeProductoParaMensaje).toHaveBeenCalledWith(BIZ, 'https://supa/a.webp');
    expect(t.instagram.enviarImagen).toHaveBeenCalledWith(BIZ, CONV, IGSID, 'https://almacen/ig.jpg');
    const foto = t.prisma.message.create.mock.calls.map((c: any) => c[0].data).find((d: any) => d.attachments);
    expect(foto).toMatchObject({ channel: 'INSTAGRAM', text: '[Imagen]', viaOrbi: true, attachments: [{ tipo: 'image', url: 'https://almacen/ig.jpg' }] });
    expect(resultados.join(' ')).toContain('nombrá el producto (Zapatilla Run)');
  });

  it('con el cupo del mes agotado entre los dos canales, no usa la IA y deriva', async () => {
    const t = armar({ usadosTodos: 2000, usadosIg: 300 });
    await t.bot.atender([MSG]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
    expect(t.instagram.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, IGSID, MENSAJE_DE_DERIVACION);
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data).toMatchObject({ status: 'quota', canal: 'INSTAGRAM' });
  });
});

describe('InstagramBotService: pedidos', () => {
  it('el resumen sale con respuestas rápidas, sin asteriscos y con la indicación en el texto', async () => {
    const t = armar({ cfg: { tomaPedidos: true }, eventos: [[llamada('preparar_pedido', { items: [] })], [{ type: 'text', chunk: 'ok' }, { type: 'done' }]] });
    t.prisma.conversation.findFirst.mockResolvedValueOnce({ botEstado: 'DEFAULT', botBorrador: null }).mockResolvedValueOnce({ botEstado: 'DEFAULT', botBorrador: null }).mockResolvedValue({ botEstado: 'DEFAULT', botBorrador: BORRADOR });
    await t.bot.atender([MSG]);
    expect(t.instagram.enviarConRespuestasRapidas).toHaveBeenCalledTimes(1);
    const [, , , texto, opciones] = t.instagram.enviarConRespuestasRapidas.mock.calls[0];
    expect(texto).toContain('Resumen de tu pedido');
    expect(texto).not.toContain('*');
    expect(texto).toContain('respondé "sí"');
    expect(opciones).toEqual([{ titulo: 'Confirmar pedido', payload: ID_CONFIRMAR }, { titulo: 'Cambiar', payload: ID_CAMBIAR }]);
    expect(t.instagram.enviarTexto).not.toHaveBeenCalled();
  });

  it('si Instagram rechaza las respuestas rápidas, el mismo resumen va en texto; con el plazo vencido no se insiste', async () => {
    const preparado = (o: Opciones) => {
      const t = armar({ cfg: { tomaPedidos: true }, eventos: [[llamada('preparar_pedido', { items: [] })], [{ type: 'done' }]], ...o });
      t.prisma.conversation.findFirst.mockResolvedValueOnce({ botEstado: 'DEFAULT', botBorrador: null }).mockResolvedValueOnce({ botEstado: 'DEFAULT', botBorrador: null }).mockResolvedValue({ botEstado: 'DEFAULT', botBorrador: BORRADOR });
      return t;
    };
    const a = preparado({ falloRapidas: new Error('(#100) Invalid parameter') });
    await a.bot.atender([MSG]);
    expect(a.instagram.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, IGSID, expect.stringContaining('Resumen de tu pedido'));

    const b = preparado({ falloRapidas: new UnprocessableEntityException('Pasaron más de 24 horas') });
    await b.bot.atender([MSG]);
    expect(b.instagram.enviarTexto).not.toHaveBeenCalled();
  });

  it('el cliente toca "Confirmar pedido": se crea el pedido por Instagram, sin teléfono', async () => {
    const t = armar({ cfg: { tomaPedidos: true }, borrador: BORRADOR });
    await t.bot.atender([{ ...MSG, texto: 'Confirmar pedido', opcionId: ID_CONFIRMAR }]);
    expect(t.pedidos.confirmar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, customerId: 'cli-ig', canal: 'INSTAGRAM', borrador: BORRADOR }));
    expect(t.pedidos.confirmar.mock.calls[0][0]).not.toHaveProperty('telefono');
    expect(t.instagram.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, IGSID, expect.stringContaining('#57'));
    // Queda para una persona, sin el aviso de "necesita atención" (ya salió el de pedido pendiente).
    expect(t.notificaciones.dispatch).not.toHaveBeenCalled();
  });
});

describe('InstagramBotService: configuración', () => {
  it('encender pide el paquete Avanzado y la cuenta conectada', async () => {
    await expect(armar({ pack: false }).bot.guardar(BIZ, { enabled: true })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(armar({ conectado: false }).bot.guardar(BIZ, { enabled: true })).rejects.toThrow('Primero conectá tu cuenta de Instagram.');
  });

  it('guarda en la configuración de Instagram (no en la de WhatsApp)', async () => {
    const t = armar();
    await t.bot.guardar(BIZ, { enabled: true, modo: 'TODOS', instrucciones: '  Hablá de vos  ', tomaPedidos: true, maxUnidades: 5 });
    expect(t.prisma.instagramBotConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: BIZ },
      update: { enabled: true, modo: 'TODOS', instrucciones: 'Hablá de vos', tomaPedidos: true, maxUnidades: 5 },
    }));
  });

  it('el cupo es uno para los dos canales: Instagram ve lo suyo y lo que dejó WhatsApp', async () => {
    const e = await armar({ usadosTodos: 1500, usadosIg: 200 }).bot.estado(BIZ);
    expect(e.cupo).toMatchObject({ usados: 200, total: 2000, otrosCanales: 1300, limite: 700, porcentaje: 28 });
    const conTope = await armar({ usadosTodos: 300, usadosIg: 100, cfg: { topeCreditos: 400 } }).bot.estado(BIZ);
    expect(conTope.cupo).toMatchObject({ limite: 400, porcentaje: 25 });
  });

  it('reactivar Orbi en un chat pide tenerlo encendido para Instagram', async () => {
    await expect(armar({ cfg: { enabled: false } }).bot.cambiarEstadoDelChat(BIZ, CONV, 'ON')).rejects.toThrow('Primero activá Orbi para Instagram.');
    await expect(armar().bot.cambiarEstadoDelChat(BIZ, CONV, 'ON')).resolves.toEqual({ botEstado: 'ON' });
    await expect(armar({ cfg: { enabled: false } }).bot.cambiarEstadoDelChat(BIZ, CONV, 'OFF')).resolves.toEqual({ botEstado: 'OFF' });
  });
});

describe('pedidos por Instagram', () => {
  function armarPedidos() {
    const prisma: any = {
      businessConfig: { findUnique: jest.fn().mockResolvedValue({ acceptsTransfer: true, acceptsCoordinateLater: false, transferDiscountPercent: null }) },
      customer: { findFirst: jest.fn().mockResolvedValue({ firstName: 'Ana', lastName: null, email: null, phone: null }) },
      conversation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const orders: any = { create: jest.fn().mockResolvedValue({ id: 'ord-1', orderNumber: 57, total: '20000.00' }) };
    const notificaciones: any = { dispatch: jest.fn().mockResolvedValue(undefined) };
    return { svc: new PedidosPorChatService(prisma, {} as any, orders, notificaciones), orders, notificaciones };
  }

  it('el resumen de Instagram va sin asteriscos; el de WhatsApp los conserva', () => {
    expect(textoDelResumen(BORRADOR, 'INSTAGRAM')).not.toContain('*');
    expect(textoDelResumen(BORRADOR)).toContain('*Resumen de tu pedido*');
  });

  it('crea el pedido sin teléfono, dice que es de Instagram y le recuerda al dueño el plazo de 24 h', async () => {
    const t = armarPedidos();
    const r = await t.svc.confirmar({ businessId: BIZ, conversationId: CONV, customerId: 'cli-ig', slug: 'rama', tienda: 'Rama', borrador: BORRADOR, canal: 'INSTAGRAM' });
    expect(r.ok).toBe(true);
    expect(r.texto).toContain('Tu pedido #57');
    expect(r.texto).not.toContain('*');
    const [, dto, opts] = t.orders.create.mock.calls[0];
    expect(dto.buyer).toEqual({ name: 'Ana' });
    expect(dto.notes).toContain('tomado por Orbi por Instagram');
    expect(opts).toEqual({ publicCheckout: true, paymentMethodChosen: true, porChat: true });
    expect(t.notificaciones.dispatch).toHaveBeenCalledWith('orbi_pedido_pendiente', BIZ, expect.objectContaining({
      emailSubject: expect.stringContaining('por Instagram'),
      emailBody: expect.stringContaining('24 horas'),
    }));
  });
});

describe('pausarSiAtendiaOrbi en Instagram', () => {
  it('mira la configuración de Instagram, no la de WhatsApp', async () => {
    const prisma: any = {
      whatsappBotConfig: { findUnique: jest.fn().mockResolvedValue({ enabled: false, modo: 'TODOS' }) },
      instagramBotConfig: { findUnique: jest.fn().mockResolvedValue({ enabled: true, modo: 'TODOS' }) },
      conversation: { findFirst: jest.fn().mockResolvedValue({ botEstado: 'DEFAULT' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    await expect(pausarSiAtendiaOrbi(prisma, BIZ, CONV, 'INSTAGRAM')).resolves.toBe(true);
    expect(prisma.whatsappBotConfig.findUnique).not.toHaveBeenCalled();
    await expect(pausarSiAtendiaOrbi(prisma, BIZ, CONV)).resolves.toBe(false);
  });
});

describe('ayudas', () => {
  it('recortarABytes no parte un carácter y respeta el tope', () => {
    expect(recortarABytes('hola', 1000)).toBe('hola');
    const r = recortarABytes('😀'.repeat(400), 1000);
    expect(Buffer.byteLength(r, 'utf8')).toBeLessThanOrEqual(1000);
    expect(r.endsWith('…')).toBe(true);
  });
  it('nombreDePila descarta los nombres que no son de una persona', () => {
    expect(nombreDePila('Ana')).toBe('Ana');
    expect(nombreDePila('@ana.paz')).toBeNull();
    expect(nombreDePila('Instagram 4455')).toBeNull();
    expect(nombreDePila(null)).toBeNull();
  });
  it('el prompt de WhatsApp no cambió de canal', () => {
    const p = promptDelBot({ tienda: 'Rama', link: 'https://rama.orbita.site', cliente: null, instrucciones: null, esPrimeraRespuesta: true });
    expect(p).toContain('por WhatsApp');
    expect(p).toContain('*negrita*');
  });
});

// ─── Webhook de Instagram ────────────────────────────────────────────────────

describe('webhook de Instagram y Orbi', () => {
  const IG_CUENTA = '17841400000000000';
  const evento = (message: Record<string, unknown>, eco = false) => ({
    object: 'instagram',
    entry: [{ id: IG_CUENTA, messaging: [{ sender: { id: eco ? IG_CUENTA : IGSID }, recipient: { id: eco ? IGSID : IG_CUENTA }, timestamp: Date.now(), message }] }],
  });

  function armarWebhook(o: { orbi?: boolean; conocido?: boolean[] } = {}) {
    const conocidos = [...(o.conocido ?? [])];
    const prisma: any = {
      instagramConnection: { findUnique: jest.fn().mockResolvedValue({ businessId: BIZ, status: 'ACTIVE' }) },
      instagramBotConfig: { findUnique: jest.fn().mockResolvedValue(o.orbi ? { enabled: true, modo: 'TODOS' } : null) },
      whatsappBotConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      message: {
        // Cada consulta "¿ya está guardado este mid?" toma la siguiente respuesta de `conocido` (por defecto, no).
        findUnique: jest.fn().mockImplementation(async () => (conocidos.shift() ? { id: 'ya' } : null)),
        findFirst: jest.fn().mockResolvedValue({ createdAt: new Date() }),
        create: jest.fn().mockReturnValue('msg'),
      },
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cli-ig', deletedAt: null }) },
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: CONV, botEstado: 'DEFAULT' }),
        create: jest.fn().mockResolvedValue({ id: CONV }),
        update: jest.fn().mockReturnValue('upd'),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockResolvedValue([{ id: 'msg-nuevo' }, {}]),
    };
    const ajustes: any = { respuestaAutomatica: jest.fn().mockResolvedValue('¡Hola! Ya te respondemos') };
    const config: any = { get: (k: string) => ({ INSTAGRAM_TOKEN_KEY: 'k', INSTAGRAM_APP_SECRET: 's', INSTAGRAM_ESPERA_ECO_MS: '0' } as Record<string, string>)[k] };
    const svc = new InstagramService(prisma, config, undefined, undefined, ajustes);
    const enviar = jest.spyOn(svc, 'enviarTexto').mockResolvedValue('mid.AUTO');
    return { svc, prisma, ajustes, enviar };
  }

  it('devuelve el mensaje del cliente para Orbi, con la respuesta rápida que tocó', async () => {
    const t = armarWebhook({ orbi: true });
    const nuevos = await t.svc.procesarWebhook(evento({ mid: 'mid.1', text: 'Confirmar pedido', quick_reply: { payload: ID_CONFIRMAR } }) as any);
    expect(nuevos).toEqual([{ businessId: BIZ, conversationId: CONV, customerId: 'cli-ig', messageId: 'msg-nuevo', destinatario: IGSID, esTexto: true, texto: 'Confirmar pedido', opcionId: ID_CONFIRMAR }]);
  });

  it('si Orbi atiende el chat no salen la bienvenida ni la ausencia; si no, sí', async () => {
    const conOrbi = armarWebhook({ orbi: true });
    await conOrbi.svc.procesarWebhook(evento({ mid: 'mid.2', text: 'hola' }) as any);
    expect(conOrbi.ajustes.respuestaAutomatica).not.toHaveBeenCalled();

    const sinOrbi = armarWebhook();
    await sinOrbi.svc.procesarWebhook(evento({ mid: 'mid.3', text: 'hola' }) as any);
    expect(sinOrbi.ajustes.respuestaAutomatica).toHaveBeenCalled();
  });

  it('un eco que resultó ser la respuesta de Orbi (ya guardada al volver a mirar) no se guarda ni pausa a Orbi', async () => {
    const t = armarWebhook({ orbi: true, conocido: [false, true] });
    const nuevos = await t.svc.procesarWebhook(evento({ mid: 'mid.ORBI', text: 'Sí, tenemos.', is_echo: true }, true) as any);
    expect(nuevos).toEqual([]);
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.prisma.conversation.updateMany).not.toHaveBeenCalled();
  });

  it('un eco que escribió una persona desde la app se guarda y pausa a Orbi', async () => {
    const t = armarWebhook({ orbi: true });
    const nuevos = await t.svc.procesarWebhook(evento({ mid: 'mid.DUENO', text: 'Te escribo yo', is_echo: true }, true) as any);
    expect(nuevos).toEqual([]);
    expect(t.prisma.$transaction).toHaveBeenCalled();
    expect(t.prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'PAUSADO' }) }));
  });
});

// ─── Bandeja de Difusión ─────────────────────────────────────────────────────

describe('bandeja de Instagram y Orbi', () => {
  function armarBandeja() {
    const prisma: any = {
      conversation: {
        findFirst: jest.fn().mockImplementation(async ({ select }: any) =>
          select?.botEstado !== undefined && select?.customer ? { id: CONV, isUnread: false, customerId: 'cli-ig', botEstado: 'DEFAULT', botMotivo: null, customer: { instagramId: IGSID } } : { botEstado: 'DEFAULT' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      instagramBotConfig: { findUnique: jest.fn().mockResolvedValue({ enabled: true, modo: 'TODOS' }) },
      whatsappBotConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'm-x', sender: 'STORE', text: 'Te respondo yo', attachments: null, deliveryStatus: 'sent', createdAt: new Date(), viaOrbi: false }),
      },
    };
    const instagram: any = { enviarTexto: jest.fn().mockResolvedValue('mid.X') };
    return { svc: new InstagramBandejaService(prisma, instagram, {} as any), prisma };
  }

  it('contestar desde la bandeja pausa a Orbi en esa charla', async () => {
    const t = armarBandeja();
    const [m] = await t.svc.responder(BIZ, CONV, 'Te respondo yo', undefined);
    expect(m).toMatchObject({ de: 'negocio', viaOrbi: false });
    expect(t.prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ botEstado: 'PAUSADO' }) }));
  });
});
