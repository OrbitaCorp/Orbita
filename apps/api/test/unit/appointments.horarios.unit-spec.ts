import {
  HorarioNegocio, Jornada, SemanaTurnos, Tramo,
  abiertoA, corteDe, cruzar, diaDeSemana, diasAbiertos, diasEntre, errorJornada, errorSemana, errorTramos, esFecha, estadoA, extremos,
  fechaYMinutos, hhmm, horarioDelNegocio, instanteDe, leerSemana, leerTramos, minutosAbiertos, minutosDesde, sumarDias,
  tramosDeJornada, tramosDelNegocio, tramosDelRecurso,
} from '../../src/appointments/horarios/horarios';

// Utilidades de horarios de Turnos: tramos del día, cruce negocio ∩ recurso,
// validación de la jornada y el pasaje entre hora de Argentina e instantes UTC.

const h = (hora: number, min = 0) => hora * 60 + min;
const PARTIDO: Tramo[] = [[h(9), h(13)], [h(16), h(20)]];
const SEMANA: SemanaTurnos = [PARTIDO, PARTIDO, PARTIDO, PARTIDO, PARTIDO, [[h(9), h(13)]], []];

describe('Horarios — fechas y horas de Argentina', () => {
  it('el día de la semana arranca en lunes', () => {
    expect(diaDeSemana('2026-10-05')).toBe(0); // lunes
    expect(diaDeSemana('2026-10-03')).toBe(5); // sábado
    expect(diaDeSemana('2026-10-04')).toBe(6); // domingo
    expect(diaDeSemana('2026-09-26')).toBe(5); // el sábado de la demo
  });

  it('suma días cruzando el mes, el año y un febrero bisiesto', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30');
    expect(diasEntre('2026-10-03', '2026-10-05')).toBe(2);
    expect(diasEntre('2026-10-05', '2026-10-03')).toBe(-2);
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('una hora de Argentina es tres horas más en UTC', () => {
    expect(instanteDe('2026-10-05', h(10)).toISOString()).toBe('2026-10-05T13:00:00.000Z');
    expect(instanteDe('2026-10-05', 0).toISOString()).toBe('2026-10-05T03:00:00.000Z');
    // De las 21:00 en adelante ya es el día siguiente en UTC.
    expect(instanteDe('2026-10-05', h(21)).toISOString()).toBe('2026-10-06T00:00:00.000Z');
    expect(instanteDe('2026-10-05', h(24)).toISOString()).toBe('2026-10-06T03:00:00.000Z');
  });

  it('de un instante saca el día y la hora de Argentina', () => {
    expect(fechaYMinutos(new Date('2026-10-05T13:00:00.000Z'))).toEqual({ fecha: '2026-10-05', minutos: h(10) });
    // 01:30Z del martes todavía es lunes 22:30 en Argentina.
    expect(fechaYMinutos(new Date('2026-10-06T01:30:00.000Z'))).toEqual({ fecha: '2026-10-05', minutos: h(22, 30) });
    // 02:59Z es 23:59 del día anterior; 03:00Z ya es el día nuevo.
    expect(fechaYMinutos(new Date('2026-10-06T02:59:00.000Z'))).toEqual({ fecha: '2026-10-05', minutos: h(23, 59) });
    expect(fechaYMinutos(new Date('2026-10-06T03:00:00.000Z'))).toEqual({ fecha: '2026-10-06', minutos: 0 });
  });

  it('ida y vuelta: fecha y minutos → instante → fecha y minutos', () => {
    for (const minutos of [0, 1, h(9), h(12, 59), h(20, 59), h(21), h(23, 59)]) {
      expect(fechaYMinutos(instanteDe('2026-03-01', minutos))).toEqual({ fecha: '2026-03-01', minutos });
    }
  });

  it('los minutos de un instante medidos desde otro día salen negativos o pasados de 1440', () => {
    expect(minutosDesde('2026-10-06', instanteDe('2026-10-05', h(23, 30)))).toBe(-30);
    expect(minutosDesde('2026-10-05', instanteDe('2026-10-06', h(1)))).toBe(1500);
  });

  it('reconoce una fecha válida y rechaza las que no existen', () => {
    expect(esFecha('2026-10-05')).toBe(true);
    expect(esFecha('2028-02-29')).toBe(true);
    expect(esFecha('2026-02-30')).toBe(false);
    expect(esFecha('2026-13-01')).toBe(false);
    expect(esFecha('05/10/2026')).toBe(false);
    expect(esFecha('2026-10-5')).toBe(false);
    expect(esFecha(20261005)).toBe(false);
    expect(esFecha(null)).toBe(false);
  });

  it('escribe la hora con dos dígitos', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(h(9, 5))).toBe('09:05');
    expect(hhmm(h(23, 30))).toBe('23:30');
  });
});

