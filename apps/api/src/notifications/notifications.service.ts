import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

// WhatsApp se sacó como canal (19/08): el despacho era un stub que solo
// logueaba, así que el aviso nunca llegaba. La clave se sigue tolerando en
// matrices guardadas de antes, pero no se despacha nada por ahí.
export type NotificationChannels = { panel: boolean; email: boolean; whatsapp?: boolean };

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
// evento y despacha por cada canal habilitado (panel/email).
//
// Eventos SIN preferencia guardada: van al panel por defecto (email no). El
// onboarding solo siembra 2 de los 9 eventos, así que "sin preferencia" es lo
// normal, no una decisión del dueño — y la pantalla de Configuración ya
// muestra esos eventos como "Panel: activado" (Notificaciones.tsx los completa
// con {panel: true, email: false}): el motor tiene que cumplir lo que esa
// pantalla promete, no descartarlos en silencio (pedido de Ale 24/08). Un
// `panel: false` GUARDADO sí silencia el evento.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Lo que vale para un evento que el dueño nunca guardó — idéntico al
  // default que muestra la pantalla de Configuración (Notificaciones.tsx).
  private static readonly PREFS_POR_DEFECTO: NotificationChannels = { panel: true, email: false };

  // ── Motor de despacho — único punto de entrada ────────────────────────────
  async dispatch(event: string, businessId: string, payload: DispatchPayload): Promise<void> {
    const config = await this.prisma.notificationConfig.findUnique({ where: { businessId } });
    const matrix = (config?.matrix ?? {}) as Record<string, NotificationChannels>;
    const prefs = matrix[event] ?? NotificationsService.PREFS_POR_DEFECTO;

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

  // ── Listeners de eventos de negocio ───────────────────────────────────────
  // Un @OnEvent por cada uno de los 8 eventos de NOTIFICATION_EVENTS
  // (businesses.service.ts). Los servicios de dominio emiten hacia estos
  // nombres exactos — ver hooks en orders/inventory/returns/mercadopago/customers.

  @OnEvent('notification.nuevo_pedido')
  async onNuevoPedido(p: { businessId: string; orderNumber: number; customerName: string; total: number; orderId: string }) {
    await this.dispatch('nuevo_pedido', p.businessId, {
      title: `Nuevo pedido #${p.orderNumber}`,
      body: `${p.customerName}: $${p.total.toFixed(2)}`,
      resourceType: 'order',
      resourceId: p.orderId,
    });
  }

  @OnEvent('notification.pedido_cancelado')
  async onPedidoCancelado(p: { businessId: string; orderNumber: number; orderId: string }) {
    await this.dispatch('pedido_cancelado', p.businessId, {
      title: `Pedido #${p.orderNumber} cancelado`,
      body: `El pedido #${p.orderNumber} fue cancelado.`,
      level: NotificationLevel.WARNING,
      resourceType: 'order',
      resourceId: p.orderId,
    });
  }

  @OnEvent('notification.stock_critico')
  async onStockCritico(p: { businessId: string; productName: string; variantLabel: string | null; currentStock: number; variantId: string }) {
    const nombre = p.variantLabel ? `${p.productName} · ${p.variantLabel}` : p.productName;
    await this.dispatch('stock_critico', p.businessId, {
      title: `Stock crítico: ${nombre}`,
      body: `Quedan ${p.currentStock} unidades.`,
      level: NotificationLevel.DANGER,
      resourceType: 'variant',
      resourceId: p.variantId,
    });
  }

  @OnEvent('notification.devolucion')
  async onDevolucion(p: { businessId: string; orderNumber: number; returnId: string }) {
    await this.dispatch('devolucion', p.businessId, {
      title: `Nueva devolución: Pedido #${p.orderNumber}`,
      body: `Se inició una devolución sobre el pedido #${p.orderNumber}.`,
      level: NotificationLevel.WARNING,
      resourceType: 'return',
      resourceId: p.returnId,
    });
  }

  @OnEvent('notification.cancelacion_pedida')
  async onCancelacionPedida(p: { businessId: string; orderNumber: number; cancellationRequestId: string }) {
    await this.dispatch('cancelacion_pedida', p.businessId, {
      title: `Piden cancelar el pedido #${p.orderNumber}`,
      body: `El cliente pidió cancelar el pedido #${p.orderNumber}, hace falta aceptarla o rechazarla.`,
      level: NotificationLevel.WARNING,
      resourceType: 'order',
      resourceId: p.cancellationRequestId,
    });
  }

  @OnEvent('notification.pago_confirmado')
  async onPagoConfirmado(p: { businessId: string; orderNumber: number; orderId: string; total: number }) {
    await this.dispatch('pago_confirmado', p.businessId, {
      title: `Pago confirmado: Pedido #${p.orderNumber}`,
      body: `Se acreditó el pago de $${p.total.toFixed(2)}.`,
      resourceType: 'order',
      resourceId: p.orderId,
    });
  }

  @OnEvent('notification.cliente_nuevo')
  async onClienteNuevo(p: { businessId: string; customerName: string; customerId: string }) {
    await this.dispatch('cliente_nuevo', p.businessId, {
      title: `Nuevo cliente: ${p.customerName}`,
      body: `${p.customerName} se registró en tu negocio.`,
      resourceType: 'customer',
      resourceId: p.customerId,
    });
  }

  // ── Resumen diario / reporte semanal ──────────────────────────────────────
  // Itera los negocios activos que tengan el evento habilitado en al menos un
  // canal y les despacha un resumen agregado. No depende de ReportsModule
  // (evita import circular) — agrega directo sobre Prisma.

  // Ya NO es @Cron: en Cloud Run, con el servicio escalando a 0 entre
  // requests, un cron in-process no es confiable — lo dispara Cloud
  // Scheduler vía HTTP. Ver internal-cron/internal-cron.controller.ts.
  async resumenDiario() {
    const negocios = await this.negociosConEventoHabilitado('resumen_diario');
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const ayer = new Date(desde);
    ayer.setDate(ayer.getDate() - 1);

    for (const businessId of negocios) {
      const [hoy, ayerAgg, clientesNuevos, stockCriticoCount] = await Promise.all([
        this.agregarVentas(businessId, desde, new Date()),
        this.agregarVentas(businessId, ayer, desde),
        this.prisma.customer.count({ where: { businessId, createdAt: { gte: desde }, deletedAt: null } }),
        this.contarStockCritico(businessId),
      ]);
      const cambio = ayerAgg.total > 0 ? Math.round(((hoy.total - ayerAgg.total) / ayerAgg.total) * 100) : null;
      const cambioTexto = cambio === null ? '' : ` (${cambio >= 0 ? '+' : ''}${cambio}% vs. ayer)`;

      await this.dispatch('resumen_diario', businessId, {
        title: `Resumen del día: ${desde.toLocaleDateString('es-AR')}`,
        body: `Ventas: $${hoy.total.toFixed(2)}${cambioTexto}. Pedidos: ${hoy.pedidos}. Clientes nuevos: ${clientesNuevos}. Stock crítico: ${stockCriticoCount} producto(s).`,
      });
    }
  }

  // Ya NO es @Cron — mismo motivo que resumenDiario() arriba.
  async reporteSemanal() {
    const negocios = await this.negociosConEventoHabilitado('reporte_semanal');
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - 7);
    const inicioSemanaAnterior = new Date(inicioSemana);
    inicioSemanaAnterior.setDate(inicioSemana.getDate() - 7);

    for (const businessId of negocios) {
      const [semana, semanaAnterior] = await Promise.all([
        this.agregarVentas(businessId, inicioSemana, hoy),
        this.agregarVentas(businessId, inicioSemanaAnterior, inicioSemana),
      ]);
      const cambio = semanaAnterior.total > 0
        ? Math.round(((semana.total - semanaAnterior.total) / semanaAnterior.total) * 100)
        : null;
      const cambioTexto = cambio === null ? '' : ` (${cambio >= 0 ? '+' : ''}${cambio}% vs. semana anterior)`;

      await this.dispatch('reporte_semanal', businessId, {
        title: `Reporte semanal`,
        body: `Ventas de la semana: $${semana.total.toFixed(2)}${cambioTexto}. Pedidos: ${semana.pedidos}.`,
      });
    }
  }

  private async negociosConEventoHabilitado(event: string): Promise<string[]> {
    const configs = await this.prisma.notificationConfig.findMany({
      where: { business: { isActive: true } },
      select: { businessId: true, matrix: true },
    });
    return configs
      .filter((c) => {
        // Sin preferencia guardada rige el default (panel sí) — mismo criterio
        // que dispatch(); si acá se filtrara por config explícita, el cron
        // nunca despacharía lo que dispatch() sí despacharía.
        const prefs =
          (c.matrix as Record<string, NotificationChannels>)[event] ?? NotificationsService.PREFS_POR_DEFECTO;
        return prefs.panel || prefs.email;
      })
      .map((c) => c.businessId);
  }

  private async agregarVentas(businessId: string, desde: Date, hasta: Date) {
    const agg = await this.prisma.order.aggregate({
      where: { businessId, createdAt: { gte: desde, lt: hasta }, deletedAt: null, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
    });
    return { total: Number(agg._sum.total ?? 0), pedidos: agg._count };
  }

  private async contarStockCritico(businessId: string): Promise<number> {
    const rows = await this.prisma.variantStock.findMany({
      where: { variant: { product: { businessId, deletedAt: null } } },
      select: { quantity: true, stockMin: true },
    });
    return rows.filter((r) => r.quantity <= r.stockMin).length;
  }
}
