import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// Alta manual de pedidos desde el panel (Ale, 08/09): dos modalidades.
//  - Venta presencial (channel POS): nace COMPLETED, descuenta el stock y
//    deja el cobro APROBADO en el momento; exige método de pago.
//  - Pedido online (channel ONLINE): nace PENDING como los de la tienda; el
//    método de pago es opcional y queda PENDING hasta confirmar.
// Más el aviso al comprador por email (notifyCustomer) — en e2e el mail sale
// como [MAIL STUB] o por Resend según el .env; acá solo se verifica que el
// alta no se rompa por eso y que el pedido quede bien.
//
// Todo lo que crea lleva el prefijo en las notas y se borra en afterAll; el
// stock que descuenta la venta presencial se devuelve a mano.
const PREFIJO = '[e2e-alta-manual]';

describe('Alta manual de pedidos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let branchId: string;
  let variantId: string;
  let stockInicial: number;
  const creados: string[] = [];

  const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
  const http = () => request(app.getHttpServer());

  function cuerpo(over: Record<string, unknown> = {}) {
    return {
      channel: 'POS',
      buyer: { name: `${PREFIJO} Comprador` },
      items: [{ variantId, quantity: 1 }],
      paymentMethod: 'CASH',
      notes: PREFIJO,
      ...over,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const ownerRes = await http()
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;

    const branch = await prisma.branch.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    branchId = branch!.id;

    // Una variante con stock suficiente en la sucursal principal.
    const stock = await prisma.variantStock.findFirst({
      where: { branchId, quantity: { gte: 3 }, variant: { product: { businessId, deletedAt: null } } },
      select: { variantId: true, quantity: true },
      orderBy: { quantity: 'desc' },
    });
    variantId = stock!.variantId;
    stockInicial = stock!.quantity;
  });

  afterAll(async () => {
    // Devolver el stock que descontaron las ventas presenciales y borrar
    // todo lo que cuelga de los pedidos de prueba.
    await prisma.variantStock.updateMany({ where: { variantId, branchId }, data: { quantity: stockInicial } });
    if (creados.length) {
      await prisma.stockMovement.deleteMany({ where: { orderId: { in: creados } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: creados } } });
      await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: creados } } });
      await prisma.onlineOrderDetails.deleteMany({ where: { orderId: { in: creados } } });
      await prisma.discountRedemption.deleteMany({ where: { orderId: { in: creados } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: creados } } });
      await prisma.order.deleteMany({ where: { id: { in: creados } } });
    }
    await closeTestApp();
  });

  describe('venta presencial (channel POS)', () => {
    it('sin método de pago → 400 con el motivo', async () => {
      const res = await http().post('/api/v1/orders').set(auth()).send(cuerpo({ paymentMethod: undefined })).expect(400);
      expect(res.body.message).toMatch(/cobró/i);
    });

    it('nace COMPLETED, con origen MANUAL y el cobro aprobado', async () => {
      const res = await http().post('/api/v1/orders').set(auth()).send(cuerpo()).expect(201);
      creados.push(res.body.id);
      expect(res.body.channel).toBe('POS');
      expect(res.body.origin).toBe('MANUAL');
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.payments).toHaveLength(1);
      expect(res.body.payments[0]).toMatchObject({ method: 'CASH', status: 'APPROVED' });
      expect(res.body.payments[0].amount).toBe(res.body.total);
      // Historial: un solo paso, directo a completado.
      expect(res.body.statusHistory.map((h: { status: string }) => h.status)).toEqual(['COMPLETED']);
    });

    it('descuenta el stock en el momento y deja el movimiento', async () => {
      const stock = await prisma.variantStock.findFirst({ where: { variantId, branchId }, select: { quantity: true } });
      expect(stock!.quantity).toBe(stockInicial - 1);
      const mov = await prisma.stockMovement.findFirst({ where: { orderId: creados[0] } });
      expect(mov).toMatchObject({ type: 'SALIDA', quantity: -1 });
    });

    it('no admite cambios de estado: es una venta cerrada', async () => {
      const res = await http().patch(`/api/v1/orders/${creados[0]}/status`).set(auth()).send({ status: 'CONFIRMED' }).expect(422);
      expect(res.body.message).toMatch(/venta de caja|no se puede/i);
    });

    it('con transferencia también, y sin más stock que el que hay → 422', async () => {
      const ok = await http().post('/api/v1/orders').set(auth()).send(cuerpo({ paymentMethod: 'TRANSFER' })).expect(201);
      creados.push(ok.body.id);
      expect(ok.body.payments[0]).toMatchObject({ method: 'TRANSFER', status: 'APPROVED' });

      const res = await http().post('/api/v1/orders').set(auth())
        .send(cuerpo({ items: [{ variantId, quantity: stockInicial + 50 }] }));
      expect([400, 422]).toContain(res.status);
      expect(res.body.message).toMatch(/stock/i);
    });

    it('el checkout público no puede crear una venta presencial', async () => {
      // El endpoint público exige otras cosas antes (slug, etc.); alcanza
      // con que el service rechace POS con publicCheckout — se prueba por el
      // camino del panel con la bandera, vía el service directo.
      const { OrdersService } = await import('../src/orders/orders.service');
      const service = app.get(OrdersService);
      await expect(service.create(businessId, cuerpo() as never, { publicCheckout: true })).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('pedido online desde el panel (channel ONLINE)', () => {
    it('nace PENDING, con el cobro elegido PENDIENTE hasta confirmar', async () => {
      const res = await http().post('/api/v1/orders').set(auth())
        .send(cuerpo({ channel: 'ONLINE', paymentMethod: 'TRANSFER' })).expect(201);
      creados.push(res.body.id);
      expect(res.body.channel).toBe('ONLINE');
      expect(res.body.origin).toBe('MANUAL');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.payments[0]).toMatchObject({ method: 'TRANSFER', status: 'PENDING' });
      // El stock NO se toca hasta confirmar.
      const stock = await prisma.variantStock.findFirst({ where: { variantId, branchId }, select: { quantity: true } });
      expect(stock!.quantity).toBe(stockInicial - 2);
    });

    it('sin método de pago también se crea (se define después)', async () => {
      const res = await http().post('/api/v1/orders').set(auth())
        .send(cuerpo({ channel: 'ONLINE', paymentMethod: undefined })).expect(201);
      creados.push(res.body.id);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.payments).toHaveLength(0);
    });

    it('notifyCustomer con un comprador con email no rompe el alta', async () => {
      const res = await http().post('/api/v1/orders').set(auth())
        .send(cuerpo({ channel: 'ONLINE', buyer: { name: `${PREFIJO} Con mail`, email: 'e2e-alta-manual@example.com' }, notifyCustomer: true })).expect(201);
      creados.push(res.body.id);
      expect(res.body.onlineOrderDetails.buyerEmail).toBe('e2e-alta-manual@example.com');
    });
  });
});