describe('Horarios — validación de la jornada', () => {
  it('cerrado, un tramo y dos tramos bien formados son válidos', () => {
    expect(errorTramos([])).toBeNull();
    expect(errorTramos([[h(9), h(18)]])).toBeNull();
    expect(errorTramos(PARTIDO)).toBeNull();
    // La tarde puede empezar justo cuando termina la mañana.
    expect(errorTramos([[h(9), h(13)], [h(13), h(20)]])).toBeNull();
    expect(errorTramos([[0, 1440]])).toBeNull();
  });

  it('el cierre tiene que ser después de la apertura', () => {
    expect(errorTramos([[h(13), h(9)], [h(16), h(20)]])).toBe('A la mañana, el cierre tiene que ser después de la apertura.');
    expect(errorTramos([[h(9), h(13)], [h(20), h(16)]])).toBe('A la tarde, el cierre tiene que ser después de la apertura.');
    expect(errorTramos([[h(9), h(9)]])).toBe('A la mañana, el cierre tiene que ser después de la apertura.');
    expect(errorTramos([[h(18), h(16)]])).toBe('A la tarde, el cierre tiene que ser después de la apertura.');
  });

  it('la tarde no puede empezar antes de que termine la mañana', () => {
    expect(errorTramos([[h(9), h(14)], [h(13), h(20)]])).toBe('La tarde tiene que empezar cuando termina la mañana, o después.');
  });

  it('no acepta más de dos tramos ni cosas que no son tramos', () => {
    expect(errorTramos([[1, 2], [3, 4], [5, 6]])).toBe('Un día tiene como máximo dos tramos: la mañana y la tarde.');
    expect(errorTramos('09:00 – 13:00')).not.toBeNull();
    expect(errorTramos([[h(9)]])).not.toBeNull();
    expect(errorTramos([[h(9), 1441]])).not.toBeNull();
    expect(errorTramos([[-1, h(9)]])).not.toBeNull();
    expect(errorTramos([[9.5, 13]])).not.toBeNull();
    expect(errorTramos([['540', '780']])).not.toBeNull();
    expect(errorTramos(null)).not.toBeNull();
  });

  it('la semana tiene que traer los siete días y dice cuál está mal', () => {
    expect(errorSemana(SEMANA)).toBeNull();
    expect(errorSemana([PARTIDO])).toBe('La semana tiene que traer los siete días, de lunes a domingo.');
    expect(errorSemana('lunes a viernes')).not.toBeNull();
    const mal = SEMANA.map((d, i) => (i === 2 ? [[h(13), h(9)]] : d));
    expect(errorSemana(mal)).toBe('El miércoles: A la tarde, el cierre tiene que ser después de la apertura.');
  });

  it('una semana toda cerrada es válida salvo que se exija un día abierto', () => {
    const cerrada = [[], [], [], [], [], [], []];
    expect(errorSemana(cerrada)).toBeNull();
    expect(errorSemana(cerrada, { exigirUnDiaAbierto: true })).toBe('Dejá abierto al menos un día de la semana.');
    expect(errorSemana(SEMANA, { exigirUnDiaAbierto: true })).toBeNull();
  });

  it('errorJornada da los mismos mensajes que el formulario de la demo', () => {
    const j = (m: [boolean, number, number], t: [boolean, number, number]): Jornada =>
      ({ manana: { on: m[0], desde: m[1], hasta: m[2] }, tarde: { on: t[0], desde: t[1], hasta: t[2] } });
    expect(errorJornada(j([true, h(9), h(13)], [true, h(16), h(20)]))).toBeNull();
    expect(errorJornada(j([false, h(9), h(13)], [false, h(16), h(20)]))).toBe('Dejá prendido al menos un turno: la mañana o la tarde.');
    expect(errorJornada(j([true, h(13), h(9)], [true, h(16), h(20)]))).toBe('A la mañana, el cierre tiene que ser después de la apertura.');
    expect(errorJornada(j([true, h(9), h(13)], [true, h(20), h(16)]))).toBe('A la tarde, el cierre tiene que ser después de la apertura.');
    expect(errorJornada(j([true, h(9), h(14)], [true, h(13), h(20)]))).toBe('La tarde tiene que empezar cuando termina la mañana, o después.');
    // Un bloque apagado no se valida.
    expect(errorJornada(j([false, h(13), h(9)], [true, h(16), h(20)]))).toBeNull();
  });

  it('toda jornada válida del formulario da tramos válidos', () => {
    const jornada: Jornada = { manana: { on: true, desde: h(9), hasta: h(13) }, tarde: { on: false, desde: h(16), hasta: h(20) } };
    expect(tramosDeJornada(jornada)).toEqual([[h(9), h(13)]]);
    expect(errorTramos(tramosDeJornada(jornada))).toBeNull();
    const dos: Jornada = { manana: { on: true, desde: h(9), hasta: h(13) }, tarde: { on: true, desde: h(16), hasta: h(20) } };
    expect(tramosDeJornada(dos)).toEqual(PARTIDO);
  });
});

