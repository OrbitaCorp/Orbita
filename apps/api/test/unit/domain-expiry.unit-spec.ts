import { DomainExpiryService, TEMPLATE_DOMINIO_POR_VENCER } from '../../src/domains/domain-expiry.service';
import { InternalCronController } from '../../src/internal-cron/internal-cron.controller';

// Hallazgo `dominios-comprados-sin-renovacion` de la auditoría interna: los
// dominios comprados desde el panel quedan con autoRenew apagado y nadie
// avisaba antes del vencimiento. El mantenimiento nocturno ahora manda un
// aviso a los owners a los 30 y a los 7 días, y pasa a EXPIRED el vencido.
// La marca de "ya avisado" es email_logs (plantilla + negocio + dominio en el
// asunto), sin columna nueva.

const DIA_MS = 24 * 60 * 60 * 1000;
const AHORA = new Date('2026-09-15T06:00:00Z');
const enDias = (n: number) => new Date(AHORA.getTime() + n * DIA_MS);

function dominio(diasParaVencer: number, extra: Record<string, unknown> = {}) {
  return {
    id: 'dom-1',
    domain: 'mitienda.com',
    businessId: 'biz-1',
    expiresAt: enDias(diasParaVencer),
    business: { name: 'Mi Tienda', subdomain: 'mitienda' },
    ...extra,
  };
}

function servicio(dominios: unknown[], opts: { yaAvisado?: number; owners?: string[] } = {}) {
  const prisma = {
    customDomain: {
      findMany: jest.fn().mockResolvedValue(dominios),
      update: jest.fn().mockResolvedValue({}),
    },
    emailLog: { count: jest.fn().mockResolvedValue(opts.yaAvisado ?? 0) },
    member: { findMany: jest.fn().mockResolvedValue((opts.owners ?? ['dueno@x.com']).map((email) => ({ email }))) },
  };
  const mail = { sendDomainExpiringSoon: jest.fn().mockResolvedValue(undefined) };
  const svc = new DomainExpiryService(prisma as any, mail as any);
  return { svc, prisma, mail };
}

describe('Vencimiento de dominios comprados', () => {
  it('solo mira los comprados, vivos y que vencen dentro de 30 días', async () => {
    const { svc, prisma } = servicio([]);
    await svc.avisarVencimientos(AHORA);
    expect(prisma.customDomain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: 'PURCHASED',
          status: { in: ['PENDING', 'VERIFYING', 'ACTIVE'] },
          expiresAt: { not: null, lte: enDias(30) },
        },
      }),
    );
  });

  it('a 20 días manda el aviso del tramo de 30 a cada owner, con el dominio en el asunto por email_logs', async () => {
    const { svc, prisma, mail } = servicio([dominio(20)], { owners: ['a@x.com', 'b@x.com'] });
    const r = await svc.avisarVencimientos(AHORA);
    expect(r).toEqual({ avisados: 1, vencidos: 0 });
    // La marca de "ya avisado" se busca desde el inicio del tramo (vence - 30 días).
    expect(prisma.emailLog.count).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        template: TEMPLATE_DOMINIO_POR_VENCER,
        subject: { contains: 'mitienda.com' },
        createdAt: { gte: new Date(enDias(20).getTime() - 30 * DIA_MS) },
      },
    });
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledTimes(2);
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledWith(
      'a@x.com',
      expect.objectContaining({
        businessName: 'Mi Tienda',
        domain: 'mitienda.com',
        daysLeft: 20,
        manageUrl: 'https://mitienda.orbita.site/admin/ventas/configuracion?vista=dominios',
      }),
      { businessId: 'biz-1' },
    );
    expect(prisma.customDomain.update).not.toHaveBeenCalled();
  });

  it('no repite el aviso si ya hay uno de ese tramo en email_logs', async () => {
    const { svc, mail } = servicio([dominio(20)], { yaAvisado: 1 });
    const r = await svc.avisarVencimientos(AHORA);
    expect(r.avisados).toBe(0);
    expect(mail.sendDomainExpiringSoon).not.toHaveBeenCalled();
  });

  it('a 5 días busca la marca del tramo de 7: el aviso de los 30 días no lo frena', async () => {
    const { svc, prisma, mail } = servicio([dominio(5)]);
    await svc.avisarVencimientos(AHORA);
    expect(prisma.emailLog.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: new Date(enDias(5).getTime() - 7 * DIA_MS) } }) }),
    );
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledWith('dueno@x.com', expect.objectContaining({ daysLeft: 5 }), { businessId: 'biz-1' });
  });

  it('el vencido pasa a EXPIRED sin mandar mail', async () => {
    const { svc, prisma, mail } = servicio([dominio(-1)]);
    const r = await svc.avisarVencimientos(AHORA);
    expect(r).toEqual({ avisados: 0, vencidos: 1 });
    expect(prisma.customDomain.update).toHaveBeenCalledWith({ where: { id: 'dom-1' }, data: { status: 'EXPIRED' } });
    expect(mail.sendDomainExpiringSoon).not.toHaveBeenCalled();
  });

  it('sin owner activo no manda nada y sigue con el resto', async () => {
    const { svc, mail } = servicio([dominio(10), dominio(3, { id: 'dom-2', domain: 'otra.com', businessId: 'biz-2' })], { owners: [] });
    const r = await svc.avisarVencimientos(AHORA);
    expect(r.avisados).toBe(0);
    expect(mail.sendDomainExpiringSoon).not.toHaveBeenCalled();
  });

  it('un dominio que falla no frena a los demás', async () => {
    const { svc, prisma, mail } = servicio([dominio(-2), dominio(10, { id: 'dom-2', domain: 'otra.com' })]);
    prisma.customDomain.update.mockRejectedValueOnce(new Error('db caída'));
    const r = await svc.avisarVencimientos(AHORA);
    expect(r).toEqual({ avisados: 1, vencidos: 0 });
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledWith('dueno@x.com', expect.objectContaining({ domain: 'otra.com' }), { businessId: 'biz-1' });
  });
});

describe('Mantenimiento nocturno: vencimiento de dominios', () => {
  function controller(domainExpiry: { avisarVencimientos: jest.Mock }) {
    const subs = {
      reconcileOverdueSubscriptions: jest.fn(),
      processLifecycleNotices: jest.fn(),
      processCancellationWindow: jest.fn(),
      cleanupExpiredPendingSignups: jest.fn(),
    };
    const analytics = { classifyPendingTurns: jest.fn(), purgarAntiguos: jest.fn() };
    const corridas = { correrUnaVez: jest.fn((_n: string, _k: string, fn: () => Promise<unknown>) => fn()) };
    const retencion = { purgar: jest.fn() };
    return new InternalCronController(subs as any, {} as any, analytics as any, corridas as any, retencion as any, domainExpiry as any);
  }

  it('corre en el mismo disparo, después de la retención', async () => {
    const orden: string[] = [];
    const domainExpiry = { avisarVencimientos: jest.fn(async () => { orden.push('dominios'); return { avisados: 0, vencidos: 0 }; }) };
    const ctrl = controller(domainExpiry);
    await ctrl.nightlySubscriptionsMaintenance();
    expect(domainExpiry.avisarVencimientos).toHaveBeenCalledTimes(1);
    expect(orden).toEqual(['dominios']);
  });

  it('si falla, la corrida no se marca como fallida', async () => {
    const domainExpiry = { avisarVencimientos: jest.fn().mockRejectedValue(new Error('db caída')) };
    const ctrl = controller(domainExpiry);
    await expect(ctrl.nightlySubscriptionsMaintenance()).resolves.not.toThrow();
  });
});
