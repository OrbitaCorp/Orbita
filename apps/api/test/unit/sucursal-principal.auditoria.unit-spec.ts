import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InventoryService } from '../../src/inventory/inventory.service';
import { OrdersService } from '../../src/orders/orders.service';
import { ProductsService } from '../../src/products/products.service';
import { StorefrontService } from '../../src/storefront/storefront.service';
import {
  buscarSucursalPrincipal,
  whereSucursalPrincipal,
} from '../../src/common/utils/sucursal-principal';

// Hallazgo `sucursal-principal-doble` de la auditoría interna.
//
// "Sucursal principal" tenía DOS definiciones conviviendo:
//   1. el flag explícito `isDefault` de la fila (productos, inventario, el
//      retiro en local y el panel de Configuración), y
//   2. "la más antigua por createdAt" (la tienda —`sucursalDeVenta`— y los
//      pedidos del panel que llegan sin `branch_id`).
//
// Hoy devuelven la misma fila porque la principal es la que crea el alta del
// negocio, así que el bug estaba dormido: en cuanto la principal se reasigne,
// el panel carga el stock en una sucursal y la tienda vende contra otra, y el
// storefront muestra "sin stock" productos que sí tienen.
//
// Quedó UNA sola definición, `isDefault` (explícita y reasignable por el
// dueño; "la más antigua" es derivada y no la elige nadie). Estos tests la
// fijan: el mock devuelve DISTINTA sucursal según cómo se pregunte, así que
// cualquier consumidor que vuelva a "la más vieja" hace fallar su test.

const BIZ = 'biz-1';
const PRINCIPAL = 'branch-principal'; // isDefault: true
const MAS_VIEJA = 'branch-mas-vieja'; // la de createdAt más antiguo
const VAR = '11111111-1111-4111-8111-111111111111';

// findFirst de sucursales que separa las dos definiciones viejas: solo quien
// pregunta por `isDefault` se lleva la principal.
function branchFindFirst(principal: unknown = { id: PRINCIPAL }) {
  return jest.fn((args: { where?: { isDefault?: boolean } } = {}) =>
    Promise.resolve(args.where?.isDefault ? principal : { id: MAS_VIEJA }),
  );
}

// Ninguna consulta de sucursal puede volver a desempatar por fecha.
function ningunaOrdenaPorFecha(findFirst: jest.Mock) {
  return findFirst.mock.calls.every((c) => (c[0] as { orderBy?: unknown } | undefined)?.orderBy === undefined);
}

describe('La definición vive en un solo lugar', () => {
  it('la sucursal principal es la marcada isDefault, sin desempate por fecha', async () => {
    const prisma = { branch: { findFirst: branchFindFirst() } };
    await expect(buscarSucursalPrincipal(prisma as never, BIZ)).resolves.toEqual({ id: PRINCIPAL });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { businessId: BIZ, isDefault: true },
      select: { id: true },
    });
    expect(ningunaOrdenaPorFecha(prisma.branch.findFirst)).toBe(true);
  });

  it('el where siempre lleva el businessId del token (no se busca la principal "de cualquiera")', () => {
    expect(whereSucursalPrincipal(BIZ)).toEqual({ businessId: BIZ, isDefault: true });
  });

  it('un negocio sin sucursal principal devuelve null y deja que decida cada caller', async () => {
    const prisma = { branch: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(buscarSucursalPrincipal(prisma as never, BIZ)).resolves.toBeNull();
  });
});

describe('La tienda vende contra la sucursal principal', () => {
  function tienda(principal: unknown = { id: PRINCIPAL }) {
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: BIZ, name: 'T', subdomain: 't', mode: 'FULL', isActive: true, isPaused: false, deletedAt: null,
        }),
      },
      storefrontConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      businessConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      branch: { findFirst: branchFindFirst(principal) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { svc: new StorefrontService(prisma as never, {} as never, {} as never), prisma };
  }

  it('el detalle de un producto lee el stock de la principal, no el de la más vieja', async () => {
    const { svc, prisma } = tienda();
    // El producto no existe: alcanza para ver con qué sucursal se armó la
    // consulta, que es lo que fija este hallazgo.
    await expect(svc.getProduct('t', VAR)).rejects.toBeInstanceOf(NotFoundException);
    const args = prisma.product.findFirst.mock.calls[0][0] as {
      include: { variants: { include: { stock: { where: { branchId: string } } } } };
    };
    expect(args.include.variants.include.stock.where.branchId).toBe(PRINCIPAL);
    expect(ningunaOrdenaPorFecha(prisma.branch.findFirst)).toBe(true);
  });

  it('sin sucursal principal la tienda responde 404, no cae en otra sucursal cualquiera', async () => {
    const { svc, prisma } = tienda(null);
    await expect(svc.getProduct('t', VAR)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it('la dirección de "Retiro en local" es la de la principal (se retira donde está el stock que se vendió)', async () => {
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: BIZ, name: 'T', subdomain: 't', mode: 'FULL', isActive: true, isPaused: false, deletedAt: null,
        }),
      },
      storefrontConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      businessConfig: {
        findUnique: jest.fn().mockResolvedValue({
          acceptsPickup: true, acceptsMercadopago: false, acceptsTransfer: false,
          pickupPaymentMethods: [], ivaDisabled: true, enabledCarriers: [],
        }),
      },
      branch: {
        findFirst: jest.fn((args: { where?: { isDefault?: boolean } } = {}) =>
          Promise.resolve(
            args.where?.isDefault
              ? { name: 'Principal', address: 'Av. Corrientes 1234' }
              : { name: 'Sucursal 2', address: 'Otra dirección' },
          ),
        ),
      },
    };
    const svc = new StorefrontService(prisma as never, {} as never, {} as never);
    const cfg = await svc.getConfig('t');
    expect(cfg.payment).toMatchObject({ pickupBranchName: 'Principal', pickupAddress: 'Av. Corrientes 1234' });
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { businessId: BIZ, isDefault: true },
      select: { name: true, address: true },
    });
  });
});

