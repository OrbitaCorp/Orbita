import { ProductsService } from '../../src/products/products.service';

// Historial de variantes: opciones y valores que el negocio ya usó, para
// ofrecerlos al cargar un producto nuevo.
type Opcion = { name: string; isVisual: boolean; values: { value: string }[] };
const op = (name: string, valores: string[], isVisual = false): Opcion => ({ name, isVisual, values: valores.map((value) => ({ value })) });

function svcCon(opciones: Opcion[]) {
  const prisma = { productOption: { findMany: jest.fn().mockResolvedValue(opciones) } };
  return { svc: new ProductsService(prisma as never, {} as never, {} as never), prisma };
}

describe('ProductsService.variantHistory', () => {
  it('junta las opciones sin distinguir mayúsculas y ordena por uso', async () => {
    const { svc } = svcCon([op('Talle', ['S', 'M']), op('Color', ['Negro'], true), op('color', ['Crudo']), op('Color', ['Negro', 'Blanco'])]);
    const r = await svc.variantHistory('biz');
    expect(r.map((o) => o.name)).toEqual(['Color', 'Talle']);
    expect(r[0].isVisual).toBe(true);
    // Negro se usó 2 veces, Crudo y Blanco una: el más usado va primero.
    expect(r[0].values[0]).toBe('Negro');
    expect([...r[0].values].sort()).toEqual(['Blanco', 'Crudo', 'Negro']);
  });

  it('cada valor aparece una vez aunque varíe la grafía, y queda la más usada', async () => {
    const { svc } = svcCon([op('Color', ['crudo']), op('Color', ['Crudo']), op('Color', ['Crudo'])]);
    const r = await svc.variantHistory('biz');
    expect(r[0].values).toEqual(['Crudo']);
  });

  it('ignora nombres y valores vacíos o en blanco', async () => {
    const { svc } = svcCon([op('  ', ['X']), op('Talle', ['', '  ', 'M'])]);
    const r = await svc.variantHistory('biz');
    expect(r).toEqual([{ name: 'Talle', isVisual: false, values: ['M'] }]);
  });

  it('solo mira productos del negocio y no borrados', async () => {
    const { svc, prisma } = svcCon([]);
    await svc.variantHistory('biz-1');
    expect(prisma.productOption.findMany.mock.calls[0][0].where).toEqual({ product: { businessId: 'biz-1', deletedAt: null } });
  });

  it('sin productos con opciones devuelve una lista vacía', async () => {
    const { svc } = svcCon([]);
    expect(await svc.variantHistory('biz')).toEqual([]);
  });
});
