import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorefrontService } from '../../storefront/storefront.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { LlmAdapter, LlmMessage } from '../llm/llm-adapter.interface';
import { sumarConsumo, nuevoProgresoDelTurno } from '../turno/motor-de-turno';
import { costoDelTurno } from '../turno/costo-del-turno';
import { vueltaDeTools } from '../turno/vuelta';
import { mesArgentina, rangoDeMesArgentina } from '../../common/utils/hora-argentina';
import { describeError } from '../../common/utils/describe-error.util';
import { herramientasDelBot, HerramientasDelBot, type ContextoDelBot } from './herramientas';
import { ID_CAMBIAR, ID_CONFIRMAR, type PedidosPorChatService, borradorVigente, esAfirmativo, esNegativo, textoDelResumen } from './pedidos';
import { NOMBRE_DEL_CANAL, orbiAtiendeElChat, type BotChatEstado, type BotModo, type CanalDeOrbi, type MensajeDeCliente } from './estado';
import { MENSAJE_DE_DERIVACION, MENSAJE_SIN_MEDIOS, promptDelBot } from './prompt';
import { dormir, partirEnBloques, pausaDeEscritura } from './bloques';

// Orbi como atención al público por chat (función del paquete Avanzado), igual en todos los canales. Cuando un cliente
// escribe, si Orbi atiende ese chat, espera unos segundos (por si manda varios mensajes seguidos), lee el catálogo y los
// datos de la tienda con herramientas de solo lectura, puede armar un pedido para que el cliente lo confirme, y contesta por
// la misma conexión del negocio. Ante la duda deriva a una persona y le avisa al dueño.
//
// Cada canal (WhatsApp, Instagram) hereda esto y pone lo suyo: cómo se manda un texto, una foto o los botones del pedido,
// dónde está su configuración, y el link a su bandeja. El menú de opciones es solo de WhatsApp (whatsapp-bot.service.ts).
//
// Corre DENTRO del pedido del webhook (Cloud Run no le da CPU a lo que queda corriendo después de responder), por eso la
// espera es un sleep y no un temporizador: al despertar mira si sigue siendo el último mensaje y si nadie contestó.

const VUELTAS_MAX = 4;
const HISTORIAL = 12;
const RESPUESTAS_POR_HORA = 20;
const CREDITOS_MES_POR_DEFECTO = 2000;
// Tope de todo el pedido al modelo, con la cadena de respaldos adentro (Workers AI y Groq tienen 15 s cada uno).
const TIEMPO_MAX_MS = 50_000;
// Un aviso de "necesita atención" por chat cada 30 minutos: sin esto llegaría un correo por cada mensaje del cliente.
const AVISO_CADA_MS = 30 * 60 * 1000;
// Fotos de producto que Orbi puede mandar en una misma respuesta (cada una es un mensaje más en el chat).
const FOTOS_MAX_POR_RESPUESTA = 3;

/** Lo que todos los canales configuran igual. */
export interface ConfigDeAtencion {
  enabled: boolean;
  modo: BotModo;
  instrucciones: string | null;
  topeCreditos: number | null;
  tomaPedidos: boolean;
  maxUnidades: number;
  maxMonto: number;
}

export type CambiosComunes = Partial<Pick<ConfigDeAtencion, 'enabled' | 'modo' | 'tomaPedidos' | 'maxUnidades' | 'maxMonto'>> & {
  instrucciones?: string | null;
  topeCreditos?: number | null;
};

/**
 * El cupo del mes. Los créditos del plan son UNO para todos los canales; el tope propio del dueño es de cada canal. `usados`
 * es lo de este canal, `limite` lo que este canal puede llegar a gastar (su tope, o lo que deja el resto) y `otrosCanales`
 * lo que ya gastaron los demás.
 */
export interface CupoDelMes {
  mes: string;
  usados: number;
  total: number;
  limite: number;
  porcentaje: number;
  otrosCanales: number;
}

