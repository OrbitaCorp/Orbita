import { ForbiddenException } from '@nestjs/common';
import {
  aperturaDeReserva, armarClases, cabeEnTramos, calcularSena, decidirInscripcion, descuentoBienvenida, horarioTxt, lugaresLibres, seCruzan,
  type PlantillaArmable, type SesionArmable,
} from '../../src/appointments/gestion/clases/clases.reglas';
import { miTurnoDeClase, politicaTexto } from '../../src/appointments/gestion/clases/mi-turno';
import { assertNoEsRolDeDueno, assertPuedeDar, permisosQueFaltan } from '../../src/appointments/gestion/equipo/escalada';
import { formasDe, pagoInicialDe } from '../../src/appointments/gestion/equipo/pago';
import { rolCambiado } from '../../src/appointments/gestion/equipo/roles-turnos.service';
import { contactoSegun, montoSegun, taparTelefono } from '../../src/appointments/gestion/comun/alcance';
import { normalizarTelefono } from '../../src/appointments/gestion/comun/telefono';
import { ALFABETO_CODIGO, nuevoAccessToken, nuevoCodigo } from '../../src/appointments/gestion/comun/codigos';
import { partirNombre } from '../../src/appointments/gestion/comun/ficha-cliente';
import { rolDeFabrica } from '../../src/appointments/catalogo/roles';
import { rubroTurnosPorKey } from '../../src/appointments/catalogo/rubros';
import { instanteDe, type HorarioNegocio } from '../../src/appointments/horarios/horarios';

// P3 — reglas puras: clases con cupo, "mi turno" de una clase, formas de pago,
// anti-escalada y utilidades de alcance.

const ABIERTO: HorarioNegocio = { semana: Array.from({ length: 7 }, () => [[7 * 60, 22 * 60]] as [number, number][]), especiales: [], vacaciones: null };

const plantilla = (p: Partial<PlantillaArmable> = {}): PlantillaArmable => ({
  id: 'tpl-spinning', serviceId: 'svc', serviceName: 'Spinning', price: 6_000, weekday: 0, startMin: 18 * 60, durationMin: 45,
  instructorName: 'Caro', roomName: 'Sala 2', capacity: 15, isActive: true, deletedAt: null, ...p,
});

const sesion = (fecha: string, p: Partial<SesionArmable> = {}): SesionArmable => ({
  id: `ses-${fecha}`, templateId: 'tpl-spinning', date: fecha, startsAt: instanteDe(fecha, 18 * 60), endsAt: instanteDe(fecha, 18 * 60 + 45),
  capacity: null, isCancelled: false, ...p,
});

// Jueves 1 de octubre de 2026, 12:00 de Argentina. Lunes siguientes: 5 y 12.
const AHORA = instanteDe('2026-10-01', 12 * 60);
const opciones = (from: string, to: string, classOpenDays = 7) => ({ from, to, ahora: AHORA, classOpenDays });

