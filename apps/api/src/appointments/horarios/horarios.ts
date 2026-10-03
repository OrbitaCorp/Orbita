// Horarios de un negocio de turnos: utilidades PURAS (sin Prisma, sin reloj).
//
// Un negocio atiende de mañana y de tarde: hasta dos tramos por día, con el
// corte del mediodía en el medio. Es el mismo modelo que la demo
// (apps/web/src/modules/turnos/horario.ts), con una diferencia: acá la semana
// viaja ESTRUCTURADA, no como texto. Pasar de "09:00 – 13:00 · 16:00 – 20:00"
// a [[540, 780], [960, 1200]] es problema del frontend.
//
// Convenciones (las mismas en todo el módulo appointments):
// - Minutos desde las 00:00 de Argentina. Un tramo es [desde, hasta), con
//   0 <= desde < hasta <= 1440. No hay tramos que crucen la medianoche.
// - Día de la semana: 0 = lunes … 6 = domingo.
// - Fecha: "YYYY-MM-DD" del día argentino.
// - Argentina es -03:00 fijo (sin horario de verano desde 2009): ver
//   common/utils/hora-argentina.ts.
import { fechaArgentina, inicioDeDiaArgentina } from '../../common/utils/hora-argentina';

/** [desde, hasta) en minutos desde las 00:00 de Argentina. */
export type Tramo = [number, number];
/** Los siete días, de lunes (0) a domingo (6). [] = ese día está cerrado. */
export type SemanaTurnos = Tramo[][];

export const MINUTOS_DEL_DIA = 24 * 60;
export const MAX_TRAMOS_POR_DIA = 2;
const MS_MINUTO = 60_000;

// ─── Fechas y horas de Argentina ─────────────────────────────────────────────

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" de un día que existe (rechaza 2026-02-30). */
export function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !RE_FECHA.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/** Día de la semana de una fecha: 0 = lunes … 6 = domingo. */
export function diaDeSemana(fecha: string): number {
  // Al mediodía UTC el día calendario es el mismo en cualquier zona.
  return (new Date(`${fecha}T12:00:00.000Z`).getUTCDay() + 6) % 7;
}

/** La fecha `dias` días después (o antes, con negativo). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días que hay de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00.000Z`) - Date.parse(`${desde}T12:00:00.000Z`)) / (24 * 60 * MS_MINUTO));
}

/** El instante (UTC) de una hora del día argentino: instanteDe('2026-10-05', 600) = 10:00 de Argentina = 13:00 UTC. */
export function instanteDe(fecha: string, minutos: number): Date {
  return new Date(inicioDeDiaArgentina(fecha).getTime() + minutos * MS_MINUTO);
}

/** En qué día argentino cae un instante y a qué hora (minutos desde las 00:00). */
export function fechaYMinutos(instante: Date): { fecha: string; minutos: number } {
  const fecha = fechaArgentina(instante);
  return { fecha, minutos: Math.floor((instante.getTime() - inicioDeDiaArgentina(fecha).getTime()) / MS_MINUTO) };
}

/** Los minutos de un instante medidos desde las 00:00 de `fecha` (puede dar negativo o más de 1440 si es de otro día). */
export function minutosDesde(fecha: string, instante: Date): number {
  return (instante.getTime() - inicioDeDiaArgentina(fecha).getTime()) / MS_MINUTO;
}

/** "09:30" a partir de 570. */
export function hhmm(minutos: number): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}

// ─── Tramos ──────────────────────────────────────────────────────────────────

const esMinuto = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MINUTOS_DEL_DIA;

/**
 * Qué le falta a la lista de tramos de UN día para poder guardarse, en
 * palabras. null = está bien. [] (cerrado) siempre es válido.
 *
 * Es la validación de `errorJornada` de la demo llevada al formato de tramos:
 * mismas reglas, mismos mensajes.
 */
