// Lo que devuelven los endpoints de reservas. Es el contrato que leen los
// paneles y los sitios de Turnos, Alquileres y Gimnasio (apps/web/src/lib/
// reservasApi/tipos.ts lo copia): si cambia algo acá, cambia allá.
import { Prisma, Reserva, ReservaActor, ReservaConfig, ReservaEspera, ReservaEstado, ReservaModulo, ReservaRecurso, ReservaServicio } from '@prisma/client';
import { fechaYMinutos } from './dominio/tiempo';

export interface RecursoDto {
  id: string;
  modulo: ReservaModulo;
  tipo: ReservaRecurso['tipo'];
  nombre: string;
  descripcion: string | null;
  cupo: number;
  duracionMinutos: number | null;
  pasoMinutos: number | null;
  margenMinutos: number | null;
  maximoSeguidos: number;
  precio: number;
  horario: unknown;
  datos: unknown;
  memberId: string | null;
  orden: number;
  activo: boolean;
}

export interface ServicioDto {
  id: string;
  modulo: ReservaModulo;
  nombre: string;
  descripcion: string | null;
  duracionMinutos: number;
  precio: number;
  reservableOnline: boolean;
  recursoIds: string[];
  orden: number;
  activo: boolean;
}

export interface ConfigDto {
  modulo: ReservaModulo;
  activo: boolean;
  confirmacion: ReservaConfig['confirmacion'];
  retencionMinutos: number;
  anticipacionMinimaMinutos: number;
  anticipacionMaximaDias: number;
  cancelacionHastaHoras: number;
  reprogramacionHastaHoras: number;
  reprogramacionesMaximas: number;
  senaPorcentaje: number;
  senaReembolsable: boolean;
  maximoActivasPorCliente: number;
  listaDeEspera: boolean;
  margenMinutos: number;
  horario: unknown;
  /** Lo propio del módulo: el motor no lo interpreta. */
  datos: unknown;
}

export interface ReservaDto {
  id: string;
  modulo: ReservaModulo;
  recursoId: string;
  servicioId: string | null;
  codigo: string;
  estado: ReservaEstado;
  origen: Reserva['origen'];
  /** Instantes ISO (UTC) y, para dibujar, el día y los minutos de Argentina. */
  inicio: string;
  fin: string;
  fecha: string;
  inicioMinutos: number;
  finMinutos: number;
  cantidad: number;
  retenidaHasta: string | null;
  clienteId: string | null;
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteEmail: string | null;
  notas: string | null;
  /** Solo en el panel. */
  notaInterna?: string | null;
  servicio: unknown;
  extras: unknown;
  /** Lo propio del módulo: el motor no lo interpreta. */
  datos: unknown;
  precio: number;
  sena: number;
  pagado: number;
  pagoMetodo: string | null;
  confirmadaEn: string | null;
  completadaEn: string | null;
  canceladaEn: string | null;
  canceladaPor: ReservaActor | null;
  motivoCancelacion: string | null;
  reprogramaciones: number;
  version: number;
  creadaEn: string;
}

/**
 * Alguien en la lista de espera, como lo ve el panel. Sin `tokenAcceso`: ese
 * token es el enlace personal de la persona (con él sale de la lista desde el
 * sitio) y no tiene por qué viajar al panel.
 */
export interface EsperaDto {
  id: string;
  modulo: ReservaModulo;
  recursoId: string;
  inicio: string;
  fin: string;
  clienteId: string | null;
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteEmail: string | null;
  /** Turnos: el servicio que eligió. */
  servicioId: string | null;
  estado: ReservaEspera['estado'];
  reservaId: string | null;
  createdAt: string;
}

/** Lo que el cliente puede hacer con su reserva ahora mismo, según las reglas del negocio. */
export interface PoliticaDto {
  puedeCancelar: boolean;
  puedeReprogramar: boolean;
  /** Hasta cuándo (ISO) puede cancelar o reprogramar por su cuenta; null si ya no. */
  cancelarHasta: string | null;
  reprogramarHasta: string | null;
  reprogramacionesRestantes: number;
  /** Qué pasa con lo pagado si cancela ahora. */
  senaSiCancela: 'DEVUELTA' | 'PERDIDA' | 'SIN_SENA';
  /** Por qué no puede, en una línea, cuando no puede. */
  motivo: string | null;
}

export interface FranjaDto {
  inicioMinutos: number;
  finMinutos: number;
  libres: number;
  cupo: number;
  /** Canchas: cuántas franjas seguidas se pueden tomar desde esta. */
  seguidas?: number;
}

export interface DisponibilidadDiaDto {
  fecha: string;
  recursoId: string;
  duracionMinutos: number;
  cerrado: boolean;
  franjas: FranjaDto[];
}

export interface DisponibilidadRangoDto {
  recursoId: string;
  dias: { fecha: string; libres: number; cerrado: boolean }[];
}

export interface NochesDto {
  recursoId: string;
  /** Noches ocupadas o bloqueadas (el día en que empieza cada noche). */
  ocupadas: string[];
  nochesMinimas: number;
  checkInMinutos: number;
  checkOutMinutos: number;
}

/** Una sesión de una clase en un día: cuántos lugares tiene y cuántos quedan. */
export interface SesionDto {
  recursoId: string;
  inicioMinutos: number;
  finMinutos: number;
  libres: number;
  cupo: number;
}

/**
 * Las sesiones de todas las clases de un módulo, día por día
 * (DisponibilidadService.sesionesEntre). `cerrado`: el negocio bloqueó el día
 * entero para todo el módulo (un feriado, vacaciones); `motivo` es el que
 * cargó, para mostrarlo en el sitio.
 */