describe('armarClases', () => {
  it('plantillas × fechas: una clase por cada día que cae, con el cupo de la plantilla si no hay sesión', () => {
    const clases = armarClases([plantilla()], [], new Map(), ABIERTO, opciones('2026-10-01', '2026-10-14'));
    expect(clases.map((c) => c.date)).toEqual(['2026-10-05', '2026-10-12']);
    expect(clases[0]).toMatchObject({ sessionId: null, capacity: 15, enrolled: 0, waitlist: 0, isCancelled: false, startMin: 1080, durationMin: 45, price: 6_000 });
    expect(clases[0].startsAt).toBe('2026-10-05T21:00:00.000Z');
  });

  it('la sesión materializada manda: cupo propio, suspensión y conteos', () => {
    const s = sesion('2026-10-05', { capacity: 20, isCancelled: true });
    const [c] = armarClases([plantilla()], [s], new Map([[s.id, { enrolled: 3, waitlist: 1 }]]), ABIERTO, opciones('2026-10-05', '2026-10-05'));
    expect(c).toMatchObject({ sessionId: s.id, capacity: 20, enrolled: 3, waitlist: 1, isCancelled: true, bookable: false });
  });

  it('bookable: no pasó, no está suspendida y la reserva ya abrió (hoy + classOpenDays)', () => {
    const clases = armarClases([plantilla()], [], new Map(), ABIERTO, opciones('2026-10-01', '2026-10-14', 7));
    expect(clases.find((c) => c.date === '2026-10-05')!.bookable).toBe(true); // 4 días
    expect(clases.find((c) => c.date === '2026-10-12')!.bookable).toBe(false); // 11 días > 7
    const pasada = armarClases([plantilla({ weekday: 3, startMin: 9 * 60 })], [], new Map(), ABIERTO, opciones('2026-10-01', '2026-10-01'));
    expect(pasada[0].bookable).toBe(false); // el jueves a las 9, ya pasó
  });

  it('los días que el negocio no abre no tienen clase', () => {
    const horario: HorarioNegocio = { ...ABIERTO, especiales: [{ fecha: '2026-10-12', tipo: 'CLOSED', tramos: [] }] };
    expect(armarClases([plantilla()], [], new Map(), horario, opciones('2026-10-01', '2026-10-14')).map((c) => c.date)).toEqual(['2026-10-05']);
  });

  it('una plantilla apagada o borrada no genera clases… salvo una sesión con gente anotada, que se sigue viendo sin poder reservarse', () => {
    const s = sesion('2026-10-05');
    const conGente = new Map([[s.id, { enrolled: 2, waitlist: 0 }]]);
    expect(armarClases([plantilla({ isActive: false })], [], new Map(), ABIERTO, opciones('2026-10-01', '2026-10-14'))).toEqual([]);
    const [c] = armarClases([plantilla({ deletedAt: new Date() })], [s], conGente, ABIERTO, opciones('2026-10-01', '2026-10-14'));
    expect(c).toMatchObject({ date: '2026-10-05', enrolled: 2, bookable: false });
    expect(armarClases([plantilla({ isActive: false })], [s], new Map(), ABIERTO, opciones('2026-10-01', '2026-10-14'))).toEqual([]);
  });

  it('una sesión con gente en un día cerrado se muestra (no se pierde a quien se anotó)', () => {
    const horario: HorarioNegocio = { ...ABIERTO, especiales: [{ fecha: '2026-10-05', tipo: 'CLOSED', tramos: [] }] };
    const s = sesion('2026-10-05');
    const [c] = armarClases([plantilla()], [s], new Map([[s.id, { enrolled: 1, waitlist: 0 }]]), horario, opciones('2026-10-05', '2026-10-05'));
    expect(c).toMatchObject({ enrolled: 1, bookable: false });
  });

  it('ordena por inicio', () => {
    const clases = armarClases([plantilla({ id: 'b', startMin: 19 * 60 }), plantilla({ id: 'a', startMin: 8 * 60 })], [], new Map(), ABIERTO, opciones('2026-10-05', '2026-10-05'));
    expect(clases.map((c) => c.templateId)).toEqual(['a', 'b']);
  });
});

describe('cupo y lista de espera', () => {
  it('lugares libres descuenta anotados y ofertas vigentes, nunca negativo', () => {
    expect(lugaresLibres(15, 10, 0)).toBe(5);
    expect(lugaresLibres(15, 14, 1)).toBe(0);
    expect(lugaresLibres(10, 12, 0)).toBe(0);
  });

  it('con lugar entra; sin lugar va a la lista de espera si está prendida; si no, completa', () => {
    expect(decidirInscripcion(1, false)).toBe('ENROLLED');
    expect(decidirInscripcion(0, true)).toBe('WAITLIST');
    expect(decidirInscripcion(0, false)).toBe('FULL');
  });
});

