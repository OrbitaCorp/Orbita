import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembresiasService } from '../../src/appointments/avanzado/membresias/membresias.service';
import { FidelidadService } from '../../src/appointments/avanzado/fidelidad/fidelidad.service';
import { instanteDe, sumarDias } from '../../src/appointments/horarios/horarios';
import { fechaArgentina } from '../../src/common/utils/hora-argentina';
import { BIZ, OWNER, auditor, avanzado, conTransaccion, contexto, empleado } from './appointments.p4.helpers';

// Membresías (CONTRATO § P4.2) y programa de fidelidad (§ P4.5).

const MES = 30 * 24 * 3600 * 1000;

describe('turnoCubiertoPorMembresia', () => {
  // Un miércoles de la semana que viene, a las 18 h de Argentina.
  const hoy = fechaArgentina(new Date());
  const miercoles = (() => { let f = sumarDias(hoy, 7); while (new Date(`${f}T12:00:00Z`).getUTCDay() !== 3) f = sumarDias(f, 1); return f; })();
  const TURNO = instanteDe(miercoles, 18 * 60);

  function armar(opts: { membresia?: Record<string, unknown> | null; usadas?: [number, number]; addon?: boolean; on?: boolean } = {}) {
    const ctx = contexto({ addon: opts.addon ?? true, settings: { advanced: opts.on === false ? null : avanzado({ membresias: true }) } });
    const prisma = conTransaccion({
      business: ctx.business,
      appointmentMembership: {
        findFirst: jest.fn().mockResolvedValue(opts.membresia === null ? null : {
          id: 'mem-1', businessId: BIZ, status: 'ACTIVE', pausedFrom: null, pausedUntil: null,
          nextChargeAt: new Date(Date.now() + MES), plan: { perWeek: 2 }, ...(opts.membresia ?? {}),
        }),
      },
      appointment: { count: jest.fn().mockResolvedValue(opts.usadas?.[0] ?? 0) },
      appointmentClassEnrollment: { count: jest.fn().mockResolvedValue(opts.usadas?.[1] ?? 0) },
    });
    return { svc: new MembresiasService(prisma as never, ctx.svc, auditor() as never), prisma };
  }
  const pedir = (svc: MembresiasService, customerId: string | null = 'c-1') => svc.turnoCubiertoPorMembresia({ businessId: BIZ, customerId, startsAt: TURNO });

  it('cubre hasta perWeek por semana (lunes a domingo), contando turnos y clases de esa semana', async () => {
    const { svc, prisma } = armar({ usadas: [1, 0] });
    await expect(pedir(svc)).resolves.toEqual({ membershipId: 'mem-1', perWeek: 2, usadasEnLaSemana: 1 });
    const where = prisma.appointment.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ businessId: BIZ, membershipId: 'mem-1', status: { not: 'CANCELLED' } });
    expect(new Date(where.startsAt.gte).getUTCDay()).toBe(1); // lunes (03:00 UTC = 00:00 de Argentina)
    expect(where.startsAt.lt.getTime() - where.startsAt.gte.getTime()).toBe(7 * 24 * 3600 * 1000);
    expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual(['appt-membresia:mem-1']);
  });

  it('la tercera de la semana con un plan de 2 se paga suelta', async () => {
    await expect(pedir(armar({ usadas: [1, 1] }).svc)).resolves.toBeNull();
  });

  it('pase libre (perWeek 0): siempre cubre', async () => {
    await expect(pedir(armar({ membresia: { plan: { perWeek: 0 } }, usadas: [9, 9] }).svc)).resolves.toMatchObject({ perWeek: 0 });
  });

  it('no cubre: sin cliente, sin membresía, cuota vencida, pausada ese día, sin add-on o apagada', async () => {
    await expect(pedir(armar().svc, null)).resolves.toBeNull();
    await expect(pedir(armar({ membresia: null }).svc)).resolves.toBeNull();
    await expect(pedir(armar({ membresia: { nextChargeAt: new Date(Date.now() - 1000) } }).svc)).resolves.toBeNull();
    await expect(pedir(armar({ membresia: { status: 'PAUSED', pausedFrom: new Date(), pausedUntil: new Date(TURNO.getTime() + 1000) } }).svc)).resolves.toBeNull();
    await expect(pedir(armar({ addon: false }).svc)).resolves.toBeNull();
    await expect(pedir(armar({ on: false }).svc)).resolves.toBeNull();
  });
});

