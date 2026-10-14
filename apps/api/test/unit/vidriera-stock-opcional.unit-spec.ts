import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { CreateProductDto } from '../../src/products/dto/create-product.dto';
import { ProductsService } from '../../src/products/products.service';
import { stockDeVidriera } from '../../src/storefront/storefront.service';

// En una VIDRERIA (business.mode = SHOWCASE) el stock es opcional: si el negocio lo deja en blanco, la tienda no muestra
// unidades, "Sin stock" ni "Últimas unidades", y el producto se lista igual. En una tienda con checkout nada cambia.

const BIZ = 'biz-1';

describe('stockDeVidriera (lo que la tienda pública hace con una variante sin stock cargado)', () => {
  const sinCargar = { showStock: false, stock: [{ quantity: 0, stockMin: 5 }] };
  const cargada = { showStock: true, stock: [{ quantity: 3, stockMin: 5 }] };

  it('en una vidriera, la variante sin stock cargado cuenta como disponible, sin "últimas unidades" y sin cantidad visible', () => {
    const v = stockDeVidriera(sinCargar, true);
    expect(v.stockVisible).toBe(false);
    expect(v.stock[0].quantity).toBeGreaterThan(0); // en stock: el producto se lista y la combinación no se tacha
    expect(v.stock[0].stockMin).toBe(0); // y nunca llega al umbral de "quedan pocas"
  });

  it('en una vidriera, la variante CON stock cargado se muestra tal cual (si cargó 3, se ven 3 y "últimas unidades")', () => {
    const v = stockDeVidriera(cargada, true);
    expect(v.stockVisible).toBe(true);
    expect(v.stock).toEqual([{ quantity: 3, stockMin: 5 }]);
  });

  it('un 0 cargado a propósito en una vidriera: se ve "Sin stock" solo si el dueño lo escribió (showStock true)', () => {
    const v = stockDeVidriera({ showStock: true, stock: [{ quantity: 0, stockMin: 0 }] }, true);
    expect(v.stockVisible).toBe(true);
    expect(v.stock[0].quantity).toBe(0);
  });

  it('en una tienda con checkout se ignora showStock: el stock es real y siempre se ve', () => {
    const v = stockDeVidriera(sinCargar, false);
    expect(v.stockVisible).toBe(true);
    expect(v.stock).toEqual([{ quantity: 0, stockMin: 5 }]);
  });
});

describe('Producto: stock opcional solo en la vidriera', () => {
  const dto = (variants: object[]) => ({
    name: 'Remera', categoryId: '8b1f0f1e-3b8a-4f7e-9d6e-1f2a3b4c5d6e', basePrice: 1000, status: 'PUBLISHED', options: [], variants,
  });

  function armar(mode: 'FULL' | 'SHOWCASE') {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ mode }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'br-1' }) },
      // Llegar acá = pasó todas las validaciones.
      $transaction: jest.fn().mockRejectedValue(new Error('llegó a la transacción')),
    };
    return { svc: new ProductsService(prisma as any, {} as any, {} as any), prisma };
  }

  it('el DTO acepta showStock en cada variante', async () => {
    const e = await validate(plainToInstance(CreateProductDto, dto([{ price: 1000, optionValues: [], showStock: false }])));
    expect(e).toEqual([]);
  });

  it('en una vidriera se puede publicar un producto SIN stock', async () => {
    const { svc } = armar('SHOWCASE');
    await expect(svc.create(BIZ, dto([{ price: 1000, optionValues: [], showStock: false }]) as any)).rejects.toThrow('llegó a la transacción');
  });

  it('en una tienda con checkout sigue sin poder publicarse un producto sin stock, aunque mande showStock:false', async () => {
    const { svc } = armar('FULL');
    await expect(svc.create(BIZ, dto([{ price: 1000, optionValues: [], showStock: false }]) as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
