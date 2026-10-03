// Catálogo de las funciones de Avanzado de Turnos (P4): nombres para los
// mensajes, configuración de fábrica y cuáles se recomiendan según el rubro.
// PURO: sin Prisma. Copia del comportamiento de la demo
// (apps/web/src/modules/turnos/admin/avanzado/datosAvanzado.ts y las pantallas
// de cada función).
import type { ConfigAvanzado, FuncionAvanzada } from '../../appointments.types';
import type { RubroTurnos } from '../../catalogo/rubros';

export const FUNCIONES_AVANZADAS: FuncionAvanzada[] = [
  'paquetes', 'membresias', 'gift-cards', 'fidelidad', 'turno-fijo', 'recuperar', 'precios-horario', 'plantillas',
];

export const esFuncionAvanzada = (v: unknown): v is FuncionAvanzada =>
  typeof v === 'string' && (FUNCIONES_AVANZADAS as string[]).includes(v);

/** Cómo se llama cada función en la pantalla (para los mensajes de error). */
export const NOMBRE_FUNCION: Record<FuncionAvanzada, string> = {
  paquetes: 'Paquetes y bonos',
  membresias: 'Membresías y abonos',
  'gift-cards': 'Gift cards',
  fidelidad: 'Programa de fidelidad',
  'turno-fijo': 'Turno fijo',
  recuperar: 'Recuperar clientes',
  'precios-horario': 'Precios por horario',
  plantillas: 'Plantillas del sitio',
};

/**
 * Configuración de fábrica de cada función: los valores con los que arranca
 * cada pantalla de la demo. Lo que el dueño guarda se mezcla encima (ver
 * `configDe`), así una fila vieja a la que le falta un campo nuevo sigue
 * leyéndose completa.
 */
export const CONFIG_DE_FABRICA: { [F in FuncionAvanzada]-?: NonNullable<ConfigAvanzado[F]> } = {
  paquetes: { compartir: false, avisoUltimas: true, avisoVence: true },
  membresias: { renueva: true, diaCobro: 1, pausa: true, diasPausa: 15, matricula: 0 },
  'gift-cards': { montoLibre: true, montos: [], mesesValidez: 6, saldoAFavor: true },
  fidelidad: {
    sellos: 8, premio: 'gratis', serviceId: null, pct: 20,
    suma: 'todos', minimo: 0, icono: 'rubro', vencenMeses: 12, selloDeBienvenida: false,
  },
  'turno-fijo': { frecuencias: ['WEEKLY', 'BIWEEKLY'], maximo: 12, serviceIds: [], cobro: 'cada', liberarAusencias: 2, saltearFeriados: true },
  'precios-horario': { mostrarTachado: true },
  recuperar: {},
  plantillas: {},
};

/** La config de una función: la de fábrica con lo guardado encima. */
export function configDe<F extends FuncionAvanzada>(funcion: F, guardada: unknown): NonNullable<ConfigAvanzado[F]> {
  const base = CONFIG_DE_FABRICA[funcion] as NonNullable<ConfigAvanzado[F]>;
  if (!guardada || typeof guardada !== 'object' || Array.isArray(guardada)) return { ...base };
  return { ...base, ...(guardada as object) } as NonNullable<ConfigAvanzado[F]>;
}

/**
 * Las funciones que la demo recomienda para el rubro (`recomendada` de
 * datosAvanzado.ts). Los rubros de la demo con modo "cupo" y "cancha" son, en
 * el backend, CLASS y COURT.
 */
export function recomendadasPara(r: RubroTurnos | undefined): FuncionAvanzada[] {
  if (!r) return [];
  const en = (...keys: string[]) => keys.includes(r.key);
  const reglas: Record<FuncionAvanzada, boolean> = {
    'turno-fijo': en('psico', 'kinesio', 'fono', 'nutricion', 'clases', 'canchas', 'medicina-alternativa', 'podologia'),
    'precios-horario': en('canchas', 'electro', 'spa', 'depilacion', 'estetica'),
    fidelidad: en('barberia', 'peluqueria', 'unas', 'pestanas', 'estilista', 'depilacion'),
    recuperar: r.familia === 'belleza' || en('odonto', 'nutricion', 'podologia'),
    paquetes: en('kinesio', 'estetica', 'electro', 'depilacion', 'spa', 'pestanas', 'fono', 'medicina-alternativa', 'clases', 'medicina-estetica'),
    membresias: r.modo === 'CLASS',
    'gift-cards': r.familia === 'belleza' || r.key === 'talleres',
    plantillas: false,
  };
  return FUNCIONES_AVANZADAS.filter((f) => reglas[f]);
}
