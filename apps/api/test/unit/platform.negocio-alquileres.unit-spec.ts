import { BadRequestException, ConflictException } from '@nestjs/common';
import { NegociosAlquileresService } from '../../src/platform/negocios-alquileres.service';

// Crear un negocio de Alquileres desde Superadmin (etapa 1 del plan
// docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md). El alta
// pública sigue con Alquileres en "Próximamente": esta es la única puerta, y
// el negocio nace oculto de buscadores y con cortesía.

function makePrisma(opciones: { negocioExistente?: unknown; miembroExistente?: unknown } = {}) {
  const tx = {
    business: { create: jest.fn().mockResolvedValue({ id: 'biz-1', name: 'Cabañas del Sol', subdomain: 'cabanas-del-sol' }) },
    branch: { create: jest.fn().mockResolvedValue({ id: 'br-1' }) },
    role: { create: jest.fn().mockImplementation(({ data }: { data: { name: string } }) => Promise.resolve({ id: `rol-${data.name}` })) },
    rolePermission: { createMany: jest.fn() },
    member: { create: jest.fn().mockResolvedValue({ id: 'mem-1', email: 'ana@ejemplo.invalid' }) },
    businessConfig: { create: jest.fn() },
    storefrontConfig: { create: jest.fn() },
    notificationConfig: { create: jest.fn() },
    subscription: { create: jest.fn() },
    reservaConfig: { create: jest.fn() },
    platformAdminLog: { create: jest.fn() },
  };
  return {
    business: { findUnique: jest.fn().mockResolvedValue(opciones.negocioExistente ?? null) },
    member: { findFirst: jest.fn().mockResolvedValue(opciones.miembroExistente ?? null) },
    permission: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([{ id: 'p1', code: 'reservas.view' }, { id: 'p2', code: 'reservas.manage' }, { id: 'p3', code: 'reservas.config' }]),
    },
    $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    _tx: tx,
  };
}

const DTO = {
  nombre: 'Cabañas del Sol',
  subdominio: 'Cabanas-Del-Sol',
  rubro: 'cabana',
  duenoNombre: 'Ana Ríos',
  duenoEmail: 'Ana@Ejemplo.invalid',
  contrasena: 'una-clave-larga-123',
};

describe('NegociosAlquileresService.crear (unit)', () => {
  it('crea el negocio de Alquileres activo, con su rubro y oculto de buscadores', async () => {
    const prisma = makePrisma();
    const res = await new NegociosAlquileresService(prisma as any).crear('admin-1', DTO);

    const negocio = prisma._tx.business.create.mock.calls[0][0].data;
    expect(negocio).toMatchObject({
      name: 'Cabañas del Sol', subdomain: 'cabanas-del-sol', industry: 'alquileres', subrubros: ['cabana'],
      isActive: true, hiddenFromSearch: true,
    });
    expect(negocio.hiddenFromSearchReason).toMatch(/prueba/i);
    expect(res).toEqual({ business: { id: 'biz-1', name: 'Cabañas del Sol', subdomain: 'cabanas-del-sol' }, owner: { email: 'ana@ejemplo.invalid' } });
  });

  it('el dueño entra con la contraseña elegida, que nunca se guarda en claro ni va al log', async () => {
    const prisma = makePrisma();
    await new NegociosAlquileresService(prisma as any).crear('admin-1', DTO);

    const dueno = prisma._tx.member.create.mock.calls[0][0].data;
    expect(dueno).toMatchObject({ businessId: 'biz-1', name: 'Ana Ríos', email: 'ana@ejemplo.invalid', roleId: 'rol-owner', status: 'ACTIVE', hasTempPassword: false });
    expect(dueno.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(prisma._tx.platformAdminLog.create.mock.calls)).not.toContain('una-clave-larga-123');
  });

  it('deja la config de Alquileres, la cortesía y el registro de la acción', async () => {
    const prisma = makePrisma();
    await new NegociosAlquileresService(prisma as any).crear('admin-1', DTO);

    expect(prisma._tx.reservaConfig.create.mock.calls[0][0].data).toMatchObject({ businessId: 'biz-1', modulo: 'ALQUILERES', activo: true, confirmacion: 'MANUAL', horario: {} });
    expect(prisma._tx.subscription.create.mock.calls[0][0].data).toMatchObject({ businessId: 'biz-1', origin: 'COMP', status: 'ACTIVE', grantedBy: 'admin-1' });
    expect(prisma._tx.platformAdminLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin-1', action: 'create_alquileres_business', targetType: 'business', targetId: 'biz-1', details: { subdomain: 'cabanas-del-sol', rubro: 'cabana', ownerEmail: 'ana@ejemplo.invalid' } },
    });
  });

  it('rechaza un subdominio en uso o inválido, sin crear nada', async () => {
    const ocupado = makePrisma({ negocioExistente: { id: 'otro' } });
    await expect(new NegociosAlquileresService(ocupado as any).crear('admin-1', DTO)).rejects.toThrow(ConflictException);
    expect(ocupado.$transaction).not.toHaveBeenCalled();

    const invalido = makePrisma();
    await expect(new NegociosAlquileresService(invalido as any).crear('admin-1', { ...DTO, subdominio: 'a' })).rejects.toThrow(BadRequestException);
    expect(invalido.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza un email que ya es dueño o miembro de otro negocio', async () => {
    const prisma = makePrisma({ miembroExistente: { id: 'mem-x' } });
    await expect(new NegociosAlquileresService(prisma as any).crear('admin-1', DTO)).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza un rubro que no es de alojamiento por noche (canchas y salones vienen después)', async () => {
    const prisma = makePrisma();
    await expect(new NegociosAlquileresService(prisma as any).crear('admin-1', { ...DTO, rubro: 'canchas' })).rejects.toThrow(BadRequestException);
    await expect(new NegociosAlquileresService(prisma as any).crear('admin-1', { ...DTO, rubro: 'indumentaria' })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