/** El estado que ve el panel, igual en todos los canales (WhatsApp le suma su menú). */
export interface EstadoComun {
  /** El negocio tiene el paquete Avanzado (o es un entorno de prueba). */
  disponible: boolean;
  conectado: boolean;
  enabled: boolean;
  modo: BotModo;
  instrucciones: string | null;
  topeCreditos: number | null;
  /** Orbi toma pedidos (quedan pendientes, "coordinar por el chat") y sus topes por pedido. */
  tomaPedidos: boolean;
  maxUnidades: number;
  maxMonto: number;
  /** Si la tienda puede tomar pedidos por chat, o qué le falta. */
  pedidos: { disponible: boolean; motivo?: string };
  cupo: CupoDelMes;
}

export type Negocio = { name: string; subdomain: string };

export interface TurnoParaGuardar {
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

export type DatosDeLaRespuesta = Omit<TurnoParaGuardar, 'businessId' | 'conversationId'> & {
  derivar: string | null;
  sinAviso?: boolean;
  /** La respuesta del modelo: sale en mensajes cortos (los separa con una línea en blanco), con "escribiendo…" entre uno y otro. */
  enBloques?: boolean;
};

/** Una foto que Orbi mandó: su id en el canal, la dirección con que quedó guardada y el texto con que se guarda en el chat. */
export type FotoEnviada = { externalId: string; url: string; texto: string };

export abstract class AtencionDeOrbi<Cfg extends ConfigDeAtencion> {
  protected abstract readonly logger: Logger;
  protected abstract readonly canal: CanalDeOrbi;
  protected readonly herramientas: HerramientasDelBot;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly config: ConfigService,
    storefront: StorefrontService,
    protected readonly llm: Pick<LlmAdapter, 'streamChat'>,
    protected readonly pedidos?: PedidosPorChatService,
    protected readonly notificaciones?: NotificationsService,
  ) {
    this.herramientas = new HerramientasDelBot(this.prisma, storefront);
  }

  // ── Lo que pone cada canal ─────────────────────────────────────────────────

  /** La configuración de Orbi en este canal (null = el dueño nunca la tocó). */
  protected abstract leerConfig(businessId: string): Promise<Cfg | null>;
  /** Si la cuenta del canal está conectada y activa. */
  protected abstract estaConectado(businessId: string): Promise<boolean>;
  /** Manda un texto y devuelve su id en el canal. */
  protected abstract enviarTexto(m: MensajeDeCliente, texto: string): Promise<string>;
  /** Manda la foto de un producto. null si no se pudo. */
  protected abstract enviarFoto(m: MensajeDeCliente, url: string, pie: string): Promise<FotoEnviada | null>;
  /** El resumen del pedido: el texto que queda en el chat y cómo se manda (con botones si el canal los tiene). */
  protected abstract resumenDelPedido(m: MensajeDeCliente, resumen: string): { texto: string; enviar: () => Promise<string> };
  /** El link al chat en el panel (para el correo al dueño). */
  protected abstract linkDelChat(businessId: string, conversationId: string): string;

  /** Lo que el canal contesta sin IA antes que el modelo (el menú de WhatsApp). true = ya lo atendió. */
  protected async atenderSinModelo(_m: MensajeDeCliente, _cfg: Cfg, _negocio: Negocio, _ctx: ContextoDelBot): Promise<boolean> {
    return false;
  }
  /** Si este canal puede usar la IA con esta configuración (WhatsApp "solo menú" no). */
  protected usaIa(_cfg: Cfg): boolean {
    return true;
  }
  /** Deja el texto en la medida del canal antes de mandarlo (Instagram corta en 1000 bytes). */
  protected ajustarTexto(texto: string): string {
    return texto;
  }
  /** Hasta cuántos caracteres escribe Orbi en un mensaje. */
  protected abstract maxCaracteres(): number;
  /** El teléfono del cliente, si el canal lo sabe (para el pedido). */
  protected telefonoDelCliente(_m: MensajeDeCliente): string | undefined {
    return undefined;
  }
  /** Una línea más para el correo de "necesita atención" (Instagram: el plazo de 24 h). */
  protected notaParaElDueno(): string {
    return '';
  }
  /** Muestra "escribiendo…" en el chat del cliente. Cada canal lo hace a su manera; nunca tira (es un detalle). */
  protected async mostrarEscribiendo(_m: MensajeDeCliente): Promise<void> {
    /* sin "escribiendo…" en este canal */
  }

  private async escribiendo(m: MensajeDeCliente): Promise<void> {
    try {
      await this.mostrarEscribiendo(m);
    } catch {
      /* es un detalle: la respuesta sale igual */
    }
  }

