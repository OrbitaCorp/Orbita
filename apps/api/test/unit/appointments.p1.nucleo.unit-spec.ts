import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AppointmentsService, CrearTurnoEntrada } from '../../src/appointments/panel/appointments.service';
import { SEMANA_PARTIDA } from '../../src/appointments/catalogo/rubros';
import { diaDeSemana, instanteDe, sumarDias } from '../../src/appointments/horarios/horarios';
import { fechaArgentina } from '../../src/common/utils/hora-argentina';

// Núcleo de turnos (CONTRATO.md § 1) con Prisma mockeado a mano.

const BIZ = 'biz-1';
const JUAN = 'r-juan';
const ANA = 'r-ana';

let lunes = sumarDias(fechaArgentina(new Date()), 3);
while (diaDeSemana(lunes) !== 0) lunes = sumarDias(lunes, 1);

const settingsBase = {
  id: 's-1', businessId: BIZ, agendaMode: 'PROFESSIONAL', weekSchedule: SEMANA_PARTIDA, vacationEnabled: false, vacationFrom: null, vacationTo: null,
  slotMin: 30, bufferMin: 0, minAdvanceMin: 120, maxAdvanceDays: 30, modalities: ['ON_SITE'], confirmation: 'auto',
  depositEnabled: false, depositForNoShows: true, depositType: 'percent', depositPercent: 30, depositFixed: 0,
  accountEnabled: true, welcomeDiscountPercent: 0, onlineCharge: 'deposit', depositOutOfWindow: 'forfeit',
};
const servicio = { id: 'sv-1', businessId: BIZ, name: 'Corte', durationMin: 30, price: 12000, isActive: true, bookableOnline: true };
const agenda = (id: string) => ({ id, name: id, kind: 'PERSON', workDays: [0, 1, 2, 3, 4, 5, 6], ownSchedule: null });

function armar(o: { settings?: Partial<typeof settingsBase>; turnos?: unknown[]; agendas?: unknown[]; servicio?: unknown; perfil?: unknown } = {}) {
  const settings = { ...settingsBase, ...o.settings };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    appointment: {
      findMany: jest.fn().mockResolvedValue(o.turnos ?? []),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 't-nuevo', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    appointmentClassEnrollment: { findFirst: jest.fn().mockResolvedValue(null) },
    appointmentSpecialDay: { findMany: jest.fn().mockResolvedValue([]) },
    customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'c-nuevo' }) },
    appointmentCustomerProfile: {
      findFirst: jest.fn().mockResolvedValue(o.perfil ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
    },
    appointmentPayment: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 1 }), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
  };
  const prisma = {
    appointmentService: { findFirst: jest.fn().mockResolvedValue(o.servicio === undefined ? servicio : o.servicio) },
    appointmentResource: { findMany: jest.fn().mockResolvedValue(o.agendas ?? [agenda(JUAN), agenda(ANA)]), findFirst: jest.fn().mockResolvedValue(null) },
    appointment: { findFirst: jest.fn() },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const settingsSvc = { delNegocio: jest.fn().mockResolvedValue(settings) };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const svc = new AppointmentsService(prisma as any, settingsSvc as any, audit as any);
  return { svc, prisma, tx, settingsSvc, audit };
}

const entrada = (e: Partial<CrearTurnoEntrada> = {}): CrearTurnoEntrada => ({
  businessId: BIZ, modo: 'panel', serviceId: 'sv-1', resourceId: JUAN, date: lunes, startMin: 600,
  cliente: { name: 'José Pérez', phone: '1155550101' }, createdByMemberId: 'm-1', ...e,
});

const ocupado = (resourceId: string, desde: number, hasta: number, id = 'otro') => ({ id, resourceId, startsAt: instanteDe(lunes, desde), endsAt: instanteDe(lunes, hasta) });

