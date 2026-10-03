import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSIONS } from '../../src/common/permisos/catalogo';
import {
  ALCANCES_MINIMOS, CODIGOS_TURNOS, PERMISOS_TURNOS, alcanceDe, alcancesDe, codigosDe, normalizarAlcances, normalizarCodigos, rolesDeFabrica,
} from '../../src/appointments/catalogo/roles';
import {
  KEYS_RUBROS_TURNOS, RUBROS_TURNOS, grillasDe, modalidadesInicialesDe, modalidadesPosibles, reglasInicialesDe, rubroTurnosPorKey, semanaInicialDe, vozDe,
} from '../../src/appointments/catalogo/rubros';
import { errorSemana } from '../../src/appointments/horarios/horarios';
import { ESTADOS_ACTIVOS, TRANSICIONES, estadoVisible, puedePasarA } from '../../src/appointments/appointments.types';

// Catálogo de Turnos: rubros, roles de fábrica y la traducción de los alcances
// de la demo (todo / propio / no) a los pares de permisos del sistema.

describe('Turnos — catálogo de rubros', () => {
  it('trae los 32 rubros, sin keys repetidas', () => {
    expect(RUBROS_TURNOS).toHaveLength(32);
    expect(new Set(KEYS_RUBROS_TURNOS).size).toBe(32);
  });

  it('son los mismos rubros que la demo del frontend, con el mismo modo, seña y servicios', () => {
    const demo = resolve(__dirname, '../../../web/src/modules/turnos/datos.ts');
    // La demo es la referencia mientras exista; el día que se borre, el catálogo del backend queda solo.
    if (!existsSync(demo)) return;
    const src = readFileSync(demo, 'utf8');
    const MODO: Record<string, string> = { profesional: 'PROFESSIONAL', recurso: 'RESOURCE', cancha: 'COURT', cupo: 'CLASS' };
    const enDemo = [...src.matchAll(/\{ key: '([^']+)', familia: '([^']+)', label: '([^']+)',[^\n]*modo: '([^']+)', sena: (\d+), profesional: '([^']+)', cliente: '([^']+)'/g)]
      .map((m) => ({ key: m[1], familia: m[2], label: m[3], modo: MODO[m[4]], sena: Number(m[5]), profesional: m[6], cliente: m[7] }));
    expect(enDemo).toHaveLength(32);
    expect(RUBROS_TURNOS.map(({ key, familia, label, modo, sena, profesional, cliente }) => ({ key, familia, label, modo, sena, profesional, cliente }))).toEqual(enDemo);

    const serviciosDemo = [...src.slice(src.indexOf('export const RUBROS_TURNOS'), src.indexOf('export const rubroPorKey')).matchAll(/\{ nombre: '([^']+)', duracion: (\d+), precio: (\d+) \}/g)]
      .map((m) => ({ nombre: m[1], duracion: Number(m[2]), precio: Number(m[3]) }));
    expect(RUBROS_TURNOS.flatMap((r) => r.servicios)).toEqual(serviciosDemo);
  });

  it('cada rubro tiene servicios con duración y precio razonables', () => {
    for (const r of RUBROS_TURNOS) {
      expect(r.servicios.length).toBeGreaterThan(0);
      for (const s of r.servicios) {
        expect(s.nombre.trim()).not.toBe('');
        expect(s.duracion).toBeGreaterThan(0);
        expect(s.precio).toBeGreaterThanOrEqual(0);
      }
      expect(r.sena).toBeGreaterThanOrEqual(0);
      expect(r.sena).toBeLessThanOrEqual(100);
    }
  });

  it('busca por key y no inventa un rubro por defecto', () => {
    expect(rubroTurnosPorKey('barberia')?.label).toBe('Barbería');
    expect(rubroTurnosPorKey('no-existe')).toBeUndefined();
  });

  it('la semana con la que arranca cada rubro es válida y es una copia', () => {
    for (const r of RUBROS_TURNOS) {
      expect(errorSemana(semanaInicialDe(r), { exigirUnDiaAbierto: true })).toBeNull();
    }
    const barberia = rubroTurnosPorKey('barberia')!;
    semanaInicialDe(barberia)[0].length = 0; // mutar la copia no toca el molde
    expect(semanaInicialDe(barberia)[0]).toEqual([[540, 780], [960, 1200]]);
    expect(semanaInicialDe(rubroTurnosPorKey('gym')!)[0]).toEqual([[420, 780], [1020, 1320]]);
    expect(semanaInicialDe(rubroTurnosPorKey('canchas')!)[5]).toEqual([[540, 780], [900, 1380]]);
    expect(semanaInicialDe(barberia)[6]).toEqual([]);
  });

  it('las reglas de fábrica siguen a la demo', () => {
    const barberia = reglasInicialesDe(rubroTurnosPorKey('barberia')!);
    expect(barberia).toMatchObject({ minAdvanceMin: 120, maxAdvanceDays: 30, slotMin: 30, bufferMin: 5, confirmation: 'auto', depositEnabled: false, maxActivePerCustomer: 2, askInsurance: false });
    const consulta = reglasInicialesDe(rubroTurnosPorKey('consulta')!);
    expect(consulta).toMatchObject({ minAdvanceMin: 240, bufferMin: 0, confirmation: 'manual', askInsurance: true, askDni: true, askReason: true });
    expect(reglasInicialesDe(rubroTurnosPorKey('psico')!).askReason).toBe(false);
    const canchas = reglasInicialesDe(rubroTurnosPorKey('canchas')!);
    expect(canchas).toMatchObject({ slotMin: 60, depositEnabled: true, depositPercent: 50, waitlistEnabled: true, confirmation: 'auto' });
    const gym = reglasInicialesDe(rubroTurnosPorKey('gym')!);
    expect(gym).toMatchObject({ maxAdvanceDays: 14, maxActivePerCustomer: 0, waitlistEnabled: true });
    // La grilla de fábrica es una de las que el rubro deja elegir.
    for (const r of RUBROS_TURNOS) expect(grillasDe(r)).toContain(reglasInicialesDe(r).slotMin);
  });

  it('una cancha o una clase no van a domicilio', () => {
    expect(modalidadesPosibles(rubroTurnosPorKey('canchas')!)).toEqual(['ON_SITE']);
    expect(modalidadesPosibles(rubroTurnosPorKey('yoga')!)).toEqual(['ON_SITE']);
    expect(modalidadesInicialesDe(rubroTurnosPorKey('kinesio')!)).toEqual(['ON_SITE', 'HOME']);
    expect(modalidadesInicialesDe(rubroTurnosPorKey('barberia')!)).toEqual(['ON_SITE']);
    for (const r of RUBROS_TURNOS) {
      for (const m of modalidadesInicialesDe(r)) expect(modalidadesPosibles(r)).toContain(m);
    }
  });

  it('nombra las cosas según el rubro', () => {
    expect(vozDe(rubroTurnosPorKey('barberia')!)).toEqual({ clientes: 'clientes', cliente: 'cliente', turno: 'turno', turnos: 'turnos', recurso: 'barbero' });
    expect(vozDe(rubroTurnosPorKey('clinica')!)).toMatchObject({ clientes: 'pacientes', recurso: 'consultorio' });
    expect(vozDe(rubroTurnosPorKey('crossfit')!)).toMatchObject({ clientes: 'alumnos', turno: 'clase', recurso: 'sala' });
    expect(vozDe(rubroTurnosPorKey('canchas')!)).toMatchObject({ turno: 'reserva', recurso: 'cancha' });
  });
});

describe('Turnos — permisos: alcances de la demo contra pares de códigos', () => {
  const enCatalogo = PERMISSIONS.filter((p) => p.group === 'Turnos').map((p) => p.code).sort();

  it('los códigos de Turnos son exactamente los del catálogo de permisos', () => {
    expect([...CODIGOS_TURNOS].sort()).toEqual(enCatalogo);
    expect(enCatalogo).toHaveLength(15);
    expect(PERMISSIONS.filter((p) => p.code.startsWith('appointments.')).every((p) => p.group === 'Turnos')).toBe(true);
  });

  it('la migración de backfill inserta los mismos 15 códigos con las mismas etiquetas', () => {
    const sql = readFileSync(resolve(__dirname, '../../prisma/migrations/20261003120100_appointments_permisos/migration.sql'), 'utf8');
    const enSql = [...sql.matchAll(/\(gen_random_uuid\(\), '([^']+)', '([^']+)', '([^']+)'\)/g)].map((m) => ({ group: m[1], code: m[2], label: m[3] }));
    const porCodigo = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);
    expect(enSql.sort(porCodigo)).toEqual(PERMISSIONS.filter((p) => p.group === 'Turnos').sort(porCodigo));
    // Solo a los roles de fábrica owner y admin: el Empleado no los recibe.
    expect(sql).toMatch(/r\."is_default" = true\s+AND r\."name" IN \('owner', 'admin'\)/);
    expect(sql).not.toMatch(/empleado'/);
  });

  it('propio = el código base; todo = el par; no = nada', () => {
    expect(alcanceDe([], 'agenda.ver')).toBe('no');
    expect(alcanceDe(['appointments.agenda.view'], 'agenda.ver')).toBe('propio');
    expect(alcanceDe(['appointments.agenda.view', 'appointments.agenda.view_all'], 'agenda.ver')).toBe('todo');
    // El `_all` sin su base no da nada.
    expect(alcanceDe(['appointments.agenda.view_all'], 'agenda.ver')).toBe('no');
    // Los que no tienen punto medio: tenerlo es tenerlo entero.
    expect(alcanceDe(['appointments.cash.charge'], 'caja.cobrar')).toBe('todo');
  });

  it('ida y vuelta: alcances → códigos → alcances', () => {
    for (const r of RUBROS_TURNOS) {
      for (const rol of rolesDeFabrica(r)) {
        expect(alcancesDe(rol.permisos)).toEqual(normalizarAlcances(rol.alcances));
        expect(codigosDe(alcancesDe(rol.permisos)).sort()).toEqual([...rol.permisos].sort());
      }
    }
    expect(codigosDe(ALCANCES_MINIMOS)).toEqual(['appointments.agenda.view']);
  });

  it('aplica las dependencias: no se edita lo que no se ve, ni se liquida sin ver todo', () => {
    const base = alcancesDe([]);
    expect(normalizarAlcances({ ...base, 'agenda.ver': 'propio', 'agenda.editar': 'todo' })['agenda.editar']).toBe('propio');
    expect(normalizarAlcances({ ...base, 'agenda.ver': 'no', 'agenda.editar': 'todo' })['agenda.editar']).toBe('no');
    expect(normalizarAlcances({ ...base, 'clientes.ver': 'no', 'clientes.contacto': 'todo' })['clientes.contacto']).toBe('no');
    expect(normalizarAlcances({ ...base, 'ganancias.ver': 'propio', 'ganancias.liquidar': 'todo' })['ganancias.liquidar']).toBe('no');
    expect(normalizarAlcances({ ...base, 'ganancias.ver': 'todo', 'ganancias.liquidar': 'todo' })['ganancias.liquidar']).toBe('todo');
  });

  it('normaliza una lista de códigos sin tocar los que no son de Turnos', () => {
    const entrada = ['orders.view', 'appointments.agenda.manage', 'appointments.agenda.manage_all', 'appointments.earnings.settle', 'appointments.agenda.view'];
    // Ve solo su agenda → edita solo la suya; liquidar sin ver las ganancias de todos se cae.
    expect(normalizarCodigos(entrada).sort()).toEqual(['appointments.agenda.manage', 'appointments.agenda.view', 'orders.view']);
  });

  it('cada permiso de la demo tiene su código en el catálogo', () => {
    expect(Object.keys(PERMISOS_TURNOS)).toHaveLength(11);
    for (const p of Object.values(PERMISOS_TURNOS)) {
      expect(enCatalogo).toContain(p.base);
      if (p.todo) expect(enCatalogo).toContain(p.todo);
    }
  });
});

describe('Turnos — roles de fábrica', () => {
  it('todos los rubros traen roles, con keys únicas y permisos del catálogo', () => {
    for (const r of RUBROS_TURNOS) {
      const roles = rolesDeFabrica(r);
      expect(roles.length).toBeGreaterThanOrEqual(3);
      expect(new Set(roles.map((x) => x.key)).size).toBe(roles.length);
      for (const rol of roles) {
        expect(rol.key).not.toBe('owner'); // el dueño es el rol de siempre
        for (const c of rol.permisos) expect(CODIGOS_TURNOS).toContain(c);
        // Ningún rol de fábrica configura el negocio: eso es del dueño.
        expect(rol.permisos).not.toContain('appointments.settings.manage');
      }
    }
  });

  it('una barbería tiene Barbero y Aprendiz; un consultorio, Secretaría y Administración', () => {
    const barberia = rolesDeFabrica(rubroTurnosPorKey('barberia')!);
    expect(barberia.map((x) => x.nombre)).toEqual(['Encargado/a', 'Recepción', 'Barbero', 'Aprendiz']);
    expect(barberia.find((x) => x.key === 'profesional')).toMatchObject({ atiende: true });
    expect(barberia.find((x) => x.key === 'recepcion')).toMatchObject({ atiende: false });
    const consulta = rolesDeFabrica(rubroTurnosPorKey('consulta')!);
    expect(consulta.map((x) => x.nombre)).toEqual(['Encargado/a', 'Secretaría', 'Médico/a', 'Administración']);
  });

  it('quien atiende ve lo suyo: su agenda, sus clientes y sus ganancias, no las de todos', () => {
    const barbero = rolesDeFabrica(rubroTurnosPorKey('barberia')!).find((x) => x.key === 'profesional')!;
    expect(barbero.permisos.sort()).toEqual([
      'appointments.agenda.manage', 'appointments.agenda.view', 'appointments.cash.charge', 'appointments.clients.view', 'appointments.earnings.view',
    ]);
    // En salud ve cómo contactar a sus pacientes y no cobra.
    const medico = rolesDeFabrica(rubroTurnosPorKey('consulta')!).find((x) => x.key === 'profesional')!;
    expect(medico.permisos).toContain('appointments.clients.contact');
    expect(medico.permisos).not.toContain('appointments.cash.charge');
  });

  it('un complejo de canchas no tiene profesionales', () => {
    const roles = rolesDeFabrica(rubroTurnosPorKey('canchas')!);
    expect(roles.map((x) => x.key)).toEqual(['encargado', 'cantina', 'mantenimiento', 'administracion']);
    expect(roles.every((x) => !x.atiende)).toBe(true);
  });
});

describe('Turnos — estados', () => {
  const t = (status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED') =>
    ({ status, startsAt: new Date('2026-10-05T13:00:00.000Z'), endsAt: new Date('2026-10-05T13:30:00.000Z') });
  const antes = new Date('2026-10-05T12:00:00.000Z');
  const durante = new Date('2026-10-05T13:10:00.000Z');
  const despues = new Date('2026-10-05T14:00:00.000Z');

  it('"en curso" se calcula: un confirmado cuyo horario contiene a ahora', () => {
    expect(estadoVisible(t('CONFIRMED'), antes)).toBe('CONFIRMED');
    expect(estadoVisible(t('CONFIRMED'), durante)).toBe('IN_PROGRESS');
    expect(estadoVisible(t('CONFIRMED'), new Date('2026-10-05T13:00:00.000Z'))).toBe('IN_PROGRESS');
    expect(estadoVisible(t('CONFIRMED'), new Date('2026-10-05T13:30:00.000Z'))).toBe('CONFIRMED');
    expect(estadoVisible(t('PENDING'), durante)).toBe('PENDING');
    expect(estadoVisible(t('CANCELLED'), durante)).toBe('CANCELLED');
  });

  it('atendido y ausente solo se marcan cuando el turno ya empezó', () => {
    expect(puedePasarA(t('CONFIRMED'), 'COMPLETED', antes)).toBe(false);
    expect(puedePasarA(t('CONFIRMED'), 'NO_SHOW', antes)).toBe(false);
    expect(puedePasarA(t('CONFIRMED'), 'COMPLETED', durante)).toBe(true);
    expect(puedePasarA(t('CONFIRMED'), 'NO_SHOW', despues)).toBe(true);
    expect(puedePasarA(t('PENDING'), 'NO_SHOW', despues)).toBe(true);
  });

  it('confirmar y cancelar se puede en cualquier momento; un pendiente no pasa directo a atendido', () => {
    expect(puedePasarA(t('PENDING'), 'CONFIRMED', antes)).toBe(true);
    expect(puedePasarA(t('PENDING'), 'CANCELLED', antes)).toBe(true);
    expect(puedePasarA(t('CONFIRMED'), 'CANCELLED', despues)).toBe(true);
    expect(puedePasarA(t('PENDING'), 'COMPLETED', despues)).toBe(false);
    expect(puedePasarA(t('CONFIRMED'), 'PENDING', antes)).toBe(false);
  });

  it('atendido, ausente y cancelado son finales', () => {
    for (const final of ['COMPLETED', 'NO_SHOW', 'CANCELLED'] as const) {
      expect(TRANSICIONES[final]).toEqual([]);
      for (const nuevo of ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const) {
        expect(puedePasarA(t(final), nuevo, despues)).toBe(false);
      }
    }
    expect(ESTADOS_ACTIVOS).toEqual(['PENDING', 'CONFIRMED']);
  });
});
