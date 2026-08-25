import { Injectable } from '@nestjs/common';
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

  async appendMessage(conversationId: string, message: ConversationMessage) {
    const conv = await this.prisma.orbiConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    const messages = conv.messages as unknown as ConversationMessage[];
    messages.push(message);
    await this.prisma.orbiConversation.update({
      where: { id: conversationId },
      data: { messages: messages as unknown as any[], updatedAt: new Date() },
    });
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const conv = await this.prisma.orbiConversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    return conv.messages as unknown as ConversationMessage[];
  }
}
