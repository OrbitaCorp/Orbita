import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

export type NotificationChannels = { panel: boolean; email: boolean; whatsapp: boolean };

export type DispatchPayload = {
  title: string;
  body: string;
  level?: NotificationLevel;
  resourceType?: string;
  resourceId?: string;
  // Si el canal email está habilitado y no se pasa emailSubject/emailBody,
  // se reusa title/body como asunto y cuerpo del mail.
  emailSubject?: string;
  emailBody?: string;
};

// (RBT-645) El motor de notificaciones. `dispatch()` es el único punto de
// entrada para generar un aviso — lee las preferencias del negocio para el
// evento y despacha por cada canal habilitado (panel/email/whatsapp). Si el
// negocio no configuró el evento, no hace nada: silencio, no un default.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ── Motor de despacho — único punto de entrada ────────────────────────────
  async dispatch(event: string, businessId: string, payload: DispatchPayload): Promise<void> {
    const config = await this.prisma.notificationConfig.findUnique({ where: { businessId } });
    const matrix = (config?.matrix ?? {}) as Record<string, NotificationChannels>;
    const prefs = matrix[event];
    if (!prefs) return;

    const level = payload.level ?? NotificationLevel.INFO;

    if (prefs.panel) {
      await this.prisma.notification.create({
        data: {
          businessId,
          event,
          title: payload.title,
          body: payload.body,
          level,
          resourceType: payload.resourceType ?? null,
          resourceId: payload.resourceId ?? null,
        },
      });
    }

    if (prefs.email) {
      await this.sendEmailToMembers(businessId, payload.emailSubject ?? payload.title, payload.emailBody ?? payload.body);
    }

    if (prefs.whatsapp) {
      this.logger.log(`[WhatsApp stub] evento="${event}" negocio=${businessId}: ${payload.title}`);
    }
  }

  // El email de notificación va a todos los members activos del negocio — no
  // hay preferencia por miembro individual en esta fase (ver spec, §2.2).
  private async sendEmailToMembers(businessId: string, subject: string, htmlBody: string): Promise<void> {
    const members = await this.prisma.member.findMany({
      where: { businessId, status: 'ACTIVE' },
      select: { email: true },
    });
    for (const m of members) {
      try {
        await this.mail.sendCustomEmail(m.email, subject, `<p>${htmlBody}</p>`, { businessId });
      } catch (e) {
        // Un email caído no puede voltear el despacho — mismo criterio que
        // el resto de MailService (best-effort, nunca rompe el flujo llamador).
        this.logger.warn(`No se pudo mandar la notificación por email a ${m.email}: ${e}`);
      }
    }
  }

  // ── Lectura (campana del panel) ───────────────────────────────────────────

  async findAll(businessId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { businessId, ...(query.unreadOnly === 'true' ? { isRead: false } : {}) };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async unreadCount(businessId: string) {
    const count = await this.prisma.notification.count({ where: { businessId, isRead: false } });
    return { count };
  }

  async markRead(businessId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, businessId } });
    if (!n) throw new NotFoundException('Notificación no encontrada');
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  }

  async markAllRead(businessId: string) {
    await this.prisma.notification.updateMany({ where: { businessId, isRead: false }, data: { isRead: true } });
    return { ok: true };
  }
}
