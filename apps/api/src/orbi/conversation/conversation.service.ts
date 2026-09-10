import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
}

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(businessId: string, userId: string, surface: string) {
    const existing = await this.prisma.orbiConversation.findFirst({
      where: { businessId, userId, surface },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;

    return this.prisma.orbiConversation.create({
      data: { businessId, userId, surface, messages: [] },
    });
  }

  /**
   * Una conversación es SIEMPRE de un negocio y de una persona.
   *
   * El id lo manda el cliente en cada mensaje (`dto.conversationId`), así que
   * buscarlo solo por id es un IDOR: hasta la auditoría interna del 09/09
   * (ítem `api.prisma`, verificación 2) alcanzaba con poner el id de la
   * conversación de OTRO negocio para que Orbi la leyera entera y la usara
   * como historial — o para escribirle mensajes adentro. Los uuid no se
   * adivinan, pero eso es un obstáculo, no un control de acceso.
   *
   * Devuelve null en vez de tirar para que el caller decida: en el chat, una
   * conversación que no es tuya se trata igual que una que no existe.
   */
  private async propia(conversationId: string, businessId: string, userId: string) {
    return this.prisma.orbiConversation.findFirst({
      where: { id: conversationId, businessId, userId },
    });
  }

  /** Igual que `propia()`, pero para los caminos donde no seguir es un error. */
  async assertPropia(conversationId: string, businessId: string, userId: string): Promise<string> {
    const conv = await this.propia(conversationId, businessId, userId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv.id;
  }

  async appendMessage(conversationId: string, businessId: string, userId: string, message: ConversationMessage) {
    const conv = await this.propia(conversationId, businessId, userId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const messages = conv.messages as unknown as ConversationMessage[];
    messages.push(message);
    await this.prisma.orbiConversation.update({
      where: { id: conv.id },
      data: { messages: messages as unknown as any[], updatedAt: new Date() },
    });
  }

  async getMessages(conversationId: string, businessId: string, userId: string): Promise<ConversationMessage[]> {
    const conv = await this.propia(conversationId, businessId, userId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv.messages as unknown as ConversationMessage[];
  }
}
