import { Module } from '@nestjs/common';
import { VideosModule } from '../videos/videos.module';
import { McpController, McpConsentimientoController, McpDescubrimientoController, McpOauthController } from './mcp/mcp.controller';
import { McpOauthService } from './mcp/mcp-oauth.service';
import { ProspeccionController } from './prospeccion.controller';
import { ProspeccionService } from './prospeccion.service';

// Marketing → Prospección (ver prospeccion.service.ts) y el conector MCP con el que cada superadmin analiza los lotes
// con su propio Claude (ver mcp/mcp-oauth.service.ts).
@Module({
  imports: [VideosModule],
  controllers: [ProspeccionController, McpController, McpOauthController, McpDescubrimientoController, McpConsentimientoController],
  providers: [ProspeccionService, McpOauthService],
  exports: [ProspeccionService],
})
export class ProspeccionModule {}
