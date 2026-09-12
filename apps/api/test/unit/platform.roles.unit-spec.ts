import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdminGuard } from '../../src/common/guards/platform-admin.guard';
import { PLATFORM_ROLE_KEY } from '../../src/common/decorators/platform-role.decorator';
import { PlatformController } from '../../src/platform/platform.controller';
import { PlatformService } from '../../src/platform/platform.service';

// OPERATOR vs SUPERADMIN (auditoría interna 2026-09-09, verificaciones 3 y 4
// del ítem `api.platform`).
//
// Los dos roles existen en el schema desde el principio ("SUPERADMIN — acceso
// total (fundadores)" / "OPERATOR — soporte / operaciones (acceso acotado)") y
// el rol llega al contexto como `adminRole`, pero no se leía en ningún lado:
// un OPERATOR podía suspender negocios, regalar suscripciones, crear y borrar
// admins de plataforma y emitir códigos de alta gratis, igual que un fundador.
//
// Hoy en producción son todos SUPERADMIN, así que esto no cambia nada para
// nadie — cierra la puerta antes de que exista el primer OPERATOR.

function contexto(rol: 'SUPERADMIN' | 'OPERATOR' | null, handler: unknown = () => undefined): ExecutionContext {
  const user = rol ? { type: 'platform_admin', adminId: 'admin-1', adminRole: rol } : { type: 'member', businessId: 'biz-1' };
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => PlatformController,
  } as unknown as ExecutionContext;
}

const guard = new PlatformAdminGuard(new Reflector());

// Endpoints marcados con @SoloSuperadmin(): tocan plata, accesos o el estado
// de un negocio.
const SOLO_SUPERADMIN = [
  'suspend', 'reactivate', 'grantComp', 'cancelBusiness',
  'createAdmin', 'updateAdmin', 'removeAdmin',
  'createDiscountCode', 'updateDiscountCode', 'sendDiscountOffer',
];

// Lecturas y soporte: las ve cualquier admin de plataforma.
const CUALQUIER_ADMIN = [
  'overview', 'listBusinesses', 'getBusiness', 'listLogs', 'listAdmins',
  'listDiscountCodes', 'listMailTemplates', 'wizardFunnel',
];

const handlerDe = (metodo: string) =>
  (PlatformController.prototype as unknown as Record<string, () => void>)[metodo];

describe('Super admin — qué puede cada rol', () => {
  it('las acciones sensibles están marcadas como solo para superadmin', () => {
    for (const metodo of SOLO_SUPERADMIN) {
      const handler = handlerDe(metodo);
      expect(typeof handler).toBe('function'); // atrapa un método renombrado
      expect(Reflect.getMetadata(PLATFORM_ROLE_KEY, handler)).toEqual(['SUPERADMIN']);
    }
  });

  it('las lecturas y el soporte NO están restringidas', () => {
    for (const metodo of CUALQUIER_ADMIN) {
      expect(Reflect.getMetadata(PLATFORM_ROLE_KEY, handlerDe(metodo))).toBeUndefined();
    }
  });

  it('un OPERATOR no pasa por una acción sensible', () => {
    for (const metodo of SOLO_SUPERADMIN) {
      expect(() => guard.canActivate(contexto('OPERATOR', handlerDe(metodo)))).toThrow(ForbiddenException);
    }
  });

  it('un SUPERADMIN sí pasa, y un OPERATOR pasa por las lecturas', () => {
    for (const metodo of SOLO_SUPERADMIN) {
      expect(guard.canActivate(contexto('SUPERADMIN', handlerDe(metodo)))).toBe(true);
    }
    for (const metodo of CUALQUIER_ADMIN) {
      expect(guard.canActivate(contexto('OPERATOR', handlerDe(metodo)))).toBe(true);
    }
  });

  it('un miembro de un negocio no entra ni a las lecturas', () => {
    expect(() => guard.canActivate(contexto(null, handlerDe('overview')))).toThrow(ForbiddenException);
  });
});

describe('Códigos de descuento de plataforma — el 100% necesita tope', () => {
  function servicio() {
    const prisma = {
      platformDiscountCode: {
        // Por `code` (¿ya existe?) devuelve null; por `id` (editar) devuelve
        // un código del 100% con tope puesto.
        findUnique: jest.fn(({ where }: { where: { code?: string; id?: string } }) =>
          Promise.resolve(
            where.code
              ? null
              : { id: 'c1', code: 'REGALO', percentOff: 100, maxUses: 5, usedCount: 0, isActive: true, expiresAt: null, note: null, createdAt: new Date(), createdByAdmin: null, redemptions: [] },
          ),
        ),
        create: jest.fn().mockResolvedValue({ id: 'c1' }),
        update: jest.fn(),
      },
      platformAdminLog: { create: jest.fn() },
    } as never;
    const subscriptions = { limitesDescuento: () => ({ amountBase: 10000, minAmount: 100, maxPercentOff: 99 }) } as never;
    return new PlatformService(prisma, {} as never, subscriptions, {} as never);
  }

  const codigo = (over: Record<string, unknown> = {}) => ({ code: 'REGALO', percentOff: 100, ...over }) as never;

  it('crear un código del 100% sin tope de usos se rechaza', async () => {
    await expect(servicio().createDiscountCode('admin-1', codigo())).rejects.toThrow(/tope de usos/i);
    await expect(servicio().createDiscountCode('admin-1', codigo({ maxUses: null }))).rejects.toThrow(/tope de usos/i);
  });

  it('sacarle el tope a un código del 100% ya creado también se rechaza', async () => {
    await expect(servicio().updateDiscountCode('admin-1', 'c1', { maxUses: null } as never)).rejects.toThrow(/tope de usos/i);
  });

  it('un código parcial puede no tener tope', async () => {
    // 50% con maxUses ausente: pasa la validación del tope y sigue el flujo
    // normal (crea, loguea y relee el código).
    await expect(servicio().createDiscountCode('admin-1', codigo({ percentOff: 50 }))).resolves.toBeDefined();
  });
});
