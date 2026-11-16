import type { PrismaService } from '../../prisma/prisma.service';

// Cuándo Orbi atiende un chat de clientes (WhatsApp o Instagram) y cómo se calla. Sin dependencias de Nest: lo usan el
// bot de cada canal, los webhooks (cuando el dueño escribe desde el celular) y las bandejas (cuando escribe desde el panel).

/** Los canales donde Orbi atiende a los clientes. */
export type CanalDeOrbi = 'WHATSAPP' | 'INSTAGRAM';
export const NOMBRE_DEL_CANAL: Record<CanalDeOrbi, string> = { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram' };

/** Un mensaje de cliente recién guardado: lo que el webhook de WhatsApp le pasa al bot. */
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

/** Lo mismo, para cualquier canal: `destinatario` es a quién se le contesta (el wa_id en WhatsApp, el IGSID en Instagram). */
export type MensajeDeCliente = Omit<MensajeEntrante, 'waId'> & { destinatario: string };

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

type PrismaDelBot = Pick<PrismaService, 'whatsappBotConfig' | 'conversation'> & Partial<Pick<PrismaService, 'instagramBotConfig'>>;

/** La configuración de Orbi del canal (enabled + modo), o null si el dueño nunca la tocó. */
export async function configDelCanal(prisma: PrismaDelBot, businessId: string, canal: CanalDeOrbi): Promise<{ enabled: boolean; modo: BotModo } | null> {
  const select = { enabled: true, modo: true } as const;
  if (canal === 'INSTAGRAM') return prisma.instagramBotConfig ? prisma.instagramBotConfig.findUnique({ where: { businessId }, select }) : null;
  return prisma.whatsappBotConfig.findUnique({ where: { businessId }, select });
}

/** ¿Orbi atiende hoy este chat en este canal? (Para callar lo automático que no es Orbi, como la bienvenida de Instagram.) */
export async function orbiAtiendeAhora(prisma: PrismaDelBot, businessId: string, conversationId: string, canal: CanalDeOrbi): Promise<boolean> {
  const config = await configDelCanal(prisma, businessId, canal);
  if (!config?.enabled) return false;
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, businessId }, select: { botEstado: true } });
  return !!conv && orbiAtiendeElChat(config, conv.botEstado);
}

/**
 * Entró una persona al chat (escribió desde el panel o desde la app del celular): si Orbi lo estaba atendiendo en ese
 * canal, se calla. No se reactiva solo, para que no se pisen las respuestas. Devuelve true si lo pausó.
 */
export async function pausarSiAtendiaOrbi(prisma: PrismaDelBot, businessId: string, conversationId: string, canal: CanalDeOrbi = 'WHATSAPP'): Promise<boolean> {
  if (!(await orbiAtiendeAhora(prisma, businessId, conversationId, canal))) return false;
  const r = await prisma.conversation.updateMany({
    where: { id: conversationId, businessId, botEstado: { in: ['DEFAULT', 'ON'] } },
    data: { botEstado: 'PAUSADO', botMotivo: MOTIVO_PAUSA_HUMANA, botCambiadoAt: new Date() },
  });
  return r.count > 0;
}
