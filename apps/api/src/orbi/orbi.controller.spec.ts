import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrbiController } from './orbi.controller';
import { LLM_ADAPTER, type LlmAdapter } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';
import { PendingActionStore } from './tools/pending-action.store';
import { OrbiSurface } from './dto/orbi-chat.dto';

function createMockResponse() {
  const chunks: string[] = [];
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((data: string) => chunks.push(data)),
    end: jest.fn(),
    chunks,
  };
}

describe('OrbiController', () => {
  let controller: OrbiController;
  let mockLlm: LlmAdapter;
  let registry: { getTools: jest.Mock; execute: jest.Mock };

  beforeEach(async () => {
    registry = {
      getTools: jest.fn().mockReturnValue([]),
      execute: jest.fn(),
    };

    mockLlm = {
      async *streamChat() {
        yield { type: 'text' as const, chunk: 'Hola, ' };
        yield { type: 'text' as const, chunk: 'soy Orbi' };
        yield { type: 'done' as const };
      },
    };

    const module = await Test.createTestingModule({
      controllers: [OrbiController],
      providers: [
        { provide: LLM_ADAPTER, useValue: mockLlm },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        {
          provide: ConversationService,
          useValue: {
            getOrCreate: jest.fn().mockResolvedValue({ id: 'conv-1' }),
            appendMessage: jest.fn().mockResolvedValue(undefined),
            getMessages: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ContextBuilderService,
          useValue: {
            buildSystemPrompt: jest.fn().mockResolvedValue('Sos Orbi, el asistente de IA.'),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: registry,
        },
        {
          // La telemetría del turno no puede afectar la respuesta que el
          // usuario está esperando (ver el finally del controller): devolver
          // null acá es el caso "no se pudo registrar", y el stream tiene que
          // terminar igual de bien.
          provide: WizardAnalyticsService,
          useValue: { logAiTurn: jest.fn().mockResolvedValue(null) },
        },
        // El store real: es en memoria y no toca nada afuera, así que no hay
        // motivo para mockearlo — y así los tests ejercitan el flujo de verdad.
        PendingActionStore,
      ],
    }).compile();

    controller = module.get(OrbiController);
  });

  it('no muestra el texto que el modelo dijo ANTES de llamar una tool (manda text_reset)', async () => {
    // Gemini 3.x manda un mensaje completo al usuario ANTES del functionCall, y
    // otro DESPUÉS de tener el resultado. Sin el reset, el front concatena los
    // dos en la misma burbuja (el bug del saludo repetido).
    registry.getTools.mockReturnValue([{ name: 'selectWizardOption' }]);
    registry.execute.mockResolvedValue({ success: true, label: 'Elegir: Tienda' });
    let vuelta = 0;
    mockLlm.streamChat = async function* () {
      vuelta += 1;
      if (vuelta === 1) {
        yield { type: 'text' as const, chunk: 'Hola, elegí la opción de abajo:' };
        yield { type: 'tool_call' as const, call: { id: 'c1', name: 'selectWizardOption', arguments: {} } };
        yield { type: 'done' as const };
      } else {
        yield { type: 'text' as const, chunk: 'Listo, tocá el botón de Tienda.' };
        yield { type: 'done' as const };
      }
    };

    const res = createMockResponse();
    await controller.chatWizard(
      { message: 'hola', context: { surface: OrbiSurface.WIZARD } } as any,
      res as any,
    );

    const all = res.chunks.join('');
    expect(all).toContain('event: text_reset\ndata: {}\n\n');
    // El texto post-tool sí se manda; el preámbulo también se streameó pero el
    // front lo descarta con el reset.
    expect(all).toContain('Listo, tocá el botón de Tienda.');
  });

  it('en un turno con tool, la segunda vuelta pide el MISMO modelo que la primera', async () => {
    // Regresión: `modelo` era una sola variable que hacía de entrada (el ID que
    // se le pide al proveedor) y de acumulador de analítica (el nombre que
    // reporta el evento `usage`). La primera vuelta la pisaba con el nombre
    // reportado —que no siempre es un ID pedible— y la segunda se lo mandaba a
    // Gemini: 404 Not Found. Como un 404 no es error de disponibilidad, tampoco
    // caía al fallback de Groq, y al usuario le llegaba "Error procesando tu
    // mensaje" justo después de que la tool ya había respondido.
    registry.getTools.mockReturnValue([{ name: 'selectWizardOption' }]);
    registry.execute.mockResolvedValue({ success: true, label: 'Elegir: Tienda' });

    const modelosPedidos: (string | undefined)[] = [];
    let vuelta = 0;
    mockLlm.streamChat = async function* (params: { model?: string }) {
      modelosPedidos.push(params.model);
      vuelta += 1;
      if (vuelta === 1) {
        yield { type: 'tool_call' as const, call: { id: 'c1', name: 'selectWizardOption', arguments: {} } };
        // El nombre que devuelve la API NO es el ID que se le pide.
        yield { type: 'usage' as const, usage: { model: 'models/gemini-3-pro-preview-11-2025', promptTokens: 10, completionTokens: 5 } };
        yield { type: 'done' as const };
      } else {
        yield { type: 'text' as const, chunk: 'Listo.' };
        yield { type: 'done' as const };
      }
    } as typeof mockLlm.streamChat;

    const res = createMockResponse();
    await controller.chatWizard(
      { message: 'hola', context: { surface: OrbiSurface.WIZARD } } as any,
      res as any,
    );

    expect(modelosPedidos).toHaveLength(2);
    expect(modelosPedidos[1]).toBe(modelosPedidos[0]);
    expect(modelosPedidos[1]).not.toBe('models/gemini-3-pro-preview-11-2025');
    // Y el turno termina bien, sin el evento de error.
    expect(res.chunks.join('')).not.toContain('event: error');
  });

  it('POST /orbi/chat/wizard returns text/event-stream with chunks', async () => {
    const res = createMockResponse();
    await controller.chatWizard(
      { message: 'Hola', context: { surface: OrbiSurface.WIZARD } } as any,
      res as any,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.chunks).toContain('event: text\ndata: {"chunk":"Hola, "}\n\n');
    expect(res.chunks).toContain('event: text\ndata: {"chunk":"soy Orbi"}\n\n');
    expect(res.chunks).toContain('event: done\ndata: {}\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('POST /orbi/chat streams SSE and persists conversation for panel', async () => {
    const res = createMockResponse();
    const user = {
      type: 'member' as const,
      memberId: 'member-1',
      businessId: 'biz-1',
      businessMode: 'FULL' as const,
      roleId: 'role-1',
      roleName: 'owner',
      permissions: [] as string[],
    };

    await controller.chat(
      { message: 'Hola', context: { surface: OrbiSurface.PANEL } } as any,
      res as any,
      user as any,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.chunks.some((c) => c.includes('event: text'))).toBe(true);
    expect(res.chunks.some((c) => c.includes('event: done'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  // Los permisos que decide qué tools ve y ejecuta Orbi tienen que salir del
  // JWT. Venían de dto.context.permissions — un campo del body — así que
  // cualquiera con sesión podía pedirse los de escritura y usarlos: las tools
  // llaman a los services directo, y PermissionsGuard solo corre sobre rutas
  // HTTP. El aislamiento entre negocios nunca dependió de esto (businessId
  // siempre salió del token), pero los roles adentro de un negocio sí.
  it('ignora los permisos que manda el cliente y usa los del token', async () => {
    const res = createMockResponse();
    const soloLectura = {
      type: 'member' as const,
      memberId: 'member-1',
      businessId: 'biz-1',
      businessMode: 'FULL' as const,
      roleId: 'role-1',
      roleName: 'vendedor',
      permissions: [] as string[],
    };

    await controller.chat(
      {
        message: 'Hola',
        context: {
          surface: OrbiSurface.PANEL,
          permissions: ['products:write', 'discounts:write', 'orders:write', 'config:write'],
        },
      } as any,
      res as any,
      soloLectura as any,
    );

    expect(registry.getTools).toHaveBeenCalledWith(OrbiSurface.PANEL, [], undefined);
  });

  // Orbi existe en el panel y en el wizard. En el storefront no, y este
  // endpoint es la única puerta al panel. Un cliente de una tienda tiene JWT
  // válido y pasa el AuthGuard, así que sin esta puerta se quedaba con las
  // tools de lectura del panel (que no piden permisos).
  it('un cliente del storefront no puede usar el Orbi del panel', async () => {
    const res = createMockResponse();
    const cliente = {
      type: 'customer' as const,
      customerId: 'cust-1',
      businessId: 'biz-1',
      businessMode: 'FULL' as const,
    };

    await expect(
      controller.chat(
        { message: 'listame los pedidos', context: { surface: OrbiSurface.PANEL } } as any,
        res as any,
        cliente as any,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(registry.getTools).not.toHaveBeenCalled();
  });
});
