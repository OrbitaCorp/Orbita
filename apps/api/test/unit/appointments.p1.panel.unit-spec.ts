import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppointmentsPanelService } from '../../src/appointments/panel/appointments-panel.service';
import type { MemberContext } from '../../src/common/types/auth-context.type';

// El service del panel de turnos (§ P1.4): lo que agrega sobre el núcleo.

const BIZ = 'biz-1';
const TOKEN = 'TOKEN-SECRETO-del-enlace-personal-000000000';
const dueno: MemberContext = { type: 'member', memberId: 'm-1', businessId: BIZ, businessMode: 'FULL', roleId: 'r', roleName: 'owner', permissions: [] };
const barbero: MemberContext = { ...dueno, memberId: 'm-2', roleName: 'Barbero', permissions: ['appointments.agenda.view', 'appointments.agenda.manage', 'appointments.cash.charge'] };
const recepcion: MemberContext = { ...dueno, memberId: 'm-3', roleName: 'Recepción', permissions: ['appointments.agenda.view', 'appointments.agenda.view_all', 'appointments.agenda.manage', 'appointments.agenda.manage_all', 'appointments.clients.contact'] };

const fila = (t: Record<string, unknown> = {}) => ({
  id: 't-1', code: 'ABC234', status: 'CONFIRMED', origin: 'PANEL', modality: 'ON_SITE', resourceId: 'r-juan', serviceId: 'sv-1', customerId: 'c-1',
  customerName: 'José Pérez', customerPhone: '1155550101', customerEmail: 'jose@x.com', customerNote: null, internalNote: null, serviceName: 'Corte',
  startsAt: new Date('2030-01-07T13:00:00.000Z'), endsAt: new Date('2030-01-07T13:30:00.000Z'), durationMin: 30, price: 12000, discountAmount: 0,
  depositAmount: 3000, depositPaidAt: null, depositMethod: null, rescheduleCount: 0, recurringSeriesId: null, resource: { name: 'Juan' },
  customerAddress: null, customerDni: null, insuranceName: null, insuranceNumber: null, reason: null, confirmedAt: null, completedAt: null, cancelledAt: null,
  cancelledBy: null, cancelReason: null, wantsReminder: true, reminderSentAt: null, packagePurchaseId: null, giftCardId: null, membershipId: null,
  createdAt: new Date('2030-01-01T00:00:00Z'), createdByMember: { name: 'Rocío' }, payments: [], messageLogs: [], accessToken: TOKEN, ...t,
});

function armar(o: { settings?: Record<string, unknown>; propia?: { id: string; assignedSpaceId: string | null } | null } = {}) {
  const tx = { appointment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, appointmentPayment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) } };
  const prisma = {
    appointment: { findFirst: jest.fn().mockResolvedValue(fila()), findMany: jest.fn().mockResolvedValue([fila()]), count: jest.fn().mockResolvedValue(1), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    appointmentResource: { findFirst: jest.fn().mockResolvedValue(o.propia === undefined ? { id: 'r-juan', assignedSpaceId: null } : o.propia) },
    appointmentPayment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    appointmentMessageLog: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'log', createdAt: new Date(), error: null, ...data })) },
    customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', firstName: 'José', lastName: 'Pérez', phone: '11 5555-0101', email: null }) },
    business: { findUnique: jest.fn().mockResolvedValue({ name: 'Barbería', subdomain: 'barberia' }) },
    customDomain: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 't-1' }]),
    $transaction: jest.fn((x: unknown) => (typeof x === 'function' ? (x as (t: typeof tx) => unknown)(tx) : Promise.all(x as unknown[]))),
  };
  const settings = { delNegocio: jest.fn().mockResolvedValue({ id: 's-1', agendaMode: 'PROFESSIONAL', messages: null, vacationMessage: null, ...o.settings }) };
  const nucleo = { crear: jest.fn().mockResolvedValue({ turno: { id: 't-1' } }), cambiarEstado: jest.fn(), mover: jest.fn(), buscar: jest.fn().mockResolvedValue(fila()) };
  const mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
  const audit = { registrar: jest.fn() };
  const svc = new AppointmentsPanelService(prisma as any, settings as any, nucleo as any, mail as any, audit as any);
  return { svc, prisma, tx, nucleo, mail, audit };
}

