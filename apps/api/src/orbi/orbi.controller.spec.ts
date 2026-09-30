import { Test } from '@nestjs/testing';
import { DemoIaService } from '../demo/demo-ia.service';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrbiController } from './orbi.controller';
import { LLM_ADAPTER, type LlmAdapter } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';
import { PendingActionStore } from './tools/pending-action.store';
import { UsageMeteringService } from '../platform/costs/usage-metering.service';
import { CuotaService } from '../common/cuota/cuota.service';
import { OrbiSurface } from './dto/orbi-chat.dto';
import { CODIGOS_DEL_CATALOGO } from '../common/permisos/catalogo';

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
  let registry: { getTools: jest.Mock; execute: jest.Mock; proponer: jest.Mock };
  let contextBuilder: { buildSystemPrompt: jest.Mock };

  // El wizard hashea la IP con JWT_SECRET para la clave de la cuota diaria.
  beforeAll(() => {
    process.env.JWT_SECRET ??= 'secreto-de-prueba-de-al-menos-32-caracteres';
  });

  beforeEach(async () => {
    registry = {
      getTools: jest.fn().mockReturnValue([]),
      execute: jest.fn(),
      proponer: jest.fn().mockResolvedValue(null),
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
        // Cuota de la demo pública: el interceptor de la ruta /chat la pide.
        { provide: DemoIaService, useValue: { consumir: jest.fn(), devolver: jest.fn() } },
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
        { provide: UsageMeteringService, useValue: { track: jest.fn() } },
        // La cuota diaria vive en Postgres: acá siempre hay cupo.
        { provide: CuotaService, useValue: { consumir: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    controller = module.get(OrbiController);
    contextBuilder = module.get(ContextBuilderService);
  });

  it('el texto que el modelo dice ANTES de llamar una tool NUNCA llega al cliente', async () => {
    // Gemini 3.x manda un mensaje completo al usuario ANTES del functionCall, y
    // otro DESPUÉS de tener el resultado. Ese preámbulo hay que descartarlo (si
    // no, el front concatena los dos en la misma burbuja — el bug del saludo
    // repetido).
    //
    // Antes se streameaba y se pisaba con un text_reset: el usuario veía
    // aparecer un texto que después desaparecía. Ahora, con herramientas
    // disponibles, la vuelta se bufferea y el preámbulo se tira sin haber
    // salido: no hace falta ningún reset porque nunca se mandó nada.
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
    expect(all).not.toContain('Hola, elegí la opción de abajo:');
    expect(all).not.toContain('event: text_reset');
    // La respuesta de verdad sí sale, y sale entera de una sola vez.
    expect(all).toContain('Listo, tocá el botón de Tienda.');
  });

  it('sin herramientas en el paso, el texto se streamea chunk por chunk', async () => {
    // El buffering es SOLO para las vueltas con tools. En un paso sin
    // herramientas (ej. "cuenta") no hay preámbulo que descartar, así que se
    // sigue streameando en vivo, que es donde el streaming se nota.
    registry.getTools.mockReturnValue([]);
    mockLlm.streamChat = async function* () {
      yield { type: 'text' as const, chunk: 'Una ' };
      yield { type: 'text' as const, chunk: 'contraseña ' };
      yield { type: 'text' as const, chunk: 'larga.' };
      yield { type: 'done' as const };
    };

    const res = createMockResponse();
    await controller.chatWizard(
      { message: 'que contraseña pongo?', context: { surface: OrbiSurface.WIZARD, stepName: 'cuenta' } } as any,
      res as any,
    );

    const all = res.chunks.join('');
    expect(all).toContain(JSON.stringify({ chunk: 'Una ' }));
    expect(all).toContain(JSON.stringify({ chunk: 'contraseña ' }));
    expect(all).toContain(JSON.stringify({ chunk: 'larga.' }));
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
          permissions: ['catalog.manage', 'discounts.manage', 'orders.manage', 'config.edit'],
        },
      } as any,
      res as any,
      soloLectura as any,
    );

    expect(registry.getTools).toHaveBeenCalledWith(OrbiSurface.PANEL, [], undefined, { soloLectura: false });
  });

  // El dueño no depende de filas de permisos (igual que PermissionsGuard): Orbi
  // le tiene que dar el catálogo completo aunque su lista venga vacía, tanto en
  // el chat como al confirmar. Si no, un permiso nuevo lo dejaría sin tools.
  it('el dueño recibe todos los permisos del catálogo en las tools, y un rol común solo los suyos', async () => {
    const usuario = (roleName: string, permissions: string[]) => ({
      type: 'member' as const, memberId: 'member-1', businessId: 'biz-1', businessMode: 'FULL' as const,
      roleId: 'role-1', roleName, permissions,
    });

    await controller.chat(
      { message: 'Hola', context: { surface: OrbiSurface.PANEL } } as any,
      createMockResponse() as any,
      usuario('owner', []) as any,
    );
    expect(registry.getTools).toHaveBeenLastCalledWith(OrbiSurface.PANEL, CODIGOS_DEL_CATALOGO, undefined, { soloLectura: false });

    await controller.chat(
      { message: 'Hola', context: { surface: OrbiSurface.PANEL } } as any,
      createMockResponse() as any,
      usuario('empleado', ['orders.view']) as any,
    );
    expect(registry.getTools).toHaveBeenLastCalledWith(OrbiSurface.PANEL, ['orders.view'], undefined, { soloLectura: false });
  });

  // Escrituras seguras (spec §3.2): cuando los argumentos que armó el modelo no
  // pasan el DTO del endpoint, no hay tarjeta ni acción pendiente — el modelo
  // recibe el error como resultado de la tool y puede corregir o explicarlo.
  describe('propuestas de escritura', () => {
    const duenio = {
      type: 'member' as const, memberId: 'member-1', businessId: 'biz-1', businessMode: 'FULL' as const,
      roleId: 'role-1', roleName: 'owner', permissions: [] as string[],
    };

    function llmQuePide(llamada: { name: string; arguments: Record<string, unknown> }) {
      const vistos: { role: string; content: string }[][] = [];
      let vuelta = 0;
      mockLlm.streamChat = async function* (req: { messages: { role: string; content: string }[] }) {
        vistos.push([...req.messages]);
        vuelta += 1;
        if (vuelta === 1) {
          yield { type: 'tool_call' as const, call: { id: 'c1', ...llamada } };
          yield { type: 'done' as const };
        } else {
          yield { type: 'text' as const, chunk: 'Listo.' };
          yield { type: 'done' as const };
        }
      } as any;
      return vistos;
    }

    it('si proponer devuelve { error }, el modelo lo recibe como fallo de la tool y no hay action_pending', async () => {
      registry.getTools.mockReturnValue([{ name: 'createCoupon' }]);
      registry.proponer.mockResolvedValue({ error: 'code: El código solo puede tener letras, números, guion y guion bajo' });
      const vistos = llmQuePide({ name: 'createCoupon', arguments: { code: 'NO VALE!' } });

      const res = createMockResponse();
      await controller.chat({ message: 'Hacé un cupón', context: { surface: OrbiSurface.PANEL } } as any, res as any, duenio as any);

      const todo = res.chunks.join('');
      expect(todo).not.toContain('event: action_pending');
      expect(registry.execute).not.toHaveBeenCalled();
      const resultado = vistos[1].find(m => m.role === 'tool');
      expect(JSON.parse(resultado!.content)).toEqual({
        success: false,
        error: 'code: El código solo puede tener letras, números, guion y guion bajo',
      });
    });

    it('con { resumen } sí hay action_pending', async () => {
      registry.getTools.mockReturnValue([{ name: 'createCoupon' }]);
      registry.proponer.mockResolvedValue({ resumen: 'Crear el cupón "VERANO"' });
      llmQuePide({ name: 'createCoupon', arguments: { code: 'VERANO' } });

      const res = createMockResponse();
      await controller.chat({ message: 'Hacé un cupón', context: { surface: OrbiSurface.PANEL } } as any, res as any, duenio as any);
      expect(res.chunks.join('')).toContain('event: action_pending');
    });

    it('en la demo, proponer y execute reciben soloLectura: true', async () => {
      registry.getTools.mockReturnValue([{ name: 'listProducts' }]);
      registry.execute.mockResolvedValue({ success: false, error: 'no', label: 'no' });
      llmQuePide({ name: 'createCoupon', arguments: { code: 'VERANO' } });

      await controller.chat(
        { message: 'Hacé un cupón', context: { surface: OrbiSurface.PANEL } } as any,
        createMockResponse() as any,
        { ...duenio, readOnly: true } as any,
      );
      expect(registry.proponer).toHaveBeenCalledWith('createCoupon', { code: 'VERANO' }, expect.anything(), undefined, { soloLectura: true });
      expect(registry.execute).toHaveBeenCalledWith('createCoupon', { code: 'VERANO' }, expect.anything(), undefined, { soloLectura: true });
    });
  });

  it('el prompt del sistema se arma con los permisos efectivos del usuario', async () => {
    const usuario = {
      type: 'member' as const, memberId: 'member-1', businessId: 'biz-1', businessMode: 'FULL' as const,
      roleId: 'role-1', roleName: 'empleado', permissions: ['orders.view'],
    };
    const dto = { message: 'Hola', context: { surface: OrbiSurface.PANEL, module: 'pedidos' } } as any;
    await controller.chat(dto, createMockResponse() as any, usuario as any);
    expect(contextBuilder.buildSystemPrompt).toHaveBeenLastCalledWith(expect.anything(), ['orders.view']);
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
