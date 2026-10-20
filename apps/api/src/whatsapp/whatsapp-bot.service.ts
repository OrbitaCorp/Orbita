import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, Optional, UnprocessableEntityException } from '@nestjs/common';
import type { WhatsappBotConfig } from '@prisma/client';
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
import { herramientasDelBot, HerramientasDelBot, type ContextoDelBot } from './whatsapp-bot-tools';
import { ID_CAMBIAR, ID_CONFIRMAR, WhatsappBotPedidosService, borradorVigente, esAfirmativo, esNegativo, textoDelResumen } from './whatsapp-bot-pedidos';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MARCA_MENU_TEXTO, PEDIDO_DE_OPCION, armarMenuInteractivo, armarMenuTexto, bienvenidaPorDefecto, esSaludoOPedidoDeMenu, opcionDeNumero, opcionesActivas,
  opcionesDelMenu, validarMenu, LIMITES_MENU, type MenuEstilo, type Modalidad, type OpcionDeMenu,
} from './whatsapp-bot-menu';
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
// Un aviso de "necesita atención" por chat cada 30 minutos: sin esto llegaría un correo por cada mensaje del cliente.
const AVISO_CADA_MS = 30 * 60 * 1000;
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface EstadoDelBot {
  /** El negocio tiene el paquete Avanzado (o es un entorno de prueba). */
  disponible: boolean;
  conectado: boolean;
  enabled: boolean;
  modo: BotModo;
  instrucciones: string | null;
  topeCreditos: number | null;
  /** Cómo atiende Orbi: todo con IA, menú + IA, o solo menú. */
  modalidad: Modalidad;
  menuEstilo: MenuEstilo;
  /** Lo que escribió el dueño (null = el de siempre) y el de siempre, para mostrarlo de ejemplo. */
  bienvenida: string | null;
  bienvenidaPorDefecto: string;
  /** Las opciones del menú, en orden, con las del dueño (o las de fábrica si no editó nada). */
  menuOpciones: OpcionDeMenu[];
  /** Orbi toma pedidos (quedan pendientes, "coordinar por WhatsApp") y sus topes por pedido. */
  tomaPedidos: boolean;
  maxUnidades: number;
  maxMonto: number;
  /** Si la tienda puede tomar pedidos por chat, o qué le falta. */
  pedidos: { disponible: boolean; motivo?: string };
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
    // Opcionales por compatibilidad con los specs anteriores; Nest los inyecta siempre (WhatsappModule).
    @Optional() private readonly pedidos?: WhatsappBotPedidosService,
    @Optional() private readonly notificaciones?: NotificationsService,
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
    const [cfg, disponible, conexion, negocio] = await Promise.all([
      this.prisma.whatsappBotConfig.findUnique({ where: { businessId } }),
      this.tienePack(businessId),
      this.prisma.whatsappConnection.findUnique({ where: { businessId }, select: { status: true } }),
      this.prisma.business.findFirst({ where: { id: businessId }, select: { name: true } }),
    ]);
    return {
      disponible,
      conectado: conexion?.status === 'ACTIVE',
      enabled: cfg?.enabled ?? false,
      modo: cfg?.modo ?? 'SELECCIONADOS',
      instrucciones: cfg?.instrucciones ?? null,
      topeCreditos: cfg?.topeCreditos ?? null,
      modalidad: (cfg?.modalidad as Modalidad | undefined) ?? 'CONVERSACIONAL',
      menuEstilo: (cfg?.menuEstilo as MenuEstilo | undefined) ?? 'LISTA',
      bienvenida: cfg?.bienvenida ?? null,
      bienvenidaPorDefecto: bienvenidaPorDefecto(negocio?.name ?? 'la tienda'),
      menuOpciones: opcionesDelMenu(cfg?.menuOpciones),
      tomaPedidos: cfg?.tomaPedidos ?? false,
      maxUnidades: cfg?.maxUnidades ?? 10,
      maxMonto: cfg?.maxMonto ?? 200000,
      pedidos: await this.disponibilidadDePedidos(businessId),
      cupo: await this.cupo(businessId, cfg?.topeCreditos ?? null),
    };
  }

  /** Si la tienda puede tomar pedidos por chat (ventas online + "coordinar por WhatsApp"), o qué le falta. */
  private async disponibilidadDePedidos(businessId: string): Promise<{ disponible: boolean; motivo?: string }> {
    if (!this.pedidos) return { disponible: false, motivo: 'No disponible en este entorno.' };
    const d = await this.pedidos.disponibilidad(businessId);
    return { disponible: d.ok, ...(d.motivo ? { motivo: d.motivo } : {}) };
  }

  async guardar(
    businessId: string,
    dto: {
      enabled?: boolean; modo?: BotModo; instrucciones?: string | null; topeCreditos?: number | null;
      modalidad?: Modalidad; menuEstilo?: MenuEstilo; bienvenida?: string | null; menuOpciones?: unknown[];
      tomaPedidos?: boolean; maxUnidades?: number; maxMonto?: number;
    },
  ): Promise<EstadoDelBot> {
    if (dto.enabled === true && !(await this.tienePack(businessId))) {
      throw new ForbiddenException('Orbi en WhatsApp es una función del paquete Avanzado.');
    }
    if (dto.enabled === true) {
      const conexion = await this.prisma.whatsappConnection.findUnique({ where: { businessId }, select: { status: true } });
      if (conexion?.status !== 'ACTIVE') throw new BadRequestException('Primero conectá tu cuenta de WhatsApp Business.');
    }
    // Encender la toma de pedidos pide que la tienda venda online y tenga "coordinar por WhatsApp": si no, se dice qué falta.
    if (dto.tomaPedidos === true) {
      const disp = this.pedidos ? await this.pedidos.disponibilidad(businessId) : { ok: false, motivo: 'No disponible en este entorno.' };
      if (!disp.ok) throw new BadRequestException(disp.motivo);
    }
    const instrucciones = dto.instrucciones === undefined ? undefined : dto.instrucciones?.trim() || null;
    const bienvenida = dto.bienvenida === undefined ? undefined : dto.bienvenida?.trim().slice(0, LIMITES_MENU.bienvenida) || null;
    // El menú se valida con el estilo que va a quedar (el nuevo o el que ya estaba): con botones entran 3 opciones, con lista 10.
    let menuOpciones: OpcionDeMenu[] | undefined;
    if (dto.menuOpciones !== undefined || dto.menuEstilo !== undefined) {
      const actual = await this.prisma.whatsappBotConfig.findUnique({ where: { businessId }, select: { menuEstilo: true, menuOpciones: true } });
      const estilo = (dto.menuEstilo ?? actual?.menuEstilo ?? 'LISTA') as MenuEstilo;
      const propuestas = dto.menuOpciones ?? opcionesDelMenu(actual?.menuOpciones);
      const error = validarMenu(propuestas, estilo);
      if (error) throw new BadRequestException(error);
      if (dto.menuOpciones !== undefined) menuOpciones = opcionesDelMenu(propuestas);
    }
    const data = {
      ...(dto.modalidad !== undefined ? { modalidad: dto.modalidad } : {}),
      ...(dto.menuEstilo !== undefined ? { menuEstilo: dto.menuEstilo } : {}),
      ...(bienvenida !== undefined ? { bienvenida } : {}),
      ...(menuOpciones !== undefined ? { menuOpciones: menuOpciones as unknown as object[] } : {}),
      ...(dto.tomaPedidos !== undefined ? { tomaPedidos: dto.tomaPedidos } : {}),
      ...(dto.maxUnidades !== undefined ? { maxUnidades: dto.maxUnidades } : {}),
      ...(dto.maxMonto !== undefined ? { maxMonto: dto.maxMonto } : {}),
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
    return this.prisma.conversation.findFirst({ where: { id: conversationId, businessId }, select: { botEstado: true, isArchived: true, botBorrador: true } });
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

    const modalidad = (cfg.modalidad as Modalidad) ?? 'CONVERSACIONAL';
    const opciones = opcionesActivas(cfg.menuOpciones);
    const ctx: ContextoDelBot = { businessId, slug: negocio.subdomain, customerId: m.customerId };

    // Tope de respuestas por chat y por hora: frena a quien escribe sin parar.
    const respuestasRecientes = await this.prisma.message.count({
      where: { conversationId, viaOrbi: true, createdAt: { gte: new Date(Date.now() - 3600_000) } },
    });
    if (respuestasRecientes >= RESPUESTAS_POR_HORA) {
      await this.derivar(businessId, conversationId, 'Muchos mensajes seguidos en poco tiempo: lo revisa una persona.');
      await this.registrar({ businessId, conversationId, status: 'limite' });
      return;
    }

    // Pedidos: el cliente confirma o cambia el resumen que Orbi le mostró (con los botones o escribiendo "sí" / "cambiar").
    const tomaPedidos = !!cfg.tomaPedidos && modalidad !== 'SOLO_MENU' && !!this.pedidos;
    if (tomaPedidos) {
      const hayBorrador = borradorVigente(ahora.botBorrador) !== null;
      const dijo = m.esTexto && !m.opcionId ? m.texto ?? '' : '';
      if (m.opcionId === ID_CONFIRMAR || (hayBorrador && esAfirmativo(dijo))) return this.confirmarPedido(m, ahora.botBorrador, negocio);
      if (m.opcionId === ID_CAMBIAR || (hayBorrador && esNegativo(dijo))) {
        await this.pedidos!.descartar(businessId, conversationId);
        await this.contestar(m, 'Sin problema. Contame qué querés cambiar o agregar y lo armamos de nuevo.', { status: 'ok', derivar: null });
        return;
      }
    }

    // El cliente eligió una opción del menú (la tocó, o respondió con su número).
    if (modalidad !== 'CONVERSACIONAL') {
      const elegida = (m.opcionId ? opciones.find((o) => o.id === m.opcionId) : undefined) ?? (await this.opcionPorNumero(m, opciones));
      if (elegida) return this.atenderOpcion(m, cfg, negocio, ctx, elegida);
    }

    if (!m.esTexto) {
      await this.contestar(m, MENSAJE_SIN_MEDIOS, { status: 'ok', derivar: null });
      return;
    }

    if (modalidad === 'SOLO_MENU') {
      // Sin IA: cualquier otro texto vuelve a mostrar el menú (y una frase si no era un saludo).
      const aviso = (await this.hayRespuestasDeOrbi(conversationId)) && !esSaludoOPedidoDeMenu(m.texto ?? '') ? 'No te entendí del todo 🙂 Elegí una opción:' : undefined;
      await this.enviarMenu(m, cfg, negocio, opciones, aviso);
      return;
    }
    if (modalidad === 'MENU_Y_CONVERSACION' && (!(await this.hayRespuestasDeOrbi(conversationId)) || esSaludoOPedidoDeMenu(m.texto ?? ''))) {
      // El primer contacto y los saludos abren con el menú; lo demás lo conversa la IA.
      await this.enviarMenu(m, cfg, negocio, opciones);
      return;
    }

    await this.responderConModelo(m, cfg, negocio, ctx);
  }

  private async hayRespuestasDeOrbi(conversationId: string): Promise<boolean> {
    return (await this.prisma.message.count({ where: { conversationId, viaOrbi: true } })) > 0;
  }

  /** "2" suelto como elección de la opción 2, pero solo si lo último que mandó Orbi fue un menú en texto. */
  private async opcionPorNumero(m: MensajeEntrante, opciones: OpcionDeMenu[]): Promise<OpcionDeMenu | undefined> {
    if (!m.esTexto || !m.texto) return undefined;
    const op = opcionDeNumero(m.texto, opciones);
    if (!op) return undefined;
    const ultimo = await this.prisma.message.findFirst({ where: { conversationId: m.conversationId, viaOrbi: true }, orderBy: { createdAt: 'desc' }, select: { text: true } });
    return ultimo?.text.includes(MARCA_MENU_TEXTO) ? op : undefined;
  }

  /** Manda el menú: interactivo (lista o botones) y, si WhatsApp no lo deja, el mismo menú en texto numerado. */
  private async enviarMenu(m: MensajeEntrante, cfg: WhatsappBotConfig, negocio: { name: string }, opciones: OpcionDeMenu[], aviso?: string) {
    const bienvenida = cfg.bienvenida?.trim() || bienvenidaPorDefecto(negocio.name);
    const guardado = armarMenuTexto(bienvenida, opciones, aviso);
    const interactivo = armarMenuInteractivo(aviso ? `${aviso}\n\n${bienvenida}` : bienvenida, opciones, cfg.menuEstilo as MenuEstilo);
    await this.contestar(m, guardado, { status: 'ok', derivar: null }, async () => {
      try {
        return await this.whatsapp.enviarInteractivo(m.businessId, m.conversationId, m.waId, interactivo);
      } catch (e) {
        // Ni el plazo de 24 h vencido ni un token vencido se arreglan con texto; cualquier otro rechazo del interactivo sí.
        if (e instanceof UnprocessableEntityException || e instanceof ConflictException) throw e;
        this.logger.warn(`WhatsApp no aceptó el menú interactivo en ${m.conversationId}; va en texto: ${describeError(e)}`);
        return this.whatsapp.enviarTexto(m.businessId, m.conversationId, m.waId, guardado);
      }
    });
  }

  /** El cliente eligió una opción: hablar con una persona, una respuesta propia del dueño, o una de fábrica (fija, o con IA). */
  private async atenderOpcion(m: MensajeEntrante, cfg: WhatsappBotConfig, negocio: { name: string; subdomain: string }, ctx: ContextoDelBot, op: OpcionDeMenu) {
    if (op.id === 'persona') {
      await this.contestar(m, MENSAJE_DE_DERIVACION, { status: 'derivado', derivar: 'Eligió "Hablar con alguien" en el menú.' });
      return;
    }
    if (op.id.startsWith('custom-')) {
      await this.contestar(m, op.respuesta ?? MENSAJE_DE_DERIVACION, { status: 'ok', derivar: null });
      return;
    }
    if (cfg.modalidad === 'SOLO_MENU') {
      const texto = await this.herramientas.respuestaFija(op.id, ctx);
      await this.contestar(m, `${texto}\n\nEscribí *menú* para ver las opciones.`.slice(0, MAX_CARACTERES_RESPUESTA + 200), { status: 'ok', derivar: null });
      return;
    }
    await this.responderConModelo(m, cfg, negocio, ctx, PEDIDO_DE_OPCION[op.id] ?? op.titulo);
  }

  /** Contesta con la IA (Groq → Workers AI → Gemini). `pedido`: lo que el cliente quiso decir al tocar una opción del menú. */
  private async responderConModelo(m: MensajeEntrante, cfg: WhatsappBotConfig, negocio: { name: string; subdomain: string }, ctx: ContextoDelBot, pedido?: string) {
    const { businessId, conversationId } = m;
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
      const tomaPedidos = !!cfg.tomaPedidos && cfg.modalidad !== 'SOLO_MENU' && !!this.pedidos;
      const ctxIa: ContextoDelBot = tomaPedidos
        ? { ...ctx, prepararPedido: (items) => this.pedidos!.preparar({ ...ctx, conversationId }, { maxUnidades: cfg.maxUnidades, maxMonto: cfg.maxMonto }, items) }
        : ctx;
      // Al tocar una opción, el último mensaje del cliente es solo el título ("Mis pedidos"): se le explica qué quiso decir.
      if (pedido && historial.length > 0 && historial[historial.length - 1].role === 'user') historial[historial.length - 1] = { role: 'user', content: pedido };
      const r = await this.correrModelo({
        sistema: promptDelBot({
          tienda: negocio.name,
          link: `https://${negocio.subdomain}.orbita.site`,
          cliente: cliente?.firstName ?? null,
          instrucciones: cfg.instrucciones,
          esPrimeraRespuesta: previas === 0,
          tomaPedidos,
        }),
        historial,
        ctx: ctxIa,
        tomaPedidos,
      });
      const texto = r.texto.trim().slice(0, MAX_CARACTERES_RESPUESTA);
      // El modelo tarda: mientras pensaba, el cliente pudo seguir escribiendo o contestar una persona. En ese caso esta
      // respuesta ya quedó vieja y no se manda (la del último mensaje la arma con todo el contexto).
      if (!(await this.esElUltimoSinContestar(conversationId, m.messageId))) {
        await this.registrar({ businessId, conversationId, status: 'descartado', ...r.metricas, latencyMs: Date.now() - inicio });
        return;
      }
      // Si Orbi armó un pedido, al cliente le llega el resumen del sistema con los botones (no lo que escribió el modelo).
      if (r.borradorListo) {
        const chat = await this.leerChat(businessId, conversationId);
        const borrador = borradorVigente(chat?.botBorrador);
        if (borrador) {
          await this.enviarResumen(m, textoDelResumen(borrador), { status: 'ok', derivar: null, ...r.metricas, latencyMs: Date.now() - inicio });
          return;
        }
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
  private async correrModelo(p: { sistema: string; historial: LlmMessage[]; ctx: ContextoDelBot; tomaPedidos?: boolean }) {
    const progreso = nuevoProgresoDelTurno();
    const mensajes: LlmMessage[] = [{ role: 'system', content: p.sistema }, ...p.historial];
    const corte = AbortSignal.timeout(TIEMPO_MAX_MS);
    let derivar: string | null = null;
    let texto = '';
    let borradorListo = false;

    for (let vuelta = 1; vuelta <= VUELTAS_MAX; vuelta++) {
      progreso.llamadasAlModelo++;
      const v = vueltaDeTools();
      let textoVuelta = '';
      let pidioTools = false;
      for await (const ev of this.llm.streamChat({ messages: mensajes, tools: herramientasDelBot(!!p.tomaPedidos), model: this.modelo(), signal: corte })) {
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
            const resultado = await this.herramientas.ejecutar(ev.call.name, ev.call.arguments, p.ctx);
            if (ev.call.name === 'preparar_pedido' && resultado.ok) borradorListo = true;
            v.responder(ev.call, JSON.stringify(resultado));
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
      borradorListo,
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
  private async contestar(m: MensajeEntrante, texto: string, d: Omit<TurnoParaGuardar, 'businessId' | 'conversationId'> & { derivar: string | null; sinAviso?: boolean }, enviar?: () => Promise<string>) {
    const { businessId, conversationId } = m;
    const { derivar, sinAviso, ...turno } = d;
    let externalId: string;
    try {
      externalId = enviar ? await enviar() : await this.whatsapp.enviarTexto(businessId, conversationId, m.waId, texto);
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
    // Quedó para una persona: se le avisa al dueño (por correo y en el panel), salvo que ya haya otro aviso para este caso.
    if (derivar !== null && !sinAviso) await this.avisarAtencion(businessId, conversationId, derivar);
  }

  private async derivar(businessId: string, conversationId: string, motivo: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId },
      data: { botEstado: 'DERIVADO', botMotivo: motivo, botCambiadoAt: new Date(), isUnread: true },
    });
    await this.avisarAtencion(businessId, conversationId, motivo);
  }

  /**
   * Le avisa al propietario que un chat necesita a una persona: campanita y correo (el evento orbi_necesita_atencion, que
   * el dueño puede apagar en Notificaciones). Uno por chat cada 30 minutos. Nunca tira: es un aviso, no puede romper la respuesta.
   */
  private async avisarAtencion(businessId: string, conversationId: string, motivo: string): Promise<void> {
    if (!this.notificaciones) return;
    try {
      const reclamado = await this.prisma.conversation.updateMany({
        where: { id: conversationId, businessId, OR: [{ botAvisoAt: null }, { botAvisoAt: { lt: new Date(Date.now() - AVISO_CADA_MS) } }] },
        data: { botAvisoAt: new Date() },
      });
      if (reclamado.count === 0) return;
      const [chat, ultimo] = await Promise.all([
        this.prisma.conversation.findFirst({ where: { id: conversationId, businessId }, select: { customer: { select: { firstName: true, lastName: true } } } }),
        this.prisma.message.findFirst({ where: { conversationId, sender: 'CUSTOMER' }, orderBy: { createdAt: 'desc' }, select: { text: true } }),
      ]);
      const nombre = chat ? `${chat.customer.firstName}${chat.customer.lastName ? ` ${chat.customer.lastName}` : ''}` : 'Un cliente';
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
      const link = `${frontend}/admin/${businessId}/ventas/mensajes?canal=whatsapp&conv=${conversationId}`;
      await this.notificaciones.dispatch('orbi_necesita_atencion', businessId, {
        title: `${nombre} necesita atención en WhatsApp`,
        body: motivo,
        emailSubject: `${nombre} necesita atención en WhatsApp`,
        emailBody: `Orbi te pasó un chat de WhatsApp: ${nombre} necesita que lo atienda una persona.\n\nMotivo: ${motivo}${ultimo ? `\nSu último mensaje: «${ultimo.text.slice(0, 200)}»` : ''}\n\nAbrir el chat: ${link}`,
        resourceType: 'conversation',
        resourceId: conversationId,
      });
    } catch (e) {
      this.logger.warn(`No se pudo avisar que el chat ${conversationId} necesita atención: ${describeError(e)}`);
    }
  }

  /** El resumen del pedido con los botones "Confirmar pedido" / "Cambiar" (o, si WhatsApp no deja los botones, con "sí" / "cambiar"). */
  private async enviarResumen(m: MensajeEntrante, resumen: string, d: Omit<TurnoParaGuardar, 'businessId' | 'conversationId'> & { derivar: string | null }) {
    const fallback = `${resumen}\n\nRespondé *sí* para confirmar o *cambiar* para modificarlo.`;
    const interactivo = {
      type: 'button',
      body: { text: resumen.slice(0, 1024) },
      action: { buttons: [{ type: 'reply', reply: { id: ID_CONFIRMAR, title: 'Confirmar pedido' } }, { type: 'reply', reply: { id: ID_CAMBIAR, title: 'Cambiar' } }] },
    };
    await this.contestar(m, fallback, d, async () => {
      try {
        return await this.whatsapp.enviarInteractivo(m.businessId, m.conversationId, m.waId, interactivo);
      } catch (e) {
        if (e instanceof UnprocessableEntityException || e instanceof ConflictException) throw e;
        this.logger.warn(`WhatsApp no aceptó los botones del pedido en ${m.conversationId}; va en texto: ${describeError(e)}`);
        return this.whatsapp.enviarTexto(m.businessId, m.conversationId, m.waId, fallback);
      }
    });
  }

  /** El cliente confirmó el resumen: se crea el pedido pendiente y el chat queda para que una persona coordine el pago y la entrega. */
  private async confirmarPedido(m: MensajeEntrante, borrador: unknown, negocio: { name: string; subdomain: string }) {
    const r = await this.pedidos!.confirmar({
      businessId: m.businessId, conversationId: m.conversationId, customerId: m.customerId, waId: m.waId, slug: negocio.subdomain, tienda: negocio.name, borrador,
    });
    if (r.ok) {
      // El aviso al dueño ya salió como "pedido pendiente": no se manda además el de "necesita atención".
      await this.contestar(m, r.texto, { status: 'ok', derivar: `Pedido #${r.pedido.numero} tomado por Orbi: falta coordinar el pago y la entrega.`, sinAviso: true });
    } else {
      await this.contestar(m, r.texto, { status: r.derivar ? 'derivado' : 'ok', derivar: r.derivar || null });
    }
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
