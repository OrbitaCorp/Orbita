import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertTagDto } from './dto/upsert-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  // Devuelve además en cuántos productos se usa cada etiqueta: el wizard las
  // ofrece como sugerencia y las más usadas van primero (a igual uso, alfabético).
  async findAll(businessId: string) {
    const tags = await this.prisma.tag.findMany({
      where: { businessId },
      include: { _count: { select: { productTags: true } } },
      orderBy: { name: 'asc' },
    });

    return tags
      .map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt.toISOString(),
        usageCount: t._count.productTags,
      }))
      .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));
  }

  async create(businessId: string, dto: UpsertTagDto) {
    try {
      return await this.prisma.tag.create({ data: { businessId, name: dto.name } });
    } catch (err) {
      throw this.mapNameConflict(err);
    }
  }

  async update(businessId: string, id: string, dto: UpsertTagDto) {
    await this.findOneRaw(businessId, id);

    // businessId va en el where del updateMany, no solo en el findOneRaw previo —
    // la query tiene que garantizar el aislamiento por sí misma.
    let result: Prisma.BatchPayload;
    try {
      result = await this.prisma.tag.updateMany({ where: { id, businessId }, data: { name: dto.name } });
    } catch (err) {
      throw this.mapNameConflict(err);
    }
    if (result.count === 0) throw new NotFoundException('Tag no encontrado');
    return this.findOneRaw(businessId, id);
  }

  async remove(businessId: string, id: string) {
    await this.findOneRaw(businessId, id);
    // product_tags tiene onDelete: Cascade — no queda huérfano.
    const { count } = await this.prisma.tag.deleteMany({ where: { id, businessId } });
    if (count === 0) throw new NotFoundException('Tag no encontrado');
    return { ok: true };
  }

  private async findOneRaw(businessId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, businessId } });
    if (!tag) throw new NotFoundException('Tag no encontrado');
    return tag;
  }

  private mapNameConflict(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestException('Ya existe un tag con ese nombre en este negocio');
    }
    throw err as Error;
  }
}
