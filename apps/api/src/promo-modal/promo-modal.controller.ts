import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { PromoModalService } from './promo-modal.service';
import { UpsertPromoModalDto } from './dto/upsert-promo-modal.dto';

// Paquete "Avanzado" — gateado por AddonGuard en los tres endpoints, mismo
// patrón que GamesController. Estos son del PANEL (dueño configurando); el
// consumo desde el storefront va por StorefrontPromoModalController, público.
@Controller('promo-modal')
export class PromoModalController {
  constructor(private readonly promoModalService: PromoModalService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  getPromoModal(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.promoModalService.getForBusiness(member.businessId);
  }

  @Put()
  @RequiresAddon('ADVANCED')
  upsertPromoModal(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertPromoModalDto) {
    const member = assertMemberContext(ctx);
    return this.promoModalService.upsert(member.businessId, dto);
  }

  // Botón "mostrar de nuevo a quienes lo cerraron" — mismo criterio que
  // GamesController#relanzar.
  @Patch('relanzar')
  @RequiresAddon('ADVANCED')
  relanzar(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.promoModalService.relanzar(member.businessId);
  }
}
