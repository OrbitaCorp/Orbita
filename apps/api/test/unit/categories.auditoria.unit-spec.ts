import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CategoriesService } from '../../src/categories/categories.service';
import { UpsertCategoryDto } from '../../src/categories/dto/upsert-category.dto';
import { ReorderCategoriesDto } from '../../src/categories/dto/reorder-categories.dto';

// Auditoría interna 2026-09-10, ítem `api.categories`.
//
// La jerarquía solo frenaba "A es su propia madre": se podía armar A→B→A con
// dos ediciones, y PATCH /categories/reorder escribía cualquier parentId sin
// mirar, incluida una categoría de OTRO negocio.

const BIZ = 'biz-1';
const [A, B, C, AJENA] = ['00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-0000000000ff'];

// A (raíz) → B (hija de A) → C (hija de B)
function categorias() {
  const filas = [{ id: A, parentId: null }, { id: B, parentId: A }, { id: C, parentId: B }];
  const prisma = {
    category: {
      findMany: jest.fn().mockResolvedValue(filas),
      findFirst: jest.fn(({ where }: { where: { id: string; businessId: string } }) =>
        Promise.resolve(filas.find((f) => f.id === where.id && where.businessId === BIZ) ? { id: where.id, businessId: BIZ } : null),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'nueva' }),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    product: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { svc: new CategoriesService(prisma as any), prisma };
}

describe('La jerarquía no admite ciclos', () => {
  it('editar A para colgarla de C (A→B→C→A) se rechaza y no se escribe', async () => {
    const { svc, prisma } = categorias();
    await expect(svc.update(BIZ, A, { name: 'Ropa', parentId: C })).rejects.toThrow(/ciclo/);
    expect(prisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('A como madre de sí misma sigue rechazándose', async () => {
    const { svc } = categorias();
    await expect(svc.update(BIZ, A, { name: 'Ropa', parentId: A })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un cambio de padre válido pasa', async () => {
    const { svc, prisma } = categorias();
    await svc.update(BIZ, C, { name: 'Remeras', parentId: A });
    expect(prisma.category.updateMany).toHaveBeenCalled();
  });
});

describe('Reordenar valida padres e ids', () => {
  it('un padre de otro negocio: 400 y no se toca nada', async () => {
    const { svc, prisma } = categorias();
    await expect(svc.reorder(BIZ, { items: [{ id: C, position: 0, parentId: AJENA }] })).rejects.toThrow(/padre inválida/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('una categoría que no es del negocio: 404', async () => {
    const { svc } = categorias();
    await expect(svc.reorder(BIZ, { items: [{ id: AJENA, position: 0 }] })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un reordenado que arma un ciclo (A bajo C) se rechaza', async () => {
    const { svc, prisma } = categorias();
    await expect(svc.reorder(BIZ, { items: [{ id: A, position: 0, parentId: C }] })).rejects.toThrow(/ciclo/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un reordenado normal (subir C a la raíz y moverla) pasa con el negocio en el where', async () => {
    const { svc, prisma } = categorias();
    await svc.reorder(BIZ, { items: [{ id: C, position: 3, parentId: null }, { id: B, position: 1, parentId: A }] });
    expect(prisma.category.updateMany).toHaveBeenCalledWith({ where: { id: C, businessId: BIZ }, data: { position: 3, parentId: null } });
  });
});

describe('Otros cambios', () => {
  it('un nombre sin letras ni números no genera un slug vacío', async () => {
    const { svc, prisma } = categorias();
    await expect(svc.create(BIZ, { name: '👕👕' })).rejects.toThrow(/letra o un número/);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('borrar con productos o subcategorías sigue rechazándose', async () => {
    const { svc, prisma } = categorias();
    prisma.product.count.mockResolvedValue(2);
    await expect(svc.remove(BIZ, A)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.category.deleteMany).not.toHaveBeenCalled();
  });

  it('los DTOs acotan y validan formatos', async () => {
    const props = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);
    expect(await props(UpsertCategoryDto, { name: 'Remeras', icon: '👕', color: '#10B981', imageUrl: 'https://x.supabase.co/a.webp' })).toEqual([]);
    expect(await props(UpsertCategoryDto, { name: 'Remeras', color: '', imageUrl: '', icon: '' })).toEqual([]);
    expect(await props(UpsertCategoryDto, { name: '' })).toContain('name');
    expect(await props(UpsertCategoryDto, { name: 'x'.repeat(61) })).toContain('name');
    expect(await props(UpsertCategoryDto, { name: 'R', color: 'red;x' })).toContain('color');
    expect(await props(UpsertCategoryDto, { name: 'R', imageUrl: 'javascript:alert(1)' })).toContain('imageUrl');
    expect(await props(ReorderCategoriesDto, { items: [{ id: A, position: -1 }] })).toContain('items');
  });
});
