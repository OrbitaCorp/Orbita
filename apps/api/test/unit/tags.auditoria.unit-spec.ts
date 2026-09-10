import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TagsService } from '../../src/tags/tags.service';
import { UpsertTagDto } from '../../src/tags/dto/upsert-tag.dto';

// Auditoría interna 2026-09-10, ítem `api.tags`: nombre sin tope ni recorte, y
// duplicados que solo difieren en mayúsculas.

const BIZ = 'biz-1';

function etiquetas(opts: { repetida?: boolean; propia?: boolean } = {}) {
  const prisma = {
    tag: {
      findFirst: jest.fn(({ where }: { where: { name?: unknown } }) =>
        Promise.resolve(where.name ? (opts.repetida ? { id: 't-otra' } : null) : opts.propia === false ? null : { id: 't-1', businessId: BIZ }),
      ),
      create: jest.fn().mockResolvedValue({ id: 't-nueva' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { svc: new TagsService(prisma as any), prisma };
}

describe('Etiquetas', () => {
  it('el nombre se recorta, es obligatorio y tiene tope', async () => {
    expect(plainToInstance(UpsertTagDto, { name: '  verano  ' }).name).toBe('verano');
    const props = async (body: object) => (await validate(plainToInstance(UpsertTagDto, body))).map((e) => e.property);
    expect(await props({ name: '   ' })).toContain('name');
    expect(await props({ name: 'x'.repeat(41) })).toContain('name');
    expect(await props({ name: 'nuevo ingreso' })).toEqual([]);
  });

  it('"Verano" y "verano" no conviven: el duplicado se busca sin distinguir mayúsculas', async () => {
    const { svc, prisma } = etiquetas({ repetida: true });
    await expect(svc.create(BIZ, { name: 'VERANO' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tag.findFirst).toHaveBeenCalledWith({
      where: { businessId: BIZ, name: { equals: 'VERANO', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(prisma.tag.create).not.toHaveBeenCalled();
  });

  it('renombrar una etiqueta a su propio nombre con otra capitalización no choca consigo misma', async () => {
    const { svc, prisma } = etiquetas();
    await svc.update(BIZ, 't-1', { name: 'Verano' });
    expect(prisma.tag.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { not: 't-1' } }) }));
    expect(prisma.tag.updateMany).toHaveBeenCalledWith({ where: { id: 't-1', businessId: BIZ }, data: { name: 'Verano' } });
  });

  it('una etiqueta de otro negocio da 404', async () => {
    const { svc } = etiquetas({ propia: false });
    await expect(svc.update(BIZ, 't-ajena', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
