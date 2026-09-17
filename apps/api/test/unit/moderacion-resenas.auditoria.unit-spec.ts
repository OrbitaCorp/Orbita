import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from '../../src/reviews/reviews.service';

// Hallazgo `resenas-sin-moderacion-panel`. Antes el negocio podía ocultar una
// reseña (PATCH /reviews/:id/hide) pero no tenía dónde verlas ni cómo volver a
// mostrarlas: moderar era de una sola vía y a ciegas.
//
// Criterio de Mateo (ítem `decision.moderacion-resenas`): se entra por el
// producto, con un ícono en su fila — una reseña se entiende leyendo el
// producto al que le pegan, no en una bandeja suelta.

const BIZ = 'biz-1';
const PROD = 'prod-1';
const MEMBER = 'm-1';

function armar(opts: { producto?: unknown; resenas?: unknown[]; existe?: unknown } = {}) {
  const prisma = {
    product: { findFirst: jest.fn().mockResolvedValue(opts.producto === undefined ? { id: PROD, name: 'Zapatilla' } : opts.producto) },
    review: {
      findMany: jest.fn().mockResolvedValue(opts.resenas ?? []),
      findFirst: jest.fn().mockResolvedValue(opts.existe === undefined ? { hiddenReason: 'insultos' } : opts.existe),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const svc = new ReviewsService(prisma as never, audit as never);
  return { svc, prisma, audit };
}

const resena = (over: Record<string, unknown> = {}) => ({
  id: 'r-1', text: 'Muy bueno', status: 'VISIBLE', hiddenReason: null, isVerified: true,
  createdAt: new Date('2026-09-01'), order: { orderNumber: 42 },
  customer: { firstName: 'María', lastName: 'González', email: 'maria@x.com' },
  ...over,
});

describe('Moderar las reseñas de un producto desde el panel', () => {
  describe('listado', () => {
    it('trae también las ocultas, con su motivo — es lo que el listado público no da', async () => {
      const { svc, prisma } = armar({ resenas: [resena(), resena({ id: 'r-2', status: 'HIDDEN', hiddenReason: 'insultos' })] });
      const r = await svc.listForPanel(BIZ, PROD);
      expect(prisma.review.findMany.mock.calls[0][0].where).toEqual({ businessId: BIZ, productId: PROD });
      expect(r.total).toBe(2);
      expect(r.ocultas).toBe(1);
      expect(r.resenas[1]).toMatchObject({ status: 'HIDDEN', hiddenReason: 'insultos' });
    });

    it('para el dueño va el nombre completo y el email, no el "María G." del storefront', async () => {
      const { svc } = armar({ resenas: [resena()] });
      const r = await svc.listForPanel(BIZ, PROD);
      expect(r.resenas[0]).toMatchObject({ customerName: 'María González', customerEmail: 'maria@x.com', orderNumber: 42 });
    });

    it('un producto de OTRO negocio no existe para este panel', async () => {
      const { svc, prisma } = armar({ producto: null });
      await expect(svc.listForPanel(BIZ, PROD)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.product.findFirst.mock.calls[0][0].where).toMatchObject({ businessId: BIZ });
      expect(prisma.review.findMany).not.toHaveBeenCalled();
    });
  });

  describe('ocultar', () => {
    it('solo toca una reseña de ESTE negocio', async () => {
      const { svc, prisma } = armar();
      await svc.hide(BIZ, 'r-1', { hiddenReason: 'insultos' }, MEMBER);
      expect(prisma.review.updateMany).toHaveBeenCalledWith({
        where: { id: 'r-1', businessId: BIZ },
        data: { status: 'HIDDEN', hiddenReason: 'insultos' },
      });
    });

    it('queda registrado quién la ocultó y por qué', async () => {
      const { svc, audit } = armar();
      await svc.hide(BIZ, 'r-1', { hiddenReason: 'habla de otro producto' }, MEMBER);
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
        businessId: BIZ, memberId: MEMBER, entityType: 'review', entityId: 'r-1', action: 'UPDATE',
        changes: expect.arrayContaining([{ field: 'hiddenReason', before: null, after: 'habla de otro producto' }]),
      }));
    });

    it('una reseña que no es del negocio da 404 y no se audita nada', async () => {
      const { svc, prisma, audit } = armar();
      prisma.review.updateMany.mockResolvedValue({ count: 0 });
      await expect(svc.hide(BIZ, 'r-9', { hiddenReason: 'x' }, MEMBER)).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.registrar).not.toHaveBeenCalled();
    });
  });

  describe('volver a mostrar', () => {
    it('la devuelve a VISIBLE y limpia el motivo, que era el de ESA vez', async () => {
      const { svc, prisma } = armar();
      await svc.show(BIZ, 'r-1', MEMBER);
      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { status: 'VISIBLE', hiddenReason: null },
      });
    });

    it('busca por negocio antes de tocar nada: una reseña ajena da 404', async () => {
      const { svc, prisma, audit } = armar({ existe: null });
      await expect(svc.show(BIZ, 'r-9', MEMBER)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.review.findFirst.mock.calls[0][0].where).toEqual({ id: 'r-9', businessId: BIZ });
      expect(prisma.review.update).not.toHaveBeenCalled();
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('queda registrado con el motivo que tenía antes, para saber qué se deshizo', async () => {
      const { svc, audit } = armar({ existe: { hiddenReason: 'insultos' } });
      await svc.show(BIZ, 'r-1', MEMBER);
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({
        entityType: 'review', entityId: 'r-1',
        changes: expect.arrayContaining([
          { field: 'status', before: 'HIDDEN', after: 'VISIBLE' },
          { field: 'hiddenReason', before: 'insultos', after: null },
        ]),
      }));
    });
  });
});
