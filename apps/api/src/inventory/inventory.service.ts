import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockEntryDto } from './dto/stock-entry.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { FindStockQueryDto } from './dto/find-stock-query.dto';
import { FindMovementsQueryDto } from './dto/find-movements-query.dto';
import { UpsertSupplierDto } from './dto/upsert-supplier.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Stock ────────────────────────────────────────────────────────────────

  async stock(businessId: string, query: FindStockQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const branchId = query.branch_id ?? (await this.getDefaultBranch(businessId)).id;

    const where: Prisma.VariantStockWhereInput = {
      branchId,
      variant: {
        product: {
          businessId,
          deletedAt: null,
          ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
        },
      },
    };

    const rows = await this.prisma.variantStock.findMany({
      where,
      include: {
        variant: {
          include: {
            product: { select: { id: true, name: true } },
            optionValues: { include: { optionValue: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let mapped = rows.map((r) => ({
      variantId: r.variantId,
      productId: r.variant.product.id,
      productName: r.variant.product.name,
      variantLabel:
        r.variant.optionValues.length > 0
          ? r.variant.optionValues.map((ov) => ov.optionValue.value).join(' / ')
          : null,
      sku: r.variant.sku,
      quantity: r.quantity,
      stockMin: r.stockMin,
      isLowStock: r.quantity <= r.stockMin,
      price: Number(r.variant.price),
    }));

    // lowStock compara dos columnas (quantity <= stockMin): no es expresable
    // directamente en el where de Prisma, así que se filtra y pagina en memoria.
    if (query.lowStock === 'true') {
      mapped = mapped.filter((r) => r.isLowStock);
    }

    const total = mapped.length;
    const data = mapped.slice((page - 1) * limit, (page - 1) * limit + limit);

    return { data, total, page, limit };
  }

  // ── Entrada de stock ─────────────────────────────────────────────────────

  async entry(businessId: string, memberId: string, dto: StockEntryDto) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad de una entrada debe ser positiva');
    }
    const branchId = dto.branch_id ?? (await this.getDefaultBranch(businessId)).id;
    await this.validateVariant(businessId, dto.variantId);
    if (dto.supplierId) await this.validateSupplier(businessId, dto.supplierId);

    return this.applyMovement(businessId, memberId, {
      variantId: dto.variantId,
      branchId,
      type: 'ENTRADA',
      quantity: dto.quantity,
      reason: dto.reason ?? 'Entrada de mercadería',
      supplierId: dto.supplierId ?? null,
    });
  }

  // ── Ajuste de stock ──────────────────────────────────────────────────────

  async adjustment(businessId: string, memberId: string, dto: StockAdjustmentDto) {
    if (dto.quantity === 0) {
      throw new BadRequestException('La cantidad del ajuste no puede ser cero');
    }
    const branchId = dto.branch_id ?? (await this.getDefaultBranch(businessId)).id;
    await this.validateVariant(businessId, dto.variantId);

    return this.applyMovement(businessId, memberId, {
      variantId: dto.variantId,
      branchId,
      type: 'AJUSTE',
      quantity: dto.quantity,
      reason: dto.reason,
      supplierId: null,
    });
  }

  private async applyMovement(
    businessId: string,
    memberId: string,
    input: {
      variantId: string;
      branchId: string;
      type: 'ENTRADA' | 'AJUSTE';
      quantity: number;
      reason: string;
      supplierId: string | null;
    },
  ) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.variantStock.findUnique({
        where: { variantId_branchId: { variantId: input.variantId, branchId: input.branchId } },
      });

      const newQuantity = (existing?.quantity ?? 0) + input.quantity;
      if (newQuantity < 0) {
        throw new UnprocessableEntityException(
          `El ajuste dejaría el stock en negativo (actual: ${existing?.quantity ?? 0}, movimiento: ${input.quantity})`,
        );
      }

      const stock = existing
        ? await tx.variantStock.update({ where: { id: existing.id }, data: { quantity: newQuantity } })
        : await tx.variantStock.create({
            data: { variantId: input.variantId, branchId: input.branchId, quantity: newQuantity, stockMin: 0 },
          });

      const movement = await tx.stockMovement.create({
        data: {
          businessId,
          branchId: input.branchId,
          variantId: input.variantId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
          supplierId: input.supplierId,
          createdBy: memberId,
        },
      });

      const variant = await tx.productVariant.findUnique({
        where: { id: input.variantId },
        include: { product: { select: { name: true } }, optionValues: { include: { optionValue: true } } },
      });

      return {
        id: movement.id,
        variantId: movement.variantId,
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason,
        supplierId: movement.supplierId,
        createdAt: movement.createdAt.toISOString(),
        newQuantity: stock.quantity,
        stockMin: stock.stockMin,
        productName: variant?.product.name ?? '',
        variantLabel:
          variant && variant.optionValues.length > 0
            ? variant.optionValues.map((ov) => ov.optionValue.value).join(' / ')
            : null,
      };
    });

    // El evento se emite FUERA de la transacción a propósito: si el ajuste
    // falla y hace rollback, no tiene sentido avisar de un stock que nunca
    // cambió de verdad.
    if (resultado.newQuantity <= resultado.stockMin) {
      this.eventEmitter.emit('notification.stock_critico', {
        businessId,
        productName: resultado.productName,
        variantLabel: resultado.variantLabel,
        currentStock: resultado.newQuantity,
        variantId: resultado.variantId,
      });
    }

    const { stockMin, productName, variantLabel, ...respuesta } = resultado;
    return respuesta;
  }

  // ── Historial de movimientos ─────────────────────────────────────────────

  async movements(businessId: string, query: FindMovementsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.StockMovementWhereInput = {
      businessId,
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.branch_id ? { branchId: query.branch_id } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, movements] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: {
          variant: { include: { product: { select: { name: true } } } },
          creator: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: movements.map((m) => ({
        id: m.id,
        variantId: m.variantId,
        productName: m.variant.product.name,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        supplierId: m.supplierId,
        orderId: m.orderId,
        createdBy: m.createdBy,
        createdByName: m.creator?.name ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  // ── Suppliers ────────────────────────────────────────────────────────────

  async findAllSuppliers(businessId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { businessId },
      include: {
        stockMovements: { where: { type: 'ENTRADA' }, select: { quantity: true, createdAt: true } },
      },
      orderBy: { name: 'asc' },
    });

    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contact: s.contact,
      phone: s.phone,
      email: s.email,
      lastPurchase:
        s.stockMovements.length > 0
          ? s.stockMovements
              .reduce((max, m) => (m.createdAt > max ? m.createdAt : max), s.stockMovements[0].createdAt)
              .toISOString()
          : null,
      totalPurchased: s.stockMovements.reduce((sum, m) => sum + m.quantity, 0),
    }));
  }

  async createSupplier(businessId: string, dto: UpsertSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        businessId,
        name: dto.name,
        contact: dto.contact ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
      },
    });
  }

  async updateSupplier(businessId: string, id: string, dto: UpsertSupplierDto) {
    await this.findSupplierRaw(businessId, id);
    // businessId va en el where del updateMany — la query garantiza el
    // aislamiento por sí misma, no depende del findSupplierRaw previo.
    const { count } = await this.prisma.supplier.updateMany({
      where: { id, businessId },
      data: { name: dto.name, contact: dto.contact ?? null, phone: dto.phone ?? null, email: dto.email ?? null },
    });
    if (count === 0) throw new NotFoundException('Proveedor no encontrado');
    return this.findSupplierRaw(businessId, id);
  }

  async removeSupplier(businessId: string, id: string) {
    await this.findSupplierRaw(businessId, id);
    // stock_movements.supplier_id es ON DELETE SET NULL (ver migration.sql) —
    // el historial de movimientos se conserva, solo pierde la referencia al
    // proveedor. No hay bloqueo por FK que capturar acá.
    const { count } = await this.prisma.supplier.deleteMany({ where: { id, businessId } });
    if (count === 0) throw new NotFoundException('Proveedor no encontrado');
    return { ok: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findSupplierRaw(businessId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }

  private async validateVariant(businessId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { businessId } },
    });
    if (!variant) throw new BadRequestException('Variante inválida');
  }

  private async validateSupplier(businessId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new BadRequestException('Proveedor inválido');
  }

  private async getDefaultBranch(businessId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { businessId, isDefault: true } });
    if (!branch) throw new UnprocessableEntityException('El negocio no tiene una sucursal principal configurada');
    return branch;
  }
}
