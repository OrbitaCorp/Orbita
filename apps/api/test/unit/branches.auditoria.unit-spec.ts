import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BranchesService } from '../../src/branches/branches.service';
import { InventoryService } from '../../src/inventory/inventory.service';
import { CreateBranchDto } from '../../src/branches/dto/create-branch.dto';
import { UpdateBranchDto } from '../../src/branches/dto/update-branch.dto';

// Auditoría interna 2026-09-10, ítem `api.branches`.
//
// El módulo de sucursales en sí ya filtraba bien por negocio. El agujero
// estaba al lado: inventario tomaba el branch_id del body y lo usaba tal cual,
// así que un empleado con inventory.manage podía escribir stock y movimientos
// contra la sucursal de OTRO negocio (pedidos ya lo validaba).

const BIZ = 'biz-1';
const PROPIA = 'branch-propia';
const AJENA = 'branch-de-otro-negocio';
const VARIANTE = 'variant-1';

function inventario() {
  const prisma = {
    branch: {
      findFirst: jest.fn(({ where }: { where: { id?: string; businessId: string; isDefault?: boolean } }) => {
        if (where.isDefault) return Promise.resolve({ id: PROPIA });
        return Promise.resolve(where.id === PROPIA && where.businessId === BIZ ? { id: PROPIA } : null);
      }),
    },
    productVariant: { findFirst: jest.fn().mockResolvedValue({ id: VARIANTE }) },
    variantStock: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  const svc = new InventoryService(prisma as any, { emit: jest.fn() } as any);
  const aplicar = jest.spyOn(svc as any, 'applyMovement').mockResolvedValue({ id: 'm1' });
  return { svc, prisma, aplicar };
}

describe('Inventario: la sucursal del body tiene que ser del negocio del token', () => {
  it.each([
    ['entry', { variantId: VARIANTE, quantity: 5, branch_id: AJENA }],
    ['adjustment', { variantId: VARIANTE, quantity: -1, reason: 'rotura', branch_id: AJENA }],
  ])('%s contra una sucursal ajena: 404 y no se escribe nada', async (metodo, dto) => {
    const { svc, aplicar } = inventario();
    await expect((svc as any)[metodo](BIZ, 'member-1', dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('entry contra una sucursal propia escribe en esa sucursal', async () => {
    const { svc, aplicar } = inventario();
    await svc.entry(BIZ, 'member-1', { variantId: VARIANTE, quantity: 5, branch_id: PROPIA });
    expect(aplicar).toHaveBeenCalledWith(BIZ, 'member-1', expect.objectContaining({ branchId: PROPIA }));
  });

  it('sin branch_id usa la sucursal principal del negocio', async () => {
    const { svc, aplicar, prisma } = inventario();
    await svc.adjustment(BIZ, 'member-1', { variantId: VARIANTE, quantity: 2, reason: 'conteo' });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { businessId: BIZ, isDefault: true } });
    expect(aplicar).toHaveBeenCalledWith(BIZ, 'member-1', expect.objectContaining({ branchId: PROPIA }));
  });

  it('la consulta de stock con una sucursal ajena da 404', async () => {
    const { svc, prisma } = inventario();
    await expect(svc.stock(BIZ, { branch_id: AJENA })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.variantStock.findMany).not.toHaveBeenCalled();
  });

  it('la sucursal se busca siempre con el businessId del token', async () => {
    const { svc, prisma } = inventario();
    await svc.entry(BIZ, 'member-1', { variantId: VARIANTE, quantity: 1, branch_id: PROPIA });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { id: PROPIA, businessId: BIZ }, select: { id: true } });
  });
});

describe('Sucursales: lectura, edición y borrado acotados al negocio', () => {
  function sucursales(branch: unknown, deleteMany?: jest.Mock) {
    const prisma = {
      branch: {
        findFirst: jest.fn().mockResolvedValue(branch),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: deleteMany ?? jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { svc: new BranchesService(prisma as any), prisma };
  }

  it('una sucursal de otro negocio da 404 (el where lleva businessId)', async () => {
    const { svc, prisma } = sucursales(null);
    await expect(svc.findOne(BIZ, AJENA)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { id: AJENA, businessId: BIZ } });
  });

  it('editar escribe con { id, businessId } en el where, no solo con el id', async () => {
    const { svc, prisma } = sucursales({ id: PROPIA, isDefault: false });
    await svc.update(BIZ, PROPIA, { name: 'Centro' });
    expect(prisma.branch.updateMany).toHaveBeenCalledWith({ where: { id: PROPIA, businessId: BIZ }, data: { name: 'Centro' } });
  });

  it('la sucursal principal no se borra', async () => {
    const { svc, prisma } = sucursales({ id: PROPIA, isDefault: true });
    await expect(svc.remove(BIZ, PROPIA)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.branch.deleteMany).not.toHaveBeenCalled();
  });

  it('una sucursal con stock o pedidos no se borra (la FK lo impide y se responde 422)', async () => {
    const fk = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' });
    const { svc } = sucursales({ id: PROPIA, isDefault: false }, jest.fn().mockRejectedValue(fk));
    await expect(svc.remove(BIZ, PROPIA)).rejects.toThrow(/registros asociados/);
  });

  it('los DTOs piden nombre y acotan los textos', async () => {
    const errores = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);
    expect(await errores(CreateBranchDto, { name: '' })).toContain('name');
    expect(await errores(CreateBranchDto, { name: 'x'.repeat(81) })).toContain('name');
    expect(await errores(CreateBranchDto, { name: 'Centro', address: 'x'.repeat(301) })).toContain('address');
    expect(await errores(CreateBranchDto, { name: 'Centro', address: 'Av. Corrientes 1234, CABA' })).toEqual([]);
    // isDefault no es un campo del DTO: con whitelist (así corre ValidationPipe)
    // no llega al updateMany, que recibe el DTO entero.
    const conDefault = await validate(plainToInstance(UpdateBranchDto, { isDefault: true }), { whitelist: true, forbidNonWhitelisted: true });
    expect(conDefault.map((e) => e.property)).toContain('isDefault');
  });
});
