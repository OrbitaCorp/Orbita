import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OptionalAuth } from '../../../common/decorators/optional-auth.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { StorefrontService } from '../../../storefront/storefront.service';
import { AvanzadoContextoService } from '../comun/contexto.service';
import { CompradorPublicoDto } from '../comun/dtos-comunes';
import { BuyGiftCardDto } from '../gift-cards/dto/gift-cards.dto';
import { GiftCardsService } from '../gift-cards/gift-cards.service';
import { AcceptOfferDto, JoinWaitlistDto } from '../lista-espera/dto/lista-espera.dto';
import { ListaEsperaService } from '../lista-espera/lista-espera.service';
import { MembresiasService } from '../membresias/membresias.service';
import { PaquetesService } from '../paquetes/paquetes.service';

/** El cliente logueado, solo si es de ESTE negocio (un JWT de otro negocio se ignora: CONTRATO § 0 "Públicos"). */
const clienteDe = (ctx: AuthContext | undefined, businessId: string): string | null =>
  ctx?.type === 'customer' && ctx.businessId === businessId ? ctx.customerId : null;

// Lo público de Avanzado en el sitio de turnos (CONTRATO § P4.1, P4.2, P4.3 y
// P4.8). AddonGuard no corre acá (no hay req.user de panel): el add-on y el
// interruptor de cada función se revalidan en cada service
// (`AvanzadoContextoService.activa`). Sin add-on la función no existe: lista
// vacía o 404, nunca 403.
@Controller('storefront/:slug/appointments')
export class StorefrontAvanzadoController {
  constructor(
    private readonly storefront: StorefrontService,
    private readonly contexto: AvanzadoContextoService,
    private readonly paquetes: PaquetesService,
    private readonly membresias: MembresiasService,
    private readonly giftCards: GiftCardsService,
    private readonly espera: ListaEsperaService,
  ) {}

  /** Slug → negocio de turnos con el sitio abierto (404 si es una tienda, está pausado o no existe). */
  private async negocio(slug: string): Promise<string> {
    const businessId = await this.storefront.resolveBusinessId(slug);
    await this.contexto.delSitioAbierto(businessId);
    return businessId;
  }

  @Get('packages')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async paquetesPublicos(@Param('slug') slug: string) {
    return this.paquetes.listarPublicos(await this.negocio(slug));
  }

  @Post('packages/:id/buy')
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async comprarPaquete(@Param('slug') slug: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompradorPublicoDto, @CurrentUser() ctx: AuthContext | undefined) {
    const businessId = await this.negocio(slug);
    return this.paquetes.comprarPublico(businessId, id, dto, clienteDe(ctx, businessId));
  }

  @Get('membership-plans')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async planesPublicos(@Param('slug') slug: string) {
    return this.membresias.listarPlanesPublicos(await this.negocio(slug));
  }

  @Post('gift-cards')
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async comprarGiftCard(@Param('slug') slug: string, @Body() dto: BuyGiftCardDto, @CurrentUser() ctx: AuthContext | undefined) {
    const businessId = await this.negocio(slug);
    return this.giftCards.comprarPublico(businessId, dto, clienteDe(ctx, businessId));
  }

  // 10/min: el código es la plata; el throttle frena que se recorran códigos.
  @Get('gift-cards/:code')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async consultarGiftCard(@Param('slug') slug: string, @Param('code') code: string) {
    return this.giftCards.consultarPublico(await this.negocio(slug), code.slice(0, 32));
  }

  @Post('waitlist')
  @OptionalAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async anotarseEnEspera(@Param('slug') slug: string, @Body() dto: JoinWaitlistDto, @CurrentUser() ctx: AuthContext | undefined) {
    const businessId = await this.negocio(slug);
    return this.espera.anotarse(businessId, dto, clienteDe(ctx, businessId));
  }

  @Post('waitlist/accept')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async aceptarOferta(@Param('slug') slug: string, @Body() dto: AcceptOfferDto) {
    return this.espera.aceptar(await this.negocio(slug), dto.offer);
  }
}
