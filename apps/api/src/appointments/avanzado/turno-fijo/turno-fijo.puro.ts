// Turno fijo (P4.6): qué fechas tiene una serie. PURO: sin Prisma ni reloj.
import type { AppointmentRecurrence } from '@prisma/client';
import { HorarioNegocio, MotivoCerrado, horarioDelNegocio, sumarDias } from '../../horarios/horarios';

export interface SerieTurnoFijo {
  frequency: AppointmentRecurrence;
  /** Primer turno de la serie (YYYY-MM-DD). */
  startDate: string;
  /** Cuántos turnos tiene la serie en total, contando desde startDate (los salteados también cuentan). */
  maxOccurrences: number;
}

export type MotivoSalteada = MotivoCerrado | 'no-existe';

export interface Ocurrencias {
  /** Las fechas en que hay que dar el turno, en orden. */
  fechas: string[];
  /** Las que tocaban pero no van (feriado, vacaciones, día que no abre, 31 en un mes de 30). */
  salteadas: { fecha: string; motivo: MotivoSalteada }[];
}

/** La n-ésima fecha de la serie (n = 0 es startDate). null si ese mes no tiene ese día (mensual del 31). */
export function enesimaFecha(serie: Pick<SerieTurnoFijo, 'frequency' | 'startDate'>, n: number): string | null {
  if (serie.frequency === 'WEEKLY') return sumarDias(serie.startDate, 7 * n);
  if (serie.frequency === 'BIWEEKLY') return sumarDias(serie.startDate, 14 * n);
  const [y, m, d] = serie.startDate.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1 + n, d, 12));
  // Mismo día del mes: si el mes no lo tiene (Date "se pasa" al mes siguiente), esa vez no hay turno.
  if (f.getUTCDate() !== d) return null;
  return f.toISOString().slice(0, 10);
}

/**
 * Las fechas de la serie entre `desde` y `hasta` (inclusive). Con `horario`,
 * saltea siempre los días de la semana que el negocio no abre y, salvo
 * `saltearFeriados: false` (config de la función), también las vacaciones y
 * los días especiales cerrados (feriados). Con `saltearFeriados: false` esos
 * quedan en `fechas`: el núcleo los rechaza al dar el turno y se informan
 * igual como salteados.
 */
export function generarOcurrencias(
  serie: SerieTurnoFijo,
  desde: string,
  hasta: string,
  opciones: { horario?: HorarioNegocio; saltearFeriados?: boolean } = {},
): Ocurrencias {
  const salida: Ocurrencias = { fechas: [], salteadas: [] };
  for (let n = 0; n < serie.maxOccurrences; n++) {
    const fecha = enesimaFecha(serie, n);
    if (fecha && fecha > hasta) break;
    if (!fecha) {
      // Solo pasa en mensual: se informa con el primer día del mes que no lo tiene.
      const [y, m] = serie.startDate.split('-').map(Number);
      const mes = new Date(Date.UTC(y, m - 1 + n, 1, 12)).toISOString().slice(0, 10);
      if (mes >= desde && mes <= hasta) salida.salteadas.push({ fecha: mes, motivo: 'no-existe' });
      continue;
    }
    if (fecha < desde) continue;
    if (opciones.horario) {
      const { motivo } = horarioDelNegocio(opciones.horario, fecha);
      if (motivo && (opciones.saltearFeriados !== false || motivo === 'no-abre')) {
        salida.salteadas.push({ fecha, motivo });
        continue;
      }
    }
    salida.fechas.push(fecha);
  }
  return salida;
}
