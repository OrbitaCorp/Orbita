import { ProductsService } from '../../src/products/products.service';

const BIZ = 'biz-1';
const MEMBER = 'mem-1';
const PROD_ID = 'prod-1';
const CAT_ID = '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e';
const BR_ID = 'br-1';

const VAR_M = '11111111-1111-4111-8111-111111111111';
const VAR_L = '22222222-2222-4222-8222-222222222222';
const OPT_TALLE = '33333333-3333-4333-8333-333333333333';
const VAL_M = '44444444-4444-4444-8444-444444444444';
const VAL_L = '55555555-5555-4555-8555-555555555555';

function makeExistingProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: PROD_ID,
    businessId: BIZ,
    categoryId: CAT_ID,
    name: 'Remera combinada',
    description: null,
    basePrice: 38000,
    comparePrice: null,
    cost: 15000,
    status: 'PUBLISHED',
    isFeatured: false,
    photoType: 'flat',
    byOrder: false,
    specs: [],
    videoUrl: null,
    contentBlocks: null,
    productTags: [],
    options: [
      {
        id: OPT_TALLE,
        name: 'Talle',
        position: 0,
        isVisual: false,
        values: [
          { id: VAL_M, value: 'M', position: 0 },
          { id: VAL_L, value: 'L', position: 1 },
        ],
      },
    ],
    variants: [
      {
        id: VAR_M,
        sku: 'REM-M',
        price: 38000,
        comparePrice: null,
        isDefault: false,
        isActive: true,
        showStock: true,
        optionValues: [{ optionValueId: VAL_M, optionValue: { id: VAL_M, value: 'M' } }],
        stock: [{ id: 'st-m', branchId: BR_ID, quantity: 1, stockMin: 0 }],
      },
      {
        id: VAR_L,
        sku: 'REM-L',
        price: 38000,
        comparePrice: null,
        isDefault: false,
        isActive: true,
        showStock: true,
        optionValues: [{ optionValueId: VAL_L, optionValue: { id: VAL_L, value: 'L' } }],
        stock: [{ id: 'st-l', branchId: BR_ID, quantity: 0, stockMin: 0 }],
      },
    ],
    images: [],
    ...overrides,
  };
}

function buildMocks(existing: ReturnType<typeof makeExistingProduct>, opts: { ventas?: string[]; movimientos?: string[] } = {}) {
  const tx = {
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    productTag: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), createMany: jest.fn() },
    productOption: {
      update: jest.fn(async ({ where }: any) => ({ id: where.id })),
      create: jest.fn().mockResolvedValue({ id: 'opt-new' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    productOptionValue: {
      update: jest.fn(async ({ where }: any) => ({ id: where.id })),
      create: jest.fn().mockResolvedValue({ id: 'val-new' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productVariant: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'var-new' }),
    },
    variantOptionValue: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    variantStock: {
      findUnique: jest.fn().mockResolvedValue({ id: 'st-m', quantity: 1, stockMin: 0 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    stockMovement: { create: jest.fn().mockResolvedValue({}) },
    productImage: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };

  const prisma = {
    category: { findFirst: jest.fn().mockResolvedValue({ id: CAT_ID }) },
    business: { findUnique: jest.fn().mockResolvedValue({ mode: 'FULL' }) },
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BR_ID }) },
    product: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(existing) // findOneRaw
        .mockResolvedValueOnce(null) // validateUniqueName
        .mockResolvedValueOnce({ ...existing, variants: existing.variants.slice(0, 1) }), // findOne final
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue((opts.ventas ?? []).map((variantId) => ({ variantId }))),
    },
    stockMovement: {
      findMany: jest.fn().mockResolvedValue((opts.movimientos ?? []).map((variantId) => ({ variantId }))),
    },
    $transaction: jest.fn(async (fn: any) => (typeof fn === 'function' ? fn(tx) : Promise.all(fn))),
  };

  return { svc: new ProductsService(prisma as any, {} as any, {} as any), prisma, tx };
}

