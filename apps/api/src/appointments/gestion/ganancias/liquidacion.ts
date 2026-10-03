// Liquidación del equipo (CONTRATO § P3.4): funciones PURAS, sin Prisma ni
// reloj. Es `liquidarEntre` de la demo (admin/equipoDemo.ts) con fechas
// reales "YYYY-MM-DD" de Argentina en vez de "días desde hoy".
//
// Quien llama trae de la base los turnos y las plantillas de clase; acá se
// filtra (solo turnos COMPLETED de la agenda de la persona, dentro del rango)
// y se hace la cuenta. Así cada borde (mes que cambia, alquiler mayor que lo
// facturado, el dueño, turnos cancelados) se prueba sin base.
import type { AppointmentPayForm, AppointmentStatus } from '@prisma/client';
import type { FormaDePagoDto, LiquidacionTurnos, RenglonLiquidacion } from '../../appointments.types';
import { diaDeSemana, fechaYMinutos, horarioDelNegocio, instanteDe, sumarDias, type HorarioNegocio } from '../../horarios/horarios';
import { fechasEntre } from '../comun/mapeos';

/** Cómo cobra una persona. `payForm` null = el dueño (o un espacio): no se liquida. */
export interface FormaDePago {
  payForm: AppointmentPayForm | null;
  commissionPercent: number;
  salary: number;
  rent: number;
  perClass: number;
}

export interface PersonaLiquidable extends FormaDePago {
  resourceId: string;
  /** Modo RESOURCE: sus turnos son los de su espacio (CONTRATO § 1.1). */
  assignedSpaceId: string | null;
}

export interface TurnoLiquidable {
  id: string;
  resourceId: string;
  status: AppointmentStatus;
  startsAt: Date;
  price: number;
  discountAmount: number;
  customerName: string;
  serviceName: string;
}