  protected get nombreDelCanal(): string {
    return NOMBRE_DEL_CANAL[this.canal];
  }

  // ── Paquete, cupo y configuración común ────────────────────────────────────

  /** El paquete Avanzado. `WHATSAPP_BOT_SIN_PACK=true` lo salta en todos los canales (solo para probar en un entorno de desarrollo). */
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

  async cupo(businessId: string, topeCreditos: number | null, ahora = new Date()): Promise<CupoDelMes> {
    const mes = mesArgentina(ahora);
    const { desde, hasta } = rangoDeMesArgentina(mes);
    const delMes = { businessId, createdAt: { gte: desde, lt: hasta } };
    const [todos, delCanal] = await Promise.all([
      this.prisma.whatsappBotTurn.aggregate({ where: delMes, _sum: { credits: true } }),
      this.prisma.whatsappBotTurn.aggregate({ where: { ...delMes, canal: this.canal }, _sum: { credits: true } }),
    ]);
    const total = this.creditosDelMes();
    const usados = delCanal._sum.credits ?? 0;
    const otrosCanales = Math.max(0, (todos._sum.credits ?? 0) - usados);
    // Lo que este canal todavía puede gastar: su tope propio, sin pasarse de lo que dejan los otros canales.
    const limite = Math.max(0, Math.min(topeCreditos ?? total, total - otrosCanales));
    return { mes, usados, total, limite, porcentaje: limite > 0 ? Math.min(100, Math.floor((usados * 100) / limite)) : 100, otrosCanales };
  }

  protected async estadoComun(businessId: string, cfg: Cfg | null): Promise<EstadoComun> {
    const [disponible, conectado, pedidos, cupo] = await Promise.all([
      this.tienePack(businessId),
      this.estaConectado(businessId),
      this.disponibilidadDePedidos(businessId),
      this.cupo(businessId, cfg?.topeCreditos ?? null),
    ]);
    return {
      disponible,
      conectado,
      enabled: cfg?.enabled ?? false,
      modo: cfg?.modo ?? 'SELECCIONADOS',
      instrucciones: cfg?.instrucciones ?? null,
      topeCreditos: cfg?.topeCreditos ?? null,
      tomaPedidos: cfg?.tomaPedidos ?? false,
      maxUnidades: cfg?.maxUnidades ?? 10,
      maxMonto: cfg?.maxMonto ?? 200000,
      pedidos,
      cupo,
    };
  }

  /** Si la tienda puede tomar pedidos por chat (ventas online + "coordinar por WhatsApp"), o qué le falta. */
  protected async disponibilidadDePedidos(businessId: string): Promise<{ disponible: boolean; motivo?: string }> {
    if (!this.pedidos) return { disponible: false, motivo: 'No disponible en este entorno.' };
    const d = await this.pedidos.disponibilidad(businessId);
    return { disponible: d.ok, ...(d.motivo ? { motivo: d.motivo } : {}) };
  }

  /** Valida lo que el dueño quiere encender y arma los datos comunes a guardar. */
  protected async datosComunes(businessId: string, dto: CambiosComunes): Promise<Record<string, unknown>> {
    if (dto.enabled === true && !(await this.tienePack(businessId))) {
      throw new ForbiddenException(`Orbi en ${this.nombreDelCanal} es una función del paquete Avanzado.`);
    }
    if (dto.enabled === true && !(await this.estaConectado(businessId))) {
      throw new BadRequestException(this.canal === 'INSTAGRAM' ? 'Primero conectá tu cuenta de Instagram.' : 'Primero conectá tu cuenta de WhatsApp Business.');
    }
    // Encender la toma de pedidos pide que la tienda venda online y tenga "coordinar por WhatsApp": si no, se dice qué falta.
    if (dto.tomaPedidos === true) {
      const disp = this.pedidos ? await this.pedidos.disponibilidad(businessId) : { ok: false, motivo: 'No disponible en este entorno.' };
      if (!disp.ok) throw new BadRequestException(disp.motivo);
    }
    const instrucciones = dto.instrucciones === undefined ? undefined : dto.instrucciones?.trim() || null;
    return {
      ...(dto.tomaPedidos !== undefined ? { tomaPedidos: dto.tomaPedidos } : {}),
      ...(dto.maxUnidades !== undefined ? { maxUnidades: dto.maxUnidades } : {}),
      ...(dto.maxMonto !== undefined ? { maxMonto: dto.maxMonto } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.modo !== undefined ? { modo: dto.modo } : {}),
      ...(instrucciones !== undefined ? { instrucciones } : {}),
      ...(dto.topeCreditos !== undefined ? { topeCreditos: dto.topeCreditos } : {}),
    };
  }

