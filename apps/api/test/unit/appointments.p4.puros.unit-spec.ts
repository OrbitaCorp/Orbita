import { instanteDe } from '../../src/appointments/horarios/horarios';
import { rubroTurnosPorKey } from '../../src/appointments/catalogo/rubros';
import { ajustarPrecioConReglas, precioConAjuste, reglaQueAplica } from '../../src/appointments/avanzado/precios-horario/precios-horario.puro';
import { enesimaFecha, generarOcurrencias } from '../../src/appointments/avanzado/turno-fijo/turno-fijo.puro';
import { pausadaEn, proximoDiaDeCobro, semanaDe, venceElDia } from '../../src/appointments/avanzado/membresias/membresias.puro';
import { conUnSelloMas, reglasTarjeta, sellosVencidos } from '../../src/appointments/avanzado/fidelidad/fidelidad.puro';
import { CONFIG_DE_FABRICA, configDe, recomendadasPara } from '../../src/appointments/avanzado/comun/funciones';
import { ALFABETO_CODIGOS, codigoAleatorio, normalizarCodigo } from '../../src/appointments/avanzado/comun/codigos';
import { normalizarTelefonoBasico, taparTelefono } from '../../src/appointments/avanzado/comun/telefono';
import { errorMonto, venceA } from '../../src/appointments/avanzado/gift-cards/gift-cards.service';
import { variablesDesconocidas } from '../../src/appointments/avanzado/recuperar/recuperar.service';
import { SEMANA } from './appointments.p4.helpers';

// Avanzado de Turnos (P4): las cuentas PURAS. Fechas fijas (2026-10-05 es
// lunes) y hora de Argentina (-03:00): nunca la del servidor.

describe('Precios por horario (CONTRATO § 1.3 / P4.4)', () => {
  const LUNES_10 = instanteDe('2026-10-05', 600);
  const reglas = [
    { id: 'manana', weekdays: [0, 1, 2, 3], fromMin: 540, toMin: 720, adjustPercent: -15, isActive: true },
    { id: 'pico', weekdays: [0, 1, 2, 3, 4], fromMin: 570, toMin: 660, adjustPercent: -20, isActive: true },
    { id: 'recargo', weekdays: [0], fromMin: 600, toMin: 630, adjustPercent: 25, isActive: true },
  ];

  it('si hay más de una regla que contiene el inicio, gana la de mayor descuento', () => {
    expect(reglaQueAplica(reglas, LUNES_10)?.id).toBe('pico');
    expect(ajustarPrecioConReglas(reglas, 10_000, LUNES_10)).toEqual({ precio: 8_000, adjustPercent: -20, reglaId: 'pico' });
  });

  it('las reglas apagadas no cuentan', () => {
    const r = reglas.map((x) => (x.id === 'pico' || x.id === 'manana' ? { ...x, isActive: false } : x));
    expect(ajustarPrecioConReglas(r, 10_000, LUNES_10)).toMatchObject({ precio: 12_500, adjustPercent: 25 });
  });

  it('la franja es [desde, hasta): el minuto del cierre ya no aplica', () => {
    expect(reglaQueAplica([reglas[0]], instanteDe('2026-10-05', 719))?.id).toBe('manana');
    expect(reglaQueAplica([reglas[0]], instanteDe('2026-10-05', 720))).toBeNull();
    expect(reglaQueAplica([reglas[0]], instanteDe('2026-10-05', 539))).toBeNull();
  });

  it('usa el día y la hora de ARGENTINA: el lunes 22 h (martes 01 h UTC) es lunes', () => {
    const noche = { weekdays: [0], fromMin: 1260, toMin: 1440, adjustPercent: -10, isActive: true };
    const lunes22 = instanteDe('2026-10-05', 22 * 60);
    expect(lunes22.toISOString()).toBe('2026-10-06T01:00:00.000Z');
    expect(ajustarPrecioConReglas([noche], 5_000, lunes22).precio).toBe(4_500);
    // Martes a la misma hora: no aplica.
    expect(ajustarPrecioConReglas([noche], 5_000, instanteDe('2026-10-06', 22 * 60)).precio).toBe(5_000);
  });

  it('sin regla devuelve el precio base intacto; el ajuste redondea al peso y nunca baja de 0', () => {
    expect(ajustarPrecioConReglas([], 9_999.5, LUNES_10)).toEqual({ precio: 9_999.5, adjustPercent: 0, reglaId: null });
    expect(precioConAjuste(9_999, -15)).toBe(8_499);
    expect(precioConAjuste(0, 50)).toBe(0);
  });
});

