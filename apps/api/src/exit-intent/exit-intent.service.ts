import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { normalizarLinkDeTienda } from '../common/utils/storefront-link.util';
import { UpsertExitIntentDto } from './dto/upsert-exit-intent.dto';

// "Exit-intent" (paquete Avanzado) — el aviso que aparece cuando el visitante
// está por irse sin comprar. Hermano de PromoModalService: una fila por
// negocio, contenido libre y mismo mecanismo de campaña (campaignVersion) para
// el botón "Mostrar de nuevo".
//
// La detección del "está por irse" es toda del lado del navegador (ver
// ExitIntentModal.tsx en el front): acá solo se guarda QUÉ mostrar y BAJO QUÉ
// condiciones. El backend no sabe ni cuántas veces se mostró — no hay tracking
// por visitante, igual que en el resto de los módulos de Avanzado.
@Injectable()
export class ExitIntentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  // ── Panel ────────────────────────────────────────────────────────────────

  async getForBusiness(businessId: string) {
    const cfg = await this.prisma.exitIntentConfig.findUnique({ where: { businessId } });
    return cfg ? this.toResponse(cfg) : null;
  }

  async upsert(businessId: string, dto: UpsertExitIntentDto) {
    const ctaLink = normalizarLinkDeTienda(dto.ctaLink);
    if (ctaLink && !dto.ctaText?.trim()) {
      throw new BadRequestException('Si ponés un link, escribí también el texto del botón');
    }

    // Mismo criterio que PromoModalService#upsert: prender algo que estaba
    // apagado cuenta como campaña nueva, así le vuelve a aparecer a quien ya
    // lo había cerrado en la campaña anterior.
    const existente = await this.prisma.exitIntentConfig.findUnique({ where: { businessId } });
    const reactivando = dto.isActive && existente?.isActive === false;

    const datos = {
      title: dto.title.trim(),
      message: dto.message?.trim() || null,
      badge: dto.badge?.trim() || null,
      code: dto.code?.trim() || null,
      ctaText: dto.ctaText?.trim() || null,
      ctaLink,
      frequency: dto.frequency,
      minSeconds: dto.minSeconds,
      onMobile: dto.onMobile,
      isActive: dto.isActive,
    };

    const cfg = await this.prisma.exitIntentConfig.upsert({
      where: { businessId },
      create: { businessId, ...datos },
      update: { ...datos, ...(reactivando ? { campaignVersion: { increment: 1 } } : {}) },
    });
    return this.toResponse(cfg);
  }

  // Botón "Mostrar de nuevo" — mismo criterio que PromoModalService#relanzar:
  // toca SOLO campaignVersion.
  async relanzar(businessId: string) {
    const existente = await this.prisma.exitIntentConfig.findUnique({ where: { businessId } });
    if (!existente) throw new NotFoundException('Este negocio todavía no configuró el aviso de salida');
    const cfg = await this.prisma.exitIntentConfig.update({
      where: { businessId },
      data: { campaignVersion: { increment: 1 } },
    });
    return this.toResponse(cfg);
  }

  // ── Storefront (público) ─────────────────────────────────────────────────

  async getActiveExitIntent(businessId: string) {
    if (!(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) return null;
    const cfg = await this.prisma.exitIntentConfig.findUnique({ where: { businessId } });
    if (!cfg || !cfg.isActive) return null;
    return this.toResponse(cfg);
  }

  private toResponse(cfg: {
    id: string;
    title: string;
    message: string | null;
    badge: string | null;
    code: string | null;
    ctaText: string | null;
    ctaLink: string | null;
    frequency: string;
    minSeconds: number;
    onMobile: boolean;
    isActive: boolean;
    campaignVersion: number;
  }) {
    return {
      id: cfg.id,
      title: cfg.title,
      message: cfg.message,
      badge: cfg.badge,
      code: cfg.code,
      ctaText: cfg.ctaText,
      ctaLink: cfg.ctaLink,
      frequency: cfg.frequency,
      minSeconds: cfg.minSeconds,
      onMobile: cfg.onMobile,
      isActive: cfg.isActive,
      campaignVersion: cfg.campaignVersion,
    };
  }
}