export function errorTramos(tramos: unknown): string | null {
  if (!Array.isArray(tramos)) return 'El horario de un día tiene que ser una lista de tramos.';
  if (tramos.length > MAX_TRAMOS_POR_DIA) return 'Un día tiene como máximo dos tramos: la mañana y la tarde.';
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i];
    if (!Array.isArray(t) || t.length !== 2 || !esMinuto(t[0]) || !esMinuto(t[1])) {
      return 'Cada tramo son dos horas del día (apertura y cierre), en minutos de 0 a 1440.';
    }
    if (t[1] <= t[0]) {
      // Con un solo tramo no se sabe si es "la mañana" o "la tarde": se nombra por su hora.
      const tarde = tramos.length === 2 ? i === 1 : t[0] >= 13 * 60;
      return `A la ${tarde ? 'tarde' : 'mañana'}, el cierre tiene que ser después de la apertura.`;
    }
  }
  if (tramos.length === 2 && tramos[1][0] < tramos[0][1]) return 'La tarde tiene que empezar cuando termina la mañana, o después.';
  return null;
}

/** Qué le falta a una semana para poder guardarse. null = está bien. */
export function errorSemana(semana: unknown, opciones: { exigirUnDiaAbierto?: boolean } = {}): string | null {
  if (!Array.isArray(semana) || semana.length !== 7) return 'La semana tiene que traer los siete días, de lunes a domingo.';
  const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  for (let i = 0; i < 7; i++) {
    const error = errorTramos(semana[i]);
    if (error) return `El ${NOMBRES[i]}: ${error}`;
  }
  if (opciones.exigirUnDiaAbierto && semana.every((d) => (d as Tramo[]).length === 0)) return 'Dejá abierto al menos un día de la semana.';
  return null;
}

/**
 * Lee una semana guardada como Json. Lo que no se entiende queda cerrado: una
 * fila vieja o rota nunca tiene que abrir la agenda fuera de horario.
 */
export function leerSemana(json: unknown): SemanaTurnos {
  const dias = Array.isArray(json) ? json : [];
  return Array.from({ length: 7 }, (_, i) => leerTramos(dias[i]));
}

/** Lee la lista de tramos de un día guardada como Json. Inválida = [] (cerrado). */
export function leerTramos(json: unknown): Tramo[] {
  if (errorTramos(json) !== null) return [];
  return (json as Tramo[]).map(([a, b]) => [a, b] as Tramo).sort((x, y) => x[0] - y[0]);
}

/** Los tramos de un día de la semana (0 = lunes). */
export const tramosDelDia = (semana: SemanaTurnos, dia: number): Tramo[] => semana[dia] ?? [];

/** Lo que tienen en común dos listas de tramos: cuándo atiende alguien DENTRO del horario del negocio. */
export function cruzar(a: Tramo[], b: Tramo[]): Tramo[] {
  const salida: Tramo[] = [];
  for (const [a0, a1] of a) {
    for (const [b0, b1] of b) {
      const desde = Math.max(a0, b0);
      const hasta = Math.min(a1, b1);
      if (hasta > desde) salida.push([desde, hasta]);
    }
  }
  return salida.sort((x, y) => x[0] - y[0]);
}

export const abiertoA = (tramos: Tramo[], minutos: number): boolean => tramos.some(([a, b]) => minutos >= a && minutos < b);
export const minutosAbiertos = (tramos: Tramo[]): number => tramos.reduce((suma, [a, b]) => suma + (b - a), 0);

/** El corte del mediodía de un día partido, o null si atiende de un tirón. */
export function corteDe(tramos: Tramo[]): Tramo | null {
  for (let i = 1; i < tramos.length; i++) {
    if (tramos[i][0] > tramos[i - 1][1]) return [tramos[i - 1][1], tramos[i][0]];
  }
  return null;
}

/** Los días de la semana que abre (0 = lunes). */
export const diasAbiertos = (semana: SemanaTurnos): number[] => semana.map((t, i) => (t.length > 0 ? i : -1)).filter((i) => i >= 0);

/** Desde la primera apertura hasta el último cierre de toda la semana (para dibujar la grilla). */
export function extremos(semana: SemanaTurnos, porDefecto: Tramo = [9 * 60, 20 * 60]): Tramo {
  const todos = semana.flat();
  if (todos.length === 0) return porDefecto;
  return [Math.min(...todos.map((t) => t[0])), Math.max(...todos.map((t) => t[1]))];
}

/** Cómo está el negocio a una hora: abierto (y hasta cuándo) o cerrado (y a qué hora vuelve a abrir ese día). */
export function estadoA(tramos: Tramo[], minutos: number): { abierto: boolean; cierraMin: number | null; abreMin: number | null } {
  const actual = tramos.find(([a, b]) => minutos >= a && minutos < b);
  const proximo = tramos.find(([a]) => a > minutos);
  return { abierto: !!actual, cierraMin: actual ? actual[1] : null, abreMin: !actual && proximo ? proximo[0] : null };
}

