import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { WizardAnalyticsService } from './wizard-analytics.service';
import { IngestEventsDto, RateAiTurnDto } from './dto/ingest-events.dto';

// Ingesta pública: la gente del wizard no tiene cuenta todavía, así que no hay
// JWT que valga. Se protege por throttling + validación estricta del DTO +
// lista blanca de tipos de evento (events.ts). Lo peor que puede hacer alguien
// con esto es ensuciar sus propias estadísticas.
@Controller('wizard-analytics')
export class WizardAnalyticsController {
  private readonly logger = new Logger(WizardAnalyticsController.name);

  constructor(private readonly analytics: WizardAnalyticsService) {}

  // 40/min por IP: una sesión normal descarga la cola cada 5s (12/min) más los
  // envíos al cambiar de paso. Un NAT con varias personas entra cómodo.
  @Post('events')
  @Public()
  @HttpCode(204)
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async ingest(@Body() dto: IngestEventsDto): Promise<void> {
    try {
      await this.analytics.ingest(dto);
    } catch (error) {
      // Deliberadamente 204 igual: si la analítica falla, el usuario que está
      // dándose de alta no se tiene que enterar ni ver un error en la consola.
      this.logger.error(`Fallo la ingesta de eventos del wizard: ${error}`);
    }
  }

  @Post('ai-feedback')
  @Public()
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async rate(@Body() dto: RateAiTurnDto): Promise<void> {
    try {
      await this.analytics.rateAiTurn(dto.turnId, dto.rating);
    } catch (error) {
      this.logger.error(`Fallo el voto de una respuesta de Orbi: ${error}`);
    }
  }
}
