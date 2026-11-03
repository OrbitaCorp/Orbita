import { diaDeSemana, diasEntre, esFecha, fechaYMinutos, hhmm, instante, restar, seSolapan, sumarDias, tramoEnElDia, unir } from './tiempo';

describe('reservas · tiempo', () => {
  it('esFecha acepta solo días reales con la forma AAAA-MM-DD', () => {
    expect(esFecha('2026-11-10')).toBe(true);
    expect(esFecha('2026-02-29')).toBe(false); // 2026 no es bisiesto
    expect(esFecha('2026-13-01')).toBe(false);
    expect(esFecha('10/11/2026')).toBe(false);
    expect(esFecha(20261110)).toBe(false);
  });

  it('instante y fechaYMinutos son inversas, en hora de Argentina (-03:00)', () => {
    const d = instante('2026-11-10', 9 * 60 + 30);
    expect(d.toISOString()).toBe('2026-11-10T12:30:00.000Z');
    expect(fechaYMinutos(d)).toEqual({ fecha: '2026-11-10', minutos: 570 });
    // Pasada la medianoche de Greenwich sigue siendo el mismo día argentino.
    expect(fechaYMinutos(instante('2026-11-10', 22 * 60))).toEqual({ fecha: '2026-11-10', minutos: 1320 });
  });

  it('diaDeSemana: 0 es domingo, 1 lunes', () => {
    expect(diaDeSemana('2026-11-08')).toBe(0); // domingo
    expect(diaDeSemana('2026-11-09')).toBe(1); // lunes
    expect(diaDeSemana('2026-11-14')).toBe(6); // sábado
  });

  it('sumarDias y diasEntre cruzan meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diasEntre('2026-11-10', '2026-11-13')).toBe(3);
    expect(diasEntre('2026-11-13', '2026-11-10')).toBe(-3);
  });

  it('hhmm escribe la hora con dos dígitos', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(570)).toBe('09:30');
    expect(hhmm(1439)).toBe('23:59');
  });

  it('seSolapan: tocarse en el borde no es pisarse', () => {
    expect(seSolapan([600, 630], [630, 660])).toBe(false);
    expect(seSolapan([600, 660], [630, 700])).toBe(true);
    expect(seSolapan([600, 700], [620, 640])).toBe(true);
  });

  it('unir junta los tramos que se tocan y restar saca lo ocupado', () => {
    expect(unir([[600, 660], [660, 720], [800, 900], [850, 950]])).toEqual([[600, 720], [800, 950]]);
    expect(restar([540, 1080], [[600, 660], [900, 960]])).toEqual([[540, 600], [660, 900], [960, 1080]]);
    expect(restar([540, 600], [[500, 700]])).toEqual([]);
  });

  it('tramoEnElDia recorta un rango de instantes al día de Argentina', () => {
    const inicio = instante('2026-11-10', 23 * 60);
    const fin = instante('2026-11-11', 60);
    expect(tramoEnElDia(inicio, fin, '2026-11-10')).toEqual([1380, 1440]);
    expect(tramoEnElDia(inicio, fin, '2026-11-11')).toEqual([0, 60]);
    expect(tramoEnElDia(inicio, fin, '2026-11-12')).toBeNull();
  });
});
