import { AppointmentsAgendaService } from '../../src/appointments/panel/appointments-agenda.service';
import { SEMANA_PARTIDA } from '../../src/appointments/catalogo/rubros';
import { instanteDe } from '../../src/appointments/horarios/horarios';
import type { MemberContext } from '../../src/common/types/auth-context.type';

// Agenda y resumen (§ P1.5) con Prisma mockeado. Un lunes lejano, abierto 9–13 y 16–20.

const BIZ = 'biz-1';
const FECHA = '2030-01-07';
const dueno: MemberContext = { type: 'member', memberId: 'm-1', businessId: BIZ, businessMode: 'FULL', roleId: 'r', roleName: 'owner', permissions: [] };
const barbero: MemberContext = { ...dueno, memberId: 'm-2', roleName: 'Barbero', permissions: ['appointments.agenda.view'] };

const recurso = (id: string) => ({ id, businessId: BIZ, kind: 'PERSON', name: id, roleLabel: null, color: null, photoUrl: null, bio: null, isBookable: true, assignedSpaceId: null, workDays: [0, 1, 2, 3, 4, 5], ownSchedule: null, isActive: true, sortOrder: 0 });
const turno = (id: string, resourceId: string, desde: number, status = 'CONFIRMED', precio = 10000) => ({
  id, code: 'X', status, origin: 'PANEL', modality: 'ON_SITE', resourceId, serviceId: 's', customerId: null, customerName: 'A', customerPhone: '1155550101', customerEmail: null,
  customerNote: null, internalNote: null, serviceName: 'Corte', startsAt: instanteDe(FECHA, desde), endsAt: instanteDe(FECHA, desde + 60), durationMin: 60,
  price: precio, discountAmount: 0, depositAmount: 0, depositPaidAt: null, depositMethod: null, rescheduleCount: 0, recurringSeriesId: null, resource: { name: resourceId },
});

function armar() {
  const prisma = {
    appointmentResource: { findFirst: jest.fn().mockResolvedValue({ id: 'r-juan', assignedSpaceId: null }), findMany: jest.fn().mockResolvedValue([recurso('r-ana'), recurso('r-juan')]) },
    appointmentSpecialDay: { findMany: jest.fn().mockResolvedValue([]) },
    appointment: { findMany: jest.fn().mockResolvedValue([turno('t1', 'r-ana', 540), turno('t2', 'r-juan', 600), turno('t3', 'r-juan', 960, 'CANCELLED')]) },
    appointmentPayment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 4000 } }) },
  };
  const settings = { delNegocio: jest.fn().mockResolvedValue({ agendaMode: 'PROFESSIONAL', weekSchedule: SEMANA_PARTIDA, vacationEnabled: false, slotMin: 60, bufferMin: 0, minAdvanceMin: 0, maxAdvanceDays: 30 }) };
  const nucleo = { contexto: jest.fn(async () => ({ reglas: { slotMin: 60, bufferMin: 0, minAdvanceMin: 0, maxAdvanceDays: 30 }, horario: { semana: SEMANA_PARTIDA, especiales: [], vacaciones: null }, recursos: [recurso('r-ana'), recurso('r-juan')], turnos: [], ahora: new Date('2030-01-06T12:00:00Z'), modo: 'panel' })) };
  return { svc: new AppointmentsAgendaService(prisma as any, settings as any, nucleo as any), prisma };
}

describe('resumen', () => {
  it('ocupación = minutos tomados / minutos que atienden (sin el corte del mediodía); cancelados afuera', async () => {
    const { svc } = armar();
    const r = await svc.resumen(dueno, FECHA, new Date('2030-01-06T12:00:00Z'));
    // 2 agendas × 8 h = 960 min; 2 turnos de 60 no cancelados → 12,5 % → 13.
    expect(r.kpis).toMatchObject({ appointments: 2, cancelled: 1, pending: 0, occupancyPercent: 13, expectedRevenue: 20000, collectedRevenue: 4000 });
    expect(r.upcoming.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(r.open).toEqual({ isOpen: false, closesAtMin: null, opensAtMin: 540 });
    expect(r.gaps.map((g) => g.resourceId)).toEqual(['r-ana', 'r-juan']);
  });

  it('sin reports.view los montos van en null; sin view_all solo sus agendas', async () => {
    const { svc, prisma } = armar();
    const r = await svc.resumen(barbero, FECHA);
    expect(r.kpis.expectedRevenue).toBeNull();
    expect(r.kpis.collectedRevenue).toBeNull();
    expect(prisma.appointmentPayment.aggregate).not.toHaveBeenCalled();
    expect(prisma.appointmentResource.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: BIZ, id: { in: ['r-juan'] } }) }));
  });
});

describe('día y rango', () => {
  it('día: una columna por agenda con sus tramos y sus turnos, cancelados incluidos', async () => {
    const { svc } = armar();
    const d = await svc.dia(dueno, FECHA);
    expect(d.businessRanges).toEqual([[540, 780], [960, 1200]]);
    expect(d.resources[1].appointments.map((t) => t.status)).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(d.classes).toEqual([]);
  });

  it('rango: hasta 42 días', async () => {
    const { svc } = armar();
    await expect(svc.rango(dueno, FECHA, '2030-02-18')).rejects.toThrow('El rango puede ser de hasta 42 días.');
    const r = await svc.rango(dueno, FECHA, '2030-01-13');
    expect(r.days).toHaveLength(7);
    expect(r.days[0].appointments).toHaveLength(3);
    expect(r.days[6].businessRanges).toEqual([]);
  });
});
