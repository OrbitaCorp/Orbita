import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PromoModalService } from '../../src/promo-modal/promo-modal.service';
import { StorefrontPromoModalController } from '../../src/promo-modal/storefront-promo-modal.controller';
import { UpsertPromoModalDto } from '../../src/promo-modal/dto/upsert-promo-modal.dto';

// Auditoría interna 2026-09-10, ítem `api.promo-modal`.
//
// - ctaLink aceptaba cualquier URL: el botón del modal sacaba al cliente de
//   la tienda hacia cualquier sitio (hallazgo BAJO del 04/09).
// - Las fechas de solo día quedaban en medianoche UTC: "hasta el 04/09"
//   terminaba el 03/09 a las 21 h.
// - El endpoint público servía el modal de una tienda no publicada o pausada.

const BIZ = 'biz-1';

describe('DTO del modal', () => {
  const errores = async (body: object) =>
    (await validate(plainToInstance(UpsertPromoModalDto, { title: 'Promo', isActive: true, ...body }))).map((e) => e.property);

  it.each([
    ['otro sitio', 'https://otro-sitio.com'],
    ['sin protocolo', '//otro-sitio.com'],
    ['javascript', 'javascript:alert(1)'],
  ])('ctaLink no acepta %s', async (_c, ctaLink) => {
    expect(await errores({ ctaLink })).toContain('ctaLink');
  });

  it('ctaLink acepta una página de la tienda', async () => {
    expect(await errores({ ctaLink: '/catalogo' })).toEqual([]);
    expect(await errores({ ctaLink: '/descuentos/PROMO10?x=1' })).toEqual([]);
  });
});

describe('Vigencia', () => {
  it('"del 01 al 04" es del 01 a las 00:00 al 04 a las 23:59:59.999 de Argentina', async () => {
    const prisma = { promoModal: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'm', campaignVersion: 1, ...create })) } };
    const svc = new PromoModalService(prisma as any);
    await svc.upsert(BIZ, { title: 'Promo', isActive: true, startDate: '2026-09-01', endDate: '2026-09-04' });
    const { create } = prisma.promoModal.upsert.mock.calls[0][0];
    expect(create.startDate.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(create.endDate.toISOString()).toBe('2026-09-05T02:59:59.999Z');
  });
});

describe('Endpoint público', () => {
  function publico(opts: { tienda?: object; modal?: object | null } = {}) {
    const prisma = {
      business: { findUnique: jest.fn().mockResolvedValue({ isActive: true, isPaused: false, ...opts.tienda }) },
      promoModal: { findUnique: jest.fn().mockResolvedValue(opts.modal === undefined ? { title: 'Promo', isActive: true, startDate: null, endDate: null, ctaLink: '/catalogo', campaignVersion: 1 } : opts.modal) },
    };
    const storefront = { resolveBusinessId: jest.fn().mockResolvedValue(BIZ) };
    const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(true) };
    return new StorefrontPromoModalController(storefront as any, prisma as any, businesses as any);
  }

  it('una tienda pausada o no publicada no muestra el modal', async () => {
    await expect(publico({ tienda: { isPaused: true } }).active('t')).resolves.toBeNull();
    await expect(publico({ tienda: { isActive: false } }).active('t')).resolves.toBeNull();
  });

  it('un link externo guardado de antes no llega a la tienda', async () => {
    const r = await publico({ modal: { title: 'Promo', isActive: true, startDate: null, endDate: null, ctaLink: 'https://otro-sitio.com', campaignVersion: 1 } }).active('t');
    expect(r).toMatchObject({ title: 'Promo', ctaLink: null });
  });

  it('un link de la tienda sí', async () => {
    await expect(publico().active('t')).resolves.toMatchObject({ ctaLink: '/catalogo' });
  });
});
