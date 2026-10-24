import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { LlmEvent, LlmMessage } from '../../src/orbi/llm/llm-adapter.interface';
import { orbiAtiendeElChat, pausarSiAtendiaOrbi, type MensajeEntrante } from '../../src/whatsapp/whatsapp-bot-estado';
import { HerramientasDelBot } from '../../src/whatsapp/whatsapp-bot-tools';
import { WhatsappBotService } from '../../src/whatsapp/whatsapp-bot.service';
import { MENSAJE_DE_DERIVACION, MENSAJE_SIN_MEDIOS, promptDelBot } from '../../src/whatsapp/whatsapp-bot-prompt';
import { MARCA_MENU_TEXTO, PEDIDO_DE_OPCION } from '../../src/whatsapp/whatsapp-bot-menu';
import { ID_CAMBIAR, ID_CONFIRMAR } from '../../src/whatsapp/whatsapp-bot-pedidos';

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
  cfg?: Partial<{ enabled: boolean; modo: string; instrucciones: string | null; topeCreditos: number | null; modalidad: string; menuEstilo: string; bienvenida: string | null; menuOpciones: unknown; tomaPedidos: boolean; maxUnidades: number; maxMonto: number }> | null;
  /** Cuántas respuestas de Orbi hay ya en el chat (0 = primer contacto). */
  respuestasPrevias?: number;
  /** El último mensaje que mandó Orbi (para entender un "2" suelto como opción de un menú en texto). */
  ultimoDeOrbi?: { text: string } | null;
  /** El borrador de pedido que hay en el chat (si Orbi ya armó uno). */
  borrador?: unknown;
  /** Qué contesta el servicio de pedidos al confirmar. */
  confirmacion?: unknown;
  /** El aviso de "necesita atención" ya salió hace poco (el reclamo del aviso devuelve 0). */
  avisoReciente?: boolean;
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
  const propio = { id: MSG.messageId, sender: 'CUSTOMER', text: 'necesito ayuda' };
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
      findFirst: jest.fn().mockResolvedValue({ botEstado: o.botEstado ?? 'ON', isArchived: false, botBorrador: o.borrador ?? null, customer: { firstName: 'Ana', lastName: 'Paz' } }),
      updateMany: jest.fn().mockImplementation(async ({ where }: any) => ({ count: where?.OR && o.avisoReciente ? 0 : 1 })),
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
    enviarFotoDeProducto: jest.fn().mockResolvedValue({ externalId: 'wamid.FOTO', url: 'https://almacen/p.jpg' }),
  };
  const storefront: any = {
    listProducts: jest.fn().mockResolvedValue({ total: 1, data: [{ id: 'abcdef12-0000-4000-8000-000000000000', name: 'Zapatilla Run', categoryName: 'Calzado', price: 50000, comparePrice: 60000, priceTo: null, promoLabel: null, inStock: true, byOrder: false, variantOptions: [{ name: 'Talle', values: [{ value: '40' }, { value: '41' }] }] }] }),
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
  const pedidos: any = {
    disponibilidad: jest.fn().mockResolvedValue({ ok: true }),
    preparar: jest.fn().mockResolvedValue({ ok: true, datos: { listo: true } }),
    descartar: jest.fn().mockResolvedValue(undefined),
    confirmar: jest.fn().mockResolvedValue(o.confirmacion ?? { ok: true, texto: '¡Listo, Ana! Tu pedido *#57* quedó registrado ✅', pedido: { id: 'ord-1', numero: 57, total: 20000 } }),
  };
  const notificaciones: any = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const bot = new WhatsappBotService(prisma, config, whatsapp, storefront, llm, pedidos, notificaciones);
  return { bot, prisma, whatsapp, storefront, llm, llmMensajes, pedidos, notificaciones };
}