describe('listar', () => {
  it('rango: hasta 92 días y "hasta" no antes que "desde"; estados de la lista', async () => {
    const { svc } = armar();
    await expect(svc.listar(dueno, { from: '2030-01-01', to: '2030-04-30' })).rejects.toThrow(new BadRequestException('El rango puede ser de hasta 92 días.'));
    await expect(svc.listar(dueno, { from: '2030-01-10', to: '2030-01-01' })).rejects.toThrow(BadRequestException);
    await expect(svc.listar(dueno, { status: 'CONFIRMED,BORRADO' })).rejects.toThrow(new BadRequestException('Los estados posibles son: PENDING, CONFIRMED, COMPLETED, NO_SHOW, CANCELLED.'));
  });

  it('sin view_all filtra a las propias; una agenda ajena pedida da lista vacía', async () => {
    const { svc, prisma } = armar();
    await svc.listar(barbero, { from: '2030-01-07', to: '2030-01-07', resourceId: 'r-ana', status: 'confirmed' });
    const [{ where }] = prisma.appointment.findMany.mock.calls[0];
    expect(where).toMatchObject({ businessId: BIZ, resourceId: { in: [] }, status: { in: ['CONFIRMED'] } });
  });

  it('la búsqueda va por SQL con businessId y sin acentos; sin clients.contact el teléfono viaja tapado', async () => {
    const { svc, prisma } = armar();
    const r = await svc.listar(barbero, { q: 'José', page: 2, limit: 10 });
    const [partes, ...valores] = prisma.$queryRaw.mock.calls[0];
    expect(partes.join('?')).toContain('business_id = ?');
    expect(valores).toContain(BIZ);
    expect(valores).toContain('%jose%');
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ id: { in: ['t-1'] } }) }));
    expect(r.data[0].customer).toEqual({ id: 'c-1', name: 'José Pérez', phone: '••••••••01', email: null });
    expect(r).toMatchObject({ total: 1, page: 2, limit: 10 });
  });
});

describe('detalle', () => {
  it('nunca devuelve el accessToken; can según permisos y alcance', async () => {
    const { svc, prisma } = armar();
    const d = await svc.detalle(recepcion, 't-1');
    expect(JSON.stringify(d)).not.toContain(TOKEN);
    expect(prisma.appointment.findFirst.mock.calls[0][0].select.accessToken).toBeUndefined();
    expect(d.can).toEqual({ edit: true, charge: false, contact: true, transitions: ['CANCELLED'] });
    expect(d.customer.phone).toBe('1155550101');
    expect(d.createdByMemberName).toBe('Rocío');
  });

  it('fuera del alcance o de otro negocio → 404', async () => {
    const { svc, prisma } = armar();
    prisma.appointment.findFirst.mockResolvedValueOnce(null);
    await expect(svc.detalle(barbero, 't-ajeno')).rejects.toThrow(new NotFoundException('Ese turno no existe.'));
    expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({ id: 't-ajeno', businessId: BIZ, resourceId: { in: ['r-juan'] } });
  });

  it('mensajes enviados: el destinatario tapado sin clients.contact', async () => {
    const { svc, prisma } = armar();
    prisma.appointment.findFirst.mockResolvedValueOnce(fila({ messageLogs: [
      { id: 'l1', channel: 'EMAIL', template: 'confirmacion', recipient: 'jose@x.com', status: 'SENT', error: null, createdAt: new Date() },
      { id: 'l2', channel: 'WHATSAPP', template: 'confirmacion', recipient: '1155550101', status: 'SIMULATED', error: null, createdAt: new Date() },
    ] }));
    const d = await svc.detalle(barbero, 't-1');
    expect(d.messages.map((m) => m.recipient)).toEqual(['j•••@x.com', '••••••••01']);
  });
});

