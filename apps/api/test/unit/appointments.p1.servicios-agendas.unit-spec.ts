import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentServicesService } from '../../src/appointments/panel/appointment-services.service';
import { AppointmentResourcesService } from '../../src/appointments/panel/appointment-resources.service';
import type { MemberContext } from '../../src/common/types/auth-context.type';

// Servicios (§ P1.2) y agendas (§ P1.3) con Prisma mockeado.

const BIZ = 'biz-1';
const dueno: MemberContext = { type: 'member', memberId: 'm-1', businessId: BIZ, businessMode: 'FULL', roleId: 'r', roleName: 'owner', permissions: [] };
const barbero: MemberContext = { ...dueno, memberId: 'm-2', roleName: 'Barbero', permissions: ['appointments.agenda.view'] };
const settings = { delNegocio: jest.fn().mockResolvedValue({ id: 's-1' }) };

const servicio = (s: Record<string, unknown> = {}) => ({
  id: 'sv-1', businessId: BIZ, name: 'Corte clásico', description: null, durationMin: 30, price: 12000, bookableOnline: true, isActive: true, sortOrder: 0, ...s,
});

function servicios(existentes = [servicio()]) {
  const prisma = {
    appointmentService: {
      findMany: jest.fn().mockResolvedValue(existentes),
      findFirst: jest.fn().mockResolvedValue(existentes[0] ?? null),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 4 } }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'sv-nuevo', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    appointmentClassTemplate: { count: jest.fn().mockResolvedValue(0) },
    appointmentPackage: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const audit = { registrar: jest.fn() };
  return { svc: new AppointmentServicesService(prisma as any, settings as any, audit as any), prisma, audit };
}

