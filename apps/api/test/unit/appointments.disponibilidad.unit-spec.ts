import {
  CUALQUIERA, ContextoDisponibilidad, RecursoDisponibilidad, TurnoOcupado,
  disponibilidadDelDia, disponibilidadPorRango, horarioSiEstaLibre, horariosLibres, primerHorarioLibre,
} from '../../src/appointments/disponibilidad/disponibilidad';
import { HorarioNegocio, SemanaTurnos, Tramo, hhmm, instanteDe } from '../../src/appointments/horarios/horarios';

// Motor de disponibilidad de Turnos. Es puro: se le pasa todo, incluido "ahora".
//
// Calendario de las pruebas (octubre 2026): sábado 3, domingo 4, LUNES 5,
// martes 6, miércoles 7. Argentina es UTC-3: las 10:00 de Argentina son las
// 13:00Z, y las 21:00 de Argentina ya son las 00:00Z del día siguiente.

const LUNES = '2026-10-05';
const MARTES = '2026-10-06';
const DOMINGO = '2026-10-04';

const h = (hora: number, min = 0) => hora * 60 + min;
/** Instante a partir de fecha y hora de Argentina. */
const ar = (fecha: string, hora: number, min = 0) => instanteDe(fecha, h(hora, min));

const PARTIDO: Tramo[] = [[h(9), h(13)], [h(16), h(20)]];
/** Lunes a sábado partido, domingo cerrado. */
const SEMANA: SemanaTurnos = [PARTIDO, PARTIDO, PARTIDO, PARTIDO, PARTIDO, PARTIDO, []];
const HORARIO: HorarioNegocio = { semana: SEMANA, especiales: [], vacaciones: null };

const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const r = (id: string, extra: Partial<RecursoDisponibilidad> = {}): RecursoDisponibilidad => ({ id, workDays: TODOS_LOS_DIAS, ownSchedule: null, ...extra });

const turno = (resourceId: string, fecha: string, desde: number, hasta: number, id?: string): TurnoOcupado =>
  ({ id, resourceId, startsAt: instanteDe(fecha, desde), endsAt: instanteDe(fecha, hasta) });

/** Contexto por defecto: una agenda, sin turnos, mirando desde el sábado anterior a las 8 de la mañana. */
function ctx(cambios: Omit<Partial<ContextoDisponibilidad>, 'reglas'> & { reglas?: Partial<ContextoDisponibilidad['reglas']> } = {}): ContextoDisponibilidad {
  const { reglas, ...resto } = cambios;
  return {
    horario: HORARIO,
    recursos: [r('r1')],
    turnos: [],
    ahora: ar('2026-10-03', 8),
    ...resto,
    reglas: { slotMin: 30, bufferMin: 0, minAdvanceMin: 0, maxAdvanceDays: 30, ...reglas },
  };
}

/** Las horas libres como texto, para leer los expect de un vistazo. */
const horas = (c: ContextoDisponibilidad, fecha: string, duracion: number, recurso = 'r1') => horariosLibres(c, fecha, duracion, recurso).map((x) => hhmm(x.inicioMin));