describe('crear', () => {
  const base = { serviceId: 'sv-1', resourceId: 'r-juan', date: '2030-01-07', startMin: 600 };

  it('exactamente uno: cliente existente o nuevo', async () => {
    const { svc, nucleo } = armar();
    await expect(svc.crear(dueno, base as any)).rejects.toThrow(new BadRequestException('Elegí un cliente o cargá uno nuevo.'));
    await expect(svc.crear(dueno, { ...base, customerId: 'c-1', customer: { name: 'José' } } as any)).rejects.toThrow(BadRequestException);
    expect(nucleo.crear).not.toHaveBeenCalled();
  });

  it('el precio a mano exige services.manage', async () => {
    const { svc } = armar();
    await expect(svc.crear(barbero, { ...base, customer: { name: 'José' }, priceOverride: 1 })).rejects.toThrow(new ForbiddenException('Permiso requerido: appointments.services.manage'));
  });

  it('pasa al núcleo en modo panel, con el alcance de manage y el snapshot de la ficha', async () => {
    const { svc, nucleo, prisma } = armar();
    await svc.crear(barbero, { ...base, resourceId: 'CUALQUIERA', customerId: 'c-1' });
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c-1', businessId: BIZ, deletedAt: null } }));
    expect(nucleo.crear).toHaveBeenCalledWith(expect.objectContaining({
      businessId: BIZ, modo: 'panel', resourceId: 'cualquiera', createdByMemberId: 'm-2', agendasPermitidas: ['r-juan'],
      cliente: { customerId: 'c-1', name: 'José Pérez', phone: '1155550101', email: null },
    }));
  });

  it('cliente nuevo: teléfono normalizado (8 a 15 dígitos) y obra social al snapshot', async () => {
    const { svc, nucleo } = armar();
    await expect(svc.crear(dueno, { ...base, customer: { name: 'José', phone: '123' } })).rejects.toThrow(new BadRequestException('El teléfono tiene que tener entre 8 y 15 dígitos.'));
    await svc.crear(dueno, { ...base, customer: { name: ' José ', phone: '011 15 5555-0101', email: 'JOSE@x.com', insuranceName: 'OSDE' } });
    expect(nucleo.crear).toHaveBeenCalledWith(expect.objectContaining({
      cliente: { name: 'José', phone: '1155550101', email: 'jose@x.com' }, detalles: { internalNote: null, insuranceName: 'OSDE' }, agendasPermitidas: null,
    }));
  });
});

describe('estado y mover: delegan en el núcleo con el alcance de manage', () => {
  it('cancelar con keepDeposit retiene la seña; sin él se devuelve', async () => {
    const { svc, nucleo } = armar();
    await svc.cambiarEstado(barbero, 't-1', { status: 'CANCELLED', keepDeposit: true, reason: 'x' });
    expect(nucleo.cambiarEstado).toHaveBeenCalledWith(BIZ, 't-1', 'CANCELLED', { reason: 'x', sena: 'retener', cancelledBy: 'BUSINESS', memberId: 'm-2', agendasPermitidas: ['r-juan'] });
    await svc.cambiarEstado(dueno, 't-1', { status: 'CANCELLED' });
    expect(nucleo.cambiarEstado).toHaveBeenLastCalledWith(BIZ, 't-1', 'CANCELLED', expect.objectContaining({ sena: 'reembolsar', agendasPermitidas: null }));
  });

  it('mover sin resourceId deja la misma agenda', async () => {
    const { svc, nucleo } = armar();
    await svc.mover(dueno, 't-1', { date: '2030-01-08', startMin: 600 });
    expect(nucleo.mover).toHaveBeenCalledWith(BIZ, 't-1', { date: '2030-01-08', startMin: 600, resourceId: undefined }, { modo: 'panel', memberId: 'm-1', agendasPermitidas: null });
  });
});

describe('seña y cobros', () => {
  it('seña por defecto = depositAmount, una sola vez; monto entre 0 y el total', async () => {
    const { svc, tx, audit } = armar();
    await svc.registrarPago(dueno, 't-1', { method: 'CASH' });
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({ where: { id: 't-1', businessId: BIZ, depositPaidAt: null }, data: { depositPaidAt: expect.any(Date), depositMethod: 'CASH' } });
    expect(tx.appointmentPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, appointmentId: 't-1', kind: 'DEPOSIT', method: 'CASH', status: 'APPROVED', amount: 3000, registeredByMemberId: 'm-1', paidAt: expect.any(Date) }) });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'appointment_payment', action: 'CREATE' }));
  });

  it('errores: ya registrada, cancelado, monto fuera de rango; la carrera también es 400', async () => {
    const a = armar();
    a.nucleo.buscar.mockResolvedValueOnce(fila({ depositPaidAt: new Date() }));
    await expect(a.svc.registrarPago(dueno, 't-1', { method: 'CASH' })).rejects.toThrow(new BadRequestException('La seña de este turno ya está registrada.'));
    a.nucleo.buscar.mockResolvedValueOnce(fila({ status: 'CANCELLED' }));
    await expect(a.svc.registrarPago(dueno, 't-1', { method: 'CASH' })).rejects.toThrow(new BadRequestException('Ese turno está cancelado: no se puede cobrar.'));
    await expect(a.svc.registrarPago(dueno, 't-1', { method: 'CASH', amount: 12000.01 })).rejects.toThrow(new BadRequestException('El monto tiene que ser mayor a 0 y no puede pasar el total del turno.'));
    a.nucleo.buscar.mockResolvedValueOnce(fila({ depositAmount: 0 }));
    await expect(a.svc.registrarPago(dueno, 't-1', { method: 'CASH' })).rejects.toThrow(BadRequestException);
    a.tx.appointment.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(a.svc.registrarPago(dueno, 't-1', { method: 'CASH' })).rejects.toThrow(new BadRequestException('La seña de este turno ya está registrada.'));
  });

  it('BALANCE: por defecto, lo que falta cobrar', async () => {
    const { svc, prisma, tx } = armar();
    prisma.appointmentPayment.aggregate.mockResolvedValueOnce({ _sum: { amount: 3000 } });
    await svc.registrarPago(dueno, 't-1', { method: 'QR', kind: 'BALANCE' });
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
    expect(tx.appointmentPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: 'BALANCE', amount: 9000 }) });
  });
});