/** La actualización del chat que cambia su estado de Orbi (después puede haber otra: la que reclama el aviso al dueño). */
const cambioDeEstado = (t: { prisma: any }) => t.prisma.conversation.updateMany.mock.calls.map((c: any) => c[0]).filter((c: any) => c.data.botEstado).at(-1);

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
    const upd = cambioDeEstado(t);
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

  describe('fotos de producto', () => {
    const producto = {
      id: 'abcdef12-0000-4000-8000-000000000000', name: 'Zapatilla Run', description: null, categoryName: 'Calzado', price: 50000, comparePrice: null, promoLabel: null, promo: null, byOrder: false, specs: [],
      options: [{ name: 'Color', values: [{ id: 'ov-rojo' }, { id: 'ov-azul' }] }],
      variants: [{ id: 'var-rojo', optionValues: [{ optionValueId: 'ov-rojo', value: 'Rojo' }], price: 50000, inStock: true }],
      images: [
        { url: 'https://supa/a.webp', isPrimary: true, optionValueId: null },
        { url: 'https://supa/rojo.webp', isPrimary: false, optionValueId: 'ov-rojo' },
      ],
    };
    const pide = (...fotos: Record<string, unknown>[]): LlmEvent[][] => [
      [...fotos.map((a, i): LlmEvent => ({ type: 'tool_call', call: { id: `c-${i}`, name: 'mostrar_foto_producto', arguments: a } })), uso(), { type: 'done' }],
      [{ type: 'text', chunk: 'Mirá, y sale $50.000.' }, uso(), { type: 'done' }],
    ];

    it('manda la foto del producto con su nombre, la deja en el chat como de Orbi y después contesta el texto', async () => {
      const t = armar({ eventos: pide({ producto_id: 'abcdef12-0000-4000-8000-000000000000' }) });
      t.storefront.getProduct.mockResolvedValue(producto);
      await t.bot.atender([MSG]);
      expect(t.whatsapp.enviarFotoDeProducto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'https://supa/a.webp', 'Zapatilla Run');
      expect(t.prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ conversationId: CONV, sender: 'STORE', viaOrbi: true, externalId: 'wamid.FOTO', text: 'Zapatilla Run', attachments: [{ tipo: 'image', url: 'https://almacen/p.jpg' }] }),
      });
      expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'Mirá, y sale $50.000.');
    });

    it('con variante_id manda la foto de ese color y lo aclara en el pie', async () => {
      const t = armar({ eventos: pide({ producto_id: 'abcdef12-0000-4000-8000-000000000000', variante_id: 'var-rojo' }) });
      t.storefront.getProduct.mockResolvedValue(producto);
      await t.bot.atender([MSG]);
      expect(t.whatsapp.enviarFotoDeProducto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'https://supa/rojo.webp', 'Zapatilla Run (Rojo)');
    });

    it('manda como mucho 3 fotos por respuesta y no repite una', async () => {
      const t = armar({ eventos: pide({ producto_id: 'abcdef12-0000-4000-8000-000000000001' }, { producto_id: 'abcdef12-0000-4000-8000-000000000002' }, { producto_id: 'abcdef12-0000-4000-8000-000000000003' }, { producto_id: 'abcdef12-0000-4000-8000-000000000004' }, { producto_id: 'abcdef12-0000-4000-8000-000000000004' }) });
      t.storefront.getProduct.mockImplementation(async (_s: string, id: string) => ({ ...producto, id, images: [{ url: `https://supa/${id}.webp`, isPrimary: true, optionValueId: null }] }));
      await t.bot.atender([MSG]);
      expect(t.whatsapp.enviarFotoDeProducto).toHaveBeenCalledTimes(3);
      const resultados = t.llmMensajes[1].filter((m) => m.role === 'tool').map((m) => m.content);
      expect(resultados.some((c) => /Ya mandaste 3 fotos/.test(c))).toBe(true);
    });

    it('si la foto no se pudo preparar, no la anota en el chat y le dice al modelo que pase el link', async () => {
      const t = armar({ eventos: pide({ producto_id: 'abcdef12-0000-4000-8000-000000000000' }) });
      t.storefront.getProduct.mockResolvedValue(producto);
      t.whatsapp.enviarFotoDeProducto.mockResolvedValue(null);
      await t.bot.atender([MSG]);
      expect(t.prisma.message.create).toHaveBeenCalledTimes(1); // solo la respuesta de texto
      expect(t.llmMensajes[1].find((m) => m.role === 'tool')?.content).toContain('pasale el link');
    });

    it('un producto sin fotos no manda nada', async () => {
      const t = armar({ eventos: pide({ producto_id: 'abcdef12-0000-4000-8000-000000000000' }) });
      t.storefront.getProduct.mockResolvedValue({ ...producto, images: [] });
      await t.bot.atender([MSG]);
      expect(t.whatsapp.enviarFotoDeProducto).not.toHaveBeenCalled();
    });
  });

  it('con el cupo del mes agotado no gasta en el modelo: avisa que lo ve una persona y deja el chat derivado', async () => {
    const t = armar({ usados: 5000 });
    await t.bot.atender([MSG]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, MENSAJE_DE_DERIVACION);
    expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO' });
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
    expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO' });
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
    expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO' });
    expect(t.prisma.whatsappBotTurn.create.mock.calls[0][0].data.status).toBe('error');
  });

  it('si WhatsApp rechaza el envío, no queda guardado como enviado y el chat va a una persona', async () => {
    const t = armar({ falloEnvio: true });
    await t.bot.atender([MSG]);
    expect(t.prisma.message.create).not.toHaveBeenCalled();
    expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO' });
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

  it('el detalle de un producto acepta el código corto del link y lo completa solo con productos publicados de este negocio', async () => {
    const { h, tienda } = herramientas();
    const prisma: any = { order: { findMany: jest.fn() }, product: { findFirst: jest.fn().mockResolvedValue({ id: 'abcdef12-0000-4000-8000-000000000000' }) } };
    const hh = new HerramientasDelBot(prisma, tienda);
    tienda.getProduct.mockResolvedValue({ id: 'abcdef12-0000-4000-8000-000000000000', name: 'Reloj', description: null, categoryName: null, price: 1, comparePrice: null, promoLabel: null, promo: null, byOrder: false, specs: [], options: [], variants: [], images: [] });
    const r = await hh.ejecutar('detalle_producto', { producto_id: 'abcdef12' }, ctx);
    expect(r.ok).toBe(true);
    expect(prisma.product.findFirst.mock.calls[0][0].where).toMatchObject({ businessId: BIZ, id: { startsWith: 'abcdef12' }, status: 'PUBLISHED', deletedAt: null });
    expect(tienda.getProduct).toHaveBeenCalledWith('rama', 'abcdef12-0000-4000-8000-000000000000');
    void h;
  });

  it('un código corto que no existe en la tienda se rechaza sin consultar el catálogo', async () => {
    const tienda: any = { getProduct: jest.fn() };
    const prisma: any = { order: { findMany: jest.fn() }, product: { findFirst: jest.fn().mockResolvedValue(null) } };
    const r = await new HerramientasDelBot(prisma, tienda).ejecutar('detalle_producto', { producto_id: 'deadbeef' }, ctx);
    expect(r.ok).toBe(false);
    expect(tienda.getProduct).not.toHaveBeenCalled();
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
      id: 'abcdef12-0000-4000-8000-000000000000', name: 'Remera', description: null, categoryName: 'Remeras', price: 10000, comparePrice: null, promoLabel: '2x1', byOrder: false, specs: [],
      promo: { label: '2x1', llevaCantidad: 2, pagaCantidad: 1, scope: 'CATEGORY', categoryName: 'Remeras', otherProducts: [] },
      options: [], variants: [],
    });
    const r = (await h.ejecutar('detalle_producto', { producto_id: 'abcdef12-0000-4000-8000-000000000000' }, ctx)) as { ok: true; datos: any };
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
      expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO' });
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
      expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO' });
    });
    it('pero el plazo de 24 horas vencido no se arregla con texto: queda para una persona', async () => {
      const { UnprocessableEntityException } = await import('@nestjs/common');
      const t = armar({ cfg: { modalidad: 'SOLO_MENU' } });
      t.whatsapp.enviarInteractivo.mockRejectedValue(new UnprocessableEntityException('24 horas'));
      await t.bot.atender([dice('hola')]);
      expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
      expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO' });
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

describe('Orbi toma pedidos', () => {
  const dice = (texto: string): MensajeEntrante => ({ ...MSG, texto });
  const toco = (opcionId: string): MensajeEntrante => ({ ...MSG, texto: 'x', opcionId });
  const BORRADOR = {
    lineas: [{ variantId: '11111111-1111-4111-8111-111111111111', nombre: 'Remera', variante: 'M', cantidad: 2, precio: 10000 }],
    subtotal: 20000, descuento: 0, total: 20000, creadoEn: new Date().toISOString(),
  };
  const cfg = { modalidad: 'CONVERSACIONAL', tomaPedidos: true, maxUnidades: 5, maxMonto: 50000 };
  const pedidoPreparado: LlmEvent[][] = [
    [llamada('preparar_pedido', { items: [{ variante_id: '11111111-1111-4111-8111-111111111111', cantidad: 2 }] }), uso(), { type: 'done' }],
    [{ type: 'text', chunk: 'Ya te armo el resumen, te lo escribo yo.' }, uso(), { type: 'done' }],
  ];

  it('con la función encendida, el modelo recibe la herramienta de armar pedidos; apagada, no', async () => {
    const on = armar({ cfg });
    await on.bot.atender([dice('quiero comprar')]);
    expect(on.llm.streamChat.mock.calls[0][0].tools.map((t: any) => t.name)).toContain('preparar_pedido');
    expect(on.llmMensajes[0][0].content).toContain('Tomar pedidos');
    const off = armar({ cfg: { modalidad: 'CONVERSACIONAL', tomaPedidos: false } });
    await off.bot.atender([dice('quiero comprar')]);
    expect(off.llm.streamChat.mock.calls[0][0].tools.map((t: any) => t.name)).not.toContain('preparar_pedido');
    expect(off.llmMensajes[0][0].content).not.toContain('Tomar pedidos');
  });

  it('en "solo menú" nunca toma pedidos, aunque el interruptor esté prendido', async () => {
    const t = armar({ cfg: { ...cfg, modalidad: 'SOLO_MENU' } });
    await t.bot.atender([dice('quiero comprar')]);
    expect(t.llm.streamChat).not.toHaveBeenCalled();
  });

  it('cuando Orbi arma el pedido, al cliente le llega el resumen DEL SISTEMA con botones (no lo que escribió el modelo)', async () => {
    const t = armar({ cfg, eventos: pedidoPreparado, borrador: BORRADOR });
    await t.bot.atender([dice('dos remeras M')]);
    expect(t.pedidos.preparar).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BIZ, customerId: 'cli-1', conversationId: CONV }),
      { maxUnidades: 5, maxMonto: 50000 },
      [{ variante_id: '11111111-1111-4111-8111-111111111111', cantidad: 2 }],
    );
    const botones = t.whatsapp.enviarInteractivo.mock.calls[0][3];
    expect(botones.type).toBe('button');
    expect(botones.body.text).toContain('Total estimado: $20.000');
    expect(botones.action.buttons.map((b: any) => b.reply.id)).toEqual([ID_CONFIRMAR, ID_CAMBIAR]);
    expect(t.whatsapp.enviarTexto).not.toHaveBeenCalled();
    expect(JSON.stringify(t.prisma.message.create.mock.calls.at(-1))).not.toContain('te lo escribo yo');
  });

  it('si WhatsApp no deja los botones, el resumen sale en texto pidiendo "sí" o "cambiar"', async () => {
    const t = armar({ cfg, eventos: pedidoPreparado, borrador: BORRADOR });
    t.whatsapp.enviarInteractivo.mockRejectedValue(Object.assign(new Error('Graph 400'), { status: 400 }));
    await t.bot.atender([dice('dos remeras M')]);
    expect(t.whatsapp.enviarTexto.mock.calls[0][3]).toMatch(/Respondé \*sí\* para confirmar/);
  });

  it('si preparar_pedido falla (sin stock, tope), no hay resumen: sigue la respuesta del modelo', async () => {
    const t = armar({ cfg, eventos: pedidoPreparado });
    t.pedidos.preparar.mockResolvedValue({ ok: false, error: 'Sin stock' });
    await t.bot.atender([dice('dos remeras M')]);
    expect(t.whatsapp.enviarInteractivo).not.toHaveBeenCalled();
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'Ya te armo el resumen, te lo escribo yo.');
  });

  it('al tocar "Confirmar pedido" se crea el pedido y el chat queda para coordinar, sin el aviso de "necesita atención" (ya sale el de pedido pendiente)', async () => {
    const t = armar({ cfg, borrador: BORRADOR });
    await t.bot.atender([toco(ID_CONFIRMAR)]);
    expect(t.pedidos.confirmar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, customerId: 'cli-1', waId: MSG.waId, slug: 'rama', tienda: 'Rama', borrador: BORRADOR }));
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, expect.stringContaining('#57'));
    expect(cambioDeEstado(t).data).toMatchObject({ botEstado: 'DERIVADO', botMotivo: expect.stringContaining('Pedido #57'), isUnread: true });
    expect(t.notificaciones.dispatch).not.toHaveBeenCalled();
  });

  it('escribir "sí" con un resumen pendiente equivale a confirmar; "cambiar" lo descarta y sigue la charla', async () => {
    const si = armar({ cfg, borrador: BORRADOR });
    await si.bot.atender([dice('sí')]);
    expect(si.pedidos.confirmar).toHaveBeenCalledTimes(1);
    const no = armar({ cfg, borrador: BORRADOR });
    await no.bot.atender([dice('cambiar')]);
    expect(no.pedidos.descartar).toHaveBeenCalledWith(BIZ, CONV);
    expect(no.pedidos.confirmar).not.toHaveBeenCalled();
    expect(no.whatsapp.enviarTexto.mock.calls[0][3]).toContain('qué querés cambiar');
    // sin resumen pendiente, un "sí" suelto es un mensaje más para la IA
    const sin = armar({ cfg });
    await sin.bot.atender([dice('sí')]);
    expect(sin.pedidos.confirmar).not.toHaveBeenCalled();
    expect(sin.llm.streamChat).toHaveBeenCalledTimes(1);
  });

  it('el botón "Cambiar" descarta el borrador', async () => {
    const t = armar({ cfg, borrador: BORRADOR });
    await t.bot.atender([toco(ID_CAMBIAR)]);
    expect(t.pedidos.descartar).toHaveBeenCalledTimes(1);
  });

  it('con la función apagada, el botón de un resumen viejo no crea ningún pedido', async () => {
    const t = armar({ cfg: { modalidad: 'CONVERSACIONAL', tomaPedidos: false }, borrador: BORRADOR });
    await t.bot.atender([toco(ID_CONFIRMAR)]);
    expect(t.pedidos.confirmar).not.toHaveBeenCalled();
  });

  it('si no se pudo crear el pedido, el cliente lo sabe y el chat va a una persona (con aviso)', async () => {
    const t = armar({ cfg, borrador: BORRADOR, confirmacion: { ok: false, texto: 'No pude cargar tu pedido. Ya le avisé al equipo.', derivar: 'Orbi no pudo cargar un pedido que el cliente confirmó: revisalo.' } });
    await t.bot.atender([toco(ID_CONFIRMAR)]);
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, expect.stringContaining('No pude cargar'));
    expect(t.prisma.conversation.updateMany.mock.calls.find((c: any) => c[0].data.botEstado === 'DERIVADO')).toBeTruthy();
    expect(t.notificaciones.dispatch).toHaveBeenCalledWith('orbi_necesita_atencion', BIZ, expect.anything());
  });

  it('un resumen vencido: se le avisa y no se deriva ni se avisa al dueño', async () => {
    const t = armar({ cfg, borrador: BORRADOR, confirmacion: { ok: false, texto: 'El resumen venció o ya no está.', derivar: '' } });
    await t.bot.atender([toco(ID_CONFIRMAR)]);
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, expect.stringContaining('venció'));
    expect(t.prisma.conversation.updateMany.mock.calls.find((c: any) => c[0].data.botEstado === 'DERIVADO')).toBeUndefined();
    expect(t.notificaciones.dispatch).not.toHaveBeenCalled();
  });

  it('la configuración: encender pedidos exige que la tienda pueda tomarlos y el estado trae los topes', async () => {
    const t = armar();
    t.pedidos.disponibilidad.mockResolvedValue({ ok: false, motivo: 'Activá "Coordinar por WhatsApp"' });
    await expect(t.bot.guardar(BIZ, { tomaPedidos: true })).rejects.toThrow(/Coordinar por WhatsApp/);
    expect(t.prisma.whatsappBotConfig.upsert).not.toHaveBeenCalled();
    t.pedidos.disponibilidad.mockResolvedValue({ ok: true });
    await t.bot.guardar(BIZ, { tomaPedidos: true, maxUnidades: 4, maxMonto: 80000 });
    expect(t.prisma.whatsappBotConfig.upsert.mock.calls[0][0].update).toMatchObject({ tomaPedidos: true, maxUnidades: 4, maxMonto: 80000 });
    const e = await armar({ cfg: { tomaPedidos: true, maxUnidades: 4, maxMonto: 80000 } }).bot.estado(BIZ);
    expect(e).toMatchObject({ tomaPedidos: true, maxUnidades: 4, maxMonto: 80000, pedidos: { disponible: true } });
  });
});