export interface PlantillaLiquidable {
  id: string;
  instructorResourceId: string | null;
  weekday: number;
  startMin: number;
  durationMin: number;
  isActive: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

const redondear = (n: number) => Math.round(n);
const centavos = (n: number) => Math.round(n * 100) / 100;

/** Los días que tiene el mes de esa fecha (28 a 31). */
export function diasDelMes(fecha: string): number {
  const [y, m] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** % de cada turno que le toca a la persona: comisión, todo si alquila, nada si no. */
export function porcentajeDe(p: FormaDePago): number {
  if (p.payForm === 'COMMISSION' || p.payForm === 'MIXED') return p.commissionPercent;
  if (p.payForm === 'RENT') return 100;
  return 0;
}

/**
 * Un monto mensual prorrateado por día calendario: cada día del rango aporta
 * `monto / díasDelMes(ese día)`. Se suma sin redondear y se redondea al final.
 */
export function prorrateoMensual(monto: number, from: string, to: string): number {
  if (monto <= 0) return 0;
  let suma = 0;
  for (const d of fechasEntre(from, to)) suma += monto / diasDelMes(d);
  return redondear(suma);
}

/**
 * Las clases que dio una persona entre dos fechas: por cada fecha del rango
 * (hasta hoy) en que cae una plantilla suya, el negocio abre, la clase no se
 * suspendió y ya terminó. Las plantillas apagadas no cuentan; una borrada
 * cuenta solo para las fechas anteriores al borrado.
 */
export function clasesDadasEntre(
  instructorId: string,
  plantillas: PlantillaLiquidable[],
  suspendidas: ReadonlySet<string>,
  horario: HorarioNegocio,
  from: string,
  to: string,
  ahora: Date,
): number {
  const propias = plantillas.filter((t) => t.instructorResourceId === instructorId && t.isActive);
  if (propias.length === 0) return 0;
  let dadas = 0;
  for (const fecha of fechasEntre(from, to)) {
    const dia = diaDeSemana(fecha);
    const delDia = propias.filter((t) => t.weekday === dia);
    if (delDia.length === 0) continue;
    if (horarioDelNegocio(horario, fecha).tramos.length === 0) continue;
    for (const t of delDia) {
      const inicio = instanteDe(fecha, t.startMin);
      const fin = instanteDe(fecha, t.startMin + t.durationMin);
      if (fin.getTime() > ahora.getTime()) continue; // todavía no terminó
      if (t.createdAt.getTime() > fin.getTime()) continue; // la plantilla no existía
      if (t.deletedAt && t.deletedAt.getTime() <= inicio.getTime()) continue; // ya estaba borrada
      if (suspendidas.has(claveSesion(t.id, fecha))) continue;
      dadas++;
    }
  }
  return dadas;
}

export const claveSesion = (templateId: string, fecha: string) => `${templateId}:${fecha}`;

/**
 * La liquidación de una persona entre `from` y `to` (inclusive). `to < from`
 * = rango vacío: todo en cero.
 */
export function liquidarEntre(p: PersonaLiquidable, from: string, to: string, turnos: TurnoLiquidable[], clasesDadas: number): LiquidacionTurnos {
  const vacia: LiquidacionTurnos = {
    resourceId: p.resourceId, from, to, appointments: 0, classes: 0, billed: 0, commission: 0, salary: 0,
    perClass: 0, rent: 0, toPerson: 0, toBusiness: 0, lines: [],
  };
  if (to < from) return vacia;

  const agendas = new Set([p.resourceId, ...(p.assignedSpaceId ? [p.assignedSpaceId] : [])]);
  const pct = porcentajeDe(p);
  const lines: RenglonLiquidacion[] = [];
  for (const t of turnos) {
    if (t.status !== 'COMPLETED' || !agendas.has(t.resourceId)) continue; // cancelados y ausentes no suman
    const { fecha, minutos } = fechaYMinutos(t.startsAt);
    if (fecha < from || fecha > to) continue;
    const precio = centavos(t.price - t.discountAmount);
    lines.push({
      appointmentId: t.id, date: fecha, startMin: minutos, customerName: t.customerName, serviceName: t.serviceName,
      price: precio, share: redondear((precio * pct) / 100),
    });
  }
  // Como la demo: lo más nuevo arriba.
  lines.sort((a, b) => (a.date === b.date ? b.startMin - a.startMin : a.date < b.date ? 1 : -1));

  const forma = p.payForm;
  const billed = centavos(lines.reduce((s, l) => s + l.price, 0));
  const commission = forma === 'COMMISSION' || forma === 'MIXED' ? lines.reduce((s, l) => s + l.share, 0) : 0;
  const salary = forma === 'SALARY' || forma === 'MIXED' ? prorrateoMensual(p.salary, from, to) : 0;
  const rent = forma === 'RENT' ? prorrateoMensual(p.rent, from, to) : 0;
  const classes = clasesDadas;
  const perClass = forma === 'PER_CLASS' ? centavos(classes * p.perClass) : 0;
  const toPerson = forma === null ? 0 : forma === 'RENT' ? centavos(billed - rent) : centavos(commission + salary + perClass);
  return {
    ...vacia,
    appointments: lines.length,
    classes,
    billed,
    commission,
    salary,
    perClass,
    rent,
    toPerson,
    toBusiness: centavos(billed - toPerson),
    lines,
  };
}

/** Lo que el negocio le debe por esa liquidación: 0 si alquila o es el dueño. */
export const aPagar = (forma: AppointmentPayForm | null, l: LiquidacionTurnos): number => (forma === null || forma === 'RENT' ? 0 : l.toPerson);

/** Lo que la persona le debe al negocio (el alquiler). */
export const aCobrar = (forma: AppointmentPayForm | null, l: LiquidacionTurnos): number => (forma === 'RENT' ? l.rent : 0);

/** Desde cuándo está pendiente: el día después del último pago, o el alta si nunca se le pagó. */
export const desdePendiente = (paidUntil: string | null, alta: string): string => (paidUntil ? sumarDias(paidUntil, 1) : alta);

/**
 * Los totales del período (vista de todo el equipo). `billedTotal` es lo
 * facturado por TODAS las agendas (también las que no son de nadie del
 * equipo, como las del dueño).
 *
 * `toBusiness` = facturado − lo que se lleva cada persona (como la demo:
 * `negocioTotal.total - Σ paraLaPersona`). La fórmula del contrato
 * (facturado − toTeam + Σ toCollect) cuenta dos veces lo que factura quien
 * alquila, que no es del negocio: ver el informe de P3.
 */
export function totalesDelPeriodo(
  personas: { forma: AppointmentPayForm | null; period: LiquidacionTurnos }[],
  billedTotal: number,
  appointmentsTotal: number,
): { billed: number; appointments: number; toTeam: number; toBusiness: number } {
  const toTeam = centavos(personas.reduce((s, p) => s + aPagar(p.forma, p.period), 0));
  const llevan = personas.reduce((s, p) => s + p.period.toPerson, 0);
  return { billed: centavos(billedTotal), appointments: appointmentsTotal, toTeam, toBusiness: centavos(billedTotal - llevan) };
}

/** La forma de pago guardada en el recurso, como la devuelve la API. null = no se liquida. */
export function formaDePagoDto(r: {
  payForm: AppointmentPayForm | null; commissionPercent: unknown; salary: unknown; rent: unknown; perClass: unknown; payEvery: FormaDePagoDto['payEvery'] | null;
}): FormaDePagoDto | null {
  if (!r.payForm) return null;
  return {
    payForm: r.payForm,
    commissionPercent: Number(r.commissionPercent ?? 0),
    salary: Number(r.salary ?? 0),
    rent: Number(r.rent ?? 0),
    perClass: Number(r.perClass ?? 0),
    payEvery: r.payEvery ?? 'MONTH',
  };
}
