import { ConflictException } from '@nestjs/common';
import { ProductsService } from '../../src/products/products.service';

// El nombre de un producto es único dentro de su categoría, no en toda la tienda:
// una perfumería tiene "CK IN2U EDT 100ML" en Femeninos y en Masculinos.

const BIZ = 'biz-1';
const FEM = '11111111-1111-4111-8111-111111111111';
const MASC = '22222222-2222-4222-8222-222222222222';

function armar(existentes: { id: string; name: string; categoryId: string }[]) {
  const findFirst = jest.fn(async ({ where }: any) =>
    existentes.find(
      (p) =>
        p.categoryId === where.categoryId &&
        p.name.toLowerCase() === String(where.name.equals).toLowerCase() &&
        (!where.id || p.id !== where.id.not),
    ) ?? null,
  );
  const svc = new ProductsService({ product: { findFirst } } as any, {} as any, {} as any);
  const validar = (name: string, categoryId: string, excludeId?: string) =>
    (svc as any).validateUniqueName(BIZ, name, categoryId, excludeId).then(() => 'ok', (e: unknown) => e);
  return { validar, findFirst };
}

describe('Nombre de producto único por categoría', () => {
  const existentes = [{ id: 'p-1', name: 'CK IN2U EDT 100ML', categoryId: FEM }];

  it('acepta el mismo nombre en otra categoría', async () => {
    const { validar, findFirst } = armar(existentes);
    expect(await validar('CK IN2U EDT 100ML', MASC)).toBe('ok');
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ businessId: BIZ, deletedAt: null, categoryId: MASC });
  });

  it('rechaza el mismo nombre en la misma categoría, sin importar mayúsculas (frena el doble click)', async () => {
    const { validar } = armar(existentes);
    const e = await validar('ck in2u edt 100ml', FEM);
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as Error).message).toBe('Ya existe un producto con este nombre en esta categoría');
  });

  it('al editar, el producto no choca consigo mismo', async () => {
    const { validar } = armar(existentes);
    expect(await validar('CK IN2U EDT 100ML', FEM, 'p-1')).toBe('ok');
  });
});
