import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pickPrimaryImageUrl, orderedImageUrls } from '../common/utils/product-image.util';
import { StorefrontProductsQueryDto } from './dto/storefront-products-query.dto';
import { MercadopagoService } from '../mercadopago/mercadopago.service';
import { DiscountsService } from '../discounts/discounts.service';

// Un negocio pausado o inactivo no debería ni resolver — mismo criterio que
// "no revelar de más" que ya usa auth.service.ts con businessSlug.
const NOT_FOUND = () => new NotFoundException('Negocio no encontrado');

// Techo de lo que se puede comprar/mostrar de una sola variante en el
// storefront público. Con esto el número exacto de stock SOLO es observable
// cuando queda poco (que es justo cuando el comprador necesita verlo) — una
// tienda con mucho inventario nunca lo publica. De paso funciona como límite
// antifraude por línea de pedido.
const MAX_QTY_PUBLICO = 20;

// El precio que se muestra en la card/listado tiene que ser SIEMPRE el que
// realmente se cobra al agregar al carrito — nunca `Product.basePrice` como
// un número aparte que puede desincronizarse del precio real de la variante
// (pasa cuando el dueño edita precios por variante y basePrice queda viejo,
// o si el producto termina con más de una variante "sin opciones" por algún
// bug de edición: ver Jira). Para un producto CON opciones no hay una única
// variante que representar (cada combinación tiene su propio precio, el
// selector rápido/detalle ya lo resuelve) — ahí `basePrice` sigue siendo el
// "desde $X" de la card, sin cambios.
function precioRepresentativo<V extends { price: Prisma.Decimal; isDefault: boolean; stock: { quantity: number }[] }>(
  basePrice: Prisma.Decimal,
  variants: V[],
  tieneOpciones: boolean,
): number {
  if (tieneOpciones || variants.length === 0) return Number(basePrice);
  const variante =
    variants.find((v) => v.isDefault) ??
    variants.find((v) => v.stock.some((s) => s.quantity > 0)) ??
    variants[0];
  return Number(variante.price);
}

// Misma prioridad que precioRepresentativo() (isDefault → con stock → más
// vieja), pero devuelve la variante entera en vez del número — hace falta el
// `id` para poder evaluarle un descuento automático (RBT-613). `undefined`
// con `tieneOpciones` (no hay UNA variante representativa: cada combinación
// tiene su propio precio) o sin variantes.
function varianteRepresentativa<V extends { id: string; price: Prisma.Decimal; isDefault: boolean; stock: { quantity: number }[] }>(
  variants: V[],
  tieneOpciones: boolean,
): V | undefined {
  if (tieneOpciones || variants.length === 0) return undefined;
  return variants.find((v) => v.isDefault) ?? variants.find((v) => v.stock.some((s) => s.quantity > 0)) ?? variants[0];
}

