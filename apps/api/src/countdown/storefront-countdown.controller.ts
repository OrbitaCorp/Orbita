import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { StorefrontService } from '../storefront/storefront.service';
import { CountdownService } from './countdown.service';

// Público (sin login) — mismo criterio que StorefrontPromoModalController y
// StorefrontSocialProofController: el gate de "tiene el add-on" y de "quiere
// mostrar esto" ya está resuelto adentro de CountdownService.
@Controller('storefront/:slug/countdown')
export class StorefrontCountdownController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly countdownService: CountdownService,
  ) {}

  @Get('active')
  @Public()
  async active(@Param('slug') slug: string) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    return this.countdownService.getActiveCountdown(businessId);
  }
}
