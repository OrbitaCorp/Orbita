import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pickPrimaryImageUrl, orderedImageUrls } from '../common/utils/product-image.util';
import { StorefrontProductsQueryDto } from './dto/storefront-products-query.dto';

// Un negocio pausado o inactivo no debería ni resolver — mismo criterio que
// "no revelar de más" que ya usa auth.service.ts con businessSlug.
const NOT_FOUND = () => new NotFoundException('Negocio no encontrado');

@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  // Mismo patrón usado 5+ veces en auth.service.ts: el slug de la URL nunca
  // trae businessId ni pasa por AuthGuard (rutas @Public()), así que cada
  // método público lo resuelve acá.
  private async resolveBusiness(slug: string) {
    const business = await this.prisma.business.findUnique({ where: { subdomain: slug } });
    if (!business) throw NOT_FOUND();
    return business;
  }

  // ── Config (branding + apariencia + contacto) ───────────────────────────

  async getConfig(slug: string) {
    const business = await this.resolveBusiness(slug);

    const [appearance, contact] = await Promise.all([
      this.prisma.storefrontConfig.findUnique({ where: { businessId: business.id } }),
      this.prisma.businessConfig.findUnique({ where: { businessId: business.id } }),
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
            ctaText: appearance.ctaText,
            shippingText: appearance.shippingText,
            whatsappText: appearance.whatsappText,
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
    };
  }

  // ── Productos ────────────────────────────────────────────────────────────

  // El storefront público muestra PUBLISHED y OUT_OF_STOCK (que un producto
  // esté sin stock es información útil para el comprador, no algo que
  // esconder) — oculta solo DRAFT y soft-deleted. Ver PENDIENTES.md.
  async listProducts(slug: string, query: StorefrontProductsQueryDto) {
    const business = await this.resolveBusiness(slug);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      businessId: business.id,
      deletedAt: null,
      status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.featured ? { isFeatured: true } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          variants: { select: { stock: { select: { quantity: true } } } },
          images: { select: { url: true, isPrimary: true, optionValueId: true }, orderBy: { position: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        price: Number(p.basePrice),
        comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
        imageUrl: pickPrimaryImageUrl(p.images),
        images: orderedImageUrls(p.images),
        isFeatured: p.isFeatured,
        inStock: p.variants.some((v) => v.stock.some((s) => s.quantity > 0)),
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async getProduct(slug: string, id: string) {
    const business = await this.resolveBusiness(slug);

    const product = await this.prisma.product.findFirst({
      where: { id, businessId: business.id, deletedAt: null, status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } },
      include: {
        category: { select: { id: true, name: true } },
        productTags: { include: { tag: true } },
        options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        variants: {
          where: { isActive: true },
          include: { optionValues: { include: { optionValue: true } }, stock: { select: { quantity: true } } },
        },
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      // Sin `cost`: es información privada de margen, no debe salir por una
      // ruta pública. Ver decisión documentada en PENDIENTES.md.
      price: Number(product.basePrice),
      comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
      isFeatured: product.isFeatured,
      tags: product.productTags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name })),
      options: product.options.map((o) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        isVisual: o.isVisual,
        values: o.values.map((v) => ({ id: v.id, value: v.value, position: v.position })),
      })),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: Number(v.price),
        comparePrice: v.comparePrice ? Number(v.comparePrice) : null,
        isDefault: v.isDefault,
        optionValues: v.optionValues.map((ov) => ({ optionValueId: ov.optionValueId, value: ov.optionValue.value })),
        // Booleano, no cantidad exacta: no exponer stock real al público.
        inStock: v.stock.some((s) => s.quantity > 0),
      })),
      images: product.images.map((img) => ({
        url: img.url,
        position: img.position,
        isPrimary: img.isPrimary,
        optionValueId: img.optionValueId,
      })),
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
}
