// El horario semanal de un negocio o de un recurso: por día de la semana (0 =
// domingo … 6 = sábado), los tramos en que se atiende, en minutos desde las
// 00:00 de Argentina. Un día sin clave o con lista vacía está cerrado.
//
//   { "1": [[540, 780], [900, 1200]], "2": [[540, 1200]], "6": [[600, 840]] }
//
// En una CLASE (Gimnasio) cada tramo es una sesión completa: lunes [[1140,
// 1200]] es la clase de los lunes de 19:00 a 20:00.
import { diaDeSemana, tramoValido, unir, type Tramo } from './tiempo';

export type HorarioSemanal = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', Tramo[]>>;

const DIAS = ['0', '1', '2', '3', '4', '5', '6'] as const;

/**
 * Mensaje de error si el horario no tiene la forma esperada; null si está
 * bien. Pensado para mostrarse tal cual (400).
 */
export function errorDeHorario(h: unknown, opciones: { sesiones?: boolean } = {}): string | null {
  if (h === null || typeof h !== 'object' || Array.isArray(h)) return 'El horario tiene que ser un objeto con los días de la semana (0 a 6).';
  const obj = h as Record<string, unknown>;
  let abiertos = 0;
  for (const clave of Object.keys(obj)) {
    if (!(DIAS as readonly string[]).includes(clave)) return `El día "${clave}" no existe: los días van del 0 (domingo) al 6 (sábado).`;
    const tramos = obj[clave];
    if (!Array.isArray(tramos)) return `El día ${clave} tiene que ser una lista de tramos [desde, hasta] en minutos.`;
    if (tramos.length > 24) return `El día ${clave} tiene demasiados tramos.`;
    for (const t of tramos) {
      if (!tramoValido(t)) return `El día ${clave} tiene un tramo inválido: tiene que ser [desde, hasta] en minutos, con 0 ≤ desde < hasta ≤ 1440.`;
    }
    const ordenados = [...(tramos as Tramo[])].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ordenados.length; i++) {
      if (ordenados[i][0] < ordenados[i - 1][1]) {
        return opciones.sesiones
          ? `El día ${clave} tiene dos sesiones que se pisan.`
          : `El día ${clave} tiene dos tramos que se pisan.`;
      }
    }
    if (tramos.length > 0) abiertos++;
  }
  if (abiertos === 0) return 'El horario tiene que tener al menos un día abierto.';
  return null;
}

/** Los tramos abiertos de un día concreto (ordenados y sin pisarse). Vacío = cerrado. */
export function aperturaDelDia(h: HorarioSemanal | null | undefined, fecha: string): Tramo[] {
  if (!h) return [];
  const dia = String(diaDeSemana(fecha)) as keyof HorarioSemanal;
  return unir(h[dia] ?? []);
}

/** Las sesiones de un día (CLASE): cada tramo tal cual, ordenado, sin unir las que se tocan. */
export function sesionesDelDia(h: HorarioSemanal | null | undefined, fecha: string): Tramo[] {
  if (!h) return [];
  const dia = String(diaDeSemana(fecha)) as keyof HorarioSemanal;
  return [...(h[dia] ?? [])].filter(tramoValido).sort((a, b) => a[0] - b[0]);
}
