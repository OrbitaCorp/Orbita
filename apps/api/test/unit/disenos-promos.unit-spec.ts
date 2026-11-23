import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpsertGameDto } from '../../src/games/dto/upsert-game.dto';
import { UpsertPromoModalDto } from '../../src/promo-modal/dto/upsert-promo-modal.dto';
import { PromoModalService } from '../../src/promo-modal/promo-modal.service';
import { GamesService } from '../../src/games/games.service';

const camposConError = (Clase: new () => object, datos: object) =>
  validateSync(plainToInstance(Clase, datos) as object).map((e) => e.property);

const juego = { isActive: true, percentPerWin: 1, maxPercent: 10 };
const anuncio = { title: 'Promo', isActive: true };

describe('diseños de promos', () => {
  it('el juego acepta las temáticas del catálogo y rechaza otras', () => {
    expect(camposConError(UpsertGameDto, { ...juego, theme: 'navidad', presentation: 'hoja' })).toEqual([]);
    expect(camposConError(UpsertGameDto, { ...juego, theme: 'inventada' })).toContain('theme');
    expect(camposConError(UpsertGameDto, { ...juego, presentation: 'flotante' })).toContain('presentation');
  });

  it('el anuncio valida formato, diseño y que la foto sea https', () => {
    expect(camposConError(UpsertPromoModalDto, { ...anuncio, format: 'barra', design: 'valentin', imageUrl: 'https://ejemplo.com/a.webp' })).toEqual([]);
    expect(camposConError(UpsertPromoModalDto, { ...anuncio, imageUrl: null })).toEqual([]);
    expect(camposConError(UpsertPromoModalDto, { ...anuncio, format: 'otro' })).toContain('format');
    expect(camposConError(UpsertPromoModalDto, { ...anuncio, imageUrl: 'javascript:alert(1)' })).toContain('imageUrl');
    expect(camposConError(UpsertPromoModalDto, { ...anuncio, imageUrl: 'http://ejemplo.com/a.webp' })).toContain('imageUrl');
  });

  it('un cliente viejo que no manda el diseño no lo borra', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'm', title: 'Promo', message: null, badge: null, code: null, ctaText: null, ctaLink: null, isActive: true, campaignVersion: 1, startDate: null, endDate: null });
    const prisma = { promoModal: { findUnique: jest.fn().mockResolvedValue(null), upsert } };
    await new PromoModalService(prisma as never).upsert('b', anuncio as UpsertPromoModalDto);
    const { update } = upsert.mock.calls[0][0];
    expect(update).not.toHaveProperty('format');
    expect(update).not.toHaveProperty('design');
    expect(update).not.toHaveProperty('imageUrl');
  });

  it('cambiar la temática de un juego no abre una campaña nueva', async () => {
    const existente = { isActive: true, startDate: null, endDate: null };
    const upsert = jest.fn().mockResolvedValue({ id: 'g', type: 'HOOP', name: null, isActive: true, percentPerWin: 1, maxPercent: 10, timeLimitSeconds: 4, maxAttempts: 5, campaignVersion: 3, theme: 'navidad', presentation: null, startDate: null, endDate: null });
    const prisma = { game: { findUnique: jest.fn().mockResolvedValue(existente), upsert } };
    const r = await new GamesService(prisma as never).upsert('b', 'HOOP', { ...juego, theme: 'navidad' } as UpsertGameDto);
    expect(upsert.mock.calls[0][0].update.theme).toBe('navidad');
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('campaignVersion');
    expect(r.theme).toBe('navidad');
  });
});
