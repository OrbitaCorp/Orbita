import { UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InventoryService } from '../../src/inventory/inventory.service';
import { StockEntryDto } from '../../src/inventory/dto/stock-entry.dto';
import { StockAdjustmentDto } from '../../src/inventory/dto/stock-adjustment.dto';
import { FindStockQueryDto } from '../../src/inventory/dto/find-stock-query.dto';
import { UpsertSupplierDto } from '../../src/inventory/dto/upsert-supplier.dto';

// Auditoría interna 2026-09-10, ítem `api.inventory`.
//
// Los movimientos manuales (entradas y ajustes) leían la cantidad y escribían
// "leída + movimiento": dos movimientos simultáneos se pisaban y el stock
// dejaba de cuadrar con la suma de movimientos. Ahora es un incremento
// atómico con la condición de no quedar negativo, igual que el descuento de
// stock de los pedidos. Además, topes en los DTOs.

const BIZ = 'biz-1';
const VAR = '11111111-1111-4111-8111-111111111111';
const SUC = '22222222-2222-4222-8222-222222222222';

function inventario(opts: { existente?: { id: string; quantity: number } | null; count?: number } = {}) {
  const tx = {
    variantStock: {
      findUnique: jest.fn().mockResolvedValue(opts.existente === undefined ? { id: 'vs-1', quantity: 1, stockMin: 0 } : opts.existente),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'vs-1', quantity: 0, stockMin: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: opts.count ?? 1 }),
      create: jest.fn().mockResolvedValue({ id: 'vs-nuevo', quantity: 5, stockMin: 0 }),
      update: jest.fn(),
    },
    stockMovement: { create: jest.fn().mockResolvedValue({ id: 'm-1', variantId: VAR, type: 'AJUSTE', quantity: -1, reason: 'r', supplierId: null, createdAt: new Date() }) },
    productVariant: { findUnique: jest.fn().mockResolvedValue({ product: { name: 'Remera' }, optionValues: [] }) },
  };
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: SUC }) },
    productVariant: { findFirst: jest.fn().mockResolvedValue({ id: VAR }) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  return { svc: new InventoryService(prisma as any, { emit: jest.fn() } as any), tx };
}

describe('Movimientos manuales atómicos', () => {
  it('un ajuste que resta usa un decremento condicionado a no quedar negativo (no escribe un valor leído)', async () => {
    const { svc, tx } = inventario();
    await svc.adjustment(BIZ, 'm-1', { variantId: VAR, quantity: -1, reason: 'rotura' });
    expect(tx.variantStock.updateMany).toHaveBeenCalledWith({
      where: { id: 'vs-1', quantity: { gte: 1 } },
      data: { quantity: { increment: -1 } },
    });
    expect(tx.variantStock.update).not.toHaveBeenCalled();
  });

  it('si otro movimiento se llevó el stock en el medio (count 0), 422 y no queda movimiento registrado', async () => {
    const { svc, tx } = inventario({ count: 0 });
    await expect(svc.adjustment(BIZ, 'm-1', { variantId: VAR, quantity: -1, reason: 'rotura' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('una entrada suma con incremento atómico, sin condición', async () => {
    const { svc, tx } = inventario();
    await svc.entry(BIZ, 'm-1', { variantId: VAR, quantity: 10 });
    expect(tx.variantStock.updateMany).toHaveBeenCalledWith({ where: { id: 'vs-1' }, data: { quantity: { increment: 10 } } });
  });

  it('sin fila de stock: una entrada la crea; un ajuste negativo se rechaza', async () => {
    const entrada = inventario({ existente: null });
    await entrada.svc.entry(BIZ, 'm-1', { variantId: VAR, quantity: 5 });
    expect(entrada.tx.variantStock.create).toHaveBeenCalledWith({ data: { variantId: VAR, branchId: SUC, quantity: 5, stockMin: 0 } });
    const ajuste = inventario({ existente: null });
    await expect(ajuste.svc.adjustment(BIZ, 'm-1', { variantId: VAR, quantity: -2, reason: 'conteo' })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('el movimiento queda registrado con quién y por qué', async () => {
    const { svc, tx } = inventario();
    await svc.adjustment(BIZ, 'm-7', { variantId: VAR, quantity: 3, reason: 'conteo mensual' });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, createdBy: 'm-7', reason: 'conteo mensual', type: 'AJUSTE', quantity: 3 }) });
  });
});

describe('DTOs de inventario', () => {
  const props = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('cantidades acotadas (una enorme desbordaba el Int de Postgres) y motivo con tope', async () => {
    expect(await props(StockEntryDto, { variantId: VAR, quantity: 3_000_000_000 })).toContain('quantity');
    expect(await props(StockEntryDto, { variantId: VAR, quantity: 0 })).toContain('quantity');
    expect(await props(StockAdjustmentDto, { variantId: VAR, quantity: -5_000_000, reason: 'x' })).toContain('quantity');
    expect(await props(StockAdjustmentDto, { variantId: VAR, quantity: 1, reason: '' })).toContain('reason');
    expect(await props(StockAdjustmentDto, { variantId: VAR, quantity: 1, reason: 'x'.repeat(201) })).toContain('reason');
    expect(await props(StockAdjustmentDto, { variantId: VAR, quantity: -3, reason: 'rotura' })).toEqual([]);
    expect(await props(FindStockQueryDto, { search: 'x'.repeat(101) })).toContain('search');
  });

  it('proveedor: nombre obligatorio con tope y email normalizado', async () => {
    expect(await props(UpsertSupplierDto, { name: '' })).toContain('name');
    expect(await props(UpsertSupplierDto, { name: 'Textil Sur', email: 'Ventas@TextilSur.com' })).toEqual([]);
    expect(plainToInstance(UpsertSupplierDto, { name: 'x', email: ' Ventas@TextilSur.com ' }).email).toBe('ventas@textilsur.com');
  });
});
