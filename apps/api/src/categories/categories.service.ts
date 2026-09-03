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

  async reorder(businessId: string, dto: ReorderCategoriesDto) {
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
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');
  }

  private mapSlugConflict(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Ya existe una categoría con ese slug en este negocio');
    }
    throw err as Error;
  }
}
