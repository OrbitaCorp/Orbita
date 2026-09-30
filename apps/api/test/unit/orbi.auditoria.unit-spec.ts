import { HttpStatus } from '@nestjs/common';
import { OrbiController } from '../../src/orbi/orbi.controller';
import { hmacIp } from '../../src/common/utils/hash-ip';
import { ConversationService } from '../../src/orbi/conversation/conversation.service';
import { OrbiSurface } from '../../src/orbi/dto/orbi-chat.dto';

// Auditoría interna 2026-09-10, ítem `api.orbi` (hallazgo MEDIO del 04/09,
// "sin tope de gasto de IA").
//
// - El chat del panel no tenía tope por negocio ni por día, y le mandaba al
//   modelo la conversación ENTERA en cada mensaje: cada turno costaba más que
//   el anterior, sin límite.
// - El bucle de herramientas no tenía cantidad máxima de vueltas.
// - La conversación guardada crecía sin tope.

const miembro = { type: 'member', businessId: 'biz-1', memberId: 'm-1', permissions: [] } as any;

function respuesta() {
  return { setHeader: jest.fn(), flushHeaders: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
}

function controlador(opts: { mensajes?: number; eventos?: () => AsyncGenerator<any>; hayCupo?: boolean } = {}) {
  const llm = {
    streamChat: jest.fn(opts.eventos ?? (async function* () { yield { type: 'text', chunk: 'hola' }; yield { type: 'done' }; })),
  };
  const conversaciones = {
    historialSiEsPropia: jest.fn().mockResolvedValue(Array.from({ length: opts.mensajes ?? 0 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }))),
    crear: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    appendMessage: jest.fn().mockResolvedValue(undefined),
  };
  const contexto = { buildSystemPrompt: jest.fn().mockResolvedValue('system') };
  const tools = {
    getTools: jest.fn().mockReturnValue([{ name: 'listProducts' }]),
    proponer: jest.fn().mockResolvedValue(null),
    requiereConfirmacion: jest.fn().mockReturnValue(false),
    execute: jest.fn().mockResolvedValue({ success: true, label: 'ok' }),
  };
  const analitica = { logAiTurn: jest.fn().mockResolvedValue(null) };
  const cuota = { consumir: jest.fn().mockResolvedValue(opts.hayCupo ?? true) };
  const ctrl = new OrbiController(llm as any, { get: () => undefined } as any, conversaciones as any, contexto as any, tools as any, analitica as any, {} as any, { track: jest.fn() } as any, cuota as any);
  return { ctrl, llm, tools, cuota };
}

const chatPanel = (conversationId?: string) => ({ message: 'hola', conversationId, context: { surface: OrbiSurface.PANEL } }) as any;

describe('Cuota diaria', () => {
  // El contador en sí (tope, renovación a medianoche de Argentina) se prueba en
  // cuota.service.unit-spec.ts; acá, que Orbi lo consulte con la clave y el
  // límite de siempre y responda 429 al llegar al tope.
  const previo = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres';
  });
  afterAll(() => {
    if (previo === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previo;
  });

  it('el chat del panel consulta la cuota del negocio (300 por día)', async () => {
    const { ctrl, cuota } = controlador();
    await ctrl.chat(chatPanel(), respuesta(), miembro);
    expect(cuota.consumir).toHaveBeenCalledWith('orbi-panel:biz-1', 300);
  });

  it('el chat del panel, pasado el tope del negocio, da 429 antes de llamar al modelo', async () => {
    const { ctrl, llm } = controlador({ hayCupo: false });
    const err = await ctrl.chat(chatPanel(), respuesta(), miembro).catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(err.getResponse()).toBe('Llegaste al máximo de mensajes a Orbi por hoy. Mañana se renueva.');
    expect(llm.streamChat).not.toHaveBeenCalled();
  });

  it('el wizard consulta la cuota por IP hasheada (100 por día), sin la IP en claro', async () => {
    const { ctrl, cuota } = controlador();
    await ctrl.chatWizard({ message: 'hola', context: { surface: OrbiSurface.WIZARD } } as any, respuesta(), '1.2.3.4');
    const [clave, limite] = cuota.consumir.mock.calls[0];
    expect(clave).toBe(`orbi-wizard:${hmacIp('orbi-wizard', '1.2.3.4')}`);
    expect(clave).not.toContain('1.2.3.4');
    expect(limite).toBe(100);
  });

  it('el wizard, pasado el tope por IP, también da 429 antes de llamar al modelo', async () => {
    const { ctrl, llm } = controlador({ hayCupo: false });
    const err = await ctrl.chatWizard({ message: 'hola', context: { surface: OrbiSurface.WIZARD } } as any, respuesta(), '1.2.3.4').catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(llm.streamChat).not.toHaveBeenCalled();
  });
});

describe('Costo por mensaje acotado', () => {
  it('al modelo le llegan los últimos 30 mensajes de la conversación, no todos', async () => {
    const { ctrl, llm } = controlador({ mensajes: 120 });
    await ctrl.chat(chatPanel('11111111-1111-4111-8111-111111111111'), respuesta(), miembro);
    const { messages } = (llm.streamChat.mock.calls[0] as unknown as [{ messages: { content: string }[] }])[0];
    // system + 30 de historial + el mensaje nuevo.
    expect(messages).toHaveLength(32);
    expect(messages[1].content).toBe('m90');
  });

  it('el bucle de herramientas corta a las 6 vueltas', async () => {
    const { ctrl, llm, tools } = controlador({
      eventos: async function* () { yield { type: 'tool_call', call: { id: 't', name: 'listProducts', arguments: {} } }; yield { type: 'done' }; },
    });
    const res = respuesta();
    await ctrl.chat(chatPanel(), res, miembro);
    expect(llm.streamChat).toHaveBeenCalledTimes(6);
    expect(tools.execute).toHaveBeenCalledTimes(6);
    expect(res.write.mock.calls.some((c: string[]) => c[0].startsWith('event: done'))).toBe(true);
  });

  it('la conversación guardada se queda con los últimos 200 mensajes', async () => {
    // El recorte lo hace el UPDATE en la base, en el mismo statement que agrega
    // el mensaje (spec §3.3; el SQL completo se prueba en
    // orbi.conversation.aislamiento.unit-spec.ts). Acá, que el tope siga en 200.
    const prisma = { $executeRaw: jest.fn().mockResolvedValue(1) };
    await new ConversationService(prisma as any).appendMessage('conv-1', 'biz-1', 'm-1', { role: 'user', content: 'nuevo', timestamp: '' });
    const [partes] = prisma.$executeRaw.mock.calls[0] as [TemplateStringsArray];
    expect(partes.join('?').replace(/\s+/g, ' ')).toContain('WHERE i > jsonb_array_length(messages || ?::jsonb) - 200');
  });
});
