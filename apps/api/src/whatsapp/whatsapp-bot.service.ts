import { ConflictException, Inject, Injectable, Logger, Optional, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import type { WhatsappBotConfig } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { WhatsappService } from './whatsapp.service';
import { LLM_ADAPTER_BOT, type LlmAdapter } from '../orbi/llm/llm-adapter.interface';
import { describeError } from '../common/utils/describe-error.util';
import type { ContextoDelBot } from '../orbi/atencion/herramientas';
import { ID_CAMBIAR, ID_CONFIRMAR, PedidosPorChatService } from '../orbi/atencion/pedidos';
import { NotificationsService } from '../notifications/notifications.service';
import { AtencionDeOrbi, type CambiosComunes, type EstadoComun, type FotoEnviada, type Negocio } from '../orbi/atencion/atencion-de-orbi';
import type { MensajeDeCliente, MensajeEntrante } from '../orbi/atencion/estado';
import { MAX_CARACTERES_RESPUESTA, MENSAJE_DE_DERIVACION } from '../orbi/atencion/prompt';
import {
  MARCA_MENU_TEXTO, PEDIDO_DE_OPCION, armarMenuInteractivo, armarMenuTexto, bienvenidaPorDefecto, esSaludoOPedidoDeMenu, opcionDeNumero, opcionesActivas,
  opcionesDelMenu, validarMenu, LIMITES_MENU, type MenuEstilo, type Modalidad, type OpcionDeMenu,
} from './whatsapp-bot-menu';

// Orbi como atención al público por WhatsApp (función del paquete Avanzado). El flujo (cuándo contesta, la IA, los pedidos,
// derivar y avisar al dueño, el cupo) es el mismo en todos los canales y vive en orbi/atencion/atencion-de-orbi.ts. Acá
// queda lo propio de WhatsApp: cómo se manda cada cosa (texto, foto con pie, lista y botones interactivos) y el menú de
// opciones (modalidades "menú y conversación" y "solo menú").

export interface EstadoDelBot extends EstadoComun {
  /** Cómo atiende Orbi: todo con IA, menú + IA, o solo menú. */
  modalidad: Modalidad;
  menuEstilo: MenuEstilo;
  /** Lo que escribió el dueño (null = el de siempre) y el de siempre, para mostrarlo de ejemplo. */
  bienvenida: string | null;
  bienvenidaPorDefecto: string;
  /** Las opciones del menú, en orden, con las del dueño (o las de fábrica si no editó nada). */
  menuOpciones: OpcionDeMenu[];
}

const aMensajeDeCliente = ({ waId, ...m }: MensajeEntrante): MensajeDeCliente => ({ ...m, destinatario: waId });

@Injectable()
export class WhatsappBotService extends AtencionDeOrbi<WhatsappBotConfig> {
  protected readonly logger = new Logger(WhatsappBotService.name);
  protected readonly canal = 'WHATSAPP' as const;

  constructor(
    prisma: PrismaService,
    config: ConfigService,
    private readonly whatsapp: WhatsappService,
    storefront: StorefrontService,
    @Inject(LLM_ADAPTER_BOT) llm: Pick<LlmAdapter, 'streamChat'>,
    // Opcionales por compatibilidad con los specs anteriores; Nest los inyecta siempre (AtencionOrbiModule / NotificationsModule).
    @Optional() pedidos?: PedidosPorChatService,
    @Optional() notificaciones?: NotificationsService,
  ) {
    super(prisma, config, storefront, llm, pedidos, notificaciones);
  }

  // ── Configuración del negocio (panel) ──────────────────────────────────────

  async estado(businessId: string): Promise<EstadoDelBot> {
    const [cfg, negocio] = await Promise.all([
      this.prisma.whatsappBotConfig.findUnique({ where: { businessId } }),
      this.prisma.business.findFirst({ where: { id: businessId }, select: { name: true } }),
    ]);
    return {
      ...(await this.estadoComun(businessId, cfg)),
      modalidad: (cfg?.modalidad as Modalidad | undefined) ?? 'CONVERSACIONAL',
      menuEstilo: (cfg?.menuEstilo as MenuEstilo | undefined) ?? 'LISTA',
      bienvenida: cfg?.bienvenida ?? null,
      bienvenidaPorDefecto: bienvenidaPorDefecto(negocio?.name ?? 'la tienda'),
      menuOpciones: opcionesDelMenu(cfg?.menuOpciones),
    };
  }

  async guardar(
    businessId: string,
    dto: CambiosComunes & { modalidad?: Modalidad; menuEstilo?: MenuEstilo; bienvenida?: string | null; menuOpciones?: unknown[] },
  ): Promise<EstadoDelBot> {
    const comunes = await this.datosComunes(businessId, dto);
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
      ...comunes,
    };
    await this.prisma.whatsappBotConfig.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
    return this.estado(businessId);
  }

  // ── Lo propio del canal ────────────────────────────────────────────────────

  /** Llamado por el webhook con los mensajes de clientes que acaban de entrar. Nunca tira: el webhook tiene que contestar 200. */
  async atender(mensajes: MensajeEntrante[]): Promise<void> {
    await this.atenderTodos(mensajes.map(aMensajeDeCliente));
  }

  protected leerConfig(businessId: string) {
    return this.prisma.whatsappBotConfig.findUnique({ where: { businessId } });
  }

  protected async estaConectado(businessId: string): Promise<boolean> {
    const conexion = await this.prisma.whatsappConnection.findUnique({ where: { businessId }, select: { status: true } });
    return conexion?.status === 'ACTIVE';
  }

  protected enviarTexto(m: MensajeDeCliente, texto: string): Promise<string> {
    return this.whatsapp.enviarTexto(m.businessId, m.conversationId, m.destinatario, texto);
  }

  protected async enviarFoto(m: MensajeDeCliente, url: string, pie: string): Promise<FotoEnviada | null> {
    // En WhatsApp la foto lleva el nombre de pie: así queda también en el chat.
    const foto = await this.whatsapp.enviarFotoDeProducto(m.businessId, m.conversationId, m.destinatario, url, pie);
    return foto ? { ...foto, texto: pie } : null;
  }

  protected resumenDelPedido(m: MensajeDeCliente, resumen: string) {
    const texto = `${resumen}\n\nRespondé *sí* para confirmar o *cambiar* para modificarlo.`;
    const interactivo = {
      type: 'button',
      body: { text: resumen.slice(0, 1024) },
      action: { buttons: [{ type: 'reply', reply: { id: ID_CONFIRMAR, title: 'Confirmar pedido' } }, { type: 'reply', reply: { id: ID_CAMBIAR, title: 'Cambiar' } }] },
    };
    return { texto, enviar: () => this.interactivoOTexto(m, interactivo, texto, 'los botones del pedido') };
  }

  protected linkDelChat(businessId: string, conversationId: string): string {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    return `${frontend}/admin/${businessId}/ventas/mensajes?canal=whatsapp&conv=${conversationId}`;
  }

  protected maxCaracteres(): number {
    return MAX_CARACTERES_RESPUESTA;
  }

  protected telefonoDelCliente(m: MensajeDeCliente): string {
    return m.destinatario;
  }

  /** WhatsApp muestra "escribiendo…" sobre el mensaje que se contesta: hace falta su id en Meta. */
  protected async mostrarEscribiendo(m: MensajeDeCliente): Promise<void> {
    const entrante = await this.prisma.message.findUnique({ where: { id: m.messageId }, select: { externalId: true, conversationId: true } });
    if (entrante?.externalId && entrante.conversationId === m.conversationId) await this.whatsapp.mostrarEscribiendo(m.businessId, entrante.externalId);
  }

  protected usaIa(cfg: WhatsappBotConfig): boolean {
    return cfg.modalidad !== 'SOLO_MENU';
  }

  /** Un mensaje interactivo (lista o botones) y, si WhatsApp no lo deja, lo mismo en texto. */
  private async interactivoOTexto(m: MensajeDeCliente, interactivo: Record<string, unknown>, texto: string, que: string): Promise<string> {
    try {
      return await this.whatsapp.enviarInteractivo(m.businessId, m.conversationId, m.destinatario, interactivo);
    } catch (e) {
      // Ni el plazo de 24 h vencido ni un token vencido se arreglan con texto; cualquier otro rechazo del interactivo sí.
      if (e instanceof UnprocessableEntityException || e instanceof ConflictException) throw e;
      this.logger.warn(`WhatsApp no aceptó ${que} en ${m.conversationId}; va en texto: ${describeError(e)}`);
      return this.whatsapp.enviarTexto(m.businessId, m.conversationId, m.destinatario, texto);
    }
  }

  // ── El menú (solo WhatsApp) ────────────────────────────────────────────────

  /** El menú contesta antes que la IA: la opción que eligió, o el menú mismo en "solo menú" y en el primer contacto de "menú y conversación". */
  protected async atenderSinModelo(m: MensajeDeCliente, cfg: WhatsappBotConfig, negocio: Negocio, ctx: ContextoDelBot): Promise<boolean> {
    const modalidad = (cfg.modalidad as Modalidad) ?? 'CONVERSACIONAL';
    if (modalidad === 'CONVERSACIONAL') return false;
    const opciones = opcionesActivas(cfg.menuOpciones);

    // El cliente eligió una opción del menú (la tocó, o respondió con su número).
    const elegida = (m.opcionId ? opciones.find((o) => o.id === m.opcionId) : undefined) ?? (await this.opcionPorNumero(m, opciones));
    if (elegida) {
      await this.atenderOpcion(m, cfg, negocio, ctx, elegida);
      return true;
    }
    // Lo que no es texto lo contesta la base ("solo leo texto").
    if (!m.esTexto) return false;

    if (modalidad === 'SOLO_MENU') {
      // Sin IA: cualquier otro texto vuelve a mostrar el menú (y una frase si no era un saludo).
      const aviso = (await this.hayRespuestasDeOrbi(m.conversationId)) && !esSaludoOPedidoDeMenu(m.texto ?? '') ? 'No te entendí del todo 🙂 Elegí una opción:' : undefined;
      await this.enviarMenu(m, cfg, negocio, opciones, aviso);
      return true;
    }
    if (!(await this.hayRespuestasDeOrbi(m.conversationId)) || esSaludoOPedidoDeMenu(m.texto ?? '')) {
      // El primer contacto y los saludos abren con el menú; lo demás lo conversa la IA.
      await this.enviarMenu(m, cfg, negocio, opciones);
      return true;
    }
    return false;
  }

  private async hayRespuestasDeOrbi(conversationId: string): Promise<boolean> {
    return (await this.prisma.message.count({ where: { conversationId, viaOrbi: true } })) > 0;
  }

  /** "2" suelto como elección de la opción 2, pero solo si lo último que mandó Orbi fue un menú en texto. */
  private async opcionPorNumero(m: MensajeDeCliente, opciones: OpcionDeMenu[]): Promise<OpcionDeMenu | undefined> {
    if (!m.esTexto || !m.texto) return undefined;
    const op = opcionDeNumero(m.texto, opciones);
    if (!op) return undefined;
    const ultimo = await this.prisma.message.findFirst({ where: { conversationId: m.conversationId, viaOrbi: true }, orderBy: { createdAt: 'desc' }, select: { text: true } });
    return ultimo?.text.includes(MARCA_MENU_TEXTO) ? op : undefined;
  }

  /** Manda el menú: interactivo (lista o botones) y, si WhatsApp no lo deja, el mismo menú en texto numerado. */
  private async enviarMenu(m: MensajeDeCliente, cfg: WhatsappBotConfig, negocio: { name: string }, opciones: OpcionDeMenu[], aviso?: string) {
    const bienvenida = cfg.bienvenida?.trim() || bienvenidaPorDefecto(negocio.name);
    const guardado = armarMenuTexto(bienvenida, opciones, aviso);
    const interactivo = armarMenuInteractivo(aviso ? `${aviso}\n\n${bienvenida}` : bienvenida, opciones, cfg.menuEstilo as MenuEstilo);
    await this.contestar(m, guardado, { status: 'ok', derivar: null }, () => this.interactivoOTexto(m, interactivo, guardado, 'el menú interactivo'));
  }

  /** El cliente eligió una opción: hablar con una persona, una respuesta propia del dueño, o una de fábrica (fija, o con IA). */
  private async atenderOpcion(m: MensajeDeCliente, cfg: WhatsappBotConfig, negocio: Negocio, ctx: ContextoDelBot, op: OpcionDeMenu) {
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
}