describe('Membresías del panel', () => {
  function armar(opts: { config?: Record<string, unknown>; otra?: boolean; membresia?: Record<string, unknown> } = {}) {
    const ctx = contexto({ settings: { advanced: avanzado({ membresias: opts.config ?? true }) } });
    const plan = { id: 'pl-1', businessId: BIZ, name: '2 por semana', perWeek: 2, price: 30_000, isActive: true };
    const prisma = conTransaccion({
      business: ctx.business,
      appointmentMembershipPlan: { findFirst: jest.fn().mockResolvedValue(plan), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      appointmentMembership: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(opts.otra ? { id: 'otra' } : (opts.membresia ? { id: 'mem-1', businessId: BIZ, planId: 'pl-1', status: 'ACTIVE', nextChargeAt: new Date(Date.now() + MES), pausedUntil: null, lastPaidAt: null, plan: { price: 30_000, name: '2 por semana' }, ...opts.membresia } : null))
          .mockResolvedValue({ id: 'mem-1', businessId: BIZ, planId: 'pl-1', customerName: 'Ana', status: 'ACTIVE', startedAt: new Date(), pausedUntil: null, nextChargeAt: new Date(), plan: { name: '2 por semana', price: 30_000 }, ...(opts.membresia ?? {}) }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'mem-1', ...data, pausedUntil: null, plan: { name: '2 por semana' } })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      appointmentPayment: { create: jest.fn().mockResolvedValue({}) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', firstName: 'Ana', lastName: null, phone: '1155550101', email: null, passwordHash: null, googleId: null }) },
    });
    return { svc: new MembresiasService(prisma as never, ctx.svc, auditor() as never), prisma };
  }

  it('dar de alta cobra la primera cuota + matrícula, y vence el día de cobro del mes siguiente', async () => {
    const { svc, prisma } = armar({ config: { matricula: 8_000, diaCobro: 5 } });
    const r = await svc.crear(OWNER as never, { planId: 'pl-1', customerId: 'c-1', method: 'CASH' });
    expect(prisma.appointmentPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, kind: 'MEMBERSHIP', amount: 38_000, status: 'APPROVED' }) });
    expect(r.status).toBe('ACTIVE');
    expect(fechaArgentina(new Date(r.nextChargeAt!)).slice(8)).toBe('05');
    expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual(['appt-membresia-cliente:c-1']);
  });

  it('un cliente no puede tener dos membresías a la vez', async () => {
    await expect(armar({ otra: true }).svc.crear(OWNER as never, { planId: 'pl-1', customerId: 'c-1', method: 'CASH' })).rejects.toThrow(/ya tiene una membresía/);
  });

  it('dar de alta pide appointments.cash.charge', async () => {
    await expect(armar().svc.crear(empleado(['appointments.settings.manage']) as never, { planId: 'pl-1', customerId: 'c-1', method: 'CASH' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pausar: respeta la config (permitido y tope de días) y corre el vencimiento', async () => {
    const hasta = (d: number) => sumarDias(fechaArgentina(new Date()), d);
    await expect(armar({ config: { pausa: false } }).svc.pausar(BIZ, 'm', 'mem-1', { until: hasta(5) })).rejects.toThrow('Este negocio no permite pausar membresías.');
    await expect(armar({ config: { diasPausa: 10 } }).svc.pausar(BIZ, 'm', 'mem-1', { until: hasta(11) })).rejects.toThrow('Se puede pausar hasta 10 días.');
    await expect(armar().svc.pausar(BIZ, 'm', 'mem-1', { until: hasta(0) })).rejects.toBeInstanceOf(BadRequestException);
    const { svc, prisma } = armar({ membresia: {} });
    await svc.pausar(BIZ, 'm', 'mem-1', { until: hasta(7) });
    const llamada = prisma.appointmentMembership.updateMany.mock.calls.find((c) => c[0].data.status === 'PAUSED')![0];
    expect(llamada.where).toEqual({ id: 'mem-1', businessId: BIZ, status: 'ACTIVE' });
  });

  it('registrar la cuota saca de PAST_DUE y corre el vencimiento un mes', async () => {
    const { svc, prisma } = armar({ membresia: { status: 'PAST_DUE', nextChargeAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) } });
    await svc.registrarCuota(BIZ, 'm', 'mem-1', 'TRANSFER');
    const upd = prisma.appointmentMembership.updateMany.mock.calls.find((c) => 'lastPaidAt' in c[0].data)![0];
    expect(upd.where).toEqual({ id: 'mem-1', businessId: BIZ });
    expect(upd.data.status).toBe('ACTIVE');
    expect(upd.data.nextChargeAt.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 3600 * 1000);
  });

  it('borrar un plan con gente: 400', async () => {
    const { svc, prisma } = armar();
    prisma.appointmentMembership.count.mockResolvedValueOnce(3);
    await expect(svc.borrarPlan(BIZ, 'm', 'pl-1')).rejects.toThrow('Hay 3 personas con este plan. Cancelá esas membresías antes de borrarlo.');
  });
});

