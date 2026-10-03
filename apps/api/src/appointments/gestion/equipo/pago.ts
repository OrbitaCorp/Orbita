// Formas de pago del equipo por tipo de agenda (admin/equipoDemo.ts →
// formasDe y pagoInicialDe). Puras.
import type { AppointmentAgendaMode, AppointmentPayEvery, AppointmentPayForm } from '@prisma/client';

/** Comisión, mixto y alquiler solo donde se cobra por turno; por clase, solo donde hay clases; sueldo siempre. */
export function formasDe(modo: AppointmentAgendaMode): AppointmentPayForm[] {
  const porTurno = modo === 'PROFESSIONAL' || modo === 'RESOURCE';
  return [
    ...(porTurno ? (['COMMISSION'] as const) : []),
    'SALARY',
    ...(porTurno ? (['MIXED', 'RENT'] as const) : []),
    ...(modo === 'CLASS' ? (['PER_CLASS'] as const) : []),
  ];
}

export interface PagoGuardado {
  payForm: AppointmentPayForm | null;
  commissionPercent: number | null;
  salary: number | null;
  rent: number | null;
  perClass: number | null;
  payEvery: AppointmentPayEvery | null;
}

/** Con qué forma de pago arranca alguien nuevo. El dueño no se liquida. */
export function pagoInicialDe(modo: AppointmentAgendaMode, esDueno = false): PagoGuardado {
  if (esDueno) return { payForm: null, commissionPercent: null, salary: null, rent: null, perClass: null, payEvery: null };
  if (modo === 'CLASS') return { payForm: 'PER_CLASS', commissionPercent: 50, salary: 0, rent: 0, perClass: 9000, payEvery: 'MONTH' };
  if (modo === 'COURT') return { payForm: 'SALARY', commissionPercent: 50, salary: 480000, rent: 0, perClass: 0, payEvery: 'MONTH' };
  return { payForm: 'COMMISSION', commissionPercent: 50, salary: 0, rent: 0, perClass: 0, payEvery: 'WEEK' };
}

/** Los colores de la demo para la columna de cada persona, en orden. */
export const COLORES_EQUIPO = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444'];
