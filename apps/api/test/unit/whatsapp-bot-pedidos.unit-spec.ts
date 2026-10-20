import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  WhatsappBotPedidosService, borradorVigente, esAfirmativo, esNegativo, textoDelResumen, VIGENCIA_BORRADOR_MS, type Borrador,
} from '../../src/whatsapp/whatsapp-bot-pedidos';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { OrdersService } from '../../src/orders/orders.service';

// Orbi toma pedidos por WhatsApp: el borrador se arma con datos reales de la tienda, el cliente confirma, y recién ahí se
// crea el pedido pendiente ("coordinar por WhatsApp"). Además: los dos avisos por correo y el "eliminar" del listado.

const BIZ = 'biz-1';
const CONV = 'cv-1';
const CLI = 'cli-1';
const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const TOPES = { maxUnidades: 10, maxMonto: 200000 };
const ctx = { businessId: BIZ, slug: 'rama', customerId: CLI, conversationId: CONV };

const linea = (v: string, cantidad: number, precio: number, extra: Record<string, unknown> = {}) => ({ variantId: v, ok: true, nombre: 'Remera', variante: 'M / Negro', precio, maxQty: 9, ...extra });

function armar(o: { carrito?: any; pago?: any; modo?: string; clienteLinea?: any; creacion?: 'ok' | Error; claim?: number } = {}) {
  const prisma: any = {
    businessConfig: { findUnique: jest.fn().mockResolvedValue(o.pago === undefined ? { acceptsTransfer: true, acceptsCoordinateLater: false, transferDiscountPercent: null } : o.pago) },
    business: { findFirst: jest.fn().mockResolvedValue({ mode: o.modo ?? 'FULL' }) },
    customer: { findFirst: jest.fn().mockResolvedValue(o.clienteLinea === undefined ? { firstName: 'Ana', lastName: 'Paz', email: null, phone: null } : o.clienteLinea) },
    conversation: { updateMany: jest.fn().mockResolvedValue({ count: o.claim ?? 1 }) },
  };
  const storefront: any = {
    validateCart: jest.fn().mockResolvedValue(o.carrito ?? { items: [linea(V1, 2, 10000)], ticketDiscount: null, coupon: null }),
  };
  const orders: any = {
    create: o.creacion instanceof Error ? jest.fn().mockRejectedValue(o.creacion) : jest.fn().mockResolvedValue({ id: 'ord-1', orderNumber: 57, total: '20000.00' }),
  };
  const notificaciones: any = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const svc = new WhatsappBotPedidosService(prisma, storefront, orders, notificaciones);
  return { svc, prisma, storefront, orders, notificaciones };
}

const borrador = (extra: Partial<Borrador> = {}): Borrador => ({
  lineas: [{ variantId: V1, nombre: 'Remera', variante: 'M / Negro', cantidad: 2, precio: 10000 }],
  subtotal: 20000, descuento: 0, total: 20000, creadoEn: new Date().toISOString(), ...extra,
});

describe('textos y detección', () => {
  it('el resumen lo arma el sistema con los números de la base y pide confirmación', () => {
    const t = textoDelResumen(borrador());
    expect(t).toContain('2 × Remera (M / Negro) — $20.000');
    expect(t).toContain('*Total estimado: $20.000*');
    expect(t).toContain('¿Confirmo el pedido?');
    expect(t).not.toContain('Descuento');
  });
  it('con descuento muestra subtotal y descuento; con muchos productos corta la lista', () => {
    expect(textoDelResumen(borrador({ subtotal: 22000, descuento: 2000, total: 20000 }))).toMatch(/Subtotal: \$22\.000\nDescuento: -\$2\.000/);
    const lineas = Array.from({ length: 10 }, (_, i) => ({ variantId: `v${i}`, nombre: `P${i}`, variante: null, cantidad: 1, precio: 100 }));
    const t = textoDelResumen(borrador({ lineas }));
    expect(t).toContain('…y 2 productos más');
    expect(t.length).toBeLessThan(1024);
  });
  it('"sí", "dale", "confirmo" confirman; "cambiar", "no" cambian; una frase con más cosas no es ninguna de las dos', () => {
    for (const t of ['sí', 'Si!', 'dale', 'Confirmo', 'ok', 'de una', 'perfecto']) expect(esAfirmativo(t)).toBe(true);
    for (const t of ['cambiar', 'No', 'cancelar', 'modificar']) expect(esNegativo(t)).toBe(true);
    for (const t of ['sí pero cambiá el talle', 'quiero otro', 'no tengo plata', 'cuánto sale el envío']) {
      expect(esAfirmativo(t)).toBe(false);
      expect(esNegativo(t)).toBe(false);
    }
  });
  it('el borrador vence a los 30 minutos y se descartan formas raras', () => {
    expect(borradorVigente(borrador())).not.toBeNull();
    expect(borradorVigente(borrador({ creadoEn: new Date(Date.now() - VIGENCIA_BORRADOR_MS - 1000).toISOString() }))).toBeNull();
    for (const raro of [null, undefined, 'x', {}, { lineas: [] }, { lineas: [{}], total: 'mucho', creadoEn: 1 }]) expect(borradorVigente(raro)).toBeNull();
  });
});

