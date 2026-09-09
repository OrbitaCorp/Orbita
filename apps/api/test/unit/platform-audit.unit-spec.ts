import { AUDIT_SEED } from '../../src/platform/audit/audit-seed';
import { checksDesdeSeed, normalizarChecks, resumir, PlatformAuditService } from '../../src/platform/audit/platform-audit.service';

// La lista base de la auditoría es contenido escrito a mano: estos tests
// atajan lo que rompe el tablero sin que el typecheck lo vea (keys repetidas,
// ítems sin verificaciones, hallazgos sin severidad).

describe('Auditoría interna — seed', () => {
  it('las keys son únicas y con prefijo por área', () => {
    const keys = AUDIT_SEED.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of AUDIT_SEED) {
      const prefijo = { BACKEND: 'api.', FRONTEND: 'web.', TRANSVERSAL: 'trans.', HALLAZGO: 'hallazgo.' }[i.area];
      expect(i.key.startsWith(prefijo)).toBe(true);
    }
  });

  it('todo ítem tiene título, foco y al menos dos verificaciones', () => {
    for (const i of AUDIT_SEED) {
      expect(i.titulo.trim().length).toBeGreaterThan(1);
      expect(i.foco.trim().length).toBeGreaterThan(10);
      expect(i.checks.length).toBeGreaterThanOrEqual(2);
      expect(new Set(i.checks).size).toBe(i.checks.length);
    }
  });

  it('los hallazgos tienen severidad y los módulos no', () => {
    for (const i of AUDIT_SEED) {
      if (i.area === 'HALLAZGO') expect(i.severidad).toBeDefined();
      else expect(i.severidad).toBeUndefined();
    }
  });

  it('lo que arranca HECHO viene con las verificaciones tildadas', () => {
    for (const i of AUDIT_SEED.filter((x) => x.estado === 'HECHO')) {
      expect(i.checksHechos).toBe(true);
      expect(checksDesdeSeed(i).every((c) => c.hecho)).toBe(true);
    }
    for (const i of AUDIT_SEED.filter((x) => !x.estado)) {
      expect(checksDesdeSeed(i).every((c) => !c.hecho)).toBe(true);
    }
  });

  it('cubre el inventario de módulos reales de la API', () => {
    const modulosApi = [
      'auth', 'common', 'prisma', 'platform', 'internal-cron', 'businesses', 'branches', 'domains', 'members',
      'member-profile', 'roles', 'customers', 'me', 'supabase', 'audit', 'products', 'categories', 'tags',
      'inventory', 'search', 'orders', 'cancellations', 'returns', 'return-requests', 'payments', 'mercadopago',
      'subscriptions', 'discounts', 'coupons', 'two-for-one', 'reviews', 'reports', 'wizard-analytics',
      'storefront', 'promo-modal', 'countdown', 'social-proof', 'games', 'background-removal',
      'orbi', 'conversations', 'mail', 'notifications', 'message-templates', 'support', 'onboarding',
    ];
    const keys = new Set(AUDIT_SEED.map((i) => i.key));
    for (const m of modulosApi) expect(keys.has(`api.${m}`)).toBe(true);
    // El aviso de salida se eliminó del producto el 2026-09-09: no se audita.
    expect(keys.has('api.exit-intent')).toBe(false);
  });
});

