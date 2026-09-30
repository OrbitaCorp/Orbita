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

  /**
   * Una conversación nueva, vacía. El chat del panel la crea cuando no le
   * llega un id propio (spec §3.3) y le devuelve el id al front en el primer
   * evento del stream, para que el mensaje siguiente siga en la misma.
   *
   * Reemplaza a `getOrCreate`, que retomaba la última conversación de la
   * persona: con el id viajando en cada mensaje, "nueva conversación" tiene
   * que ser nueva de verdad, y un id ajeno no puede terminar en la de otro.
   */
  async crear(businessId: string, userId: string, surface: string) {
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

  /**
   * Agrega un mensaje en UN solo statement (spec §3.3). Antes se leía el JSON,
   * se agregaba en memoria y se reescribía entero, sin lock: desde la fase 1
   * escriben también las notas de confirmar y cancelar, y con dos escritores a
   * la vez el segundo pisaba al primero y se perdía un mensaje. Así la base
   * serializa los UPDATE sobre la fila y ninguno se pierde.
   *
   * Se guardan los últimos 200: antes la conversación crecía sin tope en una
   * sola fila JSON (auditoría interna 10/09, ítem api.orbi). Al modelo le
   * llegan igual solo los últimos HISTORIAL_PANEL (ver OrbiController).
   *
   * El filtro de dueño va en el mismo WHERE (ver `propia()`): si no toca
   * ninguna fila, la conversación no es de esta persona o no existe, y se
   * responde igual que antes.
   */
  async appendMessage(conversationId: string, businessId: string, userId: string, message: ConversationMessage) {
    // Un array de un elemento, como texto JSON: el `::jsonb` lo convierte en la
    // base y `||` lo concatena al final del array guardado.
    const nuevo = JSON.stringify([message]);
    const filas = await this.prisma.$executeRaw`
      UPDATE orbi_conversations
      SET messages = (
        SELECT COALESCE(jsonb_agg(m ORDER BY i), '[]'::jsonb)
        FROM jsonb_array_elements(messages || ${nuevo}::jsonb) WITH ORDINALITY AS t(m, i)
        WHERE i > jsonb_array_length(messages || ${nuevo}::jsonb) - 200
      ), updated_at = now()
      WHERE id = ${conversationId} AND business_id = ${businessId} AND user_id = ${userId}`;
    if (filas === 0) throw new NotFoundException('Conversación no encontrada');
  }

  /**
   * Los mensajes guardados si la conversación es de este negocio y de esta
   * persona; null si es ajena o no existe. El chat trata los dos casos igual
   * (crea una nueva, sin error): si uno diera error y el otro no, el endpoint
   * serviría para averiguar qué ids existen.
   */
  async historialSiEsPropia(conversationId: string, businessId: string, userId: string): Promise<ConversationMessage[] | null> {
    const conv = await this.propia(conversationId, businessId, userId);
    return conv ? (conv.messages as unknown as ConversationMessage[]) : null;
  }

  async getMessages(conversationId: string, businessId: string, userId: string): Promise<ConversationMessage[]> {
    const conv = await this.propia(conversationId, businessId, userId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv.messages as unknown as ConversationMessage[];
  }
}
