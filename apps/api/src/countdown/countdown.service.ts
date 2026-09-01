import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// "Countdown" (paquete Avanzado) — la mitad pendiente de "Countdown y
// prueba social" que quedó afuera cuando construimos Prueba social (ver
// social-proof.service.ts). A diferencia de esa, y de PromoModal, esta
// tampoco tiene un panel de configuración propio: no hace falta — se
// deriva 100% del módulo de Descuentos (RBT, `Discount`) que el dueño ya
// gestiona en Descuentos. La única señal de "quiero que esto se muestre
// públicamente con cuenta regresiva" es el toggle "link compartible"
// (`linkActive`) que YA existe ahí — mismo campo que habilita la página
// /oferta/:id (ver storefront.service.ts#resolverDescuentoVigentePorId).
// Reusar esa señal evita: (a) inventar un config nuevo, y (b) sorprender
// al dueño mostrando públicamente un descuento automático que nunca quiso
// promocionar así.
@Injectable()
export class CountdownService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveCountdown(businessId: string) {
    // Gate del paquete Avanzado — igual que AddonGuard, pero acá a mano
    // porque este endpoint es público (sin sesión, no hay `req.user` del
    // que leer para que aplique el guard normal).
    const addon = await this.prisma.businessAddon.findFirst({
      where: {
        businessId,
        type: 'ADVANCED',
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!addon) return null;

    const now = new Date();
    // El más urgente primero (el que antes vence) — la sección muestra uno
    // solo. Alcance PRODUCT/CATEGORY únicamente (a pedido: un descuento de
    // TICKET completo no tiene un "Ver oferta" puntual al que mandar al
    // cliente). Automático (`code: null`) — un cupón con código no es lo
    // que se quiere anunciar acá, ver comentario de la clase.
    const descuento = await this.prisma.discount.findFirst({
      where: {
        businessId,
        isActive: true,
        deletedAt: null,
        code: null,
        linkActive: true,
        scope: { in: ['PRODUCT', 'CATEGORY'] },
        startDate: { lte: now },
        endDate: { gt: now },
      },
      orderBy: { endDate: 'asc' },
      select: { id: true, name: true, type: true, value: true, scope: true, endDate: true },
    });
    if (!descuento) return null;

    return {
      id: descuento.id,
      name: descuento.name,
      type: descuento.type,
      value: Number(descuento.value),
      scope: descuento.scope,
      endDate: descuento.endDate!.toISOString(),
    };
  }
}