describe('Servicios', () => {
  it('lista solo los activos y no borrados, por orden; con includeInactive, también los inactivos', async () => {
    const { svc, prisma } = servicios();
    await svc.listar(BIZ);
    expect(prisma.appointmentService.findMany).toHaveBeenCalledWith({ where: { businessId: BIZ, deletedAt: null, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    await svc.listar(BIZ, true);
    expect(prisma.appointmentService.findMany).toHaveBeenLastCalledWith({ where: { businessId: BIZ, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  });

  it('nombre repetido sin distinguir mayúsculas ni acentos → 400 (al crear y al editar otro)', async () => {
    const { svc, prisma } = servicios();
    await expect(svc.crear(dueno, { name: 'CORTE  CLASICO', durationMin: 30, price: 1, bookableOnline: true })).rejects.toThrow(new BadRequestException('Ya tenés un servicio con ese nombre.'));
    expect(prisma.appointmentService.create).not.toHaveBeenCalled();
    prisma.appointmentService.findFirst.mockResolvedValueOnce(servicio({ id: 'sv-2', name: 'Barba' }));
    await expect(svc.actualizar(dueno, 'sv-2', { name: 'corte clásico', durationMin: 30, price: 1, bookableOnline: true })).rejects.toThrow(BadRequestException);
  });

  it('crear va al final de la lista y queda en la auditoría', async () => {
    const { svc, prisma, audit } = servicios([]);
    const s = await svc.crear(dueno, { name: ' Color ', description: '  ', durationMin: 60, price: 15000.5, bookableOnline: false });
    expect(prisma.appointmentService.create).toHaveBeenCalledWith({ data: { businessId: BIZ, name: 'Color', description: null, durationMin: 60, price: 15000.5, bookableOnline: false, isActive: true, sortOrder: 5 } });
    expect(s).toMatchObject({ id: 'sv-nuevo', price: 15000.5, sortOrder: 5 });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'appointment_service', action: 'CREATE', memberId: 'm-1' }));
  });

  it('editar uno de otro negocio (o borrado) → 404', async () => {
    const { svc, prisma } = servicios();
    prisma.appointmentService.findFirst.mockResolvedValueOnce(null);
    await expect(svc.actualizar(dueno, 'sv-ajeno', { name: 'X', durationMin: 30, price: 1, bookableOnline: true })).rejects.toThrow(new NotFoundException('Ese servicio no existe.'));
    expect(prisma.appointmentService.findFirst).toHaveBeenCalledWith({ where: { id: 'sv-ajeno', businessId: BIZ, deletedAt: null } });
  });

  it('ordenar: todos los ids tienen que ser del negocio', async () => {
    const { svc, prisma } = servicios();
    prisma.appointmentService.count.mockResolvedValueOnce(1);
    await expect(svc.ordenar(dueno, ['sv-1', 'sv-ajeno'])).rejects.toThrow(new BadRequestException('Hay servicios en la lista que no existen.'));
    prisma.appointmentService.count.mockResolvedValueOnce(2);
    await svc.ordenar(dueno, ['sv-2', 'sv-1']);
    expect(prisma.appointmentService.updateMany).toHaveBeenCalledWith({ where: { id: 'sv-2', businessId: BIZ, deletedAt: null }, data: { sortOrder: 0 } });
    expect(prisma.appointmentService.updateMany).toHaveBeenCalledWith({ where: { id: 'sv-1', businessId: BIZ, deletedAt: null }, data: { sortOrder: 1 } });
  });

  it('borrar: soft-delete; no si lo usan clases de la grilla o paquetes activos', async () => {
    const { svc, prisma, audit } = servicios();
    prisma.appointmentClassTemplate.count.mockResolvedValueOnce(3);
    await expect(svc.borrar(dueno, 'sv-1')).rejects.toThrow(new BadRequestException('Ese servicio se usa en 3 clases de la grilla. Sacalo de ahí primero.'));
    prisma.appointmentPackage.count.mockResolvedValueOnce(1);
    await expect(svc.borrar(dueno, 'sv-1')).rejects.toThrow(new BadRequestException('Ese servicio se usa en 1 paquete activo. Sacalo de ahí primero.'));
    expect(await svc.borrar(dueno, 'sv-1')).toEqual({ ok: true });
    expect(prisma.appointmentService.updateMany).toHaveBeenCalledWith({ where: { id: 'sv-1', businessId: BIZ, deletedAt: null }, data: { deletedAt: expect.any(Date), isActive: false } });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', entityId: 'sv-1' }));
  });
});

// ─── Agendas ──────────────────────────────────────────────────────────────────

const espacio = (r: Record<string, unknown> = {}) => ({
  id: 'r-1', businessId: BIZ, kind: 'SPACE', name: 'Cancha 1', roleLabel: 'Cancha', color: null, photoUrl: null, bio: null, isBookable: true,
  assignedSpaceId: null, workDays: [0, 1, 2], ownSchedule: null, isActive: true, sortOrder: 0, ...r,
});

function agendas() {
  const tx = { appointmentResource: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
  const prisma = {
    appointmentResource: {
      findMany: jest.fn().mockResolvedValue([espacio()]),
      findFirst: jest.fn().mockResolvedValue(espacio()),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => espacio({ id: 'r-nuevo', ...data, ownSchedule: data.ownSchedule && typeof data.ownSchedule === 'object' && !Array.isArray(data.ownSchedule) ? null : data.ownSchedule })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    appointment: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const audit = { registrar: jest.fn() };
  return { svc: new AppointmentResourcesService(prisma as any, settings as any, audit as any), prisma, tx, audit };
}

describe('Agendas', () => {
  it('GET sin view_all: solo las propias (su agenda y su espacio)', async () => {
    const { svc, prisma } = agendas();
    prisma.appointmentResource.findFirst.mockResolvedValueOnce({ id: 'r-juan', assignedSpaceId: null });
    await svc.listar(barbero, { kind: 'PERSON', bookable: true });
    expect(prisma.appointmentResource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: BIZ, deletedAt: null, kind: 'PERSON', isBookable: true, isActive: true, id: { in: ['r-juan'] } },
    }));
    await svc.listar(dueno, {});
    expect(prisma.appointmentResource.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { businessId: BIZ, deletedAt: null } }));
  });

  it('crear un espacio: SPACE, días ordenados; una semana propia inválida es 400', async () => {
    const { svc, prisma } = agendas();
    await svc.crear(dueno, { name: 'Cancha 2', workDays: [3, 1] });
    expect(prisma.appointmentResource.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: BIZ, kind: 'SPACE', name: 'Cancha 2', workDays: [1, 3], isBookable: true, sortOrder: 0 }) });
    await expect(svc.crear(dueno, { name: 'X', workDays: [0], ownSchedule: [[[600, 500]], [], [], [], [], [], []] }))
      .rejects.toThrow(new BadRequestException('El lunes: A la mañana, el cierre tiene que ser después de la apertura.'));
  });

  it('editar o borrar una persona (o algo de otro negocio) por acá → 404', async () => {
    const { svc, prisma } = agendas();
    prisma.appointmentResource.findFirst.mockResolvedValue(null);
    await expect(svc.actualizar(dueno, 'r-persona', { name: 'Juan', workDays: [0] })).rejects.toThrow(new NotFoundException('Ese espacio no existe.'));
    await expect(svc.borrar(dueno, 'r-persona')).rejects.toThrow(NotFoundException);
    expect(prisma.appointmentResource.findFirst).toHaveBeenCalledWith({ where: { id: 'r-persona', businessId: BIZ, kind: 'SPACE', deletedAt: null } });
  });

  it('borrar con turnos activos por delante → 400; si no, soft-delete y se desasigna a quien trabajaba ahí', async () => {
    const { svc, prisma, tx } = agendas();
    prisma.appointment.count.mockResolvedValueOnce(2);
    await expect(svc.borrar(dueno, 'r-1')).rejects.toThrow(new BadRequestException('Tiene 2 turnos por delante. Movelos o cancelalos antes de borrarla.'));
    expect(prisma.appointment.count).toHaveBeenCalledWith({ where: { businessId: BIZ, resourceId: 'r-1', status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gte: expect.any(Date) } } });
    await svc.borrar(dueno, 'r-1');
    expect(tx.appointmentResource.updateMany).toHaveBeenCalledWith({ where: { id: 'r-1', businessId: BIZ, kind: 'SPACE', deletedAt: null }, data: { deletedAt: expect.any(Date), isActive: false } });
    expect(tx.appointmentResource.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, assignedSpaceId: 'r-1' }, data: { assignedSpaceId: null } });
  });
});
