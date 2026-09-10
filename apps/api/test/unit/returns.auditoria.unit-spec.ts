import { UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReturnsService } from '../../src/returns/returns.service';
import { CreateReturnDto } from '../../src/returns/dto/create-return.dto';
import { CreateCreditNoteDto } from '../../src/returns/dto/create-credit-note.dto';

// Auditoría interna 2026-09-10, ítem `api.returns`.
//
// - Aprobar una devolución con nota de crédito no miraba cuántas notas ya
//   tenía el pedido: una manual por el total + la de la devolución = el doble.
// - Desde la tienda, el monto de la devolución no restaba el descuento del
//   renglón, así que en un producto con descuento la devolución fallaba
//   siempre ("supera lo que se pagó").
// - Emitir, anular y reactivar notas no quedaba registrado.

const BIZ = 'biz-1';

function devolucion(extra: Record<string, unknown> = {}) {
  return {
    id: 'r-1', orderId: 'o-1', orderItemId: 'oi-1', quantity: 1, amount: 1000, reason: 'talle', status: 'PENDING',
    refundMethod: 'CREDIT_NOTE', createdAt: new Date(), creditNote: null,
    order: {
      orderNumber: 5, branchId: 'b-1', customerId: 'c-1', total: 10000, business: { name: 'T' }, customer: null, onlineOrderDetails: null,
      items: [{ id: 'oi-1', productName: 'Remera', variantLabel: null, quantity: 2, isConcept: false, variantId: 'v-1' }],
    },
    ...extra,
  };
}

function devoluciones(opts: { yaEmitido?: number; claim?: number } = {}) {
  const tx = {
    return: { updateMany: jest.fn().mockResolvedValue({ count: opts.claim ?? 1 }) },
    variantStock: { upsert: jest.fn() },
    stockMovement: { create: jest.fn() },
    creditNote: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: opts.yaEmitido ?? 0 } }), create: jest.fn() },
  };
  const prisma = {
    return: { findFirst: jest.fn().mockResolvedValue(devolucion()) },
    creditNote: { findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true), sendReturnApproved: jest.fn() };
  const svc = new ReturnsService(prisma as any, mail as any, { emit: jest.fn() } as any, audit as any);
  return { svc, prisma, tx, audit, mail };
}

describe('Aprobar con nota de crédito', () => {
  it('si el pedido ya tiene notas por su total, no se emite otra y la aprobación entera se revierte', async () => {
    const { svc, tx } = devoluciones({ yaEmitido: 10000 });
    await expect(svc.update(BIZ, 'm-1', 'r-1', { status: 'APPROVED' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.creditNote.create).not.toHaveBeenCalled();
  });

  it('si entra, se emite y queda registrada la aprobación', async () => {
    const { svc, tx, audit } = devoluciones({ yaEmitido: 2000 });
    await svc.update(BIZ, 'm-1', 'r-1', { status: 'APPROVED' });
    expect(tx.creditNote.create).toHaveBeenCalledTimes(1);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'return', action: 'ACTIVATE', memberId: 'm-1' }));
  });

  it('una aprobación duplicada (otra pestaña ya la resolvió) no repone stock ni emite nada', async () => {
    const { svc, tx } = devoluciones({ claim: 0 });
    await expect(svc.update(BIZ, 'm-1', 'r-1', { status: 'APPROVED' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.variantStock.upsert).not.toHaveBeenCalled();
    expect(tx.creditNote.create).not.toHaveBeenCalled();
  });

  it('el mensaje de rechazo va escapado dentro del HTML del mail', async () => {
    const { svc, prisma, mail } = devoluciones();
    prisma.return.findFirst.mockResolvedValue(devolucion({ order: { ...devolucion().order, customer: { firstName: 'Ana', lastName: null, email: 'ana@x.com' } } }));
    await svc.update(BIZ, 'm-1', 'r-1', { status: 'REJECTED', rejectionMessage: '<b>no</b>' });
    expect(mail.sendCustomEmail.mock.calls[0][2]).toBe('&lt;b&gt;no&lt;/b&gt;');
  });
});

describe('Devolución pedida desde la tienda', () => {
  it('en un renglón con descuento el monto es lo que se pagó, no el precio de lista', async () => {
    const prisma = {
      businessConfig: { findUnique: jest.fn().mockResolvedValue({ returnsEnabled: true, returnsCreditNoteEnabled: true, returnsMpRefundEnabled: false }) },
      order: { findFirst: jest.fn().mockResolvedValue({ items: [{ unitPrice: 1000, editedPrice: null, discountAmount: 200, quantity: 2 }], payments: [] }) },
    };
    const svc = new ReturnsService(prisma as any, {} as any, { emit: jest.fn() } as any);
    const create = jest.spyOn(svc, 'create').mockResolvedValue({} as any);
    await svc.createForCustomer(BIZ, 'c-1', { orderId: 'o-1', orderItemId: 'oi-1', quantity: 1, reason: 'talle' });
    // $1.000 de lista − $100 de descuento por unidad = $900 (antes mandaba $1.000 y create() lo rechazaba).
    expect(create).toHaveBeenCalledWith(BIZ, expect.objectContaining({ amount: 900, refundMethod: 'CREDIT_NOTE' }));
  });
});

describe('Notas de crédito manuales', () => {
  it('reactivar escribe condicionado al estado y con el negocio, y queda registrado', async () => {
    const { svc, prisma, audit } = devoluciones();
    prisma.creditNote.findFirst.mockResolvedValue({ id: 'n-1', status: 'CANCELLED', amount: 500 });
    await svc.reactivateCreditNote(BIZ, 'n-1', 'm-1').catch(() => undefined);
    expect(prisma.creditNote.updateMany).toHaveBeenCalledWith({ where: { id: 'n-1', businessId: BIZ, status: 'CANCELLED' }, data: { status: 'ISSUED' } });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'credit_note', action: 'ACTIVATE', memberId: 'm-1' }));
  });

  it('si otra pestaña la tocó en el medio, reactivar no pisa nada', async () => {
    const { svc, prisma } = devoluciones();
    prisma.creditNote.findFirst.mockResolvedValue({ id: 'n-1', status: 'CANCELLED', amount: 500 });
    prisma.creditNote.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.reactivateCreditNote(BIZ, 'n-1', 'm-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('anular queda registrado con quién', async () => {
    const { svc, prisma, audit } = devoluciones();
    prisma.creditNote.findFirst.mockResolvedValue({ id: 'n-1', status: 'ISSUED', amount: 500 });
    await svc.cancelCreditNote(BIZ, 'n-1', 'm-1').catch(() => undefined);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'credit_note', action: 'DEACTIVATE', memberId: 'm-1' }));
  });

  it('los DTOs acotan cantidades y montos', async () => {
    const props = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);
    const uuid = '11111111-1111-4111-8111-111111111111';
    expect(await props(CreateReturnDto, { orderId: uuid, quantity: 3_000_000_000, amount: 10, reason: 'x', refundMethod: 'REFUND' })).toContain('quantity');
    expect(await props(CreateCreditNoteDto, { orderId: uuid, amount: 2e9, type: 'BALANCE' })).toContain('amount');
    expect(await props(CreateCreditNoteDto, { orderId: uuid, amount: 1500, type: 'BALANCE' })).toEqual([]);
  });
});
