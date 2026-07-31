import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { SEED_USERS } from './helpers/test-users';
import { PrismaService } from '../src/prisma/prisma.service';

// (Métricas RBT-614) GET /discounts/metrics — agrega sobre DiscountRedemption.
// Con datos reales devuelve ceros (no hay canjes: checkout stub), así que además
// del caso "shape bien formado" se siembra una redención a mano para verificar
// que la agregación es correcta cuando SÍ hay datos.
const PREFIJO = '[e2e-metricas]';

describe('Discounts metrics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_USERS.owner.email, password: SEED_USERS.owner.password });
    ownerToken = ownerRes.body.token;
    businessId = ownerRes.body.business.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/discounts/metrics');
    expect(res.status).toBe(401);
  });

  it('responde con shape bien formado (arrays parejos, sin NaN)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/discounts/metrics?rango=7d').set(auth(ownerToken));
    expect(res.status).toBe(200);

    const { kpis, grafico, rendimiento } = res.body;
    // grafico: los tres arrays tienen la misma longitud (un punto por día).
    expect(grafico.fechas.length).toBe(grafico.usos.length);
    expect(grafico.fechas.length).toBe(grafico.revenueSacrificado.length);
    expect(grafico.fechas.length).toBeGreaterThan(0);
    // kpis: estructura completa y todos números finitos.
    expect(Number.isFinite(kpis.revenueSacrificado.valor)).toBe(true);
    expect(Number.isFinite(kpis.revenueSacrificado.variacion)).toBe(true);
    expect(Number.isFinite(kpis.ventasConDescuento.porcentaje)).toBe(true);
    expect(Number.isFinite(kpis.ticketPromedio.conDescuento)).toBe(true);
    expect(Number.isFinite(kpis.tasaCanje.porcentaje)).toBe(true);
    expect(Array.isArray(rendimiento)).toBe(true);
  });

  describe('con una redención sembrada', () => {
    let discountId: string;
    let orderId: string;

    beforeAll(async () => {
      const branch = await prisma.branch.findFirst({ where: { businessId }, select: { id: true } });
      const discount = await prisma.discount.create({
        data: {
          businessId, name: `${PREFIJO} descuento`, code: null, type: 'AMOUNT_TICKET',
          value: 1000, scope: 'TICKET', application: 'AUTOMATIC',
          startDate: new Date(Date.now() - 86400000),
        },
      });
      discountId = discount.id;

      const maxNum = await prisma.order.aggregate({ where: { businessId }, _max: { orderNumber: true } });
      const order = await prisma.order.create({
        data: {
          businessId, branchId: branch!.id, orderNumber: (maxNum._max.orderNumber ?? 0) + 1,
          channel: 'ONLINE', subtotal: 10000, discountTotal: 1000, total: 9000,
        },
      });
      orderId = order.id;

      await prisma.discountRedemption.create({
        data: { businessId, orderId, discountId, channel: 'STOREFRONT', amount: 1000 },
      });
    });

    afterAll(async () => {
      // El borrado de la orden cascadea la redención (onDelete: Cascade).
      await prisma.order.deleteMany({ where: { id: orderId } });
      await prisma.discount.deleteMany({ where: { id: discountId } });
    });

    it('la redención sembrada aparece en revenueSacrificado y en rendimiento', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/discounts/metrics?rango=30d').set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.body.kpis.revenueSacrificado.valor).toBeGreaterThanOrEqual(1000);
      const fila = res.body.rendimiento.find((r: { id: string }) => r.id === discountId);
      expect(fila).toBeDefined();
      expect(fila.usos).toBeGreaterThanOrEqual(1);
      expect(fila.revenueSacrificado).toBeGreaterThanOrEqual(1000);
      expect(fila.entidad).toBe('descuento');
      expect(fila.tipoLabel).toBe('$ Fijo Ticket');
    });

    it('filtrando por tipo=cupones, el descuento sembrado NO aparece', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/discounts/metrics?rango=30d&tipo=cupones').set(auth(ownerToken));
      const fila = res.body.rendimiento.find((r: { id: string }) => r.id === discountId);
      expect(fila).toBeUndefined();
    });
  });
});