describe('ProductsService: eliminación y cambio de variantes', () => {
  it('elimina una variante CON historial (ventas/movimientos): hace soft-delete, limpia VariantOptionValue y barre el valor eliminado', async () => {
    const existing = makeExistingProduct();
    const { svc, tx } = buildMocks(existing, { ventas: [VAR_L] });

    await svc.update(BIZ, MEMBER, PROD_ID, {
      name: 'Remera combinada',
      categoryId: CAT_ID,
      basePrice: 38000,
      status: 'PUBLISHED',
      options: [{ name: 'Talle', values: ['M'], isVisual: false }],
      variants: [{ id: VAR_M, sku: 'REM-M', price: 38000, optionValues: ['M'], initialStock: 1, stockMin: 0, isActive: true }],
    });

    expect(tx.productVariant.deleteMany).not.toHaveBeenCalled();
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [VAR_L] }, productId: PROD_ID },
      data: { deletedAt: expect.any(Date), isActive: false, isDefault: false },
    });
    expect(tx.variantOptionValue.deleteMany).toHaveBeenCalledWith({
      where: { variantId: { in: [VAR_L] } },
    });
    // Stock de L ya era 0: no crea movimiento innecesario
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    // Barre valores de opción huérfanos manteniendo solo VAL_M
    expect(tx.productOptionValue.deleteMany).toHaveBeenCalledWith({
      where: {
        option: { productId: PROD_ID },
        id: { notIn: [VAL_M] },
        variantOptionValues: { none: {} },
        images: { none: {} },
      },
    });
  });

  it('al archivar una variante con historial que todavía tiene stock > 0, lo deja en 0 con movimiento AJUSTE', async () => {
    const existing = makeExistingProduct();
    existing.variants[1].stock[0].quantity = 4;
    const { svc, tx } = buildMocks(existing, { movimientos: [VAR_L] });

    await svc.update(BIZ, MEMBER, PROD_ID, {
      name: 'Remera combinada',
      categoryId: CAT_ID,
      basePrice: 38000,
      status: 'PUBLISHED',
      options: [{ name: 'Talle', values: ['M'], isVisual: false }],
      variants: [{ id: VAR_M, sku: 'REM-M', price: 38000, optionValues: ['M'], initialStock: 1, stockMin: 0, isActive: true }],
    });

    expect(tx.variantStock.update).toHaveBeenCalledWith({ where: { id: 'st-l' }, data: { quantity: 0 } });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        businessId: BIZ,
        branchId: BR_ID,
        variantId: VAR_L,
        type: 'AJUSTE',
        quantity: -4,
        reason: 'Variante eliminada',
        createdBy: MEMBER,
      },
    });
  });

  it('elimina físicamente una variante SIN historial (sin ventas ni movimientos)', async () => {
    const existing = makeExistingProduct();
    const { svc, tx } = buildMocks(existing);

    await svc.update(BIZ, MEMBER, PROD_ID, {
      name: 'Remera combinada',
      categoryId: CAT_ID,
      basePrice: 38000,
      status: 'PUBLISHED',
      options: [{ name: 'Talle', values: ['M'], isVisual: false }],
      variants: [{ id: VAR_M, sku: 'REM-M', price: 38000, optionValues: ['M'], initialStock: 1, stockMin: 0, isActive: true }],
    });

    expect(tx.productVariant.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [VAR_L] }, productId: PROD_ID },
    });
    expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it('si se renombra una opción conservando la variante existente, re-vincula VariantOptionValue a los nuevos valores', async () => {
    const existing = makeExistingProduct({
      options: [{ id: OPT_TALLE, name: 'Talle', position: 0, isVisual: false, values: [{ id: VAL_M, value: 'M', position: 0 }] }],
      variants: [makeExistingProduct().variants[0]],
    });
    const { svc, tx } = buildMocks(existing);

    await svc.update(BIZ, MEMBER, PROD_ID, {
      name: 'Remera combinada',
      categoryId: CAT_ID,
      basePrice: 38000,
      status: 'PUBLISHED',
      options: [{ name: 'Tamaño', values: ['M'], isVisual: false }],
      variants: [{ id: VAR_M, sku: 'REM-M', price: 38000, optionValues: ['M'], initialStock: 1, stockMin: 0, isActive: true }],
    });

    expect(tx.variantOptionValue.deleteMany).toHaveBeenCalledWith({ where: { variantId: VAR_M } });
    expect(tx.variantOptionValue.createMany).toHaveBeenCalledWith({
      data: [{ variantId: VAR_M, optionValueId: 'val-new' }],
    });
    expect(tx.productOptionValue.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ['val-new'] } }),
      }),
    );
  });

  it('desvincula fotos asociadas a un valor de opción visual eliminado para que pueda barrerse', async () => {
    const existing = makeExistingProduct({
      options: [
        {
          id: OPT_TALLE,
          name: 'Color',
          position: 0,
          isVisual: true,
          values: [
            { id: VAL_M, value: 'Negro', position: 0 },
            { id: VAL_L, value: 'Rojo', position: 1 },
          ],
        },
      ],
    });
    const { svc, tx } = buildMocks(existing);

    await svc.update(BIZ, MEMBER, PROD_ID, {
      name: 'Remera combinada',
      categoryId: CAT_ID,
      basePrice: 38000,
      status: 'PUBLISHED',
      options: [{ name: 'Color', values: ['Negro'], isVisual: true }],
      variants: [{ id: VAR_M, sku: 'REM-N', price: 38000, optionValues: ['Negro'], initialStock: 1, stockMin: 0, isActive: true }],
    });

    expect(tx.productImage.updateMany).toHaveBeenCalledWith({
      where: {
        productId: PROD_ID,
        AND: [{ optionValueId: { not: null } }, { optionValueId: { notIn: [VAL_M] } }],
      },
      data: { optionValueId: null },
    });
  });

  it('findAll, findOne, stats y updateStatus filtran variantes con deletedAt: null', async () => {
    const existing = makeExistingProduct();
    const prisma = {
      product: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({}),
      },
      business: { findUnique: jest.fn().mockResolvedValue({ mode: 'FULL' }) },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };
    const svc = new ProductsService(prisma as any, {} as any, {} as any);

    await svc.findAll(BIZ, {});
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          variants: expect.objectContaining({ where: { deletedAt: null } }),
        }),
      }),
    );

    await svc.findOne(BIZ, PROD_ID);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          variants: expect.objectContaining({ where: { deletedAt: null } }),
        }),
      }),
    );

    await svc.stats(BIZ);
    expect(prisma.product.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          variants: expect.objectContaining({ where: { deletedAt: null } }),
        }),
      }),
    );

    await svc.updateStatus(BIZ, PROD_ID, { status: 'PUBLISHED' });
    expect(prisma.product.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          variants: expect.objectContaining({ where: { deletedAt: null } }),
        }),
      }),
    );
  });
});