describe('Auditoría interna — helpers', () => {
  it('normalizarChecks descarta lo que no tiene forma de check', () => {
    expect(normalizarChecks(null)).toEqual([]);
    expect(normalizarChecks([{ id: 'c1', texto: 'ok', hecho: true }, { id: 3 }, 'x', { id: 'c2', texto: 'b' }]))
      .toEqual([{ id: 'c1', texto: 'ok', hecho: true }, { id: 'c2', texto: 'b', hecho: false }]);
  });

  it('resumir cuenta hechos, en curso, sin responsable y hallazgos abiertos', () => {
    const base = { id: '', key: '', grupo: '', titulo: '', ruta: null, foco: '', checks: [], checksHechos: 0, orden: 0, esPersonalizado: false, informeUrl: null, notas: null, informe: null, hechoPor: null, hechoAt: null, actualizadoPor: null, updatedAt: new Date() };
    const r = resumir([
      { ...base, area: 'BACKEND', severidad: null, estado: 'HECHO', responsable: null },
      { ...base, area: 'BACKEND', severidad: null, estado: 'EN_CURSO', responsable: { id: 'a', name: 'A' } },
      { ...base, area: 'FRONTEND', severidad: null, estado: 'PENDIENTE', responsable: null },
      { ...base, area: 'HALLAZGO', severidad: 'ALTA', estado: 'PENDIENTE', responsable: null },
      { ...base, area: 'HALLAZGO', severidad: 'INFO', estado: 'PENDIENTE', responsable: null },
      { ...base, area: 'HALLAZGO', severidad: 'CRITICA', estado: 'HECHO', responsable: null },
    ] as Parameters<typeof resumir>[0]);
    expect(r).toMatchObject({ total: 6, hechos: 2, enCurso: 1, pendientes: 3, sinResponsable: 3, hallazgosAbiertos: 1 });
    expect(r.porArea.BACKEND).toEqual({ total: 2, hechos: 1, enCurso: 1 });
  });
});

describe('PlatformAuditService.actualizar (unit, Prisma mockeado)', () => {
  function servicio(fila: Record<string, unknown>) {
    const prisma: any = {
      platformAuditItem: {
        findUnique: jest.fn().mockResolvedValue(fila),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...fila, ...data, checks: data.checks, responsable: null, hechoPor: data.hechoPor ? { id: 'adm', name: 'Ale' } : null, actualizadoPor: { id: 'adm', name: 'Ale' } })),
      },
      platformAdmin: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
      platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    return { prisma, svc: new PlatformAuditService(prisma) };
  }
  const fila = {
    id: 'it-1', key: 'api.auth', area: 'BACKEND', grupo: 'g', titulo: 'auth', ruta: null, foco: 'f', severidad: null,
    estado: 'PENDIENTE', checks: [{ id: 'c1', texto: 'a', hecho: false }, { id: 'c2', texto: 'b', hecho: false }],
    orden: 0, esPersonalizado: false, informeUrl: null, notas: null, informe: null, hechoAt: null, updatedAt: new Date(),
  };

  it('tilda solo los checks pedidos e ignora ids desconocidos', async () => {
    const { svc, prisma } = servicio(fila);
    const r = await svc.actualizar('adm', 'it-1', { checks: [{ id: 'c2', hecho: true }, { id: 'zzz', hecho: true }] });
    expect(r.checks).toEqual([{ id: 'c1', texto: 'a', hecho: false }, { id: 'c2', texto: 'b', hecho: true }]);
    expect(r.checksHechos).toBe(1);
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'audit_item_update', targetId: 'it-1' }) }));
  });

  it('pasar a HECHO guarda quién y cuándo; volver atrás lo limpia', async () => {
    const { svc, prisma } = servicio(fila);
    await svc.actualizar('adm', 'it-1', { estado: 'HECHO' });
    const data1 = prisma.platformAuditItem.update.mock.calls[0][0].data;
    expect(data1.estado).toBe('HECHO');
    expect(data1.hechoPor).toEqual({ connect: { id: 'adm' } });
    expect(data1.hechoAt).toBeInstanceOf(Date);

    const { svc: svc2, prisma: prisma2 } = servicio({ ...fila, estado: 'HECHO' });
    await svc2.actualizar('adm', 'it-1', { estado: 'EN_CURSO' });
    const data2 = prisma2.platformAuditItem.update.mock.calls[0][0].data;
    expect(data2.hechoPor).toEqual({ disconnect: true });
    expect(data2.hechoAt).toBeNull();
  });

  it('un responsable inactivo se rechaza', async () => {
    const { svc, prisma } = servicio(fila);
    prisma.platformAdmin.findUnique.mockResolvedValue({ isActive: false });
    await expect(svc.actualizar('adm', 'it-1', { responsableId: 'x' })).rejects.toThrow('inactivo');
  });

  it('los ítems del seed no se borran', async () => {
    const { svc } = servicio(fila);
    await expect(svc.borrar('adm', 'it-1')).rejects.toThrow('lista base');
  });
});
