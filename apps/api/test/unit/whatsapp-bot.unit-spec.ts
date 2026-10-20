import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { LlmEvent, LlmMessage } from '../../src/orbi/llm/llm-adapter.interface';
import { orbiAtiendeElChat, pausarSiAtendiaOrbi, type MensajeEntrante } from '../../src/whatsapp/whatsapp-bot-estado';
import { HerramientasDelBot } from '../../src/whatsapp/whatsapp-bot-tools';
import { WhatsappBotService } from '../../src/whatsapp/whatsapp-bot.service';
import { MENSAJE_DE_DERIVACION, MENSAJE_SIN_MEDIOS, promptDelBot } from '../../src/whatsapp/whatsapp-bot-prompt';
import { MARCA_MENU_TEXTO, PEDIDO_DE_OPCION } from '../../src/whatsapp/whatsapp-bot-menu';

// Orbi como atención al público por WhatsApp: cuándo atiende un chat, cuándo se calla, qué lee y qué hace ante la duda.

const BIZ = 'biz-1';
const CONV = 'cv-1';
const MSG: MensajeEntrante = { businessId: BIZ, conversationId: CONV, customerId: 'cli-1', messageId: 'm-1', waId: '5491122334455', esTexto: true };

describe('orbiAtiendeElChat', () => {
  const on = { enabled: true, modo: 'SELECCIONADOS' as const };
  const todos = { enabled: true, modo: 'TODOS' as const };

  it('con el interruptor general apagado, nunca', () => {
    for (const e of ['DEFAULT', 'ON', 'OFF', 'PAUSADO', 'DERIVADO'] as const) {
      expect(orbiAtiendeElChat({ enabled: false, modo: 'TODOS' }, e)).toBe(false);
      expect(orbiAtiendeElChat(null, e)).toBe(false);
    }
  });
  it('en "solo los que active", atiende los ON y ningún otro', () => {
    expect(orbiAtiendeElChat(on, 'ON')).toBe(true);
    expect(orbiAtiendeElChat(on, 'DEFAULT')).toBe(false);
  });
  it('en "todos", atiende los que siguen el modo y los ON, pero no donde el dueño lo apagó', () => {
    expect(orbiAtiendeElChat(todos, 'DEFAULT')).toBe(true);
    expect(orbiAtiendeElChat(todos, 'ON')).toBe(true);
    expect(orbiAtiendeElChat(todos, 'OFF')).toBe(false);
  });
  it('pausado (entró una persona) o derivado callan a Orbi, en cualquier modo', () => {
    for (const cfg of [on, todos]) {
      expect(orbiAtiendeElChat(cfg, 'PAUSADO')).toBe(false);
      expect(orbiAtiendeElChat(cfg, 'DERIVADO')).toBe(false);
    }
  });
});

describe('pausarSiAtendiaOrbi (entró una persona al chat)', () => {
  const armar = (cfg: unknown, botEstado: string | null) => {
    const prisma: any = {
      whatsappBotConfig: { findUnique: jest.fn().mockResolvedValue(cfg) },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(botEstado ? { botEstado } : null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return prisma;
  };

  it('si Orbi atendía el chat, lo pausa, solo dentro de este negocio', async () => {
    const prisma = armar({ enabled: true, modo: 'TODOS' }, 'DEFAULT');
    await expect(pausarSiAtendiaOrbi(prisma, BIZ, CONV)).resolves.toBe(true);
    const arg = prisma.conversation.updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: CONV, businessId: BIZ });
    expect(arg.data).toMatchObject({ botEstado: 'PAUSADO' });
  });
  it('si Orbi no lo atendía (apagado, o modo "solo los que active" sin activarlo) no toca nada', async () => {
    for (const [cfg, estado] of [[null, 'ON'], [{ enabled: false, modo: 'TODOS' }, 'ON'], [{ enabled: true, modo: 'SELECCIONADOS' }, 'DEFAULT'], [{ enabled: true, modo: 'TODOS' }, 'OFF'], [{ enabled: true, modo: 'TODOS' }, 'DERIVADO']] as const) {
      const prisma = armar(cfg, estado);
      await expect(pausarSiAtendiaOrbi(prisma, BIZ, CONV)).resolves.toBe(false);
      expect(prisma.conversation.updateMany).not.toHaveBeenCalled();
    }
  });
});

// ─── El servicio ─────────────────────────────────────────────────────────────

type Opciones = {
  cfg?: Partial<{ enabled: boolean; modo: string; instrucciones: string | null; topeCreditos: number | null; modalidad: string; menuEstilo: string; bienvenida: string | null; menuOpciones: unknown }> | null;
  /** Cuántas respuestas de Orbi hay ya en el chat (0 = primer contacto). */
  respuestasPrevias?: number;
  /** El último mensaje que mandó Orbi (para entender un "2" suelto como opción de un menú en texto). */
  ultimoDeOrbi?: { text: string } | null;
  botEstado?: string;
  ultimo?: { id: string; sender: string } | null;
  /** Qué ve cada consulta del último mensaje del chat, en orden (la última se repite). Pisa a `ultimo`. */
  ultimos?: ({ id: string; sender: string } | null)[];
  usados?: number;
  respuestasRecientes?: number;
  eventos?: LlmEvent[][]; // una lista de eventos por vuelta del modelo
  pack?: boolean;
  falloEnvio?: boolean;
};

