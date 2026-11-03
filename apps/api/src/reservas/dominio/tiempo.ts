// Fechas y horas de las reservas. Todo lo que el negocio y el cliente ven es
// hora de Argentina: un día "AAAA-MM-DD" y minutos desde las 00:00. La base
// guarda instantes (UTC). Acá viven las dos traducciones y las cuentas con
// tramos del día, puras y sin leer el reloj: el "ahora" entra como parámetro.
import { diaYHoraArgentina, fechaArgentina, inicioDeDiaArgentina } from '../../common/utils/hora-argentina';

/** [desde, hasta) en minutos desde las 00:00 del día. */
export type Tramo = [number, number];

export const MINUTOS_DIA = 24 * 60;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" que existe en el calendario (el 31/02 no). */
export function esFecha(x: unknown): x is string {
  if (typeof x !== 'string' || !RE_FECHA.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}

/** El instante de un día de Argentina a tantos minutos de las 00:00 (puede pasar de 1440: sigue al día siguiente). */
export function instante(fecha: string, minutos: number): Date {
  return new Date(inicioDeDiaArgentina(fecha).getTime() + minutos * 60_000);
}

/** El día de Argentina en que cae un instante y los minutos desde sus 00:00. */
export function fechaYMinutos(d: Date): { fecha: string; minutos: number } {
  const fecha = fechaArgentina(d);
  const { hhmm } = diaYHoraArgentina(d);
  const [h, m] = hhmm.split(':').map(Number);
  return { fecha, minutos: h * 60 + m };
}

/** 0 = domingo … 6 = sábado, del día de Argentina (mismo criterio que Discount.activeDays). */
export function diaDeSemana(fecha: string): number {
  return diaYHoraArgentina(instante(fecha, 12 * 60)).dia;
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días calendario entre dos fechas (noches entre un check-in y un check-out). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10)) - Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10))) / 86_400_000);
}

/** "09:30" */
export function hhmm(minutos: number): string {
  const m = ((minutos % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Dos tramos se pisan si comparten al menos un minuto. Tocarse en el borde no es pisarse. */
export const seSolapan = (a: Tramo, b: Tramo): boolean => a[0] < b[1] && b[0] < a[1];

export const tramoValido = (t: unknown): t is Tramo =>
  Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1]) && t[0] >= 0 && t[1] <= MINUTOS_DIA && t[1] > t[0];

/** Une tramos que se tocan o se pisan, ordenados. */
export function unir(tramos: Tramo[]): Tramo[] {
  const orden = [...tramos].filter(tramoValido).sort((a, b) => a[0] - b[0]);
  const out: Tramo[] = [];
  for (const t of orden) {
    const ultimo = out[out.length - 1];
    if (ultimo && t[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], t[1]);
    else out.push([t[0], t[1]]);
  }
  return out;
}

/** Lo que queda de `base` después de sacarle `quitar`. */
export function restar(base: Tramo, quitar: Tramo[]): Tramo[] {
  let libres: Tramo[] = [base];
  for (const q of unir(quitar)) {
    libres = libres.flatMap((l) => {
      if (!seSolapan(l, q)) return [l];
      const out: Tramo[] = [];
      if (q[0] > l[0]) out.push([l[0], q[0]]);
      if (q[1] < l[1]) out.push([q[1], l[1]]);
      return out;
    });
  }
  return libres;
}

/**
 * Qué parte de un rango de instantes cae dentro de un día de Argentina, en
 * minutos de ese día; null si no lo toca. Una reserva de 23:00 a 01:00 aporta
 * [1380, 1440) a su día y [0, 60) al siguiente.
 */
export function tramoEnElDia(inicio: Date, fin: Date, fecha: string): Tramo | null {
  const cero = inicioDeDiaArgentina(fecha).getTime();
  const desde = Math.max(0, Math.round((inicio.getTime() - cero) / 60_000));
  const hasta = Math.min(MINUTOS_DIA, Math.round((fin.getTime() - cero) / 60_000));
  return hasta > desde ? [desde, hasta] : null;
}
