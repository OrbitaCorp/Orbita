import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { CountdownService } from './countdown.service';

// Público (sin login) — mismo criterio que StorefrontPromoModalController y
// StorefrontSocialProofController: el gate de "tiene el add-on", el "está
// prendido" y el "ya venció" están todos resueltos adentro de CountdownService.
@Controller('storefront/:slug/countdown')
export class StorefrontCountdownController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly countdownService: CountdownService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('active')
  @Public()
  async active(@Param('slug') slug: string) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    // Tienda pausada o sin publicar: no hay reloj, igual que no hay catálogo
    // (auditoría interna 10/09, ítem api.countdown; ver
    // StorefrontService#resolveTiendaAbierta).
    const tienda = await this.prisma.business.findUnique({ where: { id: businessId }, select: { isActive: true, isPaused: true } });
    if (!tienda?.isActive || tienda.isPaused) return null;
    return this.countdownService.getActiveCountdown(businessId);
  }
}
