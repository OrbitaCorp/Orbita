import { Module } from '@nestjs/common';
import { InternalCronController } from './internal-cron.controller';
import { InternalCronSecretGuard } from './internal-cron-secret.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WizardAnalyticsModule } from '../wizard-analytics/wizard-analytics.module';

@Module({
  imports: [SubscriptionsModule, NotificationsModule, WizardAnalyticsModule],
  controllers: [InternalCronController],
  providers: [InternalCronSecretGuard],
})
export class InternalCronModule {}
