import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesService } from '../../src/roles/roles.service';
import { UpsertRoleDto } from '../../src/roles/dto/upsert-role.dto';

// Auditoría interna 2026-09-10, ítem `api.roles`.
//
// RolesGuard decide la "zona peligrosa" por el NOMBRE del rol. Un rol
// personalizado podía llamarse (o renombrarse) "owner" o "admin" y heredar
// esas capacidades: un admin renombraba el rol de un empleado y lo convertía
// en dueño. Además, permisos repetidos daban 500 y el DTO no tenía topes.

const BIZ = 'biz-1';
const CATALOGO = ['catalog.view', 'catalog.manage', 'orders.view'];

function roles(opts: { rolExistente?: unknown; nombreTomado?: boolean; deleteMany?: jest.Mock } = {}) {
  const tx = {
    role: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'r-1', name: 'x', rolePermissions: [], _count: { members: 0 } }),
    },
  };
  const prisma = {
    role: {
      findFirst: jest.fn(({ where }: { where: { name?: unknown } }) =>
        Promise.resolve(where.name ? (opts.nombreTomado ? { id: 'r-otro' } : null) : (opts.rolExistente ?? null)),
      ),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'r-nuevo', ...data, rolePermissions: [], _count: { members: 0 } })),
      deleteMany: opts.deleteMany ?? jest.fn().mockResolvedValue({ count: 1 }),
    },
    permission: {
      findMany: jest.fn(({ where }: { where: { code: { in: string[] } } }) =>
        Promise.resolve(where.code.in.filter((c) => CATALOGO.includes(c)).map((code) => ({ code }))),
      ),
    },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  return { svc: new RolesService(prisma as any), prisma, tx };
}

const dto = (extra: Partial<UpsertRoleDto> = {}): UpsertRoleDto => ({ name: 'Encargado', permissions: ['catalog.view'], ...extra });

describe('Un rol personalizado no puede llamarse como un rol del sistema', () => {
  it.each(['owner', 'admin', 'Admin', ' OWNER ', 'Propietario'])('crear %j: 400 y no se crea', async (name) => {
    const { svc, prisma } = roles();
    await expect(svc.create(BIZ, dto({ name }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it('renombrar un rol personalizado (con gente asignada) a "owner": 400 y no se escribe nada', async () => {
    const { svc, prisma } = roles({ rolExistente: { id: 'r-enc', name: 'Encargado', isDefault: false } });
    await expect(svc.update(BIZ, 'r-enc', dto({ name: 'owner' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un nombre repetido en el negocio (sin distinguir mayúsculas) se rechaza', async () => {
    const { svc, prisma } = roles({ nombreTomado: true });
    await expect(svc.create(BIZ, dto({ name: 'EMPLEADO' }))).rejects.toThrow(/Ya hay un rol/);
    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { businessId: BIZ, name: { equals: 'EMPLEADO', mode: 'insensitive' } },
      select: { id: true },
    });
  });

  it('editar un rol conservando su propio nombre no choca consigo mismo', async () => {
    const { svc, prisma } = roles({ rolExistente: { id: 'r-enc', name: 'Encargado', isDefault: false } });
    await svc.update(BIZ, 'r-enc', dto());
    expect(prisma.role.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { not: 'r-enc' } }) }));
  });

  it('el rol de dueño sigue sin poder editarse', async () => {
    const { svc } = roles({ rolExistente: { id: 'r-owner', name: 'owner', isDefault: true } });
    await expect(svc.update(BIZ, 'r-owner', dto())).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('Permisos y borrado', () => {
  it('los códigos repetidos se guardan una sola vez (antes, 500 por la unique)', async () => {
    const { svc, prisma } = roles();
    await svc.create(BIZ, dto({ permissions: ['catalog.view', 'catalog.view', 'orders.view'] }));
    const creados = prisma.role.create.mock.calls[0][0].data.rolePermissions.create;
    expect(creados).toHaveLength(2);
  });

  it('un código que no está en el catálogo se rechaza', async () => {
    const { svc, prisma } = roles();
    await expect(svc.create(BIZ, dto({ permissions: ['config.superpoderes'] }))).rejects.toThrow(/Permisos inválidos/);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it('un rol con gente asignada no se borra (FK → 422) y uno de fábrica tampoco', async () => {
    const fk = new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: 'test' });
    const conGente = roles({ rolExistente: { id: 'r-enc', isDefault: false }, deleteMany: jest.fn().mockRejectedValue(fk) });
    await expect(conGente.svc.remove(BIZ, 'r-enc')).rejects.toThrow(/miembros con este rol/);
    const deFabrica = roles({ rolExistente: { id: 'r-emp', isDefault: true } });
    await expect(deFabrica.svc.remove(BIZ, 'r-emp')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('UpsertRoleDto', () => {
  const errores = async (body: object) => (await validate(plainToInstance(UpsertRoleDto, body))).map((e) => e.property);

  it('acepta un rol normal con color hex', async () => {
    expect(await errores({ name: 'Encargado', color: '#8B5CF6', permissions: ['catalog.view'] })).toEqual([]);
  });

  it.each([
    ['name', { name: '' }],
    ['name', { name: 'x'.repeat(41) }],
    ['description', { description: 'x'.repeat(201) }],
    ['color', { color: 'red;background:url(x)' }],
    ['permissions', { permissions: Array.from({ length: 51 }, (_, i) => `p${i}`) }],
  ])('rechaza %s inválido', async (campo, extra) => {
    expect(await errores({ name: 'Encargado', permissions: ['catalog.view'], ...extra })).toContain(campo);
  });
});