describe('Turno fijo: generarOcurrencias (CONTRATO § P4.6)', () => {
  const horario = (extra: Partial<{ especiales: { fecha: string; tipo: 'CLOSED' | 'SPECIAL'; tramos: [number, number][] }[]; vacaciones: { desde: string; hasta: string } | null }> = {}) => ({
    semana: SEMANA as [number, number][][], especiales: extra.especiales ?? [], vacaciones: extra.vacaciones ?? null,
  });

  it('semanal: cada 7 días, hasta maxOccurrences', () => {
    const r = generarOcurrencias({ frequency: 'WEEKLY', startDate: '2026-10-05', maxOccurrences: 4 }, '2026-10-01', '2027-12-31');
    expect(r).toEqual({ fechas: ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'], salteadas: [] });
  });

  it('quincenal: cada 14 días', () => {
    expect(generarOcurrencias({ frequency: 'BIWEEKLY', startDate: '2026-10-05', maxOccurrences: 3 }, '2026-10-05', '2027-01-01').fechas)
      .toEqual(['2026-10-05', '2026-10-19', '2026-11-02']);
  });

  it('mensual: mismo día del mes; un mes sin ese día se saltea y cuenta', () => {
    const r = generarOcurrencias({ frequency: 'MONTHLY', startDate: '2027-01-31', maxOccurrences: 4 }, '2027-01-01', '2027-12-31');
    expect(r.fechas).toEqual(['2027-01-31', '2027-03-31']);
    expect(r.salteadas).toEqual([{ fecha: '2027-02-01', motivo: 'no-existe' }, { fecha: '2027-04-01', motivo: 'no-existe' }]);
    expect(enesimaFecha({ frequency: 'MONTHLY', startDate: '2026-11-15' }, 2)).toBe('2027-01-15');
  });

  it('saltea feriados (días especiales cerrados) y vacaciones, e informa el motivo', () => {
    const r = generarOcurrencias(
      { frequency: 'WEEKLY', startDate: '2026-10-05', maxOccurrences: 5 }, '2026-10-05', '2026-12-31',
      { horario: horario({ especiales: [{ fecha: '2026-10-12', tipo: 'CLOSED', tramos: [] }], vacaciones: { desde: '2026-10-25', hasta: '2026-10-31' } }) },
    );
    expect(r.fechas).toEqual(['2026-10-05', '2026-10-19', '2026-11-02']);
    expect(r.salteadas).toEqual([{ fecha: '2026-10-12', motivo: 'dia-especial' }, { fecha: '2026-10-26', motivo: 'vacaciones' }]);
  });

  it('un día especial CON horario no se saltea (atiende, en otro horario)', () => {
    const r = generarOcurrencias(
      { frequency: 'WEEKLY', startDate: '2026-10-05', maxOccurrences: 2 }, '2026-10-05', '2026-12-31',
      { horario: horario({ especiales: [{ fecha: '2026-10-12', tipo: 'SPECIAL', tramos: [[600, 720]] }] }) },
    );
    expect(r.fechas).toEqual(['2026-10-05', '2026-10-12']);
  });

  it('con saltearFeriados: false el feriado queda (el núcleo lo rechaza), pero un día que no abre se saltea igual', () => {
    const conFeriado = generarOcurrencias(
      { frequency: 'WEEKLY', startDate: '2026-10-05', maxOccurrences: 2 }, '2026-10-05', '2026-12-31',
      { horario: horario({ especiales: [{ fecha: '2026-10-12', tipo: 'CLOSED', tramos: [] }] }), saltearFeriados: false },
    );
    expect(conFeriado.fechas).toEqual(['2026-10-05', '2026-10-12']);
    // 2026-10-04 es domingo: el negocio no abre.
    const domingo = generarOcurrencias({ frequency: 'WEEKLY', startDate: '2026-10-04', maxOccurrences: 2 }, '2026-10-01', '2026-12-31', { horario: horario(), saltearFeriados: false });
    expect(domingo).toEqual({ fechas: [], salteadas: [{ fecha: '2026-10-04', motivo: 'no-abre' }, { fecha: '2026-10-11', motivo: 'no-abre' }] });
  });

  it('respeta la ventana [desde, hasta]', () => {
    const r = generarOcurrencias({ frequency: 'WEEKLY', startDate: '2026-10-05', maxOccurrences: 10 }, '2026-10-10', '2026-10-25');
    expect(r.fechas).toEqual(['2026-10-12', '2026-10-19']);
  });
});

describe('Membresías: semana y día de cobro', () => {
  it('la semana va de lunes 00:00 a lunes 00:00 de Argentina', () => {
    const { desde, hasta } = semanaDe(instanteDe('2026-10-07', 900));
    expect(desde.toISOString()).toBe('2026-10-05T03:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-10-12T03:00:00.000Z');
    // El domingo a las 23:59 sigue siendo la misma semana.
    expect(semanaDe(instanteDe('2026-10-11', 1439)).desde.toISOString()).toBe('2026-10-05T03:00:00.000Z');
    // El lunes 00:30 de Argentina (domingo 03:30 UTC) ya es la semana siguiente.
    expect(semanaDe(instanteDe('2026-10-12', 30)).desde.toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('el próximo cobro es el día configurado del mes siguiente (recortado a 28)', () => {
    expect(proximoDiaDeCobro('2026-10-25', 1)).toBe('2026-11-01');
    expect(proximoDiaDeCobro('2026-12-10', 31)).toBe('2027-01-28');
    expect(proximoDiaDeCobro('2026-01-31', 10)).toBe('2026-02-10');
    expect(venceElDia('2026-11-01').toISOString()).toBe('2026-11-02T02:59:00.000Z');
  });

  it('pausada en un instante', () => {
    const m = { pausedFrom: new Date('2026-10-05T00:00:00Z'), pausedUntil: new Date('2026-10-10T00:00:00Z') };
    expect(pausadaEn(m, new Date('2026-10-07T00:00:00Z'))).toBe(true);
    expect(pausadaEn(m, new Date('2026-10-11T00:00:00Z'))).toBe(false);
    expect(pausadaEn({ pausedFrom: null, pausedUntil: null }, new Date())).toBe(false);
  });
});

describe('Fidelidad: la tarjeta de sellos (CONTRATO § P4.5)', () => {
  const avanzada = { ...CONFIG_DE_FABRICA.fidelidad, sellos: 3, suma: 'desde' as const, minimo: 5_000, vencenMeses: 2 };

  it('manda la de Avanzado si actúa; si no, la básica de la cuenta; si no, ninguna', () => {
    expect(reglasTarjeta(avanzada, 10)).toMatchObject({ needed: 3, fuente: 'avanzado' });
    expect(reglasTarjeta(null, 10)).toMatchObject({ needed: 10, fuente: 'basica', suma: 'todos', vencenMeses: 0, premio: { tipo: 'a-convenir' } });
    expect(reglasTarjeta(null, 0)).toBeNull();
  });

  it('al llegar a needed: stamps vuelve a 0 y suma un premio', () => {
    const reglas = reglasTarjeta(avanzada, 0)!;
    const ahora = new Date('2026-10-05T12:00:00Z');
    let t = { stamps: 0, rewardsEarned: 0, lastStampAt: null as Date | null };
    t = conUnSelloMas(t, reglas, 6_000, ahora);
    t = conUnSelloMas(t, reglas, 6_000, ahora);
    const tercero = conUnSelloMas(t, reglas, 6_000, ahora);
    expect(tercero).toMatchObject({ stamps: 0, rewardsEarned: 1, completo: true, sumo: true });
  });

  it('"suma desde $X": un turno más barato no suma', () => {
    const r = conUnSelloMas({ stamps: 1, rewardsEarned: 0, lastStampAt: null }, reglasTarjeta(avanzada, 0)!, 4_999, new Date());
    expect(r).toMatchObject({ stamps: 1, sumo: false });
  });

  it('los sellos vencen a los N meses del último: la tarjeta arranca de nuevo', () => {
    const reglas = reglasTarjeta(avanzada, 0)!;
    const viejo = { stamps: 2, rewardsEarned: 0, lastStampAt: new Date('2026-07-01T12:00:00Z') };
    const ahora = new Date('2026-10-05T12:00:00Z');
    expect(sellosVencidos(viejo, reglas, ahora)).toBe(true);
    expect(conUnSelloMas(viejo, reglas, 6_000, ahora)).toMatchObject({ stamps: 1, completo: false });
    // La básica no vence.
    expect(sellosVencidos(viejo, reglasTarjeta(null, 5)!, ahora)).toBe(false);
  });
});

describe('Catálogo de funciones', () => {
  it('la config guardada se mezcla sobre la de fábrica', () => {
    expect(configDe('gift-cards', { mesesValidez: 12 })).toEqual({ ...CONFIG_DE_FABRICA['gift-cards'], mesesValidez: 12 });
    expect(configDe('turno-fijo', null)).toEqual(CONFIG_DE_FABRICA['turno-fijo']);
    expect(configDe('turno-fijo', 'basura')).toEqual(CONFIG_DE_FABRICA['turno-fijo']);
  });

  it('recomendadas según el rubro, como la demo', () => {
    expect(recomendadasPara(rubroTurnosPorKey('barberia'))).toEqual(expect.arrayContaining(['fidelidad', 'recuperar', 'gift-cards']));
    expect(recomendadasPara(rubroTurnosPorKey('barberia'))).not.toContain('membresias');
    expect(recomendadasPara(rubroTurnosPorKey('gym'))).toContain('membresias');
    expect(recomendadasPara(rubroTurnosPorKey('canchas'))).toEqual(expect.arrayContaining(['turno-fijo', 'precios-horario']));
    expect(recomendadasPara(rubroTurnosPorKey('psico'))).toContain('turno-fijo');
    expect(recomendadasPara(undefined)).toEqual([]);
  });
});

describe('Códigos, teléfonos y montos', () => {
  it('los códigos usan solo el alfabeto sin 0/O/1/I, con el largo pedido, y no se repiten', () => {
    const muestra = Array.from({ length: 3000 }, () => codigoAleatorio(10));
    for (const c of muestra) expect(c).toMatch(new RegExp(`^[${ALFABETO_CODIGOS}]{10}$`));
    expect(muestra.join('')).not.toMatch(/[01OI]/);
    expect(new Set(muestra).size).toBe(muestra.length);
  });

  it('normalizarCodigo tolera minúsculas, espacios y guiones', () => {
    expect(normalizarCodigo(' ab3d-ef 7k ')).toBe('AB3DEF7K');
  });

  it('teléfono: solo dígitos, sin +54, el 9 ni el 0 del área; tapado deja los dos últimos', () => {
    expect(normalizarTelefonoBasico('+54 9 11 5555-0101')).toBe('1155550101');
    expect(normalizarTelefonoBasico('011 5555-0101')).toBe('1155550101');
    expect(normalizarTelefonoBasico(null)).toBe('');
    expect(taparTelefono('1155550101')).toBe('••••••••01');
  });

  it('montos de gift card: los de la lista siempre; libres solo con montoLibre y entre 1.000 y 10.000.000', () => {
    const base = CONFIG_DE_FABRICA['gift-cards'];
    expect(errorMonto({ ...base, montoLibre: false, montos: [20_000] }, 20_000)).toBeNull();
    expect(errorMonto({ ...base, montoLibre: false, montos: [20_000] }, 15_000)).toMatch(/Elegí uno de los montos/);
    expect(errorMonto({ ...base, montoLibre: false, montos: [] }, 15_000)).toMatch(/todavía no cargó montos/);
    expect(errorMonto({ ...base, montoLibre: true }, 999)).toMatch(/entre/);
    expect(errorMonto({ ...base, montoLibre: true }, 10_000_001)).toMatch(/entre/);
    expect(errorMonto({ ...base, montoLibre: true }, 1_000)).toBeNull();
  });

  it('vencimiento de gift card: compra + meses; 0 = no vence', () => {
    expect(venceA(new Date('2026-10-05T12:00:00Z'), 6)?.toISOString()).toBe('2027-04-05T12:00:00.000Z');
    expect(venceA(new Date(), 0)).toBeNull();
  });

  it('variables del mensaje de "Recuperar clientes"', () => {
    expect(variablesDesconocidas('Hola {nombre}, te esperamos en {negocio} para {servicio}: {link}')).toEqual([]);
    expect(variablesDesconocidas('Hola {nombre} {apellido}')).toEqual(['apellido']);
  });
});
