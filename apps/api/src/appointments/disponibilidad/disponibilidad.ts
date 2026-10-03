// Motor de disponibilidad de Turnos: PURO. No toca Prisma ni lee el reloj:
// recibe la configuración, los horarios, los turnos que ya existen y "ahora",
// y devuelve los horarios libres. Así la misma cuenta sirve para lo que ve el
// cliente en el sitio, para "Nuevo turno" y "Mover" del panel, y para validar
// una reserva en el servidor antes de guardarla (quien reserva manda una hora;
// el servidor no le cree: vuelve a calcular y mira si esa hora está).
//
// Reglas que aplica, todas de verdad:
//   - Horario: el del negocio ese día (vacaciones y días especiales incluidos)
//     cruzado con los días y el horario propio de cada agenda.
//   - Grilla: los turnos arrancan cada `slotMin` minutos, contados desde la
//     apertura de cada tramo (un negocio que abre 9:15 con grilla de 30 ofrece
//     9:15, 9:45…). Un turno tiene que TERMINAR antes del cierre del tramo, o
//     justo en el cierre.
//   - Solapamiento: [inicio, fin) contra los turnos existentes del recurso.
//     Semiabierto: uno que termina 10:30 no choca con otro que empieza 10:30.
//   - Margen (`bufferMin`): tiempo libre obligatorio entre un turno y el
//     siguiente, de los dos lados. No se exige contra la apertura ni el cierre.
//   - Anticipación mínima: no se ofrece nada que empiece antes de
//     ahora + `minAdvanceMin`.
//   - Anticipación máxima: no se ofrece nada más allá de hoy + `maxAdvanceDays`
//     (días calendario de Argentina).
//   - Pasado: un día anterior a hoy no tiene horarios; hoy, solo de ahora en más.
//   - "Cualquiera": para cada hora, el recurso con lugar que menos cargado esté
//     ese día.
//
// Qué NO hace (lo hace el service, que tiene la base): el límite de turnos
// activos por cliente, la seña, la confirmación manual y el chequeo final
// dentro de la transacción.
import { fechaArgentina } from '../../common/utils/hora-argentina';
import {
  AgendaRecurso, HorarioNegocio, MotivoCerrado, Tramo,
  diasEntre, horarioDelNegocio, instanteDe, minutosDesde, sumarDias, tramosDelRecurso,
} from '../horarios/horarios';

export const CUALQUIERA = 'cualquiera';

export interface ReglasDisponibilidad {
  /** Grilla: cada cuántos minutos arranca un turno. */
  slotMin: number;
  /** Margen libre entre un turno y el siguiente, en minutos. */
  bufferMin: number;
  /** Anticipación mínima para reservar, en minutos. 0 = sin mínimo. */
  minAdvanceMin: number;
  /** Hasta cuántos días adelante se puede reservar. */
  maxAdvanceDays: number;
}

export interface RecursoDisponibilidad extends AgendaRecurso {
  id: string;
}

