import { Module } from '@nestjs/common';
import { llmAdapterProvider } from '../llm/llm-adapter.provider';
import { OrbiSaludService } from './orbi-salud.service';

/**
 * Salud y mantenimiento de Orbi. Módulo aparte para que lo usen el controller
 * del chat (OrbiModule) y el panel de plataforma (PlatformModule) sin que uno
 * importe al otro. PrismaModule, MailModule y la config son globales.
 */
@Module({
  providers: [OrbiSaludService, llmAdapterProvider],
  exports: [OrbiSaludService],
})
export class OrbiSaludModule {}