export interface SesionesDto {
  desde: string;
  hasta: string;
  dias: { fecha: string; cerrado: boolean; motivo: string | null; sesiones: SesionDto[] }[];
}

export const aNumero = (d: Prisma.Decimal | number | null | undefined): number => (d === null || d === undefined ? 0 : Number(d));

export function recursoDto(r: ReservaRecurso): RecursoDto {
  return {
    id: r.id, modulo: r.modulo, tipo: r.tipo, nombre: r.nombre, descripcion: r.descripcion, cupo: r.cupo,
    duracionMinutos: r.duracionMinutos, pasoMinutos: r.pasoMinutos, margenMinutos: r.margenMinutos, maximoSeguidos: r.maximoSeguidos,
    precio: aNumero(r.precio), horario: r.horario, datos: r.datos, memberId: r.memberId, orden: r.orden, activo: r.activo,
  };
}

export function servicioDto(s: ReservaServicio): ServicioDto {
  return {
    id: s.id, modulo: s.modulo, nombre: s.nombre, descripcion: s.descripcion, duracionMinutos: s.duracionMinutos,
    precio: aNumero(s.precio), reservableOnline: s.reservableOnline, recursoIds: s.recursoIds, orden: s.orden, activo: s.activo,
  };
}

export function configDto(c: ReservaConfig): ConfigDto {
  return {
    modulo: c.modulo, activo: c.activo, confirmacion: c.confirmacion, retencionMinutos: c.retencionMinutos,
    anticipacionMinimaMinutos: c.anticipacionMinimaMinutos, anticipacionMaximaDias: c.anticipacionMaximaDias,
    cancelacionHastaHoras: c.cancelacionHastaHoras, reprogramacionHastaHoras: c.reprogramacionHastaHoras,
    reprogramacionesMaximas: c.reprogramacionesMaximas, senaPorcentaje: c.senaPorcentaje, senaReembolsable: c.senaReembolsable,
    maximoActivasPorCliente: c.maximoActivasPorCliente, listaDeEspera: c.listaDeEspera, margenMinutos: c.margenMinutos, horario: c.horario,
    datos: c.datos ?? null,
  };
}

/** De `datos` de la config, lo único que sale al sitio: lo que el módulo puso en `publico`. */
export function datosPublicos(datos: unknown): Record<string, unknown> | null {
  const publico = datos && typeof datos === 'object' && !Array.isArray(datos) ? (datos as Record<string, unknown>).publico : null;
  return publico && typeof publico === 'object' && !Array.isArray(publico) ? (publico as Record<string, unknown>) : null;
}

/** Lo público de la config: lo que el sitio necesita para dibujar el flujo, sin nada interno. */
export function configPublicaDto(c: ReservaConfig) {
  return {
    modulo: c.modulo, confirmacion: c.confirmacion, retencionMinutos: c.retencionMinutos,
    anticipacionMinimaMinutos: c.anticipacionMinimaMinutos, anticipacionMaximaDias: c.anticipacionMaximaDias,
    cancelacionHastaHoras: c.cancelacionHastaHoras, reprogramacionHastaHoras: c.reprogramacionHastaHoras,
    reprogramacionesMaximas: c.reprogramacionesMaximas, senaPorcentaje: c.senaPorcentaje, senaReembolsable: c.senaReembolsable,
    listaDeEspera: c.listaDeEspera, horario: c.horario, publico: datosPublicos(c.datos),
  };
}

export function esperaDto(e: ReservaEspera): EsperaDto {
  return {
    id: e.id, modulo: e.modulo, recursoId: e.recursoId, inicio: e.inicio.toISOString(), fin: e.fin.toISOString(),
    clienteId: e.clienteId, clienteNombre: e.clienteNombre, clienteTelefono: e.clienteTelefono, clienteEmail: e.clienteEmail,
    servicioId: e.servicioId, estado: e.estado, reservaId: e.reservaId, createdAt: e.createdAt.toISOString(),
  };
}

export function reservaDto(r: Reserva, opciones: { panel: boolean }): ReservaDto {
  const ini = fechaYMinutos(r.inicio);
  const finMin = Math.round((r.fin.getTime() - r.inicio.getTime()) / 60_000) + ini.minutos;
  return {
    id: r.id, modulo: r.modulo, recursoId: r.recursoId, servicioId: r.servicioId, codigo: r.codigo, estado: r.estado, origen: r.origen,
    inicio: r.inicio.toISOString(), fin: r.fin.toISOString(), fecha: r.fecha, inicioMinutos: ini.minutos, finMinutos: finMin,
    cantidad: r.cantidad, retenidaHasta: r.retenidaHasta?.toISOString() ?? null,
    clienteId: r.clienteId, clienteNombre: r.clienteNombre, clienteTelefono: r.clienteTelefono, clienteEmail: r.clienteEmail,
    notas: r.notas, ...(opciones.panel ? { notaInterna: r.notaInterna } : {}),
    servicio: r.servicio, extras: r.extras, datos: r.datos ?? null, precio: aNumero(r.precio), sena: aNumero(r.sena), pagado: aNumero(r.pagado), pagoMetodo: r.pagoMetodo,
    confirmadaEn: r.confirmadaEn?.toISOString() ?? null, completadaEn: r.completadaEn?.toISOString() ?? null,
    canceladaEn: r.canceladaEn?.toISOString() ?? null, canceladaPor: r.canceladaPor, motivoCancelacion: r.motivoCancelacion,
    reprogramaciones: r.reprogramaciones, version: r.version, creadaEn: r.createdAt.toISOString(),
  };
}