describe('Disponibilidad — horario, grilla y cierre', () => {
  it('sin turnos ofrece toda la grilla de la mañana y de la tarde', () => {
    expect(horas(ctx(), LUNES, 30)).toEqual([
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    ]);
  });

  it('un turno que termina JUSTO en el cierre entra; uno que se pasa un minuto, no', () => {
    // 45 minutos con grilla de 15: 12:15 termina 13:00 (entra), 12:30 terminaría 13:15 (no).
    const libres = horas(ctx({ reglas: { slotMin: 15 } }), LUNES, 45);
    expect(libres).toContain('12:15');
    expect(libres).not.toContain('12:30');
    expect(libres).toContain('19:15');
    expect(libres).not.toContain('19:30');
  });

  it('el corte del mediodía no tiene turnos, ni uno que arranque a la mañana y termine a la tarde', () => {
    const libres = horas(ctx(), LUNES, 60);
    expect(libres).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00']);
    // 12:30 + 60 min cruzaría el cierre de las 13:00; 13:00 a 15:30 es el corte.
    for (const fuera of ['12:30', '13:00', '13:30', '14:00', '15:00', '15:30']) expect(libres).not.toContain(fuera);
  });

  it('un servicio más largo que el tramo no tiene ningún horario: el día queda "completo", no "cerrado"', () => {
    const d = disponibilidadDelDia(ctx(), LUNES, 300, 'r1');
    expect(d.horarios).toEqual([]);
    expect(d.cerrado).toBe(false);
    expect(d.motivo).toBe('completo');
  });

  it('la grilla se cuenta desde la apertura de cada tramo', () => {
    const semana: SemanaTurnos = [[[h(9, 15), h(11)]], [], [], [], [], [], []];
    expect(horas(ctx({ horario: { ...HORARIO, semana } }), LUNES, 30)).toEqual(['09:15', '09:45', '10:15']);
  });

  it('con grilla de 60 y un servicio de 90 (canchas) los turnos arrancan en punto y entran enteros', () => {
    const semana: SemanaTurnos = [[[h(16), h(23)]], [], [], [], [], [], []];
    expect(horas(ctx({ horario: { ...HORARIO, semana }, reglas: { slotMin: 60 } }), LUNES, 90)).toEqual(['16:00', '17:00', '18:00', '19:00', '20:00', '21:00']);
  });

  it('cada horario trae el instante de inicio y de fin en UTC y la agenda', () => {
    const [primero] = horariosLibres(ctx(), LUNES, 45, 'r1');
    expect(primero).toEqual({
      inicioMin: 540,
      startsAt: new Date('2026-10-05T12:00:00.000Z'),
      endsAt: new Date('2026-10-05T12:45:00.000Z'),
      resourceId: 'r1',
    });
  });

  it('el domingo, que la semana no abre, está cerrado', () => {
    const d = disponibilidadDelDia(ctx(), DOMINGO, 30, 'r1');
    expect(d).toEqual({ fecha: DOMINGO, cerrado: true, motivo: 'no-abre', horarios: [] });
  });

  it('con duración o grilla en cero no entra en un bucle: no ofrece nada', () => {
    expect(horas(ctx(), LUNES, 0)).toEqual([]);
    expect(horas(ctx({ reglas: { slotMin: 0 } }), LUNES, 30)).toEqual([]);
  });
});

describe('Disponibilidad — solapamientos', () => {
  it('un turno existente saca solo las horas que lo pisan; pegado antes y pegado después se puede', () => {
    const c = ctx({ turnos: [turno('r1', LUNES, h(10), h(10, 30))] });
    const libres = horas(c, LUNES, 30);
    expect(libres).not.toContain('10:00');
    expect(libres).toContain('09:30'); // termina 10:00, justo cuando empieza el otro
    expect(libres).toContain('10:30'); // empieza justo cuando termina el otro
  });

  it('un servicio largo no entra si su final pisa el turno que sigue', () => {
    const c = ctx({ turnos: [turno('r1', LUNES, h(10), h(10, 30))] });
    const libres = horas(c, LUNES, 60);
    expect(libres).toContain('09:00'); // 9 a 10
    expect(libres).not.toContain('09:30'); // 9:30 a 10:30 pisa
    expect(libres).not.toContain('10:00');
    expect(libres).toContain('10:30');
  });

  it('un turno que envuelve a la hora pedida también la saca', () => {
    const c = ctx({ turnos: [turno('r1', LUNES, h(9), h(12))] });
    expect(horas(c, LUNES, 30).filter((x) => x < '13:00')).toEqual(['12:00', '12:30']);
  });

  it('los turnos de otra agenda no molestan', () => {
    const c = ctx({ recursos: [r('r1'), r('r2')], turnos: [turno('r2', LUNES, h(9), h(13))] });
    expect(horas(c, LUNES, 30, 'r1')).toContain('09:00');
    expect(horas(c, LUNES, 30, 'r2').filter((x) => x < '13:00')).toEqual([]);
  });

  it('al mover un turno, el propio turno no cuenta como ocupado', () => {
    const c = ctx({ turnos: [turno('r1', LUNES, h(10), h(10, 30), 'a1')] });
    expect(horas(c, LUNES, 30)).not.toContain('10:00');
    expect(horas({ ...c, salvo: 'a1' }, LUNES, 30)).toContain('10:00');
    // Con `salvo` de otro turno sigue ocupado.
    expect(horas({ ...c, salvo: 'otro' }, LUNES, 30)).not.toContain('10:00');
  });

  it('un día completo queda sin horarios y con motivo "completo"', () => {
    const c = ctx({ turnos: [turno('r1', LUNES, h(9), h(13)), turno('r1', LUNES, h(16), h(20))] });
    const d = disponibilidadDelDia(c, LUNES, 30, 'r1');
    expect(d.horarios).toEqual([]);
    expect(d.cerrado).toBe(false);
    expect(d.motivo).toBe('completo');
  });
});

