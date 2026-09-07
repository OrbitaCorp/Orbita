import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { normalizarLinkDeTienda } from '../common/utils/storefront-link.util';
import { UpsertCountdownDto } from './dto/upsert-countdown.dto';

type ConfigConDescuento = Prisma.CountdownConfigGetPayload<{
  include: { discount: { include: { products: true; categories: true } } };
}>;

const INCLUIR_DESCUENTO = { discount: { include: { products: true, categories: true } } } as const;

// "Countdown" (paquete Avanzado). Config propia (CountdownConfig), sin relación
// con el módulo genérico de Descuentos: ver el comentario del modelo en
// schema.prisma para por qué se abandonó la versión que derivaba del Discount
// con "link compartible".
//
// Dos modos, según `conDescuento`:
//
//   - SOLO CARTEL. Título, fecha y botón propios; no descuenta nada. Sirve para
//     anunciar algo que ya existe por otro lado ("el 2x1 termina el viernes").
//
//   - CON DESCUENTO. Además crea y mantiene un `Discount` real —mismo patrón
//     que TwoForOneService—: el dueño elige el %, a qué productos aplica y hasta
//     cuándo, y ese descuento es el que el motor aplica de verdad en el carrito.
//     La fecha de fin del countdown ES la del descuento, así que el "termina en
//     2d 4h" de las cards no puede prometer algo que no está pasando.
//
// Una fila por negocio, mismo criterio que PromoModalService.
@Injectable()
export class CountdownService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  // ── Panel ────────────────────────────────────────────────────────────────

  async getForBusiness(businessId: string) {
    const cfg = await this.prisma.countdownConfig.findUnique({
      where: { businessId },
      include: INCLUIR_DESCUENTO,
    });
    return cfg ? this.toResponse(cfg) : null;
  }

  async upsert(businessId: string, memberId: string, dto: UpsertCountdownDto) {
    const endDate = new Date(dto.endDate);
    // La fecha vencida solo bloquea al PRENDERLO: si no, no se podría guardar
    // un borrador apagado de una promo cuya fecha todavía se está decidiendo,
    // ni volver a entrar a editar una campaña que ya terminó.
    if (dto.isActive && endDate.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha de fin ya pasó — poné una futura para poder activar la cuenta regresiva');
    }
    const ctaLink = normalizarLinkDeTienda(dto.ctaLink);
    // Un botón sin texto no se dibuja, así que un link sin texto sería una
    // config que no hace nada y el dueño no tendría cómo darse cuenta.
    if (ctaLink && !dto.ctaText?.trim()) {
      throw new BadRequestException('Si ponés un link, escribí también el texto del botón');
    }

    const conDescuento = dto.conDescuento === true;
    if (conDescuento) await this.validarDescuento(businessId, dto);

    const datosConfig = {
      title: dto.title.trim(),
      subtitle: dto.subtitle?.trim() || null,
      endDate,
      finishedMessage: dto.finishedMessage?.trim() || null,
      ctaText: dto.ctaText?.trim() || null,
      ctaLink,
      placement: dto.placement,
      // Sin descuento gestionado no hay sección de productos posible, así que
      // se fuerza en false en vez de guardar un true que no se puede cumplir:
      // si no, apagar el descuento dejaba la config diciendo que la sección
      // está prendida y el storefront no dibujaba nada.
      showProductsOnHome: conDescuento && dto.showProductsOnHome !== false,
      isActive: dto.isActive,
    };

    const existente = await this.prisma.countdownConfig.findUnique({
      where: { businessId },
      select: { discountId: true },
    });

    const cfg = await this.prisma.$transaction(async (tx) => {
      const discountId = await this.sincronizarDescuento(tx, {
        businessId,
        memberId,
        dto,
        endDate,
        conDescuento,
        discountIdExistente: existente?.discountId ?? null,
      });

      return tx.countdownConfig.upsert({
        where: { businessId },
        create: { businessId, ...datosConfig, discountId },
        update: { ...datosConfig, discountId },
        include: INCLUIR_DESCUENTO,
      });
    });

    return this.toResponse(cfg);
  }

  // Crea, actualiza o apaga el Discount que gestiona este módulo. Devuelve el
  // id a guardar en la config.
  //
  // Cuando `conDescuento` pasa a false NO se borra el descuento: se apaga
  // (isActive: false) y se mantiene el vínculo. Borrarlo sería destruir algo
  // que puede estar referenciado en pedidos ya cerrados (DiscountRedemption), y
  // además conservarlo hace que volver a prenderlo reuse la misma fila en vez
  // de ensuciar Descuentos con una nueva por cada vez que el dueño duda.
  private async sincronizarDescuento(
    tx: Prisma.TransactionClient,
    args: {
      businessId: string;
      memberId: string;
      dto: UpsertCountdownDto;
      endDate: Date;
      conDescuento: boolean;
      discountIdExistente: string | null;
    },
  ): Promise<string | null> {
    const { businessId, memberId, dto, endDate, conDescuento, discountIdExistente } = args;

    if (!conDescuento) {
      if (discountIdExistente) {
        await tx.discount.update({ where: { id: discountIdExistente }, data: { isActive: false } });
      }
      return discountIdExistente;
    }

    const esPorcentaje = dto.descuentoTipo === 'PERCENT';
    const alcance = dto.descuentoAlcance as 'PRODUCT' | 'CATEGORY';
    const productos = alcance === 'PRODUCT' ? (dto.productIds ?? []) : [];
    const categorias = alcance === 'CATEGORY' ? (dto.categoryIds ?? []) : [];

    const datos = {
      // El nombre del descuento es el título del cartel: si algún día aparece
      // en el carrito (`discountName`), el cliente lee lo mismo que vio en el
      // banner.
      name: dto.title.trim(),
      type: (esPorcentaje ? 'PERCENT_PRODUCT' : 'AMOUNT_PRODUCT') as 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT',
      value: new Prisma.Decimal(dto.descuentoValor!),
      scope: alcance,
      productLevel: alcance === 'PRODUCT' ? 'padre' : null,
      application: 'AUTOMATIC' as const,
      // Es la clave de todo el módulo: el vencimiento del descuento y el del
      // cartel son el mismo dato.
      endDate,
      isActive: dto.isActive,
      isPrivate: false,
    };

    if (discountIdExistente) {
      await tx.discount.update({
        where: { id: discountIdExistente },
        data: {
          ...datos,
          products: { deleteMany: {}, createMany: { data: productos.map((productId) => ({ productId })) } },
          categories: { deleteMany: {}, createMany: { data: categorias.map((categoryId) => ({ categoryId })) } },
        },
      });
      return discountIdExistente;
    }

    const creado = await tx.discount.create({
      data: {
        ...datos,
        businessId,
        createdBy: memberId,
        startDate: new Date(),
        products: { createMany: { data: productos.map((productId) => ({ productId })) } },
        categories: { createMany: { data: categorias.map((categoryId) => ({ categoryId })) } },
      },
    });
    return creado.id;
  }

  // Mismas reglas que DiscountsService#validarReglas/#validarPertenencia — se
  // repiten acá porque el descuento no pasa por ese módulo.
  private async validarDescuento(businessId: string, dto: UpsertCountdownDto): Promise<void> {
    if (!dto.descuentoTipo || !dto.descuentoAlcance || dto.descuentoValor == null) {
      throw new BadRequestException('Para aplicar un descuento hace falta el tipo, el valor y a qué productos aplica.');
    }
    if (dto.descuentoTipo === 'PERCENT' && (dto.descuentoValor <= 0 || dto.descuentoValor > 100)) {
      throw new BadRequestException('El porcentaje tiene que estar entre 1 y 100.');
    }
    if (dto.descuentoTipo === 'AMOUNT' && dto.descuentoValor <= 0) {
      throw new BadRequestException('El monto tiene que ser mayor a 0.');
    }

    if (dto.descuentoAlcance === 'PRODUCT') {
      if (!dto.productIds?.length) {
        throw new BadRequestException('Elegí al menos un producto para el descuento.');
      }
      const n = await this.prisma.product.count({
        where: { id: { in: dto.productIds }, businessId, deletedAt: null },
      });
      if (n !== dto.productIds.length) {
        throw new BadRequestException('Alguno de los productos elegidos no existe en tu negocio.');
      }
    } else {
      if (!dto.categoryIds?.length) {
        throw new BadRequestException('Elegí al menos una categoría para el descuento.');
      }
      const n = await this.prisma.category.count({ where: { id: { in: dto.categoryIds }, businessId } });
      if (n !== dto.categoryIds.length) {
        throw new BadRequestException('Alguna de las categorías elegidas no existe en tu negocio.');
      }
    }
  }

  // ── Storefront (público) ─────────────────────────────────────────────────

  // Devuelve null en vez de tirar error cuando no hay nada que mostrar (no
  // configurado, apagado, sin el add-on, o ya vencido y sin mensaje de cierre)
  // — es contenido opcional de la tienda, no una falla.
  async getActiveCountdown(businessId: string) {
    // Gate del paquete Avanzado a mano: este endpoint es público, no hay
    // `req.user` del que pueda leer AddonGuard.
    if (!(await this.businesses.hasActiveAddon(businessId, 'ADVANCED'))) return null;

    const cfg = await this.prisma.countdownConfig.findUnique({
      where: { businessId },
      include: INCLUIR_DESCUENTO,
    });
    if (!cfg || !cfg.isActive) return null;

    // Vencido: se muestra el mensaje de cierre si el dueño escribió uno
    // ("¡Se terminó! Gracias a todos"), y si no, no se muestra nada — el reloj
    // en cero es peor que no tener reloj.
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
      // El id del descuento gestionado viaja también al storefront: es lo que
      // usa la sección de la portada para pedir sus productos
      // (GET /storefront/:slug/products?discountId=). Es un uuid que solo
      // permite listar productos que ya están públicos en el catálogo con su
      // precio descontado, así que no expone nada nuevo.
      discountId: cfg.discountId,
      // Solo se reporta prendida si además hay descuento vigente: la fila
      // puede conservar el true de una configuración anterior (ver
      // sincronizarDescuento) y la sección sin productos no existe.
      showProductsOnHome: cfg.showProductsOnHome && !!d && d.isActive,
      // El descuento se reporta como "activo" solo si además está prendido: la
      // fila puede seguir existiendo apagada de una configuración anterior (ver
      // sincronizarDescuento), y el panel no tiene que mostrarla como vigente.
      conDescuento: !!d && d.isActive,
      descuentoTipo: d ? (d.type === 'PERCENT_PRODUCT' ? 'PERCENT' : 'AMOUNT') : null,
      descuentoValor: d ? Number(d.value) : null,
      descuentoAlcance: d ? (d.scope as 'PRODUCT' | 'CATEGORY') : null,
      productIds: d ? d.products.map((p) => p.productId) : [],
      categoryIds: d ? d.categories.map((c) => c.categoryId) : [],
    };
  }
}