describe('aviso al dueño: un chat necesita atención', () => {
  const dice = (texto: string): MensajeEntrante => ({ ...MSG, texto });
  const derivaPorHerramienta: LlmEvent[][] = [
    [llamada('derivar_a_una_persona', { motivo: 'Reclama por un pedido' }), uso(), { type: 'done' }],
    [{ type: 'text', chunk: 'Ya avisé al equipo.' }, uso(), { type: 'done' }],
  ];

  it('cuando Orbi pasa el chat, el dueño recibe el aviso (campanita y correo) con el motivo, el último mensaje y el link al chat', async () => {
    const t = armar({ eventos: derivaPorHerramienta });
    await t.bot.atender([dice('mi pedido no llegó')]);
    expect(t.notificaciones.dispatch).toHaveBeenCalledTimes(1);
    const [evento, biz, payload] = t.notificaciones.dispatch.mock.calls[0];
    expect(evento).toBe('orbi_necesita_atencion');
    expect(biz).toBe(BIZ);
    expect(payload.title).toBe('Ana Paz necesita atención en WhatsApp');
    expect(payload.body).toBe('Reclama por un pedido');
    expect(payload.emailBody).toContain('Motivo: Reclama por un pedido');
    expect(payload.emailBody).toContain('necesito ayuda');
    expect(payload.emailBody).toContain(`/admin/${BIZ}/ventas/mensajes?canal=whatsapp&conv=${CONV}`);
    expect(payload).toMatchObject({ resourceType: 'conversation', resourceId: CONV });
  });

  it('un chat que ya avisó hace menos de 30 minutos no manda otro correo', async () => {
    const t = armar({ eventos: derivaPorHerramienta, avisoReciente: true });
    await t.bot.atender([dice('sigo esperando')]);
    expect(t.notificaciones.dispatch).not.toHaveBeenCalled();
  });

  it('también avisa cuando el cliente elige "Hablar con alguien", cuando se agota el cupo o cuando Orbi falla', async () => {
    const persona = armar({ cfg: { modalidad: 'SOLO_MENU' } });
    await persona.bot.atender([{ ...MSG, texto: 'x', opcionId: 'persona' }]);
    expect(persona.notificaciones.dispatch).toHaveBeenCalledWith('orbi_necesita_atencion', BIZ, expect.objectContaining({ body: expect.stringContaining('Hablar con alguien') }));
    const cupo = armar({ usados: 999999 });
    await cupo.bot.atender([dice('hola')]);
    expect(cupo.notificaciones.dispatch).toHaveBeenCalledWith('orbi_necesita_atencion', BIZ, expect.objectContaining({ body: expect.stringContaining('cupo') }));
    const falla = armar();
    falla.llm.streamChat.mockImplementation(async function* () { throw new Error('429'); });
    await falla.bot.atender([dice('hola')]);
    expect(falla.notificaciones.dispatch).toHaveBeenCalledWith('orbi_necesita_atencion', BIZ, expect.anything());
  });

  it('un error al avisar no rompe la respuesta al cliente', async () => {
    const t = armar({ eventos: derivaPorHerramienta });
    t.notificaciones.dispatch.mockRejectedValue(new Error('mail caído'));
    await t.bot.atender([dice('mi pedido no llegó')]);
    expect(t.whatsapp.enviarTexto).toHaveBeenCalledWith(BIZ, CONV, MSG.waId, 'Ya avisé al equipo.');
  });

  it('una respuesta normal de Orbi no avisa a nadie', async () => {
    const t = armar();
    await t.bot.atender([dice('hola tienen zapatillas?')]);
    expect(t.notificaciones.dispatch).not.toHaveBeenCalled();
  });
});