describe('Horarios — leer lo guardado', () => {
  it('lee una semana bien guardada tal cual', () => {
    expect(leerSemana(JSON.parse(JSON.stringify(SEMANA)))).toEqual(SEMANA);
  });

  it('lo que no se entiende queda cerrado, nunca abierto', () => {
    expect(leerSemana(null)).toEqual([[], [], [], [], [], [], []]);
    expect(leerSemana('x')).toEqual([[], [], [], [], [], [], []]);
    expect(leerSemana([PARTIDO, 'roto', [[h(13), h(9)]]])).toEqual([PARTIDO, [], [], [], [], [], []]);
    expect(leerTramos([[h(9), h(13)], [h(12), h(20)]])).toEqual([]);
  });

  it('una semana con días de más se corta en siete', () => {
    expect(leerSemana([...SEMANA, PARTIDO, PARTIDO])).toHaveLength(7);
  });
});

describe('Horarios — cruce negocio ∩ recurso', () => {
  it('cruzar devuelve solo lo que tienen en común', () => {
    expect(cruzar(PARTIDO, [[h(12), h(18)]])).toEqual([[h(12), h(13)], [h(16), h(18)]]);
    expect(cruzar(PARTIDO, [[h(13), h(16)]])).toEqual([]);
    expect(cruzar(PARTIDO, [[h(0), h(24)]])).toEqual(PARTIDO);
    expect(cruzar([], PARTIDO)).toEqual([]);
    // Tocarse en un extremo no es cruzarse.
    expect(cruzar([[h(9), h(13)]], [[h(13), h(16)]])).toEqual([]);
  });

  it('sin horario propio el recurso sigue al negocio los días que atiende', () => {
    const rec = { workDays: [0, 1, 2], ownSchedule: null };
    expect(tramosDelRecurso(rec, PARTIDO, '2026-10-05')).toEqual(PARTIDO); // lunes
    expect(tramosDelRecurso(rec, PARTIDO, '2026-10-08')).toEqual([]); // jueves: no atiende
  });

  it('con horario propio queda recortado al del negocio', () => {
    const propio: SemanaTurnos = Array.from({ length: 7 }, () => [[h(8), h(12)]] as Tramo[]);
    expect(tramosDelRecurso({ workDays: [0], ownSchedule: propio }, PARTIDO, '2026-10-05')).toEqual([[h(9), h(12)]]);
  });

  it('el horario propio puede ser distinto cada día', () => {
    const propio: SemanaTurnos = [[[h(9), h(13)]], [[h(16), h(20)]], [], [], [], [], []];
    const rec = { workDays: [0, 1, 2], ownSchedule: propio };
    expect(tramosDelRecurso(rec, PARTIDO, '2026-10-05')).toEqual([[h(9), h(13)]]);
    expect(tramosDelRecurso(rec, PARTIDO, '2026-10-06')).toEqual([[h(16), h(20)]]);
    expect(tramosDelRecurso(rec, PARTIDO, '2026-10-07')).toEqual([]);
  });

  it('si el negocio está cerrado, el recurso también', () => {
    expect(tramosDelRecurso({ workDays: [0, 1, 2, 3, 4, 5, 6], ownSchedule: null }, [], '2026-10-04')).toEqual([]);
  });
});

