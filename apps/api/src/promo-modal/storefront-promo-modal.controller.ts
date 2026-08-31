import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';

// Público de verdad (@Public) — mismo criterio que
// StorefrontGamesController#active: el gate real de "el negocio tiene
// Avanzado" ya lo hizo el dueño al activar/configurar el modal (isActive);
// acá solo se filtra por vigencia y se devuelve el contenido a mostrar.
@Controller('storefront/:slug/promo-modal')
export class StorefrontPromoModalController {
  constructor(
    private readonly storefrontService: StorefrontService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('active')
  @Public()
  async active(@Param('slug') slug: string) {
    const businessId = await this.storefrontService.resolveBusinessId(slug);
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
