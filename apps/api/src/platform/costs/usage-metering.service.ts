import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface TrackEvent {
  providerSlug: string;
  businessId?: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class UsageMeteringService {
  private readonly logger = new Logger(UsageMeteringService.name);
  private slugCache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async track(event: TrackEvent): Promise<void> {
    try {
      const providerId = await this.resolveProviderId(event.providerSlug);
      if (!providerId) {
        this.logger.warn(`Proveedor '${event.providerSlug}' no encontrado, evento descartado`);
        return;
      }

      await this.prisma.usageEvent.create({
        data: {
          providerId,
          businessId: event.businessId ?? null,
          category: event.category,
          quantity: event.quantity,
          unit: event.unit,
          estimatedCostUsd: event.estimatedCostUsd ?? null,
          metadata: (event.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(`Error registrando evento de uso (${event.providerSlug}/${event.category}): ${err}`);
    }
  }

  private async resolveProviderId(slug: string): Promise<string | null> {
    const cached = this.slugCache.get(slug);
    if (cached) return cached;

    const provider = await this.prisma.costProvider.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (provider) {
      this.slugCache.set(slug, provider.id);
      return provider.id;
    }

    return null;
  }
}
