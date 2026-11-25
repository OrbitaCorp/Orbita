import { Module } from '@nestjs/common';
import { VideosModule } from '../videos/videos.module';
import { McpController, McpConsentimientoController, McpDescubrimientoController, McpOauthController } from './mcp/mcp.controller';
import { McpOauthService } from './mcp/mcp-oauth.service';
import { ProspeccionService } from './prospeccion.service';

// Conector MCP para Videos/Tutoriales con Claude (la vista Prospección del panel fue reemplazada por Marketing → Leads).
@Module({
  imports: [VideosModule],
  controllers: [McpController, McpOauthController, McpDescubrimientoController, McpConsentimientoController],
  providers: [ProspeccionService, McpOauthService],
  exports: [ProspeccionService],
})
export class ProspeccionModule {}
