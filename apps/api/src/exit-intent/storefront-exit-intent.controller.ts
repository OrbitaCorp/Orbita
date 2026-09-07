import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { StorefrontService } from '../storefront/storefront.service';
import { ExitIntentService } from './exit-intent.service';

// Público (sin login) — mismo criterio que StorefrontPromoModalController: el
// gate de "tiene el add-on" y de "está prendido" ya está resuelto adentro de
// ExitIntentService.
@Controller('storefront/:slug/exit-intent')
export class StorefrontExitIntentController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly exitIntentService: ExitIntentService,
  ) {}

  @Get('active')
  @Public()
  async active(@Param('slug') slug: string) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    return this.exitIntentService.getActiveExitIntent(businessId);
  }
}