describe('Disponibilidad — margen entre turnos', () => {
  const conMargen = (bufferMin: number) => ctx({ reglas: { bufferMin }, turnos: [turno('r1', LUNES, h(10), h(10, 30))] });

  it('con margen de 10, ni el turno pegado antes ni el pegado después se ofrecen', () => {
    const libres = horas(conMargen(10), LUNES, 30);
    expect(libres).not.toContain('09:30'); // terminaría 10:00: no deja los 10 minutos
    expect(libres).not.toContain('10:00');
    expect(libres).not.toContain('10:30'); // el otro termina 10:30: faltan los 10 minutos
    expect(libres).toContain('09:00'); // termina 9:30, media hora antes
    expect(libres).toContain('11:00');
  });

  it('el margen exacto alcanza: con 30 de margen, el turno que termina media hora antes entra', () => {
    const libres = horas(conMargen(30), LUNES, 30);
    expect(libres).toContain('09:00'); // 9:30 + 30 = 10:00, justo
    expect(libres).not.toContain('09:30');
    expect(libres).toContain('11:00'); // 10:30 + 30 = 11:00, justo
    expect(libres).not.toContain('10:30');
  });

  it('el margen no se exige contra la apertura ni contra el cierre', () => {
    const libres = horas(ctx({ reglas: { bufferMin: 15 } }), LUNES, 30);
    expect(libres[0]).toBe('09:00');
    expect(libres).toContain('12:30'); // termina 13:00, en el cierre
    expect(libres).toContain('19:30');
  });

  it('el margen también vale contra un turno de la noche anterior que termina sobre la apertura', () => {
    // Negocio que abre 00:00–02:00 el martes; el lunes hubo un turno 23:30–24:00.
    const semana: SemanaTurnos = [[[h(22), h(24)]], [[h(0), h(2)]], [], [], [], [], []];
    const c = ctx({ horario: { ...HORARIO, semana }, reglas: { bufferMin: 15 }, turnos: [turno('r1', LUNES, h(23, 30), h(24))] });
    expect(horas(c, MARTES, 30)).toEqual(['00:30', '01:00', '01:30']);
  });
});

describe('Disponibilidad — anticipación mínima, hoy y el pasado', () => {
  it('hoy solo ofrece de ahora en adelante', () => {
    const c = ctx({ ahora: ar(LUNES, 10, 40) });
    expect(horas(c, LUNES, 30)[0]).toBe('11:00');
  });

  it('un horario que empieza exactamente ahora todavía se ofrece', () => {
    expect(horas(ctx({ ahora: ar(LUNES, 10, 30) }), LUNES, 30)[0]).toBe('10:30');
  });

  it('con anticipación mínima de 2 horas, hoy a las 10:40 lo primero es a la tarde', () => {
    const c = ctx({ ahora: ar(LUNES, 10, 40), reglas: { minAdvanceMin: 120 } });
    // 10:40 + 2 h = 12:40: 12:30 no llega y a la mañana no queda nada más.
    expect(horas(c, LUNES, 30)[0]).toBe('16:00');
  });

  it('la anticipación mínima justa alcanza', () => {
    const c = ctx({ ahora: ar(LUNES, 10), reglas: { minAdvanceMin: 30 } });
    expect(horas(c, LUNES, 30)[0]).toBe('10:30');
  });

  it('la anticipación mínima de 1 día alcanza a los primeros horarios de mañana', () => {
    const c = ctx({ ahora: ar(LUNES, 10, 40), reglas: { minAdvanceMin: 1440 } });
    expect(horas(c, LUNES, 30)).toEqual([]);
    expect(horas(c, MARTES, 30)[0]).toBe('11:00');
  });

  it('hoy después del cierre no queda nada, y no es un día "cerrado"', () => {
    const d = disponibilidadDelDia(ctx({ ahora: ar(LUNES, 20, 30) }), LUNES, 30, 'r1');
    expect(d.horarios).toEqual([]);
    expect(d.cerrado).toBe(false);
    expect(d.motivo).toBe('completo');
  });

  it('un día anterior a hoy no tiene horarios', () => {
    const d = disponibilidadDelDia(ctx({ ahora: ar(MARTES, 9) }), LUNES, 30, 'r1');
    expect(d).toEqual({ fecha: LUNES, cerrado: false, motivo: 'pasado', horarios: [] });
  });

  it('el panel no aplica la anticipación mínima, pero tampoco da turnos en el pasado', () => {
    const c = ctx({ ahora: ar(LUNES, 10, 40), reglas: { minAdvanceMin: 240 }, modo: 'panel' });
    expect(horas(c, LUNES, 30)[0]).toBe('11:00');
    expect(disponibilidadDelDia({ ...c, ahora: ar(MARTES, 9) }, LUNES, 30, 'r1').motivo).toBe('pasado');
  });
});

