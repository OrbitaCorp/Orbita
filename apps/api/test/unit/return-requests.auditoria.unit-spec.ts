import { UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReturnRequestsService } from '../../src/return-requests/return-requests.service';
import { CreateReturnRequestDto, ReturnRequestReason } from '../../src/return-requests/dto/create-return-request.dto';

// Auditoría interna 2026-09-10, ítem `api.return-requests`.
//
// El formulario público de arrepentimiento no miraba ni el pedido ni el
// email: cualquiera hacía que Órbita mandara un mail con el nombre de la
// tienda y un comentario a su gusto a cualquier dirección.

const BIZ = 'biz-1';

function solicitudes(pedido: unknown) {
  const prisma = {
    order: { findFirst: jest.fn().mockResolvedValue(pedido) },
    businessConfig: { findUnique: jest.fn().mockResolvedValue({ email: 'tienda@x.com' }) },
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Tienda' }) },
  };
  const storefront = { resolveBusinessId: jest.fn().mockResolvedValue(BIZ) };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  return { svc: new ReturnRequestsService(prisma as any, storefront as any, mail as any), prisma, mail };
}

const base = { orderNumber: '17', email: 'ana@x.com', reason: ReturnRequestReason.ARREPENTIMIENTO };
const pedidoInvitado = { orderNumber: 17, customer: null, onlineOrderDetails: { buyerEmail: 'Ana@X.com' } };

describe('Solo el comprador inicia el trámite', () => {
  it('busca el pedido por número dentro de la tienda', async () => {
    const { svc, prisma } = solicitudes(pedidoInvitado);
    await svc.create('tienda', base);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, orderNumber: 17, deletedAt: null } }));
  });

  it('pedido inexistente: 422 y no sale ningún mail', async () => {
    const { svc, mail } = solicitudes(null);
    await expect(svc.create('tienda', base)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });

  it('email que no es el de la compra: el mismo mensaje (no revela que el pedido existe) y ningún mail', async () => {
    const { svc, mail } = solicitudes(pedidoInvitado);
    const inexistente = await solicitudes(null).svc.create('tienda', base).catch((e: Error) => e.message);
    const ajeno = await svc.create('tienda', { ...base, email: 'otro@x.com' }).catch((e: Error) => e.message);
    expect(ajeno).toBe(inexistente);
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });

  it('invitado con el email del pedido (sin importar mayúsculas): acuse al cliente y aviso al comercio', async () => {
    const { svc, mail } = solicitudes(pedidoInvitado);
    const r = await svc.create('tienda', base);
    expect(r.trackingNumber).toMatch(/^AR-\d{6}-[0-9A-F]{6}$/);
    expect(mail.sendCustomEmail.mock.calls.map((c) => c[0])).toEqual(['ana@x.com', 'tienda@x.com']);
  });

  it('cliente con cuenta: vale el email de la cuenta', async () => {
    const { svc, mail } = solicitudes({ orderNumber: 17, customer: { email: 'ana@x.com' }, onlineOrderDetails: null });
    await svc.create('tienda', base);
    expect(mail.sendCustomEmail).toHaveBeenCalledTimes(2);
  });

  it('el comentario va escapado en los dos mails', async () => {
    const { svc, mail } = solicitudes(pedidoInvitado);
    await svc.create('tienda', { ...base, comment: `<a href='http://x'>click</a>` });
    for (const [, , html] of mail.sendCustomEmail.mock.calls) {
      expect(html).not.toContain('<a href');
      expect(html).toContain('&lt;a href=&#39;http://x&#39;&gt;');
    }
  });
});

describe('DTO del formulario', () => {
  const dto = async (body: object) => {
    const inst = plainToInstance(CreateReturnRequestDto, { ...base, ...body });
    return { inst, errores: (await validate(inst)).map((e) => e.property) };
  };

  it('acepta el número con "#" y normaliza el email', async () => {
    const { inst, errores } = await dto({ orderNumber: ' #1024 ', email: ' Ana@X.com ' });
    expect(errores).toEqual([]);
    expect(inst.orderNumber).toBe('1024');
    expect(inst.email).toBe('ana@x.com');
  });

  it.each([['texto', 'abc'], ['vacío', ''], ['fuera del Int de Postgres', '12345678901']])('rechaza un número de pedido %s', async (_c, orderNumber) => {
    expect((await dto({ orderNumber })).errores).toContain('orderNumber');
  });

  it('el teléfono solo lleva números y signos de teléfono', async () => {
    expect((await dto({ phone: '+54 (11) 2345-6789' })).errores).toEqual([]);
    expect((await dto({ phone: '<b>llamame</b>' })).errores).toContain('phone');
  });
});