describe('disponibilidad', () => {
  it('necesita tienda con ventas online y "coordinar por WhatsApp" (o coordinar el pago después)', async () => {
    expect((await armar().svc.disponibilidad(BIZ)).ok).toBe(true);
    expect((await armar({ pago: { acceptsTransfer: false, acceptsCoordinateLater: true } }).svc.disponibilidad(BIZ)).ok).toBe(true);
    const sin = await armar({ pago: { acceptsTransfer: false, acceptsCoordinateLater: false } }).svc.disponibilidad(BIZ);
    expect(sin.ok).toBe(false);
    expect(sin.motivo).toContain('Coordinar por WhatsApp');
    expect((await armar({ modo: 'SHOWCASE' }).svc.disponibilidad(BIZ)).motivo).toContain('vidriera');
  });
});

describe('preparar (el borrador)', () => {
  it('valida contra la tienda, calcula el total con el precio real y lo guarda en el chat sin crear ningún pedido', async () => {
    const t = armar();
    const r = await t.svc.preparar(ctx, TOPES, [{ variante_id: V1, cantidad: 2 }]);
    expect(r).toMatchObject({ ok: true, datos: { total_estimado: 20000 } });
    expect(t.storefront.validateCart).toHaveBeenCalledWith('rama', [{ variantId: V1, quantity: 2 }], { customerId: CLI });
    const guardado = t.prisma.conversation.updateMany.mock.calls[0][0];
    expect(guardado.where).toEqual({ id: CONV, businessId: BIZ });
    expect(guardado.data.botBorrador).toMatchObject({ subtotal: 20000, total: 20000, lineas: [{ variantId: V1, cantidad: 2, precio: 10000 }] });
    expect(t.orders.create).not.toHaveBeenCalled();
  });
  it('el precio es el de la tienda (con sus descuentos), no el que diga el modelo; resta el descuento del ticket', async () => {
    const t = armar({ carrito: { items: [linea(V1, 3, 9000)], ticketDiscount: { monto: 2700 }, coupon: null } });
    await t.svc.preparar(ctx, TOPES, [{ variante_id: V1, cantidad: 3 }]);
    expect(t.prisma.conversation.updateMany.mock.calls[0][0].data.botBorrador).toMatchObject({ subtotal: 27000, descuento: 2700, total: 24300 });
  });
  it('junta los renglones repetidos de una misma variante', async () => {
    const t = armar();
    await t.svc.preparar(ctx, TOPES, [{ variante_id: V1, cantidad: 1 }, { variante_id: V1, cantidad: 2 }]);
    expect(t.storefront.validateCart.mock.calls[0][1]).toEqual([{ variantId: V1, quantity: 3 }]);
  });
  it('rechaza lo que el modelo manda mal: ids raros, cantidades inválidas, sin productos', async () => {
    const t = armar();
    for (const items of [undefined, [], [{ variante_id: "x'; drop", cantidad: 1 }], [{ variante_id: V1, cantidad: 0 }], [{ variante_id: V1, cantidad: 1.5 }], [{ variante_id: V1, cantidad: 'dos' }]]) {
      expect((await t.svc.preparar(ctx, TOPES, items)).ok).toBe(false);
    }
    expect(t.storefront.validateCart).not.toHaveBeenCalled();
    expect(t.prisma.conversation.updateMany).not.toHaveBeenCalled();
  });
  it('respeta los topes del dueño: unidades, monto y cantidad de productos distintos', async () => {
    const t = armar();
    expect((await t.svc.preparar(ctx, { ...TOPES, maxUnidades: 2 }, [{ variante_id: V1, cantidad: 3 }])).ok).toBe(false);
    expect((await t.svc.preparar(ctx, { ...TOPES, maxMonto: 5000 }, [{ variante_id: V1, cantidad: 2 }])).ok).toBe(false);
    const once = Array.from({ length: 11 }, (_, i) => ({ variante_id: `${i.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`, cantidad: 1 }));
    expect((await t.svc.preparar(ctx, TOPES, once)).ok).toBe(false);
    expect(t.prisma.conversation.updateMany).not.toHaveBeenCalled();
  });
  it('sin stock o con stock insuficiente no arma nada y dice qué pasó', async () => {
    const t = armar({ carrito: { items: [linea(V1, 5, 100, { ok: false, motivo: 'STOCK_INSUFICIENTE', maxQty: 2 }), linea(V2, 1, 100, { ok: false, motivo: 'SIN_STOCK', nombre: 'Gorra', variante: null })], ticketDiscount: null } });
    const r = await t.svc.preparar(ctx, TOPES, [{ variante_id: V1, cantidad: 5 }, { variante_id: V2, cantidad: 1 }]);
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain('solo quedan 2');
    expect((r as { error: string }).error).toContain('Gorra: sin stock');
    expect(t.prisma.conversation.updateMany).not.toHaveBeenCalled();
  });
  it('si la tienda no puede tomar pedidos, no arma nada', async () => {
    const t = armar({ pago: { acceptsTransfer: false, acceptsCoordinateLater: false } });
    expect((await t.svc.preparar(ctx, TOPES, [{ variante_id: V1, cantidad: 1 }])).ok).toBe(false);
    expect(t.storefront.validateCart).not.toHaveBeenCalled();
  });
});

