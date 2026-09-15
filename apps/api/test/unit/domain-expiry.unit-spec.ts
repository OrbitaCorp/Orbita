import { DomainExpiryService, TEMPLATE_DOMINIO_POR_VENCER } from '../../src/domains/domain-expiry.service';
import { asuntoDominioPorVencer, marcaAsuntoDominio } from '../../src/domains/dominio-por-vencer';
import { InternalCronController } from '../../src/internal-cron/internal-cron.controller';

// Hallazgo `dominios-comprados-sin-renovacion` de la auditoría interna: los
// dominios comprados desde el panel quedan con autoRenew apagado y nadie
// avisaba antes del vencimiento. El mantenimiento nocturno ahora avisa a cada
// owner a los 30 y a los 7 días. Solo cuenta como avisado un envío SENT a ese
// owner: un envío fallido se reintenta la noche siguiente. No cambia el estado
// del dominio.

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

function servicio(dominios: unknown[], opts: { enviadosAntes?: string[]; owners?: string[] } = {}) {
  const prisma = {
    customDomain: {
      findMany: jest.fn().mockResolvedValue(dominios),
      update: jest.fn().mockResolvedValue({}),
    },
    emailLog: { findMany: jest.fn().mockResolvedValue((opts.enviadosAntes ?? []).map((to) => ({ to }))) },
    member: { findMany: jest.fn().mockResolvedValue((opts.owners ?? ['dueno@x.com']).map((email) => ({ email }))) },
  };
  const mail = { sendDomainExpiringSoon: jest.fn().mockResolvedValue(true) };
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

  it('a 20 días avisa a cada owner; la marca busca solo envíos SENT a esos owners dentro del tramo de 30', async () => {
    const { svc, prisma, mail } = servicio([dominio(20)], { owners: ['a@x.com', 'b@x.com'] });
    const r = await svc.avisarVencimientos(AHORA);
    expect(r).toEqual({ avisados: 1, vencidos: 0, fallidos: 0 });
    expect(prisma.emailLog.findMany).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        template: TEMPLATE_DOMINIO_POR_VENCER,
        status: 'SENT',
        to: { in: ['a@x.com', 'b@x.com'] },
        subject: { contains: 'dominio mitienda.com vence' },
        createdAt: { gte: new Date(enDias(20).getTime() - 30 * DIA_MS) },
      },
      select: { to: true },
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
  });

  it('si un owner ya recibió el aviso del tramo, solo se le manda al que falta', async () => {
    const { svc, mail } = servicio([dominio(20)], { owners: ['a@x.com', 'b@x.com'], enviadosAntes: ['a@x.com'] });
    await svc.avisarVencimientos(AHORA);
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledTimes(1);
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledWith('b@x.com', expect.anything(), { businessId: 'biz-1' });
  });

  it('si todos ya lo recibieron, no manda nada', async () => {
    const { svc, mail } = servicio([dominio(20)], { owners: ['a@x.com'], enviadosAntes: ['a@x.com'] });
    const r = await svc.avisarVencimientos(AHORA);
    expect(r.avisados).toBe(0);
    expect(mail.sendDomainExpiringSoon).not.toHaveBeenCalled();
  });

  it('un envío rechazado no cuenta como avisado y se reintenta la noche siguiente', async () => {
    const { svc, prisma, mail } = servicio([dominio(6)]);
    mail.sendDomainExpiringSoon.mockResolvedValueOnce(false);
    const primera = await svc.avisarVencimientos(AHORA);
    expect(primera).toEqual({ avisados: 0, vencidos: 0, fallidos: 1 });
    // La fila FAILED no aparece en la marca: la consulta filtra por SENT.
    expect(prisma.emailLog.findMany.mock.calls[0][0].where.status).toBe('SENT');
    const segunda = await svc.avisarVencimientos(new Date(AHORA.getTime() + DIA_MS));
    expect(segunda).toEqual({ avisados: 1, vencidos: 0, fallidos: 0 });
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledTimes(2);
  });

  it('si el envío a un owner tira, los demás owners igual reciben el aviso', async () => {
    const { svc, mail } = servicio([dominio(6)], { owners: ['a@x.com', 'b@x.com'] });
    mail.sendDomainExpiringSoon.mockRejectedValueOnce(new Error('Resend caído'));
    const r = await svc.avisarVencimientos(AHORA);
    expect(r).toEqual({ avisados: 1, vencidos: 0, fallidos: 1 });
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledWith('b@x.com', expect.anything(), { businessId: 'biz-1' });
  });

  it('a 5 días busca la marca del tramo de 7: el aviso de los 30 días no lo frena', async () => {
    const { svc, prisma, mail } = servicio([dominio(5)]);
    await svc.avisarVencimientos(AHORA);
    expect(prisma.emailLog.findMany.mock.calls[0][0].where.createdAt).toEqual({ gte: new Date(enDias(5).getTime() - 7 * DIA_MS) });
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledWith('dueno@x.com', expect.objectContaining({ daysLeft: 5 }), { businessId: 'biz-1' });
  });

  it('el que figura vencido no se toca ni se avisa: no se pasa a EXPIRED', async () => {
    const { svc, prisma, mail } = servicio([dominio(-1)]);
    const r = await svc.avisarVencimientos(AHORA);
    expect(r).toEqual({ avisados: 0, vencidos: 1, fallidos: 0 });
    expect(prisma.customDomain.update).not.toHaveBeenCalled();
    expect(mail.sendDomainExpiringSoon).not.toHaveBeenCalled();
  });

  it('sin owner activo no manda nada y sigue con el dominio siguiente', async () => {
    const { svc, prisma, mail } = servicio([dominio(10), dominio(3, { id: 'dom-2', domain: 'otra.com', businessId: 'biz-2' })], { owners: [] });
    const r = await svc.avisarVencimientos(AHORA);
    expect(r.avisados).toBe(0);
    expect(prisma.member.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.member.findMany.mock.calls[1][0].where.businessId).toBe('biz-2');
    expect(mail.sendDomainExpiringSoon).not.toHaveBeenCalled();
  });

  it('un dominio que falla no frena a los demás', async () => {
    const { svc, prisma, mail } = servicio([dominio(4), dominio(10, { id: 'dom-2', domain: 'otra.com' })]);
    prisma.emailLog.findMany.mockRejectedValueOnce(new Error('db caída'));
    const r = await svc.avisarVencimientos(AHORA);
    expect(r).toEqual({ avisados: 1, vencidos: 0, fallidos: 0 });
    expect(mail.sendDomainExpiringSoon).toHaveBeenCalledWith('dueno@x.com', expect.objectContaining({ domain: 'otra.com' }), { businessId: 'biz-1' });
  });
});

