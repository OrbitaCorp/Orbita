import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WizardAnalyticsModule } from '../wizard-analytics/wizard-analytics.module';

@Module({
  imports: [SubscriptionsModule, WizardAnalyticsModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