describe('crear (§ 1.1)', () => {
  it('toma el lock del negocio y el día dentro de la transacción y guarda el turno CONFIRMED con code y accessToken', async () => {
    const { svc, tx, audit } = armar();
    const { turno, cobro } = await svc.crear(entrada());
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [partes, clave] = tx.$queryRaw.mock.calls[0];
    expect(partes.join('?')).toContain('pg_advisory_xact_lock(hashtext(');
    expect(clave).toBe(`${BIZ}:${lunes}`);
    expect(turno).toMatchObject({
      businessId: BIZ, resourceId: JUAN, status: 'CONFIRMED', origin: 'PANEL', price: 12000, discountAmount: 0, depositAmount: 0,
      startsAt: instanteDe(lunes, 600), endsAt: instanteDe(lunes, 630), customerName: 'José Pérez', customerPhone: '1155550101', customerId: 'c-nuevo', serviceName: 'Corte',
    });
    expect(turno.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(turno.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(turno.confirmedAt).toBeInstanceOf(Date);
    expect(cobro.precio).toBe(12000);
    // Auditoría del panel, sin el accessToken.
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, memberId: 'm-1', entityType: 'appointment', action: 'CREATE' }));
    expect(JSON.stringify(audit.registrar.mock.calls)).not.toContain(turno.accessToken);
  });

  it('todas las consultas llevan businessId', async () => {
    const { svc, prisma, tx } = armar();
    await svc.crear(entrada());
    for (const fn of [prisma.appointmentService.findFirst, prisma.appointmentResource.findMany, tx.appointment.findMany, tx.appointmentSpecialDay.findMany, tx.customer.findFirst, tx.appointment.findFirst, tx.appointmentClassEnrollment.findFirst]) {
      for (const [arg] of fn.mock.calls) expect(arg.where.businessId).toBe(BIZ);
    }
  });

  it('horario ya tomado por otro turno → 409 "Ese horario se acaba de ocupar. Elegí otro."', async () => {
    const { svc, tx } = armar({ turnos: [ocupado(JUAN, 600, 630)] });
    await expect(svc.crear(entrada())).rejects.toThrow(new ConflictException('Ese horario se acaba de ocupar. Elegí otro.'));
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('fuera de horario, fuera de la grilla o en el pasado → 400 "Ese horario no está disponible."', async () => {
    const { svc } = armar();
    await expect(svc.crear(entrada({ startMin: 14 * 60 }))).rejects.toThrow(new BadRequestException('Ese horario no está disponible.'));
    await expect(svc.crear(entrada({ startMin: 605 }))).rejects.toThrow(new BadRequestException('Ese horario no está disponible.'));
    await expect(svc.crear(entrada({ date: sumarDias(fechaArgentina(new Date()), -1) }))).rejects.toThrow(BadRequestException);
    await expect(svc.crear(entrada({ date: '2026-02-30' }))).rejects.toThrow(new BadRequestException('La fecha no es válida.'));
  });

  it('con "cualquiera" asigna la agenda con lugar menos cargada', async () => {
    const { svc } = armar({ turnos: [ocupado(JUAN, 540, 570)] });
    const { turno } = await svc.crear(entrada({ resourceId: 'cualquiera', startMin: 600 }));
    expect(turno.resourceId).toBe(ANA);
  });

  it('una agenda que no es candidata (otro negocio, inactiva o fuera del alcance) → 404', async () => {
    const { svc, prisma } = armar();
    await expect(svc.crear(entrada({ resourceId: 'r-ajena' }))).rejects.toThrow(new NotFoundException('Esa agenda no existe.'));
    await svc.crear(entrada({ agendasPermitidas: [JUAN] })).catch(() => undefined);
    expect(prisma.appointmentResource.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: BIZ, id: { in: [JUAN] }, isBookable: true, isActive: true, deletedAt: null, kind: { in: ['PERSON'] } }) }));
  });

  it('servicio inexistente o de otro negocio → 404; en el sitio además tiene que ser reservable online', async () => {
    const { svc, prisma } = armar({ servicio: null });
    await expect(svc.crear(entrada())).rejects.toThrow(new NotFoundException('Ese servicio no existe.'));
    await svc.crear(entrada({ modo: 'publico' })).catch(() => undefined);
    expect(prisma.appointmentService.findFirst).toHaveBeenLastCalledWith({ where: { id: 'sv-1', businessId: BIZ, isActive: true, deletedAt: null, bookableOnline: true } });
  });

  it('una modalidad que el negocio no ofrece → 400', async () => {
    const { svc } = armar();
    await expect(svc.crear(entrada({ modality: 'HOME' }))).rejects.toThrow(new BadRequestException('Este negocio no atiende de esa forma.'));
  });

  it('si la base rechaza con 23P01 (appointments_no_overlap) se traduce a 409', async () => {
    const { svc, tx } = armar();
    tx.appointment.create.mockRejectedValueOnce(Object.assign(new Error('violates exclusion constraint "appointments_no_overlap"'), { code: 'P2010', meta: { code: '23P01' } }));
    await expect(svc.crear(entrada())).rejects.toThrow(new ConflictException('Ese horario se acaba de ocupar. Elegí otro.'));
  });

  it('un code repetido (P2002) reintenta la transacción entera; otro error se propaga', async () => {
    const { svc, tx, prisma } = armar();
    tx.appointment.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['business_id', 'code'] } }));
    await expect(svc.crear(entrada())).resolves.toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    tx.appointment.create.mockRejectedValueOnce(new Error('db caída'));
    await expect(svc.crear(entrada())).rejects.toThrow('db caída');
  });

  it('el code no se repite con turnos NI con inscripciones a clases del negocio', async () => {
    const { svc, tx } = armar();
    tx.appointment.findFirst.mockResolvedValueOnce({ id: 'ya' });
    tx.appointmentClassEnrollment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'ya' });
    await svc.crear(entrada());
    expect(tx.appointment.findFirst.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('estado inicial: panel CONFIRMED; sitio CONFIRMED con auto, PENDING con manual o con un cobro online pendiente', async () => {
    const publico = { modo: 'publico' as const, startMin: 600 };
    expect((await armar().svc.crear(entrada(publico))).turno).toMatchObject({ status: 'CONFIRMED', origin: 'STOREFRONT' });
    expect((await armar({ settings: { confirmation: 'manual' } }).svc.crear(entrada(publico))).turno).toMatchObject({ status: 'PENDING', confirmedAt: null });
    expect((await armar().svc.crear(entrada({ ...publico, cobroOnlinePendiente: true }))).turno.status).toBe('PENDING');
    expect((await armar({ settings: { confirmation: 'manual' } }).svc.crear(entrada())).turno.status).toBe('CONFIRMED');
  });

  it('cliente: la ficha por teléfono, si no por email, si no se crea (email solo si está libre)', async () => {
    const a = armar();
    a.tx.customer.findFirst.mockResolvedValueOnce({ id: 'c-tel' });
    expect((await a.svc.crear(entrada())).turno.customerId).toBe('c-tel');

    const b = armar();
    b.tx.customer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'c-mail' });
    expect((await b.svc.crear(entrada({ cliente: { name: 'Ana', phone: '1155550000', email: 'ANA@x.com' } }))).turno.customerId).toBe('c-mail');
    expect(b.tx.customer.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { businessId: BIZ, email: 'ana@x.com', deletedAt: null } }));

    const c = armar();
    c.tx.customer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'borrado-con-ese-mail' });
    await c.svc.crear(entrada({ cliente: { name: 'Ana María López', phone: '1155550000', email: 'ana@x.com' } }));
    expect(c.tx.customer.create).toHaveBeenCalledWith({ data: { businessId: BIZ, firstName: 'Ana', lastName: 'María López', phone: '1155550000', email: null }, select: { id: true } });

    const d = armar();
    d.tx.customer.findFirst.mockResolvedValueOnce(null);
    await expect(d.svc.crear(entrada({ cliente: { customerId: 'c-ajeno', name: 'X', phone: '' } }))).rejects.toThrow(new NotFoundException('Ese cliente no existe.'));
    expect(d.tx.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c-ajeno', businessId: BIZ, deletedAt: null } }));
  });

  it('seña y beneficios: calcula en el servidor y consume la bienvenida y el crédito en la misma transacción', async () => {
    const { svc, tx } = armar({
      settings: { depositEnabled: true, welcomeDiscountPercent: 10 },
      perfil: { noShowCount: 0, depositCredit: 500, welcomeUsedAt: null },
    });
    tx.customer.findFirst.mockResolvedValueOnce({ id: 'c-1' });
    tx.appointmentCustomerProfile.findFirst.mockResolvedValueOnce({ noShowCount: 0, depositCredit: 500, welcomeUsedAt: null }).mockResolvedValueOnce({ id: 'p-1' });
    const { turno, cobro } = await svc.crear(entrada({ modo: 'publico', conCuenta: true }));
    expect(cobro).toMatchObject({ precio: 12000, descuento: 1200, aPagar: 10800, sena: 2740, creditoUsado: 500 });
    expect(turno).toMatchObject({ price: 12000, discountAmount: 1200, depositAmount: 2740 });
    expect(tx.appointmentCustomerProfile.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, customerId: 'c-1', welcomeUsedAt: null }, data: { welcomeUsedAt: expect.any(Date) } });
    expect(tx.appointmentCustomerProfile.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, customerId: 'c-1', depositCredit: { gte: 500 } }, data: { depositCredit: { decrement: 500 } } });
  });

  it('extensiones: ajuste por franja, canje y algo más en la transacción (P2/P4)', async () => {
    const { svc, tx } = armar({ settings: { depositEnabled: true } });
    const ajustePorFranja = jest.fn().mockResolvedValue(-10);
    const canjear = jest.fn().mockResolvedValue({ cubierto: 10800, packagePurchaseId: 'pack-1' });
    svc.registrarExtensiones({ ajustePorFranja, canjear });
    const enTransaccion = jest.fn();
    const { turno, cobro } = await svc.crear(entrada({ canje: { packagePurchaseId: 'pack-1' }, enTransaccion }));
    expect(ajustePorFranja).toHaveBeenCalledWith(expect.objectContaining({ tx, businessId: BIZ, serviceId: 'sv-1', date: lunes, startMin: 600 }));
    expect(canjear).toHaveBeenCalledWith(expect.objectContaining({ aPagar: 10800, pedido: { packagePurchaseId: 'pack-1' } }));
    expect(cobro).toMatchObject({ precio: 10800, aPagar: 0, sena: 0 });
    expect(turno.packagePurchaseId).toBe('pack-1');
    expect(enTransaccion).toHaveBeenCalledWith(tx, turno, cobro);
    // Sin pedido de canje no se llama.
    canjear.mockClear();
    await svc.crear(entrada());
    expect(canjear).not.toHaveBeenCalled();
  });

  it('el precio a mano no pasa por el ajuste por franja', async () => {
    const { svc } = armar();
    const ajustePorFranja = jest.fn().mockResolvedValue(50);
    svc.registrarExtensiones({ ajustePorFranja });
    const { turno } = await svc.crear(entrada({ precioManual: 5000 }));
    expect(turno.price).toBe(5000);
    expect(ajustePorFranja).not.toHaveBeenCalled();
  });

  it('en modo RESOURCE, la persona con espacio asignado reserva en su espacio', async () => {
    const { svc, prisma } = armar({ settings: { agendaMode: 'RESOURCE' }, agendas: [{ ...agenda('cabina-1'), kind: 'SPACE' }] });
    prisma.appointmentResource.findFirst.mockResolvedValueOnce({ kind: 'PERSON', assignedSpaceId: 'cabina-1' });
    const { turno } = await svc.crear(entrada({ resourceId: 'persona-1' }));
    expect(turno.resourceId).toBe('cabina-1');
  });
});

