// "Mi turno" de una inscripción a una clase (MiTurnoDto). Puro. La versión
// para turnos la arma P2; esta es la de clases, que P3 necesita para la
// respuesta de anotarse desde el sitio.
import type { AppointmentEnrollmentStatus, AppointmentSettings } from '@prisma/client';
import type { MiTurnoDto, PoliticaReserva } from '../../appointments.types';
import { fechaYMinutos } from '../../horarios/horarios';
import { pesos } from '../comun/alcance';

function plazoTxt(horas: number): string {
  if (horas <= 0) return 'hasta último momento';
  if (horas < 24) return `hasta ${horas} h antes`;
  const dias = horas / 24;
  return Number.isInteger(dias) && dias > 1 ? `hasta ${dias} días antes` : `hasta ${horas} h antes`;
}

/** La política en palabras: misma redacción que la demo (demo/negocioDemo.ts → politicaTxt). */
export function politicaTexto(p: PoliticaReserva): { changes: string; late: string } {
  const fuera = p.depositOutOfWindow === 'forfeit' ? 'no se devuelve' : 'te queda a favor para otro turno';
  return {
    changes: `Podés cancelar o reprogramar sin cargo ${plazoTxt(p.cancelUntilHours)}, desde Mis turnos o desde el link del recordatorio. Si pagaste una seña y cancelás a tiempo, se devuelve al mismo medio de pago.${p.cancelUntilHours > 0 ? ` Pasado ese plazo, o si no venís, la seña ${fuera}.` : ` Si no venís, la seña ${fuera}.`}`,
    late: p.toleranceMin > 0
      ? `Guardamos tu lugar ${p.toleranceMin} minutos. Después de ese tiempo el turno puede darse a otra persona o acortarse para no demorar al siguiente.`
      : 'Los turnos empiezan a la hora reservada: si llegás tarde, puede acortarse para no demorar al siguiente.',
  };
}

export interface InscripcionParaMiTurno {
  code: string;
  status: AppointmentEnrollmentStatus;
  price: unknown;
  discountAmount: unknown;
  depositAmount: unknown;
  depositPaidAt: Date | null;
  waitlistPosition: number | null;
}

export function miTurnoDeClase(
  e: InscripcionParaMiTurno,
  clase: { serviceName: string; resourceName: string | null; startsAt: Date; endsAt: Date },
  settings: Pick<AppointmentSettings, 'cancelUntilHours' | 'depositOutOfWindow' | 'toleranceMin'>,
  ahora: Date,
): MiTurnoDto {
  const { fecha, minutos } = fechaYMinutos(clase.startsAt);
  const limite = new Date(clase.startsAt.getTime() - settings.cancelUntilHours * 3_600_000);
  const aTiempo = ahora.getTime() <= limite.getTime();
  const politica: PoliticaReserva = {
    cancelUntilHours: settings.cancelUntilHours,
    depositOutOfWindow: settings.depositOutOfWindow === 'credit' ? 'credit' : 'forfeit',
    toleranceMin: settings.toleranceMin,
  };
  return {
    kind: 'class',
    code: e.code,
    status: e.status,
    serviceName: clase.serviceName,
    resourceName: clase.resourceName,
    modality: 'ON_SITE',
    date: fecha,
    startMin: minutos,
    startsAt: clase.startsAt.toISOString(),
    endsAt: clase.endsAt.toISOString(),
    durationMin: Math.round((clase.endsAt.getTime() - clase.startsAt.getTime()) / 60_000),
    total: pesos(Number(e.price) - Number(e.discountAmount)),
    deposit: { amount: pesos(e.depositAmount), paid: e.depositPaidAt !== null },
    waitlistPosition: e.waitlistPosition,
    canCancelUntil: e.status !== 'CANCELLED' && aTiempo ? limite.toISOString() : null,
    // Una clase no se reprograma: se cancela y se anota a otra.
    canRescheduleUntil: null,
    reschedulesLeft: 0,
    depositOnCancel: !e.depositPaidAt ? 'none' : aTiempo ? 'refund' : politica.depositOutOfWindow,
    policy: politicaTexto(politica),
  };
}
