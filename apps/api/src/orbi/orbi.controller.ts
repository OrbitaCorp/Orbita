import { Controller, Post, Body, Res, HttpCode, Inject, Logger, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { OrbiChatDto, OrbiSurface } from './dto/orbi-chat.dto';
import { LLM_ADAPTER, type LlmAdapter, type LlmMessage } from './llm/llm-adapter.interface';
import { ConversationService } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import type { ToolExecutionContext } from './tools/tool.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';
import type { AuthContext } from '../common/types/auth-context.type';

@Controller('orbi')
export class OrbiController {
  private readonly logger = new Logger(OrbiController.name);

  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LlmAdapter,
    private readonly conversationService: ConversationService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly wizardAnalytics: WizardAnalyticsService,
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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      let conversationId = dto.conversationId;
      let history: LlmMessage[] = [];

      if (dto.context.surface === OrbiSurface.PANEL) {
        const conv = conversationId
          ? { id: conversationId }
          : await this.conversationService.getOrCreate(user.businessId, user.memberId, 'panel');
        conversationId = conv.id;

        if (dto.conversationId) {
          const msgs = await this.conversationService.getMessages(conversationId);
          history = msgs.map(m => ({ role: m.role, content: m.content }));
        }

        await this.conversationService.appendMessage(conversationId, {
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
        for await (const event of this.llm.streamChat({ messages, tools: tools.length ? tools : undefined })) {
          if (event.type === 'text') {
            fullResponse += event.chunk;
            res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
          } else if (event.type === 'tool_call') {
            const stepId = `step-${Date.now()}`;
            res.write(`event: action_start\ndata: ${JSON.stringify({ id: stepId, label: event.call.name, tool: event.call.name })}\n\n`);

            const result = await this.toolRegistry.execute(event.call.name, event.call.arguments, toolCtx, dto.context.stepName);

            res.write(`event: action_complete\ndata: ${JSON.stringify({ id: stepId, result: result.label, data: result.data })}\n\n`);

            messages.push({
              role: 'assistant',
              content: '',
              toolCalls: [{ id: event.call.id, name: event.call.name, arguments: event.call.arguments }],
            });
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              toolCallId: event.call.id,
            });
            continueLoop = true;
          } else if (event.type === 'done') {
            if (!continueLoop) {
              res.write(`event: done\ndata: {}\n\n`);
            }
          }
        }
      }

      if (dto.context.surface === OrbiSurface.PANEL && conversationId) {
        await this.conversationService.appendMessage(conversationId, {
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
    let modelo: string | undefined;
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
        for await (const event of this.llm.streamChat({ messages, tools: tools.length ? tools : undefined })) {
          if (event.type === 'text') {
            respuesta += event.chunk;
            res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
          } else if (event.type === 'tool_call') {
            toolsUsadas.push(event.call.name);
            const stepId = `step-${Date.now()}`;
            res.write(`event: action_start\ndata: ${JSON.stringify({ id: stepId, label: event.call.name, tool: event.call.name })}\n\n`);

            const result = await this.toolRegistry.execute(event.call.name, event.call.arguments, toolCtx, dto.context.stepName);

            res.write(`event: action_complete\ndata: ${JSON.stringify({ id: stepId, result: result.label, data: result.data })}\n\n`);

            messages.push({
              role: 'assistant',
              content: '',
              toolCalls: [{ id: event.call.id, name: event.call.name, arguments: event.call.arguments }],
            });
            messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId: event.call.id });
            continueLoop = true;
          } else if (event.type === 'usage') {
            modelo = event.usage.model;
            promptTokens += event.usage.promptTokens;
            completionTokens += event.usage.completionTokens;
          } else if (event.type === 'done') {
            if (!continueLoop) res.write(`event: done\ndata: {}\n\n`);
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
        model: modelo,
        promptTokens: promptTokens || undefined,
        completionTokens: completionTokens || undefined,
      });
      if (turnId) res.write(`event: turn\ndata: ${JSON.stringify({ turnId })}\n\n`);
      res.end();
    }
  }
}
