// Qué se puede reservar en un día. Puro: entran la apertura del día, lo que ya
// está ocupado, los bloqueos y las reglas; sale la lista de franjas con el
// lugar que queda en cada una. El "ahora" entra como `desdeMinuto`.
import { restar, seSolapan, type Tramo } from './tiempo';

export interface OcupacionDelDia {
  /** Tramo en minutos del día. */
  tramo: Tramo;
  /** Lugares que ocupa del cupo. */
  cantidad: number;
}

export interface Franja {
  inicio: number;
  fin: number;
  /** Lugares que quedan (0 = llena). */
  libres: number;
  cupo: number;
}

export interface ReglasFranjas {
  /** Minutos de lo que se reserva. */
  duracion: number;
  /** Cada cuántos minutos arranca una franja. */
  paso: number;
  /** Minutos libres antes y después de cada ocupación. */
  margen: number;
  /** Lugares por franja. */
  cupo: number;
  /** Antes de este minuto no se ofrece nada (si el día es hoy: ahora + anticipación mínima). */
  desdeMinuto?: number;
}

/**
 * Franjas de un recurso de franjas (turnos, canchas, salones) para un día:
 * arrancan cada `paso` minutos dentro de cada tramo de la apertura (menos los
 * bloqueos), duran `duracion`, y quedan libres si no se pisan con ninguna
 * ocupación (agrandada con el margen) hasta completar el cupo. Las que ya
 * pasaron (antes de `desdeMinuto`) no se devuelven.
 */
export function franjasDelDia(apertura: Tramo[], bloqueos: Tramo[], ocupadas: OcupacionDelDia[], r: ReglasFranjas): Franja[] {
  const out: Franja[] = [];
  const abierto = apertura.flatMap((a) => restar(a, bloqueos));
  for (const [abre, cierra] of abierto) {
    for (let m = abre; m + r.duracion <= cierra; m += r.paso) {
      if (r.desdeMinuto !== undefined && m < r.desdeMinuto) continue;
      const fin = m + r.duracion;
      const usados = ocupadas
        .filter((o) => seSolapan([m - r.margen, fin + r.margen], o.tramo))
        .reduce((s, o) => s + o.cantidad, 0);
      out.push({ inicio: m, fin, libres: Math.max(0, r.cupo - usados), cupo: r.cupo });
    }
  }
  return out;
}

/**
 * Sesiones de una clase para un día: cada tramo del horario es una sesión
 * entera. Una sesión tapada por un bloqueo (aunque sea en parte) no se da.
 */
export function sesionesConCupo(sesiones: Tramo[], bloqueos: Tramo[], ocupadas: OcupacionDelDia[], cupo: number, desdeMinuto?: number): Franja[] {
  return sesiones
    .filter(([a, b]) => !bloqueos.some((bl) => seSolapan([a, b], bl)))
    .filter(([a]) => desdeMinuto === undefined || a >= desdeMinuto)
    .map(([a, b]) => {
      const usados = ocupadas.filter((o) => seSolapan([a, b], o.tramo)).reduce((s, o) => s + o.cantidad, 0);
      return { inicio: a, fin: b, libres: Math.max(0, cupo - usados), cupo };
    });
}

/**
 * Cuántas franjas seguidas se pueden tomar a partir de una (la primera cuenta),
 * hasta `maximo`. La siguiente es la que arranca justo donde termina la
 * anterior; se corta si no existe o no tiene lugar.
 */
export function seguidasDesde(franjas: Franja[], inicio: number, maximo: number): number {
  const porInicio = new Map(franjas.map((f) => [f.inicio, f]));
  let f = porInicio.get(inicio);
  let n = 0;
  while (f && f.libres > 0 && n < maximo) {
    n++;
    f = porInicio.get(f.fin);
  }
  return n;
}