// ─── § 1.2 Estados ────────────────────────────────────────────────────────────

const turnoGuardado = (t: Record<string, unknown> = {}) => ({
  id: 't-1', businessId: BIZ, code: 'ABC234', status: 'CONFIRMED', resourceId: JUAN, customerId: 'c-1', depositPaidAt: null, depositAmount: 0,
  startsAt: new Date(Date.now() - 3600_000), endsAt: new Date(Date.now() - 1800_000), durationMin: 30, ...t,
});

function conTurno(t: Record<string, unknown> = {}, settings: Partial<typeof settingsBase> = {}) {
  const a = armar({ settings });
  a.prisma.appointment.findFirst.mockResolvedValue(turnoGuardado(t));
  a.tx.appointment.findFirst.mockResolvedValue(turnoGuardado(t));
  return a;
}

describe('cambiarEstado (§ 1.2)', () => {
  it.each([
    ['COMPLETED', 'CONFIRMED', 'Un turno atendido no puede pasar a confirmado.'],
    ['NO_SHOW', 'COMPLETED', 'Un turno ausente no puede pasar a atendido.'],
    ['CANCELLED', 'CONFIRMED', 'Un turno cancelado no puede pasar a confirmado.'],
    ['CANCELLED', 'CANCELLED', 'Un turno cancelado no puede pasar a cancelado.'],
    ['PENDING', 'COMPLETED', 'Un turno pendiente no puede pasar a atendido.'],
    ['CONFIRMED', 'CONFIRMED', 'Un turno confirmado no puede pasar a confirmado.'],
  ])('%s → %s es 400', async (de, a, mensaje) => {
    const { svc, tx } = conTurno({ status: de });
    await expect(svc.cambiarEstado(BIZ, 't-1', a as any)).rejects.toThrow(new BadRequestException(mensaje));
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('atendido / ausente solo cuando el turno ya empezó', async () => {
    const { svc } = conTurno({ startsAt: new Date(Date.now() + 3600_000) });
    const msj = 'Todavía no es la hora del turno: no se puede marcar como atendido ni ausente.';
    await expect(svc.cambiarEstado(BIZ, 't-1', 'COMPLETED')).rejects.toThrow(new BadRequestException(msj));
    await expect(svc.cambiarEstado(BIZ, 't-1', 'NO_SHOW')).rejects.toThrow(new BadRequestException(msj));
  });

  it('confirmar y atender guardan su instante, con el estado anterior en el where (concurrencia)', async () => {
    const p = conTurno({ status: 'PENDING', startsAt: new Date(Date.now() + 86400_000) });
    await p.svc.cambiarEstado(BIZ, 't-1', 'CONFIRMED');
    expect(p.tx.appointment.updateMany).toHaveBeenCalledWith({ where: { id: 't-1', businessId: BIZ, status: 'PENDING' }, data: { status: 'CONFIRMED', confirmedAt: expect.any(Date) } });
    const c = conTurno();
    await c.svc.cambiarEstado(BIZ, 't-1', 'COMPLETED', { memberId: 'm-1' });
    expect(c.tx.appointment.updateMany).toHaveBeenCalledWith({ where: { id: 't-1', businessId: BIZ, status: 'CONFIRMED' }, data: { status: 'COMPLETED', completedAt: expect.any(Date) } });
    expect(c.audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'appointment', action: 'UPDATE', changes: expect.arrayContaining([{ field: 'status', before: 'CONFIRMED', after: 'COMPLETED' }]) }));
  });

  it('si otro lo cambió en el medio → 409', async () => {
    const { svc, tx } = conTurno();
    tx.appointment.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.cambiarEstado(BIZ, 't-1', 'CANCELLED')).rejects.toThrow(ConflictException);
  });

  it('turno de otro negocio o fuera del alcance → 404', async () => {
    const { svc, prisma } = conTurno();
    prisma.appointment.findFirst.mockResolvedValueOnce(null);
    await expect(svc.cambiarEstado(BIZ, 't-1', 'CANCELLED', { agendasPermitidas: [ANA] })).rejects.toThrow(new NotFoundException('Ese turno no existe.'));
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({ where: { id: 't-1', businessId: BIZ, resourceId: { in: [ANA] } } });
  });

  it('ausente: noShowCount + 1; con seña paga y "credit", la seña queda a favor', async () => {
    const forfeit = conTurno({ depositPaidAt: new Date(), depositAmount: 3000 });
    await forfeit.svc.cambiarEstado(BIZ, 't-1', 'NO_SHOW');
    expect(forfeit.tx.appointmentCustomerProfile.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, customerId: 'c-1' }, data: { noShowCount: { increment: 1 }, depositCredit: { increment: 0 } } });

    const credit = conTurno({ depositPaidAt: new Date(), depositAmount: 3000 }, { depositOutOfWindow: 'credit' });
    credit.tx.appointmentCustomerProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await credit.svc.cambiarEstado(BIZ, 't-1', 'NO_SHOW');
    expect(credit.tx.appointmentCustomerProfile.create).toHaveBeenCalledWith({ data: { businessId: BIZ, customerId: 'c-1', noShowCount: 1, depositCredit: 3000 } });
  });

  it('cancelar desde el panel: BUSINESS, motivo; la seña cobrada en el local queda REFUNDED y la de MP va al reembolso (P2)', async () => {
    const { svc, tx } = conTurno({ startsAt: new Date(Date.now() + 86400_000), depositPaidAt: new Date(), depositAmount: 3000 });
    tx.appointmentPayment.findMany.mockResolvedValueOnce([{ id: 'pay-cash', method: 'CASH' }, { id: 'pay-mp', method: 'MERCADOPAGO' }]);
    const reembolsarMercadoPago = jest.fn().mockRejectedValue(new Error('MP caído'));
    svc.registrarExtensiones({ reembolsarMercadoPago });
    await svc.cambiarEstado(BIZ, 't-1', 'CANCELLED', { reason: '  Se enfermó  ', memberId: 'm-1' });
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 't-1', businessId: BIZ, status: 'CONFIRMED' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date), cancelledBy: 'BUSINESS', cancelReason: 'Se enfermó' },
    });
    expect(tx.appointmentPayment.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, id: { in: ['pay-cash'] } }, data: { status: 'REFUNDED', refundedAt: expect.any(Date) } });
    // Si el reembolso de MP falla, la cancelación sigue igual.
    expect(reembolsarMercadoPago).toHaveBeenCalledWith({ businessId: BIZ, appointmentPaymentId: 'pay-mp' });
  });

  it('cancelar con keepDeposit (retener) no toca los pagos; "credito" suma la seña cobrada al perfil', async () => {
    const r = conTurno({ startsAt: new Date(Date.now() + 86400_000), depositPaidAt: new Date(), depositAmount: 3000 });
    await r.svc.cambiarEstado(BIZ, 't-1', 'CANCELLED', { sena: 'retener' });
    expect(r.tx.appointmentPayment.findMany).not.toHaveBeenCalled();
    const c = conTurno({ startsAt: new Date(Date.now() + 86400_000), depositPaidAt: new Date(), depositAmount: 0 });
    c.tx.appointmentPayment.aggregate.mockResolvedValueOnce({ _sum: { amount: 4000 } });
    await c.svc.cambiarEstado(BIZ, 't-1', 'CANCELLED', { sena: 'credito', cancelledBy: 'CUSTOMER' });
    expect(c.tx.appointmentCustomerProfile.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, customerId: 'c-1' }, data: { noShowCount: { increment: 0 }, depositCredit: { increment: 4000 } } });
  });

  it('la extensión alCambiarEstado corre en la transacción con el estado anterior y el nuevo', async () => {
    const { svc, tx } = conTurno();
    const alCambiarEstado = jest.fn();
    svc.registrarExtensiones({ alCambiarEstado });
    await svc.cambiarEstado(BIZ, 't-1', 'COMPLETED');
    expect(alCambiarEstado).toHaveBeenCalledWith(expect.objectContaining({ tx, businessId: BIZ, de: 'CONFIRMED', a: 'COMPLETED' }));
  });
});

