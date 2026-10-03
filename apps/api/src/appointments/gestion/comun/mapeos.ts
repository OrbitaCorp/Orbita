// De filas de Prisma a los tipos de respuesta de appointments.types.ts. Puras.
import type { Appointment } from '@prisma/client';
import type { MemberContext } from '../../../common/types/auth-context.type';
import { estadoVisible, type TurnoDto } from '../../appointments.types';
import { diasEntre, fechaYMinutos, sumarDias } from '../../horarios/horarios';
import { contactoSegun, pesos } from './alcance';

export type TurnoConAgenda = Appointment & { resource: { name: string } };

/**
 * Un turno para listas del panel (historial del cliente). NUNCA lleva el
 * accessToken: el tipo TurnoDto no lo tiene y acá no se copia.
 */
export function aTurnoDto(t: TurnoConAgenda, member: Pick<MemberContext, 'roleName' | 'permissions'>, ahora: Date): TurnoDto {
  const { fecha, minutos } = fechaYMinutos(t.startsAt);
  const price = pesos(t.price);
  const discountAmount = pesos(t.discountAmount);
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    visibleStatus: estadoVisible(t, ahora),
    origin: t.origin,
    modality: t.modality,
    resourceId: t.resourceId,
    resourceName: t.resource.name,
    serviceId: t.serviceId,
    serviceName: t.serviceName,
    customer: { id: t.customerId, name: t.customerName, ...contactoSegun(member, t.customerPhone, t.customerEmail) },
    date: fecha,
    startMin: minutos,
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt.toISOString(),
    durationMin: t.durationMin,
    price,
    discountAmount,
    total: pesos(price - discountAmount),
    depositAmount: pesos(t.depositAmount),
    depositPaid: t.depositPaidAt !== null,
    depositPaidAt: t.depositPaidAt?.toISOString() ?? null,
    depositMethod: t.depositMethod,
    rescheduleCount: t.rescheduleCount,
    customerNote: t.customerNote,
    internalNote: t.internalNote,
    recurringSeriesId: t.recurringSeriesId,
  };
}

/** Las fechas de un rango, inclusive. [] si `to < from`. */
export function fechasEntre(from: string, to: string): string[] {
  const n = diasEntre(from, to);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => sumarDias(from, i));
}

/** "20/09/2026" para mensajes. */
export const fechaCorta = (fecha: string): string => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