describe('horario de la plantilla', () => {
  it('la clase tiene que entrar entera en un tramo', () => {
    const tramos: [number, number][] = [[7 * 60, 13 * 60], [17 * 60, 22 * 60]];
    expect(cabeEnTramos(tramos, 18 * 60, 60)).toBe(true);
    expect(cabeEnTramos(tramos, 12 * 60 + 30, 60)).toBe(false); // se pasa del corte
    expect(cabeEnTramos(tramos, 21 * 60 + 30, 45)).toBe(false);
    expect(horarioTxt(tramos)).toBe('de 07:00 a 13:00 y de 17:00 a 22:00');
  });

  it('se cruzan si se pisan; una pegada a la otra no', () => {
    expect(seCruzan({ startMin: 600, durationMin: 60 }, { startMin: 630, durationMin: 60 })).toBe(true);
    expect(seCruzan({ startMin: 600, durationMin: 60 }, { startMin: 660, durationMin: 60 })).toBe(false);
  });

  it('la reserva abre classOpenDays antes', () => {
    expect(aperturaDeReserva('2026-10-12', 7)).toBe('2026-10-05');
    expect(aperturaDeReserva('2026-11-01', 2)).toBe('2026-10-30');
  });
});

describe('seña de una clase (§ 1.3)', () => {
  const reglas = { depositEnabled: true, depositType: 'percent' as const, depositPercent: 30, depositFixed: 0, depositForNoShows: true };

  it('porcentaje redondeado al peso; fija con tope en lo que hay que pagar', () => {
    expect(calcularSena(6_005, reglas, 0, 0)).toEqual({ deposit: 1_802, creditoUsado: 0 });
    expect(calcularSena(3_000, { ...reglas, depositType: 'fixed', depositFixed: 5_000 }, 0, 0)).toEqual({ deposit: 3_000, creditoUsado: 0 });
  });

  it('sin seña prendida solo la paga quien faltó sin avisar (depositForNoShows)', () => {
    const apagada = { ...reglas, depositEnabled: false };
    expect(calcularSena(6_000, apagada, 0, 0).deposit).toBe(0);
    expect(calcularSena(6_000, apagada, 1, 0).deposit).toBe(1_800);
    expect(calcularSena(6_000, { ...apagada, depositForNoShows: false }, 3, 0).deposit).toBe(0);
  });

  it('el crédito a favor se descuenta y se informa cuánto se usó', () => {
    expect(calcularSena(6_000, reglas, 0, 500)).toEqual({ deposit: 1_300, creditoUsado: 500 });
    expect(calcularSena(6_000, reglas, 0, 5_000)).toEqual({ deposit: 0, creditoUsado: 1_800 });
  });

  it('precio 0 ("Incluido") nunca pide seña', () => {
    expect(calcularSena(0, reglas, 5, 0)).toEqual({ deposit: 0, creditoUsado: 0 });
  });

  it('descuento de bienvenida redondeado', () => {
    expect(descuentoBienvenida(6_005, 10)).toBe(601);
  });
});

