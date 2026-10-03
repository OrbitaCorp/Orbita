import type { AppointmentStatus } from '@prisma/client';
import {
  aCobrar, aPagar, clasesDadasEntre, claveSesion, desdePendiente, diasDelMes, formaDePagoDto, liquidarEntre, porcentajeDe, prorrateoMensual,
  totalesDelPeriodo, type PersonaLiquidable, type PlantillaLiquidable, type TurnoLiquidable,
} from '../../src/appointments/gestion/ganancias/liquidacion';
import { instanteDe, type HorarioNegocio } from '../../src/appointments/horarios/horarios';

// P3.4 — Liquidación del equipo (funciones puras). Los bordes que pide el
// contrato: período que cruza de mes, persona sin forma de pago (dueño),
// alquiler mayor que lo facturado, turnos cancelados/ausentes que no cuentan y
// el pendiente desde el último pago registrado.

const AGENDA = 'res-ana';
const ESPACIO = 'space-1';

const persona = (p: Partial<PersonaLiquidable> = {}): PersonaLiquidable => ({
  resourceId: AGENDA, assignedSpaceId: null, payForm: 'COMMISSION', commissionPercent: 50, salary: 0, rent: 0, perClass: 0, ...p,
});

let n = 0;
const turno = (fecha: string, min: number, price: number, extra: Partial<TurnoLiquidable> & { status?: AppointmentStatus } = {}): TurnoLiquidable => ({
  id: `t-${++n}`, resourceId: AGENDA, status: 'COMPLETED', startsAt: instanteDe(fecha, min), price, discountAmount: 0,
  customerName: 'Cliente', serviceName: 'Corte', ...extra,
});

const ABIERTO_SIEMPRE: HorarioNegocio = { semana: Array.from({ length: 7 }, () => [[480, 1320]] as [number, number][]), especiales: [], vacaciones: null };

describe('diasDelMes y prorrateo mensual', () => {
  it('días de cada mes, con bisiesto', () => {
    expect(diasDelMes('2026-02-10')).toBe(28);
    expect(diasDelMes('2028-02-10')).toBe(29);
    expect(diasDelMes('2026-09-01')).toBe(30);
    expect(diasDelMes('2026-10-31')).toBe(31);
    expect(diasDelMes('2026-12-31')).toBe(31);
  });

  it('un mes entero da el monto entero, sea de 28, 30 o 31 días', () => {
    expect(prorrateoMensual(300_000, '2026-09-01', '2026-09-30')).toBe(300_000);
    expect(prorrateoMensual(300_000, '2026-10-01', '2026-10-31')).toBe(300_000);
    expect(prorrateoMensual(280_000, '2026-02-01', '2026-02-28')).toBe(280_000);
  });

  it('un rango que cruza de un mes de 30 a uno de 31 usa el divisor de cada día y redondea al final', () => {
    // 2 días de septiembre (/30) + 2 de octubre (/31) de 310.000.
    const esperado = Math.round(310_000 * (2 / 30) + 310_000 * (2 / 31));
    expect(prorrateoMensual(310_000, '2026-09-29', '2026-10-02')).toBe(esperado);
    expect(esperado).toBe(40_667);
  });

  it('suma sin redondear cada día (redondear por día daría otro número)', () => {
    // 100/30 = 3,33 por día: 7 días = 23,33 → 23. Redondeando por día serían 21.
    expect(prorrateoMensual(100, '2026-09-01', '2026-09-07')).toBe(23);
  });

  it('rango vacío o monto cero → 0', () => {
    expect(prorrateoMensual(300_000, '2026-09-10', '2026-09-09')).toBe(0);
    expect(prorrateoMensual(0, '2026-09-01', '2026-09-30')).toBe(0);
  });
});