const uso = (prompt = 1000, salida = 200): LlmEvent => ({ type: 'usage', usage: { model: 'gemini-3-flash', promptTokens: prompt, completionTokens: salida, provider: 'gemini' } });

function armar(o: Opciones = {}) {
  const cfg = o.cfg === null ? null : { id: 'c', businessId: BIZ, enabled: true, modo: 'SELECCIONADOS', instrucciones: null, topeCreditos: null, ...o.cfg };
  const propio = { id: MSG.messageId, sender: 'CUSTOMER' };
  const ultimoMock = jest.fn().mockResolvedValue(o.ultimo === undefined ? propio : o.ultimo);
  for (const u of o.ultimos ?? []) ultimoMock.mockResolvedValueOnce(u);
  const prisma: any = {
    whatsappBotConfig: { findUnique: jest.fn().mockResolvedValue(cfg), upsert: jest.fn().mockResolvedValue({}) },
    whatsappBotTurn: { aggregate: jest.fn().mockResolvedValue({ _sum: { credits: o.usados ?? 0 } }), create: jest.fn().mockResolvedValue({}) },
    whatsappConnection: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
    businessAddon: { findFirst: jest.fn().mockResolvedValue(o.pack === false ? null : { id: 'a' }) },
    business: { findFirst: jest.fn().mockResolvedValue({ name: 'Rama', subdomain: 'rama' }) },
    customer: { findFirst: jest.fn().mockResolvedValue({ firstName: 'Ana' }) },
    conversation: {
      findFirst: jest.fn().mockResolvedValue({ botEstado: o.botEstado ?? 'ON', isArchived: false }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    message: {
      findFirst: jest.fn().mockImplementation((args: any) => (args?.where?.viaOrbi ? Promise.resolve(o.ultimoDeOrbi ?? null) : ultimoMock(args))),
      count: jest.fn().mockImplementation(async ({ where }: any) => (where.createdAt ? (o.respuestasRecientes ?? 0) : (o.respuestasPrevias ?? 0))),
      findMany: jest.fn().mockResolvedValue([
        // De más nuevo a más viejo, como los pide el servicio.
        { sender: 'CUSTOMER', text: '¿Tienen zapatillas?' },
        { sender: 'CUSTOMER', text: 'Hola' },
        { sender: 'STORE', text: 'Hola, soy un viejo mensaje del negocio' },
      ]),
      create: jest.fn().mockImplementation(({ data }) => ({ create: data })),
    },
    order: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const config: any = { get: (k: string) => ({ WHATSAPP_BOT_ESPERA_MS: '0' } as Record<string, string>)[k] };
  const whatsapp: any = {
    enviarTexto: o.falloEnvio ? jest.fn().mockRejectedValue(new Error('rechazado')) : jest.fn().mockResolvedValue('wamid.ORBI'),
    enviarInteractivo: jest.fn().mockResolvedValue('wamid.MENU'),
  };
  const storefront: any = {
    listProducts: jest.fn().mockResolvedValue({ total: 1, data: [{ id: 'abcdef12-0000', name: 'Zapatilla Run', categoryName: 'Calzado', price: 50000, comparePrice: 60000, priceTo: null, promoLabel: null, inStock: true, byOrder: false, variantOptions: [{ name: 'Talle', values: [{ value: '40' }, { value: '41' }] }] }] }),
    getProduct: jest.fn(),
    listCoupons: jest.fn().mockResolvedValue([
      { code: 'OCTUBRE10', name: 'Octubre', type: 'PERCENT_TICKET', value: 10, minAmount: 50000, endDate: '2026-10-31T23:59:59.000Z', categories: [] },
      { code: 'REMERAS', name: 'Remeras', type: 'AMOUNT_PRODUCT', value: 2000, minAmount: null, endDate: null, categories: ['Remeras'] },
    ]),
    getConfig: jest.fn().mockResolvedValue({
      business: { name: 'Rama', mode: 'FULL' },
      contact: { scheduleText: 'Lun a Vie 9-18', email: null, instagram: '@rama', tiktok: null, facebook: null },
      payment: { acceptsCash: true, acceptsTransfer: true, acceptsPickup: false, mercadopagoAvailable: true, transferCbu: '7654321098', transferAlias: 'rama.mp', returnsEnabled: true, returnsWindowText: '30 días', cancellationsEnabled: true },
      shipping: { shippingPolicy: 'Envíos a todo el país', shippingEstimateText: '24-72 hs', freeShippingFrom: 80000, carrierShippingCosts: {} },
    }),
  };
  const llmMensajes: LlmMessage[][] = [];
  const vueltas = [...(o.eventos ?? [[{ type: 'text', chunk: 'Sí, tenemos.' }, uso(), { type: 'done' }]])];
  const llm: any = {
    streamChat: jest.fn().mockImplementation(async function* ({ messages }: { messages: LlmMessage[] }) {
      llmMensajes.push(messages.map((m) => ({ ...m })));
      for (const ev of vueltas.shift() ?? [{ type: 'text', chunk: 'ok' }, { type: 'done' }]) yield ev;
    }),
  };
  const bot = new WhatsappBotService(prisma, config, whatsapp, storefront, llm);
  return { bot, prisma, whatsapp, storefront, llm, llmMensajes };
}

const llamada = (name: string, args: Record<string, unknown> = {}): LlmEvent => ({ type: 'tool_call', call: { id: `c-${name}`, name, arguments: args } });

describe('WhatsappBotService.atender', () => {
  it('con Orbi apagado para el chat no lee nada ni contesta', async () => {
    for (const o of [{ cfg: { enabled: false } }, { botEstado: 'DEFAULT' }, { botEstado: 'PAUSADO' }, { botEstado: 'DERIVADO' }, { cfg: null }] as Opciones[]) {
      const t = armar(o);
      await t.bot.atender([MSG]);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
      expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
    }
  });

  it('sin el paquete Avanzado no contesta', async () => {
    const t = armar({ pack: false });
    await t.bot.atender([MSG]);
    expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
  });

  it('contesta por WhatsApp, guarda el mensaje marcado como de Orbi, deja el chat leído y anota el turno', async () => {
    const t = armar();
    await t.bot.atender([MSG]);
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'Sí, tenemos.');
    expect(t.prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: CONV, sender: 'STORE', channel: 'WHATSAPP', externalId: 'wamid.ORBI', viaOrbi: true, text: 'Sí, tenemos.' }),
    });
    const upd = t.prisma.conversation.updateMany.mock.calls.at(-1)[0];
    expect(upd.where).toEqual({ id: CONV, businessId: BIZ });
    expect(upd.data).toMatchObject({ isUnread: false });
    expect(upd.data).not.toHaveProperty('botEstado');
    const turno = t.prisma.whatsappBotTurn.create.mock.calls[0][0].data;
    expect(turno).toMatchObject({ businessId: BIZ, conversationId: CONV, status: 'ok', rounds: 1 });
    expect(turno.credits).toBeGreaterThan(0);
  });

  it('al modelo le llega el historial del chat de WhatsApp: arranca con el cliente y junta los mensajes seguidos', async () => {
    const t = armar();
    await t.bot.atender([MSG]);
    const [sistema, ...resto] = t.llmMensajes[0];
    expect(sistema.role).toBe('system');
    expect(sistema.content).toContain('Rama');
    expect(resto).toEqual([{ role: 'user', content: 'Hola\n¿Tienen zapatillas?' }]);
    expect(t.prisma.message.findMany.mock.calls[0][0].where).toMatchObject({ conversationId: CONV, channel: 'WHATSAPP' });
  });

  it('si el cliente siguió escribiendo (este ya no es el último mensaje) espera al aviso del último y no contesta dos veces', async () => {
    const t = armar({ ultimo: { id: 'otro-mensaje', sender: 'CUSTOMER' } });
    await t.bot.atender([MSG]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
    expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
  });

  it('si mientras tanto contestó una persona, Orbi no se mete', async () => {
    const t = armar({ ultimo: { id: 'respuesta', sender: 'STORE' } });
    await t.bot.atender([MSG]);
    expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
  });

  it('un cliente que manda varios mensajes en un aviso se atiende una sola vez', async () => {
    const t = armar();
    await t.bot.atender([{ ...MSG, messageId: 'm-0' }, MSG]);
    expect(t.llm.streamChat).toHaveBeenCalledTimes(1);
  });

  it('si mientras el modelo piensa el cliente sigue escribiendo, la respuesta vieja se descarta (y se anota lo gastado)', async () => {
    // 1ª consulta (al despertar): es el último. 2ª (antes de mandar): ya hay uno más nuevo.
    const t = armar({ ultimos: [{ id: MSG.messageId, sender: 'CUSTOMER' }, { id: 'mas-nuevo', sender: 'CUSTOMER' }] });
    await t.bot.atender([MSG]);
    expect(t.llm.streamChat).toHaveBeenCalledTimes(1);
    expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
    const turno = t.prisma.whatsappBotTurn.create.mock.calls[0][0].data;
    expect(turno.status).toBe('descartado');
    expect(turno.credits).toBeGreaterThan(0);
  });

  it('si mientras tanto ya contestó otra corrida, un error o un corte por tiempo no deja el chat derivado', async () => {
    const t = armar({ ultimos: [{ id: MSG.messageId, sender: 'CUSTOMER' }, { id: 'resp', sender: 'STORE' }] });
    t.llm.streamChat.mockImplementation(async function* () { throw new Error('This operation was aborted'); });
    await t.bot.atender([MSG]);
    expect(t.prisma.conversation.updateMany).not.toHaveBeenCalled();
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.status).toBe('error');
  });

  it('si pide derivar, manda la despedida y deja el chat para una persona, sin sin-leer apagado', async () => {
    const t = armar({
      eventos: [
        [llamada('derivar_a_una_persona', { motivo: 'Reclama por un pedido' }), uso(), { type: 'done' }],
        [{ type: 'text', chunk: 'Ya avisé al equipo.' }, uso(), { type: 'done' }],
      ],
    });
    await t.bot.atender([MSG]);
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'Ya avisé al equipo.');
    const upd = t.prisma.conversation.updateMany.mock.calls.at(-1)[0];
    expect(upd.data).toMatchObject({ botEstado: 'DERIVADO', botMotivo: 'Reclama por un pedido', isUnread: true });
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.status).toBe('derivado');
  });

  it('usa las herramientas de lectura y le devuelve el resultado al modelo', async () => {
    const t = armar({
      eventos: [
        [llamada('buscar_productos', { consulta: 'zapatillas' }), uso(), { type: 'done' }],
        [{ type: 'text', chunk: 'La Zapatilla Run sale $50.000.' }, uso(), { type: 'done' }],
      ],
    });
    await t.bot.atender([MSG]);
    expect(t.storefront.listProducts).toHaveBeenCalledWith('rama', expect.objectContaining({ search: 'zapatillas', limit: 6 }));
    const segunda = t.llmMensajes[1];
    const resultado = segunda.find((m) => m.role === 'tool');
    expect(resultado?.content).toContain('https://rama.orbita.site/p/abcdef12');
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.toolsUsed).toEqual(['buscar_productos']);
  });

  it('con el cupo del mes agotado no gasta en el modelo: avisa que lo ve una persona y deja el chat derivado', async () => {
    const t = armar({ usados: 5000 });
    await t.bot.atender([MSG]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, MENSAJE_DE_DERIVACION);
    expect(t.prisma.conversation.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ botEstado: 'DERIVADO' });
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.status).toBe('quota');
  });

  it('el tope propio del dueño corta antes que el cupo del plan', async () => {
    const t = armar({ cfg: { topeCreditos: 100 }, usados: 100 });
    await t.bot.atender([MSG]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
  });

  it('con demasiadas respuestas en una hora, deja de contestar y deriva', async () => {
    const t = armar({ respuestasRecientes: 20 });
    await t.bot.atender([MSG]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
    expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
    expect(t.prisma.conversation.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ botEstado: 'DERIVADO' });
  });

  it('un audio o una imagen no se leen: contesta una frase fija, sin gastar modelo', async () => {
    const t = armar();
    await t.bot.atender([{ ...MSG, esTexto: false }]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, MENSAJE_SIN_MEDIOS);
  });

  it('si el modelo falla, no contesta cualquier cosa: deja el chat para una persona', async () => {
    const t = armar();
    t.llm.streamChat.mockImplementation(async function* () { throw new Error('429'); });
    await t.bot.atender([MSG]);
    expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
    expect(t.prisma.conversation.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ botEstado: 'DERIVADO' });
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.status).toBe('error');
  });

  it('si WhatsApp rechaza el envío, no queda guardado como enviado y el chat va a una persona', async () => {
    const t = armar({ falloEnvio: true });
    await t.bot.atender([MSG]);
    expect(t.prisma.message.create).not.toHaveBeenCalled();
    expect(t.prisma.conversation.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ botEstado: 'DERIVADO' });
  });
});