describe('mi turno de una clase', () => {
  const settings = { cancelUntilHours: 24, depositOutOfWindow: 'forfeit', toleranceMin: 10 };
  const clase = { serviceName: 'Spinning', resourceName: 'Caro', startsAt: instanteDe('2026-10-05', 18 * 60), endsAt: instanteDe('2026-10-05', 18 * 60 + 45) };
  const e = { code: 'ABC234', status: 'ENROLLED' as const, price: 6_000, discountAmount: 600, depositAmount: 1_620, depositPaidAt: null, waitlistPosition: null };

  it('no trae el accessToken ni datos del cliente', () => {
    const m = miTurnoDeClase(e, clase, settings, AHORA);
    expect(Object.keys(m)).not.toContain('accessToken');
    expect(JSON.stringify(m)).not.toMatch(/phone|email/i);
    expect(m).toMatchObject({ kind: 'class', code: 'ABC234', total: 5_400, deposit: { amount: 1_620, paid: false }, date: '2026-10-05', startMin: 1080, durationMin: 45 });
  });

  it('cancelar a tiempo hasta cancelUntilHours antes; una clase no se reprograma', () => {
    const m = miTurnoDeClase(e, clase, settings, AHORA);
    expect(m.canCancelUntil).toBe(instanteDe('2026-10-04', 18 * 60).toISOString());
    expect(m.canRescheduleUntil).toBeNull();
    expect(m.depositOnCancel).toBe('none');
    const tarde = miTurnoDeClase({ ...e, depositPaidAt: new Date() }, clase, { ...settings, depositOutOfWindow: 'credit' }, instanteDe('2026-10-05', 9 * 60));
    expect(tarde.canCancelUntil).toBeNull();
    expect(tarde.depositOnCancel).toBe('credit');
    expect(miTurnoDeClase({ ...e, depositPaidAt: new Date() }, clase, settings, AHORA).depositOnCancel).toBe('refund');
  });

  it('la política con la redacción de la demo', () => {
    expect(politicaTexto({ cancelUntilHours: 48, depositOutOfWindow: 'forfeit', toleranceMin: 0 }).changes).toContain('hasta 2 días antes');
    expect(politicaTexto({ cancelUntilHours: 0, depositOutOfWindow: 'credit', toleranceMin: 10 }).changes).toContain('Si no venís, la seña te queda a favor para otro turno.');
    expect(politicaTexto({ cancelUntilHours: 0, depositOutOfWindow: 'credit', toleranceMin: 10 }).late).toContain('10 minutos');
  });
});

describe('formas de pago del equipo', () => {
  it('comisión, mixto y alquiler solo por turno; por clase solo en clases; sueldo siempre', () => {
    expect(formasDe('PROFESSIONAL')).toEqual(['COMMISSION', 'SALARY', 'MIXED', 'RENT']);
    expect(formasDe('RESOURCE')).toEqual(['COMMISSION', 'SALARY', 'MIXED', 'RENT']);
    expect(formasDe('CLASS')).toEqual(['SALARY', 'PER_CLASS']);
    expect(formasDe('COURT')).toEqual(['SALARY']);
  });

  it('pago inicial de la demo por tipo de agenda; el dueño no se liquida', () => {
    expect(pagoInicialDe('CLASS')).toMatchObject({ payForm: 'PER_CLASS', perClass: 9000, payEvery: 'MONTH' });
    expect(pagoInicialDe('COURT')).toMatchObject({ payForm: 'SALARY', salary: 480000, payEvery: 'MONTH' });
    expect(pagoInicialDe('PROFESSIONAL')).toMatchObject({ payForm: 'COMMISSION', commissionPercent: 50, payEvery: 'WEEK' });
    expect(pagoInicialDe('RESOURCE', true).payForm).toBeNull();
  });
});

describe('anti-escalada', () => {
  const encargado = { roleName: 'Encargado/a', permissions: ['appointments.agenda.view', 'appointments.team.manage'] };
  const duenio = { roleName: 'owner', permissions: [] };

  it('no se dan permisos que uno no tiene; el dueño puede todo', () => {
    expect(permisosQueFaltan(encargado, ['appointments.agenda.view', 'appointments.settings.manage'])).toEqual(['appointments.settings.manage']);
    expect(() => assertPuedeDar(encargado, ['appointments.settings.manage'])).toThrow(ForbiddenException);
    expect(() => assertPuedeDar(encargado, ['appointments.agenda.view'])).not.toThrow();
    expect(() => assertPuedeDar(duenio, ['appointments.settings.manage'])).not.toThrow();
  });

  it('el rol de propietario solo lo da el dueño', () => {
    expect(() => assertNoEsRolDeDueno(encargado, { name: 'owner' })).toThrow(ForbiddenException);
    expect(() => assertNoEsRolDeDueno(encargado, { name: 'admin' })).toThrow(ForbiddenException);
    expect(() => assertNoEsRolDeDueno(duenio, { name: 'owner' })).not.toThrow();
    expect(() => assertNoEsRolDeDueno(encargado, { name: 'Recepción' })).not.toThrow();
  });
});

