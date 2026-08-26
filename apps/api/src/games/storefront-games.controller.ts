import { Body, Controller, ForbiddenException, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { StorefrontService } from '../storefront/storefront.service';
import { GamesPlayService } from './games-play.service';
import { FinishGameSessionDto } from './dto/finish-game-session.dto';
import { ClaimGameSessionDto } from './dto/claim-game-session.dto';

// Endpoints públicos del storefront (visitante anónimo o cliente logueado)
// — a diferencia de GamesController (panel, gateado por AddonGuard), acá NO
// hay @RequiresAddon: el gate de "el negocio tiene Avanzado" ya lo hizo el
// dueño al activar/configurar el juego (isActive en Game); un juego inactivo
// simplemente no arranca sesión (ver GamesPlayService#startSession).
//
// @OptionalAuth() (no @Public()) en los tres — jugar sin cuenta es un flujo
// válido (mismo criterio que checkout en storefront.controller.ts), pero si
// YA hay sesión de cliente, se aprovecha para reclamar el premio de una vez
// sin pasar por Google.
@Controller('storefront/:slug/games')
export class StorefrontGamesController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly gamesPlayService: GamesPlayService,
  ) {}

  @Post(':type/start')
  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async start(@Param('slug') slug: string, @Param('type') type: string, @CurrentUser() ctx?: AuthContext) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    const customerId = this.customerIdOrNull(ctx, businessId);
    return this.gamesPlayService.startSession(businessId, type, customerId);
  }

  @Post('finish')
  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async finish(@Param('slug') slug: string, @Body() dto: FinishGameSessionDto, @CurrentUser() ctx?: AuthContext) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    const customerId = this.customerIdOrNull(ctx, businessId);
    return this.gamesPlayService.finishSession(businessId, dto.sessionId, dto.hits, customerId);
  }

  // Este SÍ requiere estar logueado — se llama recién después de volver del
  // login con Google (ver returnTo en googleLoginUrl()). Un anónimo acá no
  // tiene nada que reclamar todavía.
  @Post('claim')
  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async claim(@Param('slug') slug: string, @Body() dto: ClaimGameSessionDto, @CurrentUser() ctx?: AuthContext) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    if (!ctx) throw new ForbiddenException('Iniciá sesión para reclamar tu premio');
    const asserted = assertCustomerContext(ctx);
    if (asserted.businessId !== businessId) throw new ForbiddenException('Negocio no encontrado');
    return this.gamesPlayService.claimSession(businessId, dto.sessionId, asserted.customerId);
  }

  // Mismo criterio de aislamiento multi-tenant que checkout() en
  // storefront.controller.ts: un token de otra tienda no puede colarse acá
  // con la URL de esta. Devuelve null (no tira) para start/finish, donde
  // jugar sin cuenta es válido — claim() sí exige la sesión, ver arriba.
  private customerIdOrNull(ctx: AuthContext | undefined, businessId: string): string | null {
    if (!ctx || ctx.type !== 'customer' || ctx.businessId !== businessId) return null;
    return ctx.customerId;
  }
}
