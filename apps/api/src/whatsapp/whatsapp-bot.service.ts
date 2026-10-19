import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { WhatsappService } from './whatsapp.service';
import { LLM_ADAPTER_BOT, type LlmAdapter, type LlmMessage } from '../orbi/llm/llm-adapter.interface';
import { sumarConsumo, nuevoProgresoDelTurno } from '../orbi/turno/motor-de-turno';
import { costoDelTurno } from '../orbi/turno/costo-del-turno';
import { vueltaDeTools } from '../orbi/turno/vuelta';
import { mesArgentina, rangoDeMesArgentina } from '../common/utils/hora-argentina';
import { describeError } from '../common/utils/describe-error.util';
import { HERRAMIENTAS_DEL_BOT, HerramientasDelBot } from './whatsapp-bot-tools';
import { orbiAtiendeElChat, type BotChatEstado, type BotModo, type MensajeEntrante } from './whatsapp-bot-estado';
import { MAX_CARACTERES_RESPUESTA, MENSAJE_DE_DERIVACION, MENSAJE_SIN_MEDIOS, promptDelBot } from './whatsapp-bot-prompt';

// Orbi como atención al público por WhatsApp (función del paquete Avanzado). Cuando un cliente escribe, si Orbi atiende ese
// chat, espera unos segundos (por si manda varios mensajes seguidos), lee el catálogo y los datos de la tienda con
// herramientas de solo lectura, y contesta por la misma conexión del negocio. Ante la duda deriva a una persona.
//
// Corre DENTRO del pedido del webhook (Cloud Run no le da CPU a lo que queda corriendo después de responder), por eso la
// espera es un sleep y no un temporizador: al despertar mira si sigue siendo el último mensaje y si nadie contestó.

