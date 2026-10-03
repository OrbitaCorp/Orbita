// Membresías (P4.2): cuentas PURAS de fechas.
import { fechaArgentina } from '../../../common/utils/hora-argentina';
import { diaDeSemana, instanteDe, sumarDias } from '../../horarios/horarios';

/** La semana (lunes 00:00 a lunes siguiente 00:00, hora argentina) que contiene a `instante`. */
export function semanaDe(instante: Date): { desde: Date; hasta: Date } {
  const fecha = fechaArgentina(instante);
  const lunes = sumarDias(fecha, -diaDeSemana(fecha));
  return { desde: instanteDe(lunes, 0), hasta: instanteDe(sumarDias(lunes, 7), 0) };
}

/** "YYYY-MM-DD" del día `dia` del mes siguiente al de `fecha` (el día se recorta a 28 para que exista siempre). */
export function proximoDiaDeCobro(fecha: string, diaCobro: number): string {
  const [y, m] = fecha.split('-').map(Number);
  const dia = Math.min(Math.max(Math.trunc(diaCobro) || 1, 1), 28);
  const siguiente = new Date(Date.UTC(y, m, dia, 12));
  return siguiente.toISOString().slice(0, 10);
}

/** El vencimiento de la cuota: el final (23:59 de Argentina) del día de cobro. */
export const venceElDia = (fecha: string): Date => instanteDe(fecha, 23 * 60 + 59);

/** ¿La membresía está pausada en ese instante? */
export const pausadaEn = (m: { pausedFrom: Date | null; pausedUntil: Date | null }, instante: Date): boolean =>
  !!m.pausedUntil && instante.getTime() <= m.pausedUntil.getTime() && (!m.pausedFrom || instante.getTime() >= m.pausedFrom.getTime());
