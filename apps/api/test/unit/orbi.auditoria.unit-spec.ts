import { HttpStatus } from '@nestjs/common';
import { OrbiController } from '../../src/orbi/orbi.controller';
import { CuotaDiaria } from '../../src/orbi/cuota-diaria';
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

function controlador(opts: { mensajes?: number; eventos?: () => AsyncGenerator<any> } = {}) {
  const llm = {
    streamChat: jest.fn(opts.eventos ?? (async function* () { yield { type: 'text', chunk: 'hola' }; yield { type: 'done' }; })),
  };
  const conversaciones = {
    assertPropia: jest.fn().mockResolvedValue('conv-1'),
    getMessages: jest.fn().mockResolvedValue(Array.from({ length: opts.mensajes ?? 0 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }))),
    getOrCreate: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    appendMessage: jest.fn().mockResolvedValue(undefined),
  };
  const contexto = { buildSystemPrompt: jest.fn().mockResolvedValue('system') };
  const tools = {
    getTools: jest.fn().mockReturnValue([{ name: 'listProducts' }]),
    proponer: jest.fn().mockReturnValue(null),
    execute: jest.fn().mockResolvedValue({ success: true, label: 'ok' }),
  };
  const analitica = { logAiTurn: jest.fn().mockResolvedValue(null) };
  const ctrl = new OrbiController(llm as any, { get: () => undefined } as any, conversaciones as any, contexto as any, tools as any, analitica as any, {} as any);
  return { ctrl, llm, tools };
}

const chatPanel = (conversationId?: string) => ({ message: 'hola', conversationId, context: { surface: OrbiSurface.PANEL } }) as any;

describe('Cuota diaria', () => {
  afterEach(() => jest.useRealTimers());

  it('corta al llegar al máximo del día y se renueva al día siguiente (hora de Argentina)', () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T15:00:00Z') });
    const cuota = new CuotaDiaria();
    for (let i = 0; i < 3; i++) expect(cuota.consumir('negocio:biz-1', 3)).toBe(true);
    expect(cuota.consumir('negocio:biz-1', 3)).toBe(false);
    expect(cuota.consumir('negocio:biz-2', 3)).toBe(true); // otro negocio, su propia cuota
    jest.setSystemTime(new Date('2026-09-11T03:00:01Z')); // 00:00 del 11/09 en Argentina
    expect(cuota.consumir('negocio:biz-1', 3)).toBe(true);
  });

  it('el chat del panel, pasado el tope del negocio, da 429 antes de llamar al modelo', async () => {
    const { ctrl, llm } = controlador();
    (ctrl as any).cuota = { consumir: () => false };
    const err = await ctrl.chat(chatPanel(), respuesta(), miembro).catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(llm.streamChat).not.toHaveBeenCalled();
  });

  it('el wizard, pasado el tope por IP, también', async () => {
    const { ctrl, llm } = controlador();
    (ctrl as any).cuota = { consumir: () => false };
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
    const guardada = { id: 'conv-1', messages: Array.from({ length: 200 }, (_, i) => ({ role: 'user', content: `m${i}`, timestamp: '' })) };
    const prisma = { orbiConversation: { findFirst: jest.fn().mockResolvedValue(guardada), update: jest.fn() } };
    await new ConversationService(prisma as any).appendMessage('conv-1', 'biz-1', 'm-1', { role: 'user', content: 'nuevo', timestamp: '' });
    const { messages } = prisma.orbiConversation.update.mock.calls[0][0].data;
    expect(messages).toHaveLength(200);
    expect(messages[199].content).toBe('nuevo');
    expect(messages[0].content).toBe('m1');
  });
});
