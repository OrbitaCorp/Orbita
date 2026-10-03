import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsSeedService } from '../../src/appointments/panel/appointments-seed.service';
import { SEMANA_CANCHAS, rubroTurnosPorKey } from '../../src/appointments/catalogo/rubros';
import { rolesDeFabrica } from '../../src/appointments/catalogo/roles';
import type { SemanaTurnos } from '../../src/appointments/horarios/horarios';

// Sembrado inicial de un negocio de Turnos: idempotente, con el catálogo de rubros.

const BIZ = 'biz-1';

function armar(o: { settings?: boolean; servicios?: number; agendas?: number; roles?: { name: string; appointmentsRoleKey: string | null }[]; dueno?: boolean } = {}) {
  const tx = {
    business: { findUnique: jest.fn().mockResolvedValue({ id: BIZ, deletedAt: null }), update: jest.fn() },
    appointmentSettings: { findFirst: jest.fn().mockResolvedValue(o.settings ? { id: 's-1' } : null), create: jest.fn() },
    role: { findMany: jest.fn().mockResolvedValue(o.roles ?? [{ name: 'owner', appointmentsRoleKey: null }]), create: jest.fn() },
    permission: { findMany: jest.fn().mockResolvedValue([{ id: 'p-view', code: 'appointments.agenda.view' }, { id: 'p-all', code: 'appointments.agenda.view_all' }]) },
    appointmentService: { count: jest.fn().mockResolvedValue(o.servicios ?? 0), createMany: jest.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })) },
    appointmentResource: { count: jest.fn().mockResolvedValue(o.agendas ?? 0), createMany: jest.fn(), create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    member: { findFirst: jest.fn().mockResolvedValue(o.dueno === false ? null : { id: 'm-owner', name: 'Lorena' }) },
  };
  const prisma = { $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)) };
  return { svc: new AppointmentsSeedService(prisma as any), tx };
}