describe('rol de fábrica cambiado', () => {
  const rubro = rubroTurnosPorKey('barberia')!;
  const fabrica = rolDeFabrica(rubro, 'recepcion')!;
  const igual = { name: fabrica.nombre, description: fabrica.descripcion, takesAppointments: fabrica.atiende, permisos: [...fabrica.permisos].reverse() };

  it('igual a la fábrica (sin importar el orden de los permisos) → no cambió', () => {
    expect(rolCambiado(igual, fabrica)).toBe(false);
  });

  it('nombre, descripción, si atiende o permisos distintos → cambió', () => {
    expect(rolCambiado({ ...igual, name: 'Mostrador' }, fabrica)).toBe(true);
    expect(rolCambiado({ ...igual, description: 'otra' }, fabrica)).toBe(true);
    expect(rolCambiado({ ...igual, takesAppointments: !fabrica.atiende }, fabrica)).toBe(true);
    expect(rolCambiado({ ...igual, permisos: igual.permisos.slice(1) }, fabrica)).toBe(true);
  });

  it('un rol creado por el dueño nunca figura como cambiado', () => {
    expect(rolCambiado(igual, undefined)).toBe(false);
  });
});

describe('utilidades de alcance y datos', () => {
  const sinContacto = { roleName: 'Profesional', permissions: ['appointments.clients.view'] };
  const conContacto = { roleName: 'Recepción', permissions: ['appointments.clients.contact', 'appointments.reports.view'] };

  it('teléfono tapado salvo los dos últimos dígitos y email en null sin clients.contact', () => {
    expect(taparTelefono('1155550101')).toBe('••••••••01');
    expect(contactoSegun(sinContacto, '1155550101', 'a@b.com')).toEqual({ phone: '••••••••01', email: null });
    expect(contactoSegun(conContacto, '1155550101', 'a@b.com')).toEqual({ phone: '1155550101', email: 'a@b.com' });
    expect(contactoSegun({ roleName: 'owner', permissions: [] }, '1155550101', null)).toEqual({ phone: '1155550101', email: null });
  });

  it('montos en null sin reports.view', () => {
    expect(montoSegun(sinContacto, 100)).toBeNull();
    expect(montoSegun(conContacto, 100)).toBe(100);
  });

  it('teléfono normalizado: sin 54, 9, 0 ni 15', () => {
    expect(normalizarTelefono('11 5555-0101')).toBe('1155550101');
    expect(normalizarTelefono('011 15 5555-0101')).toBe('1155550101');
    expect(normalizarTelefono('+54 9 11 5555-0101')).toBe('1155550101');
    expect(normalizarTelefono('0351 15 555-0101')).toBe('3515550101');
    expect(normalizarTelefono('')).toBe('');
  });

  it('código de 6 caracteres sin 0/O/1/I; accessToken de 43 caracteres url-safe', () => {
    for (let i = 0; i < 50; i++) {
      const c = nuevoCodigo();
      expect(c).toMatch(/^[A-Z2-9]{6}$/);
      expect([...c].every((x) => ALFABETO_CODIGO.includes(x))).toBe(true);
      expect(c).not.toMatch(/[01OI]/);
    }
    const t = nuevoAccessToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nuevoAccessToken()).not.toBe(t);
  });

  it('nombre partido en primera palabra y resto', () => {
    expect(partirNombre('  Ana María  Paz ')).toEqual({ firstName: 'Ana', lastName: 'María Paz' });
    expect(partirNombre('Ana')).toEqual({ firstName: 'Ana', lastName: null });
  });
});
