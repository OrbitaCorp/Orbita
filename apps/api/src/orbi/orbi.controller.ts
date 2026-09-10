import { Controller, Post, Body, Res, HttpCode, Inject, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ConfirmActionDto, OrbiChatDto, OrbiSurface } from './dto/orbi-chat.dto';
import { LLM_ADAPTER, type LlmAdapter, type LlmMessage } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import type { ToolExecutionContext, ToolResult } from './tools/tool.interface';
import { PendingActionStore } from './tools/pending-action.store';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';
import type { AuthContext } from '../common/types/auth-context.type';

@Controller('orbi')
export class OrbiController {
  private readonly logger = new Logger(OrbiController.name);

  /**
   * Modelo de Gemini para esta superficie. El panel puede correr un modelo más
   * capaz que el wizard: se controla por env (ORBI_MODEL_PANEL /
   * ORBI_MODEL_WIZARD, con fallback a ORBI_MODEL) sin deploy de código.
   * undefined = el adapter usa su default.
   */
  private modeloPara(surface: OrbiSurface): string | undefined {
    const key = surface === OrbiSurface.PANEL ? 'ORBI_MODEL_PANEL' : 'ORBI_MODEL_WIZARD';
    return this.config.get<string>(key) ?? this.config.get<string>('ORBI_MODEL') ?? undefined;
  }

  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LlmAdapter,
    private readonly config: ConfigService,
    private readonly conversationService: ConversationService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly wizardAnalytics: WizardAnalyticsService,
    private readonly pendingActions: PendingActionStore,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(
    @Body() dto: OrbiChatDto,
    @Res() res: Response,
    @CurrentUser() user: AuthContext,
  ) {
    // Orbi vive en exactamente dos lugares: el panel administrativo y el
    // wizard de alta. En el storefront NO existe, y este endpoint es la única
    // puerta al panel — así que la puerta lo dice explícitamente.
    //
    // Sin esto, un cliente logueado de una tienda (que tiene JWT válido y pasa
    // el AuthGuard) podía postear surface:'panel' y quedarse con las tools de
    // lectura, que no piden ningún permiso: navigateTo, listProducts,
    // listOrders, listCustomers, getOrderDetail. Devolvían vacío porque el
    // businessId de un customer no se propaga, pero eso es que salga bien de
    // casualidad, no una defensa. El panel es de los miembros.
    if (user.type !== 'member') {
      throw new ForbiddenException('Orbi solo está disponible para miembros del negocio');
    }

    // El negocio SIEMPRE sale del token, nunca del body (auditoria interna
    // 09/09, item `api.common`, verificaciones 3 y 6).
    //
    // Hasta aca, buildSystemPrompt() leia `dto.context.businessId` tal cual lo
    // mandaba el cliente y armaba el prompt con los datos de ESE negocio. Como
    // el alta de negocios es publica y el id de cualquier tienda se obtiene sin
    // autenticarse desde GET /storefront/<slug>, cualquiera podia crearse un
    // negocio propio, mandar el id de un competidor y pedirle a Orbi que le
    // repita el contexto: facturacion, ticket promedio, segmentacion de
    // clientes y el nombre del mejor cliente de un tercero. Se pisa el valor
    // en vez de rechazarlo para que un panel con el id viejo en memoria siga
    // funcionando contra el negocio correcto.
    dto.context.businessId = user.businessId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      let conversationId = dto.conversationId;
      let history: LlmMessage[] = [];

      if (dto.context.surface === OrbiSurface.PANEL) {
        // El id de la conversación viene del cliente: se verifica que sea de
        // ESTE negocio y de ESTA persona antes de leerla o escribirle nada
        // (ver ConversationService#propia). Antes se usaba tal cual.
        if (conversationId) {
          conversationId = await this.conversationService.assertPropia(conversationId, user.businessId, user.memberId);
          const msgs = await this.conversationService.getMessages(conversationId, user.businessId, user.memberId);
          history = msgs.map(m => ({ role: m.role, content: m.content }));
        } else {
          const conv = await this.conversationService.getOrCreate(user.businessId, user.memberId, 'panel');
          conversationId = conv.id;
        }

        await this.conversationService.appendMessage(conversationId, user.businessId, user.memberId, {
          role: 'user',
          content: dto.message,
          timestamp: new Date().toISOString(),
        });
      }

      const systemPrompt = await this.contextBuilder.buildSystemPrompt(dto);
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: dto.message },
      ];

      // Los permisos salen del JWT, NO de dto.context.permissions. El front
      // manda sus permisos en el contexto (útil para que la UI sepa qué
      // ofrecer), pero eso es un dato del cliente y el cliente miente: quien
      // solo tuviera lectura podía postear
      // `context.permissions: ["products:write","config:write",...]` y Orbi le
      // exponía y ejecutaba las tools de escritura. PermissionsGuard no lo
      // frenaba porque solo corre sobre rutas HTTP, y estas tools llaman a los
      // services directamente. El businessId ya salía del token, así que el
      // aislamiento entre negocios nunca estuvo comprometido — sí los roles
      // adentro de un mismo negocio.
      //
      // businessId también sale del token, y ninguna tool acepta un businessId
      // por parámetro (ver el test del catálogo): el modelo no tiene forma de
      // nombrar otro negocio ni siquiera si se lo piden. El aislamiento no
      // depende de que Orbi se porte bien.
      const tools = this.toolRegistry.getTools(dto.context.surface, user.permissions, dto.context.stepName);
      const modelo = this.modeloPara(dto.context.surface);
      const toolCtx: ToolExecutionContext = {
        businessId: user.businessId,
        userId: user.memberId,
        surface: dto.context.surface,
        permissions: user.permissions,
      };

      let fullResponse = '';

      let continueLoop = true;
      while (continueLoop) {
        continueLoop = false;
        // Ver la nota en chatWizard: Gemini 3.x habla antes Y después de la
        // tool; el preámbulo se streamea pero se descarta con text_reset si la
        // vuelta termina llamando una tool.
        let textoVuelta = '';
        let resetEnviado = false;
        for await (const event of this.llm.streamChat({ messages, tools: tools.length ? tools : undefined, model: modelo })) {
          if (event.type === 'text') {
            textoVuelta += event.chunk;
            if (!resetEnviado) res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
          } else if (event.type === 'tool_call') {
            if (textoVuelta.trim() && !resetEnviado) {
              res.write(`event: text_reset\ndata: {}\n\n`);
              resetEnviado = true;
            }
            const stepId = `step-${Date.now()}`;

            // Las herramientas que ESCRIBEN no se ejecutan acá: se proponen.
            // El usuario ve un botón con lo que va a pasar y la escritura
            // ocurre recién si hace clic (ver POST /orbi/confirm).
            //
            // Es la defensa contra la inyección indirecta de RBT-695: el texto
            // que escribe un cliente de la tienda vuelve al contexto del modelo
            // como resultado de listOrders o getOrderDetail, y puede
            // convencerlo de PEDIR un cupón del 100% — pero no puede hacer clic
            // por el dueño del negocio.
            const propuesta = this.toolRegistry.proponer(
              event.call.name,
              event.call.arguments,
              toolCtx,
              dto.context.stepName,
            );

            if (propuesta) {
              const actionId = this.pendingActions.crear({
                tool: event.call.name,
                args: event.call.arguments,
                businessId: user.businessId,
                memberId: user.memberId,
                resumen: propuesta.resumen,
              });

              res.write(`event: action_pending\ndata: ${JSON.stringify({
                id: stepId,
                actionId,
                tool: event.call.name,
                resumen: propuesta.resumen,
              })}\n\n`);

              // Lo que ve el modelo. Importa que diga que quedó PENDIENTE y no
              // que falló: si le decimos que falló, reintenta en loop; si le
              // decimos que salió bien, le cuenta al usuario que ya está hecho
              // cuando todavía no apretó nada.
              messages.push({
                role: 'assistant',
                content: '',
                toolCalls: [{ id: event.call.id, name: event.call.name, arguments: event.call.arguments, thoughtSignature: event.call.thoughtSignature }],
              });
              messages.push({
                role: 'tool',
                content: JSON.stringify({
                  estado: 'pendiente_de_confirmacion',
                  mensaje:
                    'La acción NO se ejecutó todavía. El usuario tiene en pantalla un botón para confirmarla. ' +
                    'Contale en una línea qué va a pasar si lo aprieta. No digas que ya está hecho.',
                }),
                toolCallId: event.call.id,
              });
              continueLoop = true;
              continue;
            }

            res.write(`event: action_start\ndata: ${JSON.stringify({ id: stepId, label: event.call.name, tool: event.call.name })}\n\n`);

            const result = await this.toolRegistry.execute(event.call.name, event.call.arguments, toolCtx, dto.context.stepName);

            res.write(`event: action_complete\ndata: ${JSON.stringify({ id: stepId, result: result.label, data: result.data })}\n\n`);

            messages.push({
              role: 'assistant',
              content: '',
              toolCalls: [{ id: event.call.id, name: event.call.name, arguments: event.call.arguments, thoughtSignature: event.call.thoughtSignature }],
            });
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              toolCallId: event.call.id,
            });
            continueLoop = true;
          } else if (event.type === 'done') {
            if (!continueLoop) {
              fullResponse += textoVuelta;
              res.write(`event: done\ndata: {}\n\n`);
            }
          }
        }
      }

      if (dto.context.surface === OrbiSurface.PANEL && conversationId) {
        await this.conversationService.appendMessage(conversationId, user.businessId, user.memberId, {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Orbi chat error: ${error}`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Error procesando tu mensaje' })}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * Ejecuta de verdad una acción que Orbi propuso y la persona confirmó.
   *
   * Recibe SOLO el id de la propuesta. La herramienta y los argumentos viven
   * en el servidor (PendingActionStore) — si vinieran del cliente, esto sería
   * el mismo agujero de antes con un paso más: cualquiera podría saltearse a
   * Orbi y postear la escritura que quisiera.
   */
  @Post('confirm')
  @HttpCode(200)
  async confirm(
    @Body() dto: ConfirmActionDto,
    @CurrentUser() user: AuthContext,
  ): Promise<ToolResult> {
    if (user.type !== 'member') {
      throw new ForbiddenException('Orbi solo está disponible para miembros del negocio');
    }

    // consumir() valida que la propuesta exista, no haya vencido, y sea de
    // ESTE negocio y ESTA persona. Y la borra: un botón no se aprieta dos
    // veces para crear dos cupones.
    const accion = this.pendingActions.consumir(dto.actionId, user.businessId, user.memberId);
    if (!accion) {
      throw new NotFoundException('Esa acción ya no está disponible. Pedísela a Orbi de nuevo.');
    }

    // Los permisos se vuelven a chequear acá dentro contra el JWT de AHORA, no
    // contra los de cuando se propuso: entre una cosa y la otra le pueden haber
    // sacado el permiso a la persona.
    return this.toolRegistry.execute(accion.tool, accion.args, {
      businessId: user.businessId,
      userId: user.memberId,
      surface: OrbiSurface.PANEL,
      permissions: user.permissions,
    });
  }

  @Post('chat/wizard')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // sin auth: 10 mensajes/min por IP
  async chatWizard(@Body() dto: OrbiChatDto, @Res() res: Response) {
    dto.context.surface = OrbiSurface.WIZARD;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Telemetría del turno (ver wizard-analytics/). Se mide acá y no en el
    // front porque el servidor es el único que ve la respuesta completa, la
    // latencia real y qué tools terminó disparando el modelo.
    const arrancoEn = Date.now();
    let respuesta = '';
    const toolsUsadas: string[] = [];
    let fallo = false;
    // Un turno con herramientas son VARIAS llamadas al modelo (llamar la tool,
    // recibir el resultado, volver a hablar). Se suman: lo que interesa es lo
    // que costó el turno completo, que es la unidad que ve el usuario.
    // OJO: son DOS cosas distintas y antes eran una sola variable.
    //
    // `modeloPedido` es el ID que se le manda al proveedor y NO se toca: un
    // turno con tool son varias vueltas del while de abajo, y todas tienen que
    // pedir el mismo modelo.
    //
    // `modeloReportado` es para la analítica: el evento `usage` trae el nombre
    // tal como lo devuelve la API, que NO siempre es un ID pedible. Cuando esto
    // era una variable sola, la primera vuelta la pisaba con ese nombre y la
    // segunda se lo mandaba a Gemini como modelo → 404 Not Found, que además no
    // es error de disponibilidad y por eso tampoco caía al fallback de Groq. Se
    // veía como "Error procesando tu mensaje" justo después de que la tool ya
    // había respondido.
    const modeloPedido: string | undefined = this.modeloPara(OrbiSurface.WIZARD);
    let modeloReportado: string | undefined = modeloPedido;
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const systemPrompt = await this.contextBuilder.buildSystemPrompt(dto);
      // Acotado server-side (últimos 16) sin importar cuánto mande el
      // cliente — cota de tokens/costo en un endpoint público sin auth.
      const history: LlmMessage[] = (dto.history ?? [])
        .slice(-16)
        .map(m => ({ role: m.role, content: m.content }));
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: dto.message },
      ];

      // Sin businessId todavía: el negocio recién se crea al final del
      // onboarding (ver useOnboardingStore.ts) — las tools del wizard
      // (sugerir nombre/descripción, precargar campo) no tocan la base.
      const tools = this.toolRegistry.getTools(OrbiSurface.WIZARD, [], dto.context.stepName);
      const toolCtx: ToolExecutionContext = {
        businessId: '',
        userId: '',
        surface: OrbiSurface.WIZARD,
        permissions: [],
        // Para que selectWizardOption pueda rechazar un key inventado.
        availableOptions: dto.context.availableOptions,
      };

      let continueLoop = true;
      while (continueLoop) {
        continueLoop = false;
        // Gemini 3.x manda un mensaje completo al usuario ANTES del functionCall
        // y otro DESPUÉS de tener el resultado. Se streamea el primero igual
        // (Orbi "pensando en voz alta"), pero si la vuelta termina llamando una
        // tool, se manda un text_reset para que el front descarte ese preámbulo
        // y quede solo la respuesta final. Sin esto el front concatenaba los dos
        // en la misma burbuja (bug del saludo repetido).
        let textoVuelta = '';
        let resetEnviado = false;
        for await (const event of this.llm.streamChat({ messages, tools: tools.length ? tools : undefined, model: modeloPedido })) {
          if (event.type === 'text') {
            textoVuelta += event.chunk;
            if (!resetEnviado) res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
          } else if (event.type === 'tool_call') {
            if (textoVuelta.trim() && !resetEnviado) {
              res.write(`event: text_reset\ndata: {}\n\n`);
              resetEnviado = true;
            }
            toolsUsadas.push(event.call.name);
            const stepId = `step-${Date.now()}`;
            res.write(`event: action_start\ndata: ${JSON.stringify({ id: stepId, label: event.call.name, tool: event.call.name })}\n\n`);

            const result = await this.toolRegistry.execute(event.call.name, event.call.arguments, toolCtx, dto.context.stepName);

            res.write(`event: action_complete\ndata: ${JSON.stringify({ id: stepId, result: result.label, data: result.data })}\n\n`);

            messages.push({
              role: 'assistant',
              content: '',
              toolCalls: [{ id: event.call.id, name: event.call.name, arguments: event.call.arguments, thoughtSignature: event.call.thoughtSignature }],
            });
            messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId: event.call.id });
            continueLoop = true;
          } else if (event.type === 'usage') {
            modeloReportado = event.usage.model;
            promptTokens += event.usage.promptTokens;
            completionTokens += event.usage.completionTokens;
          } else if (event.type === 'done') {
            // Solo la vuelta final (sin tool) cuenta como la respuesta de Orbi:
            // el preámbulo de las vueltas con tool ya se descartó con el reset.
            if (!continueLoop) {
              respuesta += textoVuelta;
              res.write(`event: done\ndata: {}\n\n`);
            }
          }
        }
      }
    } catch (error) {
      fallo = true;
      this.logger.error(`Orbi wizard chat error: ${error}`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Error procesando tu mensaje' })}\n\n`);
    } finally {
      // El id del turno viaja al front para que el pulgar arriba/abajo sepa
      // qué está votando. Va DESPUÉS del stream: si el registro falla,
      // simplemente no hay pulgar y la conversación no se entera de nada.
      const turnId = await this.wizardAnalytics.logAiTurn({
        sessionId: dto.context.sessionId,
        anonId: dto.context.anonId,
        step: dto.context.step,
        stepName: dto.context.stepName,
        rubro: dto.context.rubro,
        question: dto.message,
        answer: respuesta,
        latencyMs: Date.now() - arrancoEn,
        toolsUsed: toolsUsadas,
        errored: fallo,
        // undefined y no 0 cuando el proveedor no informó consumo: un 0 en la
        // base se promedia como si el turno hubiera sido gratis y ensucia
        // justamente el número que esto viene a medir.
        model: modeloReportado,
        promptTokens: promptTokens || undefined,
        completionTokens: completionTokens || undefined,
      });
      if (turnId) res.write(`event: turn\ndata: ${JSON.stringify({ turnId })}\n\n`);
      res.end();
    }
  }
}
