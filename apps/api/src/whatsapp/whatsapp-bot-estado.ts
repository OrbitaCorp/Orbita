import type { PrismaService } from '../prisma/prisma.service';

// Cuándo Orbi atiende un chat de WhatsApp y cómo se calla. Sin dependencias de Nest: lo usan el bot, el webhook (cuando el
// dueño escribe desde el celular) y la bandeja (cuando escribe desde el panel).

/** Un mensaje de cliente recién guardado: lo que el webhook le pasa al bot. */
export interface MensajeEntrante {
  businessId: string;
  conversationId: string;
  customerId: string;
  /** Id del mensaje en nuestra base. */
  messageId: string;
  /** wa_id del cliente: a ese número se contesta. */
  waId: string;
  /** false = no es texto (audio, imagen, documento…): Orbi no lo lee. */
  esTexto: boolean;
  /** Lo que dijo (o el título de la opción que tocó). */
  texto?: string;
  /** Si tocó una opción de un menú (lista o botón): su id. */
  opcionId?: string;
}

export type BotModo = 'SELECCIONADOS' | 'TODOS';
export type BotChatEstado = 'DEFAULT' | 'ON' | 'OFF' | 'PAUSADO' | 'DERIVADO';

/**
 * ¿Orbi contesta en este chat? Con el interruptor general apagado, nunca. ON y OFF son decisión del dueño para ese
 * chat; DEFAULT sigue el modo general (solo atiende en TODOS). PAUSADO (entró una persona) y DERIVADO (Orbi pidió que lo
 * atienda una persona) callan a Orbi hasta que el dueño lo reactive a mano.
 */
export function orbiAtiendeElChat(config: { enabled: boolean; modo: BotModo } | null, estado: BotChatEstado): boolean {
  if (!config?.enabled) return false;
  if (estado === 'ON') return true;
  if (estado === 'DEFAULT') return config.modo === 'TODOS';
  return false;
}

export const MOTIVO_PAUSA_HUMANA = 'Respondiste vos, así que Orbi dejó de contestar en este chat.';

type PrismaDelBot = Pick<PrismaService, 'whatsappBotConfig' | 'conversation'>;

/**
 * Entró una persona al chat (escribió desde el panel o desde la app del celular): si Orbi lo estaba atendiendo, se
 * calla. No se reactiva solo, para que no se pisen las respuestas. Devuelve true si lo pausó.
 */
export async function pausarSiAtendiaOrbi(prisma: PrismaDelBot, businessId: string, conversationId: string): Promise<boolean> {
  const config = await prisma.whatsappBotConfig.findUnique({ where: { businessId }, select: { enabled: true, modo: true } });
  if (!config?.enabled) return false;
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, businessId }, select: { botEstado: true } });
  if (!conv || !orbiAtiendeElChat(config, conv.botEstado)) return false;
  const r = await prisma.conversation.updateMany({
    where: { id: conversationId, businessId, botEstado: { in: ['DEFAULT', 'ON'] } },
    data: { botEstado: 'PAUSADO', botMotivo: MOTIVO_PAUSA_HUMANA, botCambiadoAt: new Date() },
  });
  return r.count > 0;
}
