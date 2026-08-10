import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CustomerMessageDto } from './dto/customer-message.dto';

// Chat cliente↔tienda. Una sola conversación por (business, customer) —
// nace recién cuando el cliente manda su primer mensaje, no se crea una
// vacía de antemano. `isUnread` es SIEMPRE desde el punto de vista del
// STAFF (¿hay algo nuevo que el dueño/empleado todavía no leyó?): se prende
// cuando el cliente escribe, se apaga cuando el staff abre la conversación o
// contesta. No hay un flag simétrico para "el cliente no leyó la respuesta"
// — el schema no lo tiene, y el storefront no necesita ese detalle todavía.
type MensajeRow = { id: string; sender: string; text: string; orderId: string | null; createdAt: Date };

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private aMensaje(m: MensajeRow) {
    return { id: m.id, sender: m.sender, text: m.text, orderId: m.orderId, createdAt: m.createdAt };
  }

  // ── Panel (staff) ──────────────────────────────────────────────────────────

  async findAllForBusiness(businessId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { businessId },
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      customerId: c.customerId,
      customerName: `${c.customer.firstName}${c.customer.lastName ? ' ' + c.customer.lastName : ''}`,
      customerEmail: c.customer.email,
      customerAvatar: c.customer.avatarUrl,
      isUnread: c.isUnread,
      isArchived: c.isArchived,
      lastMessage: c.messages[0] ? this.aMensaje(c.messages[0]) : null,
      updatedAt: c.updatedAt,
    }));
  }

  // Abrir una conversación desde el panel la marca leída — mismo criterio que
  // cualquier bandeja de entrada (Gmail, WhatsApp Web). Si ya estaba leída,
  // el update es un no-op inofensivo.
  async getMessages(businessId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, businessId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const messages = await this.prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
    if (conv.isUnread) {
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { isUnread: false } });
    }
    return messages.map((m) => this.aMensaje(m));
  }

  async sendMessage(businessId: string, conversationId: string, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, businessId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const msg = await this.prisma.message.create({
      data: { conversationId, sender: 'STORE', text: dto.text, orderId: dto.orderId },
    });
    // El staff acaba de contestar: la conversación queda "al día" desde su
    // propio punto de vista.
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { isUnread: false, updatedAt: new Date() } });
    return this.aMensaje(msg);
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

  // ── Storefront (cliente) ────────────────────────────────────────────────────

  // Nunca crea la conversación acá — mirar el chat no es un evento que
  // amerite un registro nuevo. `id: null` + `messages: []` significa
  // "todavía no le escribiste a esta tienda".
  async myThread(businessId: string, customerId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { businessId, customerId } });
    if (!conv) return { id: null, messages: [] };

    const messages = await this.prisma.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: 'asc' } });
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
