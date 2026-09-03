import { Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { InternalCronSecretGuard } from './internal-cron-secret.guard';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';

/**
 * Reemplazo de los @Cron() que tenía el backend antes de migrar a Cloud Run.
 *
 * En Railway (una VM siempre prendida) un @Cron in-process funcionaba bien.
 * En Cloud Run, con el servicio escalando a 0 entre requests para no pagar
 * una instancia siempre activa (ver DEPLOYMENT.md § Cron jobs y costos), un
 * cron in-process deja de ser confiable — si no hay tráfico a las 3am, no
 * hay instancia viva para dispararlo.
 *
 * La solución: estos endpoints hacen lo mismo que hacían los @Cron de
 * antes, pero deben ser DISPARADOS por algo externo — Cloud Scheduler le
 * pega a cada uno vía HTTP a los horarios correspondientes. Cloud Run
 * "despierta" el servicio para atender esa request como cualquier otra,
 * corre el trabajo, y puede volver a apagarse.
 *
 * Van juntos en SOLO 3 endpoints (no 4) a propósito: Cloud Scheduler tiene
 * 3 jobs gratis por cuenta/mes, el 4to en adelante cuesta US$0.10/mes cada
 * uno. Para quedar en US$0 extra, "reconcileOverdueSubscriptions" (antes
 * 3am) y "cleanupExpiredPendingSignups" (antes 4am) se agruparon en un
 * único disparo de madrugada — no hay ninguna razón de negocio para que
 * corran en horarios distintos, solo coincidencia de cuándo se escribieron.
 *
 * No requieren el JWT normal (@Public()) porque Cloud Scheduler no tiene una
 * sesión de member/customer — en cambio se protegen con un secret
 * compartido (ver InternalCronSecretGuard).
 */
@Controller('internal-cron')
@Public()
@UseGuards(InternalCronSecretGuard)
export class InternalCronController {
  private readonly logger = new Logger(InternalCronController.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
    private readonly wizardAnalytics: WizardAnalyticsService,
  ) {}

  // Antes: @Cron(EVERY_DAY_AT_3AM) + @Cron(EVERY_DAY_AT_4AM), por separado.
  // Cloud Scheduler: 1 solo job, todos los días a las 3am.
  @Post('nightly-subscriptions-maintenance')
  async nightlySubscriptionsMaintenance() {
    this.logger.log('Disparado por Cloud Scheduler: mantenimiento nocturno de suscripciones');
    await this.subscriptions.reconcileOverdueSubscriptions();
    await this.subscriptions.cleanupExpiredPendingSignups();
    // Colgado de este mismo disparo, no de un job nuevo: Cloud Scheduler da 3
    // jobs gratis y ya están los 3 usados (ver comentario de arriba). Etiquetar
    // de qué habla la gente con Orbi no tiene urgencia horaria — nadie lo mira
    // hasta que abre el tablero del super panel.
    await this.wizardAnalytics.classifyPendingTurns();
    return { ok: true };
  }

  // Antes: @Cron('0 22 * * *')
  @Post('resumen-diario')
  async resumenDiario() {
    this.logger.log('Disparado por Cloud Scheduler: resumenDiario');
    await this.notifications.resumenDiario();
    return { ok: true };
  }

  // Antes: @Cron('0 9 * * 1')
  @Post('reporte-semanal')
  async reporteSemanal() {
    this.logger.log('Disparado por Cloud Scheduler: reporteSemanal');
    await this.notifications.reporteSemanal();
    return { ok: true };
  }
}
