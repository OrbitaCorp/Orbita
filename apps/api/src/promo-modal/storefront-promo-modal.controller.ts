import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { BusinessesService } from '../businesses/businesses.service';

// Público de verdad (@Public): no hay `req.user`, así que AddonGuard no puede
// correr acá y el paquete Avanzado se revalida a mano contra la base (mismo
// patrón que CountdownService#getActiveCountdown). Hasta la auditoría interna
// del 09/09 no se revalidaba: a un negocio al que se le vencía el add-on le
// seguía apareciendo el modal en la tienda, porque la fila queda tal cual.
@Controller('storefront/:slug/promo-modal')
export class StorefrontPromoModalController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get('active')
  @Public()
  async active(@Param('slug') slug: string) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
    if (!(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) return null;
    const modal = await this.prisma.promoModal.findUnique({ where: { businessId } });
    if (!modal || !modal.isActive || !this.dentroDeVigencia(modal)) return null;
    return {
      title: modal.title,
      message: modal.message,
      badge: modal.badge,
      code: modal.code,
      ctaText: modal.ctaText,
      ctaLink: modal.ctaLink,
      campaignVersion: modal.campaignVersion,
    };
  }

  // Mismo helper que GamesPlayService#dentroDeVigencia — sin startDate/
  // endDate, sin límite de fechas (solo isActive importa).
  private dentroDeVigencia(modal: { startDate: Date | null; endDate: Date | null }): boolean {
    if (!modal.startDate || !modal.endDate) return true;
    const ahora = new Date();
    return ahora >= modal.startDate && ahora <= modal.endDate;
  }
}
