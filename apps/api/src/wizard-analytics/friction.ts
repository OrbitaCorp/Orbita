// Las cuentas del embudo, separadas de la base a propósito.
//
// Las queries (wizard-analytics.service.ts) solo agrupan y cuentan; toda la
// interpretación —cuánta gente se cae en cada paso, qué campo es el más
// pesado— vive acá, en funciones puras. Así se puede testear el criterio sin
// levantar Postgres, y sobre todo se puede DISCUTIR: el índice de fricción es
// una opinión, no un hecho, y conviene que esa opinión esté en un solo lugar
// visible en vez de escondida adentro de un SQL.

export interface StepCount {
  step: number;
  stepName: string;
  /** Sesiones distintas que llegaron a VER este paso. */
  sessions: number;
}

export interface FunnelRow extends StepCount {
  /** % sobre la gente que entró al wizard (el paso 0). */
  pctDelTotal: number;
  /** Cuántos se perdieron respecto del paso anterior. */
  perdidos: number;
  /** Esa pérdida como % del paso anterior — es LA métrica del embudo. */
  pctCaida: number;
  /** El paso con la caída más grande. Uno solo, para no diluir el mensaje. */
  peorPaso: boolean;
}

export function buildFunnel(pasos: StepCount[]): FunnelRow[] {
  if (pasos.length === 0) return [];

  const total = pasos[0].sessions;

  const filas: FunnelRow[] = pasos.map((paso, i) => {
    const anterior = i === 0 ? null : pasos[i - 1].sessions;
    const perdidos = anterior === null ? 0 : Math.max(anterior - paso.sessions, 0);
    return {
      ...paso,
      pctDelTotal: total === 0 ? 0 : redondear((paso.sessions / total) * 100),
      perdidos,
      pctCaida: !anterior ? 0 : redondear((perdidos / anterior) * 100),
      peorPaso: false,
    };
  });

  const peor = filas.reduce((max, f) => (f.pctCaida > max.pctCaida ? f : max), filas[0]);
  if (peor.pctCaida > 0) peor.peorPaso = true;

  return filas;
}

export interface FieldStat {
  field: string;
  stepName: string;
  /** Sesiones distintas que tocaron el campo. */
  sesiones: number;
  /** Mediana (no promedio: un tipo que se fue a almorzar no puede mover esto). */
  medianaSegundos: number;
  sesionesConError: number;
  /** Sesiones cuyo último rastro en el wizard fue este campo. */
  sesionesAbandonadas: number;
  /** Cuántas veces en promedio se volvió a editar el campo tras haberlo dejado. */
  reintentosPromedio: number;
}

export interface FieldFriction extends FieldStat {
  /** 0..100. Cuanto más alto, más pesado es el dato de completar. */
  indiceFriccion: number;
  /** Qué explica el número, para que el tablero no sea una caja negra. */
  desglose: { errores: number; lentitud: number; abandono: number; reintentos: number };
}

// Muestra mínima: con 4 personas, "el 100% falló" es ruido, no un hallazgo.
export const MUESTRA_MINIMA = 5;

// Los pesos. Los errores mandan porque son fricción inequívoca: el usuario
// intentó y el sistema le dijo que no. Tardar mucho puede ser que esté
// pensando el nombre de su negocio, que es sano. El abandono pesa parecido a
// la lentitud porque es contundente pero ruidoso (la gente cierra pestañas por
// mil motivos). Los reintentos son la señal más débil, de desempate.
const PESO = { errores: 45, lentitud: 20, abandono: 25, reintentos: 10 };

// Topes de saturación: a partir de acá "más" ya no dice nada nuevo.
const SEGUNDOS_TOPE = 60;
const REINTENTOS_TOPE = 3;

/**
 * Cuántos campos YA tienen datos pero todavía no llegan a la muestra mínima.
 * Sin este número, un ranking vacío es ambiguo: no se distingue "todavía nadie
 * completó nada" de "hay datos pero son pocos para decir algo".
 */
export function contarInsuficientes(stats: FieldStat[]): number {
  return stats.filter((s) => s.sesiones > 0 && s.sesiones < MUESTRA_MINIMA).length;
}

export function buildFriction(stats: FieldStat[]): FieldFriction[] {
  return stats
    .filter((s) => s.sesiones >= MUESTRA_MINIMA)
    .map((s) => {
      const desglose = {
        errores: cap(s.sesionesConError / s.sesiones) * PESO.errores,
        lentitud: cap(s.medianaSegundos / SEGUNDOS_TOPE) * PESO.lentitud,
        abandono: cap(s.sesionesAbandonadas / s.sesiones) * PESO.abandono,
        reintentos: cap((s.reintentosPromedio - 1) / REINTENTOS_TOPE) * PESO.reintentos,
      };
      const indiceFriccion = redondear(
        desglose.errores + desglose.lentitud + desglose.abandono + desglose.reintentos,
      );
      return {
        ...s,
        indiceFriccion,
        desglose: {
          errores: redondear(desglose.errores),
          lentitud: redondear(desglose.lentitud),
          abandono: redondear(desglose.abandono),
          reintentos: redondear(desglose.reintentos),
        },
      };
    })
    .sort((a, b) => b.indiceFriccion - a.indiceFriccion);
}

function cap(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1);
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}
