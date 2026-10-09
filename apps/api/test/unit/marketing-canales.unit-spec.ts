import { CanalesService, esNumeroDePrueba } from '../../src/marketing/canales.service';

// Superadmin → Marketing: el estado de Instagram y WhatsApp de la empresa. Solo lee: las cuentas están
// conectadas al negocio de prueba del equipo y se manejan desde su bandeja de mensajes.

const AHORA = new Date('2026-10-09T12:00:00Z');

function armar(over: { negocio?: object | null; ig?: object | null; wa?: object | null; sinLeer?: number; env?: Record<string, string> } = {}) {
  const prisma = {
    business: { findFirst: jest.fn().mockResolvedValue(over.negocio === undefined ? { id: 'b-1', name: 'alexadner messi', subdomain: 'negocio' } : over.negocio) },
    instagramConnection: { findUnique: jest.fn().mockResolvedValue(over.ig ?? null) },
    whatsappConnection: { findUnique: jest.fn().mockResolvedValue(over.wa ?? null) },
    conversation: { count: jest.fn().mockResolvedValue(over.sinLeer ?? 0) },
  };
  const config = { get: (k: string) => over.env?.[k] };
  return { svc: new CanalesService(prisma as any, config as any), prisma };
}

describe('esNumeroDePrueba', () => {
  it.each(['+1 555-025-3483', '+15550253483', '1 (555) 025-3483'])('%s es un número de prueba de Meta', (n) => {
    expect(esNumeroDePrueba(n)).toBe(true);
  });
  it.each(['+54 9 11 5555-1234', '+54 376 444-5555', '+1 415 555-0100', '', null, undefined])('%s no lo es', (n) => {
    expect(esNumeroDePrueba(n as string)).toBe(false);
  });
});

describe('canales de la empresa', () => {
  it('lee el negocio `negocio` por defecto, y se puede cambiar con MARKETING_NEGOCIO', async () => {
    const { svc, prisma } = armar();
    await svc.canales(AHORA);
    expect(prisma.business.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { subdomain: 'negocio', deletedAt: null } }));

    const otro = armar({ env: { MARKETING_NEGOCIO: ' Orbita ' } });
    await otro.svc.canales(AHORA);
    expect(otro.prisma.business.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { subdomain: 'orbita', deletedAt: null } }));
  });

  it('si el negocio no existe, no hay nada conectado y no se consulta ningún canal', async () => {
    const { svc, prisma } = armar({ negocio: null });
    await expect(svc.canales(AHORA)).resolves.toEqual({ negocio: null, instagram: { conectado: false }, whatsapp: { conectado: false } });
    expect(prisma.instagramConnection.findUnique).not.toHaveBeenCalled();
    expect(prisma.whatsappConnection.findUnique).not.toHaveBeenCalled();
  });

  it('consulta los canales de ESE negocio, nada más', async () => {
    const { svc, prisma } = armar();
    await svc.canales(AHORA);
    expect(prisma.instagramConnection.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'b-1' } }));
    expect(prisma.whatsappConnection.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'b-1' } }));
  });

  it('Instagram conectado muestra la cuenta y cuántos días le quedan al acceso', async () => {
    const { svc } = armar({ ig: { username: 'orbita.site', status: 'ACTIVE', tokenExpiresAt: new Date('2026-12-06T21:53:38Z') } });
    const r = await svc.canales(AHORA);
    expect(r.negocio).toEqual({ nombre: 'alexadner messi', subdominio: 'negocio' });
    expect(r.instagram).toEqual({ conectado: true, usuario: 'orbita.site', venceEl: new Date('2026-12-06T21:53:38Z'), diasRestantes: 59, mensajesSinLeer: 0 });
  });

  it('cuenta las conversaciones de Instagram sin leer del negocio (no las archivadas)', async () => {
    const { svc, prisma } = armar({ ig: { username: 'orbita.site', status: 'ACTIVE', tokenExpiresAt: new Date('2026-12-06T21:53:38Z') }, sinLeer: 3 });
    expect((await svc.canales(AHORA)).instagram).toMatchObject({ conectado: true, mensajesSinLeer: 3 });
    expect(prisma.conversation.count).toHaveBeenCalledWith({ where: { businessId: 'b-1', isUnread: true, isArchived: false, messages: { some: { channel: 'INSTAGRAM' } } } });
  });

  it('un acceso ya vencido no da días negativos', async () => {
    const { svc } = armar({ ig: { username: 'orbita.site', status: 'ACTIVE', tokenExpiresAt: new Date('2026-10-01T00:00:00Z') } });
    expect((await svc.canales(AHORA)).instagram).toMatchObject({ conectado: true, diasRestantes: 0 });
  });

  it('un Instagram desconectado figura como sin conectar', async () => {
    const { svc, prisma } = armar({ ig: { username: 'orbita.site', status: 'DISCONNECTED', tokenExpiresAt: new Date('2026-12-06T00:00:00Z') } });
    expect((await svc.canales(AHORA)).instagram).toEqual({ conectado: false });
    expect(prisma.conversation.count).not.toHaveBeenCalled();
  });

  it('WhatsApp con el número de prueba de Meta se marca como de prueba', async () => {
    const { svc } = armar({ wa: { status: 'ACTIVE', displayPhone: '+1 555-025-3483' } });
    expect((await svc.canales(AHORA)).whatsapp).toEqual({ conectado: true, numero: '+1 555-025-3483', dePrueba: true });
  });

  it('WhatsApp con un número real no se marca como de prueba', async () => {
    const { svc } = armar({ wa: { status: 'ACTIVE', displayPhone: '+54 376 444-5555' } });
    expect((await svc.canales(AHORA)).whatsapp).toEqual({ conectado: true, numero: '+54 376 444-5555', dePrueba: false });
  });

  it('un WhatsApp desconectado figura como sin conectar', async () => {
    const { svc } = armar({ wa: { status: 'DISCONNECTED', displayPhone: '+54 376 444-5555' } });
    expect((await svc.canales(AHORA)).whatsapp).toEqual({ conectado: false });
  });
});
