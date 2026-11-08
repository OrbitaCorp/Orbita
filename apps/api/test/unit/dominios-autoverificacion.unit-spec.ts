import { DomainsService } from '../../src/domains/domains.service';

// Verificación automática de dominios propios (2026-11-08): un dominio con el
// DNS y el certificado ya bien quedaba en "Verificando" hasta que el dueño
// tocara "Verificar", y mientras tanto CORS le bloqueaba la tienda.

function armar(opts: { pendientes?: { id: string; businessId: string; domain: string }[]; listo?: boolean } = {}) {
  const pendientes = opts.pendientes ?? [];
  const listo = opts.listo ?? true;
  const porId = new Map(pendientes.map((d) => [d.id, { ...d, status: 'VERIFYING', sslStatus: 'PROVISIONING', dnsVerified: false }]));
  const prisma = {
    customDomain: {
      findMany: jest.fn().mockResolvedValue(pendientes.map(({ id, businessId }) => ({ id, businessId }))),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string; domain?: string } }) => {
        if (where.id) return Promise.resolve(porId.get(where.id) ?? null);
        const d = pendientes.find((p) => p.domain === where.domain);
        return Promise.resolve(d ? { id: d.id, businessId: d.businessId } : null);
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: object }) =>
        Promise.resolve({ ...porId.get(where.id), ...data }),
      ),
    },
  };
  const vercel = {
    isDnsConfigured: jest.fn().mockResolvedValue(listo),
    getDomainInfo: jest.fn().mockResolvedValue({ verified: listo }),
    tieneCertificado: jest.fn().mockResolvedValue(listo),
  };
  const svc = new DomainsService(prisma as any, vercel as any);
  return { svc, prisma, vercel };
}

const CRUZY = { id: 'cd-1', businessId: 'biz-1', domain: 'cruzyparfums.shop' };

describe('verificarPendientes (disparo de cada 5 minutos)', () => {
  it('activa los pendientes que ya tienen DNS y certificado', async () => {
    const { svc, prisma } = armar({ pendientes: [CRUZY] });
    await expect(svc.verificarPendientes()).resolves.toEqual({ revisados: 1, activados: ['cruzyparfums.shop'] });
    expect(prisma.customDomain.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cd-1', businessId: 'biz-1' }, data: { dnsVerified: true, status: 'ACTIVE', sslStatus: 'ACTIVE' } }),
    );
  });

  it('solo busca PENDING/VERIFYING recientes y con tope', async () => {
    const { svc, prisma } = armar();
    await svc.verificarPendientes();
    const args = prisma.customDomain.findMany.mock.calls[0][0];
    expect(args.where.status).toEqual({ in: ['PENDING', 'VERIFYING'] });
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    expect(args.take).toBe(DomainsService.TOPE_AUTOVERIFICACION);
  });

  it('uno que falla no corta a los demás', async () => {
    const otro = { id: 'cd-2', businessId: 'biz-2', domain: 'otra.com' };
    const { svc, vercel } = armar({ pendientes: [CRUZY, otro] });
    vercel.isDnsConfigured.mockRejectedValueOnce(new Error('Vercel caído'));
    await expect(svc.verificarPendientes()).resolves.toEqual({ revisados: 2, activados: ['otra.com'] });
  });

  it('un dominio sin configurar queda en VERIFYING', async () => {
    const { svc } = armar({ pendientes: [CRUZY], listo: false });
    await expect(svc.verificarPendientes()).resolves.toEqual({ revisados: 1, activados: [] });
  });
});

describe('activarSiYaAnda (CORS)', () => {
  it('verifica el dominio pendiente del visitante y lo deja pasar', async () => {
    const { svc } = armar({ pendientes: [CRUZY] });
    await expect(svc.activarSiYaAnda('cruzyparfums.shop')).resolves.toBe(true);
  });

  it('un host que no es un dominio pendiente no llama a Vercel', async () => {
    const { svc, vercel } = armar({ pendientes: [CRUZY] });
    await expect(svc.activarSiYaAnda('inventado.com')).resolves.toBe(false);
    expect(vercel.isDnsConfigured).not.toHaveBeenCalled();
  });

  it('si todavía no anda, no lo deja pasar', async () => {
    const { svc } = armar({ pendientes: [CRUZY], listo: false });
    await expect(svc.activarSiYaAnda('cruzyparfums.shop')).resolves.toBe(false);
  });
});
