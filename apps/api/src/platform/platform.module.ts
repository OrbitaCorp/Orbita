import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAuditController } from './audit/platform-audit.controller';
import { PlatformAuditService } from './audit/platform-audit.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WizardAnalyticsModule } from '../wizard-analytics/wizard-analytics.module';
import { PlatformAdminLogModule } from './platform-admin-log.module';

@Module({
  // PlatformAdminLogModule: registro en platform_admin_logs de los mails de
  // prueba (y, desde AuthModule, del login y el segundo factor).
  imports: [SubscriptionsModule, WizardAnalyticsModule, PlatformAdminLogModule],
  controllers: [PlatformController, PlatformAuditController],
  providers: [PlatformService, PlatformAuditService],
})
export class PlatformModule {}