describe('sembrar', () => {
  it('rubro desconocido → 400; negocio inexistente → 404', async () => {
    await expect(armar().svc.sembrar(BIZ, 'verduleria')).rejects.toThrow(new BadRequestException('Ese rubro no existe.'));
    const { svc, tx } = armar();
    tx.business.findUnique.mockResolvedValueOnce(null);
    await expect(svc.sembrar(BIZ, 'barberia')).rejects.toThrow(NotFoundException);
  });

  it('negocio nuevo de barbería: settings con las reglas del rubro, roles, servicios típicos y la ficha del dueño', async () => {
    const { svc, tx } = armar();
    const r = await svc.sembrar(BIZ, 'barberia');
    expect(r).toEqual({ settingsCreadas: true, servicios: 5, agendas: 1, roles: rolesDeFabrica(rubroTurnosPorKey('barberia')!).length });
    expect(tx.business.update).toHaveBeenCalledWith({ where: { id: BIZ }, data: { vertical: 'APPOINTMENTS', industry: 'barberia' } });
    const [{ data }] = tx.appointmentSettings.create.mock.calls[0];
    expect(data).toMatchObject({ businessId: BIZ, rubroKey: 'barberia', agendaMode: 'PROFESSIONAL', slotMin: 30, bufferMin: 5, depositEnabled: false, modalities: ['ON_SITE'], siteForm: 'web' });
    expect(tx.role.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, name: 'Recepción', appointmentsRoleKey: 'recepcion', takesAppointments: false }) });
    expect(tx.appointmentResource.createMany).not.toHaveBeenCalled(); // por profesional: no hay espacios
    expect(tx.appointmentResource.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, kind: 'PERSON', memberId: 'm-owner', name: 'Lorena', roleLabel: 'Barbero', isBookable: true, workDays: [0, 1, 2, 3, 4, 5] }) });
    expect(tx.member.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, role: { name: 'owner' } } }));
  });

  it('canchas: los espacios del rubro y el dueño figura pero no atiende', async () => {
    const { svc, tx } = armar();
    const r = await svc.sembrar(BIZ, 'canchas');
    expect(r.agendas).toBe(4);
    const [{ data }] = tx.appointmentResource.createMany.mock.calls[0];
    expect(data.map((x: { name: string }) => x.name)).toEqual(['Cancha 1', 'Cancha 2', 'Cancha 3']);
    expect(data[0]).toMatchObject({ kind: 'SPACE', roleLabel: 'Cancha', workDays: [0, 1, 2, 3, 4, 5] });
    expect(tx.appointmentResource.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isBookable: false }) });
    expect(tx.appointmentSettings.create.mock.calls[0][0].data.weekSchedule).toEqual(SEMANA_CANCHAS);
  });

  it('con los datos del alta: servicios, seña, semana, modalidades, forma de sitio y beneficios', async () => {
    const { svc, tx } = armar();
    const semana: SemanaTurnos = [[[600, 1080]], [[600, 1080]], [], [], [], [], []];
    await svc.sembrar(BIZ, 'estilista', {
      servicios: [{ nombre: ' Corte ', duracion: 45, precio: 18000.555 }],
      sena: 33, semana, modalidades: ['HOME', 'HOME', 'ON_SITE'], formaDeSitio: 'simple',
      beneficios: { cuenta: false, bienvenidaPercent: 15, sellos: 7, promos: false },
    });
    expect(tx.appointmentService.createMany).toHaveBeenCalledWith({ data: [{ businessId: BIZ, name: 'Corte', durationMin: 45, price: 18000.56, sortOrder: 0 }] });
    const [{ data }] = tx.appointmentSettings.create.mock.calls[0];
    expect(data).toMatchObject({ depositEnabled: true, depositPercent: 35, weekSchedule: semana, modalities: ['HOME', 'ON_SITE'], siteForm: 'simple', accountEnabled: false, welcomeDiscountPercent: 15, loyaltyStamps: 6, promosEnabled: false });
    // Sin seña.
    const sinSena = armar();
    await sinSena.svc.sembrar(BIZ, 'estilista', { sena: 0 });
    expect(sinSena.tx.appointmentSettings.create.mock.calls[0][0].data.depositEnabled).toBe(false);
  });

  it('datos inválidos del alta → 400 (antes de tocar la base)', async () => {
    const { svc, tx } = armar();
    await expect(svc.sembrar(BIZ, 'barberia', { semana: Array(7).fill([]) })).rejects.toThrow(new BadRequestException('Dejá abierto al menos un día de la semana.'));
    await expect(svc.sembrar(BIZ, 'barberia', { servicios: [{ nombre: 'A', duracion: 2, precio: 1 }] })).rejects.toThrow(BadRequestException);
    await expect(svc.sembrar(BIZ, 'barberia', { servicios: [{ nombre: 'A', duracion: 30, precio: 1 }, { nombre: 'á', duracion: 30, precio: 1 }] })).rejects.toThrow(new BadRequestException('Ya tenés un servicio con ese nombre.'));
    expect(tx.business.update).not.toHaveBeenCalled();
  });

  it('idempotente: lo que ya existe no se toca', async () => {
    const keys = rolesDeFabrica(rubroTurnosPorKey('barberia')!).map((f) => ({ name: f.nombre, appointmentsRoleKey: f.key }));
    const { svc, tx } = armar({ settings: true, servicios: 3, agendas: 2, roles: keys });
    expect(await svc.sembrar(BIZ, 'barberia')).toEqual({ settingsCreadas: false, servicios: 0, agendas: 0, roles: 0 });
    expect(tx.appointmentSettings.create).not.toHaveBeenCalled();
    expect(tx.appointmentService.createMany).not.toHaveBeenCalled();
    expect(tx.appointmentResource.createMany).not.toHaveBeenCalled();
    expect(tx.role.create).not.toHaveBeenCalled();
  });

  it('un rol con el mismo nombre que uno de fábrica no se duplica', async () => {
    const { svc, tx } = armar({ roles: [{ name: 'recepcion', appointmentsRoleKey: null }] });
    await svc.sembrar(BIZ, 'barberia');
    expect(tx.role.create.mock.calls.map(([a]) => a.data.appointmentsRoleKey)).not.toContain('recepcion');
  });
});
