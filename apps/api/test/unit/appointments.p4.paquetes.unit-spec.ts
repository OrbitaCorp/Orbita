import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaquetesService } from '../../src/appointments/avanzado/paquetes/paquetes.service';
import { BIZ, OWNER, auditor, avanzado, conTransaccion, contexto, empleado } from './appointments.p4.helpers';

// Paquetes y bonos (CONTRATO § P4.1): el canje de sesiones al reservar, el
// consumo al atender, la devolución al cancelar, la venta y la compra pública.

const FUTURO = new Date(Date.now() + 60 * 24 * 3600 * 1000);
const TURNO = new Date(Date.now() + 7 * 24 * 3600 * 1000);

const compra = (over: Record<string, unknown> = {}) => ({
  id: 'pp-1', businessId: BIZ, packageId: 'pk-1', customerId: 'c-1', sessionsTotal: 4, sessionsUsed: 2,
  paidAt: new Date(), expiresAt: FUTURO, package: { serviceId: 'srv-1' }, ...over,
});

function armar(opts: { compra?: Record<string, unknown> | null; enUso?: [number, number]; addon?: boolean; on?: boolean } = {}) {
  const ctx = contexto({ addon: opts.addon ?? true, settings: { advanced: opts.on === false ? null : avanzado({ paquetes: true }) } });
  const prisma = conTransaccion({
    business: ctx.business,
    appointmentPackagePurchase: {
      findFirst: jest.fn().mockResolvedValue(opts.compra === null ? null : compra(opts.compra ?? {})),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pp-nuevo', ...data, sessionsUsed: 0, package: { service: { name: 'Kinesio' } } })),
      fields: { sessionsTotal: 'CAMPO:sessionsTotal' },
    },
    appointment: { count: jest.fn().mockResolvedValue(opts.enUso?.[0] ?? 0) },
    appointmentClassEnrollment: { count: jest.fn().mockResolvedValue(opts.enUso?.[1] ?? 0) },
    appointmentPackage: {
      findFirst: jest.fn().mockResolvedValue({ id: 'pk-1', businessId: BIZ, sessions: 10, price: 80_000, validDays: 90, service: { name: 'Kinesio', deletedAt: null } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    appointmentPayment: { create: jest.fn().mockResolvedValue({}) },
    customer: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c-1', firstName: 'Ana', lastName: 'Paz', phone: '1155550101', email: null, passwordHash: 'x', googleId: null }),
    },
  });
  const audit = auditor();
  const cobro = { crearPreferencia: jest.fn().mockResolvedValue({ preferenceId: 'pref', initPoint: 'https://mp' }) };
  return { svc: new PaquetesService(prisma as never, ctx.svc, audit as never, cobro), prisma, audit, cobro };
}

const canje = (over: Record<string, unknown> = {}) => ({ businessId: BIZ, packagePurchaseId: 'pp-1', customerId: 'c-1', serviceId: 'srv-1', startsAt: TURNO, ...over });

describe('canjearSesionDePaquete', () => {
  it('reserva la sesión bajo lock del pack y cuenta las que ya toman otros turnos activos', async () => {
    const { svc, prisma } = armar({ enUso: [1, 0] });
    await expect(svc.canjearSesionDePaquete(canje())).resolves.toEqual({ packagePurchaseId: 'pp-1', sessionsLeft: 0 });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual(['appt-pack:pp-1']);
    expect(prisma.appointmentPackagePurchase.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pp-1', businessId: BIZ, customerId: 'c-1' } }));
    expect(prisma.appointment.count).toHaveBeenCalledWith({ where: { businessId: BIZ, packagePurchaseId: 'pp-1', status: { in: ['PENDING', 'CONFIRMED'] } } });
    expect(prisma.appointmentClassEnrollment.count).toHaveBeenCalledWith({ where: { businessId: BIZ, packagePurchaseId: 'pp-1', status: { in: ['ENROLLED', 'WAITLIST'] } } });
  });

  it('sin sesiones libres (usadas + en uso = total): 409', async () => {
    const { svc } = armar({ enUso: [1, 1] });
    await expect(svc.canjearSesionDePaquete(canje())).rejects.toBeInstanceOf(ConflictException);
  });

  it('reglas: del cliente, mismo servicio, pago, no vencido para la fecha del turno, con cuenta', async () => {
    await expect(armar({ compra: null }).svc.canjearSesionDePaquete(canje())).rejects.toBeInstanceOf(NotFoundException);
    await expect(armar({ compra: { package: { serviceId: 'otro' } } }).svc.canjearSesionDePaquete(canje())).rejects.toThrow('Ese paquete es de otro servicio.');
    await expect(armar({ compra: { paidAt: null } }).svc.canjearSesionDePaquete(canje())).rejects.toThrow('Ese paquete todavía no está pago.');
    await expect(armar({ compra: { expiresAt: new Date(TURNO.getTime() - 1000) } }).svc.canjearSesionDePaquete(canje())).rejects.toThrow(/vence el/);
    await expect(armar().svc.canjearSesionDePaquete(canje({ customerId: null }))).rejects.toThrow('Iniciá sesión para usar tu paquete.');
  });

  it('sin add-on o apagada: 400 y no lee el pack', async () => {
    for (const o of [{ addon: false }, { on: false }]) {
      const { svc, prisma } = armar(o);
      await expect(svc.canjearSesionDePaquete(canje())).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.appointmentPackagePurchase.findFirst).not.toHaveBeenCalled();
    }
  });

  it('con el tx de la reserva no abre otra transacción', async () => {
    const { svc, prisma } = armar();
    const tx = { ...prisma }; // otro objeto: el cliente de la transacción de P1
    await svc.canjearSesionDePaquete(canje(), tx as never);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
});

describe('consumir y devolver', () => {
  it('consumir: sessionsUsed + 1 solo si no está completo (condición en el update, con businessId)', async () => {
    const { svc, prisma } = armar();
    await expect(svc.consumirSesionDePaquete(BIZ, 'pp-1')).resolves.toBe(true);
    expect(prisma.appointmentPackagePurchase.updateMany).toHaveBeenCalledWith({
      where: { id: 'pp-1', businessId: BIZ, sessionsUsed: { lt: 'CAMPO:sessionsTotal' } },
      data: { sessionsUsed: { increment: 1 } },
    });
    prisma.appointmentPackagePurchase.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.consumirSesionDePaquete(BIZ, 'pp-1')).resolves.toBe(false);
  });

  it('cancelar a tiempo libera sin escribir; fuera de plazo la sesión se pierde', async () => {
    const { svc, prisma } = armar();
    await expect(svc.devolverSesionDePaquete(BIZ, 'pp-1', { aTiempo: true })).resolves.toEqual({ liberada: true });
    expect(prisma.appointmentPackagePurchase.updateMany).not.toHaveBeenCalled();
    await expect(svc.devolverSesionDePaquete(BIZ, 'pp-1', { aTiempo: false })).resolves.toEqual({ liberada: false });
    expect(prisma.appointmentPackagePurchase.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('Venta en el local', () => {
  const dto = { packageId: 'pk-1', customerId: 'c-1', method: 'TRANSFER' as const };

  it('pide appointments.cash.charge además del decorador', async () => {
    await expect(armar().svc.vender(empleado(['appointments.settings.manage']) as never, dto)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(armar().svc.vender(empleado(['appointments.settings.manage', 'appointments.cash.charge']) as never, dto)).resolves.toBeDefined();
  });

  it('con la función apagada no se vende', async () => {
    await expect(armar({ on: false }).svc.vender(OWNER as never, dto)).rejects.toThrow('Prendé «Paquetes y bonos» en Avanzado para usarlo.');
  });

  it('la compra nace paga, vence a validDays, y el pago PACKAGE queda APPROVED con quien lo registró', async () => {
    const { svc, prisma, audit } = armar();
    const r = await svc.vender(OWNER as never, dto);
    const data = prisma.appointmentPackagePurchase.create.mock.calls[0][0].data as { expiresAt: Date; paidAt: Date };
    expect(data).toMatchObject({ businessId: BIZ, packageId: 'pk-1', customerId: 'c-1', sessionsTotal: 10, pricePaid: 80_000 });
    expect(data.paidAt).toBeInstanceOf(Date);
    expect(Math.round((data.expiresAt.getTime() - data.paidAt.getTime()) / 86_400_000)).toBe(90);
    expect(prisma.appointmentPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, kind: 'PACKAGE', status: 'APPROVED', method: 'TRANSFER', registeredByMemberId: 'm-owner' }) });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, entityType: 'appointment_package_purchase', action: 'CREATE' }));
    expect(r).toMatchObject({ sessionsTotal: 10, sessionsUsed: 0, paid: true, customerName: 'Ana Paz' });
  });
});

describe('Sitio público', () => {
  const comprador = { name: 'Ana Paz', phone: '11 5555 0101' };

  it('sin add-on: la lista viene vacía y comprar da 404', async () => {
    const { svc, prisma } = armar({ addon: false });
    await expect(svc.listarPublicos(BIZ)).resolves.toEqual([]);
    expect(prisma.appointmentPackage.findMany).not.toHaveBeenCalled();
    await expect(svc.comprarPublico(BIZ, 'pk-1', comprador, null)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin Mercado Pago conectado: 400 y no se crea la compra', async () => {
    const { svc, cobro, prisma } = armar();
    cobro.crearPreferencia.mockResolvedValueOnce(null);
    await expect(svc.comprarPublico(BIZ, 'pk-1', comprador, null)).rejects.toThrow('Este negocio no cobra online. Coordiná el pago con ellos.');
    expect(prisma.appointmentPackagePurchase.create).not.toHaveBeenCalled();
  });

  it('con MP: compra SIN pagar + pago PENDING con la preferencia; con sesión, en la ficha del cliente', async () => {
    const { svc, prisma } = armar();
    const r = await svc.comprarPublico(BIZ, 'pk-1', comprador, 'c-1');
    expect(r).toEqual({ purchaseId: expect.any(String), payment: { paymentId: expect.any(String), amount: 80_000, initPoint: 'https://mp' } });
    expect(prisma.appointmentPackagePurchase.create.mock.calls[0][0].data).toMatchObject({ id: r.purchaseId, businessId: BIZ, customerId: 'c-1', paidAt: null });
    expect(prisma.appointmentPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: r.payment.paymentId, status: 'PENDING', kind: 'PACKAGE', mpPreferenceId: 'pref' }) });
  });
});
