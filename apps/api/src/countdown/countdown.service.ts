import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';

type ConfigConDescuento = Prisma.CountdownConfigGetPayload<{
  include: { discount: { include: { products: true; categories: true } } };
}>;

const INCLUIR_DESCUENTO = { discount: { include: { products: true, categories: true } } } as const;

// Cuenta regresiva de la tienda (paquete Avanzado, RBT-675) — lado PÚBLICO.
//
// Acá solo se lee. Quién la tiene y desde cuándo lo decide el dueño en
// Descuentos, con un interruptor en el formulario del descuento
// (DiscountCountdownService escribe la fila `CountdownConfig`). Este service
// arma lo que el storefront dibuja: el reloj y los productos del descuento
// (CountdownOfertaSection.tsx en la portada).
//
// Todo se deriva del descuento real: el título es su nombre, la fecha es su
// vencimiento, los productos son su alcance. Por eso el "termina en 2d 4h" de
// las cards no puede mentir — cuando el reloj llega a cero el descuento deja de
// aplicarse en el carrito, sin ningún job.
@Injectable()
export class CountdownService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  // Devuelve null en vez de tirar error cuando no hay nada que mostrar (no
  // configurado, apagado, sin el add-on, descuento desactivado/borrado, o ya
  // vencido) — es contenido opcional de la tienda, no una falla.
  async getActiveCountdown(businessId: string) {
    // Gate del paquete Avanzado a mano: este endpoint es público, no hay
    // `req.user` del que pueda leer AddonGuard.
    if (!(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) return null;

    const cfg = await this.prisma.countdownConfig.findUnique({
      where: { businessId },
      include: INCLUIR_DESCUENTO,
    });
    if (!cfg || !cfg.isActive) return null;

    // El reloj vive y muere con su descuento: si el dueño lo desactivó desde
    // el listado (o lo borró), no hay promo que anunciar. Se mira acá y no se
    // escribe en la fila, así volver a activar el descuento vuelve a mostrar
    // el reloj sin tener que prenderlo de nuevo.
    const d = cfg.discount;
    if (!d || !d.isActive || d.deletedAt) return null;

    // Vencido: se muestra el mensaje de cierre si hay uno, y si no, nada — el
    // reloj en cero es peor que no tener reloj. (Hoy la fila nunca lleva
    // mensaje de cierre: se conserva el campo por compatibilidad.)
    const terminado = cfg.endDate.getTime() <= Date.now();
    if (terminado && !cfg.finishedMessage) return null;

    return this.toResponse(cfg);
  }

  private toResponse(cfg: ConfigConDescuento) {
    const d = cfg.discount;
    return {
      id: cfg.id,
      title: cfg.title,
      subtitle: cfg.subtitle,
      endDate: cfg.endDate.toISOString(),
      finishedMessage: cfg.finishedMessage,
      ctaText: cfg.ctaText,
      ctaLink: cfg.ctaLink,
      placement: cfg.placement,
      isActive: cfg.isActive,
      // El id del descuento viaja al storefront: es lo que usa la sección de
      // la portada para pedir sus productos (GET /storefront/:slug/products
      // ?discountId=). Es un uuid que solo permite listar productos que ya
      // están públicos en el catálogo con su precio descontado, así que no
      // expone nada nuevo.
      discountId: cfg.discountId,
      showProductsOnHome: cfg.showProductsOnHome && !!d && d.isActive,
      conDescuento: !!d && d.isActive,
      descuentoTipo: d ? (d.type === 'PERCENT_PRODUCT' ? 'PERCENT' : 'AMOUNT') : null,
      descuentoValor: d ? Number(d.value) : null,
      descuentoAlcance: d ? (d.scope as 'PRODUCT' | 'CATEGORY') : null,
      productIds: d ? d.products.map((p) => p.productId) : [],
      categoryIds: d ? d.categories.map((c) => c.categoryId) : [],
    };
  }
}
