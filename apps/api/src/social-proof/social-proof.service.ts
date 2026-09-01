import { Injectable } from '@nestjs/common';
import { SocialProofPosition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSocialProofDto } from './dto/upsert-social-proof.dto';

// "Prueba social" (paquete Avanzado) — la mitad construida de la tarjeta
// "Countdown y prueba social" de Avanzado.tsx (countdown/exit-intent quedan
// pendientes). A propósito NO tiene texto libre como PromoModal: el
// contenido de cada notificación sale siempre de un pedido real
// (getRecentEvents) — nunca se inventa una venta. Si la tienda no tiene
// pedidos recientes, el storefront simplemente no muestra nada; no hay un
// modo "de respaldo" con mensajes falsos.
const VENTANA_DIAS = 7;
const MAX_EVENTOS = 12;

// Mismos estados que ReturnsService/CancellationsService usan para "esto ya
// es una venta de verdad" — no PENDING (todavía puede caerse sin pagar) ni
// CANCELLED.
const ESTADOS_VALIDOS = ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const;

export type SocialProofEvent = {
  id: string;
  firstName: string;
  lastInitial: string;
  productName: string;
  occurredAt: string;
};

@Injectable()
export class SocialProofService {
  constructor(private readonly prisma: PrismaService) {}

  async getForBusiness(businessId: string) {
    const cfg = await this.prisma.socialProofConfig.findUnique({ where: { businessId } });
    return cfg ? this.toResponse(cfg) : null;
  }

  async upsert(businessId: string, dto: UpsertSocialProofDto) {
    const cfg = await this.prisma.socialProofConfig.upsert({
      where: { businessId },
      create: { businessId, isActive: dto.isActive, position: dto.position },
      update: { isActive: dto.isActive, position: dto.position },
    });
    return this.toResponse(cfg);
  }

  // Compartido por el preview del panel (SIEMPRE, sirve para decidir si vale
  // la pena prender el toggle) y el endpoint público del storefront (solo si
  // isActive) — mismos pedidos reales en los dos casos, ver comentario de
  // arriba del archivo.
  async getRecentEvents(businessId: string): Promise<SocialProofEvent[]> {
    const desde = new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000);
    const pedidos = await this.prisma.order.findMany({
      where: {
        businessId,
        origin: 'STOREFRONT',
        status: { in: [...ESTADOS_VALIDOS] },
        createdAt: { gte: desde },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EVENTOS,
      select: {
        id: true,
        createdAt: true,
        onlineOrderDetails: { select: { buyerName: true } },
        items: { take: 1, select: { productName: true } },
      },
    });

    return pedidos
      .filter((p) => p.onlineOrderDetails && p.items[0])
      .map((p) => {
        const { firstName, lastInitial } = this.partirNombre(p.onlineOrderDetails!.buyerName);
        return {
          id: p.id,
          firstName,
          lastInitial,
          productName: p.items[0].productName,
          occurredAt: p.createdAt.toISOString(),
        };
      });
  }

  // "María Fernanda Gómez" → { firstName: "María", lastInitial: "G" } — solo
  // nombre + inicial del apellido, nunca el nombre completo ni ningún otro
  // dato del comprador, ya que esto lo ve cualquier visitante de la tienda.
  private partirNombre(nombreCompleto: string): { firstName: string; lastInitial: string } {
    const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
    const firstName = partes[0] ?? 'Alguien';
    const lastInitial = partes.length > 1 ? partes[partes.length - 1][0]!.toUpperCase() : '';
    return { firstName, lastInitial };
  }

  private toResponse(cfg: { id: string; isActive: boolean; position: SocialProofPosition }) {
    return { id: cfg.id, isActive: cfg.isActive, position: cfg.position };
  }
}
