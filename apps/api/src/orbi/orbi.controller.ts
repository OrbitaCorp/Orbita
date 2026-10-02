import { Controller, Get, Post, Query, Body, Res, HttpCode, Inject, Logger, ForbiddenException, NotFoundException, ConflictException, HttpException, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { IpDelCliente } from '../common/decorators/ip-del-cliente.decorator';
import { ConfirmActionDto, OrbiChatDto, OrbiSurface, RejectActionDto } from './dto/orbi-chat.dto';
import { LLM_ADAPTER, type LlmAdapter, type LlmMessage, type LlmUsage } from './llm/llm-adapter.interface';
import { OrbiTurnService, type EstadoDelTurno } from './orbi-turn.service';
import { OrbiSaludService } from './salud/orbi-salud.service';
import { ConversationService, type ConversationMessage } from './conversation/conversation.service';
import { ContextBuilderService } from './context/context-builder.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import type { ToolExecutionContext, ToolResult } from './tools/tool.interface';
import { PendingActionService, type FilaPendiente } from './tools/pending-action.service';
import { notaDeCancelacion, notaDeConfirmacion, pantallaDe, ERROR_DESACTUALIZADA, ERROR_INTERNO } from './tools/acciones/nota-conversacion';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';
import { UsageMeteringService } from '../platform/costs/usage-metering.service';
import type { AuthContext } from '../common/types/auth-context.type';
import { CuotaService } from '../common/cuota/cuota.service';
import { hmacIp } from '../common/utils/hash-ip';
import { permisosDeOrbi } from './permisos-orbi';
import { resolverModuloDelPanel } from './navegacion/modulo-de-orbi';
import { ESCRITURA_EN_DEMO, ESCRITURA_NO_DISPONIBLE, MAX_VUELTAS_TOOLS, MENSAJE_VUELTAS, RESPUESTA_DE_PROPUESTA, vueltaDeTools } from './turno/vuelta';
import { DemoIa } from '../demo/demo-ia';
import { DemoIaInterceptor } from '../demo/demo-ia.interceptor';

// Topes de costo (auditoría interna 10/09, ítem api.orbi; hallazgo MEDIO del
// 04/09 "sin tope de gasto de IA"). Cada mensaje son una o varias llamadas
// pagas al modelo.
const TURNOS_DIA_NEGOCIO = 300; // mensajes por negocio y por día en el panel
const TURNOS_DIA_IP_WIZARD = 100; // mensajes por IP y por día en el wizard (público)
const HISTORIAL_PANEL = 30; // mensajes previos que se le mandan al modelo
const MENSAJE_CUOTA = 'Llegaste al máximo de mensajes a Orbi por hoy. Mañana se renueva.';
const MENSAJE_NO_DISPONIBLE = 'Esa acción ya no está disponible. Pedísela a Orbi de nuevo.';
const MENSAJE_APLICANDO = 'Esa acción se está aplicando. Esperá unos segundos.';
const MENSAJE_YA_APLICADA = 'Esa acción ya se aplicó: no se puede cancelar.';

// Lo que Orbi tiene que saber cuando lo usa un visitante de la demo pública
// (miembro readOnly, ver demo/demo-ia.ts). Va al final del prompt de
// sistema, así pisa cualquier invitación del prompt normal a hacer cambios.
export const PROMPT_DEMO = [
  'IMPORTANTE — DEMO PÚBLICA DE ÓRBITA.',
  'Estás hablando con un visitante que prueba la tienda DEMO de Órbita (Nébula Tech). No es el dueño: los datos de esta tienda son ficticios, cargados para mostrar cómo funciona Órbita.',
  'Dejá claro que es una demo cuando venga al caso (por ejemplo, la primera vez que respondas o si pregunta por "su" tienda).',
  'Respondé breve y concreto. Podés contar lo que muestran los datos de esta tienda demo y explicar cómo se usa Órbita.',
  'En la demo no podés crear, editar ni borrar nada. Si te piden un cambio, explicá en pocos pasos cómo se hace desde el panel y aclarales que en la demo no se aplica.',
  'No inventes precios, planes, límites ni detalles internos de la plataforma. Si no sabés algo, decí que lo pueden consultar con el equipo de Órbita.',
].join('\n');

/**
 * Lo que se le manda al modelo de la conversación guardada. Sin los mensajes
 * vacíos: el del usuario se guarda antes de llamar al modelo y la respuesta
 * solo si no hubo error, así que un turno fallido o cortado deja un `user` sin
 * respuesta, y una respuesta vacía queda como `assistant` vacío (spec §3.3).
 * Los `user` seguidos que quedan los une GeminiAdapter.
 *
 * Los últimos HISTORIAL_PANEL, no la conversación entera: antes cada mensaje
 * le mandaba al modelo todo lo anterior y el costo por mensaje crecía sin fin.
 */
function historialParaElModelo(guardados: ConversationMessage[]): LlmMessage[] {
  return guardados
    .filter(m => typeof m.content === 'string' && m.content.trim() !== '')
    .slice(-HISTORIAL_PANEL)
    .map(m => ({ role: m.role, content: m.content }));
}

/** Tokens de un turno, separados por quién respondió cada llamada. */
type ConsumoPorProveedor = Map<LlmUsage['provider'], { model: string; promptTokens: number; completionTokens: number }>;

/**
 * Suma el `usage` de una llamada al proveedor que la contestó. El fallback se
 * decide por llamada, así que un turno puede tener vueltas de Gemini y de Groq
 * (spec §3.6). El modelo que queda es el de la última llamada de ese proveedor.
 */
function sumarConsumo(consumo: ConsumoPorProveedor, u: LlmUsage): void {
  const previo = consumo.get(u.provider);
  consumo.set(u.provider, {
    model: u.model,
    promptTokens: (previo?.promptTokens ?? 0) + u.promptTokens,
    completionTokens: (previo?.completionTokens ?? 0) + u.completionTokens,
  });
}

/**
 * Los 409 de /orbi/confirm y /orbi/reject. Llevan su contrato (`estado`, y
 * `mensaje` o `result`, spec §3.4) y además `error` y `message`, que es lo que
 * lee el filtro global: sin ellos el 409 salía con `error: 'ConflictException'`
 * y sin texto, distinto de cualquier otro 409 de la API.
 */
function conflicto(
  cuerpo: { estado: 'aplicando' | 'desconocido'; mensaje: string } | { estado: 'ya_aplicada'; result: ToolResult },
): ConflictException {
  const message = 'mensaje' in cuerpo ? cuerpo.mensaje : MENSAJE_YA_APLICADA;
  return new ConflictException({ error: 'Conflict', message, ...cuerpo });
}

/**
 * Engancha el corte de la respuesta al cierre de la conexión (spec §3.7).
 * Node emite 'close' también después de un res.end() normal: solo es un corte
 * si la respuesta todavía no terminó.
 */
function corteAlCerrar(res: Response): AbortController {
  const corte = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) corte.abort();
  });
  // Si el cliente se fue ANTES de registrar el listener (durante el await de
  // la cuota), el 'close' ya se emitió y no se repite: sin esto el turno
  // entero se correría y se pagaría para nadie.
  if (!res.writableEnded && (res.destroyed || res.socket?.destroyed)) corte.abort();
  return corte;
}

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
    private readonly pendingActions: PendingActionService,
    private readonly usageMetering: UsageMeteringService,
    private readonly cuota: CuotaService,
    private readonly orbiTurns: OrbiTurnService,
    private readonly salud: OrbiSaludService,
  ) {}

  /**
   * Un `track` por proveedor, con prompt y completion por separado como
   * siempre. Antes se adivinaba el proveedor con `includes('groq')` sobre el
   * nombre del modelo, y openai/gpt-oss-120b (que corre en Groq) se cobraba
   * como Gemini. Sin await: track ya es best-effort y no puede demorar el
   * cierre del stream.
   */
  private medirConsumo(
    consumo: ConsumoPorProveedor,
    ctx: { feature: 'orbi-panel' | 'orbi-wizard'; businessId?: string; memberId: string | null; conversationId: string | null },
  ): void {
    for (const [proveedor, c] of consumo) {
      if (c.promptTokens <= 0 && c.completionTokens <= 0) continue;
      const comun = {
        providerSlug: proveedor,
        businessId: ctx.businessId,
        unit: 'tokens',
        metadata: { feature: ctx.feature, model: c.model, memberId: ctx.memberId, conversationId: ctx.conversationId },
      };
      void this.usageMetering.track({ ...comun, category: 'prompt_tokens', quantity: c.promptTokens });
      void this.usageMetering.track({ ...comun, category: 'completion_tokens', quantity: c.completionTokens });
    }
  }

  /**
   * Si Orbi atiende ahora (mantenimiento automático). El chat lo pregunta al
   * abrirse para mostrar el aviso antes de que la persona escriba, en vez de
   * dejarla tipear y responderle con un 503. Público porque el alta de
   * negocios no tiene sesión; no dice la causa.
   */
  @Get('estado')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async estado(@Query('surface') surface?: string) {
    return this.salud.disponibilidad(surface === 'wizard' ? 'wizard' : 'panel');
  }

  @Post('chat')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @DemoIa('orbi-chat') // prueba de la demo pública, ver demo/demo-ia.ts
  @UseInterceptors(DemoIaInterceptor)
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

    // Los permisos EFECTIVOS: el dueño pasa siempre (como PermissionsGuard) y un
    // rol común tiene los suyos del JWT. Alimentan las tools, la ejecución y el
    // snapshot del prompt: los tres tienen que ver lo mismo.
    const permisos = permisosDeOrbi(user);

    // Mantenimiento (proveedor caído o sin saldo): antes de la cuota, para que
    // un mensaje que no se va a atender no gaste el cupo del día. Llega como un
    // 503 con error ORBI_MAINTENANCE.
    await this.salud.exigirDisponible('panel');

    // Antes de abrir el stream, para que llegue como un 429 normal.
    if (!(await this.cuota.consumir(`orbi-panel:${user.businessId}`, TURNOS_DIA_NEGOCIO))) {
      throw new HttpException(MENSAJE_CUOTA, HttpStatus.TOO_MANY_REQUESTS);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Spec §3.7: si el cliente se va (Detener, cerrar Orbi, navegar), se deja
    // de gastar. La señal va al adapter y el loop la revisa antes de cada
    // llamada al modelo, cada tool y cada propuesta.
    const corte = corteAlCerrar(res);

    // Telemetría del turno (orbi_turns, spec §3.6). Sin texto.
    const arrancoEn = Date.now();
    const consumo: ConsumoPorProveedor = new Map();
    let modeloReportado: string | undefined;
    let llamadasAlModelo = 0;
    const toolsPedidas: string[] = [];
    let propuestas = 0;
    let estado: EstadoDelTurno = 'ok';

    // Visitante de la demo: todos comparten el mismo miembro readOnly, así que
    // su conversación NO se guarda (si no, cada visitante vería el chat de
    // los anteriores), no ve las herramientas que modifican datos y el
    // prompt le dice que es una demo.
    const esDemo = user.readOnly === true;

    // La conversación del turno: solo existe en el panel y fuera de la demo,
    // y siempre es propia (verificada o recién creada). El id del body nunca
    // se usa tal cual. Es también la única que puede quedar guardada en una
    // acción pendiente (ahí va la nota de confirmar o cancelar). Afuera del
    // try porque el metering y la telemetría del finally la usan.
    let conversacionVerificada: string | null = null;

    try {
      let history: LlmMessage[] = [];

      if (dto.context.surface === OrbiSurface.PANEL && !esDemo) {
        // Spec §3.3. El id viene del cliente: se verifica que sea de ESTE
        // negocio y de ESTA persona antes de leerla o escribirle nada (ver
        // ConversationService#propia). Si no lo es, o no existe, se arranca una
        // nueva sin error: ajena e inexistente se ven igual desde afuera. El
        // abuso (crear filas mandando ids inventados) lo acotan la cuota y el
        // throttle, que ya cuentan cada mensaje.
        const guardados = dto.conversationId
          ? await this.conversationService.historialSiEsPropia(dto.conversationId, user.businessId, user.memberId)
          : null;
        if (guardados && dto.conversationId) {
          conversacionVerificada = dto.conversationId;
          history = historialParaElModelo(guardados);
        } else {
          const conv = await this.conversationService.crear(user.businessId, user.memberId, 'panel');
          conversacionVerificada = conv.id;
        }

        // El primer evento del stream: el front guarda el id y lo manda en el
        // mensaje siguiente. Sin esto nunca lo tenía y el modelo no recibía
        // historial.
        res.write(`event: conversation\ndata: ${JSON.stringify({ id: conversacionVerificada })}\n\n`);

        await this.conversationService.appendMessage(conversacionVerificada, user.businessId, user.memberId, {
          role: 'user',
          content: dto.message,
          timestamp: new Date().toISOString(),
        });
      }

      const systemPrompt = await this.contextBuilder.buildSystemPrompt(dto, permisos);
      const messages: LlmMessage[] = [
        { role: 'system', content: esDemo ? `${systemPrompt}\n\n${PROMPT_DEMO}` : systemPrompt },
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
      const tools = this.toolRegistry.getTools(dto.context.surface, permisos, dto.context.stepName, { soloLectura: esDemo });
      const modelo = this.modeloPara(dto.context.surface);
      const toolCtx: ToolExecutionContext = {
        businessId: user.businessId,
        userId: user.memberId,
        surface: dto.context.surface,
        permissions: permisos,
        roleName: user.roleName,
      };

      let fullResponse = '';

      // Ver la nota en chatWizard: con herramientas en juego el texto de la
      // vuelta se BUFEREA en vez de streamearse, para que el preámbulo que
      // Gemini dice antes de llamar la tool nunca llegue a la pantalla.
      const hayTools = tools.length > 0;

      let continueLoop = true;
      let vueltas = 0;
      while (continueLoop) {
        if (++vueltas > MAX_VUELTAS_TOOLS) {
          fullResponse += this.cortarPorVueltas(res);
          estado = 'max_rounds';
          break;
        }
        // Cada vuelta es una llamada paga: si el cliente ya se fue, no se pide.
        corte.signal.throwIfAborted();
        llamadasAlModelo++;
        continueLoop = false;
        let textoVuelta = '';
        let resetEnviado = false;
        // Las calls de esta vuelta vuelven al historial juntas, al terminar
        // el stream (ver vueltaDeTools: tool calls paralelas de Gemini).
        const vuelta = vueltaDeTools();
        for await (const event of this.llm.streamChat({ messages, tools: tools.length ? tools : undefined, model: modelo, signal: corte.signal })) {
          if (event.type === 'text') {
            textoVuelta += event.chunk;
            if (!hayTools && !resetEnviado) res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
          } else if (event.type === 'tool_call') {
            // Con el cliente ido, ni se propone ni se ejecuta nada.
            corte.signal.throwIfAborted();
            toolsPedidas.push(event.call.name);
            // Si se bufereó, no hay nada que resetear: el preámbulo se descarta
            // acá sin que el usuario lo haya visto nunca.
            if (hayTools) {
              textoVuelta = '';
            } else if (textoVuelta.trim() && !resetEnviado) {
              res.write(`event: text_reset\ndata: {}\n\n`);
              resetEnviado = true;
            }
            // UUID y no `step-${Date.now()}`: dos pasos en el mismo milisegundo
            // repetían id y el front pisaba una tarjeta con la otra (spec §3.8).
            const stepId = randomUUID();

            // Las herramientas que ESCRIBEN no se ejecutan acá: se proponen.
            // El usuario ve un botón con lo que va a pasar y la escritura
            // ocurre recién si hace clic (ver POST /orbi/confirm).
            //
            // Es la defensa contra la inyección indirecta de RBT-695: el texto
            // que escribe un cliente de la tienda vuelve al contexto del modelo
            // como resultado de listOrders o getOrderDetail, y puede
            // convencerlo de PEDIR un cupón del 100% — pero no puede hacer clic
            // por el dueño del negocio.
            //
            // En la demo no se propone nada (soloLectura): el visitante tiene
            // rol owner, así que los permisos no lo frenan.
            const propuesta = await this.toolRegistry.proponer(
              event.call.name,
              event.call.arguments,
              toolCtx,
              dto.context.stepName,
              { soloLectura: esDemo },
            );

            // Los argumentos no pasan el DTO del endpoint (o el pedido no
            // existe): no hay tarjeta ni acción pendiente. El modelo recibe el
            // motivo como resultado fallido de la tool, para corregir los
            // argumentos o contarle a la persona qué faltó.
            if (propuesta && 'error' in propuesta) {
              vuelta.responder(event.call, JSON.stringify({ success: false, error: propuesta.error }));
              continueLoop = true;
              continue;
            }

            // Una escritura que no se pudo proponer (demo, sin permiso, otra
            // surface) NO se ejecuta directo: solo /orbi/confirm escribe. El
            // modelo recibe el fallo, igual que con un { error }.
            if (!propuesta && this.toolRegistry.requiereConfirmacion(event.call.name)) {
              vuelta.responder(event.call, JSON.stringify({ success: false, error: esDemo ? ESCRITURA_EN_DEMO : ESCRITURA_NO_DISPONIBLE }));
              continueLoop = true;
              continue;
            }

            if (propuesta) {
              // proponer() es async (lee la base para armar la tarjeta): el
              // cliente pudo irse mientras. Una propuesta que nadie va a ver
              // quedaría pendiente hasta vencer.
              corte.signal.throwIfAborted();
              const actionId = await this.pendingActions.crear({
                tool: event.call.name,
                args: event.call.arguments,
                businessId: user.businessId,
                memberId: user.memberId,
                conversationId: conversacionVerificada,
                resumen: propuesta.resumen,
              });
              propuestas++;

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
              vuelta.responder(event.call, JSON.stringify(RESPUESTA_DE_PROPUESTA));
              continueLoop = true;
              continue;
            }

            // Mismo motivo que antes de crear(): proponer() fue async.
            corte.signal.throwIfAborted();
            res.write(`event: action_start\ndata: ${JSON.stringify({ id: stepId, label: event.call.name, tool: event.call.name })}\n\n`);

            // Acá solo llegan lecturas. soloLectura igual, como segunda barrera
            // de la demo (ver ToolRegistryService#execute).
            const result = await this.toolRegistry.execute(event.call.name, event.call.arguments, toolCtx, dto.context.stepName, { soloLectura: esDemo });

            res.write(`event: action_complete\ndata: ${JSON.stringify({ id: stepId, result: result.label, data: result.data })}\n\n`);

            vuelta.responder(event.call, JSON.stringify(result));
            continueLoop = true;
          } else if (event.type === 'usage') {
            // Se suma aunque el cliente ya se haya ido: la llamada se factura.
            sumarConsumo(consumo, event.usage);
            modeloReportado = event.usage.model;
          } else if (event.type === 'done') {
            if (!continueLoop) {
              // Vuelta final: si se bufereó, recién acá sale el texto — de una,
              // y solo el de la respuesta de verdad.
              if (hayTools && textoVuelta) {
                res.write(`event: text\ndata: ${JSON.stringify({ chunk: textoVuelta })}\n\n`);
              }
              fullResponse += textoVuelta;
              res.write(`event: done\ndata: {}\n\n`);
            }
          }
        }
        // Terminó el stream de la vuelta: recién ahora sus calls y resultados
        // entran al historial, todos en un solo turno del modelo.
        vuelta.volcarEn(messages);
      }

      // El proveedor contestó: corta la racha de fallas que podría apagar Orbi.
      void this.salud.registrarOk();

      // Una respuesta cortada no se guarda: queda el `user` sin respuesta, que
      // el historial ya sabe manejar (spec §3.3).
      corte.signal.throwIfAborted();
      if (conversacionVerificada) {
        await this.conversationService.appendMessage(conversacionVerificada, user.businessId, user.memberId, {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      if (corte.signal.aborted) {
        // El cliente se fue: no es un error nuestro ni hay a quién escribirle.
        estado = 'cancelled';
      } else {
        estado = 'error';
        this.logger.error(`Orbi chat error: ${error}`);
        // Se clasifica (saldo, key, caída, bug nuestro) y se cuenta: si es una
        // de las que no se arreglan solas, o se repite, Orbi pasa a
        // mantenimiento y se avisa a los admins. A la persona NUNCA le llega el
        // error crudo del proveedor.
        const aviso = await this.salud.avisoDeFalla({ error, surface: 'panel', actor: user.businessId });
        res.write(`event: error\ndata: ${JSON.stringify(aviso)}\n\n`);
      }
    } finally {
      this.medirConsumo(consumo, {
        feature: 'orbi-panel',
        businessId: user.businessId,
        memberId: user.memberId,
        conversationId: conversacionVerificada,
      });
      res.end();

      // La demo no se registra: todos sus visitantes comparten negocio y
      // miembro, y sus turnos se mezclarían con las métricas de uso real del
      // negocio. El metering de arriba sí: ese consumo se paga igual.
      if (!esDemo) {
        // Sin await: la telemetría no puede demorar ni romper el cierre del
        // stream. registrar() nunca lanza. En un turno cancelado los tokens son
        // un piso: la llamada cortada se factura igual y su `usage` no llegó.
        let promptTokens = 0;
        let completionTokens = 0;
        for (const c of consumo.values()) {
          promptTokens += c.promptTokens;
          completionTokens += c.completionTokens;
        }
        void this.orbiTurns.registrar({
          businessId: user.businessId,
          memberId: user.memberId,
          conversationId: conversacionVerificada,
          // El front del panel manda siempre module 'ventas' y la pantalla en
          // section: se guarda el módulo ya resuelto (el mismo que eligió el
          // prompt), si no todos los turnos quedaban como 'ventas'.
          module: resolverModuloDelPanel(dto.context.module, dto.context.section).modulo ?? dto.context.module,
          model: modeloReportado ?? this.modeloPara(dto.context.surface),
          // undefined y no 0 si el proveedor no informó consumo.
          promptTokens: promptTokens || undefined,
          completionTokens: completionTokens || undefined,
          latencyMs: Date.now() - arrancoEn,
          rounds: llamadasAlModelo,
          toolsUsed: toolsPedidas,
          actionsProposed: propuestas,
          status: estado,
        });
      }
    }
  }

  // Cuando una respuesta encadena más vueltas de herramientas que el tope: se
  // corta con un mensaje en vez de seguir llamando al modelo.
  private cortarPorVueltas(res: Response): string {
    this.logger.warn(`Orbi cortó una respuesta a las ${MAX_VUELTAS_TOOLS} vueltas de herramientas`);
    res.write(`event: text\ndata: ${JSON.stringify({ chunk: MENSAJE_VUELTAS })}\n\n`);
    res.write(`event: done\ndata: {}\n\n`);
    return MENSAJE_VUELTAS;
  }

  /**
   * Ejecuta de verdad una acción que Orbi propuso y la persona confirmó
   * (spec §3.4).
   *
   * Recibe SOLO el id de la propuesta. La herramienta y los argumentos viven
   * en el servidor (PendingActionService): si vinieran del cliente, cualquiera
   * podría saltearse a Orbi y postear la escritura que quisiera.
   *
   * Respuestas: 200 con el ToolResult (también el guardado, si ya se había
   * confirmado: es idempotente), 409 `{ estado: 'aplicando' | 'desconocido',
   * mensaje }`, 404 si ya no está disponible.
   */
  @Post('confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async confirm(
    @Body() dto: ConfirmActionDto,
    @CurrentUser() user: AuthContext,
  ): Promise<ToolResult> {
    if (user.type !== 'member') {
      throw new ForbiddenException('Orbi solo está disponible para miembros del negocio');
    }

    const consumo = await this.pendingActions.consumir(dto.actionId, user.businessId, user.memberId);
    switch (consumo.tipo) {
      case 'resuelta':
        return consumo.result;
      case 'aplicando':
        throw conflicto({ estado: 'aplicando', mensaje: MENSAJE_APLICANDO });
      case 'desconocido':
        // No se vuelve a ejecutar sola: si la escritura llegó a la base,
        // repetirla crearía dos cupones o cambiaría dos veces el pedido.
        throw conflicto({ estado: 'desconocido', mensaje: `No sé si se aplicó; revisalo en ${pantallaDe(consumo.tool)}.` });
      case 'no_disponible':
        throw new NotFoundException(MENSAJE_NO_DISPONIBLE);
    }

    const accion = consumo.accion;
    const result = await this.ejecutarConfirmada(accion, user);

    // La nota va DESPUÉS de guardar el estado y nunca cambia la respuesta: la
    // acción ya se resolvió, y una conversación borrada o la base lenta no
    // pueden hacer que la persona crea que no pasó.
    await this.anotar(accion, user, (ids) => notaDeConfirmacion(accion.tool, result, ids));
    return result;
  }

  /**
   * Cancelar desde la tarjeta. Sin chequeo de permisos: cancelar una
   * propuesta propia nunca puede estar prohibido.
   *
   * Respuestas: 200 `{ ok: true }` (también si ya estaba cancelada), 409
   * `{ estado: 'ya_aplicada', result }` si ya se confirmó, 404 si no existe,
   * venció o es de otra persona u otro negocio.
   */
  @Post('reject')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async reject(
    @Body() dto: RejectActionDto,
    @CurrentUser() user: AuthContext,
  ): Promise<{ ok: true }> {
    // Con un JWT de customer o platform_admin, memberId sería undefined y
    // Prisma lo sacaría del filtro: cualquiera cancelaría acciones ajenas.
    if (user.type !== 'member') {
      throw new ForbiddenException('Orbi solo está disponible para miembros del negocio');
    }

    const rechazo = await this.pendingActions.rechazar(dto.actionId, user.businessId, user.memberId);
    switch (rechazo.tipo) {
      case 'ok': {
        const accion = rechazo.accion;
        await this.anotar(accion, user, (ids) => notaDeCancelacion(accion.tool, ids));
        return { ok: true };
      }
      case 'ya_rechazada':
        return { ok: true };
      case 'ya_aplicada':
        throw conflicto({ estado: 'ya_aplicada', result: rechazo.result });
      case 'no_disponible':
        throw new NotFoundException(MENSAJE_NO_DISPONIBLE);
    }
  }

  /**
   * Corre la acción tomada y SIEMPRE la deja resuelta (executed o failed, con
   * result y resolvedAt), también si la tool tira; salvo que la base no deje
   * guardarlo ni al reintentar (ver guardarResultado). El result arranca como
   * fallo interno: si algo falla antes de asignarlo, o dentro del catch, el
   * finally igual tiene qué guardar. Si la fila quedara en executing, el
   * próximo clic recibiría "no sé si se aplicó" para siempre.
   */
  private async ejecutarConfirmada(accion: FilaPendiente, user: Extract<AuthContext, { type: 'member' }>): Promise<ToolResult> {
    let result: ToolResult = { success: false, error: ERROR_INTERNO, label: accion.tool };
    try {
      const args = (accion.args ?? {}) as Record<string, unknown>;
      // Los permisos del JWT de AHORA, no los de cuando se propuso: entre una
      // cosa y la otra le pueden haber sacado el permiso a la persona.
      const ctx: ToolExecutionContext = {
        businessId: user.businessId,
        userId: user.memberId,
        surface: OrbiSurface.PANEL,
        permissions: permisosDeOrbi(user),
        roleName: user.roleName,
      };
      // Si la tarjeta ya no describe lo que pasaría (el pedido cambió de
      // estado desde la propuesta), no se ejecuta: la persona aprobó otra cosa.
      if (!(await this.toolRegistry.sigueVigente(accion.tool, args, ctx, accion.summary))) {
        result = { success: false, error: ERROR_DESACTUALIZADA, label: accion.tool };
      } else {
        // soloLectura como en el chat: la demo ya la frena DemoGuard antes de
        // llegar acá, pero si esa puerta se rompiera, una acción confirmada
        // desde la demo se escribiría (las tools llaman a los services directo).
        result = await this.toolRegistry.execute(accion.tool, args, ctx, undefined, { soloLectura: user.readOnly === true });
      }
    } catch (e) {
      // Sin el mensaje: puede traer valores e internos de Prisma.
      this.logger.warn(`Falló la acción confirmada ${accion.tool}: ${(e as Error)?.name ?? 'error'}`);
      result = { success: false, error: ERROR_INTERNO, label: accion.tool };
    } finally {
      await this.guardarResultado(accion, result);
    }
    return result;
  }

  /**
   * Deja la acción en su estado final, con un reintento. Nunca tira: cuando se
   * llega acá la escritura ya ocurrió (o ya falló), y un 500 le haría creer a
   * la persona que no pasó nada. Si los dos intentos fallan, la fila queda en
   * `executing` y a los 2 minutos un segundo clic recibe "no sé si se aplicó;
   * revisalo en...", que es la verdad; nunca se vuelve a ejecutar sola.
   */
  private async guardarResultado(accion: FilaPendiente, result: ToolResult): Promise<void> {
    const estado = result.success ? 'executed' : 'failed';
    for (let intento = 1; intento <= 2; intento++) {
      try {
        await this.pendingActions.resolver(accion.id, accion.businessId, estado, result);
        return;
      } catch (e) {
        // Sin el mensaje: puede traer valores e internos de Prisma.
        if (intento === 2) {
          this.logger.warn(`No se pudo guardar el resultado de la acción confirmada ${accion.tool}: ${(e as Error)?.name ?? 'error'}`);
        }
      }
    }
  }

  /**
   * La nota de confirmar o cancelar en la conversación del turno en que se
   * propuso, best-effort: si falla se loguea y la respuesta no cambia. El
   * texto sale solo de datos del servidor (ver acciones/nota-conversacion.ts).
   */
  private async anotar(
    accion: FilaPendiente,
    user: Extract<AuthContext, { type: 'member' }>,
    armar: (ids: { pedido?: number; codigo?: string }) => string,
  ): Promise<void> {
    if (!accion.conversationId) return;
    try {
      const ids = await this.pendingActions.idsParaNota(accion);
      await this.conversationService.appendMessage(accion.conversationId, user.businessId, user.memberId, {
        role: 'assistant',
        content: armar(ids),
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      this.logger.warn(`No se pudo anotar la acción ${accion.tool} en la conversación: ${(e as Error)?.name ?? 'error'}`);
    }
  }

  @Post('chat/wizard')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // sin auth: 10 mensajes/min por IP
  async chatWizard(@Body() dto: OrbiChatDto, @Res() res: Response, @IpDelCliente() ip?: string) {
    dto.context.surface = OrbiSurface.WIZARD;

    // Mantenimiento: mismo criterio que el panel (503 con error ORBI_MAINTENANCE).
    await this.salud.exigirDisponible('wizard');

    // Público: cuota por IP y por día, antes de abrir el stream (429 normal).
    // La IP sale de @IpDelCliente (no de @Ip): misma fuente que el throttler
    // global, por si algún día este pedido pasa por el BFF (hallazgo
    // rate-limit-ip-proxy).
    // La IP va hasheada: la cuota ahora está en la base y la IP no se guarda en claro.
    if (!(await this.cuota.consumir(`orbi-wizard:${hmacIp('orbi-wizard', ip)}`, TURNOS_DIA_IP_WIZARD))) {
      throw new HttpException(MENSAJE_CUOTA, HttpStatus.TOO_MANY_REQUESTS);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Spec §3.7, igual que en el panel: si el cliente se va, se deja de gastar.
    const corte = corteAlCerrar(res);

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
    // Lo mismo, separado por proveedor, para el metering (spec §3.6).
    const consumo: ConsumoPorProveedor = new Map();

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

      // Gemini 3.x manda un mensaje completo al usuario ANTES del functionCall
      // y otro DESPUÉS de tener el resultado. Ese preámbulo hay que tirarlo (si
      // no, el front concatenaba los dos en la misma burbuja — el bug del
      // saludo repetido).
      //
      // Antes se streameaba igual y se pisaba con un text_reset: el usuario
      // veía aparecer un texto que después desaparecía, y encima esperaba
      // tokens que no iba a leer. Ahora, cuando la vuelta tiene herramientas
      // disponibles, el texto se BUFEREA: si termina llamando una tool el búfer
      // se descarta sin haber llegado a la pantalla (el front muestra el
      // indicador de "pensando" mientras tanto), y si termina sin tool se manda
      // entero de una. En los pasos SIN herramientas (ej. "cuenta") se streamea
      // como siempre, que es donde el streaming se nota de verdad.
      const hayTools = tools.length > 0;

      let continueLoop = true;
      let vueltas = 0;
      while (continueLoop) {
        if (++vueltas > MAX_VUELTAS_TOOLS) {
          respuesta += this.cortarPorVueltas(res);
          break;
        }
        corte.signal.throwIfAborted();
        continueLoop = false;
        let textoVuelta = '';
        let resetEnviado = false;
        const vuelta = vueltaDeTools();
        for await (const event of this.llm.streamChat({ messages, tools: tools.length ? tools : undefined, model: modeloPedido, signal: corte.signal })) {
          if (event.type === 'text') {
            textoVuelta += event.chunk;
            if (!hayTools && !resetEnviado) res.write(`event: text\ndata: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
          } else if (event.type === 'tool_call') {
            corte.signal.throwIfAborted();
            if (hayTools) {
              textoVuelta = '';
            } else if (textoVuelta.trim() && !resetEnviado) {
              res.write(`event: text_reset\ndata: {}\n\n`);
              resetEnviado = true;
            }
            toolsUsadas.push(event.call.name);

            // Defensa en profundidad: una escritura (requiresConfirmation) solo
            // la ejecuta /orbi/confirm después de que la persona aprueba la
            // tarjeta, y el wizard no tiene ni tarjeta ni confirmación. Hoy lo
            // frena que ninguna escritura declara la surface WIZARD; si algún
            // día una la declara por error, igual no se ejecuta acá: el modelo
            // recibe el fallo, como en el panel.
            if (this.toolRegistry.requiereConfirmacion(event.call.name)) {
              vuelta.responder(event.call, JSON.stringify({ success: false, error: ESCRITURA_NO_DISPONIBLE }));
              continueLoop = true;
              continue;
            }

            // UUID: `step-${Date.now()}` repetía id en el mismo milisegundo (spec §3.8).
            const stepId = randomUUID();
            res.write(`event: action_start\ndata: ${JSON.stringify({ id: stepId, label: event.call.name, tool: event.call.name })}\n\n`);

            const result = await this.toolRegistry.execute(event.call.name, event.call.arguments, toolCtx, dto.context.stepName);

            res.write(`event: action_complete\ndata: ${JSON.stringify({ id: stepId, result: result.label, data: result.data })}\n\n`);

            vuelta.responder(event.call, JSON.stringify(result));
            continueLoop = true;
          } else if (event.type === 'usage') {
            modeloReportado = event.usage.model;
            promptTokens += event.usage.promptTokens;
            completionTokens += event.usage.completionTokens;
            sumarConsumo(consumo, event.usage);
          } else if (event.type === 'done') {
            // Solo la vuelta final (sin tool) cuenta como la respuesta de Orbi:
            // el preámbulo de las vueltas con tool ya se descartó.
            if (!continueLoop) {
              if (hayTools && textoVuelta) {
                res.write(`event: text\ndata: ${JSON.stringify({ chunk: textoVuelta })}\n\n`);
              }
              respuesta += textoVuelta;
              res.write(`event: done\ndata: {}\n\n`);
            }
          }
        }
        // Mismo motivo que en el panel: las calls paralelas de la vuelta
        // vuelven al historial en un solo turno del modelo.
        vuelta.volcarEn(messages);
      }
      // El proveedor contestó: corta la racha de fallas que podría apagar Orbi.
      void this.salud.registrarOk();
    } catch (error) {
      // Cortado por el cliente: ni log de error ni evento (no hay a quién).
      if (!corte.signal.aborted) {
        fallo = true;
        this.logger.error(`Orbi wizard chat error: ${error}`);
        const aviso = await this.salud.avisoDeFalla({ error, surface: 'wizard', actor: `wizard:${hmacIp('orbi-wizard', ip)}` });
        res.write(`event: error\ndata: ${JSON.stringify(aviso)}\n\n`);
      }
    } finally {
      // Un turno cortado no se registra: sería una respuesta vacía que
      // ensucia la analítica del wizard (spec §3.7). El metering sí, abajo:
      // lo consumido se paga igual.
      if (!corte.signal.aborted) {
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
      }
      res.end();

      // El wizard es público: sin negocio, miembro ni conversación.
      this.medirConsumo(consumo, { feature: 'orbi-wizard', memberId: null, conversationId: null });
    }
  }
}
