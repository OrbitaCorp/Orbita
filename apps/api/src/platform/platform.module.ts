import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAuditController } from './audit/platform-audit.controller';
import { PlatformAuditService } from './audit/platform-audit.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WizardAnalyticsModule } from '../wizard-analytics/wizard-analytics.module';

@Module({
  imports: [SubscriptionsModule, WizardAnalyticsModule],
  controllers: [PlatformController, PlatformAuditController],
  providers: [PlatformService, PlatformAuditService],
})
export class PlatformModule {}
