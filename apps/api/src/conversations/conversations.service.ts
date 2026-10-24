import { pausarSiAtendiaOrbi } from '../whatsapp/whatsapp-bot-estado';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CustomerMessageDto } from './dto/customer-message.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { InstagramService } from '../instagram/instagram.service';

// Chat cliente↔tienda. Una sola conversación por (business, customer) —
// nace recién cuando el cliente manda su primer mensaje, no se crea una
// vacía de antemano. `isUnread` es SIEMPRE desde el punto de vista del
// STAFF (¿hay algo nuevo que el dueño/empleado todavía no leyó?): se prende
// cuando el cliente escribe, se apaga cuando el staff abre la conversación o
// contesta. No hay un flag simétrico para "el cliente no leyó la respuesta"
// — el schema no lo tiene, y el storefront no necesita ese detalle todavía.
// Para el módulo Mensajes: se saltea la charla que es SOLO de Instagram (esas se atienden en Difusión → Mensajes).
// Una charla vacía o con algún mensaje de otro canal (tienda, WhatsApp) sí va.
const SIN_SOLO_INSTAGRAM = {
  OR: [{ messages: { none: {} } }, { messages: { some: { channel: { not: 'INSTAGRAM' as const } } } }],
};

// Las dos bandejas del panel (Mensajes locales = el chat de la tienda; WhatsApp) NO se mezclan: cada una trabaja solo con
// los mensajes de su canal. Una misma persona puede escribir por los dos y su charla aparece en las dos, cada una con lo suyo.
export type CanalDeBandeja = 'STOREFRONT' | 'WHATSAPP';
export const CANALES_DE_BANDEJA: CanalDeBandeja[] = ['STOREFRONT', 'WHATSAPP'];