const VUELTAS_MAX = 4;
const HISTORIAL = 12;
const RESPUESTAS_POR_HORA = 20;
const CREDITOS_MES_POR_DEFECTO = 2000;
// Tope de todo el pedido al modelo, con la cadena de respaldos adentro (Groq y Workers AI tienen 15 s cada uno).
const TIEMPO_MAX_MS = 50_000;
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface EstadoDelBot {
  /** El negocio tiene el paquete Avanzado (o es un entorno de prueba). */
  disponible: boolean;
  conectado: boolean;
  enabled: boolean;
  modo: BotModo;
  instrucciones: string | null;
  topeCreditos: number | null;
  cupo: { mes: string; usados: number; total: number; limite: number; porcentaje: number };
}

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);
  private readonly herramientas: HerramientasDelBot;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsappService,
    private readonly storefront: StorefrontService,
    @Inject(LLM_ADAPTER_BOT) private readonly llm: Pick<LlmAdapter, 'streamChat'>,
  ) {
    this.herramientas = new HerramientasDelBot(this.prisma, this.storefront);
  }

  // ── Configuración del negocio (panel) ──────────────────────────────────────

  /** El paquete Avanzado. `WHATSAPP_BOT_SIN_PACK=true` lo salta (solo para probar en un entorno de desarrollo). */
  async tienePack(businessId: string): Promise<boolean> {
    if (this.config.get<string>('WHATSAPP_BOT_SIN_PACK') === 'true') return true;
    const addon = await this.prisma.businessAddon.findFirst({
      where: { businessId, type: 'ADVANCED', isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true },
    });
    return !!addon;
  }

  private creditosDelMes(): number {
    const n = Number(this.config.get<string>('WHATSAPP_BOT_CREDITOS_MES'));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : CREDITOS_MES_POR_DEFECTO;
  }

  async cupo(businessId: string, topeCreditos: number | null, ahora = new Date()) {
    const mes = mesArgentina(ahora);
    const { desde, hasta } = rangoDeMesArgentina(mes);
    const uso = await this.prisma.whatsappBotTurn.aggregate({
      where: { businessId, createdAt: { gte: desde, lt: hasta } },
      _sum: { credits: true },
    });
    const total = this.creditosDelMes();
    const limite = topeCreditos !== null ? Math.min(total, topeCreditos) : total;
    const usados = uso._sum.credits ?? 0;
    return { mes, usados, total, limite, porcentaje: limite > 0 ? Math.min(100, Math.floor((usados * 100) / limite)) : 100 };
  }

  async estado(businessId: string): Promise<EstadoDelBot> {
    const [cfg, disponible, conexion] = await Promise.all([
      this.prisma.whatsappBotConfig.findUnique({ where: { businessId } }),
      this.tienePack(businessId),
      this.prisma.whatsappConnection.findUnique({ where: { businessId }, select: { status: true } }),
    ]);
    return {
      disponible,
      conectado: conexion?.status === 'ACTIVE',
      enabled: cfg?.enabled ?? false,
      modo: cfg?.modo ?? 'SELECCIONADOS',
      instrucciones: cfg?.instrucciones ?? null,
      topeCreditos: cfg?.topeCreditos ?? null,
      cupo: await this.cupo(businessId, cfg?.topeCreditos ?? null),
    };
  }

  async guardar(
    businessId: string,
    dto: { enabled?: boolean; modo?: BotModo; instrucciones?: string | null; topeCreditos?: number | null },
  ): Promise<EstadoDelBot> {
    if (dto.enabled === true && !(await this.tienePack(businessId))) {
      throw new ForbiddenException('Orbi en WhatsApp es una función del paquete Avanzado.');
    }
    if (dto.enabled === true) {
      const conexion = await this.prisma.whatsappConnection.findUnique({ where: { businessId }, select: { status: true } });
      if (conexion?.status !== 'ACTIVE') throw new BadRequestException('Primero conectá tu cuenta de WhatsApp Business.');
    }
    const instrucciones = dto.instrucciones === undefined ? undefined : dto.instrucciones?.trim() || null;
    const data = {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.modo !== undefined ? { modo: dto.modo } : {}),
      ...(instrucciones !== undefined ? { instrucciones } : {}),
      ...(dto.topeCreditos !== undefined ? { topeCreditos: dto.topeCreditos } : {}),
    };
    await this.prisma.whatsappBotConfig.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
    return this.estado(businessId);
  }

  /** El dueño enciende, apaga o reactiva Orbi en un chat (también levanta una pausa o una derivación). */
  async cambiarEstadoDelChat(businessId: string, conversationId: string, estado: 'ON' | 'OFF'): Promise<{ botEstado: BotChatEstado }> {
    if (estado === 'ON') {
      const cfg = await this.prisma.whatsappBotConfig.findUnique({ where: { businessId }, select: { enabled: true } });
      if (!cfg?.enabled) throw new BadRequestException('Primero activá Orbi para WhatsApp.');
    }
    const r = await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId },
      data: { botEstado: estado, botMotivo: null, botCambiadoAt: new Date() },
    });
    if (r.count === 0) throw new BadRequestException('Conversación no encontrada');
    return { botEstado: estado };
  }

  // ── Atender mensajes ───────────────────────────────────────────────────────

  /** Llamado por el webhook con los mensajes de clientes que acaban de entrar. Nunca tira: el webhook tiene que contestar 200. */
  async atender(mensajes: MensajeEntrante[]): Promise<void> {
    // Un cliente que manda varios mensajes seguidos en el mismo aviso se atiende una sola vez, por el último.
    const ultimoPorChat = new Map<string, MensajeEntrante>();
    for (const m of mensajes) ultimoPorChat.set(m.conversationId, m);
    for (const m of ultimoPorChat.values()) {
      try {
        await this.atenderUno(m);
      } catch (e) {
        this.logger.error(`Orbi no pudo atender el chat ${m.conversationId}: ${describeError(e)}`);
      }
    }
  }

  /**
   * ¿Este sigue siendo el último mensaje del chat, y es del cliente? Falso si el cliente siguió escribiendo (lo atiende el
   * aviso de ese último mensaje, con todo el contexto) o si ya contestó alguien (otra corrida de Orbi, o una persona).
   */
  private async esElUltimoSinContestar(conversationId: string, messageId: string): Promise<boolean> {
    const ultimo = await this.prisma.message.findFirst({
      where: { conversationId, channel: 'WHATSAPP' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, sender: true },
    });
    return !!ultimo && ultimo.id === messageId && ultimo.sender === 'CUSTOMER';
  }

  private async leerChat(businessId: string, conversationId: string) {
    return this.prisma.conversation.findFirst({ where: { id: conversationId, businessId }, select: { botEstado: true, isArchived: true } });
  }

  private async atenderUno(m: MensajeEntrante): Promise<void> {
    const { businessId, conversationId } = m;
    const cfg = await this.prisma.whatsappBotConfig.findUnique({ where: { businessId } });
    const chat = await this.leerChat(businessId, conversationId);
    if (!cfg || !chat || !orbiAtiendeElChat(cfg, chat.botEstado)) return;
    if (!(await this.tienePack(businessId))) return;

    // Espera a que termine de escribir; al despertar, solo sigue si este es el último mensaje y nadie contestó.
    const espera = Number(this.config.get<string>('WHATSAPP_BOT_ESPERA_MS') ?? 3500);
    if (espera > 0) await dormir(espera);
    if (!(await this.esElUltimoSinContestar(conversationId, m.messageId))) return;
    const ahora = await this.leerChat(businessId, conversationId);
    if (!ahora || !orbiAtiendeElChat(cfg, ahora.botEstado)) return;

    const negocio = await this.prisma.business.findFirst({ where: { id: businessId, isActive: true, isPaused: false, deletedAt: null }, select: { name: true, subdomain: true } });
    if (!negocio) return;

    if (!m.esTexto) {
      await this.contestar(m, MENSAJE_SIN_MEDIOS, { status: 'ok', derivar: null });
      return;
    }

    // Tope de respuestas por chat y por hora: frena a quien escribe sin parar.
    const respuestasRecientes = await this.prisma.message.count({
      where: { conversationId, viaOrbi: true, createdAt: { gte: new Date(Date.now() - 3600_000) } },
    });
    if (respuestasRecientes >= RESPUESTAS_POR_HORA) {
      await this.derivar(businessId, conversationId, 'Muchos mensajes seguidos en poco tiempo: lo revisa una persona.');
      await this.registrar({ businessId, conversationId, status: 'limite' });
      return;
    }

    // Cupo del mes: agotado, Orbi se calla y avisa al dueño.
    const cupo = await this.cupo(businessId, cfg.topeCreditos);
    if (cupo.usados >= cupo.limite) {
      await this.contestar(m, MENSAJE_DE_DERIVACION, { status: 'quota', derivar: 'Se agotó el cupo mensual de Orbi en WhatsApp.' });
      return;
    }

    const inicio = Date.now();
    try {
      const cliente = await this.prisma.customer.findFirst({ where: { id: m.customerId, businessId }, select: { firstName: true } });
      const previas = await this.prisma.message.count({ where: { conversationId, viaOrbi: true } });
      const historial = await this.historial(conversationId);
      const r = await this.correrModelo({
        sistema: promptDelBot({
          tienda: negocio.name,
          link: `https://${negocio.subdomain}.orbita.site`,
          cliente: cliente?.firstName ?? null,
          instrucciones: cfg.instrucciones,
          esPrimeraRespuesta: previas === 0,
        }),
        historial,
        ctx: { businessId, slug: negocio.subdomain, customerId: m.customerId },
      });
      const texto = r.texto.trim().slice(0, MAX_CARACTERES_RESPUESTA);
      // El modelo tarda: mientras pensaba, el cliente pudo seguir escribiendo o contestar una persona. En ese caso esta
      // respuesta ya quedó vieja y no se manda (la del último mensaje la arma con todo el contexto).
      if (!(await this.esElUltimoSinContestar(conversationId, m.messageId))) {
        await this.registrar({ businessId, conversationId, status: 'descartado', ...r.metricas, latencyMs: Date.now() - inicio });
        return;
      }
      if (!texto && !r.derivar) {
        await this.contestar(m, MENSAJE_DE_DERIVACION, { status: 'error', derivar: 'Orbi no pudo armar una respuesta.', ...r.metricas, latencyMs: Date.now() - inicio });
        return;
      }
      await this.contestar(m, texto || MENSAJE_DE_DERIVACION, { status: r.derivar ? 'derivado' : 'ok', derivar: r.derivar, ...r.metricas, latencyMs: Date.now() - inicio });
    } catch (e) {
      this.logger.error(`Orbi falló al responder en ${conversationId}: ${describeError(e)}`);
      // Si mientras tanto ya contestó otra corrida (o una persona), el chat está atendido: no hace falta derivarlo.
      if (await this.esElUltimoSinContestar(conversationId, m.messageId)) {
        await this.derivar(businessId, conversationId, 'Orbi no pudo responder: lo revisa una persona.');
      }
      await this.registrar({ businessId, conversationId, status: 'error', errorCategory: (e as Error)?.name ?? 'error', latencyMs: Date.now() - inicio });
    }
  }

  /** Los últimos mensajes del chat de WhatsApp como conversación con el modelo (lo de la tienda, sea Orbi o una persona, es "assistant"). */
  private async historial(conversationId: string): Promise<LlmMessage[]> {
    const filas = await this.prisma.message.findMany({
      where: { conversationId, channel: 'WHATSAPP' },
      orderBy: { createdAt: 'desc' },
      take: HISTORIAL,
      select: { sender: true, text: true },
    });
    const mensajes: LlmMessage[] = [];
    for (const f of filas.reverse()) {
      const role = f.sender === 'CUSTOMER' ? 'user' : 'assistant';
      const texto = f.text.slice(0, 800);
      const anterior = mensajes[mensajes.length - 1];
      if (anterior?.role === role) anterior.content += `\n${texto}`;
      else mensajes.push({ role, content: texto });
    }
    while (mensajes.length > 0 && mensajes[0].role !== 'user') mensajes.shift();
    return mensajes;
  }

  private modelo(): string | undefined {
    return this.config.get<string>('ORBI_MODEL_WHATSAPP') ?? this.config.get<string>('ORBI_MODEL_PANEL') ?? this.config.get<string>('ORBI_MODEL') ?? undefined;
  }

  /** El loop del modelo: hasta VUELTAS_MAX llamadas, con herramientas de lectura. Devuelve el texto, si derivó y lo que gastó. */
  private async correrModelo(p: { sistema: string; historial: LlmMessage[]; ctx: { businessId: string; slug: string; customerId: string } }) {
    const progreso = nuevoProgresoDelTurno();
    const mensajes: LlmMessage[] = [{ role: 'system', content: p.sistema }, ...p.historial];
    const corte = AbortSignal.timeout(TIEMPO_MAX_MS);
    let derivar: string | null = null;
    let texto = '';

    for (let vuelta = 1; vuelta <= VUELTAS_MAX; vuelta++) {
      progreso.llamadasAlModelo++;
      const v = vueltaDeTools();
      let textoVuelta = '';
      let pidioTools = false;
      for await (const ev of this.llm.streamChat({ messages: mensajes, tools: HERRAMIENTAS_DEL_BOT, model: this.modelo(), signal: corte })) {
        if (ev.type === 'text') textoVuelta += ev.chunk;
        else if (ev.type === 'usage') {
          sumarConsumo(progreso.consumo, ev.usage);
          progreso.modeloReportado = ev.usage.model;
        } else if (ev.type === 'tool_call') {
          pidioTools = true;
          progreso.toolsPedidas.push(ev.call.name);
          if (ev.call.name === 'derivar_a_una_persona') {
            const motivo = typeof ev.call.arguments.motivo === 'string' ? ev.call.arguments.motivo.trim().slice(0, 200) : '';
            derivar = motivo || 'Orbi pidió que lo atienda una persona.';
            v.responder(ev.call, JSON.stringify({ ok: true, datos: 'Listo: el equipo ya está avisado. Despedite en una línea.' }));
          } else {
            v.responder(ev.call, JSON.stringify(await this.herramientas.ejecutar(ev.call.name, ev.call.arguments, p.ctx)));
          }
        }
      }
      if (!pidioTools) {
        texto = textoVuelta;
        break;
      }
      v.volcarEn(mensajes);
      texto = textoVuelta; // por si el tope de vueltas corta justo acá
    }

    const costo = costoDelTurno(progreso.consumo, new Map(), new Date());
    const proveedores = [...progreso.consumo.keys()];
    let promptTokens = 0;
    let completionTokens = 0;
    for (const c of progreso.consumo.values()) {
      promptTokens += c.promptTokens;
      completionTokens += c.completionTokens;
    }
    return {
      texto,
      derivar,
      metricas: {
        rounds: progreso.llamadasAlModelo,
        toolsUsed: progreso.toolsPedidas,
        model: progreso.modeloReportado,
        provider: proveedores.length === 0 ? undefined : proveedores.length === 1 ? proveedores[0] : 'mixto',
        promptTokens: promptTokens || undefined,
        completionTokens: completionTokens || undefined,
        costUsd: costo.costUsd,
        credits: costo.credits,
      },
    };
  }

  /** Manda la respuesta por WhatsApp, la guarda en el chat marcada como de Orbi y, si hay que derivar, deja el chat para una persona. */
  private async contestar(m: MensajeEntrante, texto: string, d: Omit<TurnoParaGuardar, 'businessId' | 'conversationId'> & { derivar: string | null }) {
    const { businessId, conversationId } = m;
    const { derivar, ...turno } = d;
    let externalId: string;
    try {
      externalId = await this.whatsapp.enviarTexto(businessId, conversationId, m.waId, texto);
    } catch (e) {
      this.logger.warn(`Orbi no pudo enviar la respuesta en ${conversationId}: ${describeError(e)}`);
      await this.derivar(businessId, conversationId, 'Orbi no pudo enviar su respuesta: lo revisa una persona.');
      await this.registrar({ ...turno, businessId, conversationId, status: 'error', errorCategory: 'envio' });
      return;
    }
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, sender: 'STORE', text: texto, channel: 'WHATSAPP', externalId, deliveryStatus: 'sent', viaOrbi: true },
      }),
      // Orbi ya contestó: el chat deja de figurar como sin leer, salvo que haya que derivarlo a una persona.
      this.prisma.conversation.updateMany({
        where: { id: conversationId, businessId },
        data: {
          updatedAt: new Date(),
          isUnread: derivar !== null,
          ...(derivar !== null ? { botEstado: 'DERIVADO', botMotivo: derivar, botCambiadoAt: new Date() } : {}),
        },
      }),
    ]);
    await this.registrar({ ...turno, businessId, conversationId });
  }

  private async derivar(businessId: string, conversationId: string, motivo: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId },
      data: { botEstado: 'DERIVADO', botMotivo: motivo, botCambiadoAt: new Date(), isUnread: true },
    });
  }

  private async registrar(t: TurnoParaGuardar): Promise<void> {
    try {
      await this.prisma.whatsappBotTurn.create({
        data: {
          businessId: t.businessId,
          conversationId: t.conversationId,
          status: t.status,
          rounds: t.rounds ?? 0,
          toolsUsed: t.toolsUsed ?? [],
          model: t.model ?? null,
          provider: t.provider ?? null,
          promptTokens: t.promptTokens ?? null,
          completionTokens: t.completionTokens ?? null,
          costUsd: t.costUsd ?? null,
          credits: t.credits ?? 0,
          latencyMs: t.latencyMs ?? 0,
          errorCategory: t.errorCategory ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar el turno de Orbi en WhatsApp: ${(e as Error)?.name ?? 'error'}`);
    }
  }
}

interface TurnoParaGuardar {
  businessId: string;
  conversationId: string;
  status: 'ok' | 'error' | 'quota' | 'derivado' | 'limite' | 'descartado';
  rounds?: number;
  toolsUsed?: string[];
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  credits?: number;
  latencyMs?: number;
  errorCategory?: string;
}
