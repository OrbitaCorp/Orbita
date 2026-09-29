// DemoGuard: la demo pública (Business.isDemo) nunca acepta escrituras de un
// visitante — ni del panel (miembro readOnly) ni de la tienda pública.
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DemoGuard, DEMO_SOLO_LECTURA } from '../../src/common/guards/demo.guard';
import { AuthService } from '../../src/auth/auth.service';
import { DemoIa } from '../../src/demo/demo-ia';

function rutaComun() {}
const rutaConIa = () => undefined;
DemoIa('orbi-producto')(rutaConIa, 'x', { value: rutaConIa });

function contexto(req: Record<string, unknown>, handler: () => void = rutaComun): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler } as unknown as ExecutionContext;
}

const nuevoGuard = (prisma: unknown) => new DemoGuard(prisma as never, new Reflector());

function prismaCon(negocios: Record<string, boolean>) {
  const findUnique = jest.fn(async ({ where }: { where: { subdomain: string } }) =>
    where.subdomain in negocios ? { isDemo: negocios[where.subdomain] } : null,
  );
  return { business: { findUnique } };
}

const miembro = (readOnly: boolean) => ({
  type: 'member', memberId: 'm1', businessId: 'b1', businessMode: 'FULL',
  roleId: 'r1', roleName: 'owner', permissions: [], readOnly,
});

async function rechazo(p: Promise<boolean>) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(ForbiddenException);
  expect((err as ForbiddenException).getResponse()).toMatchObject({ error: DEMO_SOLO_LECTURA });
}

describe('DemoGuard', () => {
  it('deja pasar cualquier lectura, incluso del miembro readOnly', async () => {
    const guard = nuevoGuard(prismaCon({ demo: true }));
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      await expect(guard.canActivate(contexto({ method, user: miembro(true), path: '/api/v1/products' }))).resolves.toBe(true);
    }
  });

  it('rechaza toda escritura del miembro readOnly, sin importar la ruta', async () => {
    const guard = nuevoGuard(prismaCon({}));
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      await rechazo(guard.canActivate(contexto({ method, user: miembro(true), path: '/api/v1/products' })));
    }
  });

  it('al miembro readOnly solo le abre las rutas marcadas con @DemoIa', async () => {
    const guard = nuevoGuard(prismaCon({}));
    await expect(guard.canActivate(contexto({ method: 'POST', user: miembro(true), path: '/api/v1/products/ai-scan' }, rutaConIa))).resolves.toBe(true);
  });

  it('el dueño real del negocio demo (sin readOnly) escribe normal', async () => {
    const guard = nuevoGuard(prismaCon({ demo: true }));
    await expect(guard.canActivate(contexto({ method: 'POST', user: miembro(false), path: '/api/v1/products' }))).resolves.toBe(true);
  });

  it('corta checkout, visitas y juegos públicos sobre la tienda demo', async () => {
    const guard = nuevoGuard(prismaCon({ demo: true }));
    for (const path of ['/api/v1/storefront/demo/checkout', '/api/v1/storefront/demo/visit', '/api/v1/storefront/demo/games/start', '/api/v1/storefront/demo/return-requests']) {
      await rechazo(guard.canActivate(contexto({ method: 'POST', params: { slug: 'demo' }, path })));
    }
  });

  it('permite validar el carrito de la tienda demo (lectura por POST)', async () => {
    const guard = nuevoGuard(prismaCon({ demo: true }));
    await expect(
      guard.canActivate(contexto({ method: 'POST', params: { slug: 'demo' }, path: '/api/v1/storefront/demo/cart/validate' })),
    ).resolves.toBe(true);
  });

  it('no afecta a las tiendas reales', async () => {
    const guard = nuevoGuard(prismaCon({ tienda1: false }));
    await expect(
      guard.canActivate(contexto({ method: 'POST', params: { slug: 'tienda1' }, path: '/api/v1/storefront/tienda1/checkout' })),
    ).resolves.toBe(true);
  });

  it('cachea si el slug es demo (una sola consulta por slug)', async () => {
    const prisma = prismaCon({ tienda1: false });
    const guard = nuevoGuard(prisma);
    const req = { method: 'POST', params: { slug: 'tienda1' }, path: '/api/v1/storefront/tienda1/visit' };
    await guard.canActivate(contexto(req));
    await guard.canActivate(contexto(req));
    expect(prisma.business.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.demoSession', () => {
  function servicio(member: unknown) {
    const prisma = { member: { findFirst: jest.fn().mockResolvedValue(member) } };
    const config = { getOrThrow: () => 'x'.repeat(32), get: () => undefined };
    const svc = new AuthService(prisma as never, {} as never, config as never);
    return { svc, prisma };
  }

  it('busca solo un miembro readOnly de un negocio demo vivo y no emite refresh token', async () => {
    const { svc, prisma } = servicio({
      id: 'm1', businessId: 'b1', name: 'Visitante', email: 'visitante@example.com', status: 'ACTIVE',
      role: { name: 'owner', rolePermissions: [{ permission: { code: 'catalog.view' } }] },
      business: { id: 'b1', name: 'Demo', subdomain: 'demo', mode: 'FULL' },
    });
    const res = await svc.demoSession();
    expect(prisma.member.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { readOnly: true, business: { isDemo: true, deletedAt: null } } }),
    );
    expect(res).toMatchObject({ type: 'member', demo: true, permissions: ['catalog.view'] });
    expect(typeof res.token).toBe('string');
    expect(res).not.toHaveProperty('refreshToken');
  });

  it('sin negocio demo sembrado responde 404', async () => {
    const { svc } = servicio(null);
    await expect(svc.demoSession()).rejects.toThrow('La demo no está disponible');
  });
});
