import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { AddImageDto } from './dto/add-image.dto';

const PRODUCT_IMAGES_BUCKET = 'product-images';

const productDetailInclude = {
  productTags: { include: { tag: true } },
  options: { include: { values: { orderBy: { position: 'asc' as const } } }, orderBy: { position: 'asc' as const } },
  variants: {
    include: {
      optionValues: { include: { optionValue: true } },
      stock: true,
    },
  },
  images: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.ProductInclude;

type ProductWithDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  // ── Listado ──────────────────────────────────────────────────────────────

  async findAll(businessId: string, query: FindProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // "Sin stock" es un estado de la UI, no un ProductStatus: se traduce a
    // "todas las variantes con todo su stock en cero". Pasarlo crudo como
    // `status` reventaría el enum de Prisma.
    const filtroEstado: Prisma.ProductWhereInput =
      query.status === 'OUT_OF_STOCK'
        ? { variants: { every: { stock: { every: { quantity: 0 } } } } }
        : query.status
          ? { status: query.status }
          : {};

    // La búsqueda cubre nombre y SKU de cualquiera de sus variantes (RBT-304):
    // el dueño busca tanto por lo que ve en la tienda como por el código interno.
    const where: Prisma.ProductWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...filtroEstado,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { variants: { some: { sku: { contains: query.search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          variants: { select: { id: true, stock: { select: { quantity: true } } } },
          // Se traen todas (no `take:1` filtrado por isPrimary): si el producto
          // es puramente de variantes y nunca se marcó una principal a mano,
          // igual hay que poder resolver una — ver pickPrimaryImageUrl().
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
        basePrice: Number(p.basePrice),
        comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
        cost: p.cost ? Number(p.cost) : null,
        status: p.status,
        totalStock: p.variants.reduce((sum, v) => sum + v.stock.reduce((s, st) => s + st.quantity, 0), 0),
        variantCount: p.variants.length,
        primaryImageUrl: this.pickPrimaryImageUrl(p.images),
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  // ── Detalle ──────────────────────────────────────────────────────────────

  async findOne(businessId: string, id: string) {
    const product = await this.findOneRaw(businessId, id);
    return this.toDetailResponse(product);
  }

  // ── Crear (transacción completa) ────────────────────────────────────────

  async create(businessId: string, dto: CreateProductDto) {
    if (dto.categoryId) await this.validateCategory(businessId, dto.categoryId);
    if (dto.tagIds?.length) await this.validateTags(businessId, dto.tagIds);
    this.validateVariantShape(dto);
    this.validateVisualOption(dto);

    const defaultBranch = await this.getDefaultBranch(businessId);

    const productId = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId,
          categoryId: dto.categoryId ?? null,
          name: dto.name,
          description: dto.description ?? null,
          basePrice: dto.basePrice,
          comparePrice: dto.comparePrice ?? null,
          cost: dto.cost ?? null,
          status: dto.status ?? 'DRAFT',
        },
      });

      // Opciones + valores, en el mismo orden que llegaron (la correspondencia
      // posicional con variant.optionValues depende de este orden).
      const createdOptions: { id: string; values: { id: string; value: string }[] }[] = [];
      for (const [i, opt] of (dto.options ?? []).entries()) {
        const option = await tx.productOption.create({
          data: { productId: product.id, name: opt.name, position: i, isVisual: opt.isVisual ?? false },
        });
        const values: { id: string; value: string }[] = [];
        for (const [j, value] of opt.values.entries()) {
          const created = await tx.productOptionValue.create({
            data: { optionId: option.id, value, position: j },
          });
          values.push({ id: created.id, value: created.value });
        }
        createdOptions.push({ id: option.id, values });
      }

      // Sin variantes explícitas (producto sin variación): se crea una única
      // variante isDefault que hereda basePrice/comparePrice del producto,
      // con stock inicial en 0 (se carga después desde Inventario).
      const variantInputs =
        dto.variants.length > 0
          ? dto.variants
          : [{ price: dto.basePrice, comparePrice: dto.comparePrice, optionValues: [], initialStock: 0, stockMin: 0 }];
      const isSingleDefault = dto.variants.length === 0;

      for (const v of variantInputs) {
        const optionValueIds = this.resolveOptionValueIds(v.optionValues, createdOptions);
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: v.sku ?? null,
            price: v.price,
            comparePrice: v.comparePrice ?? null,
            isDefault: isSingleDefault,
            isActive: v.isActive ?? true,
          },
        });
        if (optionValueIds.length > 0) {
          await tx.variantOptionValue.createMany({
            data: optionValueIds.map((optionValueId) => ({ variantId: variant.id, optionValueId })),
          });
        }
        await tx.variantStock.create({
          data: {
            variantId: variant.id,
            branchId: defaultBranch.id,
            quantity: v.initialStock ?? 0,
            stockMin: v.stockMin ?? 0,
          },
        });
      }

      if (dto.tagIds?.length) {
        await tx.productTag.createMany({
          data: dto.tagIds.map((tagId) => ({ productId: product.id, tagId })),
        });
      }

      return product.id;
    });

    return this.findOne(businessId, productId);
  }

  // ── Actualizar ───────────────────────────────────────────────────────────
  // Reconcilia el producto entero: opciones/valores, variantes y stock.
  //
  // Criterios (RBT-302 los dejaba abiertos en el contrato):
  //  · Opciones y valores se matchean por NOMBRE, no por id — el wizard del
  //    panel trabaja con strings ("Talle" → ["S","M"]) y no arrastra ids.
  //  · Nunca se borra algo con historial: ProductVariant tiene
  //    orderItems/stockMovements sin onDelete:Cascade. Una variante ausente del
  //    body se borra SOLO si nunca se vendió ni tuvo movimientos; si tiene
  //    historial se conserva, para no romper pedidos ni reportes viejos.
  //  · El stock no se pisa a mano: si cambia la cantidad de una variante que ya
  //    existía se registra un movimiento de AJUSTE con el delta, igual que
  //    hace Inventario (ver inventory.service.ts → applyMovement).

  async update(businessId: string, memberId: string, id: string, dto: CreateProductDto) {
    const existing = await this.findOneRaw(businessId, id);
    if (dto.categoryId) await this.validateCategory(businessId, dto.categoryId);
    if (dto.tagIds?.length) await this.validateTags(businessId, dto.tagIds);
    this.validateVariantOwnership(dto, existing);
    this.validateVariantShape(dto);
    this.validateVisualOption(dto);

    const defaultBranch = await this.getDefaultBranch(businessId);
    const existingVariantIds = new Set(existing.variants.map((v) => v.id));

    // Variantes que el body ya no incluye. Se decide fuera de la transacción
    // cuáles son borrables (sin ventas ni movimientos) para no anidar queries.
    const idsEnDto = new Set(dto.variants.map((v) => v.id).filter((x): x is string => !!x));
    const borrables: string[] = [];
    for (const v of existing.variants.filter((v) => !idsEnDto.has(v.id))) {
      const [ventas, movimientos] = await Promise.all([
        this.prisma.orderItem.count({ where: { variantId: v.id } }),
        this.prisma.stockMovement.count({ where: { variantId: v.id } }),
      ]);
      if (ventas === 0 && movimientos === 0) borrables.push(v.id);
    }

    await this.prisma.$transaction(async (tx) => {
      // businessId va en el where del updateMany, dentro de la misma tx — no
      // depende del findOneRaw de arriba para el aislamiento.
      const { count } = await tx.product.updateMany({
        where: { id, businessId },
        data: {
          categoryId: dto.categoryId ?? null,
          name: dto.name,
          description: dto.description ?? null,
          basePrice: dto.basePrice,
          comparePrice: dto.comparePrice ?? null,
          cost: dto.cost ?? null,
          status: dto.status ?? undefined,
        },
      });
      if (count === 0) throw new NotFoundException('Producto no encontrado');

      await tx.productTag.deleteMany({ where: { productId: id } });
      if (dto.tagIds?.length) {
        await tx.productTag.createMany({ data: dto.tagIds.map((tagId) => ({ productId: id, tagId })) });
      }

      // 1. Opciones y valores: se reusan los que ya existían con el mismo
      //    nombre/valor (así las imágenes ya asociadas no pierden su vínculo).
      const opciones: { id: string; values: { id: string; value: string }[] }[] = [];
      for (const [i, opt] of (dto.options ?? []).entries()) {
        const previa = existing.options.find((o) => o.name === opt.name);
        const isVisual = opt.isVisual ?? false;
        const optionId = previa
          ? (await tx.productOption.update({ where: { id: previa.id }, data: { position: i, isVisual } })).id
          : (await tx.productOption.create({ data: { productId: id, name: opt.name, position: i, isVisual } })).id;

        const values: { id: string; value: string }[] = [];
        for (const [j, value] of opt.values.entries()) {
          const previo = previa?.values.find((v) => v.value === value);
          const valueId = previo
            ? (await tx.productOptionValue.update({ where: { id: previo.id }, data: { position: j } })).id
            : (await tx.productOptionValue.create({ data: { optionId, value, position: j } })).id;
          values.push({ id: valueId, value });
        }
        opciones.push({ id: optionId, values });
      }

      // 2. Variantes que ya no van y no tienen historial.
      if (borrables.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: borrables }, productId: id } });
      }

      // 3. Alta/edición de variantes.
      for (const v of dto.variants) {
        if (v.id && existingVariantIds.has(v.id)) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: { sku: v.sku ?? null, price: v.price, comparePrice: v.comparePrice ?? null, isActive: v.isActive ?? true },
          });
          await this.syncStock(tx, {
            businessId,
            memberId,
            variantId: v.id,
            branchId: defaultBranch.id,
            target: v.initialStock,
            stockMin: v.stockMin,
          });
          continue;
        }

        const optionValueIds = this.resolveOptionValueIds(v.optionValues, opciones);
        const variant = await tx.productVariant.create({
          data: {
            productId: id,
            sku: v.sku ?? null,
            price: v.price,
            comparePrice: v.comparePrice ?? null,
            isDefault: false,
            isActive: v.isActive ?? true,
          },
        });
        if (optionValueIds.length > 0) {
          await tx.variantOptionValue.createMany({
            data: optionValueIds.map((optionValueId) => ({ variantId: variant.id, optionValueId })),
          });
        }
        await tx.variantStock.create({
          data: {
            variantId: variant.id,
            branchId: defaultBranch.id,
            quantity: v.initialStock ?? 0,
            stockMin: v.stockMin ?? 0,
          },
        });
      }

      // 4. Barrer opciones/valores que quedaron sin uso. Los que todavía están
      //    referenciados por una variante o una imagen se conservan (además el
      //    FK los protegería igual).
      const NINGUNO = '00000000-0000-0000-0000-000000000000';
      const idsValores = opciones.flatMap((o) => o.values.map((v) => v.id));
      await tx.productOptionValue.deleteMany({
        where: {
          option: { productId: id },
          id: { notIn: idsValores.length > 0 ? idsValores : [NINGUNO] },
          variantOptionValues: { none: {} },
          images: { none: {} },
        },
      });
      const idsOpciones = opciones.map((o) => o.id);
      await tx.productOption.deleteMany({
        where: {
          productId: id,
          id: { notIn: idsOpciones.length > 0 ? idsOpciones : [NINGUNO] },
          values: { none: {} },
        },
      });
    });

    return this.findOne(businessId, id);
  }

  async remove(businessId: string, id: string) {
    await this.findOneRaw(businessId, id);
    const { count } = await this.prisma.product.updateMany({
      where: { id, businessId },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Producto no encontrado');
    return { ok: true };
  }

  // ── Métricas del encabezado (RBT-304) ────────────────────────────────────

  // "Sin stock" y "valor de inventario" no se pueden resolver con un count():
  // dependen de sumar el stock de todas las sucursales por variante. Se traen
  // los campos mínimos (stock + costo/precio) y se agrega en memoria, en vez de
  // hacer una query por producto.
  async stats(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, deletedAt: null },
      select: {
        status: true,
        cost: true,
        basePrice: true,
        variants: { select: { price: true, stock: { select: { quantity: true } } } },
      },
    });

    let publicados = 0;
    let borradores = 0;
    let sinStock = 0;
    let valorInventario = 0;

    for (const p of products) {
      if (p.status === 'PUBLISHED') publicados++;
      else borradores++;

      let stockProducto = 0;
      for (const v of p.variants) {
        const stockVariante = v.stock.reduce((s, st) => s + st.quantity, 0);
        stockProducto += stockVariante;
        // Valor a costo (lo que hay invertido en mercadería). Si el producto no
        // tiene costo cargado se usa el precio de la variante como aproximación
        // — decisión acordada con el usuario, ver PENDIENTES.md.
        const unitario = p.cost !== null ? Number(p.cost) : Number(v.price);
        valorInventario += stockVariante * unitario;
      }
      if (stockProducto === 0) sinStock++;
    }

    return {
      total: products.length,
      publicados,
      borradores,
      sinStock,
      valorInventario: Math.round(valorInventario * 100) / 100,
    };
  }

  // ── Duplicar (RBT-302) ───────────────────────────────────────────────────

  // Clona el producto entero (opciones, valores, variantes, imágenes y tags).
  // Nace como DRAFT y con stock en 0: es un producto nuevo, no una copia del
  // inventario del original.
  async duplicate(businessId: string, id: string) {
    const original = await this.findOneRaw(businessId, id);
    const defaultBranch = await this.getDefaultBranch(businessId);

    const newId = await this.prisma.$transaction(async (tx) => {
      const copia = await tx.product.create({
        data: {
          businessId,
          categoryId: original.categoryId,
          name: `${original.name} (copia)`,
          description: original.description,
          basePrice: original.basePrice,
          comparePrice: original.comparePrice,
          cost: original.cost,
          status: 'DRAFT',
        },
      });

      // Mapa optionValueId original → nuevo, para reapuntar variantes e imágenes.
      const valueIdMap = new Map<string, string>();
      for (const opt of original.options) {
        const nuevaOpcion = await tx.productOption.create({
          data: { productId: copia.id, name: opt.name, position: opt.position, isVisual: opt.isVisual },
        });
        for (const val of opt.values) {
          const nuevoValor = await tx.productOptionValue.create({
            data: { optionId: nuevaOpcion.id, value: val.value, position: val.position },
          });
          valueIdMap.set(val.id, nuevoValor.id);
        }
      }

      for (const v of original.variants) {
        const nuevaVariante = await tx.productVariant.create({
          data: {
            productId: copia.id,
            sku: v.sku ? `${v.sku}-COPIA` : null,
            price: v.price,
            comparePrice: v.comparePrice,
            isDefault: v.isDefault,
            isActive: v.isActive,
          },
        });
        const nuevosValores = v.optionValues
          .map((ov) => valueIdMap.get(ov.optionValueId))
          .filter((x): x is string => !!x);
        if (nuevosValores.length > 0) {
          await tx.variantOptionValue.createMany({
            data: nuevosValores.map((optionValueId) => ({ variantId: nuevaVariante.id, optionValueId })),
          });
        }
        await tx.variantStock.create({
          data: {
            variantId: nuevaVariante.id,
            branchId: defaultBranch.id,
            quantity: 0,
            stockMin: v.stock[0]?.stockMin ?? 0,
          },
        });
      }

      // Las imágenes se reusan por URL (no se copia el archivo en Storage): son
      // públicas e inmutables. Ojo al borrar: ver PENDIENTES.md.
      for (const img of original.images) {
        await tx.productImage.create({
          data: {
            productId: copia.id,
            optionValueId: img.optionValueId ? (valueIdMap.get(img.optionValueId) ?? null) : null,
            url: img.url,
            position: img.position,
            isPrimary: img.isPrimary,
          },
        });
      }

      if (original.productTags.length > 0) {
        await tx.productTag.createMany({
          data: original.productTags.map((pt) => ({ productId: copia.id, tagId: pt.tagId })),
        });
      }

      return copia.id;
    });

    return this.findOne(businessId, newId);
  }

  // ── Imágenes ─────────────────────────────────────────────────────────────

  async addImage(
    businessId: string,
    productId: string,
    dto: AddImageDto,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    await this.findOneRaw(businessId, productId);
    if (dto.optionValueId) await this.validateOptionValue(productId, dto.optionValueId);

    // Se convierte a webp ANTES de subir — nunca se persiste el archivo
    // original en Storage, así que no hace falta un paso aparte de "borrar el
    // original": simplemente nunca se sube. Reduce bastante el peso (catálogos
    // con decenas de fotos) y estandariza el formato servido a la tienda.
    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(file.buffer).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException('El archivo no es una imagen válida o está corrupto');
    }

    const path = `${businessId}/${productId}/${randomUUID()}.webp`;

    const { error: uploadError } = await this.supabase.adminClient.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, webpBuffer, { contentType: 'image/webp', upsert: false });
    if (uploadError) {
      throw new BadRequestException(`No se pudo subir la imagen: ${uploadError.message}`);
    }

    const { data: publicUrl } = this.supabase.adminClient.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(path);

    const maxPosition = await this.prisma.productImage.aggregate({
      where: { productId },
      _max: { position: true },
    });

    const isPrimary = dto.isPrimary ?? false;
    if (isPrimary) {
      await this.prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
    }

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        optionValueId: dto.optionValueId ?? null,
        url: publicUrl.publicUrl,
        position: (maxPosition._max.position ?? -1) + 1,
        isPrimary,
      },
    });

    return {
      id: image.id,
      url: image.url,
      position: image.position,
      isPrimary: image.isPrimary,
      optionValueId: image.optionValueId,
    };
  }

  async removeImage(businessId: string, productId: string, imageId: string) {
    await this.findOneRaw(businessId, productId);
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException('Imagen no encontrada');

    // Best-effort: si falla el borrado en Storage no bloqueamos el borrado
    // del registro (evita imágenes "zombie" en la UI por un error de red).
    const path = this.extractStoragePath(image.url);
    if (path) {
      await this.supabase.adminClient.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]).catch(() => {});
    }

    // ProductImage no tiene businessId propio (solo productId) — el where lleva
    // productId además de id, así el aislamiento no depende únicamente del
    // findFirst de arriba. productId a su vez ya fue validado contra businessId
    // por el findOneRaw() al inicio de este método.
    const { count } = await this.prisma.productImage.deleteMany({ where: { id: imageId, productId } });
    if (count === 0) throw new NotFoundException('Imagen no encontrada');
    return { ok: true };
  }

  async reorderImages(businessId: string, productId: string, dto: ReorderImagesDto) {
    await this.findOneRaw(businessId, productId);

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.productImage.updateMany({
          where: { id: item.id, productId },
          data: { position: item.position },
        });
      }
      if (dto.primaryId) {
        await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
        await tx.productImage.updateMany({
          where: { id: dto.primaryId, productId },
          data: { isPrimary: true },
        });
      }
    });

    return { ok: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Deja el stock de una variante existente en `target`, registrando la
  // diferencia como movimiento de AJUSTE para que Inventario siga cuadrando.
  // Si `target` viene undefined, solo se toca el umbral de alerta.
  private async syncStock(
    tx: Prisma.TransactionClient,
    input: {
      businessId: string;
      memberId: string;
      variantId: string;
      branchId: string;
      target?: number;
      stockMin?: number;
    },
  ) {
    const actual = await tx.variantStock.findUnique({
      where: { variantId_branchId: { variantId: input.variantId, branchId: input.branchId } },
    });

    if (!actual) {
      await tx.variantStock.create({
        data: {
          variantId: input.variantId,
          branchId: input.branchId,
          quantity: input.target ?? 0,
          stockMin: input.stockMin ?? 0,
        },
      });
      return;
    }

    const nuevoMin = input.stockMin ?? actual.stockMin;
    const delta = input.target === undefined ? 0 : input.target - actual.quantity;

    await tx.variantStock.update({
      where: { id: actual.id },
      data: { quantity: actual.quantity + delta, stockMin: nuevoMin },
    });

    if (delta !== 0) {
      await tx.stockMovement.create({
        data: {
          businessId: input.businessId,
          branchId: input.branchId,
          variantId: input.variantId,
          type: 'AJUSTE',
          quantity: delta,
          reason: 'Ajuste manual desde la edición del producto',
          createdBy: input.memberId,
        },
      });
    }
  }

  private async findOneRaw(businessId: string, id: string): Promise<ProductWithDetail> {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId, deletedAt: null },
      include: productDetailInclude,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  private toDetailResponse(p: ProductWithDetail) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      basePrice: Number(p.basePrice),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      cost: p.cost ? Number(p.cost) : null,
      status: p.status,
      tags: p.productTags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name })),
      options: p.options.map((o) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        isVisual: o.isVisual,
        values: o.values.map((v) => ({ id: v.id, value: v.value, position: v.position })),
      })),
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: Number(v.price),
        comparePrice: v.comparePrice ? Number(v.comparePrice) : null,
        isDefault: v.isDefault,
        isActive: v.isActive,
        optionValues: v.optionValues.map((ov) => ({
          optionValueId: ov.optionValueId,
          value: ov.optionValue.value,
        })),
        stock: v.stock.map((s) => ({ branchId: s.branchId, quantity: s.quantity, stockMin: s.stockMin })),
      })),
      images: p.images.map((img) => ({
        id: img.id,
        url: img.url,
        position: img.position,
        isPrimary: img.isPrimary,
        optionValueId: img.optionValueId,
      })),
    };
  }

  private async validateCategory(businessId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, businessId } });
    if (!category) throw new UnprocessableEntityException('Categoría inexistente');
  }

  private async validateTags(businessId: string, tagIds: string[]) {
    const found = await this.prisma.tag.findMany({ where: { id: { in: tagIds }, businessId } });
    if (found.length !== new Set(tagIds).size) {
      throw new BadRequestException('Uno o más tags no pertenecen a este negocio');
    }
  }

  // Las fotos por variante solo tienen sentido en la dimensión "visual" del
  // producto (ej. Color) — asociar una foto a un valor de Talle no tiene
  // sentido visual y confunde en la tienda. Se valida acá además de en el
  // wizard: el wizard ya filtra qué opción ofrece, pero un body armado a mano
  // no debería poder saltearse esa regla.
  private async validateOptionValue(productId: string, optionValueId: string) {
    const value = await this.prisma.productOptionValue.findFirst({
      where: { id: optionValueId, option: { productId } },
      include: { option: { select: { isVisual: true } } },
    });
    if (!value) throw new BadRequestException('optionValueId inválido para este producto');
    if (!value.option.isVisual) {
      throw new BadRequestException(
        'Este valor de opción no pertenece a la dimensión visual del producto (la única que admite fotos)',
      );
    }
  }

  // A lo sumo una opción del producto puede ser la "visual" (con fotos).
  private validateVisualOption(dto: CreateProductDto) {
    const visuales = (dto.options ?? []).filter((o) => o.isVisual);
    if (visuales.length > 1) {
      throw new BadRequestException('Solo una opción puede ser la dimensión visual (con fotos) del producto');
    }
  }

  // Las variantes que llegan con `id` (edición) no necesitan reenviar sus
  // optionValues: su combinación ya está persistida y no se reasigna.
  private validateVariantShape(dto: CreateProductDto) {
    const optionCount = dto.options?.length ?? 0;
    if (optionCount === 0) return;
    for (const v of dto.variants) {
      if (v.id) continue;
      if (v.optionValues.length !== optionCount) {
        throw new BadRequestException(
          `Cada variante debe definir exactamente ${optionCount} valor(es) de opción (uno por cada opción, en el mismo orden)`,
        );
      }
    }
  }

  // variant.optionValues es un array de strings ["M","Negro"] en el mismo
  // orden posicional que dto.options — no vienen tipados por optionId.
  private resolveOptionValueIds(
    optionValues: string[],
    createdOptions: { id: string; values: { id: string; value: string }[] }[],
  ): string[] {
    return optionValues.map((val, i) => {
      const option = createdOptions[i];
      const match = option?.values.find((v) => v.value === val);
      if (!match) {
        throw new BadRequestException(`Valor de opción "${val}" no encontrado en la opción correspondiente`);
      }
      return match.id;
    });
  }

  // Un `id` de variante que no sea de ESTE producto se rechaza en vez de caer
  // silenciosamente en la rama de "crear nueva": evita que un body armado a
  // mano toque variantes de otro producto (o de otro negocio).
  private validateVariantOwnership(dto: CreateProductDto, existing: ProductWithDetail) {
    const propias = new Set(existing.variants.map((v) => v.id));
    for (const v of dto.variants) {
      if (v.id && !propias.has(v.id)) {
        throw new BadRequestException(`La variante ${v.id} no pertenece a este producto`);
      }
    }
  }

  private async getDefaultBranch(businessId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { businessId, isDefault: true } });
    if (!branch) throw new UnprocessableEntityException('El negocio no tiene una sucursal principal configurada');
    return branch;
  }

  private extractStoragePath(url: string): string | null {
    const marker = `/${PRODUCT_IMAGES_BUCKET}/`;
    const idx = url.indexOf(marker);
    return idx === -1 ? null : url.slice(idx + marker.length);
  }

  // Resuelve qué imagen mostrar como principal cuando nadie marcó una a mano
  // — típico en productos puramente de variantes (ej. solo talles, sin fotos
  // generales) donde el dueño nunca pasó por el picker de "principal". Orden
  // de preferencia: (1) la marcada isPrimary, (2) la primera foto GENERAL
  // (sin optionValueId), (3) la primera foto de variante que exista.
  private pickPrimaryImageUrl(
    images: { url: string; isPrimary: boolean; optionValueId: string | null }[],
  ): string | null {
    return (images.find((i) => i.isPrimary) ?? images.find((i) => !i.optionValueId) ?? images[0])?.url ?? null;
  }
}