describe('mensajes', () => {
  it('arma el texto con el enlace personal (dominio propio si está activo) y el link a wa.me', async () => {
    const { svc, prisma } = armar();
    prisma.customDomain.findFirst.mockResolvedValueOnce({ domain: 'barberialorena.com' });
    const m = await svc.mensaje(recepcion, 't-1', 'confirmacion');
    expect(m.text).toBe(`¡Hola José! Tu turno de Corte quedó confirmado para el lunes 07/01 a las 10:00 con Juan. Si necesitás cambiarlo: https://barberialorena.com/mi-turno/${TOKEN}\n\n— Barbería`);
    expect(m.phone).toBe('541155550101');
    expect(m.waLink).toBe(`https://wa.me/541155550101?text=${encodeURIComponent(m.text)}`);
    expect(prisma.customDomain.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, status: 'ACTIVE' } }));
  });

  it('sin teléfono: phone y waLink en null', async () => {
    const { svc, prisma } = armar();
    prisma.appointment.findFirst.mockResolvedValueOnce(fila({ customerPhone: '' }));
    const m = await svc.mensaje(recepcion, 't-1', 'recordatorio');
    expect(m).toMatchObject({ phone: null, waLink: null });
    expect(m.text).toContain(`https://barberia.orbita.site/mi-turno/${TOKEN}`);
  });

  it('reenvío: un renglón por canal con dedupeKey del instante; WhatsApp sale por el STUB', async () => {
    const { svc, prisma, mail } = armar();
    const r = await svc.enviarMensaje(recepcion, 't-1', 'confirmacion');
    expect(r.map((x) => `${x.channel}:${x.status}`)).toEqual(['WHATSAPP:SIMULATED', 'EMAIL:SENT']);
    expect(mail.sendCustomEmail).toHaveBeenCalledWith('jose@x.com', expect.any(String), expect.stringContaining('¡Hola José!'), { businessId: BIZ });
    const claves = prisma.appointmentMessageLog.create.mock.calls.map(([a]) => a.data.dedupeKey as string);
    expect(claves[0]).toMatch(/^confirmacion:wa:t-1:2030-01-07T13:00:00\.000Z:manual-\d+$/);
    for (const [a] of prisma.appointmentMessageLog.create.mock.calls) expect(a.data.businessId).toBe(BIZ);
  });

  it('plantilla apagada o sin destino → 400; un fallo del mail queda FAILED y no rompe', async () => {
    const apagada = armar({ settings: { messages: { mensajes: [{ id: 'extranamos', on: false, canales: ['wa'], cuando: '30', texto: 'x' }] } } });
    await expect(apagada.svc.enviarMensaje(recepcion, 't-1', 'extranamos')).rejects.toThrow(new BadRequestException('Ese mensaje está apagado en Configuración → Mensajes.'));
    const sinDestino = armar();
    sinDestino.prisma.appointment.findFirst.mockResolvedValueOnce(fila({ customerPhone: '', customerEmail: null }));
    await expect(sinDestino.svc.enviarMensaje(recepcion, 't-1', 'confirmacion')).rejects.toThrow(BadRequestException);
    const falla = armar({ settings: { messages: { wa: false } } });
    falla.mail.sendCustomEmail.mockRejectedValueOnce(new Error('Resend caído'));
    const r = await falla.svc.enviarMensaje(recepcion, 't-1', 'confirmacion');
    expect(r).toEqual([expect.objectContaining({ channel: 'EMAIL', status: 'FAILED', error: 'Resend caído' })]);
  });
});