describe('Disponibilidad — anticipación máxima', () => {
  // Hoy es sábado 3/10. Con 2 días de ventana se llega hasta el lunes 5.
  it('el último día de la ventana se ofrece; el siguiente, no', () => {
    const c = ctx({ reglas: { maxAdvanceDays: 2 } });
    expect(horas(c, LUNES, 30).length).toBeGreaterThan(0);
    const d = disponibilidadDelDia(c, MARTES, 30, 'r1');
    expect(d).toEqual({ fecha: MARTES, cerrado: false, motivo: 'fuera-de-ventana', horarios: [] });
  });

  it('la ventana se cuenta en días de Argentina, no de UTC', () => {
    // Sábado 3 a las 22:00 de Argentina = domingo 4 a la 01:00Z. Si se contara
    // en UTC, "hoy" sería domingo y con 2 días de ventana entraría el martes.
    const c = ctx({ ahora: ar('2026-10-03', 22), reglas: { maxAdvanceDays: 2 } });
    expect(horas(c, LUNES, 30).length).toBeGreaterThan(0);
    expect(disponibilidadDelDia(c, MARTES, 30, 'r1').motivo).toBe('fuera-de-ventana');
  });

  it('el panel puede dar turnos más allá de la ventana', () => {
    const c = ctx({ reglas: { maxAdvanceDays: 2 }, modo: 'panel' });
    expect(horas(c, '2026-12-14', 30).length).toBeGreaterThan(0);
  });
});