describe('liquidarEntre — qué turnos cuentan', () => {
  it('solo los COMPLETED de su agenda dentro del rango: cancelados, ausentes, pendientes y de otra agenda no suman', () => {
    const turnos = [
      turno('2026-09-10', 600, 10_000),
      turno('2026-09-10', 660, 10_000, { status: 'CANCELLED' }),
      turno('2026-09-11', 600, 10_000, { status: 'NO_SHOW' }),
      turno('2026-09-11', 660, 10_000, { status: 'CONFIRMED' }),
      turno('2026-09-11', 720, 10_000, { status: 'PENDING' }),
      turno('2026-09-12', 600, 10_000, { resourceId: 'otra-agenda' }),
      turno('2026-08-31', 600, 10_000), // fuera del rango
      turno('2026-10-01', 600, 10_000), // fuera del rango
    ];
    const l = liquidarEntre(persona(), '2026-09-01', '2026-09-30', turnos, 0);
    expect(l.appointments).toBe(1);
    expect(l.billed).toBe(10_000);
    expect(l.commission).toBe(5_000);
    expect(l.lines.map((x) => x.appointmentId)).toEqual([turnos[0].id]);
  });

  it('el día del turno es el de Argentina: 23:30 del 30/09 es septiembre aunque en UTC ya sea octubre', () => {
    const t = turno('2026-09-30', 23 * 60 + 30, 8_000);
    expect(t.startsAt.toISOString()).toBe('2026-10-01T02:30:00.000Z');
    expect(liquidarEntre(persona(), '2026-09-01', '2026-09-30', [t], 0).appointments).toBe(1);
    expect(liquidarEntre(persona(), '2026-10-01', '2026-10-31', [t], 0).appointments).toBe(0);
  });

  it('en modo RESOURCE también cuentan los turnos de su espacio asignado', () => {
    const turnos = [turno('2026-09-10', 600, 10_000, { resourceId: ESPACIO }), turno('2026-09-10', 700, 5_000)];
    const l = liquidarEntre(persona({ assignedSpaceId: ESPACIO }), '2026-09-01', '2026-09-30', turnos, 0);
    expect(l.appointments).toBe(2);
    expect(l.billed).toBe(15_000);
  });

  it('el precio es price - discountAmount, y la parte de cada turno se redondea al peso', () => {
    const l = liquidarEntre(persona({ commissionPercent: 50 }), '2026-09-01', '2026-09-30', [turno('2026-09-10', 600, 1_201, { discountAmount: 200 })], 0);
    expect(l.lines[0].price).toBe(1_001);
    expect(l.lines[0].share).toBe(501); // 500,5 → 501
    expect(l.commission).toBe(501);
  });

  it('los renglones van de lo más nuevo a lo más viejo', () => {
    const turnos = [turno('2026-09-10', 600, 1), turno('2026-09-12', 540, 1), turno('2026-09-12', 600, 1), turno('2026-09-11', 900, 1)];
    const l = liquidarEntre(persona(), '2026-09-01', '2026-09-30', turnos, 0);
    expect(l.lines.map((x) => `${x.date} ${x.startMin}`)).toEqual(['2026-09-12 600', '2026-09-12 540', '2026-09-11 900', '2026-09-10 600']);
  });

  it('rango vacío (to < from) → todo en cero', () => {
    const l = liquidarEntre(persona({ payForm: 'SALARY', salary: 300_000 }), '2026-09-10', '2026-09-09', [turno('2026-09-09', 600, 10_000)], 4);
    expect(l).toMatchObject({ appointments: 0, classes: 0, billed: 0, commission: 0, salary: 0, perClass: 0, rent: 0, toPerson: 0, toBusiness: 0, lines: [] });
  });
});

