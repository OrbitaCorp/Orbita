import { Module } from '@nestjs/common';
import { InternalCronController } from './internal-cron.controller';
import { InternalCronSecretGuard } from './internal-cron-secret.guard';
import { CronRunsService } from './cron-runs.service';
import { RetencionLogsService } from './retencion-logs.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WizardAnalyticsModule } from '../wizard-analytics/wizard-analytics.module';
import { DomainsModule } from '../domains/domains.module';
import { MemberProfileModule } from '../member-profile/member-profile.module';

@Module({
  imports: [SubscriptionsModule, NotificationsModule, WizardAnalyticsModule, DomainsModule, MemberProfileModule],
  controllers: [InternalCronController],
  providers: [InternalCronSecretGuard, CronRunsService, RetencionLogsService],
})
export class InternalCronModule {}
