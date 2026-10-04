import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { costoEstimadoUsd, esEventoDeTokens, modeloDelEvento, redondearUsd, tienePrecioPropio } from './precios';

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
  private modelosSinPrecioAvisados = new Set<string>();

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
          estimatedCostUsd: event.estimatedCostUsd ?? this.costoDeTokens(event),
          metadata: (event.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(`Error registrando evento de uso (${event.providerSlug}/${event.category}): ${err}`);
    }
  }

  // Los eventos de tokens (Orbi del panel y del alta, y las ayudas de producto) se guardan
  // con su costo, al precio de hoy del modelo de metadata.model (precios.ts): así cambiar
  // un precio no reescribe los meses ya registrados. null si no hay precio para el
  // proveedor: queda para estimarlo al leer, en vez de congelarlo en 0.
  private costoDeTokens(event: TrackEvent): number | null {
    if (!esEventoDeTokens(event.category)) return null;
    const modelo = modeloDelEvento(event.metadata);
    const costo = costoEstimadoUsd({
      proveedor: event.providerSlug,
      categoria: event.category,
      cantidad: event.quantity,
      modelo,
      fecha: new Date(),
    });
    if (costo == null) return null;
    const clave = `${event.providerSlug}/${modelo ?? '(sin modelo)'}`;
    if (!tienePrecioPropio(event.providerSlug, modelo) && !this.modelosSinPrecioAvisados.has(clave)) {
      this.modelosSinPrecioAvisados.add(clave);
      this.logger.warn(`Modelo ${clave} sin precio propio en precios.ts: se cobra con el del modelo por defecto del proveedor`);
    }
    return redondearUsd(costo);
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
