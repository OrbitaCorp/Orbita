import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPromoModalDto } from './dto/upsert-promo-modal.dto';

// "Modales de anuncios" (paquete Avanzado) — hermana más simple de
// GamesService: un solo modal por negocio (no [businessId, type] como
// Game), sin mecánica ni sesión por visitante. Mismo mecanismo de
// "campaña" (campaignVersion) que Game — ver el comentario en schema.prisma.
@Injectable()
export class PromoModalService {
  constructor(private readonly prisma: PrismaService) {}

  async getForBusiness(businessId: string) {
    const modal = await this.prisma.promoModal.findUnique({ where: { businessId } });
    return modal ? this.toResponse(modal) : null;
  }

  async upsert(businessId: string, dto: UpsertPromoModalDto) {
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (!!startDate !== !!endDate) {
      throw new BadRequestException('Si cargás una fecha de vigencia, tenés que cargar las dos (desde y hasta)');
    }
    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException('La fecha "hasta" tiene que ser posterior a la fecha "desde"');
    }

    // Mismo criterio que GamesService#upsert: "campaña nueva" de cara al
    // visitante = pasar de inactivo a activo, O cargar una vigencia
    // distinta de la que tenía — hace falta leer el estado anterior antes
    // del upsert para saberlo.
    const existente = await this.prisma.promoModal.findUnique({ where: { businessId } });
    const reactivando = dto.isActive && existente?.isActive === false;
    const distinta = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) !== (b?.getTime() ?? null);
    const vigenciaNueva = !!existente && (distinta(startDate, existente.startDate) || distinta(endDate, existente.endDate));

    const modal = await this.prisma.promoModal.upsert({
      where: { businessId },
      create: {
        businessId,
        title: dto.title,
        message: dto.message ?? null,
        badge: dto.badge ?? null,
        code: dto.code ?? null,
        ctaText: dto.ctaText ?? null,
        ctaLink: dto.ctaLink ?? null,
        isActive: dto.isActive,
        startDate,
        endDate,
      },
      update: {
        title: dto.title,
        message: dto.message ?? null,
        badge: dto.badge ?? null,
        code: dto.code ?? null,
        ctaText: dto.ctaText ?? null,
        ctaLink: dto.ctaLink ?? null,
        isActive: dto.isActive,
        startDate,
        endDate,
        ...(reactivando || vigenciaNueva ? { campaignVersion: { increment: 1 } } : {}),
      },
    });
    return this.toResponse(modal);
  }

  // Botón dedicado "Relanzar" — mismo criterio que GamesService#relanzar:
  // incrementa SOLO campaignVersion, sin tocar ninguna otra config.
  async relanzar(businessId: string) {
    const existente = await this.prisma.promoModal.findUnique({ where: { businessId } });
    if (!existente) throw new NotFoundException('Este negocio todavía no configuró el modal de anuncios');
    const modal = await this.prisma.promoModal.update({
      where: { businessId },
      data: { campaignVersion: { increment: 1 } },
    });
    return this.toResponse(modal);
  }

  private toResponse(modal: {
    id: string;
    title: string;
    message: string | null;
    badge: string | null;
    code: string | null;
    ctaText: string | null;
    ctaLink: string | null;
    isActive: boolean;
    campaignVersion: number;
    startDate: Date | null;
    endDate: Date | null;
  }) {
    return {
      id: modal.id,
      title: modal.title,
      message: modal.message,
      badge: modal.badge,
      code: modal.code,
      ctaText: modal.ctaText,
      ctaLink: modal.ctaLink,
      isActive: modal.isActive,
      campaignVersion: modal.campaignVersion,
      startDate: modal.startDate ? modal.startDate.toISOString() : null,
      endDate: modal.endDate ? modal.endDate.toISOString() : null,
    };
  }
}
