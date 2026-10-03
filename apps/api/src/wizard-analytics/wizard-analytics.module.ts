import { Module } from '@nestjs/common';
import { WizardAnalyticsController } from './wizard-analytics.controller';
import { WizardAnalyticsService } from './wizard-analytics.service';
import { llmAdapterProvider } from '../orbi/llm/llm-adapter.provider';
import { CostsModule } from '../platform/costs/costs.module';

// Provee su propio adaptador de LLM (para el clasificador de temas) en vez de
// importar OrbiModule: OrbiModule ya depende de ESTE módulo para registrar los
// turnos del wizard, y importarse mutuamente sería una dependencia circular.
@Module({
  imports: [CostsModule],
  controllers: [WizardAnalyticsController],
  providers: [WizardAnalyticsService, llmAdapterProvider],
  exports: [WizardAnalyticsService],
})
export class WizardAnalyticsModule {}