describe('Disponibilidad — medianoche de Argentina contra UTC', () => {
  const NOCHE: SemanaTurnos = [[[h(20), h(23, 30)]], [[h(9), h(13)]], [], [], [], [], []];
  const horario = { ...HORARIO, semana: NOCHE };

  it('a las 22:30 del lunes (ya martes en UTC) hoy sigue siendo lunes', () => {
    const ahora = new Date('2026-10-06T01:30:00.000Z'); // lunes 22:30 de Argentina
    const c = ctx({ horario, ahora });
    expect(horas(c, LUNES, 30)).toEqual(['22:30', '23:00']);
    // Y el lunes no es "pasado" aunque en UTC ya sea martes.
    expect(disponibilidadDelDia(c, LUNES, 30, 'r1').motivo).toBeNull();
  });

  it('un turno de las 21:30 de Argentina se guarda en el día UTC siguiente', () => {
    const libres = horariosLibres(ctx({ horario }), LUNES, 30, 'r1');
    const t = libres.find((x) => x.inicioMin === h(21, 30))!;
    expect(t.startsAt.toISOString()).toBe('2026-10-06T00:30:00.000Z');
    expect(t.endsAt.toISOString()).toBe('2026-10-06T01:00:00.000Z');
  });

  it('un turno guardado con fecha UTC del martes ocupa la noche del lunes, no el martes', () => {
    // 2026-10-06T02:00Z = lunes 23:00 de Argentina.
    const ocupado: TurnoOcupado = { resourceId: 'r1', startsAt: new Date('2026-10-06T02:00:00.000Z'), endsAt: new Date('2026-10-06T02:30:00.000Z') };
    const c = ctx({ horario, turnos: [ocupado] });
    expect(horas(c, LUNES, 30)).not.toContain('23:00');
    expect(horas(c, LUNES, 30)).toContain('22:30');
    // El martes a la mañana queda intacto.
    expect(horas(c, MARTES, 30)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30']);
  });

  it('un turno del martes a las 9:00 de Argentina (12:00Z) ocupa el martes', () => {
    const ocupado: TurnoOcupado = { resourceId: 'r1', startsAt: new Date('2026-10-06T12:00:00.000Z'), endsAt: new Date('2026-10-06T12:30:00.000Z') };
    expect(horas(ctx({ horario, turnos: [ocupado] }), MARTES, 30)[0]).toBe('09:30');
  });

  it('a las 00:10 del martes de Argentina el lunes ya es pasado', () => {
    const c = ctx({ horario, ahora: ar(MARTES, 0, 10) });
    expect(disponibilidadDelDia(c, LUNES, 30, 'r1').motivo).toBe('pasado');
    expect(horas(c, MARTES, 30)[0]).toBe('09:00');
  });
});

describe('Disponibilidad — días especiales y vacaciones', () => {
  it('un día especial cerrado no tiene horarios aunque la semana abra', () => {
    const horario: HorarioNegocio = { ...HORARIO, especiales: [{ fecha: LUNES, tipo: 'CLOSED', tramos: [] }] };
    const d = disponibilidadDelDia(ctx({ horario }), LUNES, 30, 'r1');
    expect(d).toEqual({ fecha: LUNES, cerrado: true, motivo: 'dia-especial', horarios: [] });
    // El resto de la semana sigue igual.
    expect(horas(ctx({ horario }), MARTES, 30).length).toBe(16);
  });

  it('un día especial con otro horario reemplaza al de la semana', () => {
    const horario: HorarioNegocio = { ...HORARIO, especiales: [{ fecha: LUNES, tipo: 'SPECIAL', tramos: [[h(10), h(12)]] }] };
    expect(horas(ctx({ horario }), LUNES, 30)).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('un día especial puede abrir un día que la semana no abre', () => {
    const horario: HorarioNegocio = { ...HORARIO, especiales: [{ fecha: DOMINGO, tipo: 'SPECIAL', tramos: [[h(10), h(11)]] }] };
    expect(horas(ctx({ horario }), DOMINGO, 30)).toEqual(['10:00', '10:30']);
  });

  it('en vacaciones no hay horarios, extremos incluidos; el día siguiente sí', () => {
    const horario: HorarioNegocio = { ...HORARIO, vacaciones: { desde: LUNES, hasta: MARTES } };
    const c = ctx({ horario });
    expect(disponibilidadDelDia(c, LUNES, 30, 'r1')).toEqual({ fecha: LUNES, cerrado: true, motivo: 'vacaciones', horarios: [] });
    expect(disponibilidadDelDia(c, MARTES, 30, 'r1').motivo).toBe('vacaciones');
    expect(horas(c, '2026-10-07', 30).length).toBe(16);
  });

  it('las vacaciones mandan sobre un día especial abierto', () => {
    const horario: HorarioNegocio = {
      ...HORARIO,
      vacaciones: { desde: LUNES, hasta: LUNES },
      especiales: [{ fecha: LUNES, tipo: 'SPECIAL', tramos: [[h(10), h(12)]] }],
    };
    expect(disponibilidadDelDia(ctx({ horario }), LUNES, 30, 'r1').motivo).toBe('vacaciones');
  });
});

describe('Disponibilidad — la agenda de cada recurso', () => {
  it('un recurso que no atiende ese día no tiene horarios', () => {
    const c = ctx({ recursos: [r('r1', { workDays: [1, 2, 3, 4, 5] })] });
    expect(disponibilidadDelDia(c, LUNES, 30, 'r1')).toEqual({ fecha: LUNES, cerrado: true, motivo: 'no-atiende', horarios: [] });
    expect(horas(c, MARTES, 30).length).toBe(16);
  });

  it('con horario propio solo de tarde, atiende solo a la tarde', () => {
    const soloTarde: SemanaTurnos = Array.from({ length: 7 }, () => [[h(16), h(20)]] as Tramo[]);
    const c = ctx({ recursos: [r('r1', { ownSchedule: soloTarde })] });
    expect(horas(c, LUNES, 30)[0]).toBe('16:00');
    expect(horas(c, LUNES, 30).length).toBe(8);
  });

  it('el horario propio nunca sale del horario del negocio', () => {
    // Dice que atiende de 12 a 18, pero el negocio corta de 13 a 16.
    const propio: SemanaTurnos = Array.from({ length: 7 }, () => [[h(12), h(18)]] as Tramo[]);
    const c = ctx({ recursos: [r('r1', { ownSchedule: propio })] });
    expect(horas(c, LUNES, 30)).toEqual(['12:00', '12:30', '16:00', '16:30', '17:00', '17:30']);
  });

  it('un horario propio que no toca el del negocio deja al recurso sin horarios', () => {
    const propio: SemanaTurnos = Array.from({ length: 7 }, () => [[h(13), h(16)]] as Tramo[]);
    const c = ctx({ recursos: [r('r1', { ownSchedule: propio })] });
    expect(disponibilidadDelDia(c, LUNES, 30, 'r1').motivo).toBe('no-atiende');
  });

  it('pedir una agenda que no existe no ofrece nada', () => {
    expect(disponibilidadDelDia(ctx(), LUNES, 30, 'no-existe').horarios).toEqual([]);
  });

  it('en un día especial el recurso sigue el horario especial', () => {
    const horario: HorarioNegocio = { ...HORARIO, especiales: [{ fecha: LUNES, tipo: 'SPECIAL', tramos: [[h(10), h(12)]] }] };
    const soloTarde: SemanaTurnos = Array.from({ length: 7 }, () => [[h(16), h(20)]] as Tramo[]);
    const c = ctx({ horario, recursos: [r('r1'), r('r2', { ownSchedule: soloTarde })] });
    expect(horas(c, LUNES, 30, 'r1')).toEqual(['10:00', '10:30', '11:00', '11:30']);
    // El que solo viene a la tarde ese día no atiende: el negocio abre de 10 a 12.
    expect(disponibilidadDelDia(c, LUNES, 30, 'r2').motivo).toBe('no-atiende');
  });
});

describe('Disponibilidad — "Cualquiera"', () => {
  const dos = [r('r1'), r('r2')];
  const recursoDe = (c: ContextoDisponibilidad, hora: string) => horariosLibres(c, LUNES, 30, CUALQUIERA).find((x) => hhmm(x.inicioMin) === hora)?.resourceId;

  it('devuelve una sola entrada por hora', () => {
    const libres = horariosLibres(ctx({ recursos: dos }), LUNES, 30, CUALQUIERA);
    const inicios = libres.map((x) => x.inicioMin);
    expect(new Set(inicios).size).toBe(inicios.length);
    expect(inicios.length).toBe(16);
    expect(inicios).toEqual([...inicios].sort((a, b) => a - b));
  });

  it('si están igual de cargados gana el primero', () => {
    expect(recursoDe(ctx({ recursos: dos }), '09:00')).toBe('r1');
    expect(recursoDe(ctx({ recursos: [r('r2'), r('r1')] }), '09:00')).toBe('r2');
  });

  it('elige al menos cargado de los que tienen lugar', () => {
    // r1 tiene dos turnos (60 min), r2 uno (30 min).
    const c = ctx({ recursos: dos, turnos: [turno('r1', LUNES, h(9), h(9, 30)), turno('r1', LUNES, h(10), h(10, 30)), turno('r2', LUNES, h(11), h(11, 30))] });
    expect(recursoDe(c, '12:00')).toBe('r2'); // los dos libres: va al menos cargado
    expect(recursoDe(c, '11:00')).toBe('r1'); // r2 ocupado: va r1 aunque esté más cargado
    expect(recursoDe(c, '09:00')).toBe('r2'); // r1 ocupado
  });

  it('una hora ocupada en todas las agendas no se ofrece', () => {
    const c = ctx({ recursos: dos, turnos: [turno('r1', LUNES, h(9), h(9, 30)), turno('r2', LUNES, h(9), h(9, 30))] });
    expect(recursoDe(c, '09:00')).toBeUndefined();
    expect(recursoDe(c, '09:30')).toBeDefined();
  });

  it('no le da turnos a quien no atiende ese día ni fuera de su horario', () => {
    const soloTarde: SemanaTurnos = Array.from({ length: 7 }, () => [[h(16), h(20)]] as Tramo[]);
    const c = ctx({ recursos: [r('r1', { workDays: [1, 2, 3] }), r('r2', { ownSchedule: soloTarde })] });
    // Lunes: r1 no viene y r2 solo a la tarde.
    const libres = horariosLibres(c, LUNES, 30, CUALQUIERA);
    expect(libres.map((x) => hhmm(x.inicioMin))[0]).toBe('16:00');
    expect(new Set(libres.map((x) => x.resourceId))).toEqual(new Set(['r2']));
    // Martes a la mañana solo está r1.
    expect(horariosLibres(c, MARTES, 30, CUALQUIERA).find((x) => x.inicioMin === h(9))?.resourceId).toBe('r1');
  });

  it('si nadie atiende ese día, está cerrado', () => {
    const c = ctx({ recursos: [r('r1', { workDays: [1] }), r('r2', { workDays: [2] })] });
    expect(disponibilidadDelDia(c, LUNES, 30, CUALQUIERA)).toEqual({ fecha: LUNES, cerrado: true, motivo: 'no-atiende', horarios: [] });
  });

  it('sin agendas no ofrece nada', () => {
    expect(disponibilidadDelDia(ctx({ recursos: [] }), LUNES, 30, CUALQUIERA).horarios).toEqual([]);
  });

  it('el margen se mira en la agenda que toma el turno, no en las demás', () => {
    const c = ctx({ recursos: dos, reglas: { bufferMin: 10 }, turnos: [turno('r1', LUNES, h(10), h(10, 30))] });
    // 10:30 en r1 no deja margen; en r2 sí.
    expect(recursoDe(c, '10:30')).toBe('r2');
  });
});

describe('Disponibilidad — validar una reserva, rango y próximo libre', () => {
  it('una hora de la grilla que está libre se puede reservar', () => {
    expect(horarioSiEstaLibre(ctx(), LUNES, h(9, 30), 30, 'r1')).toMatchObject({ inicioMin: 570, resourceId: 'r1' });
  });

  it('una hora fuera de la grilla, ocupada, fuera de horario o pasada no se puede', () => {
    const c = ctx({ turnos: [turno('r1', LUNES, h(10), h(10, 30))] });
    expect(horarioSiEstaLibre(c, LUNES, h(9, 10), 30, 'r1')).toBeNull(); // no es de la grilla
    expect(horarioSiEstaLibre(c, LUNES, h(10), 30, 'r1')).toBeNull(); // ocupada
    expect(horarioSiEstaLibre(c, LUNES, h(14), 30, 'r1')).toBeNull(); // corte del mediodía
    expect(horarioSiEstaLibre({ ...c, ahora: ar(LUNES, 12) }, LUNES, h(9), 30, 'r1')).toBeNull(); // ya pasó
  });

  it('con "Cualquiera" dice en qué agenda cae', () => {
    const c = ctx({ recursos: [r('r1'), r('r2')], turnos: [turno('r1', LUNES, h(9), h(9, 30))] });
    expect(horarioSiEstaLibre(c, LUNES, h(9), 30, CUALQUIERA)?.resourceId).toBe('r2');
  });

  it('el rango trae un renglón por día, con cuántos libres y el primero', () => {
    const c = ctx({ turnos: [turno('r1', LUNES, h(9), h(13))] });
    expect(disponibilidadPorRango(c, DOMINGO, MARTES, 30, 'r1')).toEqual([
      { fecha: DOMINGO, cerrado: true, motivo: 'no-abre', libres: 0, primeroMin: null },
      { fecha: LUNES, cerrado: false, motivo: null, libres: 8, primeroMin: h(16) },
      { fecha: MARTES, cerrado: false, motivo: null, libres: 16, primeroMin: h(9) },
    ]);
  });

  it('el rango tiene tope: nadie pide un año entero', () => {
    const dias = disponibilidadPorRango(ctx({ reglas: { maxAdvanceDays: 400 } }), LUNES, '2027-10-05', 30, 'r1');
    expect(dias.length).toBe(62);
  });

  it('un rango al revés no devuelve nada', () => {
    expect(disponibilidadPorRango(ctx(), MARTES, LUNES, 30, 'r1')).toEqual([]);
  });

  it('el próximo horario libre salta los días cerrados y los completos', () => {
    // Sábado 3 a las 20:30 (ya cerró), domingo cerrado, lunes con la mañana tomada.
    const c = ctx({ ahora: ar('2026-10-03', 20, 30), turnos: [turno('r1', LUNES, h(9), h(13))] });
    const libre = primerHorarioLibre(c, 30, 'r1');
    expect(libre?.startsAt.toISOString()).toBe('2026-10-05T19:00:00.000Z'); // lunes 16:00
  });

  it('si no hay nada en los días que mira, devuelve null', () => {
    const horario: HorarioNegocio = { ...HORARIO, vacaciones: { desde: '2026-10-01', hasta: '2026-12-31' } };
    expect(primerHorarioLibre(ctx({ horario }), 30, 'r1')).toBeNull();
  });
});