describe('Fidelidad: sumarSello y canjes', () => {
  function armar(opts: { tarjeta?: Record<string, unknown> | null; cliente?: Record<string, unknown> | null; addon?: boolean; config?: Record<string, unknown> | null; basica?: number } = {}) {
    const advanced = opts.config === null ? null : avanzado({ fidelidad: opts.config ?? { sellos: 3 } });
    const ctx = contexto({ addon: opts.addon ?? true, settings: { advanced, loyaltyStamps: opts.basica ?? 0 } });
    const prisma = conTransaccion({
      business: ctx.business,
      customer: { findFirst: jest.fn().mockResolvedValue(opts.cliente === null ? null : { passwordHash: 'hash', googleId: null, ...(opts.cliente ?? {}) }) },
      appointmentLoyaltyCard: {
        findFirst: jest.fn().mockResolvedValue(opts.tarjeta === null || opts.tarjeta === undefined ? null : { id: 'lc-1', businessId: BIZ, customerId: 'c-1', stamps: 0, rewardsEarned: 0, rewardsRedeemed: 0, lastStampAt: null, ...opts.tarjeta }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'lc-1', rewardsEarned: 0, rewardsRedeemed: 0, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        fields: { rewardsEarned: 'CAMPO:rewardsEarned' },
      },
    });
    const audit = auditor();
    return { svc: new FidelidadService(prisma as never, ctx.svc, audit as never), prisma, audit };
  }
  const sello = (svc: FidelidadService, customerId: string | null = 'c-1', monto = 10_000) => svc.sumarSello({ businessId: BIZ, customerId, monto });

  it('crea la tarjeta al primer turno y suma bajo lock por cliente', async () => {
    const { svc, prisma } = armar({ tarjeta: null });
    await expect(sello(svc)).resolves.toEqual({ sumo: true, completo: false, stamps: 1, needed: 3, rewardsAvailable: 0 });
    expect(prisma.appointmentLoyaltyCard.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, customerId: 'c-1', stamps: 0 }) });
    expect(prisma.appointmentLoyaltyCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'lc-1', businessId: BIZ } }));
    expect(prisma.$executeRaw.mock.calls[0].slice(1)).toEqual(['appt-sellos:c-1']);
  });

  it('con sello de bienvenida, la tarjeta nueva arranca con uno', async () => {
    await expect(sello(armar({ tarjeta: null, config: { sellos: 5, selloDeBienvenida: true } }).svc)).resolves.toMatchObject({ stamps: 2 });
  });

  it('el que completa la tarjeta vuelve a 0 y deja un premio', async () => {
    const { svc, prisma } = armar({ tarjeta: { stamps: 2 } });
    await expect(sello(svc)).resolves.toEqual({ sumo: true, completo: true, stamps: 0, needed: 3, rewardsAvailable: 1 });
    expect(prisma.appointmentLoyaltyCard.updateMany.mock.calls[0][0].data).toMatchObject({ stamps: 0, rewardsEarned: 1 });
  });

  it('solo clientes CON cuenta (contraseña o Google)', async () => {
    await expect(sello(armar({ cliente: { passwordHash: null, googleId: null } }).svc)).resolves.toMatchObject({ sumo: false });
    await expect(sello(armar({ cliente: { passwordHash: null, googleId: 'g-1' }, tarjeta: null }).svc)).resolves.toMatchObject({ sumo: true });
    await expect(sello(armar().svc, null)).resolves.toMatchObject({ sumo: false });
  });

  it('sin add-on manda la tarjeta básica de la cuenta; sin ninguna, no suma', async () => {
    await expect(sello(armar({ addon: false, basica: 10, tarjeta: null }).svc)).resolves.toMatchObject({ sumo: true, needed: 10 });
    await expect(sello(armar({ addon: false, basica: 0 }).svc)).resolves.toMatchObject({ sumo: false, needed: 0 });
  });

  it('"suma desde $X": un turno más barato no suma ni escribe', async () => {
    const { svc, prisma } = armar({ tarjeta: { stamps: 1 }, config: { sellos: 3, suma: 'desde', minimo: 15_000 } });
    await expect(sello(svc, 'c-1', 10_000)).resolves.toMatchObject({ sumo: false, stamps: 1 });
    expect(prisma.appointmentLoyaltyCard.updateMany).not.toHaveBeenCalled();
  });

  it('canjear: solo si hay un premio sin usar (condición en el update); si no, 400; sin tarjeta, 404', async () => {
    const { svc, prisma, audit } = armar({ tarjeta: { rewardsEarned: 1, rewardsRedeemed: 1, customer: { firstName: 'Ana', lastName: null } } });
    prisma.appointmentLoyaltyCard.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.canjear(BIZ, 'm', 'c-1')).rejects.toThrow('No tiene premios para canjear.');
    expect(prisma.appointmentLoyaltyCard.updateMany).toHaveBeenCalledWith({
      where: { businessId: BIZ, customerId: 'c-1', rewardsRedeemed: { lt: 'CAMPO:rewardsEarned' } },
      data: { rewardsRedeemed: { increment: 1 } },
    });
    expect(audit.registrar).not.toHaveBeenCalled();
    const sin = armar({ tarjeta: null });
    sin.prisma.appointmentLoyaltyCard.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(sin.svc.canjear(BIZ, 'm', 'c-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('premioDisponible: sellos, los que faltan y premios sin usar', async () => {
    const { svc } = armar({ tarjeta: { stamps: 2, rewardsEarned: 3, rewardsRedeemed: 1, lastStampAt: new Date() } });
    await expect(svc.premioDisponible(BIZ, 'c-1')).resolves.toEqual({ stamps: 2, needed: 3, rewardsAvailable: 2, premio: { tipo: 'gratis', serviceId: null, pct: 20 } });
  });
});
