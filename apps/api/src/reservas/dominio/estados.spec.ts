import { ReservaEstado } from '@prisma/client';
import { desdeDonde, FINALES, mensajeTransicion, OCUPAN, puedePasar, TRANSICIONES } from './estados';

describe('reservas · máquina de estados', () => {
  it('una retenida se confirma, queda pendiente, se cancela o vence; de un estado final no se sale', () => {
    expect(puedePasar('RETENIDA', 'CONFIRMADA')).toBe(true);
    expect(puedePasar('RETENIDA', 'PENDIENTE')).toBe(true);
    expect(puedePasar('RETENIDA', 'VENCIDA')).toBe(true);
    expect(puedePasar('RETENIDA', 'COMPLETADA')).toBe(false);
    expect(puedePasar('PENDIENTE', 'CONFIRMADA')).toBe(true);
    expect(puedePasar('CONFIRMADA', 'COMPLETADA')).toBe(true);
    expect(puedePasar('CONFIRMADA', 'AUSENTE')).toBe(true);
    expect(puedePasar('CONFIRMADA', 'CANCELADA')).toBe(true);
    for (const f of FINALES) for (const a of Object.keys(TRANSICIONES) as ReservaEstado[]) expect(puedePasar(f, a)).toBe(false);
  });

  it('los que ocupan lugar son exactamente los que mira la restricción de exclusión de la base', () => {
    expect([...OCUPAN].sort()).toEqual(['CONFIRMADA', 'PENDIENTE', 'RETENIDA']);
    // Ningún estado es a la vez final y ocupante.
    expect(FINALES.filter((f) => OCUPAN.includes(f))).toEqual([]);
  });

  it('desdeDonde invierte la tabla', () => {
    expect(desdeDonde('CONFIRMADA').sort()).toEqual(['PENDIENTE', 'RETENIDA']);
    expect(desdeDonde('COMPLETADA')).toEqual(['CONFIRMADA']);
    expect(desdeDonde('VENCIDA')).toEqual(['RETENIDA']);
  });

  it('el mensaje de una transición inválida se puede mostrar tal cual', () => {
    expect(mensajeTransicion('CANCELADA', 'CONFIRMADA')).toBe('La reserva está cancelada y no puede pasar a confirmada.');
  });
});
