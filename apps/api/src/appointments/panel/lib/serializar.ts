// De filas de Prisma a los tipos de respuesta de appointments.types.ts.
// Plata como number, instantes ISO UTC, días y minutos de Argentina.
import type { AppointmentResource, AppointmentService, AppointmentSettings, AppointmentSpecialDay, Prisma } from '@prisma/client';
import type { RecursoDto, ServicioDto, TurnoDto } from '../../appointments.types';
import { estadoVisible } from '../../appointments.types';
import { HorarioNegocio, fechaYMinutos, leerSemana, leerTramos } from '../../horarios/horarios';
import { taparTelefono } from './telefono';

export const num = (d: Prisma.Decimal | number | null | undefined): number => (d === null || d === undefined ? 0 : Number(d));

export function servicioDto(s: AppointmentService): ServicioDto {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    durationMin: s.durationMin,
    price: num(s.price),
    bookableOnline: s.bookableOnline,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
  };
}

export function recursoDto(r: AppointmentResource): RecursoDto {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    roleLabel: r.roleLabel,
    color: r.color,
    photoUrl: r.photoUrl,
    bio: r.bio,
    isBookable: r.isBookable,
    assignedSpaceId: r.assignedSpaceId,
    workDays: [...r.workDays].sort((a, b) => a - b),
    ownSchedule: r.ownSchedule === null || r.ownSchedule === undefined ? null : leerSemana(r.ownSchedule),
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  };
}

/** El horario del negocio como lo lee el motor: semana, días especiales y vacaciones (si están prendidas y completas). */
export function horarioNegocioDe(
  s: Pick<AppointmentSettings, 'weekSchedule' | 'vacationEnabled' | 'vacationFrom' | 'vacationTo'>,
  especiales: Pick<AppointmentSpecialDay, 'date' | 'kind' | 'ranges'>[],
): HorarioNegocio {
  return {
    semana: leerSemana(s.weekSchedule),
    especiales: especiales.map((e) => ({ fecha: e.date, tipo: e.kind, tramos: e.kind === 'SPECIAL' ? leerTramos(e.ranges) : [] })),
    vacaciones: s.vacationEnabled && s.vacationFrom && s.vacationTo ? { desde: s.vacationFrom, hasta: s.vacationTo } : null,
  };
}

/** Lo que se lee de un turno para armar un TurnoDto. Nunca trae el accessToken. */
export const SELECT_TURNO = {
  id: true, code: true, status: true, origin: true, modality: true,
  resourceId: true, serviceId: true, customerId: true,
  customerName: true, customerPhone: true, customerEmail: true, customerNote: true, internalNote: true, serviceName: true,
  startsAt: true, endsAt: true, durationMin: true,
  price: true, discountAmount: true, depositAmount: true, depositPaidAt: true, depositMethod: true,
  rescheduleCount: true, recurringSeriesId: true,
  resource: { select: { name: true } },
} satisfies Prisma.AppointmentSelect;

export type TurnoLeido = Prisma.AppointmentGetPayload<{ select: typeof SELECT_TURNO }>;

/** `contacto`: quien mira tiene appointments.clients.contact (si no, teléfono tapado y sin email). */
export function turnoDto(t: TurnoLeido, contacto: boolean, ahora: Date): TurnoDto {
  const { fecha, minutos } = fechaYMinutos(t.startsAt);
  const price = num(t.price);
  const discountAmount = num(t.discountAmount);
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
    customer: {
      id: t.customerId,
      name: t.customerName,
      phone: contacto ? t.customerPhone : taparTelefono(t.customerPhone),
      email: contacto ? t.customerEmail : null,
    },
    date: fecha,
    startMin: minutos,
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt.toISOString(),
    durationMin: t.durationMin,
    price,
    discountAmount,
    total: price - discountAmount,
    depositAmount: num(t.depositAmount),
    depositPaid: t.depositPaidAt !== null,
    depositPaidAt: t.depositPaidAt ? t.depositPaidAt.toISOString() : null,
    depositMethod: t.depositMethod,
    rescheduleCount: t.rescheduleCount,
    customerNote: t.customerNote,
    internalNote: t.internalNote,
    recurringSeriesId: t.recurringSeriesId,
  };
}

/** Nombres de los estados para los mensajes de error. */
export const NOMBRE_ESTADO: Record<string, string> = {
  PENDING: 'pendiente',
  CONFIRMED: 'confirmado',
  COMPLETED: 'atendido',
  NO_SHOW: 'ausente',
  CANCELLED: 'cancelado',
};

/** Sin acentos y en minúsculas, para comparar nombres. */
export const normalizarNombre = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