// (RBT-613) Aplica el resultado de un descuento AUTOMÁTICO (si hay) al par
// price/comparePrice que el resto del storefront ya sabe mostrar (tachado +
// badge de "oferta" — ver `enOferta`/`toProducto()` en el frontend). Sin
// descuento, devuelve exactamente lo mismo que ya se calculaba — cero cambio
// para un negocio sin descuentos automáticos.
//
// Con descuento, el nuevo `price` es el ya rebajado, y el `comparePrice`
// pasa a ser el mayor entre el que el dueño haya cargado a mano y el precio
// SIN descontar — así "antes $X" nunca miente para abajo, prefiriendo el
// precio de lista manual del dueño cuando es más alto.
function aplicarDescuento(
  price: number,
  comparePrice: number | null,
  desc?: { amount: number },
): { price: number; comparePrice: number | null } {
  if (!desc || desc.amount <= 0) return { price, comparePrice };
  const nuevoPrice = Math.round((price - desc.amount) * 100) / 100;
  const nuevoComparePrice = Math.max(comparePrice ?? 0, price);
  return { price: nuevoPrice, comparePrice: nuevoComparePrice };
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadopago: MercadopagoService,
    private readonly discounts: DiscountsService,
  ) {}

  // Mercado Pago solo está REALMENTE disponible si el negocio activó el
  // toggle Y conectó su cuenta de verdad (OAuth) — el toggle solo no alcanza
  // (ver ConfigGeneral.tsx, se puede activar el toggle sin conectar todavía).
  async isMercadopagoAvailable(businessId: string, acceptsMercadopago: boolean): Promise<boolean> {
    if (!acceptsMercadopago) return false;
    const { connected } = await this.mercadopago.getStatus(businessId);
    return connected;
  }

  // Mismo patrón usado 5+ veces en auth.service.ts: el slug de la URL nunca
  // trae businessId ni pasa por AuthGuard (rutas @Public()), así que cada
  // método público lo resuelve acá.
  private async resolveBusiness(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { subdomain: slug } });
    if (!business) throw NOT_FOUND();
    return business;
  }

  // Único método público de resolución — lo usa StorefrontController.checkout()
  // para verificar que el negocio del slug de la URL es el MISMO que el del
  // token del cliente (defensa en profundidad: un token de otra tienda no
  // tiene que poder crear pedidos acá aunque el slug resuelva bien).
  async resolveBusinessId(slug: string): Promise<string> {
    return (await this.resolveBusiness(slug)).id;
  }

  // La MISMA sucursal contra la que OrdersService.create() valida stock al
  // comprar (la más antigua del negocio — el checkout público no manda
  // branch_id). Antes el storefront sumaba el stock de TODAS las sucursales
  // para decidir qué mostrar, mientras que comprar solo miraba esta — con más
  // de una sucursal, un producto podía verse disponible acá y rechazarse al
  // pagar. Se centraliza acá para que lo que se muestra y lo que se valida
  // sean siempre el mismo número.
  private async sucursalDeVenta(businessId: string): Promise<{ id: string }> {
    const branch = await this.prisma.branch.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Este negocio todavía no tiene una sucursal configurada');
    return branch;
  }

  // Para validar server-side el método de pago elegido en el checkout — igual
  // criterio que con precios/stock: nunca se confía en lo que mande el
  // cliente sobre qué está habilitado.
  async getPaymentConfig(businessId: string) {
    const config = await this.prisma.businessConfig.findUnique({ where: { businessId } });
    if (!config) throw new NotFoundException('Configuración de pagos no encontrada');
    return config;
  }

  // OrdersService.create() (pensado originalmente para el panel, donde el
  // dueño/staff podía mandar cualquier shippingAddressId de buena fe) no
  // valida de quién es la dirección — expuesto ahora al checkout público, un
  // cliente mal intencionado podría mandar el id de la dirección de OTRO
  // cliente. Se valida acá antes de llamar a create().
  async assertAddressBelongsToCustomer(addressId: string, customerId: string) {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, customerId } });
    if (!address) throw new NotFoundException('Esa dirección no existe o no te pertenece');
  }

  // Defensa en profundidad para el checkout: el storefront (frontend) ya
  // deja de mostrarse por completo mientras la tienda está pausada o nunca
  // se publicó (ver forceSSR.ts + TiendaPausada.tsx), pero eso no evita que
  // alguien le pegue directo a la API. Nunca se puede crear un pedido en una
  // tienda que el dueño pausó o que todavía no publicó.
  async assertBusinessOperativo(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { isPaused: true, isActive: true },
    });
    if (!business) throw NOT_FOUND();
    if (business.isPaused) throw new UnprocessableEntityException('Esta tienda está pausada temporalmente — no se pueden hacer pedidos ahora.');
    if (!business.isActive) throw NOT_FOUND();
  }

  // ── Config (branding + apariencia + contacto) ───────────────────────────

  async getConfig(slug: string) {
    const business = await this.resolveBusiness(slug);

    const [appearance, contact, pickupBranch] = await Promise.all([
      this.prisma.storefrontConfig.findUnique({ where: { businessId: business.id } }),
      this.prisma.businessConfig.findUnique({ where: { businessId: business.id } }),
      // Solo se usa si "Retiro en local" está activo — la sucursal por
      // defecto es la única dirección de retiro que el negocio tiene hoy
      // (no hay todavía UI para elegir sucursal en el checkout).
      this.prisma.branch.findFirst({
        where: { businessId: business.id, isActive: true },
        orderBy: { isDefault: 'desc' },
        select: { name: true, address: true },
      }),
    ]);

    return {
      business: {
        id: business.id,
        name: business.name,
        subdomain: business.subdomain,
        mode: business.mode,
        isActive: business.isActive,
        isPaused: business.isPaused,
      },
      appearance: appearance
        ? {
            storeName: appearance.storeName,
            tagline: appearance.tagline,
            logoUrl: appearance.logoUrl,
            faviconUrl: appearance.faviconUrl,
            colorPrimary: appearance.colorPrimary,
            colorSecondary: appearance.colorSecondary,
            colorAccent: appearance.colorAccent,
            colorBackground: appearance.colorBackground,
            colorMode: appearance.colorMode,
            fontFamily: appearance.fontFamily,
            fontFamilyBody: appearance.fontFamilyBody,
            fontScale: appearance.fontScale ? Number(appearance.fontScale) : null,
            headerLayout: appearance.headerLayout,
            gridLayout: appearance.gridLayout,
            cardRadius: appearance.cardRadius,
            heroSlides: appearance.heroSlides ?? [],
            headerLinks: appearance.headerLinks ?? [],
            showReviews: appearance.showRating,
            showNewBadge: appearance.showNewBadge,
            showWhatsapp: appearance.showWhatsapp,
            showLowStock: appearance.showLowStock,
            showOfferBadge: appearance.showOfferBadge,
            showSearch: appearance.showSearch,
            showCategoriesSection: appearance.showCategoriesSection,
            showFooter: appearance.showFooter,
            showSocialFooter: appearance.showSocialFooter,
            showAnnouncementBar: appearance.showAnnouncementBar,
            showStatsBar: appearance.showStatsBar,
            shippingText: appearance.shippingText,
            whatsappText: appearance.whatsappText,
            statsBar: appearance.statsBar ?? [],
          }
        : null,
      contact: contact
        ? {
            whatsapp: contact.whatsapp,
            email: contact.email,
            scheduleText: contact.scheduleText,
            instagram: contact.instagram,
            tiktok: contact.tiktok,
            facebook: contact.facebook,
          }
        : null,
      // `acceptsMercadopago` es el toggle crudo (se puede prender sin haber
      // conectado la cuenta todavía, ver ConfigGeneral.tsx); `mercadopagoAvailable`
      // además exige la conexión OAuth real — es lo que el checkout usa para
      // decidir si mostrar el botón (Fase 8, antes no había forma de cobrar
      // así que ni se exponía).
      payment: contact
        ? {
            acceptsMercadopago: contact.acceptsMercadopago,
            mercadopagoAvailable: await this.isMercadopagoAvailable(business.id, contact.acceptsMercadopago),
            acceptsCash: contact.acceptsCash,
            acceptsTransfer: contact.acceptsTransfer,
            acceptsPickup: contact.acceptsPickup,
            transferAlias: contact.acceptsTransfer ? contact.transferAlias : null,
            // CBU/titular son opcionales incluso con transferencia activa (un
            // negocio puede seguir operando solo con alias) — mismo criterio
            // que transferAlias: se esconden si la transferencia no está
            // activa, para no filtrar datos bancarios de un medio de pago
            // que la tienda no está ofreciendo en este momento.
            transferCbu: contact.acceptsTransfer ? contact.transferCbu : null,
            transferHolder: contact.acceptsTransfer ? contact.transferHolder : null,
            cashDiscountPercent: contact.acceptsCash && contact.cashDiscountPercent != null
              ? Number(contact.cashDiscountPercent)
              : null,
            pickupAddress: contact.acceptsPickup && pickupBranch?.address ? pickupBranch.address : null,
            // Nombre del local de retiro (antes solo se exponía la dirección,
            // pero mostrarla sin decir DE QUÉ local es quedaba huérfano en el
            // storefront si el negocio tiene un nombre de fantasía distinto
            // al de la tienda).
            pickupBranchName: contact.acceptsPickup && pickupBranch ? pickupBranch.name : null,
            pickupPaymentMethods: contact.acceptsPickup ? contact.pickupPaymentMethods : [],
          }
        : null,
      // Campos vacíos se mandan tal cual (null) — el criterio de "si no está
      // cargado, no se muestra ni se calcula nada" lo aplica el frontend.
      shipping: contact
        ? {
            shippingBase: contact.shippingBase != null ? Number(contact.shippingBase) : null,
            freeShippingFrom: contact.freeShippingFrom != null ? Number(contact.freeShippingFrom) : null,
            deliveryZones: contact.deliveryZones ?? [],
            shippingPolicy: contact.shippingPolicy,
          }
        : null,
    };
  }

  // ── Productos ────────────────────────────────────────────────────────────

  // El storefront público muestra PUBLISHED y OUT_OF_STOCK (que un producto
  // esté sin stock es información útil para el comprador, no algo que
  // esconder) — oculta solo DRAFT y soft-deleted. Ver PENDIENTES.md.
  async listProducts(slug: string, query: StorefrontProductsQueryDto) {
    const business = await this.resolveBusiness(slug);
    const branch = await this.sucursalDeVenta(business.id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // ?discountCode= (cupón) / ?discountId= (descuento) — mismas validaciones
    // de vigencia que exclusiveDiscount()/discountLanding(). Alcance "ticket"
    // no filtra nada (aplica a toda la compra): el 404 de la validación
    // arriba ya cubre un código/id inválido, acá solo se resuelve a qué
    // productos apunta si el alcance es producto/categoría.
    let alcanceDescuento: Prisma.ProductWhereInput | null = null;
    if (query.discountCode || query.discountId) {
      const d = query.discountCode
        ? await this.resolverDescuentoVigente(business.id, query.discountCode)
        : await this.resolverDescuentoVigentePorId(business.id, query.discountId!);
      if (d.scope === 'PRODUCT') {
        alcanceDescuento = { id: { in: d.products.map((p) => p.productId) } };
      } else if (d.scope === 'CATEGORY') {
        alcanceDescuento = { categoryId: { in: d.categories.map((c) => c.categoryId) } };
      }
      // scope === 'TICKET': sin filtro adicional, queda null.
    }

    // "id1,id2,..." — filtro de categoría multi-select (ver DTO). Con un solo
    // id queda igual que antes (categoryId: id); con varios, un IN.
    const categoryIds = query.categoryId
      ? query.categoryId.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const where: Prisma.ProductWhereInput = {
      businessId: business.id,
      deletedAt: null,
      status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
      ...(alcanceDescuento ?? {}),
      ...(categoryIds.length === 1
        ? { categoryId: categoryIds[0] }
        : categoryIds.length > 1
          ? { categoryId: { in: categoryIds } }
          : {}),
      ...(query.featured ? { isFeatured: true } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      // OJO: minPrice/maxPrice tienen que ir en el MISMO objeto `basePrice`
      // — dos spreads separados con la misma clave (uno con `gte`, otro con
      // `lte`) se pisan entre sí (el segundo gana), perdiendo el primer
      // filtro en silencio. Confirmado con datos reales antes de este fix.
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            basePrice: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
    };

    // A diferencia de antes, acá no se pagina en la consulta: "en oferta"
    // (comparar comparePrice contra basePrice, dos columnas de la misma fila)
    // y "más vendidos" (ordenar por un agregado externo a Product) no se
    // pueden resolver en un solo WHERE/ORDER BY de Prisma sin SQL crudo. Se
    // trae el conjunto completo que matchea los filtros "baratos" (categoría/
    // búsqueda/precio/estado) y se filtra/ordena/pagina en memoria — mismo
    // criterio de trade-off que ya usa ReportsService.products() para catálogos
    // de este tamaño (un negocio chico/mediano, no miles de productos).
    const candidatos = await this.prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        // Sin selección de nada más que el id: solo hace falta para saber si
        // el producto tiene opciones (ver precioRepresentativo() más abajo).
        options: { select: { id: true } },
        // isActive: true — una variante desactivada ("combinación no
        // ofrecida") no debe contar como si tuviera stock. `stock` se filtra
        // a la MISMA sucursal que valida el checkout (ver sucursalDeVenta) en
        // vez de sumar todas — antes una tienda con stock repartido en varias
        // sucursales podía mostrar "hay stock" acá y rechazar la compra.
        variants: {
          where: { isActive: true },
          // Orden determinístico — sin esto, precioRepresentativo() (y el
          // "variants[0]" que usa el frontend para el agregado directo de un
          // producto sin opciones) dependían del orden que Postgres decidiera
          // devolver, no garantizado. Con más de una variante "sin opciones"
          // por algún dato corrupto (ver Jira), la más vieja es la real.
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, price: true, isDefault: true,
            stock: { where: { branchId: branch.id }, select: { quantity: true, stockMin: true } },
          },
        },
        images: { select: { url: true, isPrimary: true, optionValueId: true }, orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // (RBT-613) Descuentos automáticos para toda la página candidata, en UNA
    // sola pasada — mismo criterio de "negocio chico, no miles de productos"
    // que ya justifica traer todo sin paginar acá arriba. Un producto CON
    // opciones se evalúa a nivel padre (con basePrice — es lo que muestra la
    // card, "desde $X"); solo matchean ahí descuentos de alcance
    // PRODUCT/productLevel:'padre' o CATEGORY, nunca los de una variante
    // puntual (gap documentado en Jira — mover el "desde" sin mover el precio
    // real sería mentir). Sin opciones, se evalúa la MISMA variante
    // representativa que ya elige precioRepresentativo(), así que precio
    // mostrado y precio descontado son siempre consistentes.
    const claveDescuento = (p: (typeof candidatos)[number]): string =>
      p.options.length > 0 ? `p:${p.id}` : (varianteRepresentativa(p.variants, false)?.id ?? `p:${p.id}`);
    const itemsDescuento = candidatos.map((p) => ({
      variantId: claveDescuento(p),
      productId: p.id,
      categoryId: p.categoryId,
      unitPrice: precioRepresentativo(p.basePrice, p.variants, p.options.length > 0),
    }));
    const descuentosPorClave = await this.discounts.descuentosDeItems(business.id, itemsDescuento);

    // Un producto sin NINGUNA variante con stock no se lista en el catálogo
    // público — decisión 2026-08-13: mostrarlo llevaba a cards con los dos
    // botones de compra activos que después no agregaban nada (variante sin
    // stock). Esto es SIEMPRE, no solo cuando `query.inStock` lo pide — ese
    // filtro queda como estaba (ahora redundante) para no tocar el contrato
    // del catálogo con el checkbox "Solo con stock" del cliente. Un producto
    // con ALGUNAS variantes sin stock sigue listándose igual — esas se tachan
    // en el detalle (ver ProductoDetalle.tsx), acá no hay forma de saber cuál
    // eligió el cliente todavía.
    let filtrados = candidatos.filter((p) => p.variants.some((v) => v.stock.some((s) => s.quantity > 0)));
    if (query.onSale) {
      filtrados = filtrados.filter((p) =>
        (p.comparePrice !== null && Number(p.comparePrice) > Number(p.basePrice)) || descuentosPorClave.has(claveDescuento(p)),
      );
    }
    if (query.inStock) {
      filtrados = filtrados.filter((p) => p.variants.some((v) => v.stock.some((s) => s.quantity > 0)));
    }

    // Toggle "Insignia de stock bajo" (showLowStock, Apariencia). Nunca se
    // expone la cantidad exacta acá — solo si ALGUNA variante que todavía
    // tiene stock está en (o por debajo de) su umbral de alerta
    // (VariantStock.stockMin, el mismo que ya usa el panel para avisar).
    const esBajoStock = (v: { stock: { quantity: number; stockMin: number }[] }) => {
      const qty = v.stock.reduce((s, r) => s + r.quantity, 0);
      const min = v.stock.reduce((s, r) => s + r.stockMin, 0);
      return qty > 0 && qty <= min;
    };

    // "Más vendidos": unidades totales históricas por producto (sin ventana de
    // tiempo — el storefront no tiene selector de rango como el reporte del
    // panel). Se agrupa OrderItem por variante y se sube a producto, mismo
    // patrón que ReportsService.products().
    let unidadesPorProducto: Map<string, number> | null = null;
    if (query.sort === 'bestselling') {
      const items = await this.prisma.orderItem.findMany({
        where: { isConcept: false, order: { businessId: business.id, deletedAt: null, status: { not: 'CANCELLED' } } },
        select: { quantity: true, variant: { select: { productId: true } } },
      });
      unidadesPorProducto = new Map();
      for (const it of items) {
        const key = it.variant.productId;
        unidadesPorProducto.set(key, (unidadesPorProducto.get(key) ?? 0) + it.quantity);
      }
    }

    const ordenados = filtrados.slice().sort((a, b) => {
      if (query.sort === 'precio-asc') return Number(a.basePrice) - Number(b.basePrice);
      if (query.sort === 'precio-desc') return Number(b.basePrice) - Number(a.basePrice);
      if (query.sort === 'bestselling') return (unidadesPorProducto!.get(b.id) ?? 0) - (unidadesPorProducto!.get(a.id) ?? 0);
      return 0; // 'relevancia' (default): se queda con el orden del WHERE (createdAt desc)
    });

    const total = ordenados.length;
    const pageItems = ordenados.slice((page - 1) * limit, (page - 1) * limit + limit);

    return {
      data: pageItems.map((p) => {
        const { price, comparePrice } = aplicarDescuento(
          precioRepresentativo(p.basePrice, p.variants, p.options.length > 0),
          p.comparePrice ? Number(p.comparePrice) : null,
          descuentosPorClave.get(claveDescuento(p)),
        );
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          price,
          comparePrice,
          imageUrl: pickPrimaryImageUrl(p.images),
          images: orderedImageUrls(p.images),
          isFeatured: p.isFeatured,
          inStock: p.variants.some((v) => v.stock.some((s) => s.quantity > 0)),
          lowStock: p.variants.some(esBajoStock),
          createdAt: p.createdAt.toISOString(),
        };
      }),
      total,
      page,
      limit,
    };
  }

  async getProduct(slug: string, id: string) {
    const business = await this.resolveBusiness(slug);
    const branch = await this.sucursalDeVenta(business.id);

    const product = await this.prisma.product.findFirst({
      where: { id, businessId: business.id, deletedAt: null, status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } },
      include: {
        category: { select: { id: true, name: true } },
        productTags: { include: { tag: true } },
        options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        variants: {
          where: { isActive: true },
          // Orden determinístico — ver el mismo comentario en listProducts().
          orderBy: { createdAt: 'asc' },
          include: {
            optionValues: { include: { optionValue: true } },
            // Misma sucursal que valida el checkout — ver sucursalDeVenta().
            stock: { where: { branchId: branch.id }, select: { quantity: true, stockMin: true } },
          },
        },
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    // (RBT-613) Un ítem por CADA variante activa (no solo la representativa —
    // el cliente puede elegir cualquiera) más el ítem sintético a nivel padre
    // si el producto tiene opciones (mismo criterio que listProducts()). Así
    // agregar al carrito desde acá, la card o el picker de variante siempre
    // lleva el precio ya descontado.
    const tieneOpciones = product.options.length > 0;
    const itemsDescuento = [
      ...(tieneOpciones
        ? [{ variantId: `p:${product.id}`, productId: product.id, categoryId: product.categoryId, unitPrice: Number(product.basePrice) }]
        : []),
      ...product.variants.map((v) => ({
        variantId: v.id, productId: product.id, categoryId: product.categoryId, unitPrice: Number(v.price),
      })),
    ];
    const descuentosPorVariante = await this.discounts.descuentosDeItems(business.id, itemsDescuento);

    const claveCabecera = tieneOpciones ? `p:${product.id}` : varianteRepresentativa(product.variants, false)?.id;
    const { price, comparePrice } = aplicarDescuento(
      precioRepresentativo(product.basePrice, product.variants, tieneOpciones),
      product.comparePrice ? Number(product.comparePrice) : null,
      claveCabecera ? descuentosPorVariante.get(claveCabecera) : undefined,
    );

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      // Sin `cost`: es información privada de margen, no debe salir por una
      // ruta pública. Ver decisión documentada en PENDIENTES.md.
      price,
      comparePrice,
      isFeatured: product.isFeatured,
      tags: product.productTags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name })),
      options: product.options.map((o) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        isVisual: o.isVisual,
        values: o.values.map((v) => ({ id: v.id, value: v.value, position: v.position })),
      })),
      variants: product.variants.map((v) => {
        // Una sola fila posible acá: stock ya viene filtrado a UNA sucursal
        // (@@unique([variantId, branchId])).
        const qty = v.stock[0]?.quantity ?? 0;
        const min = v.stock[0]?.stockMin ?? 0;
        const precioVariante = aplicarDescuento(
          Number(v.price),
          v.comparePrice ? Number(v.comparePrice) : null,
          descuentosPorVariante.get(v.id),
        );
        return {
          id: v.id,
          sku: v.sku,
          price: precioVariante.price,
          comparePrice: precioVariante.comparePrice,
          isDefault: v.isDefault,
          optionValues: v.optionValues.map((ov) => ({ optionValueId: ov.optionValueId, value: ov.optionValue.value })),
          inStock: qty > 0,
          // lowStock usa el mismo umbral (stockMin) que ya alerta en el panel
          // — toggle "Insignia de stock bajo" de Apariencia.
          lowStock: qty > 0 && qty <= min,
          // El número EXACTO de stock solo se ve acotado a MAX_QTY_PUBLICO —
          // nunca el inventario completo de la tienda. Con poco stock (que es
          // justo cuando el comprador lo necesita) da el número real; con
          // mucho, se topea. Sirve además de límite por línea de pedido.
          maxQty: Math.min(qty, MAX_QTY_PUBLICO),
        };
      }),
      images: product.images.map((img) => ({
        url: img.url,
        position: img.position,
        isPrimary: img.isPrimary,
        optionValueId: img.optionValueId,
      })),
    };
  }

  // ── Carrito: revalidar contra la base antes de pagar ───────────────────────
  // El carrito del cliente vive en localStorage y puede tener semanas — nada
  // lo revalidaba nunca. Este endpoint le dice al frontend, por cada línea,
  // si sigue siendo comprable y con qué precio/stock REAL, para que el
  // carrito pueda avisar (producto borrado, variante desactivada, sin stock,
  // menos stock del pedido) antes de que el comprador se entere recién al
  // pagar con el 422 de OrdersService.create().
  //
  // El precio nunca se compara acá contra lo que mande el cliente (no se le
  // pide, ni se confiaría si lo mandara) — el frontend compara el `precio`
  // que YA tiene guardado contra el que devuelve esto, y avisa si cambió.
  async validateCart(
    slug: string,
    items: { variantId: string; quantity: number }[],
    opts: { couponCode?: string; customerId?: string } = {},
  ) {
    const business = await this.resolveBusiness(slug);
    const branch = await this.sucursalDeVenta(business.id);

    const variantIds = [...new Set(items.map((it) => it.variantId))];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true, product: { businessId: business.id, deletedAt: null, status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } } },
      include: {
        // Las imágenes son del PRODUCTO (con un optionValueId opcional que
        // las liga a un valor puntual, ej. "Negro") — la variante en sí no
        // tiene fotos propias. `categoryId` hace falta para matchear
        // descuentos automáticos de alcance CATEGORY (RBT-613).
        product: {
          select: {
            name: true, categoryId: true,
            images: { select: { url: true, isPrimary: true, optionValueId: true }, orderBy: { position: 'asc' } },
          },
        },
        optionValues: { include: { optionValue: true } },
        stock: { where: { branchId: branch.id }, select: { quantity: true } },
      },
    });
    const porId = new Map(variants.map((v) => [v.id, v]));

    // (RBT-613) Descuentos automáticos con las cantidades REALES del carrito
    // — a diferencia de listProducts()/getProduct() (quantity:1 por ítem),
    // acá sí importa el alcance TICKET (necesita un subtotal de verdad). Solo
    // con los ítems que existen de verdad: un variantId inventado o de un
    // producto borrado no puede llegar a resolverItemsDelCarrito() (que
    // rompe si no encuentra alguno) — sigue cayendo en NO_DISPONIBLE abajo.
    const itemsValidos = items.filter((it) => porId.has(it.variantId));
    const evaluado = await this.discounts.evaluarCarritoAutomatico(business.id, itemsValidos, {
      code: opts.couponCode,
      customerId: opts.customerId,
    });
    const descuentoPorVariante = new Map(evaluado.itemDiscounts.map((d) => [d.variantId, d]));

    const resultado = items.map((it) => {
      const v = porId.get(it.variantId);
      if (!v) {
        return {
          variantId: it.variantId, ok: false, motivo: 'NO_DISPONIBLE' as const,
          nombre: null, variante: null, precio: null, precioAnt: null, maxQty: 0, imgUrl: null,
        };
      }

      const qty = v.stock[0]?.quantity ?? 0;
      const maxQty = Math.min(qty, MAX_QTY_PUBLICO);
      const motivo = qty === 0 ? ('SIN_STOCK' as const) : qty < it.quantity ? ('STOCK_INSUFICIENTE' as const) : undefined;

      // Imagen: si algún valor de opción de ESTA variante (ej. "Negro") tiene
      // foto propia, esa; si no, la principal general del producto — mismo
      // criterio de fallback que pickPrimaryImageUrl ya usa en el resto del
      // storefront.
      const idsOpcion = new Set(v.optionValues.map((ov) => ov.optionValueId));
      const fotoDeVariante = v.product.images.find((img) => img.optionValueId && idsOpcion.has(img.optionValueId));
      const imgUrl = fotoDeVariante?.url ?? pickPrimaryImageUrl(v.product.images);

      // El monto que devuelve evaluateCart() es por TODO el renglón (precio ×
      // cantidad) — acá se muestra un precio por UNIDAD, así que se divide de
      // vuelta. Puede desviar hasta ~1 centavo del monto real que cobra el
      // pedido (que opera sobre el total del renglón, no por unidad) — la
      // fuente de verdad del cobro sigue siendo OrdersService.create().
      const descLinea = descuentoPorVariante.get(v.id);
      const { price: precio, comparePrice: precioAnt } = aplicarDescuento(
        Number(v.price),
        v.comparePrice ? Number(v.comparePrice) : null,
        descLinea ? { amount: descLinea.amount / it.quantity } : undefined,
      );

      return {
        variantId: v.id,
        ok: motivo === undefined,
        motivo,
        nombre: v.product.name,
        variante: v.optionValues.length > 0 ? v.optionValues.map((ov) => ov.optionValue.value).join(' / ') : null,
        precio,
        precioAnt,
        maxQty,
        imgUrl,
      };
    });

    return {
      items: resultado,
      ticketDiscount: evaluado.ticketDiscount
        ? { nombre: evaluado.ticketDiscount.discountName, monto: evaluado.ticketDiscount.amount }
        : null,
      // Estado del cupón tipeado (si vino uno en `opts.couponCode`) — permite
      // mostrar "cupón inválido: <motivo>" apenas se escribe el código, sin
      // esperar a que el cliente confirme la compra para enterarse.
      coupon: evaluado.cupon,
    };
  }

  // ── Categorías ───────────────────────────────────────────────────────────

  async listCategories(slug: string) {
    const business = await this.resolveBusiness(slug);

    const categories = await this.prisma.category.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { position: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null, status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } } } } } },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      parentId: c.parentId,
      productCount: c._count.products,
    }));
  }

  // ── Cupones públicos (RBT-615/616 — vista del cliente) ─────────────────────
  // Los que el cliente puede copiar y aplicar en el checkout. Solo cupones
  // (code != null) PÚBLICOS (isPrivate = false — los privados se acceden por
  // link/código directo, no se listan), activos, vigentes y no agotados. No se
  // exponen datos internos (usesConsumed, límites, createdBy): solo lo que el
  // comprador necesita para decidir usarlo.
  async listCoupons(slug: string) {
    const business = await this.resolveBusiness(slug);
    const now = new Date();

    const rows = await this.prisma.discount.findMany({
      where: {
        businessId: business.id,
        code: { not: null },
        deletedAt: null,
        isActive: true,
        isPrivate: false,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { categories: true },
      orderBy: { createdAt: 'desc' },
    });

    // Agotados: comparar dos columnas (usesConsumed vs maxUsesTotal) no es
    // trivial en el where de Prisma, se filtra en memoria (mismo criterio que
    // discounts.service.evaluate()).
    const vigentes = rows.filter((d) => d.maxUsesTotal == null || d.usesConsumed < d.maxUsesTotal);

    // Nombres de las categorías alcanzadas (cupones scope=CATEGORY). Se traen
    // aparte porque DiscountCategory no tiene relación directa a Category.
    const categoryIds = [...new Set(vigentes.flatMap((d) => d.categories.map((c) => c.categoryId)))];
    const nombrePorCategoria = new Map<string, string>();
    if (categoryIds.length) {
      const cats = await this.prisma.category.findMany({
        where: { id: { in: categoryIds }, businessId: business.id },
        select: { id: true, name: true },
      });
      for (const c of cats) nombrePorCategoria.set(c.id, c.name);
    }

    return vigentes.map((d) => ({
      code: d.code!,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      endDate: d.endDate ? d.endDate.toISOString() : null,
      categories: d.categories
        .map((c) => nombrePorCategoria.get(c.categoryId))
        .filter((n): n is string => !!n),
    }));
  }

  // Validaciones de vigencia compartidas entre exclusiveDiscount() (cupón, vía
  // código), discountLanding() (descuento, vía id) y listProducts() con
  // ?discountCode/?discountId — mismo criterio que
  // DiscountsService.validateCoupon() usa en el checkout.
  private async resolverDescuentoVigentePorWhere(where: Prisma.DiscountWhereInput, entidad: 'Cupón' | 'Descuento') {
    const now = new Date();
    const d = await this.prisma.discount.findFirst({
      where,
      include: { categories: true, products: true },
    });
    if (!d) throw new NotFoundException(`${entidad} no encontrado`);
    if (!d.isActive) throw new NotFoundException(`Este ${entidad.toLowerCase()} ya no está disponible`);
    if (d.startDate > now) throw new NotFoundException(`Este ${entidad.toLowerCase()} todavía no está vigente`);
    if (d.endDate && d.endDate < now) throw new NotFoundException(`Este ${entidad.toLowerCase()} ya expiró`);
    if (d.maxUsesTotal != null && d.usesConsumed >= d.maxUsesTotal) throw new NotFoundException(`Este ${entidad.toLowerCase()} agotó sus usos disponibles`);
    return d;
  }

  // Cupón — por código (el cliente lo tipea o llega en la URL del link).
  private resolverDescuentoVigente(businessId: string, code: string) {
    return this.resolverDescuentoVigentePorWhere({ businessId, code, deletedAt: null }, 'Cupón');
  }

  // Descuento — por id (nunca por código: un descuento siempre tiene
  // `code: null`, ver DiscountsService). Solo si el dueño activó el link
  // compartible (linkActive) — si no, un id adivinado no resuelve nada.
  private resolverDescuentoVigentePorId(businessId: string, id: string) {
    return this.resolverDescuentoVigentePorWhere({ businessId, id, code: null, linkActive: true, deletedAt: null }, 'Descuento');
  }

  // Resuelve un código puntual por link directo — a diferencia de
  // listCoupons() no filtra por isPrivate: el sentido de un link exclusivo es
  // justamente llegar a un cupón que NO aparece en el listado general de
  // /cupones (isPrivate:true), pero un link a un cupón público también tiene
  // que funcionar igual. Sin carrito acá todavía, así que no corre
  // evaluateCart(): esta pantalla solo muestra el cupón, el descuento real se
  // calcula recién al aplicarlo.
  async exclusiveDiscount(slug: string, code: string) {
    const business = await this.resolveBusiness(slug);
    const d = await this.resolverDescuentoVigente(business.id, code);

    const nombrePorCategoria = new Map<string, string>();
    if (d.categories.length) {
      const cats = await this.prisma.category.findMany({
        where: { id: { in: d.categories.map((c) => c.categoryId) }, businessId: business.id },
        select: { id: true, name: true },
      });
      for (const c of cats) nombrePorCategoria.set(c.id, c.name);
    }

    return {
      code: d.code!,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      // Alcance — el frontend lo usa para decidir si tiene sentido pedir
      // /products?discountCode=... (producto/categoría) o mandar directo al
      // catálogo general (ticket: aplica a toda la compra, sin productos
      // puntuales que filtrar).
      scope: d.scope,
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      endDate: d.endDate ? d.endDate.toISOString() : null,
      categories: d.categories.map((c) => nombrePorCategoria.get(c.categoryId)).filter((n): n is string => !!n),
    };
  }

  // Resuelve un DESCUENTO (no cupón — code siempre null) por link directo,
  // identificado por id. A diferencia de exclusiveDiscount() no hay código
  // para copiar/aplicar: el descuento es automático, el link solo sirve para
  // navegar directo a los productos alcanzados (ver listProducts con
  // ?discountId=). Sin destino configurable como el cupón — el alcance del
  // descuento YA define a dónde lleva.
  async discountLanding(slug: string, id: string) {
    const business = await this.resolveBusiness(slug);
    const d = await this.resolverDescuentoVigentePorId(business.id, id);

    const nombrePorCategoria = new Map<string, string>();
    if (d.categories.length) {
      const cats = await this.prisma.category.findMany({
        where: { id: { in: d.categories.map((c) => c.categoryId) }, businessId: business.id },
        select: { id: true, name: true },
      });
      for (const c of cats) nombrePorCategoria.set(c.id, c.name);
    }

    return {
      id: d.id,
      name: d.name,
      type: d.type,
      value: Number(d.value),
      scope: d.scope,
      minAmount: d.minAmount != null ? Number(d.minAmount) : null,
      endDate: d.endDate ? d.endDate.toISOString() : null,
      categories: d.categories.map((c) => nombrePorCategoria.get(c.categoryId)).filter((n): n is string => !!n),
    };
  }
}
