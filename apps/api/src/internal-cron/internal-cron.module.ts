import { Module } from '@nestjs/common';
import { InternalCronController } from './internal-cron.controller';
import { InternalCronSecretGuard } from './internal-cron-secret.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SubscriptionsModule, NotificationsModule],
  controllers: [InternalCronController],
  providers: [InternalCronSecretGuard],
})
export class InternalCronModule {}
