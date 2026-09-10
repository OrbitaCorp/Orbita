import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCategoryDto } from './dto/upsert-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
  position: number;
  productCount: number;
}

// Recorre hacia arriba desde cada categoría: si vuelve a pasar por una que ya
// vio, hay un ciclo (A→B→A). Antes solo se frenaba A→A en update() y reorder
// no validaba nada (auditoría interna 10/09, ítem `api.categories`). Con un
// ciclo, las categorías involucradas desaparecen del árbol del panel y de la
// tienda, y cualquier recorrido hacia arriba (migas de pan) no termina.
function assertSinCiclos(padreDe: Map<string, string | null>) {
  for (const inicio of padreDe.keys()) {
    const vistas = new Set<string>();
    let actual: string | null = inicio;
    while (actual) {
      if (vistas.has(actual)) {
        throw new BadRequestException('Ese cambio arma un ciclo entre categorías (una terminaría siendo madre de sí misma)');
      }
      vistas.add(actual);
      actual = padreDe.get(actual) ?? null;
    }
  }
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(businessId: string, flat?: boolean) {
    const categories = await this.prisma.category.findMany({
      where: { businessId },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    const mapped: CategoryListItem[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      imageUrl: c.imageUrl,
      parentId: c.parentId,
      isActive: c.isActive,
      position: c.position,
      productCount: c._count.products,
    }));

    return flat ? mapped : this.buildTree(mapped, null);
  }

  async create(businessId: string, dto: UpsertCategoryDto) {
    if (dto.parentId) await this.validateParent(businessId, dto.parentId);
    const slug = this.resolveSlug(dto);

    try {
      return await this.prisma.category.create({
        data: {
          businessId,
          name: dto.name,
          slug,
          icon: dto.icon ?? null,
          color: dto.color ?? null,
          imageUrl: dto.imageUrl ?? null,
          parentId: dto.parentId ?? null,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (err) {
      throw this.mapSlugConflict(err);
    }
  }

  async update(businessId: string, id: string, dto: UpsertCategoryDto) {
    await this.findOneRaw(businessId, id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Una categoría no puede ser su propia categoría padre');
      }
      await this.validateParent(businessId, dto.parentId);
      const padreDe = await this.mapaDePadres(businessId);
      padreDe.set(id, dto.parentId);
      assertSinCiclos(padreDe);
    }
    const slug = this.resolveSlug(dto);

    // businessId va en el where del updateMany — no depende del findOneRaw previo,
    // la query tiene que garantizar el aislamiento por sí misma.
    let result: Prisma.BatchPayload;
    try {
      result = await this.prisma.category.updateMany({
        where: { id, businessId },
        data: {
          name: dto.name,
          slug,
          icon: dto.icon ?? null,
          color: dto.color ?? null,
          imageUrl: dto.imageUrl ?? null,
          parentId: dto.parentId ?? null,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (err) {
      throw this.mapSlugConflict(err);
    }
    if (result.count === 0) throw new NotFoundException('Categoría no encontrada');
    return this.findOneRaw(businessId, id);
  }

  async remove(businessId: string, id: string) {
    await this.findOneRaw(businessId, id);

    const [productCount, childrenCount] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id, businessId, deletedAt: null } }),
      this.prisma.category.count({ where: { parentId: id, businessId } }),
    ]);
    if (productCount > 0 || childrenCount > 0) {
      throw new UnprocessableEntityException(
        'No se puede eliminar: tiene productos o subcategorías asociadas',
      );
    }

    const { count } = await this.prisma.category.deleteMany({ where: { id, businessId } });
    if (count === 0) throw new NotFoundException('Categoría no encontrada');
    return { ok: true };
  }

  // Antes el parentId de cada ítem se escribía sin mirar: se podía colgar una
  // categoría de una de OTRO negocio o armar un ciclo. Ahora cada id y cada
  // padre tienen que ser del negocio, y el resultado no puede tener ciclos
  // (auditoría interna 10/09, ítem `api.categories`).
  async reorder(businessId: string, dto: ReorderCategoriesDto) {
    const padreDe = await this.mapaDePadres(businessId);
    for (const item of dto.items) {
      if (!padreDe.has(item.id)) throw new NotFoundException('Categoría no encontrada');
      if (item.parentId && !padreDe.has(item.parentId)) throw new BadRequestException('Categoría padre inválida');
    }
    for (const item of dto.items) padreDe.set(item.id, item.parentId ?? null);
    assertSinCiclos(padreDe);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.category.updateMany({
          where: { id: item.id, businessId },
          data: { position: item.position, parentId: item.parentId ?? null },
        }),
      ),
    );
    return { ok: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private buildTree(flat: CategoryListItem[], parentId: string | null): (CategoryListItem & { children: unknown[] })[] {
    return flat
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: this.buildTree(flat, c.id) }));
  }

  // id → padre de todas las categorías del negocio (son pocas: 12 como mucho
  // en producción al 10/09).
  private async mapaDePadres(businessId: string): Promise<Map<string, string | null>> {
    const todas = await this.prisma.category.findMany({ where: { businessId }, select: { id: true, parentId: true } });
    return new Map(todas.map((c) => [c.id, c.parentId]));
  }

  private async validateParent(businessId: string, parentId: string) {
    const parent = await this.prisma.category.findFirst({ where: { id: parentId, businessId } });
    if (!parent) throw new BadRequestException('Categoría padre inválida');
  }

  private async findOneRaw(businessId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, businessId } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  private resolveSlug(dto: UpsertCategoryDto): string {
    const raw = dto.slug?.trim() || dto.name;
    const slug = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');
    // Un nombre hecho solo de emojis o signos ("!!!") dejaba el slug vacío, y
    // la segunda categoría así chocaba contra la unique con un error confuso.
    if (!slug) throw new BadRequestException('El nombre (o el slug) tiene que tener al menos una letra o un número');
    return slug;
  }

  private mapSlugConflict(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Ya existe una categoría con ese slug en este negocio');
    }
    throw err as Error;
  }
}
