import { Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { InternalCronSecretGuard } from './internal-cron-secret.guard';
import { CronRunsService } from './cron-runs.service';
import { RetencionLogsService } from './retencion-logs.service';
import { describeError } from '../common/utils/describe-error.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WizardAnalyticsService } from '../wizard-analytics/wizard-analytics.service';
import { DomainExpiryService } from '../domains/domain-expiry.service';

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
 *
 * Los tres pasan por CronRunsService: Cloud Scheduler REINTENTA cuando una
 * corrida falla o tarda de más, y sin una marca persistente el reintento
 * repetía el trabajo entero — el resumen diario le mandaba el mail dos veces
 * a cada negocio. Ahora cada ventana (el día, la semana) se procesa una sola
 * vez, y dos disparos simultáneos no se pisan (auditoría interna 09/09).
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
    private readonly corridas: CronRunsService,
    // Último y opcional, como AuditService en los demás servicios: los specs
    // anteriores a la retención construyen el controller con cuatro argumentos.
    // En la app real Nest lo inyecta siempre (está en providers del módulo).
    private readonly retencionLogs?: RetencionLogsService,
    // Vencimiento de dominios comprados (hallazgo `dominios-comprados-sin-
    // renovacion`): aviso a cada owner a los 30 y a los 7 días. Opcional por
    // el mismo motivo que retencionLogs (specs viejos con menos argumentos).
    private readonly domainExpiry?: DomainExpiryService,
  ) {}

  // Antes: @Cron(EVERY_DAY_AT_3AM) + @Cron(EVERY_DAY_AT_4AM), por separado.
  // Cloud Scheduler: 1 solo job, todos los días a las 3am.
  @Post('nightly-subscriptions-maintenance')
  async nightlySubscriptionsMaintenance() {
    this.logger.log('Disparado por Cloud Scheduler: mantenimiento nocturno de suscripciones');
    return this.corridas.correrUnaVez(
      'nightly-subscriptions-maintenance',
      CronRunsService.claveDelDia(),
      async () => {
        await this.subscriptions.reconcileOverdueSubscriptions();
        await this.subscriptions.processLifecycleNotices();
        await this.subscriptions.processCancellationWindow();
        await this.subscriptions.cleanupExpiredPendingSignups();
        // Colgado de este mismo disparo, no de un job nuevo: Cloud Scheduler da 3
        // jobs gratis y ya están los 3 usados (ver comentario de arriba). Etiquetar
        // de qué habla la gente con Orbi no tiene urgencia horaria — nadie lo mira
        // hasta que abre el tablero del super panel.
        await this.wizardAnalytics.classifyPendingTurns();
        // Retención de la analítica del wizard (auditoría interna 10/09, ítem
        // api.wizard-analytics). Mismo disparo por el mismo motivo.
        await this.wizardAnalytics.purgarAntiguos();
        // Retención de platform_admin_logs, audit_logs y email_logs (auditoría
        // interna, hallazgo logs-sin-retencion). Va última y con su propio
        // try/catch: es limpieza, no negocio. Si falla, se anota y mañana lo
        // vuelve a intentar — no tiene que marcar la corrida entera como
        // fallida ni hacer que Cloud Scheduler reintente lo que ya se hizo.
        try {
          await this.retencionLogs?.purgar();
        } catch (e) {
          this.logger.error(`Retención de logs: no se pudo correr — ${describeError(e)}`);
        }
        // Dominios comprados por vencer (hallazgo `dominios-comprados-sin-
        // renovacion`): mismo disparo y mismo criterio que la retención. Si el
        // barrido entero tira, se anota sin marcar la corrida como fallida; un
        // aviso que no salió se reintenta la noche siguiente porque solo cuenta
        // como avisado un envío SENT (ver DomainExpiryService).
        try {
          await this.domainExpiry?.avisarVencimientos();
        } catch (e) {
          this.logger.error(`Vencimiento de dominios: no se pudo correr — ${describeError(e)}`);
        }
      },
    );
  }

  // Antes: @Cron('0 22 * * *')
  @Post('resumen-diario')
  async resumenDiario() {
    this.logger.log('Disparado por Cloud Scheduler: resumenDiario');
    return this.corridas.correrUnaVez('resumen-diario', CronRunsService.claveDelDia(), () =>
      this.notifications.resumenDiario(),
    );
  }

  // Antes: @Cron('0 9 * * 1')
  @Post('reporte-semanal')
  async reporteSemanal() {
    this.logger.log('Disparado por Cloud Scheduler: reporteSemanal');
    return this.corridas.correrUnaVez('reporte-semanal', CronRunsService.claveDeLaSemana(), () =>
      this.notifications.reporteSemanal(),
    );
  }
}
