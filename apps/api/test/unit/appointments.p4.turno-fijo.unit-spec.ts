import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TurnoFijoService } from '../../src/appointments/avanzado/turno-fijo/turno-fijo.service';
import { CrearTurno } from '../../src/appointments/avanzado/comun/nucleo-turnos';
import { sumarDias } from '../../src/appointments/horarios/horarios';
import { fechaArgentina } from '../../src/common/utils/hora-argentina';
import { BIZ, auditor, avanzado, conTransaccion, contexto } from './appointments.p4.helpers';

// Turno fijo (CONTRATO § P4.6): la serie se arma con el núcleo INYECTADO
// (`crearTurno` de P1), en una sola transacción, con un SAVEPOINT por turno
// para que uno ocupado se saltee sin abortar los demás.

const proximoLunes = (() => { let f = sumarDias(fechaArgentina(new Date()), 1); while (new Date(`${f}T12:00:00Z`).getUTCDay() !== 1) f = sumarDias(f, 1); return f; })();
const SRV = '11111111-1111-4111-8111-111111111111';
const RES = '22222222-2222-4222-8222-222222222222';

function armar(opts: { config?: Record<string, unknown>; feriados?: string[]; recurso?: boolean; on?: boolean; nucleo?: boolean } = {}) {
  const config = { serviceIds: [SRV], frecuencias: ['WEEKLY', 'BIWEEKLY'], maximo: 12, saltearFeriados: true, ...(opts.config ?? {}) };
  const ctx = contexto({ settings: { advanced: opts.on === false ? null : avanzado({ 'turno-fijo': config }) } });
  const prisma = conTransaccion({
    business: ctx.business,
    appointmentService: { findFirst: jest.fn().mockResolvedValue({ id: SRV }) },
    appointmentResource: { findFirst: jest.fn().mockResolvedValue(opts.recurso === false ? null : { id: RES }) },
    appointmentSpecialDay: { findMany: jest.fn().mockResolvedValue((opts.feriados ?? []).map((date) => ({ date, kind: 'CLOSED', ranges: [] }))) },
    appointmentRecurringSeries: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'serie-1', ...data })),
      findFirst: jest.fn().mockResolvedValue({
        id: 'serie-1', businessId: BIZ, customerName: 'Ana Paz', resourceId: RES, serviceId: SRV, frequency: 'WEEKLY', weekday: 0, startMin: 600,
        startDate: proximoLunes, maxOccurrences: 4, isActive: true, resource: { name: 'Julio' }, service: { name: 'Corte' }, appointments: [],
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    appointment: { updateMany: jest.fn().mockResolvedValue({ count: 3 }), count: jest.fn().mockResolvedValue(0) },
    customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', firstName: 'Ana', lastName: 'Paz', phone: '1155550101', email: 'ana@mail.com', passwordHash: null, googleId: null }) },
  });
  const crearTurno = jest.fn<ReturnType<CrearTurno>, Parameters<CrearTurno>>(async (d) => ({ id: `t-${d.date}`, startsAt: new Date(`${d.date}T13:00:00Z`) }));
  const svc = new TurnoFijoService(prisma as never, ctx.svc, auditor() as never, opts.nucleo === false ? undefined : { crearTurno });
  return { svc, prisma, crearTurno };
}

const dto = (over: Record<string, unknown> = {}) => ({ customerId: 'c-1', resourceId: RES, serviceId: SRV, frequency: 'WEEKLY' as const, startDate: proximoLunes, startMin: 600, occurrences: 4, ...over });