describe('Un pedido del panel sin sucursal usa la principal', () => {
  function pedidos(principal: unknown = { id: PRINCIPAL }) {
    const prisma = {
      branch: { findFirst: branchFindFirst(principal) },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          { id: VAR, price: 1000, product: { name: 'Remera' }, optionValues: [] },
        ]),
      },
      variantStock: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new OrdersService(prisma as never, {} as never, {} as never, { emit: jest.fn() } as never);
    return { svc, prisma };
  }

  const venta = {
    channel: 'POS' as const,
    paymentMethod: 'CASH' as const,
    items: [{ variantId: VAR, quantity: 1 }],
    buyer: { name: 'Ana' },
  };

  it('el stock se valida contra la principal, no contra la más antigua', async () => {
    const { svc, prisma } = pedidos();
    // El pedido no llega a crearse (el service real necesita descuentos y
    // transacción): lo que importa es contra qué sucursal preguntó el stock.
    await expect(svc.create(BIZ, venta, { memberId: 'm-1' })).rejects.toThrow();
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { businessId: BIZ, isDefault: true },
      select: { id: true },
    });
    expect(prisma.variantStock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: PRINCIPAL }) }),
    );
    expect(ningunaOrdenaPorFecha(prisma.branch.findFirst)).toBe(true);
  });

  it('con branch_id explícito manda esa sucursal, que igual tiene que ser del negocio', async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue(null) },
      productVariant: { findMany: jest.fn() },
    };
    const svc = new OrdersService(prisma as never, {} as never, {} as never, { emit: jest.fn() } as never);
    await expect(svc.create(BIZ, { ...venta, branch_id: 'de-otro-negocio' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { id: 'de-otro-negocio', businessId: BIZ } });
    expect(prisma.productVariant.findMany).not.toHaveBeenCalled();
  });

  it('un negocio sin sucursal principal no puede cargar un pedido a ciegas', async () => {
    const { svc, prisma } = pedidos(null);
    await expect(svc.create(BIZ, venta, { memberId: 'm-1' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.productVariant.findMany).not.toHaveBeenCalled();
  });
});

describe('El panel carga el stock en la misma sucursal', () => {
  it('inventario, sin branch_id, escribe en la principal', async () => {
    const prisma = {
      branch: { findFirst: branchFindFirst() },
      productVariant: { findFirst: jest.fn().mockResolvedValue({ id: VAR }) },
      $transaction: jest.fn(),
    };
    const svc = new InventoryService(prisma as never, { emit: jest.fn() } as never);
    const aplicar = jest.spyOn(svc as never as { applyMovement: () => unknown }, 'applyMovement').mockResolvedValue({ id: 'm1' } as never);
    await svc.adjustment(BIZ, 'member-1', { variantId: VAR, quantity: 2, reason: 'conteo' });
    expect(aplicar).toHaveBeenCalledWith(BIZ, 'member-1', expect.objectContaining({ branchId: PRINCIPAL }));
    expect(ningunaOrdenaPorFecha(prisma.branch.findFirst)).toBe(true);
  });

  it('productos carga el stock inicial en la principal', async () => {
    const prisma = { branch: { findFirst: branchFindFirst() } };
    const svc = new ProductsService(prisma as never, {} as never, {} as never);
    await expect((svc as never as { getDefaultBranch: (b: string) => Promise<{ id: string }> }).getDefaultBranch(BIZ))
      .resolves.toEqual({ id: PRINCIPAL });
  });

  it.each([
    ['inventario', () => new InventoryService({ branch: { findFirst: jest.fn().mockResolvedValue(null) } } as never, { emit: jest.fn() } as never)],
    ['productos', () => new ProductsService({ branch: { findFirst: jest.fn().mockResolvedValue(null) } } as never, {} as never, {} as never)],
  ])('%s: sin principal configurada es 422 del panel (algo que el dueño puede arreglar)', async (_caso, armar) => {
    const svc = armar() as never as { getDefaultBranch: (b: string) => Promise<unknown> };
    await expect(svc.getDefaultBranch(BIZ)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
