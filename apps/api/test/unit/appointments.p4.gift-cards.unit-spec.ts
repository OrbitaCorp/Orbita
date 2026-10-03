import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GiftCardsService } from '../../src/appointments/avanzado/gift-cards/gift-cards.service';
import { BIZ, OTRO_BIZ, OWNER, auditor, avanzado, conTransaccion, contexto, empleado, tabla } from './appointments.p4.helpers';

// Gift cards (CONTRATO § P4.3): el saldo nunca queda negativo con canjes
// simultáneos, el código es aleatorio y único por negocio, y cada consulta
// lleva businessId.

const FUTURO = new Date(Date.now() + 90 * 24 * 3600 * 1000);
const PASADO = new Date(Date.now() - 24 * 3600 * 1000);
const PAGA = new Date(Date.now() - 3600 * 1000);

const card = (over: Record<string, unknown> = {}) => ({
  id: 'gc-1', businessId: BIZ, code: 'ABCDEFGH23', kind: 'AMOUNT', amount: 10_000, balance: 10_000, serviceId: null,
  redeemedAt: null, paidAt: PAGA, expiresAt: FUTURO, voidedAt: null, ...over,
});

function armar(opts: { cards?: Record<string, unknown>[]; addon?: boolean; on?: boolean; config?: Record<string, unknown> } = {}) {
  const ctx = contexto({ addon: opts.addon ?? true, settings: { advanced: opts.on === false ? null : avanzado({ 'gift-cards': opts.config ?? true }) } });
  const gc = tabla(opts.cards ?? [card()]);
  const prisma = conTransaccion({
    business: ctx.business,
    appointmentGiftCard: { ...gc, create: jest.fn(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    appointmentPayment: { create: jest.fn().mockResolvedValue({}) },
    appointmentService: { findFirst: jest.fn().mockResolvedValue({ id: 'srv-1', name: 'Corte', price: 12_000 }) },
    customer: { findFirst: jest.fn() },
  });
  const audit = auditor();
  const cobro = { crearPreferencia: jest.fn().mockResolvedValue({ preferenceId: 'pref-1', initPoint: 'https://mp/checkout' }) };
  const svc = new GiftCardsService(prisma as never, ctx.svc, audit as never, cobro);
  return { svc, prisma, gc, audit, cobro, ctx };
}

describe('usarSaldoGiftCard: AMOUNT', () => {
  it('descuenta min(saldo, aPagar) con un update condicionado a que alcance el saldo, siempre con businessId', async () => {
    const { svc, gc } = armar();
    await expect(svc.usarSaldoGiftCard({ businessId: BIZ, code: 'abcd-efgh 23', serviceId: 'srv-1', aPagar: 4_000 }))
      .resolves.toEqual({ giftCardId: 'gc-1', kind: 'AMOUNT', descontado: 4_000, saldoRestante: 6_000 });
    expect(gc.updateMany).toHaveBeenCalledWith({
      where: { id: 'gc-1', businessId: BIZ, kind: 'AMOUNT', voidedAt: null, balance: { gte: 4_000 } },
      data: { balance: { decrement: 4_000 } },
    });
    expect(gc.findFirst).toHaveBeenCalledWith({ where: { businessId: BIZ, code: 'ABCDEFGH23' } });
    expect(gc.datos[0].balance).toBe(6_000);
  });

  it('si el turno sale más que el saldo, usa todo el saldo y el resto se paga', async () => {
    const { svc, gc } = armar({ cards: [card({ balance: 2_500 })] });
    await expect(svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 9_000 }))
      .resolves.toMatchObject({ descontado: 2_500, saldoRestante: 0 });
    expect(gc.datos[0].balance).toBe(0);
  });

  it('CONCURRENCIA: dos reservas a la vez de $8.000 contra $10.000 → una usa 8.000, la otra 2.000; nunca negativo', async () => {
    const { svc, gc } = armar();
    const pedir = () => svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 8_000 });
    const [a, b] = await Promise.all([pedir(), pedir()]);
    expect([a.descontado, b.descontado].sort((x, y) => x - y)).toEqual([2_000, 8_000]);
    expect(gc.datos[0].balance).toBe(0);
    // La que perdió la carrera no encontró la fila con saldo >= 8.000 y recalculó.
    expect(gc.updateMany.mock.results.length).toBe(3);
    // Una tercera ya no tiene saldo.
    await expect(pedir()).rejects.toThrow('Esa gift card no tiene saldo.');
  });

  it('CONCURRENCIA: diez canjes simultáneos de $3.000 contra $10.000 nunca gastan más que el saldo', async () => {
    const { svc, gc } = armar();
    const resultados = await Promise.allSettled(Array.from({ length: 10 }, () => svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 3_000 })));
    const gastado = resultados.filter((r) => r.status === 'fulfilled').reduce((s, r) => s + (r as PromiseFulfilledResult<{ descontado: number }>).value.descontado, 0);
    // Lo gastado más lo que queda es exactamente lo que había: nadie gastó dos veces lo mismo.
    expect(gastado + Number(gc.datos[0].balance)).toBe(10_000);
    expect(gastado).toBeGreaterThanOrEqual(9_000);
    expect(Number(gc.datos[0].balance)).toBeGreaterThanOrEqual(0);
    for (const r of resultados.filter((x) => x.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    }
  });

  it('anulada, sin pagar, vencida o inexistente: no se canjea', async () => {
    const pedir = (c: Record<string, unknown>) => armar({ cards: [card(c)] }).svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 100 });
    await expect(pedir({ voidedAt: PAGA })).rejects.toThrow('Esa gift card fue anulada.');
    await expect(pedir({ paidAt: null })).rejects.toThrow('Esa gift card todavía no está paga.');
    await expect(pedir({ expiresAt: PASADO })).rejects.toThrow(/venció/);
    await expect(pedir({ code: 'OTRO' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la gift card de OTRO negocio no existe para este', async () => {
    const { svc } = armar({ cards: [card({ businessId: OTRO_BIZ })] });
    await expect(svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 100 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin add-on (o con la función apagada) no se acepta, sin tocar la tarjeta', async () => {
    for (const o of [{ addon: false }, { on: false }]) {
      const { svc, gc } = armar(o);
      await expect(svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 100 })).rejects.toBeInstanceOf(BadRequestException);
      expect(gc.updateMany).not.toHaveBeenCalled();
    }
  });

  it('corre en la transacción que le pasan (la de la reserva) y no abre otra', async () => {
    const { svc, prisma, gc } = armar();
    const tx = { business: prisma.business, appointmentGiftCard: gc };
    await svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 1_000 }, tx as never);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('usarSaldoGiftCard: SERVICE', () => {
  const servicio = card({ kind: 'SERVICE', amount: null, balance: null, serviceId: 'srv-1' });

  it('exige el mismo servicio', async () => {
    const { svc } = armar({ cards: [servicio] });
    await expect(svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-otro', aPagar: 12_000 })).rejects.toThrow('Esa gift card es para otro servicio.');
  });

  it('cubre todo y marca redeemedAt; dos canjes simultáneos → uno gana, el otro 409', async () => {
    const { svc, gc } = armar({ cards: [servicio] });
    const pedir = () => svc.usarSaldoGiftCard({ businessId: BIZ, code: 'ABCDEFGH23', serviceId: 'srv-1', aPagar: 12_000 });
    const [a, b] = await Promise.allSettled([pedir(), pedir()]);
    const ok = [a, b].filter((r) => r.status === 'fulfilled');
    const mal = [a, b].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect((ok[0] as PromiseFulfilledResult<{ descontado: number }>).value.descontado).toBe(12_000);
    expect(mal[0].reason).toBeInstanceOf(ConflictException);
    expect(gc.datos[0].redeemedAt).toBeInstanceOf(Date);
  });
});

describe('devolverSaldoGiftCard', () => {
  it('AMOUNT: devuelve al saldo sin pasarse del valor de emisión', async () => {
    const { svc, gc } = armar({ cards: [card({ balance: 7_000 })] });
    await expect(svc.devolverSaldoGiftCard({ businessId: BIZ, giftCardId: 'gc-1', monto: 2_000 })).resolves.toEqual({ saldo: 9_000 });
    await expect(svc.devolverSaldoGiftCard({ businessId: BIZ, giftCardId: 'gc-1', monto: 5_000 })).resolves.toEqual({ saldo: 10_000 });
    expect(gc.datos[0].balance).toBe(10_000);
  });

  it('SERVICE: vuelve a quedar sin usar', async () => {
    const { svc, gc } = armar({ cards: [card({ kind: 'SERVICE', amount: null, balance: null, serviceId: 'srv-1', redeemedAt: PAGA })] });
    await svc.devolverSaldoGiftCard({ businessId: BIZ, giftCardId: 'gc-1', monto: 0 });
    expect(gc.datos[0].redeemedAt).toBeNull();
  });

  it('una de otro negocio: 404', async () => {
    const { svc } = armar({ cards: [card({ businessId: OTRO_BIZ })] });
    await expect(svc.devolverSaldoGiftCard({ businessId: BIZ, giftCardId: 'gc-1', monto: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Emitir en el local', () => {
  const dto = { kind: 'AMOUNT' as const, amount: 15_000, style: 'noche' as const, method: 'CASH' as const, recipientName: 'Caro' };

  it('cobra plata: un empleado sin appointments.cash.charge recibe 403', async () => {
    const { svc } = armar();
    await expect(svc.emitir(empleado(['appointments.settings.manage']) as never, dto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('con la función apagada: 400 con el nombre de la función', async () => {
    const { svc } = armar({ on: false });
    await expect(svc.emitir(OWNER as never, dto)).rejects.toThrow('Prendé «Gift cards» en Avanzado para usarlo.');
  });

  it('nace paga con código de 10 caracteres; reintenta si el código ya existe (P2002) dentro de un SAVEPOINT', async () => {
    const { svc, prisma, audit } = armar();
    const creada = (data: Record<string, unknown>) => ({ ...card(), ...data, service: null, pricePaid: 15_000, style: 'noche', recipientName: 'Caro', senderName: null, message: null });
    prisma.appointmentGiftCard.create
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => creada(data));
    const g = await svc.emitir(OWNER as never, dto);
    expect(g.code).toMatch(/^[A-Z2-9]{10}$/);
    expect(prisma.appointmentGiftCard.create).toHaveBeenCalledTimes(2);
    const [primero, segundo] = prisma.appointmentGiftCard.create.mock.calls.map((c) => c[0].data.code);
    expect(primero).not.toBe(segundo);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT gift_card_codigo');
    expect(prisma.appointmentGiftCard.create.mock.calls[1][0].data).toMatchObject({ businessId: BIZ, kind: 'AMOUNT', amount: 15_000, balance: 15_000 });
    expect(prisma.appointmentPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, kind: 'GIFT_CARD', status: 'APPROVED', method: 'CASH', amount: 15_000 }) });
    // El código NO va al registro de auditoría: es lo que se canjea.
    expect(JSON.stringify(audit.registrar.mock.calls)).not.toContain(g.code);
  });

  it('un monto que no está en la lista, sin monto libre: 400', async () => {
    const { svc } = armar({ config: { montoLibre: false, montos: [20_000] } });
    await expect(svc.emitir(OWNER as never, dto)).rejects.toThrow(/Elegí uno de los montos/);
  });
});

describe('Sitio público', () => {
  const compra = { kind: 'AMOUNT' as const, amount: 20_000, style: 'aurora' as const, buyerName: 'Juli Pérez', buyerPhone: '11 5555-0101', buyerEmail: 'juli@mail.com' };

  it('sin Mercado Pago conectado: 400 y no se crea nada', async () => {
    const { svc, cobro, prisma } = armar();
    cobro.crearPreferencia.mockResolvedValueOnce(null);
    await expect(svc.comprarPublico(BIZ, compra, null)).rejects.toThrow('Este negocio no cobra online. Coordiná el pago con ellos.');
    expect(prisma.appointmentGiftCard.create).not.toHaveBeenCalled();
  });

  it('con MP: la tarjeta nace SIN pagar, el pago PENDING y la referencia es appt:<paymentId>', async () => {
    const { svc, cobro, prisma } = armar();
    prisma.appointmentGiftCard.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, service: null }));
    const r = await svc.comprarPublico(BIZ, compra, null);
    expect(r.payment).toEqual({ paymentId: expect.any(String), amount: 20_000, initPoint: 'https://mp/checkout' });
    expect(cobro.crearPreferencia).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, paymentId: r.payment.paymentId, amount: 20_000 }));
    expect(prisma.appointmentGiftCard.create.mock.calls[0][0].data).toMatchObject({ id: r.giftCardId, businessId: BIZ, paidAt: null, buyerPhone: '1155550101' });
    expect(prisma.appointmentPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: r.payment.paymentId, status: 'PENDING', method: 'MERCADOPAGO', giftCardId: r.giftCardId }) });
  });

  it('sin add-on la compra y la consulta responden como si no existiera (404, nunca 403)', async () => {
    const { svc } = armar({ addon: false });
    await expect(svc.comprarPublico(BIZ, compra, null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.consultarPublico(BIZ, 'ABCDEFGH23')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('consultar: solo pagas y no anuladas; devuelve saldo y vencimiento, nada del comprador', async () => {
    const { svc, gc } = armar({ cards: [card({ service: null })] });
    const r = await svc.consultarPublico(BIZ, 'abcdefgh23');
    expect(r).toEqual({ kind: 'AMOUNT', balance: 10_000, serviceName: null, expiresAt: FUTURO.toISOString() });
    expect(gc.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, code: 'ABCDEFGH23', paidAt: { not: null }, voidedAt: null } }));
  });
});
