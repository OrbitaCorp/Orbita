import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { SendMessageDto } from '../conversations/dto/send-message.dto';

// La bandeja de mensajes directos de Instagram de la EMPRESA, dentro del super panel.
//
// La cuenta real de Órbita (@orbita.site) está conectada al negocio de prueba del equipo (ver canales.service.ts),
// y sus mensajes ya caen en la bandeja de ese negocio. Acá se ven y se contestan desde el super panel, usando el
// MISMO servicio de conversaciones del panel de los negocios: la respuesta sale por Instagram si la persona escribió
// por ahí, con la misma ventana de 24 horas y el mismo guardado.
//
// Solo se muestran las conversaciones que tienen mensajes de Instagram, y todo se ata al negocio de la empresa: desde
// acá no se puede leer ni contestar la conversación de ningún otro negocio, ni el chat de la tienda ni WhatsApp.

const NEGOCIO_POR_DEFECTO = 'negocio';
const SOLO_INSTAGRAM = { some: { channel: 'INSTAGRAM' as const } };

export type ConversacionDeInstagram = {
  id: string;
  nombre: string;
  avatar: string | null;
  sinLeer: boolean;
  ultimo: { texto: string; esMio: boolean; fecha: Date } | null;
  actualizadaEl: Date;
};

@Injectable()
export class InstagramBandejaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly conversations: ConversationsService,
  ) {}

  private async negocioId(): Promise<string> {
    const subdominio = this.config.get<string>('MARKETING_NEGOCIO')?.trim().toLowerCase() || NEGOCIO_POR_DEFECTO;
    const negocio = await this.prisma.business.findFirst({ where: { subdomain: subdominio, deletedAt: null }, select: { id: true } });
    if (!negocio) throw new NotFoundException('No se encontró el negocio de la empresa');
    return negocio.id;
  }

  /** La conversación tiene que ser del negocio de la empresa Y tener mensajes de Instagram. */
  private async asegurarDeInstagram(businessId: string, conversationId: string): Promise<void> {
    const c = await this.prisma.conversation.findFirst({ where: { id: conversationId, businessId, messages: SOLO_INSTAGRAM }, select: { id: true } });
    if (!c) throw new NotFoundException('Conversación no encontrada');
  }

  async conversaciones(limite = 100): Promise<ConversacionDeInstagram[]> {
    const businessId = await this.negocioId();
    const filas = await this.prisma.conversation.findMany({
      where: { businessId, isArchived: false, messages: SOLO_INSTAGRAM },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(limite, 1), 200),
      include: {
        customer: { select: { firstName: true, lastName: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, sender: true, createdAt: true } },
      },
    });
    return filas.map((c) => ({
      id: c.id,
      nombre: `${c.customer.firstName}${c.customer.lastName ? ' ' + c.customer.lastName : ''}`,
      avatar: c.customer.avatarUrl,
      sinLeer: c.isUnread,
      ultimo: c.messages[0] ? { texto: c.messages[0].text, esMio: c.messages[0].sender === 'STORE', fecha: c.messages[0].createdAt } : null,
      actualizadaEl: c.updatedAt,
    }));
  }

  /** Abrir el hilo lo marca como leído, igual que en la bandeja de cualquier negocio. */
  async mensajes(conversationId: string) {
    const businessId = await this.negocioId();
    await this.asegurarDeInstagram(businessId, conversationId);
    return this.conversations.getMessages(businessId, conversationId);
  }

  async responder(conversationId: string, dto: SendMessageDto) {
    const businessId = await this.negocioId();
    await this.asegurarDeInstagram(businessId, conversationId);
    return this.conversations.sendMessage(businessId, conversationId, { text: dto.text });
  }
}