describe('Asunto del aviso de dominio', () => {
  it('lleva la marca que busca el barrido y cambia solo el plazo', () => {
    expect(asuntoDominioPorVencer('mitienda.com', 20)).toBe('El dominio mitienda.com vence en 20 días');
    expect(asuntoDominioPorVencer('mitienda.com', 1)).toBe('El dominio mitienda.com vence en 1 día');
    expect(asuntoDominioPorVencer('mitienda.com', 7)).toContain(marcaAsuntoDominio('mitienda.com'));
  });

  it('la marca de un dominio no aparece en el asunto de otro que lo contiene', () => {
    expect(asuntoDominioPorVencer('mitienda.com', 20)).not.toContain(marcaAsuntoDominio('tienda.com'));
    expect(asuntoDominioPorVencer('tienda.com.ar', 20)).not.toContain(marcaAsuntoDominio('tienda.com'));
  });
});

describe('Mantenimiento nocturno: vencimiento de dominios', () => {
  function controller(domainExpiry: { avisarVencimientos: jest.Mock }, orden: string[] = []) {
    const subs = {
      reconcileOverdueSubscriptions: jest.fn(),
      processLifecycleNotices: jest.fn(),
      processCancellationWindow: jest.fn(),
      cleanupExpiredPendingSignups: jest.fn(),
    };
    const analytics = { classifyPendingTurns: jest.fn(), purgarAntiguos: jest.fn() };
    const corridas = { correrUnaVez: jest.fn((_n: string, _k: string, fn: () => Promise<unknown>) => fn()) };
    const retencion = { purgar: jest.fn(async () => { orden.push('retencion'); }) };
    return new InternalCronController(subs as any, {} as any, analytics as any, corridas as any, retencion as any, domainExpiry as any);
  }

  it('corre en el mismo disparo, después de la retención', async () => {
    const orden: string[] = [];
    const domainExpiry = { avisarVencimientos: jest.fn(async () => { orden.push('dominios'); return { avisados: 0, vencidos: 0, fallidos: 0 }; }) };
    const ctrl = controller(domainExpiry, orden);
    await ctrl.nightlySubscriptionsMaintenance();
    expect(domainExpiry.avisarVencimientos).toHaveBeenCalledTimes(1);
    expect(orden).toEqual(['retencion', 'dominios']);
  });

  it('si el barrido entero tira, la corrida no se marca como fallida', async () => {
    const domainExpiry = { avisarVencimientos: jest.fn().mockRejectedValue(new Error('db caída')) };
    const ctrl = controller(domainExpiry);
    await expect(ctrl.nightlySubscriptionsMaintenance()).resolves.not.toThrow();
  });
});