describe('Crear la serie', () => {
  it('sin el núcleo de turnos (P1 todavía no lo registró): 503, no inventa un camino paralelo', async () => {
    const { svc, prisma } = armar({ nucleo: false });
    await expect(svc.crearDesdePanel(BIZ, 'm', dto())).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('pide cada turno al núcleo en la MISMA transacción, con la serie, el cliente y el origen', async () => {
    const { svc, prisma, crearTurno } = armar();
    const r = await svc.crearDesdePanel(BIZ, 'm-1', dto());
    expect(crearTurno).toHaveBeenCalledTimes(4);
    expect(crearTurno.mock.calls.map((c) => c[0].date)).toEqual([0, 7, 14, 21].map((d) => sumarDias(proximoLunes, d)));
    expect(crearTurno.mock.calls[0][0]).toEqual({
      businessId: BIZ, serviceId: SRV, resourceId: RES, date: proximoLunes, startMin: 600, customerId: 'c-1', customerName: 'Ana Paz',
      customerPhone: '1155550101', customerEmail: 'ana@mail.com', origin: 'PANEL', createdByMemberId: 'm-1', recurringSeriesId: 'serie-1',
    });
    expect(crearTurno.mock.calls[0][1]).toBe(prisma); // el tx de la transacción
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.appointmentRecurringSeries.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, weekday: 0, maxOccurrences: 4, frequency: 'WEEKLY' }) });
    expect(r.created).toHaveLength(4);
    expect(r.skipped).toEqual([]);
  });

  it('un horario ocupado (409 del núcleo) se saltea con ROLLBACK TO SAVEPOINT y se informa; el feriado también', async () => {
    const feriado = sumarDias(proximoLunes, 7);
    const ocupado = sumarDias(proximoLunes, 14);
    const { svc, prisma, crearTurno } = armar({ feriados: [feriado] });
    crearTurno.mockImplementation(async (d) => {
      if (d.date === ocupado) throw new ConflictException('Ese horario se acaba de ocupar. Elegí otro.');
      return { id: `t-${d.date}`, startsAt: new Date() };
    });
    const r = await svc.crearDesdePanel(BIZ, 'm', dto());
    expect(r.created.map((x) => x.date)).toEqual([proximoLunes, sumarDias(proximoLunes, 21)]);
    expect(r.skipped).toEqual([feriado, ocupado]);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT turno_fijo');
    expect(prisma.$executeRawUnsafe.mock.calls.filter((c) => c[0] === 'SAVEPOINT turno_fijo')).toHaveLength(3);
  });

  it('si ninguno entra: 409 y no queda la serie (la transacción se revierte)', async () => {
    const { svc, crearTurno } = armar();
    crearTurno.mockRejectedValue(new BadRequestException('Ese horario no está disponible.'));
    await expect(svc.crearDesdePanel(BIZ, 'm', dto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('un error que no es de disponibilidad corta todo (no se esconde)', async () => {
    const { svc, crearTurno } = armar();
    crearTurno.mockRejectedValueOnce(new Error('se cayó la base'));
    await expect(svc.crearDesdePanel(BIZ, 'm', dto())).rejects.toThrow('se cayó la base');
  });

  it('respeta la config: frecuencias, servicios, máximo; y la función prendida', async () => {
    await expect(armar().svc.crearDesdePanel(BIZ, 'm', dto({ frequency: 'MONTHLY' }))).rejects.toThrow('Esa frecuencia no está habilitada para el turno fijo.');
    await expect(armar({ config: { serviceIds: [] } }).svc.crearDesdePanel(BIZ, 'm', dto())).rejects.toThrow(/no admite turno fijo/);
    await expect(armar({ on: false }).svc.crearDesdePanel(BIZ, 'm', dto())).rejects.toThrow('Prendé «Turno fijo» en Avanzado para usarlo.');
    const { svc, crearTurno } = armar({ config: { maximo: 2 } });
    await svc.crearDesdePanel(BIZ, 'm', dto({ occurrences: 10 }));
    expect(crearTurno).toHaveBeenCalledTimes(2);
  });

  it('valida fecha, agenda y servicio del negocio', async () => {
    await expect(armar().svc.crearDesdePanel(BIZ, 'm', dto({ startDate: '2020-01-06' }))).rejects.toThrow(/hoy o más adelante/);
    await expect(armar().svc.crearDesdePanel(BIZ, 'm', dto({ startDate: '2027-02-30' }))).rejects.toThrow('Esa fecha no existe.');
    const { svc, prisma } = armar({ recurso: false });
    await expect(svc.crearDesdePanel(BIZ, 'm', dto())).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointmentResource.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: RES, businessId: BIZ, isBookable: true }) }));
  });
});

describe('Terminar la serie y ausencias', () => {
  it('terminar cancela los turnos que quedan por delante de ESA serie y ESE negocio', async () => {
    const { svc, prisma } = armar();
    await svc.terminar(BIZ, 'm', 'serie-1');
    expect(prisma.appointmentRecurringSeries.updateMany).toHaveBeenCalledWith({ where: { id: 'serie-1', businessId: BIZ, isActive: true }, data: expect.objectContaining({ isActive: false }) });
    const { where, data } = prisma.appointment.updateMany.mock.calls[0][0];
    expect(where).toMatchObject({ businessId: BIZ, recurringSeriesId: 'serie-1', status: { in: ['PENDING', 'CONFIRMED'] } });
    expect(where.startsAt.gt).toBeInstanceOf(Date);
    expect(data).toMatchObject({ status: 'CANCELLED', cancelledBy: 'BUSINESS', cancelReason: 'Terminó el turno fijo' });
  });

  it('una serie de otro negocio: 404', async () => {
    const { svc, prisma } = armar();
    prisma.appointmentRecurringSeries.findFirst.mockResolvedValueOnce(null);
    await expect(svc.terminar(BIZ, 'm', 'serie-ajena')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a la N-ésima ausencia (liberarAusencias) la serie se libera; con 0, nunca', async () => {
    const { svc, prisma } = armar({ config: { liberarAusencias: 2 } });
    prisma.appointment.count.mockResolvedValueOnce(1);
    await expect(svc.registrarAusencia(BIZ, 'serie-1')).resolves.toEqual({ terminada: false });
    prisma.appointment.count.mockResolvedValueOnce(2);
    await expect(svc.registrarAusencia(BIZ, 'serie-1')).resolves.toEqual({ terminada: true });
    await expect(armar({ config: { liberarAusencias: 0 } }).svc.registrarAusencia(BIZ, 'serie-1')).resolves.toEqual({ terminada: false });
  });
});
