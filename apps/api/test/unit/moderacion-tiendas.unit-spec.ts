import { NotFoundException } from '@nestjs/common';
import { PlatformService } from '../../src/platform/platform.service';
import { SupportService } from '../../src/support/support.service';

// Moderación de tiendas (06/10/2026): lo que tiene el equipo de Órbita para
// actuar sobre una tienda del directorio, y lo que tiene un visitante para
// avisar de una.

describe('PlatformService.hideFromSearch / showInSearch', () => {
  function plataforma(business: unknown) {
    const tx = { business: { update: jest.fn() }, platformAdminLog: { create: jest.fn() } };
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue(business) },
      $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    return { svc: new PlatformService(prisma as any, {} as any, {} as any, {} as any), tx };
  }

  it('oculta la tienda de buscadores SIN suspenderla (no toca isPaused ni la suscripción) y deja registro', async () => {
    const { svc, tx } = plataforma({ id: 'b1' });
    const res = await svc.hideFromSearch('admin1', 'b1', { reason: 'denuncia por marca ajena' });
    expect(res).toEqual({ ok: true });
    expect(tx.business.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { hiddenFromSearch: true, hiddenFromSearchReason: 'denuncia por marca ajena' },
    });
    expect(tx.platformAdminLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin1', action: 'hide_business_from_search', targetType: 'business', targetId: 'b1', details: { reason: 'denuncia por marca ajena' } },
    });
  });

  it('sin motivo guarda null y no un texto vacío', async () => {
    const { svc, tx } = plataforma({ id: 'b1' });
    await svc.hideFromSearch('admin1', 'b1', { reason: '   ' });
    expect(tx.business.update).toHaveBeenCalledWith(expect.objectContaining({ data: { hiddenFromSearch: true, hiddenFromSearchReason: null } }));
  });

  it('la vuelve a mostrar, limpia el motivo y deja registro', async () => {
    const { svc, tx } = plataforma({ id: 'b1' });
    await svc.showInSearch('admin1', 'b1');
    expect(tx.business.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { hiddenFromSearch: false, hiddenFromSearchReason: null } });
    expect(tx.platformAdminLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin1', action: 'show_business_in_search', targetType: 'business', targetId: 'b1' },
    });
  });

  it('un negocio inexistente da 404 y no escribe nada', async () => {
    const { svc, tx } = plataforma(null);
    await expect(svc.hideFromSearch('admin1', 'nope', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.showInSearch('admin1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.business.update).not.toHaveBeenCalled();
  });
});

describe('SupportService.reportStore ("Denunciar esta tienda")', () => {
  const dto = { slug: 'venustyle', reason: 'FALSIFICACION' as const, details: 'Vende zapatillas Nike falsificadas.', name: 'Ana Paz', email: 'Ana@Mail.com' };

  function soporte(tienda: unknown = { name: 'Venus Style', subdomain: 'venustyle', deletedAt: null }) {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue(tienda) },
      supportRequest: { create: jest.fn().mockResolvedValue({ number: 41 }) },
    };
    const mail = { sendPublicSupportRequest: jest.fn().mockResolvedValue(true) };
    const svc = new SupportService(prisma as any, mail as any, {} as any);
    (svc as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    return { svc, prisma, mail };
  }

  it('crea la consulta en el soporte con el asunto "Denuncia: <tienda>" y el motivo en el mensaje', async () => {
    const { svc, prisma } = soporte();
    expect(await svc.reportStore(dto)).toEqual({ ok: true, number: 41 });
    const data = prisma.supportRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ category: 'OTRO', subject: 'Denuncia: Venus Style', contactEmail: 'ana@mail.com', contactName: 'Ana Paz', hasAccount: false });
    const cuerpo = data.messages.create.body as string;
    expect(cuerpo).toContain('Venus Style (venustyle)');
    expect(cuerpo).toContain('Falsificaciones o uso de una marca ajena');
    expect(cuerpo).toContain('Vende zapatillas Nike falsificadas.');
  });

  it('la tienda denunciada NO queda como el negocio de quien escribe (quien denuncia no tiene cuenta)', async () => {
    const { svc, prisma } = soporte();
    await svc.reportStore(dto);
    const data = prisma.supportRequest.create.mock.calls[0][0].data;
    expect(data.businessId).toBeNull();
    expect(data.memberId).toBeNull();
  });

  it('avisa por mail a soporte', async () => {
    const { svc, mail } = soporte();
    await svc.reportStore(dto);
    expect(mail.sendPublicSupportRequest).toHaveBeenCalledWith('soporte@orbita.site', expect.objectContaining({ number: 41, category: 'Denuncia de tienda', subject: 'Denuncia: Venus Style' }));
  });

  it('si el mail falla, la denuncia queda guardada igual', async () => {
    const { svc, mail } = soporte();
    mail.sendPublicSupportRequest.mockRejectedValue(new Error('smtp caído'));
    await expect(svc.reportStore(dto)).resolves.toEqual({ ok: true, number: 41 });
  });

  it('el campo trampa lo llena un bot: se descarta en silencio, sin guardar ni mandar nada', async () => {
    const { svc, prisma, mail } = soporte();
    expect(await svc.reportStore({ ...dto, website: 'http://spam.com' })).toEqual({ ok: true });
    expect(prisma.supportRequest.create).not.toHaveBeenCalled();
    expect(mail.sendPublicSupportRequest).not.toHaveBeenCalled();
  });

  it.each([['no existe', null], ['está borrada', { name: 'X', subdomain: 'x', deletedAt: new Date() }]])(
    'una tienda que %s da 404',
    async (_c, tienda) => {
      const { svc, prisma } = soporte(tienda);
      await expect(svc.reportStore(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.supportRequest.create).not.toHaveBeenCalled();
    },
  );

  it('el asunto no pasa de 120 caracteres aunque la tienda tenga un nombre larguísimo', async () => {
    const { svc, prisma } = soporte({ name: 'N'.repeat(300), subdomain: 'n', deletedAt: null });
    await svc.reportStore(dto);
    expect(prisma.supportRequest.create.mock.calls[0][0].data.subject.length).toBeLessThanOrEqual(120);
  });
});