type MensajeRow = { id: string; sender: string; text: string; orderId: string | null; channel: string; deliveryStatus: string | null; createdAt: Date; attachments?: unknown; viaOrbi?: boolean };

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    // Opcional por compatibilidad con los specs anteriores a Instagram; en la app
    // real Nest lo inyecta siempre (ConversationsModule importa InstagramModule).
    private readonly instagram?: InstagramService,
  ) {}

  // Los últimos 500 de un hilo, en orden cronológico. Antes se devolvían
  // todos, sin tope (auditoría interna 10/09, ítem api.conversations).
  //
  // `soloTienda` es para lo que ve el CLIENTE en la tienda: solo los mensajes del
  // chat de la tienda, nunca los de WhatsApp. El teléfono que un cliente carga en
  // su cuenta no está verificado: si alguien se registra con el número de otra
  // persona, los WhatsApp de esa persona se vinculan a la cuenta del impostor
  // (ver WhatsappService.resolverCliente) y, sin este filtro, los vería —con las
  // respuestas del negocio— en su chat de la tienda.
  private async ultimosMensajes(conversationId: string, soloTienda = false, canal?: CanalDeBandeja) {
    const recientes = await this.prisma.message.findMany({
      where: { conversationId, ...(soloTienda ? { channel: 'STOREFRONT' as const } : canal ? { channel: canal } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return recientes.reverse();
  }

  private aMensaje(m: MensajeRow) {
    return {
      id: m.id, sender: m.sender, text: m.text, orderId: m.orderId, channel: m.channel, deliveryStatus: m.deliveryStatus, createdAt: m.createdAt,
      // Fotos del mensaje (WhatsApp): [{ tipo: 'image', url }].
      attachments: Array.isArray(m.attachments) ? m.attachments : null,
      // Lo contestó Orbi (el bot de atención de WhatsApp).
      viaOrbi: m.viaOrbi === true,
    };
  }

  // ── Panel (staff) ──────────────────────────────────────────────────────────

  async findAllForBusiness(businessId: string) {
    const rows = await this.prisma.conversation.findMany({
      // Las charlas de Instagram se atienden en Difusión → Mensajes, no acá (por ahora). Una charla de alguien que
      // también escribió por la tienda o WhatsApp sí se ve acá, con esos mensajes.
      where: { businessId, ...SIN_SOLO_INSTAGRAM },
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    // Lo último de cada canal y por dónde escribió el cliente por última vez: con eso cada bandeja arma SU lista, con su
    // propio último mensaje y su propio "sin leer", sin mezclar lo del otro canal.
    const ids = rows.map((r) => r.id);
    const ultimosPorCanal = ids.length === 0 ? [] : await this.prisma.$queryRaw<{ conversation_id: string; id: string; sender: string; text: string; order_id: string | null; channel: string; delivery_status: string | null; created_at: Date; attachments: unknown; via_orbi: boolean }[]>`
      SELECT DISTINCT ON (conversation_id, channel)
        conversation_id, id, sender::text AS sender, text, order_id, channel::text AS channel, delivery_status, created_at, attachments, via_orbi
      FROM messages
      WHERE conversation_id IN (${Prisma.join(ids)}) AND channel IN ('STOREFRONT'::"MessageChannel", 'WHATSAPP'::"MessageChannel")
      ORDER BY conversation_id, channel, created_at DESC`;
    const ultimoDelCliente = ids.length === 0 ? [] : await this.prisma.$queryRaw<{ conversation_id: string; channel: string }[]>`
      SELECT DISTINCT ON (conversation_id) conversation_id, channel::text AS channel
      FROM messages
      WHERE conversation_id IN (${Prisma.join(ids)}) AND sender = 'CUSTOMER'::"MessageSender"
      ORDER BY conversation_id, created_at DESC`;
    const canalDelUltimoCliente = new Map(ultimoDelCliente.map((u) => [u.conversation_id, u.channel]));
    const canalesDe = (conversationId: string, sinLeer: boolean) => {
      const canales: Partial<Record<CanalDeBandeja, { lastMessage: MensajeRow; isUnread: boolean }>> = {};
      for (const m of ultimosPorCanal) {
        if (m.conversation_id !== conversationId) continue;
        canales[m.channel as CanalDeBandeja] = {
          lastMessage: this.aMensaje({ id: m.id, sender: m.sender, text: m.text, orderId: m.order_id, channel: m.channel, deliveryStatus: m.delivery_status, createdAt: m.created_at, attachments: m.attachments, viaOrbi: m.via_orbi }),
          // "Sin leer" es de la bandeja donde llegó el último mensaje del cliente; la otra no se entera.
          isUnread: sinLeer && canalDelUltimoCliente.get(conversationId) === m.channel,
        };
      }
      return canales;
    };

    return rows.map((c) => ({
      id: c.id,
      customerId: c.customerId,
      customerName: `${c.customer.firstName}${c.customer.lastName ? ' ' + c.customer.lastName : ''}`,
      customerEmail: c.customer.email,
      customerAvatar: c.customer.avatarUrl,
      isUnread: c.isUnread,
      isArchived: c.isArchived,
      // Por dónde sigue la charla (WhatsApp o el chat de la tienda): el panel lo muestra en la lista.
      lastChannel: c.messages[0]?.channel ?? 'STOREFRONT',
      lastMessage: c.messages[0] ? this.aMensaje(c.messages[0]) : null,
      canales: canalesDe(c.id, c.isUnread),
      // Orbi en este chat de WhatsApp: su estado y, si está pausado o derivado, por qué.
      bot: { estado: c.botEstado, motivo: c.botMotivo },
      updatedAt: c.updatedAt,
    }));
  }

  // Abrir una conversación desde el panel la marca leída — mismo criterio que
  // cualquier bandeja de entrada (Gmail, WhatsApp Web). Si ya estaba leída,
  // no se toca nada.
  //
  // `marcarLeida: false` (el visitante de solo lectura de la demo pública):
  // abrir el hilo no puede tocar la conversación, que es de todos — el "sin
  // leer" sembrado se le apagaba a los demás con la primera apertura. El
  // visitante lleva lo leído en su navegador (lib/demo/recursos/mensajes.ts).
  async getMessages(businessId: string, conversationId: string, marcarLeida = true, canal?: CanalDeBandeja) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, businessId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const messages = await this.ultimosMensajes(conversationId, false, canal);
    // Con una bandeja elegida, abrir la charla solo la marca leída si lo que estaba sin leer es de ESA bandeja: lo
    // pendiente del otro canal sigue pendiente hasta que se abra allá.
    const loPendienteEsDeEstaBandeja = !canal || (await this.canalDelUltimoMensajeDelCliente(conversationId)) === canal;
    if (conv.isUnread && marcarLeida && loPendienteEsDeEstaBandeja) {
      // Raw UPDATE a propósito: prisma.update() dispara @updatedAt y la bandeja
      // (findAllForBusiness) ordena por updatedAt, así que abrir una
      // conversación para leerla la subía al tope de la lista. updatedAt tiene
      // que representar "último mensaje" (lo setean sendMessage/sendMyMessage),
      // no "última vez que se abrió".
      await this.prisma.$executeRaw`UPDATE "conversations" SET "is_unread" = false WHERE "id" = ${conversationId}`;
    }
    return messages.map((m) => this.aMensaje(m));
  }

  private async canalDelUltimoMensajeDelCliente(conversationId: string): Promise<string | null> {
    const m = await this.prisma.message.findFirst({ where: { conversationId, sender: 'CUSTOMER' }, orderBy: { createdAt: 'desc' }, select: { channel: true } });
    return m?.channel ?? null;
  }

  async sendMessage(businessId: string, conversationId: string, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, businessId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    if (dto.orderId) {
      // La mención a un pedido (#XXXX) tiene que ser de ESTE negocio y del
      // cliente de esta conversación — no un UUID cualquiera.
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, businessId, customerId: conv.customerId },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Pedido no encontrado');
    }

    // La respuesta sale por el canal por el que el cliente escribió por última
    // vez. Si es WhatsApp o Instagram se manda PRIMERO y recién después se guarda: si Meta
    // la rechaza (ventana de 24 h vencida, número inválido) el dueño ve el
    // error y no queda en el hilo un mensaje que el cliente nunca recibió.
    const ultimoDelCliente = await this.prisma.message.findFirst({
      where: { conversationId, sender: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
      select: { channel: true },
    });
    let externalId: string | undefined;
    let canal: 'WHATSAPP' | 'INSTAGRAM' | undefined;
    // Con una bandeja elegida, la respuesta sale por el canal de ESA bandeja, aunque el cliente haya escrito después por
    // el otro: la de WhatsApp siempre sale por WhatsApp y la local siempre queda en el chat de la tienda.
    const forzado = dto.canal;
    const canalDeSalida = forzado ?? ultimoDelCliente?.channel;
    if (canalDeSalida === 'WHATSAPP') {
      const cliente = await this.prisma.customer.findUnique({ where: { id: conv.customerId }, select: { whatsappId: true } });
      if (!cliente?.whatsappId) throw new BadRequestException('Este cliente no tiene un número de WhatsApp asociado');
      externalId = await this.whatsapp.enviarTexto(businessId, conversationId, cliente.whatsappId, dto.text);
      canal = 'WHATSAPP';
    } else if (!forzado && ultimoDelCliente?.channel === 'INSTAGRAM') {
      if (!this.instagram) throw new BadRequestException('Instagram no está disponible');
      const cliente = await this.prisma.customer.findUnique({ where: { id: conv.customerId }, select: { instagramId: true } });
      if (!cliente?.instagramId) throw new BadRequestException('Este cliente no tiene una cuenta de Instagram asociada');
      externalId = await this.instagram.enviarTexto(businessId, conversationId, cliente.instagramId, dto.text);
      canal = 'INSTAGRAM';
    }

    const msg = await this.prisma.message.create({
      data: {
        conversationId, sender: 'STORE', text: dto.text, orderId: dto.orderId,
        ...(externalId && canal ? { channel: canal, externalId, deliveryStatus: 'sent' } : {}),
      },
    });
    // El staff acaba de contestar: la conversación queda "al día" desde su
    // propio punto de vista.
    // Si lo pendiente era de la otra bandeja, contestar acá no lo borra.
    const limpiaPendiente = !forzado || !ultimoDelCliente || ultimoDelCliente.channel === forzado;
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { ...(limpiaPendiente ? { isUnread: false } : {}), updatedAt: new Date() } });
    // Contestó una persona por WhatsApp: si Orbi atendía este chat, se calla.
    if (canal === 'WHATSAPP') await this.pausarOrbi(businessId, conversationId);
    return this.aMensaje(msg);
  }

  /**
   * Manda una foto por WhatsApp (con un pie de foto opcional) desde la bandeja de WhatsApp. Solo WhatsApp y solo fotos.
   * Como el texto: se manda PRIMERO y recién después se guarda, así una respuesta que WhatsApp rechazó (plazo de 24 h
   * vencido) no queda en el hilo como si el cliente la hubiera recibido.
   */
  async enviarImagen(businessId: string, conversationId: string, archivo: Express.Multer.File | undefined, pieDeFoto?: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, businessId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const cliente = await this.prisma.customer.findUnique({ where: { id: conv.customerId }, select: { whatsappId: true } });
    if (!cliente?.whatsappId) throw new BadRequestException('Este cliente no tiene un número de WhatsApp asociado');

    const url = await this.whatsapp.prepararFoto(businessId, archivo);
    const pie = pieDeFoto?.trim().slice(0, 1024) || undefined;
    const externalId = await this.whatsapp.enviarImagen(businessId, conversationId, cliente.whatsappId, url, pie);

    const msg = await this.prisma.message.create({
      data: {
        conversationId, sender: 'STORE', text: pie ?? '[Imagen]', channel: 'WHATSAPP', externalId, deliveryStatus: 'sent',
        attachments: [{ tipo: 'image', url }],
      },
    });
    // Si lo pendiente era del chat de la tienda, contestar por WhatsApp no lo apaga.
    const ultimoDelCliente = await this.canalDelUltimoMensajeDelCliente(conversationId);
    const limpiaPendiente = !ultimoDelCliente || ultimoDelCliente === 'WHATSAPP';
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { ...(limpiaPendiente ? { isUnread: false } : {}), updatedAt: new Date() } });
    await this.pausarOrbi(businessId, conversationId);
    return this.aMensaje(msg);
  }

  // Mejor esfuerzo: que no se pueda pausar a Orbi no puede hacer fallar un mensaje que ya salió.
  private async pausarOrbi(businessId: string, conversationId: string): Promise<void> {
    try {
      await pausarSiAtendiaOrbi(this.prisma, businessId, conversationId);
    } catch {
      /* se reintenta con el próximo mensaje de la persona */
    }
  }

  async update(businessId: string, conversationId: string, dto: UpdateConversationDto) {
    const escrito = await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId },
      data: {
        ...(dto.isUnread !== undefined ? { isUnread: dto.isUnread } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
    });
    if (escrito.count === 0) throw new NotFoundException('Conversación no encontrada');
    return { ok: true };
  }

  async unreadCount(businessId: string) {
    // Sin las de Instagram: tienen su propio contador en Difusión.
    const count = await this.prisma.conversation.count({ where: { businessId, isUnread: true, ...SIN_SOLO_INSTAGRAM } });
    return { count };
  }

  // ── Storefront (cliente) ────────────────────────────────────────────────────

  // Nunca crea la conversación acá — mirar el chat no es un evento que
  // amerite un registro nuevo. `id: null` + `messages: []` significa
  // "todavía no le escribiste a esta tienda".
  async myThread(businessId: string, customerId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { businessId, customerId } });
    if (!conv) return { id: null, messages: [] };

    const messages = await this.ultimosMensajes(conv.id, true);
    return { id: conv.id, messages: messages.map((m) => this.aMensaje(m)) };
  }

  async sendMyMessage(businessId: string, customerId: string, dto: CustomerMessageDto) {
    let conv = await this.prisma.conversation.findFirst({ where: { businessId, customerId } });
    if (!conv) {
      conv = await this.prisma.conversation.create({ data: { businessId, customerId, isUnread: true } });
    } else {
      await this.prisma.conversation.update({ where: { id: conv.id }, data: { isUnread: true, updatedAt: new Date() } });
    }

    const msg = await this.prisma.message.create({ data: { conversationId: conv.id, sender: 'CUSTOMER', text: dto.text } });
    return this.aMensaje(msg);
  }
}
