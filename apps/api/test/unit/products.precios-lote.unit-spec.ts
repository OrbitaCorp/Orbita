import { BadRequestException } from '@nestjs/common';
import { PreciosLoteService } from '../../src/products/precios-lote.service';

// "Actualizar precios con Excel": se simula (resumen) y después se aplica.
const BIZ = 'biz-1';
const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const AJENA = '99999999-9999-4999-8999-999999999999';

function armar() {
  const variantes = [
    { id: V1, price: 100, productId: 'p1', product: { name: 'Perfume A' }, optionValues: [{ optionValue: { value: '50 ml', option: { position: 0 } } }] },
    { id: V2, price: 200, productId: 'p1', product: { name: 'Perfume A' }, optionValues: [{ optionValue: { value: '100 ml', option: { position: 0 } } }] },
  ];
  const prisma = {
    productVariant: {
      findMany: jest.fn(async ({ where }: any) => variantes.filter((v) => where.id.in.includes(v.id))),
      update: jest.fn((args: any) => ({ op: 'variante', ...args })),
      groupBy: jest.fn().mockResolvedValue([{ productId: 'p1', _min: { price: 90 } }]),
    },
    product: { update: jest.fn((args: any) => ({ op: 'producto', ...args })) },
    $transaction: jest.fn(async (ops: any[]) => ops),
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { svc: new PreciosLoteService(prisma as any, audit as any), prisma, audit };
}

describe('Actualizar precios con Excel', () => {
  it('simular no guarda nada y dice qué cambia, qué queda igual y qué código no es de la tienda', async () => {
    const { svc, prisma } = armar();
    const r = await svc.actualizar(BIZ, 'm1', { simular: true, items: [{ variantId: V1, price: 90 }, { variantId: V2, price: 200 }, { variantId: AJENA, price: 5 }] });
    expect(r).toMatchObject({ aplicado: false, sinCambios: 1, noEncontradas: [AJENA] });
    expect(r.cambios).toEqual([{ variantId: V1, productId: 'p1', nombre: 'Perfume A', variante: '50 ml', antes: 100, despues: 90 }]);
    expect(prisma.productVariant.update).not.toHaveBeenCalled();
    // Solo variantes de ESTA tienda y de productos no borrados.
    expect(prisma.productVariant.findMany.mock.calls[0][0].where.product).toEqual({ businessId: BIZ, deletedAt: null });
  });

  it('si un código se repite, vale la última fila', async () => {
    const { svc } = armar();
    const r = await svc.actualizar(BIZ, 'm1', { simular: true, items: [{ variantId: V1, price: 80 }, { variantId: V1, price: 95 }] });
    expect(r.cambios.map((c) => c.despues)).toEqual([95]);
  });

  it('al aplicar cambia el precio de la variante, el "desde $X" del producto y lo deja en la auditoría', async () => {
    const { svc, prisma, audit } = armar();
    const r = await svc.actualizar(BIZ, 'm1', { items: [{ variantId: V1, price: 90 }] });
    expect(r.aplicado).toBe(true);
    expect(prisma.productVariant.update).toHaveBeenCalledWith({ where: { id: V1 }, data: { price: expect.anything() } });
    expect(String(prisma.productVariant.update.mock.calls[0][0].data.price)).toBe('90');
    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { basePrice: 90 } });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'p1', action: 'UPDATE', changes: [{ field: 'variante 50 ml: precio (Excel)', before: 100, after: 90 }] }));
  });

  it('sin ningún precio distinto no aplica nada', async () => {
    const { svc } = armar();
    await expect(svc.actualizar(BIZ, 'm1', { items: [{ variantId: V2, price: 200 }] })).rejects.toBeInstanceOf(BadRequestException);
  });
});
