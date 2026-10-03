import type { AppointmentOrigin, Prisma } from '@prisma/client';

// El punto de contacto con el núcleo de turnos de P1 (`AppointmentsService.crear`,
// CONTRATO § 1.1). Avanzado NO crea turnos sueltos: el turno fijo y la lista de
// espera reciben la función que los crea, por parámetro o inyectada con el
// token NUCLEO_TURNOS (opcional: mientras P1 no lo registre, esos endpoints
// responden 503 en vez de inventar un camino paralelo).

export const NUCLEO_TURNOS = Symbol('NUCLEO_TURNOS');

export interface DatosTurnoNuevo {
  businessId: string;
  serviceId: string;
  /** Una agenda puntual o "cualquiera". */
  resourceId: string;
  date: string;
  startMin: number;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  origin: AppointmentOrigin;
  createdByMemberId: string | null;
  /** Turno fijo: la serie a la que pertenece. */
  recurringSeriesId?: string;
}

/**
 * Crea UN turno con las reglas de § 1.1 (disponibilidad, precio, seña) usando
 * la transacción que recibe. Tiene que TIRAR una HttpException 400/409 si el
 * horario no está disponible: quien llama lo saltea y sigue.
 */
export type CrearTurno = (datos: DatosTurnoNuevo, tx: Prisma.TransactionClient) => Promise<{ id: string; startsAt: Date }>;

export interface NucleoTurnos {
  crearTurno: CrearTurno;
}
