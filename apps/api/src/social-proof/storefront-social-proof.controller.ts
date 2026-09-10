import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { BusinessesService } from '../businesses/businesses.service';
import { SocialProofService } from './social-proof.service';

// Público de verdad (@Public): no hay `req.user`, así que AddonGuard no
// puede correr acá y el paquete Avanzado se revalida a mano contra la base
// (mismo patrón que CountdownService#getActiveCountdown). Hasta la auditoría
// interna del 09/09 no se revalidaba: a un negocio al que se le vencía el
// add-on le seguían apareciendo los avisos en la tienda, porque la fila de
// configuración queda tal cual.
@Controller('storefront/:slug/social-proof')
export class StorefrontSocialProofController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly socialProofService: SocialProofService,
    private readonly businesses: BusinessesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('recent')
  @Public()
  async recent(@Param('slug') slug: string) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    // Tienda pausada o sin publicar: sin avisos, igual que sin catálogo
    // (auditoría interna 10/09, ítem api.social-proof).
    const tienda = await this.prisma.business.findUnique({ where: { id: businessId }, select: { isActive: true, isPaused: true } });
    if (!tienda?.isActive || tienda.isPaused) return null;
    if (!(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) return null;
    const cfg = await this.socialProofService.getForBusiness(businessId);
    if (!cfg || !cfg.isActive) return null;
    const events = await this.socialProofService.getRecentEvents(businessId);
    return { position: cfg.position, events };
  }
}