describe('liquidarEntre — cada forma de pago', () => {
  const turnos = [turno('2026-09-10', 600, 20_000), turno('2026-09-11', 600, 10_000)];

  it('COMISIÓN: el % de cada turno', () => {
    const l = liquidarEntre(persona({ payForm: 'COMMISSION', commissionPercent: 40 }), '2026-09-01', '2026-09-30', turnos, 0);
    expect(l).toMatchObject({ billed: 30_000, commission: 12_000, salary: 0, rent: 0, toPerson: 12_000, toBusiness: 18_000 });
  });

  it('SUELDO: el fijo prorrateado, sin comisión; sin turnos propios el negocio queda negativo', () => {
    const l = liquidarEntre(persona({ payForm: 'SALARY', salary: 300_000, commissionPercent: 50 }), '2026-09-01', '2026-09-15', [], 0);
    expect(l).toMatchObject({ billed: 0, commission: 0, salary: 150_000, toPerson: 150_000, toBusiness: -150_000 });
  });

  it('MIXTO: fijo prorrateado + comisión', () => {
    const l = liquidarEntre(persona({ payForm: 'MIXED', salary: 300_000, commissionPercent: 10 }), '2026-09-01', '2026-09-30', turnos, 0);
    expect(l).toMatchObject({ commission: 3_000, salary: 300_000, toPerson: 303_000, toBusiness: 30_000 - 303_000 });
  });

  it('ALQUILER: se queda con lo que factura menos el alquiler; si el alquiler es mayor que lo facturado, le queda negativo', () => {
    const l = liquidarEntre(persona({ payForm: 'RENT', rent: 300_000 }), '2026-09-01', '2026-09-30', turnos, 0);
    expect(l).toMatchObject({ billed: 30_000, commission: 0, rent: 300_000, toPerson: -270_000, toBusiness: 300_000 });
    // La parte de cada turno es el 100 % (es todo suyo).
    expect(l.lines.every((x) => x.share === x.price)).toBe(true);
    expect(aPagar('RENT', l)).toBe(0);
    expect(aCobrar('RENT', l)).toBe(300_000);
  });

  it('POR CLASE: clases dadas × monto', () => {
    const l = liquidarEntre(persona({ payForm: 'PER_CLASS', perClass: 9_000 }), '2026-09-01', '2026-09-30', [], 3);
    expect(l).toMatchObject({ classes: 3, perClass: 27_000, toPerson: 27_000, toBusiness: -27_000 });
  });

  it('DUEÑO (sin forma de pago): no se liquida, todo lo que factura queda para el negocio', () => {
    const l = liquidarEntre(persona({ payForm: null, salary: 999, rent: 999, perClass: 999 }), '2026-09-01', '2026-09-30', turnos, 5);
    expect(l).toMatchObject({ billed: 30_000, commission: 0, salary: 0, rent: 0, perClass: 0, toPerson: 0, toBusiness: 30_000 });
    expect(aPagar(null, l)).toBe(0);
    expect(aCobrar(null, l)).toBe(0);
    expect(porcentajeDe(persona({ payForm: null }))).toBe(0);
  });

  it('las formas que no son por clase no cobran las clases que dio', () => {
    expect(liquidarEntre(persona({ payForm: 'SALARY', salary: 0, perClass: 9_000 }), '2026-09-01', '2026-09-30', [], 4).perClass).toBe(0);
  });

  it('el sueldo de un período que cruza de mes se prorratea con el divisor de cada mes', () => {
    const l = liquidarEntre(persona({ payForm: 'SALARY', salary: 310_000 }), '2026-09-29', '2026-10-02', [], 0);
    expect(l.salary).toBe(40_667);
  });
});

describe('clasesDadasEntre', () => {
  const PROFE = 'res-profe';
  const LUNES_18 = (p: Partial<PlantillaLiquidable> = {}): PlantillaLiquidable => ({
    id: 'tpl-1', instructorResourceId: PROFE, weekday: 0, startMin: 18 * 60, durationMin: 60, isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'), deletedAt: null, ...p,
  });
  // Lunes 7, 14, 21 y 28 de septiembre de 2026.
  const AHORA = new Date('2026-09-30T12:00:00Z');

  it('cuenta una clase por cada fecha en que cae su plantilla', () => {
    expect(clasesDadasEntre(PROFE, [LUNES_18()], new Set(), ABIERTO_SIEMPRE, '2026-09-01', '2026-09-30', AHORA)).toBe(4);
  });

  it('no cuenta las de otro profe ni las plantillas apagadas', () => {
    expect(clasesDadasEntre(PROFE, [LUNES_18({ instructorResourceId: 'otro' }), LUNES_18({ id: 'b', isActive: false })], new Set(), ABIERTO_SIEMPRE, '2026-09-01', '2026-09-30', AHORA)).toBe(0);
  });

  it('no cuenta las suspendidas ni los días que el negocio no abre', () => {
    const horario: HorarioNegocio = { ...ABIERTO_SIEMPRE, especiales: [{ fecha: '2026-09-14', tipo: 'CLOSED', tramos: [] }] };
    const suspendidas = new Set([claveSesion('tpl-1', '2026-09-21')]);
    expect(clasesDadasEntre(PROFE, [LUNES_18()], suspendidas, horario, '2026-09-01', '2026-09-30', AHORA)).toBe(2);
  });

  it('no cuenta las vacaciones', () => {
    const horario: HorarioNegocio = { ...ABIERTO_SIEMPRE, vacaciones: { desde: '2026-09-01', hasta: '2026-09-15' } };
    expect(clasesDadasEntre(PROFE, [LUNES_18()], new Set(), horario, '2026-09-01', '2026-09-30', AHORA)).toBe(2);
  });

  it('una clase que todavía no terminó no cuenta (ni las futuras)', () => {
    const enLaClase = instanteDe('2026-09-28', 18 * 60 + 30);
    expect(clasesDadasEntre(PROFE, [LUNES_18()], new Set(), ABIERTO_SIEMPRE, '2026-09-01', '2026-10-31', enLaClase)).toBe(3);
    const alTerminar = instanteDe('2026-09-28', 19 * 60);
    expect(clasesDadasEntre(PROFE, [LUNES_18()], new Set(), ABIERTO_SIEMPRE, '2026-09-01', '2026-10-31', alTerminar)).toBe(4);
  });

  it('una plantilla creada después o borrada antes de la clase no cuenta esa fecha', () => {
    const creada = LUNES_18({ createdAt: instanteDe('2026-09-15', 0) });
    expect(clasesDadasEntre(PROFE, [creada], new Set(), ABIERTO_SIEMPRE, '2026-09-01', '2026-09-30', AHORA)).toBe(2);
    const borrada = LUNES_18({ deletedAt: instanteDe('2026-09-20', 0) });
    expect(clasesDadasEntre(PROFE, [borrada], new Set(), ABIERTO_SIEMPRE, '2026-09-01', '2026-09-30', AHORA)).toBe(2);
  });
});

