import { aperturaDelDia, errorDeHorario, sesionesDelDia } from './horario';

const LUNES = '2026-11-09';
const DOMINGO = '2026-11-08';

describe('reservas · horario semanal', () => {
  it('acepta un horario bien formado y rechaza los que no', () => {
    expect(errorDeHorario({ '1': [[540, 780], [900, 1200]], '6': [[600, 840]] })).toBeNull();
    expect(errorDeHorario(null)).toMatch(/objeto/);
    expect(errorDeHorario([])).toMatch(/objeto/);
    expect(errorDeHorario({ '7': [[540, 780]] })).toMatch(/no existe/);
    expect(errorDeHorario({ '1': 'todo el día' })).toMatch(/lista de tramos/);
    expect(errorDeHorario({ '1': [[780, 540]] })).toMatch(/inválido/);
    expect(errorDeHorario({ '1': [[0, 1441]] })).toMatch(/inválido/);
    expect(errorDeHorario({ '1': [[540, 780], [700, 900]] })).toMatch(/se pisan/);
    expect(errorDeHorario({ '1': [] })).toMatch(/al menos un día abierto/);
  });

  it('las sesiones de una clase tampoco se pueden pisar, con su propio mensaje', () => {
    expect(errorDeHorario({ '1': [[1140, 1200], [1170, 1230]] }, { sesiones: true })).toMatch(/sesiones que se pisan/);
  });

  it('aperturaDelDia une los tramos del día y da vacío si está cerrado', () => {
    const h = { '1': [[540, 780], [780, 900], [1000, 1200]] as [number, number][] };
    expect(aperturaDelDia(h, LUNES)).toEqual([[540, 900], [1000, 1200]]);
    expect(aperturaDelDia(h, DOMINGO)).toEqual([]);
    expect(aperturaDelDia(null, LUNES)).toEqual([]);
  });

  it('sesionesDelDia no une: dos clases pegadas siguen siendo dos', () => {
    const h = { '1': [[1200, 1260], [1140, 1200]] as [number, number][] };
    expect(sesionesDelDia(h, LUNES)).toEqual([[1140, 1200], [1200, 1260]]);
  });
});
