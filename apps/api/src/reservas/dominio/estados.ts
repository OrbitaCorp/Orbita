// La máquina de estados de una reserva. Toda transición pasa por acá: el
// service la aplica con un compare-and-set sobre (id, negocio, estado actual,
// version), así dos acciones simultáneas sobre la misma reserva no se pisan:
// la segunda no encuentra la fila en el estado que esperaba y recibe 409.
import { ReservaEstado } from '@prisma/client';

/** Estados que ocupan lugar en el recurso (los mismos que mira la restricción de exclusión de la base). */
export const OCUPAN: readonly ReservaEstado[] = ['RETENIDA', 'PENDIENTE', 'CONFIRMADA'];

/** Estados finales: de acá no se sale. */
export const FINALES: readonly ReservaEstado[] = ['COMPLETADA', 'CANCELADA', 'VENCIDA', 'AUSENTE'];

export const TRANSICIONES: Record<ReservaEstado, readonly ReservaEstado[]> = {
  // Mientras la persona termina de reservar. Confirmación automática → CONFIRMADA; manual → PENDIENTE.
  RETENIDA: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'VENCIDA'],
  // A confirmar por el negocio.
  PENDIENTE: ['CONFIRMADA', 'CANCELADA'],
  // Firme. Después del turno: atendida o ausente.
  CONFIRMADA: ['COMPLETADA', 'AUSENTE', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA: [],
  VENCIDA: [],
  AUSENTE: [],
};

export const puedePasar = (de: ReservaEstado, a: ReservaEstado): boolean => TRANSICIONES[de].includes(a);

/** Desde qué estados se puede llegar a `a` (lo que va en el where del compare-and-set). */
export const desdeDonde = (a: ReservaEstado): ReservaEstado[] =>
  (Object.keys(TRANSICIONES) as ReservaEstado[]).filter((de) => TRANSICIONES[de].includes(a));

export const ETIQUETA: Record<ReservaEstado, string> = {
  RETENIDA: 'retenida',
  PENDIENTE: 'pendiente de confirmación',
  CONFIRMADA: 'confirmada',
  COMPLETADA: 'completada',
  CANCELADA: 'cancelada',
  VENCIDA: 'vencida',
  AUSENTE: 'marcada como ausente',
};

/** "Un turno confirmado no puede pasar a retenido": el mensaje del 409 cuando la transición no existe. */
export const mensajeTransicion = (de: ReservaEstado, a: ReservaEstado): string =>
  `La reserva está ${ETIQUETA[de]} y no puede pasar a ${ETIQUETA[a]}.`;