describe('WhatsappBotService: configuración', () => {
  it('encenderlo sin el paquete Avanzado se rechaza', async () => {
    const t = armar({ pack: false });
    await expect(t.bot.guardar(BIZ, { enabled: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.prisma.whatsappBotConfig.upsert).not.toHaveBeenCalled();
  });
  it('encenderlo sin una cuenta de WhatsApp conectada se rechaza', async () => {
    const t = armar();
    t.prisma.whatsappConnection.findUnique.mockResolvedValue(null);
    await expect(t.bot.guardar(BIZ, { enabled: true })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('guarda solo lo que se manda y limpia las indicaciones vacías', async () => {
    const t = armar();
    await t.bot.guardar(BIZ, { modo: 'TODOS', instrucciones: '   ' });
    expect(t.prisma.whatsappBotConfig.upsert).toHaveBeenCalledWith({
      where: { businessId: BIZ },
      create: { businessId: BIZ, modo: 'TODOS', instrucciones: null },
      update: { modo: 'TODOS', instrucciones: null },
    });
  });
  it('el estado trae el cupo del mes con el tope propio', async () => {
    const t = armar({ cfg: { topeCreditos: 500 }, usados: 125 });
    const e = await t.bot.estado(BIZ);
    expect(e.cupo).toMatchObject({ usados: 125, limite: 500, porcentaje: 25 });
    expect(e.cupo.total).toBeGreaterThanOrEqual(500);
  });
  it('encender Orbi en un chat necesita el interruptor general; apagarlo no', async () => {
    const t = armar({ cfg: { enabled: false } });
    await expect(t.bot.cambiarEstadoDelChat(BIZ, CONV, 'ON')).rejects.toBeInstanceOf(BadRequestException);
    await expect(t.bot.cambiarEstadoDelChat(BIZ, CONV, 'OFF')).resolves.toEqual({ botEstado: 'OFF' });
    expect(t.prisma.conversation.updateMany).toHaveBeenCalledWith({ where: { id: CONV, businessId: BIZ }, data: expect.objectContaining({ botEstado: 'OFF', botMotivo: null }) });
  });
  it('reactivar un chat de otro negocio no hace nada', async () => {
    const t = armar();
    t.prisma.conversation.updateMany.mockResolvedValue({ count: 0 });
    await expect(t.bot.cambiarEstadoDelChat(BIZ, 'ajena', 'ON')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('HerramientasDelBot', () => {
  const ctx = { businessId: BIZ, slug: 'rama', customerId: 'cli-1' };
  const herramientas = (order = jest.fn().mockResolvedValue([])) => {
    const tienda: any = { listProducts: jest.fn(), getProduct: jest.fn(), getConfig: jest.fn() };
    return { h: new HerramientasDelBot({ order: { findMany: order } } as any, tienda), order, tienda };
  };

  it('los pedidos que se consultan son SOLO los de la persona que escribe, de este negocio', async () => {
    const { h, order } = herramientas(jest.fn().mockResolvedValue([{ orderNumber: 12, status: 'SHIPPED', total: 1000, createdAt: new Date('2026-10-01'), items: [{ productName: 'Remera', variantLabel: 'M', quantity: 2 }] }]));
    const r = await h.ejecutar('estado_de_mi_pedido', { numero_de_pedido: 12 }, ctx);
    expect(order.mock.calls[0][0].where).toMatchObject({ businessId: BIZ, customerId: 'cli-1', deletedAt: null, orderNumber: 12 });
    expect(r).toMatchObject({ ok: true, datos: { pedidos: [{ numero: 12, estado: 'Enviado', productos: ['2 × Remera (M)'] }] } });
  });

  it('los datos de la tienda no incluyen CBU, alias ni datos bancarios', async () => {
    const t = armar();
    const h = new HerramientasDelBot(t.prisma, t.storefront);
    const r = await h.ejecutar('datos_de_la_tienda', {}, ctx);
    const texto = JSON.stringify(r);
    expect(texto).not.toContain('7654321098');
    expect(texto).not.toContain('rama.mp');
    expect(texto).toContain('Lun a Vie 9-18');
  });

  it('cupones y descuentos: solo los públicos vigentes, dicho en palabras, y avisa que el cupón va en el checkout', async () => {
    const t = armar();
    const h = new HerramientasDelBot(t.prisma, t.storefront);
    const r = (await h.ejecutar('cupones_y_descuentos', {}, ctx)) as { ok: true; datos: any };
    expect(t.storefront.listCoupons).toHaveBeenCalledWith('rama');
    expect(r.datos.cupones).toEqual([
      { codigo: 'OCTUBRE10', nombre: 'Octubre', descuento: '10% de descuento', compra_minima: 50000, vence: '2026-10-31', solo_en: null },
      { codigo: 'REMERAS', nombre: 'Remeras', descuento: '$2000 de descuento', compra_minima: null, vence: null, solo_en: ['Remeras'] },
    ]);
    expect(r.datos.como_se_usa).toContain('checkout');
  });

  it('el detalle de un producto cuenta su promo 2x1 y a qué alcanza', async () => {
    const { h, tienda } = herramientas();
    tienda.getProduct.mockResolvedValue({
      id: 'abcdef12-0000', name: 'Remera', description: null, categoryName: 'Remeras', price: 10000, comparePrice: null, promoLabel: '2x1', byOrder: false, specs: [],
      promo: { label: '2x1', llevaCantidad: 2, pagaCantidad: 1, scope: 'CATEGORY', categoryName: 'Remeras', otherProducts: [] },
      options: [], variants: [],
    });
    const r = (await h.ejecutar('detalle_producto', { producto_id: 'abcdef12-0000' }, ctx)) as { ok: true; datos: any };
    expect(r.datos.promocion).toMatchObject({ lleva: 2, paga: 1, aplica_a: 'toda la categoría Remeras' });
  });

  it('un error interno no se le cuenta al modelo (ni al cliente)', async () => {
    const { h, tienda } = herramientas();
    tienda.listProducts.mockRejectedValue(new Error('connection string postgres://secreto'));
    const r = await h.ejecutar('buscar_productos', { consulta: 'x' }, ctx);
    expect(r).toEqual({ ok: false, error: expect.not.stringContaining('postgres') });
  });

  it('un id de producto raro ni llega a la tienda', async () => {
    const { h, tienda } = herramientas();
    const r = await h.ejecutar('detalle_producto', { producto_id: "x'; drop table" }, ctx);
    expect(r.ok).toBe(false);
    expect(tienda.getProduct).not.toHaveBeenCalled();
  });
});

describe('promptDelBot', () => {
  const base = { tienda: 'Rama', link: 'https://rama.orbita.site', cliente: 'Ana', instrucciones: null, esPrimeraRespuesta: true };
  it('la primera vez se presenta como asistente virtual; después no', () => {
    expect(promptDelBot(base)).toContain('presentate');
    expect(promptDelBot({ ...base, esPrimeraRespuesta: false })).toContain('no vuelvas a hacerlo');
  });
  it('lleva las indicaciones del dueño sin dejar que pisen las reglas', () => {
    const p = promptDelBot({ ...base, instrucciones: 'Hablá de vos y ofrecé el 10% en efectivo' });
    expect(p).toContain('ofrecé el 10% en efectivo');
    expect(p).toContain('siempre que no contradigan las reglas');
  });
});

describe('modalidades de Orbi (la elige el dueño)', () => {
  const dice = (texto: string, extra: Partial<MensajeEntrante> = {}): MensajeEntrante => ({ ...MSG, texto, ...extra });
  const toco = (opcionId: string, titulo = 'x'): MensajeEntrante => ({ ...MSG, texto: titulo, opcionId });
  const guardado = (t: ReturnType<typeof armar>) => t.prisma.message.create.mock.calls.at(-1)[0].data;

  describe('solo menú (sin IA)', () => {
    const cfg = { modalidad: 'SOLO_MENU' };

    it('el primer mensaje abre con el saludo y el menú interactivo, sin gastar IA', async () => {
      const t = armar({ cfg });
      await t.bot.atender([dice('hola')]);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
      const menu = t.whatsapp.enviarInteractivo.mock.calls[0][3];
      expect(menu.type).toBe('list');
      expect(menu.body.text).toContain('Rama');
      expect(menu.action.sections[0].rows.map((r: any) => r.id)).toEqual(['catalogo', 'pedidos', 'promos', 'envios', 'horarios', 'persona']);
      expect(guardado(t)).toMatchObject({ sender: 'STORE', viaOrbi: true, externalId: 'wamid.MENU' });
      expect(guardado(t).text).toContain(MARCA_MENU_TEXTO);
      expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.credits).toBe(0);
    });

    it('un texto que no es una opción vuelve a mostrar el menú, avisando que no lo entendió', async () => {
      const t = armar({ cfg, respuestasPrevias: 2 });
      await t.bot.atender([dice('quiero una remera azul')]);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
      expect(t.whatsapp.enviarInteractivo.mock.calls[0][3].body.text).toContain('No te entendí');
    });

    it('un saludo con el chat ya empezado muestra el menú sin el "no te entendí"', async () => {
      const t = armar({ cfg, respuestasPrevias: 2 });
      await t.bot.atender([dice('hola')]);
      expect(t.whatsapp.enviarInteractivo.mock.calls[0][3].body.text).not.toContain('No te entendí');
    });

    it('al elegir "catálogo" contesta con productos y links armados con los datos reales, y avisa cómo volver al menú', async () => {
      const t = armar({ cfg });
      await t.bot.atender([toco('catalogo', 'Ver el catálogo')]);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
      const texto = t.whatsapp.enviarTexto.mock.calls[0][3] as string;
      expect(texto).toContain('*Zapatilla Run*');
      expect(texto).toContain('$50.000');
      expect(texto).toContain('https://rama.orbita.site/p/abcdef12');
      expect(texto).toContain('Escribí *menú*');
      expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data).toMatchObject({ status: 'ok', credits: 0 });
    });

    it('las demás opciones de fábrica contestan con datos de la tienda (promos con el cupón, horarios y envíos)', async () => {
      const t = armar({ cfg });
      await t.bot.atender([toco('promos')]);
      expect(t.whatsapp.enviarTexto.mock.calls[0][3]).toContain('OCTUBRE10');
      const t2 = armar({ cfg });
      await t2.bot.atender([toco('horarios')]);
      expect(t2.whatsapp.enviarTexto.mock.calls[0][3]).toContain('Lun a Vie 9-18');
      const t3 = armar({ cfg });
      await t3.bot.atender([toco('envios')]);
      expect(t3.whatsapp.enviarTexto.mock.calls[0][3]).toContain('Envíos a todo el país');
    });

    it('sigue funcionando con el cupo de IA agotado, porque no usa IA', async () => {
      const t = armar({ cfg, usados: 999999 });
      await t.bot.atender([toco('catalogo')]);
      expect(t.whatsapp.enviarTexto).toHaveBeenCalledTimes(1);
      expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.status).toBe('ok');
    });

    it('"Hablar con alguien" deriva el chat a una persona', async () => {
      const t = armar({ cfg });
      await t.bot.atender([toco('persona')]);
      expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, MENSAJE_DE_DERIVACION);
      expect(t.prisma.conversation.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ botEstado: 'DERIVADO' });
    });

    it('una opción propia del dueño contesta con su texto fijo', async () => {
      const t = armar({ cfg: { ...cfg, menuOpciones: [{ id: 'custom-1', titulo: 'Mayoristas', activa: true, respuesta: 'Escribinos a mayor@rama.com' }, { id: 'persona', titulo: 'Hablar con alguien', activa: true }] } });
      await t.bot.atender([toco('custom-1', 'Mayoristas')]);
      expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'Escribinos a mayor@rama.com');
    });

    it('una opción que el dueño apagó ya no se acepta (un menú viejo en el celular del cliente): se muestra el vigente', async () => {
      const t = armar({ cfg: { ...cfg, menuOpciones: [{ id: 'catalogo', titulo: 'Catálogo', activa: false }, { id: 'persona', titulo: 'Hablar con alguien', activa: true }] }, respuestasPrevias: 1 });
      await t.bot.atender([toco('catalogo')]);
      expect(t.whatsapp.enviarTexto).not.toHaveBeenCalledWith(BIZ, CONV, MSG.waId, expect.stringContaining('Zapatilla'));
      expect(t.whatsapp.enviarInteractivo).toHaveBeenCalledTimes(1);
    });

    it('un "2" suelto elige la opción 2, pero solo si lo último que mandó Orbi fue un menú en texto', async () => {
      const t = armar({ cfg, ultimoDeOrbi: { text: `Hola\n\n1. Ver el catálogo\n2. Mis pedidos\n\n${MARCA_MENU_TEXTO}.` } });
      await t.bot.atender([dice('2')]);
      expect(t.prisma.order.findMany).toHaveBeenCalledTimes(1);
      const sin = armar({ cfg, respuestasPrevias: 1, ultimoDeOrbi: { text: 'Gracias por escribirnos' } });
      await sin.bot.atender([dice('2')]);
      expect(sin.prisma.order.findMany).not.toHaveBeenCalled();
      expect(sin.whatsapp.enviarInteractivo).toHaveBeenCalledTimes(1);
    });
  });

  describe('menú + conversación', () => {
    const cfg = { modalidad: 'MENU_Y_CONVERSACION' };

    it('el primer contacto abre con el menú, sin IA', async () => {
      const t = armar({ cfg });
      await t.bot.atender([dice('hola tienen zapatillas?')]);
      expect(t.whatsapp.enviarInteractivo).toHaveBeenCalledTimes(1);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
    });

    it('un saludo con el chat empezado vuelve a mostrar el menú', async () => {
      const t = armar({ cfg, respuestasPrevias: 3 });
      await t.bot.atender([dice('buenas')]);
      expect(t.whatsapp.enviarInteractivo).toHaveBeenCalledTimes(1);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
    });

    it('una consulta con el chat empezado la contesta la IA', async () => {
      const t = armar({ cfg, respuestasPrevias: 3 });
      await t.bot.atender([dice('hola tienen zapatillas?')]);
      expect(t.llm.streamChat).toHaveBeenCalledTimes(1);
      expect(t.whatsapp.enviarInteractivo).not.toHaveBeenCalled();
    });

    it('al elegir una opción, la IA contesta sabiendo qué se quiso decir (no solo el título)', async () => {
      const t = armar({ cfg, respuestasPrevias: 1 });
      await t.bot.atender([toco('pedidos', 'Mis pedidos')]);
      expect(t.llm.streamChat).toHaveBeenCalledTimes(1);
      const ultimoUsuario = t.llmMensajes[0].filter((x) => x.role === 'user').at(-1);
      expect(ultimoUsuario?.content).toBe(PEDIDO_DE_OPCION.pedidos);
    });

    it('con el cupo agotado, la opción elegida avisa que lo ve una persona', async () => {
      const t = armar({ cfg, respuestasPrevias: 1, usados: 999999 });
      await t.bot.atender([toco('catalogo')]);
      expect(t.llm.streamChat).not.toHaveBeenCalled();
      expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, MENSAJE_DE_DERIVACION);
    });
  });

  describe('conversacional (como hasta ahora)', () => {
    it('no muestra menú: contesta todo con IA, hasta el "hola"', async () => {
      const t = armar({ cfg: { modalidad: 'CONVERSACIONAL' } });
      await t.bot.atender([dice('hola')]);
      expect(t.llm.streamChat).toHaveBeenCalledTimes(1);
      expect(t.whatsapp.enviarInteractivo).not.toHaveBeenCalled();
    });
    it('una opción de un menú viejo se trata como un texto más', async () => {
      const t = armar({ cfg: { modalidad: 'CONVERSACIONAL' } });
      await t.bot.atender([toco('catalogo', 'Ver el catálogo')]);
      expect(t.llm.streamChat).toHaveBeenCalledTimes(1);
    });
  });

  describe('si WhatsApp no deja mandar el menú interactivo', () => {
    it('lo manda como texto numerado', async () => {
      const t = armar({ cfg: { modalidad: 'SOLO_MENU' } });
      t.whatsapp.enviarInteractivo.mockRejectedValue(Object.assign(new Error('Graph 400'), { status: 400 }));
      await t.bot.atender([dice('hola')]);
      const texto = t.whatsapp.enviarTexto.mock.calls[0][3] as string;
      expect(texto).toContain('1. Ver el catálogo');
      expect(texto).toContain(MARCA_MENU_TEXTO);
    });
    it('un token vencido tampoco se arregla con texto: no insiste y deja el chat para una persona', async () => {
      const { ConflictException } = await import('@nestjs/common');
      const t = armar({ cfg: { modalidad: 'SOLO_MENU' } });
      t.whatsapp.enviarInteractivo.mockRejectedValue(new ConflictException('La conexión con WhatsApp venció'));
      await t.bot.atender([dice('hola')]);
      expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
      expect(t.prisma.conversation.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ botEstado: 'DERIVADO' });
    });
    it('pero el plazo de 24 horas vencido no se arregla con texto: queda para una persona', async () => {
      const { UnprocessableEntityException } = await import('@nestjs/common');
      const t = armar({ cfg: { modalidad: 'SOLO_MENU' } });
      t.whatsapp.enviarInteractivo.mockRejectedValue(new UnprocessableEntityException('24 horas'));
      await t.bot.atender([dice('hola')]);
      expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
      expect(t.prisma.conversation.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ botEstado: 'DERIVADO' });
    });
  });

  describe('configuración del menú', () => {
    it('guarda la modalidad, el estilo, el saludo y las opciones, validando contra el estilo que queda', async () => {
      const t = armar();
      const tres = [{ id: 'catalogo', titulo: 'Catálogo', activa: true }, { id: 'pedidos', titulo: 'Pedidos', activa: true }, { id: 'persona', titulo: 'Hablar con alguien', activa: true }];
      await t.bot.guardar(BIZ, { modalidad: 'SOLO_MENU', menuEstilo: 'BOTONES', bienvenida: '  ¡Hola! ¿En qué te ayudo?  ', menuOpciones: tres });
      const data = t.prisma.whatsappBotConfig.upsert.mock.calls[0][0].update;
      expect(data).toMatchObject({ modalidad: 'SOLO_MENU', menuEstilo: 'BOTONES', bienvenida: '¡Hola! ¿En qué te ayudo?' });
      expect(data.menuOpciones.map((o: any) => o.id)).toEqual(['catalogo', 'pedidos', 'persona']);
    });
    it('rechaza un menú inválido con el motivo: botones con más de 3, títulos largos, opciones propias sin respuesta', async () => {
      const t = armar();
      const seis = ['catalogo', 'pedidos', 'promos', 'envios', 'horarios', 'persona'].map((id) => ({ id, titulo: 'Op', activa: true }));
      await expect(t.bot.guardar(BIZ, { menuEstilo: 'BOTONES', menuOpciones: seis })).rejects.toThrow(/hasta 3/);
      await expect(t.bot.guardar(BIZ, { menuOpciones: [{ id: 'catalogo', titulo: 'x'.repeat(30), activa: true }] })).rejects.toThrow(/24/);
      await expect(t.bot.guardar(BIZ, { menuOpciones: [{ id: 'custom-1', titulo: 'Mayor', activa: true }] })).rejects.toThrow(/necesita el texto/);
      expect(t.prisma.whatsappBotConfig.upsert).not.toHaveBeenCalled();
    });
    it('pasar a botones con el menú de fábrica (6 opciones activas) se rechaza: hay que apagar algunas', async () => {
      const t = armar();
      await expect(t.bot.guardar(BIZ, { menuEstilo: 'BOTONES' })).rejects.toBeInstanceOf(BadRequestException);
    });
    it('el estado trae la modalidad, el saludo de ejemplo y las opciones vigentes', async () => {
      const t = armar({ cfg: { modalidad: 'MENU_Y_CONVERSACION', menuEstilo: 'LISTA' } });
      const e = await t.bot.estado(BIZ);
      expect(e).toMatchObject({ modalidad: 'MENU_Y_CONVERSACION', menuEstilo: 'LISTA', bienvenida: null });
      expect(e.bienvenidaPorDefecto).toContain('Rama');
      expect(e.menuOpciones).toHaveLength(6);
    });
  });
});
