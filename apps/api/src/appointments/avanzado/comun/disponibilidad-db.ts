import { AppointmentResourceKind, AppointmentSettings } from '@prisma/client';
import { ContextoDisponibilidad } from '../../disponibilidad/disponibilidad';
import { instanteDe, leerSemana, sumarDias } from '../../horarios/horarios';
import { Db, horarioDelNegocioDb } from './contexto.service';

/** Qué agendas reciben turnos según el modo (CONTRATO § 1.1.1: `kind` según agendaMode). */
export function kindDeAgendas(settings: Pick<AppointmentSettings, 'agendaMode'>): AppointmentResourceKind {
  return settings.agendaMode === 'PROFESSIONAL' ? 'PERSON' : 'SPACE';
}

/**
 * El contexto del motor puro de disponibilidad para UN día, leído de la base
 * (solo lectura). Lo usa la lista de espera para saber si un día "todavía
 * tiene horarios" y si un lugar liberado sigue libre. Los turnos se leen con
 * `select` mínimo (agenda e instantes): ningún dato de otro cliente sale.
 *
 * La reserva de verdad la valida el núcleo (P1) dentro de su transacción con
 * lock; esto es una consulta, no una garantía.
 */
export async function contextoDelDia(
  tx: Db,
  businessId: string,
  settings: AppointmentSettings,
  fecha: string,
  modo: 'publico' | 'panel',
  ahora: Date = new Date(),
): Promise<ContextoDisponibilidad> {
  const [horario, recursos, turnos] = await Promise.all([
    horarioDelNegocioDb(tx, businessId, settings),
    tx.appointmentResource.findMany({
      where: { businessId, kind: kindDeAgendas(settings), isBookable: true, isActive: true, deletedAt: null },
      select: { id: true, workDays: true, ownSchedule: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    tx.appointment.findMany({
      where: { businessId, status: { not: 'CANCELLED' }, startsAt: { lt: instanteDe(sumarDias(fecha, 1), 0) }, endsAt: { gt: instanteDe(sumarDias(fecha, -1), 0) } },
      select: { id: true, resourceId: true, startsAt: true, endsAt: true },
    }),
  ]);
  return {
    reglas: { slotMin: settings.slotMin, bufferMin: settings.bufferMin, minAdvanceMin: settings.minAdvanceMin, maxAdvanceDays: settings.maxAdvanceDays },
    horario,
    recursos: recursos.map((r) => ({ id: r.id, workDays: r.workDays, ownSchedule: r.ownSchedule ? leerSemana(r.ownSchedule) : null })),
    turnos,
    ahora,
    modo,
  };
}
