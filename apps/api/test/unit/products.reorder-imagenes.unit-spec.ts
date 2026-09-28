import { ProductsService } from '../../src/products/products.service';

// Reordenar las fotos generales de un producto: la principal (la que muestran el
// listado del panel y la tienda) tiene que ser la primera del orden nuevo.
type Img = { id: string; isPrimary: boolean; optionValueId: string | null; position: number };

function svcCon(imagenes: Img[]) {
  const estado = imagenes.map((i) => ({ ...i }));
  const tx = {
    productImage: {
      updateMany: jest.fn(async ({ where, data }: { where: { id?: string; productId: string }; data: Partial<Img> }) => {
        for (const img of estado) if (where.id === undefined || img.id === where.id) Object.assign(img, data);
        return { count: 1 };
      }),
      findMany: jest.fn(async () =>
        estado.filter((i) => i.optionValueId === null).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map((i) => ({ id: i.id, isPrimary: i.isPrimary })),
      ),
    },
  };
  const prisma = {
    product: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  };
  const svc = new ProductsService(prisma as never, {} as never, {} as never);
  return { svc, estado };
}

const primaria = (estado: Img[]) => estado.filter((i) => i.isPrimary).map((i) => i.id);

describe('ProductsService.reorderImages — la principal sigue al orden', () => {
  const base = (): Img[] => [
    { id: 'a', isPrimary: true, optionValueId: null, position: 0 },
    { id: 'b', isPrimary: false, optionValueId: null, position: 1 },
    { id: 'c', isPrimary: false, optionValueId: null, position: 2 },
  ];

  it('al poner otra foto primera, pasa a ser la principal (y la anterior deja de serlo)', async () => {
    const { svc, estado } = svcCon(base());
    await svc.reorderImages('biz', 'p1', { items: [{ id: 'c', position: 0 }, { id: 'a', position: 1 }, { id: 'b', position: 2 }] } as never);
    expect(primaria(estado)).toEqual(['c']);
  });

  it('si la primera ya era la principal, no se toca nada', async () => {
    const { svc, estado } = svcCon(base());
    await svc.reorderImages('biz', 'p1', { items: [{ id: 'a', position: 0 }, { id: 'c', position: 1 }, { id: 'b', position: 2 }] } as never);
    expect(primaria(estado)).toEqual(['a']);
  });

  it('con una principal explícita (primaryId) manda esa', async () => {
    const { svc, estado } = svcCon(base());
    await svc.reorderImages('biz', 'p1', { items: [{ id: 'c', position: 0 }], primaryId: 'b' } as never);
    expect(primaria(estado)).toEqual(['b']);
  });

  it('reordenar solo fotos de color/talle no cambia la principal', async () => {
    const imgs: Img[] = [...base(), { id: 'v1', isPrimary: false, optionValueId: 'negro', position: 3 }, { id: 'v2', isPrimary: false, optionValueId: 'blanco', position: 4 }];
    const { svc, estado } = svcCon(imgs);
    await svc.reorderImages('biz', 'p1', { items: [{ id: 'v2', position: 0 }, { id: 'v1', position: 1 }] } as never);
    expect(primaria(estado)).toEqual(['a']);
  });
});
