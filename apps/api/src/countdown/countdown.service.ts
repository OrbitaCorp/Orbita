import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';

type ConfigConDescuento = Prisma.CountdownConfigGetPayload<{
  include: { discount: { include: { products: true; categories: true } } };
}>;

const INCLUIR_DESCUENTO = { discount: { include: { products: true, categories: true } } } as const;

// "Oferta relámpago" (paquete Avanzado, RBT-675) — lado PÚBLICO más el
// interruptor de Avanzado.
//
// Qué descuento es la oferta relámpago lo decide el dueño en Descuentos
// (tipo "Oferta relámpago" del formulario; DiscountCountdownService escribe
// la fila `CountdownConfig`). Acá viven dos cosas: lo que el storefront
// dibuja —el reloj y los productos del descuento, CountdownOfertaSection.tsx—
// y el interruptor por negocio (`Business.flashSaleEnabled`) que la tarjeta
// de Avanzado prende y apaga.
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

    // Interruptor de Avanzado apagado: la fila puede seguir ahí (el dueño
    // no tiene que volver a configurar nada al prenderlo), pero la tienda
    // no muestra nada.
    if (!(await this.estaHabilitada(businessId))) return null;

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

    // Programada para más adelante: el descuento todavía no aplica (el motor
    // mira startDate) y mostrar el reloj antes de tiempo prometería un precio
    // que el carrito no cobra. Aparece sola cuando llega la fecha de inicio.
    if (d.startDate.getTime() > Date.now()) return null;

    // Vencido: se muestra el mensaje de cierre si hay uno, y si no, nada — el
    // reloj en cero es peor que no tener reloj. (Hoy la fila nunca lleva
    // mensaje de cierre: se conserva el campo por compatibilidad.)
    const terminado = cfg.endDate.getTime() <= Date.now();
    if (terminado && !cfg.finishedMessage) return null;

    return this.toResponse(cfg);
  }

  // ── Interruptor de la tarjeta de Avanzado ─────────────────────────────────

  async estaHabilitada(businessId: string): Promise<boolean> {
    const b = await this.prisma.business.findUnique({ where: { id: businessId }, select: { flashSaleEnabled: true } });
    return b?.flashSaleEnabled ?? false;
  }

  // Lo que muestra la tarjeta de Avanzado y el aviso del formulario de
  // Descuentos ("hoy la tiene «Cyber Week»; al guardar pasa a esta"): si
  // está habilitada y qué descuento la tiene ahora, si alguno.
  async getSettings(businessId: string) {
    const [enabled, cfg] = await Promise.all([
      this.estaHabilitada(businessId),
      this.prisma.countdownConfig.findUnique({
        where: { businessId },
        select: { isActive: true, discount: { select: { id: true, name: true, startDate: true, endDate: true, isActive: true, deletedAt: true } } },
      }),
    ]);
    const d = cfg?.isActive ? cfg.discount : null;
    const ahora = Date.now();
    const actual = d && !d.deletedAt
      ? {
          discountId: d.id,
          name: d.name,
          startDate: d.startDate.toISOString(),
          endDate: d.endDate?.toISOString() ?? null,
          isActive: d.isActive,
          // Todavía no empezó: ocupa el lugar (una sola a la vez) pero la
          // tienda no la muestra hasta la fecha de inicio.
          programada: d.startDate.getTime() > ahora,
        }
      : null;
    // "Vigente" = ocupa el lugar de la única oferta relámpago: activa y sin
    // vencer (programada o corriendo). Es lo que traba el interruptor y lo
    // que impide crear otra.
    const vigente = !!actual && actual.isActive && !!actual.endDate && new Date(actual.endDate).getTime() > ahora;
    return { enabled, actual, vigente };
  }

  // Prender o apagar el interruptor. Apagar NO toca la fila de
  // countdown_configs ni el descuento — por eso, mientras haya una oferta
  // corriendo, NO se puede apagar (Ale, 08/09): quedaría un estado a medias,
  // con el descuento aplicándose en el carrito pero sin el reloj en la
  // tienda. Primero se borra o se espera a que termine.
  async setEnabled(businessId: string, enabled: boolean) {
    const b = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!b) throw new NotFoundException('Negocio no encontrado');
    if (!enabled) {
      const s = await this.getSettings(businessId);
      if (s.vigente && s.actual) {
        const hasta = s.actual.endDate
          ? new Date(s.actual.endDate).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : null;
        throw new BadRequestException(
          `Tenés una oferta relámpago activa («${s.actual.name}»${hasta ? `, hasta el ${hasta}` : ''}). Para apagar la función, primero borrala desde Descuentos o esperá a que termine.`,
        );
      }
    }
    await this.prisma.business.update({ where: { id: businessId }, data: { flashSaleEnabled: enabled } });
    return this.getSettings(businessId);
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
