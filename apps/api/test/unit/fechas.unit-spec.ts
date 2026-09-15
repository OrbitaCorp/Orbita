import { sumarAniosCalendario } from '../../src/common/utils/fechas';

// Vencimiento de dominios comprados: la compra suma años calendario (hallazgo
// `dominios-comprados-sin-renovacion`). Un 29/02 más un año no bisiesto tiene
// que dar 28/02 como en el registrador, no el 01/03 al que desborda Date.

describe('sumarAniosCalendario', () => {
  it('suma años conservando día, mes y hora', () => {
    expect(sumarAniosCalendario(new Date('2026-09-15T10:30:00Z'), 1).toISOString()).toBe('2027-09-15T10:30:00.000Z');
    expect(sumarAniosCalendario(new Date('2027-03-01T00:00:00Z'), 1).toISOString()).toBe('2028-03-01T00:00:00.000Z');
  });

  it('un 29/02 hacia un año no bisiesto queda en 28/02', () => {
    expect(sumarAniosCalendario(new Date('2028-02-29T15:00:00Z'), 1).toISOString()).toBe('2029-02-28T15:00:00.000Z');
  });

  it('un 29/02 hacia otro año bisiesto sigue en 29/02', () => {
    expect(sumarAniosCalendario(new Date('2028-02-29T15:00:00Z'), 4).toISOString()).toBe('2032-02-29T15:00:00.000Z');
  });

  it('no modifica la fecha que recibe', () => {
    const original = new Date('2026-09-15T10:30:00Z');
    sumarAniosCalendario(original, 2);
    expect(original.toISOString()).toBe('2026-09-15T10:30:00.000Z');
  });
});
