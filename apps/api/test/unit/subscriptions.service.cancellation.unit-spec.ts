import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Unit test de la cancelación voluntaria + ventana de 60 días (RBT, 2026-09):
// cancelBusiness(), reactivateFromCancellation() y el barrido nocturno
// processCancellationWindow().

function makeService() {
  const prisma = {
    business: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    subscription: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    member: { findMany: jest.fn().mockResolvedValue([{ email: 'dueno@test.com' }]) },
    refreshToken: { deleteMany: jest.fn() },
    $transaction: jest.fn((arr: any[]) => Promise.all(arr.map((p) => (typeof p === 'function' ? p() : p)))),
  };
  const mail = {
    sendBusinessCancellationConfirmed: jest.fn().mockResolvedValue(true),
    sendBusinessCancellationUndone: jest.fn().mockResolvedValue(true),
    sendBusinessDeletionWarning: jest.fn().mockResolvedValue(true),
    sendBusinessDeleted: jest.fn().mockResolvedValue(true),
  };
  const config = { get: () => undefined };
  const svc = new SubscriptionsService(prisma as any, config as any, {} as any, {} as any, {} as any, {} as any, mail as any);
  (svc as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { svc, prisma, mail };
}

describe('SubscriptionsService — cancelación voluntaria (unit)', () => {
  describe('cancelBusiness', () => {
    it('marca cancelledAt/scheduledDeletionAt (60 días), pausa, pasa la suscripción a CANCELLED y avisa por mail', async () => {
      const { svc, prisma, mail } = makeService();
      prisma.business.findUnique.mockResolvedValue({ name: 'Mi Tienda', subdomain: 'mitienda', cancelledAt: null, deletedAt: null });

      const { scheduledDeletionAt } = await svc.cancelBusiness('biz1');

      const dias = Math.round((scheduledDeletionAt.getTime() - Date.now()) / 86_400_000);
      expect(dias).toBe(60);
      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'biz1' }, data: expect.objectContaining({ isPaused: true }) }),
      );
      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({ where: { businessId: 'biz1' }, data: { status: 'CANCELLED' } });
      expect(mail.sendBusinessCancellationConfirmed).toHaveBeenCalledWith(
        'dueno@test.com',
        expect.objectContaining({ businessName: 'Mi Tienda' }),
        { businessId: 'biz1' },
      );
    });

    it('rechaza si el negocio ya está cancelado', async () => {
      const { svc, prisma } = makeService();
      prisma.business.findUnique.mockResolvedValue({ name: 'X', subdomain: 'x', cancelledAt: new Date(), deletedAt: null });
      await expect(svc.cancelBusiness('biz1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si el negocio ya fue eliminado definitivamente', async () => {
      const { svc, prisma } = makeService();
      prisma.business.findUnique.mockResolvedValue({ name: 'X', subdomain: 'x', cancelledAt: null, deletedAt: new Date() });
      await expect(svc.cancelBusiness('biz1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('tira 404 si el negocio no existe', async () => {
      const { svc, prisma } = makeService();
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(svc.cancelBusiness('biz1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reactivateFromCancellation', () => {
    it('limpia los campos de cancelación, vuelve a ACTIVE si el período de facturación no venció, y avisa por mail', async () => {
      const { svc, prisma, mail } = makeService();
      prisma.business.findUnique.mockResolvedValue({ name: 'Mi Tienda', subdomain: 'mitienda', cancelledAt: new Date(), deletedAt: null });
      const periodoVigente = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub1', status: 'CANCELLED', currentPeriodEnd: periodoVigente });

      await svc.reactivateFromCancellation('biz1');

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { cancelledAt: null, scheduledDeletionAt: null, cancellationWarningEmailSentAt: null, isPaused: false },
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub1' }, data: { status: 'ACTIVE' } });
      expect(mail.sendBusinessCancellationUndone).toHaveBeenCalledWith(
        'dueno@test.com',
        { businessName: 'Mi Tienda', storeUrl: 'https://mitienda.orbita.site' },
        { businessId: 'biz1' },
      );
    });

    it('vuelve a PAST_DUE (no ACTIVE) si el período de facturación de fondo ya había vencido también', async () => {
      const { svc, prisma } = makeService();
      prisma.business.findUnique.mockResolvedValue({ name: 'X', subdomain: 'x', cancelledAt: new Date(), deletedAt: null });
      const periodoVencido = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub1', status: 'CANCELLED', currentPeriodEnd: periodoVencido });

      await svc.reactivateFromCancellation('biz1');

      expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub1' }, data: { status: 'PAST_DUE' } });
    });

    it('rechaza si ya fue eliminado definitivamente (sin vuelta atrás)', async () => {
      const { svc, prisma } = makeService();
      prisma.business.findUnique.mockResolvedValue({ name: 'X', subdomain: 'x', cancelledAt: new Date(), deletedAt: new Date() });
      await expect(svc.reactivateFromCancellation('biz1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si el negocio no estaba cancelado', async () => {
      const { svc, prisma } = makeService();
      prisma.business.findUnique.mockResolvedValue({ name: 'X', subdomain: 'x', cancelledAt: null, deletedAt: null });
      await expect(svc.reactivateFromCancellation('biz1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('processCancellationWindow', () => {
    it('avisa 7 días antes del borrado y marca cancellationWarningEmailSentAt para no reavisar', async () => {
      const { svc, prisma, mail } = makeService();
      const scheduledDeletionAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // faltan 3 días
      prisma.business.findMany
        .mockResolvedValueOnce([{ id: 'biz1', name: 'Mi Tienda', subdomain: 'mitienda', scheduledDeletionAt }]) // porAvisar
        .mockResolvedValueOnce([]); // porBorrar

      await svc.processCancellationWindow();

      expect(mail.sendBusinessDeletionWarning).toHaveBeenCalledWith(
        'dueno@test.com',
        expect.objectContaining({ businessName: 'Mi Tienda' }),
        { businessId: 'biz1' },
      );
      expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz1' }, data: { cancellationWarningEmailSentAt: expect.any(Date) } });
    });

    it('borra definitivamente (deletedAt) al cumplirse los 60 días sin reactivar, y revoca los refresh tokens', async () => {
      const { svc, prisma, mail } = makeService();
      prisma.business.findMany
        .mockResolvedValueOnce([]) // porAvisar
        .mockResolvedValueOnce([{ id: 'biz1', name: 'Mi Tienda' }]); // porBorrar

      await svc.processCancellationWindow();

      expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz1' }, data: { deletedAt: expect.any(Date) } });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz1' } });
      expect(mail.sendBusinessDeleted).toHaveBeenCalledWith('dueno@test.com', { businessName: 'Mi Tienda' }, { businessId: 'biz1' });
    });

    it('no hace nada si no hay negocios en ninguna de las dos ventanas', async () => {
      const { svc, prisma, mail } = makeService();
      prisma.business.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await svc.processCancellationWindow();

      expect(mail.sendBusinessDeletionWarning).not.toHaveBeenCalled();
      expect(mail.sendBusinessDeleted).not.toHaveBeenCalled();
    });
  });
});
