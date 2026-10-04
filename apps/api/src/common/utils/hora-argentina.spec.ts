import { esMes, mesArgentina, rangoDeMesArgentina } from './hora-argentina';

describe('hora-argentina: meses', () => {
  it('mesArgentina usa el mes de Argentina, no el de UTC', () => {
    // 02:00 UTC del 1/11 son las 23 h del 31/10 en Argentina.
    expect(mesArgentina(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10');
    expect(mesArgentina(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11');
  });

  it('rangoDeMesArgentina da [desde, hasta) en hora argentina, cruzando de año', () => {
    const r = rangoDeMesArgentina('2026-12');
    expect(r.desde.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(r.hasta.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('esMes acepta solo AAAA-MM', () => {
    expect(esMes('2026-10')).toBe(true);
    expect(esMes('2026-00')).toBe(false);
    expect(esMes('2026-13')).toBe(false);
    expect(esMes('2026-1')).toBe(false);
    expect(esMes(202610)).toBe(false);
    expect(esMes(undefined)).toBe(false);
  });
});
