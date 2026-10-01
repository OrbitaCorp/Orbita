import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAuditController } from './audit/platform-audit.controller';
import { PlatformAuditService } from './audit/platform-audit.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WizardAnalyticsModule } from '../wizard-analytics/wizard-analytics.module';
import { PlatformAdminLogModule } from './platform-admin-log.module';
import { CostsModule } from './costs/costs.module';
import { OrbiSaludModule } from '../orbi/salud/orbi-salud.module';
import { OrbiSaludController } from './orbi-salud.controller';

@Module({
  // PlatformAdminLogModule: registro en platform_admin_logs de los mails de
  // prueba (y, desde AuthModule, del login y el segundo factor).
  imports: [SubscriptionsModule, WizardAnalyticsModule, PlatformAdminLogModule, CostsModule, OrbiSaludModule],
  controllers: [PlatformController, PlatformAuditController, OrbiSaludController],
  providers: [PlatformService, PlatformAuditService],
})
export class PlatformModule {}