// ─── Mañana y tarde (el formulario de la demo) ───────────────────────────────
// La demo edita cada día como dos bloques que se prenden y se apagan. La API
// guarda tramos; esto es el puente, con la validación original.

export interface Bloque { on: boolean; desde: number; hasta: number }
export interface Jornada { manana: Bloque; tarde: Bloque }

export const tramosDeJornada = (j: Jornada): Tramo[] =>
  [j.manana, j.tarde].filter((b) => b.on && b.hasta > b.desde).map((b) => [b.desde, b.hasta] as Tramo);

/** Qué le falta a una jornada para poder guardarse, en palabras. null = está bien. (Copia de la demo.) */
export function errorJornada(j: Jornada): string | null {
  if (!j.manana.on && !j.tarde.on) return 'Dejá prendido al menos un turno: la mañana o la tarde.';
  if (j.manana.on && j.manana.hasta <= j.manana.desde) return 'A la mañana, el cierre tiene que ser después de la apertura.';
  if (j.tarde.on && j.tarde.hasta <= j.tarde.desde) return 'A la tarde, el cierre tiene que ser después de la apertura.';
  if (j.manana.on && j.tarde.on && j.tarde.desde < j.manana.hasta) return 'La tarde tiene que empezar cuando termina la mañana, o después.';
  return null;
}

// ─── El horario de un día concreto ───────────────────────────────────────────

export interface DiaEspecial {
  /** YYYY-MM-DD. */
  fecha: string;
  tipo: 'CLOSED' | 'SPECIAL';
  /** Solo con SPECIAL: el horario de ese día. */
  tramos: Tramo[];
}

export interface Vacaciones {
  /** YYYY-MM-DD, inclusive. */
  desde: string;
  /** YYYY-MM-DD, inclusive. */
  hasta: string;
}

export interface HorarioNegocio {
  semana: SemanaTurnos;
  especiales: DiaEspecial[];
  /** null = no hay vacaciones cargadas (o están apagadas). */
  vacaciones: Vacaciones | null;
}

export type MotivoCerrado = 'vacaciones' | 'dia-especial' | 'no-abre';

/**
 * Los tramos en que el NEGOCIO atiende una fecha. Manda, en este orden: las
 * vacaciones (cerrado), el día especial de esa fecha (cerrado u otro horario)
 * y, si no hay nada de eso, el horario de ese día de la semana.
 */
export function tramosDelNegocio(horario: HorarioNegocio, fecha: string): Tramo[] {
  return horarioDelNegocio(horario, fecha).tramos;
}

/** Igual que tramosDelNegocio, diciendo además por qué está cerrado (para mostrárselo al cliente). */
export function horarioDelNegocio(horario: HorarioNegocio, fecha: string): { tramos: Tramo[]; motivo: MotivoCerrado | null } {
  const v = horario.vacaciones;
  if (v && fecha >= v.desde && fecha <= v.hasta) return { tramos: [], motivo: 'vacaciones' };
  const especial = horario.especiales.find((e) => e.fecha === fecha);
  if (especial) {
    const tramos = especial.tipo === 'CLOSED' ? [] : especial.tramos;
    return { tramos, motivo: tramos.length === 0 ? 'dia-especial' : null };
  }
  const tramos = tramosDelDia(horario.semana, diaDeSemana(fecha));
  return { tramos, motivo: tramos.length === 0 ? 'no-abre' : null };
}

export interface AgendaRecurso {
  /** Días que atiende (0 = lunes). */
  workDays: number[];
  /** Horario propio; null = sigue al del negocio. */
  ownSchedule: SemanaTurnos | null;
}

/**
 * Los tramos en que una agenda (persona o espacio) atiende una fecha: siempre
 * DENTRO del horario del negocio de ese día. [] = ese día no atiende.
 */
export function tramosDelRecurso(recurso: AgendaRecurso, tramosNegocio: Tramo[], fecha: string): Tramo[] {
  const dia = diaDeSemana(fecha);
  if (!recurso.workDays.includes(dia)) return [];
  return recurso.ownSchedule ? cruzar(tramosNegocio, tramosDelDia(recurso.ownSchedule, dia)) : tramosNegocio;
}