describe('Horarios — el horario del negocio en una fecha', () => {
  const base: HorarioNegocio = { semana: SEMANA, especiales: [], vacaciones: null };

  it('sin nada especial vale el día de la semana', () => {
    expect(tramosDelNegocio(base, '2026-10-05')).toEqual(PARTIDO);
    expect(horarioDelNegocio(base, '2026-10-03')).toEqual({ tramos: [[h(9), h(13)]], motivo: null }); // sábado
    expect(horarioDelNegocio(base, '2026-10-04')).toEqual({ tramos: [], motivo: 'no-abre' }); // domingo
  });

  it('un día especial manda sobre la semana', () => {
    const horario: HorarioNegocio = {
      ...base,
      especiales: [
        { fecha: '2026-10-12', tipo: 'CLOSED', tramos: [[h(9), h(13)]] },
        { fecha: '2026-12-24', tipo: 'SPECIAL', tramos: [[h(9), h(14)]] },
      ],
    };
    // CLOSED ignora los tramos que traiga.
    expect(horarioDelNegocio(horario, '2026-10-12')).toEqual({ tramos: [], motivo: 'dia-especial' });
    expect(horarioDelNegocio(horario, '2026-12-24')).toEqual({ tramos: [[h(9), h(14)]], motivo: null });
    expect(tramosDelNegocio(horario, '2026-10-13')).toEqual(PARTIDO);
  });

  it('las vacaciones cierran todo el rango, con los dos extremos', () => {
    const horario: HorarioNegocio = { ...base, vacaciones: { desde: '2027-01-15', hasta: '2027-01-31' } };
    expect(horarioDelNegocio(horario, '2027-01-15').motivo).toBe('vacaciones');
    expect(horarioDelNegocio(horario, '2027-01-31').motivo).toBe('vacaciones');
    expect(horarioDelNegocio(horario, '2027-01-14').motivo).toBeNull();
    expect(horarioDelNegocio(horario, '2027-02-01').motivo).toBeNull();
  });
});

describe('Horarios — piezas sueltas', () => {
  it('abierto, minutos abiertos, corte, días abiertos y extremos', () => {
    expect(abiertoA(PARTIDO, h(9))).toBe(true);
    expect(abiertoA(PARTIDO, h(13))).toBe(false); // el cierre no cuenta como abierto
    expect(abiertoA(PARTIDO, h(14))).toBe(false);
    expect(minutosAbiertos(PARTIDO)).toBe(480);
    expect(corteDe(PARTIDO)).toEqual([h(13), h(16)]);
    expect(corteDe([[h(9), h(18)]])).toBeNull();
    expect(diasAbiertos(SEMANA)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(extremos(SEMANA)).toEqual([h(9), h(20)]);
    expect(extremos([[], [], [], [], [], [], []])).toEqual([h(9), h(20)]);
  });

  it('dice si está abierto y hasta cuándo, o a qué hora vuelve a abrir', () => {
    expect(estadoA(PARTIDO, h(10))).toEqual({ abierto: true, cierraMin: h(13), abreMin: null });
    expect(estadoA(PARTIDO, h(14))).toEqual({ abierto: false, cierraMin: null, abreMin: h(16) });
    expect(estadoA(PARTIDO, h(21))).toEqual({ abierto: false, cierraMin: null, abreMin: null });
  });
});