describe('pendiente desde el último pago', () => {
  it('sin pagos, desde el alta; con pagos, desde el día siguiente al último (aunque cambie de mes)', () => {
    expect(desdePendiente(null, '2026-08-15')).toBe('2026-08-15');
    expect(desdePendiente('2026-09-20', '2026-08-15')).toBe('2026-09-21');
    expect(desdePendiente('2026-09-30', '2026-08-15')).toBe('2026-10-01');
    expect(desdePendiente('2026-12-31', '2026-08-15')).toBe('2027-01-01');
  });

  it('lo pendiente es la liquidación desde ese día hasta hoy; pagado hasta hoy = nada pendiente', () => {
    const turnos = [turno('2026-09-19', 600, 10_000), turno('2026-09-22', 600, 10_000)];
    const p = persona({ commissionPercent: 50 });
    const pend = liquidarEntre(p, desdePendiente('2026-09-20', '2026-01-01'), '2026-09-30', turnos, 0);
    expect(pend.appointments).toBe(1);
    expect(aPagar('COMMISSION', pend)).toBe(5_000);
    const nada = liquidarEntre(p, desdePendiente('2026-09-30', '2026-01-01'), '2026-09-30', turnos, 0);
    expect(aPagar('COMMISSION', nada)).toBe(0);
  });
});

describe('totales del período', () => {
  it('toTeam = lo que el negocio le paga al equipo; toBusiness = facturado − lo que se lleva cada uno (con alquiler incluido)', () => {
    const turnos = [turno('2026-09-10', 600, 40_000), turno('2026-09-10', 700, 30_000, { resourceId: 'res-inquilino' })];
    const comisionista = liquidarEntre(persona({ commissionPercent: 50 }), '2026-09-01', '2026-09-30', turnos, 0);
    const inquilino = liquidarEntre(persona({ resourceId: 'res-inquilino', payForm: 'RENT', rent: 10_000 }), '2026-09-01', '2026-09-30', turnos, 0);
    const t = totalesDelPeriodo(
      [{ forma: 'COMMISSION', period: comisionista }, { forma: 'RENT', period: inquilino }, { forma: null, period: liquidarEntre(persona({ resourceId: 'r-duenio', payForm: null }), '2026-09-01', '2026-09-30', [], 0) }],
      100_000, 3,
    );
    // Comisión 20.000; quien alquila factura 30.000 y paga 10.000 (se lleva 20.000); el dueño, 0.
    expect(t).toEqual({ billed: 100_000, appointments: 3, toTeam: 20_000, toBusiness: 60_000 });
  });
});

describe('formaDePagoDto', () => {
  it('null para el dueño; números para el resto', () => {
    expect(formaDePagoDto({ payForm: null, commissionPercent: null, salary: null, rent: null, perClass: null, payEvery: null })).toBeNull();
    expect(formaDePagoDto({ payForm: 'COMMISSION', commissionPercent: '50.00', salary: null, rent: null, perClass: null, payEvery: 'WEEK' }))
      .toEqual({ payForm: 'COMMISSION', commissionPercent: 50, salary: 0, rent: 0, perClass: 0, payEvery: 'WEEK' });
  });
});
