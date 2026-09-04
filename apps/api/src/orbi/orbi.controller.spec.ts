import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrbiController } from './orbi.controller';
import { LLM_ADAPTER, type LlmAdapter } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';
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
      ],
    }).compile();

    controller = module.get(OrbiController);
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