describe('confirmar', () => {
  const p = (b: unknown) => ({ businessId: BIZ, conversationId: CONV, customerId: CLI, waId: '5491122334455', slug: 'rama', tienda: 'Rama', borrador: b });

  it('crea el pedido pendiente "coordinar por WhatsApp" para este cliente y avisa al dueño', async () => {
    const t = armar();
    const r = await t.svc.confirmar(p(borrador()));
    expect(r).toMatchObject({ ok: true, pedido: { id: 'ord-1', numero: 57, total: 20000 } });
    expect(r.texto).toContain('#57');
    expect(r.texto).toContain('$20.000');
    const [bizId, dto, opts] = t.orders.create.mock.calls[0];
    expect(bizId).toBe(BIZ);
    expect(dto).toMatchObject({
      channel: 'ONLINE', customerId: CLI, items: [{ variantId: V1, quantity: 2 }], paymentMethod: 'TRANSFER',
      buyer: { name: 'Ana Paz', phone: '5491122334455' },
    });
    expect(dto.buyer).not.toHaveProperty('email');
    expect(dto.notes).toContain('tomado por Orbi por WhatsApp');
    expect(opts).toEqual({ publicCheckout: true, paymentMethodChosen: true, porWhatsapp: true });
    expect(t.notificaciones.dispatch).toHaveBeenCalledWith('orbi_pedido_pendiente', BIZ, expect.objectContaining({
      resourceType: 'order', resourceId: 'ord-1', emailBody: expect.stringContaining('/admin/biz-1/ventas/pedidos?vista=detalle&id=ord-1'),
    }));
  });
  it('con "coordinar el pago después" no manda método de pago; con descuento por coordinar, lo aplica como la tienda', async () => {
    const a = armar({ pago: { acceptsTransfer: false, acceptsCoordinateLater: true } });
    await a.svc.confirmar(p(borrador()));
    expect(a.orders.create.mock.calls[0][1]).not.toHaveProperty('paymentMethod');
    const b = armar({ pago: { acceptsTransfer: true, acceptsCoordinateLater: false, transferDiscountPercent: new Prisma.Decimal(10) } });
    await b.svc.confirmar(p(borrador()));
    expect(b.orders.create.mock.calls[0][1]).toMatchObject({ manualDiscountPercent: 10 });
  });
  it('el borrador se reclama antes de crear: tocar dos veces "Confirmar" no crea dos pedidos', async () => {
    const t = armar({ claim: 0 });
    const r = await t.svc.confirmar(p(borrador()));
    expect(r.ok).toBe(false);
    expect(t.orders.create).not.toHaveBeenCalled();
  });
  it('un borrador vencido o inexistente no crea nada', async () => {
    const t = armar();
    const vencido = borrador({ creadoEn: new Date(Date.now() - VIGENCIA_BORRADOR_MS - 5000).toISOString() });
    for (const b of [vencido, null]) {
      const r = await t.svc.confirmar(p(b));
      expect(r.ok).toBe(false);
      expect(r.texto).toMatch(/venció|ya no está/);
    }
    expect(t.orders.create).not.toHaveBeenCalled();
  });
  it('si la tienda rechaza el pedido (ej. sin stock) se lo cuenta al cliente y deriva; un error interno no se le cuenta', async () => {
    const a = armar({ creacion: new UnprocessableEntityException('No hay stock suficiente. Remera: quedan 1.') });
    const ra = await a.svc.confirmar(p(borrador()));
    expect(ra).toMatchObject({ ok: false });
    expect(ra.texto).toContain('No hay stock suficiente');
    expect((ra as { derivar: string }).derivar).toBeTruthy();
    expect(a.notificaciones.dispatch).not.toHaveBeenCalled();
    const b = armar({ creacion: new Error('connection string postgres://secreto') });
    const rb = await b.svc.confirmar(p(borrador()));
    expect(rb.texto).not.toContain('postgres');
    expect(rb.ok).toBe(false);
  });
});