/** Un turno que ocupa lugar: cualquiera que NO esté cancelado. */
export interface TurnoOcupado {
  id?: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface ContextoDisponibilidad {
  reglas: ReglasDisponibilidad;
  horario: HorarioNegocio;
  /** Las agendas donde se puede dar el turno, en el orden en que se muestran. */
  recursos: RecursoDisponibilidad[];
  /** Los turnos no cancelados que tocan el rango que se consulta. Pueden venir de más (otros días, otros recursos). */
  turnos: TurnoOcupado[];
  ahora: Date;
  /**
   * 'publico' (el sitio): aplica anticipación mínima y máxima.
   * 'panel': quien atiende el mostrador puede dar un turno para dentro de 5
   * minutos o para dentro de un año; solo se respeta que no sea en el pasado.
   */
  modo?: 'publico' | 'panel';
  /** Id del turno que se está moviendo: no se cuenta como ocupado (si no, chocaría consigo mismo). */
  salvo?: string;
}

export interface HorarioLibre {
  /** Minutos desde las 00:00 de Argentina. */
  inicioMin: number;
  startsAt: Date;
  endsAt: Date;
  /** La agenda donde cae. Con "cualquiera", la que eligió el motor. */
  resourceId: string;
}

export type MotivoSinHorarios = MotivoCerrado | 'pasado' | 'fuera-de-ventana' | 'no-atiende' | 'completo';

export interface DisponibilidadDia {
  fecha: string;
  /** El negocio no atiende ese día (o esa agenda no atiende). */
  cerrado: boolean;
  /** Por qué no hay horarios; null si los hay. */
  motivo: MotivoSinHorarios | null;
  horarios: HorarioLibre[];
}

const MS_MINUTO = 60_000;

/** Los turnos de un recurso como intervalos en minutos del día consultado. */
function ocupadosDe(ctx: ContextoDisponibilidad, resourceId: string, fecha: string): Tramo[] {
  return ctx.turnos
    .filter((t) => t.resourceId === resourceId && (!ctx.salvo || t.id !== ctx.salvo))
    .map((t) => [minutosDesde(fecha, t.startsAt), minutosDesde(fecha, t.endsAt)] as Tramo)
    // Lo que no toca este día (ni con el margen) no molesta; se descarta para no recorrerlo en cada hora.
    .filter(([a, b]) => b + ctx.reglas.bufferMin > 0 && a - ctx.reglas.bufferMin < 24 * 60);
}

/** Por qué una fecha entera queda afuera, antes de mirar ninguna agenda. null = se puede mirar. */
function fechaFuera(ctx: ContextoDisponibilidad, fecha: string): 'pasado' | 'fuera-de-ventana' | null {
  const hoy = fechaArgentina(ctx.ahora);
  if (fecha < hoy) return 'pasado';
  if (ctx.modo !== 'panel' && diasEntre(hoy, fecha) > ctx.reglas.maxAdvanceDays) return 'fuera-de-ventana';
  return null;
}

/** Los horarios libres de UNA agenda en una fecha, dados sus tramos de ese día. */
function libresEn(ctx: ContextoDisponibilidad, resourceId: string, tramos: Tramo[], fecha: string, duracionMin: number): HorarioLibre[] {
  const { slotMin, bufferMin, minAdvanceMin } = ctx.reglas;
  if (duracionMin <= 0 || slotMin <= 0) return [];
  const ocupados = ocupadosDe(ctx, resourceId, fecha);
  const desdeCuando = ctx.ahora.getTime() + (ctx.modo === 'panel' ? 0 : minAdvanceMin) * MS_MINUTO;
  const libres: HorarioLibre[] = [];
  for (const [abre, cierra] of tramos) {
    for (let m = abre; m + duracionMin <= cierra; m += slotMin) {
      const startsAt = instanteDe(fecha, m);
      if (startsAt.getTime() < desdeCuando) continue;
      const fin = m + duracionMin;
      if (ocupados.some(([a, b]) => m < b + bufferMin && fin + bufferMin > a)) continue;
      libres.push({ inicioMin: m, startsAt, endsAt: instanteDe(fecha, fin), resourceId });
    }
  }
  return libres;
}

/** Minutos que una agenda ya tiene tomados en una fecha (para elegir a la menos cargada). */
function cargaDe(ctx: ContextoDisponibilidad, resourceId: string, fecha: string): number {
  return ocupadosDe(ctx, resourceId, fecha).reduce((suma, [a, b]) => suma + (Math.min(b, 24 * 60) - Math.max(a, 0)), 0);
}

/**
 * Los horarios libres de un día para un servicio de `duracionMin` minutos.
 *
 * `resourceId` es una agenda puntual o CUALQUIERA. Con CUALQUIERA sale una
 * sola entrada por hora, asignada a la agenda con lugar que menos minutos
 * tiene tomados ese día; si empatan, a la primera en el orden de `recursos`.
 */
export function disponibilidadDelDia(ctx: ContextoDisponibilidad, fecha: string, duracionMin: number, resourceId: string = CUALQUIERA): DisponibilidadDia {
  const fuera = fechaFuera(ctx, fecha);
  if (fuera) return { fecha, cerrado: false, motivo: fuera, horarios: [] };

  const negocio = horarioDelNegocio(ctx.horario, fecha);
  if (negocio.tramos.length === 0) return { fecha, cerrado: true, motivo: negocio.motivo, horarios: [] };

  const candidatos = resourceId === CUALQUIERA ? ctx.recursos : ctx.recursos.filter((r) => r.id === resourceId);
  const conAgenda = candidatos
    .map((r) => ({ id: r.id, tramos: tramosDelRecurso(r, negocio.tramos, fecha) }))
    .filter((r) => r.tramos.length > 0);
  if (conAgenda.length === 0) return { fecha, cerrado: true, motivo: 'no-atiende', horarios: [] };

  const porRecurso = conAgenda.map((r) => libresEn(ctx, r.id, r.tramos, fecha, duracionMin));

  let horarios: HorarioLibre[];
  if (conAgenda.length === 1) {
    horarios = porRecurso[0];
  } else {
    // Una entrada por hora: la de la agenda menos cargada. El orden de
    // `recursos` desempata, y como se recorre en ese orden y solo se reemplaza
    // con una carga ESTRICTAMENTE menor, el primero gana los empates.
    const carga = conAgenda.map((r) => cargaDe(ctx, r.id, fecha));
    const elegido = new Map<number, { h: HorarioLibre; carga: number }>();
    porRecurso.forEach((libres, i) => {
      for (const h of libres) {
        const actual = elegido.get(h.inicioMin);
        if (!actual || carga[i] < actual.carga) elegido.set(h.inicioMin, { h, carga: carga[i] });
      }
    });
    horarios = [...elegido.values()].map((x) => x.h).sort((a, b) => a.inicioMin - b.inicioMin);
  }
  return { fecha, cerrado: false, motivo: horarios.length === 0 ? 'completo' : null, horarios };
}

/** Atajo: solo la lista de horarios libres. */
export function horariosLibres(ctx: ContextoDisponibilidad, fecha: string, duracionMin: number, resourceId: string = CUALQUIERA): HorarioLibre[] {
  return disponibilidadDelDia(ctx, fecha, duracionMin, resourceId).horarios;
}

/**
 * ¿Se puede dar un turno a esa hora? Es lo que usa el service para validar una
 * reserva: no confía en la hora que manda el cliente, la busca entre las que
 * el motor ofrecería. Devuelve el horario (con la agenda asignada si se pidió
 * CUALQUIERA) o null.
 */
export function horarioSiEstaLibre(ctx: ContextoDisponibilidad, fecha: string, inicioMin: number, duracionMin: number, resourceId: string = CUALQUIERA): HorarioLibre | null {
  return horariosLibres(ctx, fecha, duracionMin, resourceId).find((h) => h.inicioMin === inicioMin) ?? null;
}

export interface ResumenDia {
  fecha: string;
  cerrado: boolean;
  motivo: MotivoSinHorarios | null;
  /** Cuántos horarios libres tiene el día. */
  libres: number;
  /** El primero, en minutos; null si no hay. */
  primeroMin: number | null;
}

/**
 * La disponibilidad de un rango de fechas (inclusive), un renglón por día:
 * lo que necesita el calendario para pintar qué días tienen lugar. Tope de 62
 * días por pedido para que nadie pida un año entero.
 */
export function disponibilidadPorRango(ctx: ContextoDisponibilidad, desde: string, hasta: string, duracionMin: number, resourceId: string = CUALQUIERA): ResumenDia[] {
  const dias = Math.min(diasEntre(desde, hasta), MAX_DIAS_RANGO - 1);
  const salida: ResumenDia[] = [];
  for (let i = 0; i <= dias; i++) {
    const d = disponibilidadDelDia(ctx, sumarDias(desde, i), duracionMin, resourceId);
    salida.push({ fecha: d.fecha, cerrado: d.cerrado, motivo: d.motivo, libres: d.horarios.length, primeroMin: d.horarios[0]?.inicioMin ?? null });
  }
  return salida;
}

export const MAX_DIAS_RANGO = 62;

/** El primer horario libre a partir de hoy, mirando hasta `dias` días (lo que muestra "Próximo turno: mañana 10:30"). */
export function primerHorarioLibre(ctx: ContextoDisponibilidad, duracionMin: number, resourceId: string = CUALQUIERA, dias = 21): HorarioLibre | null {
  const hoy = fechaArgentina(ctx.ahora);
  for (let i = 0; i <= dias; i++) {
    const h = horariosLibres(ctx, sumarDias(hoy, i), duracionMin, resourceId)[0];
    if (h) return h;
  }
  return null;
}
