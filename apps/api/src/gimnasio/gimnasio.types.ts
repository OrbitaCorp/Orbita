// Lo que la API de Gimnasio devuelve: los planes, los alumnos con sus planes y
// cómo quedó un lugar después de anotarlo. Los montos van como número y los
// días como AAAA-MM-DD de Argentina.
import { Customer, GimnasioAlumno, GimnasioPlan, GimnasioSuscripcion } from '@prisma/client';
import { restantesDe, usadasDe, type Pago, type Suscripcion, type TipoPlan, type Uso } from './dominio/planes';

export interface PlanDto {
  id: string;
  tipo: TipoPlan;
  nombre: string;
  precio: number;
  /** Pack: cuántas clases trae. */
  clases: number | null;
  /** Membresía: clases por semana; 0 = libre. */
  porSemana: number | null;
  vigenciaDias: number;
  /** Se ofrece en el sitio. */
  activo: boolean;
}

export const planDto = (p: GimnasioPlan): PlanDto => ({
  id: p.id, tipo: p.tipo, nombre: p.nombre, precio: Number(p.precio), clases: p.clases, porSemana: p.porSemana, vigenciaDias: p.vigenciaDias, activo: p.activo,
});

/** El plan de un alumno, con lo que usó. */
export interface SuscripcionDto {
  id: string;
  planId: string;
  tipo: TipoPlan;
  nombre: string;
  precio: number;
  clases: number | null;
  porSemana: number | null;
  /** AAAA-MM-DD, los dos días incluidos. */
  desde: string;
  hasta: string;
  estado: 'VIGENTE' | 'CANCELADA';
  /** Lugares que tomó con este plan (las reservas canceladas no cuentan). */
  usadas: number;
  /** Pack: las clases que le quedan. null si no es un pack. */
  restantes: number | null;
}

/** La suscripción como la usan las cuentas (dominio/planes). */
export const paraLasCuentas = (s: GimnasioSuscripcion): Suscripcion => ({
  id: s.id, planId: s.planId, tipo: s.tipo, clases: s.clases, porSemana: s.porSemana, desde: s.desde, hasta: s.hasta, estado: s.estado,
});

export function suscripcionDto(s: GimnasioSuscripcion, usos: Uso[]): SuscripcionDto {
  return {
    id: s.id, planId: s.planId, tipo: s.tipo, nombre: s.nombre, precio: Number(s.precio), clases: s.clases, porSemana: s.porSemana,
    desde: s.desde, hasta: s.hasta, estado: s.estado, usadas: usadasDe(s.id, usos), restantes: restantesDe(s, usos),
  };
}

export interface AlumnoDto {
  id: string;
  /** La ficha de cliente: es el `clienteId` de sus reservas. */
  clienteId: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  nota: string | null;
  /** Día de alta, AAAA-MM-DD. */
  alta: string;
  /** Ya usó la clase de prueba. */
  probo: boolean;
  /** Sus planes que valen hoy o arrancan después, del que vence primero al último. */
  planes: SuscripcionDto[];
  /** El último plan que tuvo, si hoy no le queda ninguno (para decir "venció el…"). */
  ultimo: SuscripcionDto | null;
}

export const nombreDeFicha = (c: Pick<Customer, 'firstName' | 'lastName'>): string => [c.firstName, c.lastName].filter(Boolean).join(' ').trim();

export function alumnoDto(
  a: GimnasioAlumno & { cliente: Pick<Customer, 'firstName' | 'lastName' | 'phone' | 'email'>; suscripciones: GimnasioSuscripcion[] },
  usos: Uso[],
  probo: boolean,
  hoy: string,
): AlumnoDto {
  const vigentes = a.suscripciones.filter((s) => s.estado === 'VIGENTE');
  const planes = vigentes.filter((s) => s.hasta >= hoy).sort((x, y) => x.hasta.localeCompare(y.hasta) || x.id.localeCompare(y.id));
  const pasadas = vigentes.filter((s) => s.hasta < hoy).sort((x, y) => y.hasta.localeCompare(x.hasta));
  return {
    id: a.id, clienteId: a.clienteId, nombre: nombreDeFicha(a.cliente) || 'Sin nombre', telefono: a.cliente.phone, email: a.cliente.email,
    nota: a.nota, alta: a.alta, probo,
    planes: planes.map((s) => suscripcionDto(s, usos)),
    ultimo: planes.length === 0 && pasadas[0] ? suscripcionDto(pasadas[0], usos) : null,
  };
}

/** Cómo quedó pago un lugar, para el aviso del panel ("Pack de 8: le quedan 3"). */
export interface PagoDto {
  /** null: todavía no se dijo cómo se paga (pasó de la lista de espera o reservó desde el sitio). */
  pago: Pago | null;
  /** El plan con el que se pagó (pago 'plan'), como quedó después de este lugar. */
  plan: SuscripcionDto | null;
  /** Membresía con tope: cuántas usó esa semana, contando esta. */
  usadasEnLaSemana: number | null;
}