describe('avisos por correo de Orbi (motor de notificaciones)', () => {
  function motor(matrix: any = {}) {
    const prisma: any = {
      notificationConfig: { findUnique: jest.fn().mockResolvedValue({ matrix }) },
      notification: { create: jest.fn() },
      member: { findMany: jest.fn().mockResolvedValue([{ email: 'dueno@rama.com' }]) },
    };
    const mail: any = { sendCustomEmail: jest.fn().mockResolvedValue(true), sendNewOrderToTeam: jest.fn() };
    return { svc: new NotificationsService(prisma, mail), prisma, mail };
  }

  it.each(['orbi_necesita_atencion', 'orbi_pedido_pendiente'])('%s llega por el panel Y por correo aunque el dueño nunca haya tocado las notificaciones', async (evento) => {
    const { svc, prisma, mail } = motor({});
    await svc.dispatch(evento, BIZ, { title: 'Titulo', body: 'Cuerpo', emailSubject: 'Asunto', emailBody: 'Abrir: http://x' });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(mail.sendCustomEmail).toHaveBeenCalledWith('dueno@rama.com', 'Asunto', expect.stringContaining('Abrir: http://x'), { businessId: BIZ });
  });
  it('si el dueño apagó el correo de ese aviso, no se manda (la campanita sí)', async () => {
    const { svc, prisma, mail } = motor({ orbi_necesita_atencion: { panel: true, email: false } });
    await svc.dispatch('orbi_necesita_atencion', BIZ, { title: 't', body: 'b' });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
  it('el resto de los eventos sigue como siempre: sin configurar, solo panel', async () => {
    const { svc, mail } = motor({});
    await svc.dispatch('nuevo_pedido', BIZ, { title: 't', body: 'b' });
    expect(mail.sendCustomEmail).not.toHaveBeenCalled();
  });
});

describe('OrdersService.eliminar (ocultar un pedido del listado)', () => {
  function servicio(order: unknown) {
    const prisma: any = {
      order: { findFirst: jest.fn().mockResolvedValue(order), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const audit: any = { registrar: jest.fn().mockResolvedValue(undefined) };
    return { svc: new OrdersService(prisma, {} as any, {} as any, { emit: jest.fn() } as any, audit), prisma, audit };
  }

  it('lo oculta con deletedAt (no lo borra), solo de este negocio, y lo deja en la auditoría', async () => {
    const { svc, prisma, audit } = servicio({ id: 'o-1', orderNumber: 12, status: 'PENDING' });
    await expect(svc.eliminar(BIZ, 'm-1', 'o-1')).resolves.toEqual({ ok: true });
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o-1', businessId: BIZ, deletedAt: null } }));
    const upd = prisma.order.updateMany.mock.calls[0][0];
    expect(upd.where).toEqual({ id: 'o-1', businessId: BIZ, deletedAt: null });
    expect(upd.data.deletedAt).toBeInstanceOf(Date);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, memberId: 'm-1', entityType: 'order', entityId: 'o-1', action: 'DELETE' }));
  });
  it('un pedido de otro negocio (o ya eliminado) da 404 y no toca nada', async () => {
    const { svc, prisma, audit } = servicio(null);
    await expect(svc.eliminar(BIZ, 'm-1', 'ajeno')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });
});
