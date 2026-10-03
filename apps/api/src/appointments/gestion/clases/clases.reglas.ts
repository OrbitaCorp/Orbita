// Clases con cupo (CONTRATO § P3.1): reglas PURAS, sin Prisma ni reloj.
//
// Una clase de un día no existe como fila hasta que alguien se anota o el
// negocio la suspende / le cambia el cupo: las clases de un rango se arman en
// memoria con las plantillas × las fechas, menos los días que el negocio no
// abre, más lo que diga la sesión materializada.
import type { ClaseDelDiaDto } from '../../appointments.types';
import type { ReglasReserva } from '../../appointments.types';
import { diaDeSemana, fechaYMinutos, hhmm, horarioDelNegocio, instanteDe, sumarDias, type HorarioNegocio, type Tramo } from '../../horarios/horarios';
import { fechasEntre } from '../comun/mapeos';

export interface PlantillaArmable {
  id: string;
  serviceId: string;
  serviceName: string;
  price: number;
  weekday: number;
  startMin: number;
  durationMin: number;
  instructorName: string | null;
  roomName: string | null;
  capacity: number;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface SesionArmable {
  id: string;
  templateId: string;
  date: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  isCancelled: boolean;
}

export interface Conteo { enrolled: number; waitlist: number }

export interface OpcionesArmado {
  from: string;
  to: string;
  ahora: Date;
  /** La reserva de una clase se abre N días antes (`classOpenDays`). */
  classOpenDays: number;
}

/** ¿La clase entra entera dentro de algún tramo del día? */
export const cabeEnTramos = (tramos: Tramo[], inicio: number, duracion: number): boolean =>
  tramos.some(([a, b]) => inicio >= a && inicio + duracion <= b);

/** "de 09:00 a 13:00 y de 16:00 a 20:00" */
export const horarioTxt = (tramos: Tramo[]): string => tramos.map(([a, b]) => `de ${hhmm(a)} a ${hhmm(b)}`).join(' y ');

export const seCruzan = (a: { startMin: number; durationMin: number }, b: { startMin: number; durationMin: number }): boolean =>
  a.startMin < b.startMin + b.durationMin && a.startMin + a.durationMin > b.startMin;

/** Desde qué día se puede reservar una clase en el sitio. */
export const aperturaDeReserva = (fecha: string, classOpenDays: number): string => sumarDias(fecha, -classOpenDays);

/**
 * Las clases de un rango, ordenadas por inicio. Una plantilla apagada o
 * borrada, o un día que el negocio no abre, no generan clase; pero una sesión
 * materializada con gente anotada se muestra igual (no se puede "perder" a
 * quien ya se anotó), sin poder reservarse.
 */
export function armarClases(
  plantillas: PlantillaArmable[],
  sesiones: SesionArmable[],
  conteos: ReadonlyMap<string, Conteo>,
  horario: HorarioNegocio,
  o: OpcionesArmado,
): ClaseDelDiaDto[] {
  const porId = new Map(plantillas.map((t) => [t.id, t]));
  const sesionDe = new Map(sesiones.map((s) => [`${s.templateId}:${s.date}`, s]));
  const hoy = fechaYMinutos(o.ahora).fecha;
  const limite = sumarDias(hoy, o.classOpenDays);
  const salida: ClaseDelDiaDto[] = [];
  const vistas = new Set<string>();

  const sumar = (t: PlantillaArmable, fecha: string, abre: boolean) => {
    const clave = `${t.id}:${fecha}`;
    if (vistas.has(clave)) return;
    const s = sesionDe.get(clave) ?? null;
    const c = (s && conteos.get(s.id)) || { enrolled: 0, waitlist: 0 };
    const vigente = abre && t.isActive && !t.deletedAt;
    if (!vigente && (!s || c.enrolled + c.waitlist === 0)) return;
    vistas.add(clave);
    const startsAt = s?.startsAt ?? instanteDe(fecha, t.startMin);
    const endsAt = s?.endsAt ?? instanteDe(fecha, t.startMin + t.durationMin);
    const isCancelled = s?.isCancelled ?? false;
    salida.push({
      templateId: t.id,
      sessionId: s?.id ?? null,
      date: fecha,
      startMin: fechaYMinutos(startsAt).minutos,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMin: Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
      serviceId: t.serviceId,
      serviceName: t.serviceName,
      instructorName: t.instructorName,
      roomName: t.roomName,
      capacity: s?.capacity ?? t.capacity,
      enrolled: c.enrolled,
      waitlist: c.waitlist,
      isCancelled,
      price: t.price,
      bookable: vigente && !isCancelled && startsAt.getTime() > o.ahora.getTime() && fecha <= limite,
    });
  };

  for (const fecha of fechasEntre(o.from, o.to)) {
    const abre = horarioDelNegocio(horario, fecha).tramos.length > 0;
    const dia = diaDeSemana(fecha);
    for (const t of plantillas) if (t.weekday === dia) sumar(t, fecha, abre);
  }
  // Sesiones con gente cuya plantilla ya no cae ese día (se cambió el día) o no vino en la lista.
  for (const s of sesiones) {
    const t = porId.get(s.templateId);
    if (t && s.date >= o.from && s.date <= o.to) sumar({ ...t, isActive: false }, s.date, false);
  }
  return salida.sort((a, b) => (a.startsAt === b.startsAt ? a.templateId.localeCompare(b.templateId) : a.startsAt < b.startsAt ? -1 : 1));
}

/** Lugares libres de una clase: el cupo menos los anotados y los lugares ofrecidos que todavía corren. */
export const lugaresLibres = (capacity: number, enrolled: number, ofertasVigentes: number): number =>
  Math.max(0, capacity - enrolled - ofertasVigentes);

/** Qué pasa con alguien que se anota: entra, va a la lista de espera o no hay lugar. */
export function decidirInscripcion(libres: number, waitlistEnabled: boolean): 'ENROLLED' | 'WAITLIST' | 'FULL' {
  if (libres > 0) return 'ENROLLED';
  return waitlistEnabled ? 'WAITLIST' : 'FULL';
}

type ReglasSena = Pick<ReglasReserva, 'depositEnabled' | 'depositType' | 'depositPercent' | 'depositFixed' | 'depositForNoShows'>;

/**
 * La seña de una inscripción (CONTRATO § 1.3) con el precio del servicio,
 * menos el crédito de señas que tenga a favor. Devuelve también cuánto
 * crédito se usa (se descuenta al crear).
 */
export function calcularSena(aPagar: number, reglas: ReglasSena, noShowCount: number, credito: number): { deposit: number; creditoUsado: number } {
  const pide = aPagar > 0 && (reglas.depositEnabled || (reglas.depositForNoShows && noShowCount > 0));
  if (!pide) return { deposit: 0, creditoUsado: 0 };
  const sena = reglas.depositType === 'percent' ? Math.round((aPagar * reglas.depositPercent) / 100) : Math.min(reglas.depositFixed, aPagar);
  const creditoUsado = Math.min(Math.max(credito, 0), sena);
  return { deposit: sena - creditoUsado, creditoUsado };
}

/** Descuento de bienvenida (CONTRATO § 1.3): redondeado al peso. */
export const descuentoBienvenida = (precio: number, porcentaje: number): number => Math.round((precio * porcentaje) / 100);
