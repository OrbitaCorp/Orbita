import { UnprocessableEntityException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MembersService } from '../../src/members/members.service';

// Unit test del fix CRÍTICO de la auditoría: escalación de privilegios en
// editar miembro. Mockea Prisma/Mail: no toca la base. Verifica las reglas de
// members.service.update() (el guard @Roles se prueba aparte en e2e).

function svcCon(objetivo: any, nuevoRol: any) {
  const prisma = {
    member: {
      findFirst: jest.fn().mockResolvedValue(objetivo),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    role: { findFirst: jest.fn().mockResolvedValue(nuevoRol) },
  };
  const mail = {} as any;
  return { svc: new MembersService(prisma as any, mail), prisma };
}

const owner = { id: 'm-owner', name: 'Dueño', email: 'd@x.com', role: { id: 'r-owner', name: 'owner' }, status: 'ACTIVE', hasTempPassword: false, lastAccessAt: null };
const empleado = { id: 'm-emp', name: 'Empe', email: 'e@x.com', role: { id: 'r-emp', name: 'empleado' }, status: 'ACTIVE', hasTempPassword: false, lastAccessAt: null };
const rolOwner = { id: 'r-owner', name: 'owner' };
const rolEmpleado = { id: 'r-emp', name: 'empleado' };

describe('MembersService.update — escalación de privilegios (unit)', () => {
  it('un admin NO puede cambiarle el rol al dueño', async () => {
    const { svc } = svcCon(owner, rolEmpleado); // intenta degradar al owner a empleado
    await expect(
      svc.update('biz', 'm-admin', 'admin', 'm-owner', { roleId: 'r-emp' } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('un admin NO puede ascender a alguien a owner', async () => {
    const { svc } = svcCon(empleado, rolOwner); // intenta subir un empleado a owner
    await expect(
      svc.update('biz', 'm-admin', 'admin', 'm-emp', { roleId: 'r-owner' } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('un admin NO puede cambiar su propio rol', async () => {
    const selfAdmin = { ...empleado, id: 'm-admin', role: { id: 'r-admin', name: 'admin' } };
    const { svc } = svcCon(selfAdmin, rolEmpleado);
    await expect(
      svc.update('biz', 'm-admin', 'admin', 'm-admin', { roleId: 'r-emp' } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('el owner SÍ puede ascender a un empleado a owner', async () => {
    const { svc, prisma } = svcCon(empleado, rolOwner);
    await svc.update('biz', 'm-owner', 'owner', 'm-emp', { roleId: 'r-owner' } as any);
    expect(prisma.member.updateMany).toHaveBeenCalledTimes(1);
    // El where del updateMany scopea por businessId (aislamiento multi-tenant).
    expect(prisma.member.updateMany.mock.calls[0][0].where).toMatchObject({ id: 'm-emp', businessId: 'biz' });
  });

  it('un admin SÍ puede cambiar el nombre/rol de un empleado (caso normal)', async () => {
    const { svc, prisma } = svcCon(empleado, rolEmpleado);
    await svc.update('biz', 'm-admin', 'admin', 'm-emp', { name: 'Nuevo', roleId: 'r-emp' } as any);
    expect(prisma.member.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rechaza un roleId inexistente antes de escribir', async () => {
    const { svc, prisma } = svcCon(empleado, null); // role.findFirst → null
    await expect(
      svc.update('biz', 'm-admin', 'admin', 'm-emp', { roleId: 'r-fantasma' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });

  it('404 si el miembro objetivo no existe en el negocio', async () => {
    const prisma = {
      member: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
      role: { findFirst: jest.fn() },
    };
    const svc = new MembersService(prisma as any, {} as any);
    await expect(
      svc.update('biz', 'm-admin', 'admin', 'no-existe', { name: 'x' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