// ─── § 1.4 Mover ──────────────────────────────────────────────────────────────

describe('mover (§ 1.4)', () => {
  const futuro = { startsAt: instanteDe(lunes, 540), endsAt: instanteDe(lunes, 570), status: 'PENDING' };

  it('un turno cerrado no se mueve', async () => {
    for (const status of ['COMPLETED', 'NO_SHOW', 'CANCELLED']) {
      const { svc } = conTurno({ status });
      await expect(svc.mover(BIZ, 't-1', { date: lunes, startMin: 600 }, { modo: 'panel' })).rejects.toThrow(new BadRequestException('Ese turno ya está cerrado: no se puede mover.'));
    }
  });

  it('panel: no se cuenta a sí mismo, lo deja CONFIRMED, limpia recordatorios y no suma rescheduleCount', async () => {
    const { svc, tx } = conTurno(futuro);
    tx.appointment.findMany.mockResolvedValue([ocupado(JUAN, 540, 570, 't-1')]);
    await svc.mover(BIZ, 't-1', { date: lunes, startMin: 540 }, { modo: 'panel', memberId: 'm-1' });
    const [arg] = tx.appointment.updateMany.mock.calls[0];
    expect(arg.where).toEqual({ id: 't-1', businessId: BIZ, status: 'PENDING', startsAt: futuro.startsAt });
    expect(arg.data).toMatchObject({ resourceId: JUAN, status: 'CONFIRMED', reminderSentAt: null, secondReminderSentAt: null });
    expect(arg.data.rescheduleCount).toBeUndefined();
  });

  it('cliente (P2): suma rescheduleCount y no cambia el estado', async () => {
    const { svc, tx } = conTurno(futuro);
    await svc.mover(BIZ, 't-1', { date: lunes, startMin: 600 }, { modo: 'publico', porCliente: true });
    const [arg] = tx.appointment.updateMany.mock.calls[0];
    expect(arg.data).toMatchObject({ rescheduleCount: { increment: 1 } });
    expect(arg.data.status).toBeUndefined();
  });

  it('a un horario tomado → 409; si la base rechaza con 23P01 → 409', async () => {
    const a = conTurno(futuro);
    a.tx.appointment.findMany.mockResolvedValue([ocupado(JUAN, 600, 630)]);
    await expect(a.svc.mover(BIZ, 't-1', { date: lunes, startMin: 600 }, { modo: 'panel' })).rejects.toThrow(new ConflictException('Ese horario se acaba de ocupar. Elegí otro.'));
    const b = conTurno(futuro);
    b.tx.appointment.updateMany.mockRejectedValueOnce(new Error('conflicting key value violates exclusion constraint "appointments_no_overlap"'));
    await expect(b.svc.mover(BIZ, 't-1', { date: lunes, startMin: 600 }, { modo: 'panel' })).rejects.toThrow(ConflictException);
  });

  it('a una agenda que no es candidata → 404', async () => {
    const { svc } = conTurno(futuro);
    await expect(svc.mover(BIZ, 't-1', { date: lunes, startMin: 600, resourceId: 'r-ajena' }, { modo: 'panel' })).rejects.toThrow(new NotFoundException('Esa agenda no existe.'));
  });
});