  /** El dueño enciende, apaga o reactiva Orbi en un chat (también levanta una pausa o una derivación). */
  async cambiarEstadoDelChat(businessId: string, conversationId: string, estado: 'ON' | 'OFF'): Promise<{ botEstado: BotChatEstado }> {
    if (estado === 'ON') {
      const cfg = await this.leerConfig(businessId);
      if (!cfg?.enabled) throw new BadRequestException(`Primero activá Orbi para ${this.nombreDelCanal}.`);
    }
    const r = await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId },
      data: { botEstado: estado, botMotivo: null, botCambiadoAt: new Date() },
    });
    if (r.count === 0) throw new BadRequestException('Conversación no encontrada');
    return { botEstado: estado };
  }

  // ── Atender mensajes ───────────────────────────────────────────────────────

  /** Atiende los mensajes de clientes que acaban de entrar. Nunca tira: el webhook tiene que contestar 200. */
  protected async atenderTodos(mensajes: MensajeDeCliente[]): Promise<void> {
    // Un cliente que manda varios mensajes seguidos en el mismo aviso se atiende una sola vez, por el último.
    const ultimoPorChat = new Map<string, MensajeDeCliente>();
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
   * ¿Este sigue siendo el último mensaje del chat en este canal, y es del cliente? Falso si el cliente siguió escribiendo (lo
   * atiende el aviso de ese último mensaje, con todo el contexto) o si ya contestó alguien (otra corrida de Orbi, o una persona).
   */
  protected async esElUltimoSinContestar(conversationId: string, messageId: string): Promise<boolean> {
    const ultimo = await this.prisma.message.findFirst({
      where: { conversationId, channel: this.canal },
      orderBy: { createdAt: 'desc' },
      select: { id: true, sender: true },
    });
    return !!ultimo && ultimo.id === messageId && ultimo.sender === 'CUSTOMER';
  }

  protected async leerChat(businessId: string, conversationId: string) {
    return this.prisma.conversation.findFirst({ where: { id: conversationId, businessId }, select: { botEstado: true, isArchived: true, botBorrador: true } });
  }

  private esperaMs(): number {
    const propia = this.config.get<string>(`${this.canal}_BOT_ESPERA_MS`) ?? this.config.get<string>('WHATSAPP_BOT_ESPERA_MS');
    const n = Number(propia ?? 3500);
    return Number.isFinite(n) ? n : 3500;
  }

  private async atenderUno(m: MensajeDeCliente): Promise<void> {
    const { businessId, conversationId } = m;
    const cfg = await this.leerConfig(businessId);
    const chat = await this.leerChat(businessId, conversationId);
    if (!cfg || !chat || !orbiAtiendeElChat(cfg, chat.botEstado)) return;
    if (!(await this.tienePack(businessId))) return;

    // Espera a que termine de escribir; al despertar, solo sigue si este es el último mensaje y nadie contestó.
    const espera = this.esperaMs();
    if (espera > 0) await dormir(espera);
    if (!(await this.esElUltimoSinContestar(conversationId, m.messageId))) return;
    const ahora = await this.leerChat(businessId, conversationId);
    if (!ahora || !orbiAtiendeElChat(cfg, ahora.botEstado)) return;

    const negocio = await this.prisma.business.findFirst({ where: { id: businessId, isActive: true, isPaused: false, deletedAt: null }, select: { name: true, subdomain: true } });
    if (!negocio) return;

    const ctx: ContextoDelBot = { businessId, slug: negocio.subdomain, customerId: m.customerId, ...(this.canal !== 'WHATSAPP' ? { canal: this.canal } : {}) };

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
    if (this.tomaPedidos(cfg)) {
      const hayBorrador = borradorVigente(ahora.botBorrador) !== null;
      const dijo = m.esTexto && !m.opcionId ? m.texto ?? '' : '';
      if (m.opcionId === ID_CONFIRMAR || (hayBorrador && esAfirmativo(dijo))) return this.confirmarPedido(m, ahora.botBorrador, negocio);
      if (m.opcionId === ID_CAMBIAR || (hayBorrador && esNegativo(dijo))) {
        await this.pedidos!.descartar(businessId, conversationId);
        await this.contestar(m, 'Sin problema. Contame qué querés cambiar o agregar y lo armamos de nuevo.', { status: 'ok', derivar: null });
        return;
      }
    }

    if (await this.atenderSinModelo(m, cfg, negocio, ctx)) return;

    if (!m.esTexto) {
      await this.contestar(m, MENSAJE_SIN_MEDIOS, { status: 'ok', derivar: null });
      return;
    }

    await this.responderConModelo(m, cfg, negocio, ctx);
  }

  private tomaPedidos(cfg: Cfg): boolean {
    return !!cfg.tomaPedidos && this.usaIa(cfg) && !!this.pedidos;
  }

  /** Contesta con la IA (Workers AI → Groq → Gemini). `pedido`: lo que el cliente quiso decir al tocar una opción del menú. */
  protected async responderConModelo(m: MensajeDeCliente, cfg: Cfg, negocio: Negocio, ctx: ContextoDelBot, pedido?: string) {
    const { businessId, conversationId } = m;
    // Cupo del mes: agotado, Orbi se calla y avisa al dueño.
    const cupo = await this.cupo(businessId, cfg.topeCreditos);
    if (cupo.usados >= cupo.limite) {
      await this.contestar(m, MENSAJE_DE_DERIVACION, { status: 'quota', derivar: `Se agotó el cupo mensual de Orbi en ${this.nombreDelCanal}.` });
      return;
    }

    const inicio = Date.now();
    // Mientras el modelo piensa (unos segundos), el cliente ve "escribiendo…" en vez de silencio.
    await this.escribiendo(m);
    try {
      const cliente = await this.prisma.customer.findFirst({ where: { id: m.customerId, businessId }, select: { firstName: true } });
      const previas = await this.prisma.message.count({ where: { conversationId, viaOrbi: true, channel: this.canal } });
      const historial = await this.historial(conversationId);
      const tomaPedidos = this.tomaPedidos(cfg);
      const ctxIa: ContextoDelBot = {
        ...ctx,
        enviarFoto: this.enviadorDeFotos(m),
        ...(tomaPedidos ? { prepararPedido: (items) => this.pedidos!.preparar({ ...ctx, conversationId }, { maxUnidades: cfg.maxUnidades, maxMonto: cfg.maxMonto }, items) } : {}),
      };
      // Al tocar una opción, el último mensaje del cliente es solo el título ("Mis pedidos"): se le explica qué quiso decir.
      if (pedido && historial.length > 0 && historial[historial.length - 1].role === 'user') historial[historial.length - 1] = { role: 'user', content: pedido };
      const r = await this.correrModelo({
        sistema: promptDelBot({
          tienda: negocio.name,
          link: `https://${negocio.subdomain}.orbita.site`,
          cliente: nombreDePila(cliente?.firstName),
          instrucciones: cfg.instrucciones,
          esPrimeraRespuesta: previas === 0,
          tomaPedidos,
          ...(this.canal !== 'WHATSAPP' ? { canal: this.canal } : {}),
        }),
        historial,
        ctx: ctxIa,
        tomaPedidos,
      });
      const texto = r.texto.trim().slice(0, this.maxCaracteres());
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
          await this.enviarResumen(m, textoDelResumen(borrador, this.canal), { status: 'ok', derivar: null, ...r.metricas, latencyMs: Date.now() - inicio });
          return;
        }
      }
      if (!texto && !r.derivar) {
        await this.contestar(m, MENSAJE_DE_DERIVACION, { status: 'error', derivar: 'Orbi no pudo armar una respuesta.', ...r.metricas, latencyMs: Date.now() - inicio });
        return;
      }
      await this.contestar(m, texto || MENSAJE_DE_DERIVACION, { status: r.derivar ? 'derivado' : 'ok', derivar: r.derivar, enBloques: true, ...r.metricas, latencyMs: Date.now() - inicio });
    } catch (e) {
      this.logger.error(`Orbi falló al responder en ${conversationId}: ${describeError(e)}`);
      // Si mientras tanto ya contestó otra corrida (o una persona), el chat está atendido: no hace falta derivarlo.
      if (await this.esElUltimoSinContestar(conversationId, m.messageId)) {
        await this.derivar(businessId, conversationId, 'Orbi no pudo responder: lo revisa una persona.');
      }
      await this.registrar({ businessId, conversationId, status: 'error', errorCategory: (e as Error)?.name ?? 'error', latencyMs: Date.now() - inicio });
    }
  }

  /** Los últimos mensajes del chat en este canal como conversación con el modelo (lo de la tienda, sea Orbi o una persona, es "assistant"). */
  private async historial(conversationId: string): Promise<LlmMessage[]> {
    const filas = await this.prisma.message.findMany({
      where: { conversationId, channel: this.canal },
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
    return (
      this.config.get<string>(`ORBI_MODEL_${this.canal}`) ??
      this.config.get<string>('ORBI_MODEL_WHATSAPP') ??
      this.config.get<string>('ORBI_MODEL_PANEL') ??
      this.config.get<string>('ORBI_MODEL') ??
      undefined
    );
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

  /**
   * Lo que usa la herramienta de fotos: manda la foto del producto y la deja en el chat, marcada como de Orbi. Tiene tope
   * por respuesta y no repite una foto. No cuesta nada de IA, pero cada foto es un mensaje más en el chat.
   */
  private enviadorDeFotos(m: MensajeDeCliente): NonNullable<ContextoDelBot['enviarFoto']> {
    const mandadas = new Set<string>();
    return async ({ url, pie }) => {
      if (mandadas.has(url)) return { ok: false, error: 'Esa foto ya se la mandaste: seguí con la charla.' };
      if (mandadas.size >= FOTOS_MAX_POR_RESPUESTA) return { ok: false, error: `Ya mandaste ${FOTOS_MAX_POR_RESPUESTA} fotos en este mensaje: para ver más, pasale el link de la tienda.` };
      try {
        const foto = await this.enviarFoto(m, url, pie);
        if (!foto) return { ok: false, error: 'No se pudo mandar la foto ahora: pasale el link del producto.' };
        mandadas.add(url);
        await this.prisma.message.create({
          data: {
            conversationId: m.conversationId, sender: 'STORE', text: foto.texto, channel: this.canal, externalId: foto.externalId, deliveryStatus: 'sent', viaOrbi: true,
            attachments: [{ tipo: 'image', url: foto.url }],
          },
        });
        return { ok: true, datos: 'Foto enviada.' };
      } catch (e) {
        this.logger.warn(`Orbi no pudo mandar una foto en ${m.conversationId}: ${describeError(e)}`);
        return { ok: false, error: 'No se pudo mandar la foto ahora: pasale el link del producto.' };
      }
    };
  }

  /** Manda la respuesta por el canal, la guarda en el chat marcada como de Orbi y, si hay que derivar, deja el chat para una persona. */
  protected async contestar(m: MensajeDeCliente, textoCrudo: string, d: DatosDeLaRespuesta, enviar?: () => Promise<string>) {
    const { businessId, conversationId } = m;
    const { derivar, sinAviso, enBloques, ...turno } = d;
    // La respuesta del modelo sale en mensajes cortos; lo fijo (menú, resumen del pedido, avisos) sale tal cual, en uno.
    const partes = !enviar && enBloques ? partirEnBloques(textoCrudo) : [];
    const bloques = (partes.length > 0 ? partes : [textoCrudo]).map((b) => this.ajustarTexto(b));
    const guardar = (texto: string, externalId: string) =>
      this.prisma.message.create({
        data: { conversationId, sender: 'STORE', text: texto, channel: this.canal, externalId, deliveryStatus: 'sent', viaOrbi: true },
      });

    // Todos menos el último se guardan apenas salen (así quedan en orden en el chat); el último va con el cambio de la charla.
    // El que salió y todavía no se guardó.
    let pendiente: { texto: string; externalId: string } | null = null;
    for (let i = 0; i < bloques.length; i++) {
      const texto = bloques[i];
      try {
        if (pendiente) {
          await guardar(pendiente.texto, pendiente.externalId);
          pendiente = null;
          await this.escribiendo(m);
          await dormir(pausaDeEscritura(texto, this.config));
        }
        pendiente = { texto, externalId: i === 0 && enviar ? await enviar() : await this.enviarTexto(m, texto) };
      } catch (e) {
        this.logger.warn(`Orbi no pudo enviar la respuesta en ${conversationId}: ${describeError(e)}`);
        if (i === 0) {
          await this.derivar(businessId, conversationId, 'Orbi no pudo enviar su respuesta: lo revisa una persona.');
          await this.registrar({ ...turno, businessId, conversationId, status: 'error', errorCategory: 'envio' });
          return;
        }
        // Ya salió una parte: la charla sigue con lo que llegó.
        break;
      }
    }
    await this.prisma.$transaction([
      ...(pendiente ? [guardar(pendiente.texto, pendiente.externalId)] : []),
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

  protected async derivar(businessId: string, conversationId: string, motivo: string): Promise<void> {
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
      const link = this.linkDelChat(businessId, conversationId);
      await this.notificaciones.dispatch('orbi_necesita_atencion', businessId, {
        title: `${nombre} necesita atención en ${this.nombreDelCanal}`,
        body: motivo,
        emailSubject: `${nombre} necesita atención en ${this.nombreDelCanal}`,
        emailBody: `Orbi te pasó un chat de ${this.nombreDelCanal}: ${nombre} necesita que lo atienda una persona.\n\nMotivo: ${motivo}${ultimo ? `\nSu último mensaje: «${ultimo.text.slice(0, 200)}»` : ''}${this.notaParaElDueno()}\n\nAbrir el chat: ${link}`,
        resourceType: 'conversation',
        resourceId: conversationId,
      });
    } catch (e) {
      this.logger.warn(`No se pudo avisar que el chat ${conversationId} necesita atención: ${describeError(e)}`);
    }
  }

  /** El resumen del pedido con los botones "Confirmar pedido" / "Cambiar" (o, si el canal no los deja, con "sí" / "cambiar"). */
  private async enviarResumen(m: MensajeDeCliente, resumen: string, d: DatosDeLaRespuesta) {
    const { texto, enviar } = this.resumenDelPedido(m, resumen);
    await this.contestar(m, texto, d, enviar);
  }

  /** El cliente confirmó el resumen: se crea el pedido pendiente y el chat queda para que una persona coordine el pago y la entrega. */
  private async confirmarPedido(m: MensajeDeCliente, borrador: unknown, negocio: Negocio) {
    const telefono = this.telefonoDelCliente(m);
    const r = await this.pedidos!.confirmar({
      businessId: m.businessId, conversationId: m.conversationId, customerId: m.customerId, slug: negocio.subdomain, tienda: negocio.name, borrador,
      ...(telefono ? { telefono } : {}),
      canal: this.canal,
    });
    if (r.ok) {
      // El aviso al dueño ya salió como "pedido pendiente": no se manda además el de "necesita atención".
      await this.contestar(m, r.texto, { status: 'ok', derivar: `Pedido #${r.pedido.numero} tomado por Orbi: falta coordinar el pago y la entrega.`, sinAviso: true });
    } else {
      await this.contestar(m, r.texto, { status: r.derivar ? 'derivado' : 'ok', derivar: r.derivar || null });
    }
  }

  protected async registrar(t: TurnoParaGuardar): Promise<void> {
    try {
      await this.prisma.whatsappBotTurn.create({
        data: {
          businessId: t.businessId,
          conversationId: t.conversationId,
          canal: this.canal,
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
      this.logger.warn(`No se pudo registrar el turno de Orbi en ${this.nombreDelCanal}: ${(e as Error)?.name ?? 'error'}`);
    }
  }
}

/**
 * El nombre para que Orbi salude. En Instagram, si el perfil no tiene nombre, el cliente queda como "@usuario" o
 * "Instagram 1234": eso no es un nombre de pila y Orbi no lo usa.
 */
export function nombreDePila(firstName: string | null | undefined): string | null {
  const n = firstName?.trim();
  if (!n || n.startsWith('@') || /^Instagram \d{1,4}$/.test(n)) return null;
  return n;
}
