import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { StorefrontService } from '../storefront/storefront.service';
import { SocialProofService } from './social-proof.service';

// Público de verdad (@Public) — mismo criterio que
// StorefrontPromoModalController: el gate real de "el negocio tiene
// Avanzado" ya lo hizo el dueño al activar el toggle; acá solo se filtra
// por isActive y se devuelven los pedidos reales a mostrar.
@Controller('storefront/:slug/social-proof')
export class StorefrontSocialProofController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly socialProofService: SocialProofService,
  ) {}

  @Get('recent')
  @Public()
  async recent(@Param('slug') slug: string) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    const cfg = await this.socialProofService.getForBusiness(businessId);
    if (!cfg || !cfg.isActive) return null;
    const events = await this.socialProofService.getRecentEvents(businessId);
    return { position: cfg.position, events };
  }
}
