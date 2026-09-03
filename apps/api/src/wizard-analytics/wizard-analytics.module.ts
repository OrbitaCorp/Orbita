import { Module } from '@nestjs/common';
import { WizardAnalyticsController } from './wizard-analytics.controller';
import { WizardAnalyticsService } from './wizard-analytics.service';
import { LLM_ADAPTER } from '../orbi/llm/llm-adapter.interface';
import { GroqAdapter } from '../orbi/llm/groq.adapter';

// Provee su propio adaptador de LLM (para el clasificador de temas) en vez de
// importar OrbiModule: OrbiModule ya depende de ESTE módulo para registrar los
// turnos del wizard, y importarse mutuamente sería una dependencia circular.
@Module({
  controllers: [WizardAnalyticsController],
  providers: [WizardAnalyticsService, { provide: LLM_ADAPTER, useClass: GroqAdapter }],
  exports: [WizardAnalyticsService],
})
export class WizardAnalyticsModule {}
