import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { LlmEvent, LlmMessage } from '../../src/orbi/llm/llm-adapter.interface';
import { orbiAtiendeElChat, pausarSiAtendiaOrbi, type MensajeEntrante } from '../../src/whatsapp/whatsapp-bot-estado';
import { HerramientasDelBot } from '../../src/whatsapp/whatsapp-bot-tools';
import { WhatsappBotService } from '../../src/whatsapp/whatsapp-bot.service';
import { MENSAJE_DE_DERIVACION, MENSAJE_SIN_MEDIOS, promptDelBot } from '../../src/whatsapp/whatsapp-bot-prompt';

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
  cfg?: Partial<{ enabled: boolean; modo: string; instrucciones: string | null; topeCreditos: number | null }> | null;
  botEstado?: string;
  ultimo?: { id: string; sender: string } | null;
  usados?: number;
  respuestasRecientes?: number;
  eventos?: LlmEvent[][]; // una lista de eventos por vuelta del modelo
  pack?: boolean;
  falloEnvio?: boolean;
};

const uso = (prompt = 1000, salida = 200): LlmEvent => ({ type: 'usage', usage: { model: 'gemini-3-flash', promptTokens: prompt, completionTokens: salida, provider: 'gemini' } });

function armar(o: Opciones = {}) {
  const cfg = o.cfg === null ? null : { id: 'c', businessId: BIZ, enabled: true, modo: 'SELECCIONADOS', instrucciones: null, topeCreditos: null, ...o.cfg };
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
      findFirst: jest.fn().mockResolvedValue(o.ultimo === undefined ? { id: MSG.messageId, sender: 'CUSTOMER' } : o.ultimo),
      count: jest.fn().mockImplementation(async ({ where }: any) => (where.createdAt ? (o.respuestasRecientes ?? 0) : 0)),
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
