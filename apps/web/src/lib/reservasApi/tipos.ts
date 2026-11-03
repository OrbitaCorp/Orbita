// Lo que devuelve y recibe la API de reservas (apps/api/src/reservas): el
// contrato que comparten Turnos, Alquileres y Gimnasio. Copia de
// apps/api/src/reservas/reservas.types.ts y de los DTOs: si cambia algo allá,
// cambia acá. Ningún módulo importa de otro; los tres importan de acá.

export type Modulo = 'TURNOS' | 'ALQUILERES' | 'GIMNASIO'
export type TipoRecurso = 'PROFESIONAL' | 'ESPACIO' | 'CANCHA' | 'SALON' | 'ALOJAMIENTO' | 'CLASE'
export type Estado = 'RETENIDA' | 'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA' | 'VENCIDA' | 'AUSENTE'
export type Origen = 'TIENDA' | 'PANEL'
export type Actor = 'CLIENTE' | 'NEGOCIO' | 'SISTEMA'
export type Confirmacion = 'AUTOMATICA' | 'MANUAL'
export type EstadoEspera = 'ESPERANDO' | 'TOMADA' | 'CANCELADA'
export type MetodoDePago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MERCADOPAGO' | 'OTRO'
export type SenaAlCancelar = 'DEVUELTA' | 'PERDIDA' | 'SIN_SENA'

/** Estados que ocupan lugar en el recurso. */
export const OCUPAN: readonly Estado[] = ['RETENIDA', 'PENDIENTE', 'CONFIRMADA']

/** [desde, hasta) en minutos desde las 00:00 de Argentina. */
export type Tramo = [number, number]
/** Por día de la semana (0 = domingo … 6 = sábado), los tramos abiertos. En una clase, cada tramo es una sesión. */
export type HorarioSemanal = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', Tramo[]>>

export interface Extra { id: string; nombre: string; precio: number }

/** Lo que `datos` puede traer según el tipo de recurso. Cada módulo agrega lo suyo. */
export interface DatosRecurso {
  extras?: Extra[]
  /** Alojamientos: minutos del día. */
  checkIn?: number
  checkOut?: number
  nochesMinimas?: number
  [clave: string]: unknown
}

export interface Config {
  modulo: Modulo
  activo: boolean
  confirmacion: Confirmacion
  retencionMinutos: number
  anticipacionMinimaMinutos: number
  anticipacionMaximaDias: number
  cancelacionHastaHoras: number
  reprogramacionHastaHoras: number
  reprogramacionesMaximas: number
  senaPorcentaje: number
  senaReembolsable: boolean
  maximoActivasPorCliente: number
  listaDeEspera: boolean
  margenMinutos: number
  horario: HorarioSemanal
}

/** Lo que el sitio público ve de la config. */
export type ConfigPublica = Pick<Config,
  'modulo' | 'confirmacion' | 'retencionMinutos' | 'anticipacionMinimaMinutos' | 'anticipacionMaximaDias' | 'cancelacionHastaHoras'
  | 'reprogramacionHastaHoras' | 'reprogramacionesMaximas' | 'senaPorcentaje' | 'senaReembolsable' | 'listaDeEspera' | 'horario'>

export interface Recurso {
  id: string
  modulo: Modulo
  tipo: TipoRecurso
  nombre: string
  descripcion: string | null
  cupo: number
  duracionMinutos: number | null
  pasoMinutos: number | null
  margenMinutos: number | null
  maximoSeguidos: number
  precio: number
  horario: HorarioSemanal | null
  datos: DatosRecurso | null
  /** Solo en el panel. */
  memberId?: string | null
  orden: number
  activo: boolean
}

export interface Servicio {
  id: string
  modulo: Modulo
  nombre: string
  descripcion: string | null
  duracionMinutos: number
  precio: number
  reservableOnline: boolean
  recursoIds: string[]
  orden: number
  activo: boolean
}

export interface ServicioFoto { id: string; nombre: string; duracionMinutos: number; precio: number }

export interface Reserva {
  id: string
  modulo: Modulo
  recursoId: string
  servicioId: string | null
  codigo: string
  estado: Estado
  origen: Origen
  /** Instantes ISO (UTC). */
  inicio: string
  fin: string
  /** El día de Argentina y los minutos desde sus 00:00, para dibujar. */
  fecha: string
  inicioMinutos: number
  finMinutos: number
  cantidad: number
  retenidaHasta: string | null
  clienteId: string | null
  clienteNombre: string
  clienteTelefono: string | null
  clienteEmail: string | null
  notas: string | null
  /** Solo en el panel. */
  notaInterna?: string | null
  servicio: ServicioFoto | null
  extras: Extra[] | null
  precio: number
  sena: number
  pagado: number
  pagoMetodo: string | null
  confirmadaEn: string | null
  completadaEn: string | null
  canceladaEn: string | null
  canceladaPor: Actor | null
  motivoCancelacion: string | null
  reprogramaciones: number
  version: number
  creadaEn: string
}

/** La reserva recién creada o confirmada desde el sitio: trae el token del enlace personal (una sola vez). */
export interface ReservaConToken extends Reserva { token: string }

export interface Politica {
  puedeCancelar: boolean
  puedeReprogramar: boolean
  cancelarHasta: string | null
  reprogramarHasta: string | null
  reprogramacionesRestantes: number
  senaSiCancela: SenaAlCancelar
  motivo: string | null
}

export interface MiReserva {
  reserva: Reserva
  politica: Politica
  recurso: { id: string; nombre: string; tipo: TipoRecurso } | null
  negocio: { nombre: string }
}

export interface Franja {
  inicioMinutos: number
  finMinutos: number
  libres: number
  cupo: number
  /** Canchas: cuántas franjas seguidas se pueden tomar desde esta. */
  seguidas?: number
}

export interface DisponibilidadDia {
  fecha: string
  recursoId: string
  duracionMinutos: number
  cerrado: boolean
  franjas: Franja[]
}

export interface DisponibilidadRango {
  recursoId: string
  dias: { fecha: string; libres: number; cerrado: boolean }[]
}

export interface Noches {
  recursoId: string
  /** Noches ocupadas o bloqueadas: el día en que empieza cada una. */
  ocupadas: string[]
  nochesMinimas: number
  checkInMinutos: number
  checkOutMinutos: number
}

export interface Historial {
  id: string
  de: Estado | null
  a: Estado
  quien: Actor
  memberId: string | null
  motivo: string | null
  datos: unknown
  createdAt: string
}

export interface Bloqueo {
  id: string
  modulo: Modulo
  recursoId: string | null
  inicio: string
  fin: string
  motivo: string | null
  createdAt: string
}

export interface Espera {
  id: string
  modulo: Modulo
  recursoId: string
  inicio: string
  fin: string
  clienteId: string | null
  clienteNombre: string
  clienteTelefono: string | null
  clienteEmail: string | null
  estado: EstadoEspera
  reservaId: string | null
  createdAt: string
}

export interface MiEspera {
  id: string
  estado: EstadoEspera
  posicion: number | null
  inicio: string
  fin: string
  reserva: ReservaConToken | null
}

export interface Resumen {
  desde: string
  hasta: string
  porEstado: Partial<Record<Estado, number>>
  ingresos: number
  cobrado: number
}

export interface Paginado<T> { data: T[]; total: number; page: number; limit: number }

// ─── Lo que se manda ─────────────────────────────────────────────────────────

export interface Cliente { nombre: string; telefono?: string; email?: string }

/** Qué se quiere reservar. */
export interface Pedido {
  modulo: Modulo
  recursoId: string
  servicioId?: string
  fecha: string
  /** Minutos de Argentina. Un alojamiento lo ignora. */
  inicioMinutos?: number
  /** Canchas y salones: minutos totales (múltiplo de la duración del recurso). */
  duracionMinutos?: number
  /** Alojamientos: día del check-out. */
  fechaHasta?: string
  /** Lugares (clases). */
  cantidad?: number
  extras?: string[]
  notas?: string
}

/** Sitio, paso 1. `clave`: un uuid por intento (repetirlo devuelve la misma reserva). */
export interface Retener extends Pedido { clave: string }
/** Sitio, en un paso. */
export interface Reservar extends Retener { cliente: Cliente }
/** Sitio, paso 2. */
export interface Confirmar { cliente: Cliente; notas?: string }

export interface CrearDesdePanel extends Pedido {
  cliente?: Cliente
  clienteId?: string
  notaInterna?: string
  /** Exige reservas.config. */
  precio?: number
  estado?: 'CONFIRMADA' | 'PENDIENTE'
  fueraDeHorario?: boolean
  clave?: string
}

export interface Cancelar { motivo?: string; mantenerSena?: boolean; version?: number }
export interface Reprogramar { fecha: string; inicioMinutos?: number; fechaHasta?: string; recursoId?: string; fueraDeHorario?: boolean; version?: number }
export interface CambioDeEstado { motivo?: string; version?: number }
export interface Pago { monto: number; metodo: MetodoDePago; referencia?: string }

export type GuardarConfig = { modulo: Modulo } & Partial<Omit<Config, 'modulo'>>

export interface GuardarRecurso {
  modulo: Modulo
  tipo: TipoRecurso
  nombre: string
  descripcion?: string
  cupo?: number
  duracionMinutos?: number | null
  pasoMinutos?: number | null
  margenMinutos?: number | null
  maximoSeguidos?: number
  precio?: number
  horario?: HorarioSemanal | null
  datos?: DatosRecurso | null
  memberId?: string | null
  orden?: number
  activo?: boolean
}

export interface GuardarServicio {
  modulo: Modulo
  nombre: string
  descripcion?: string
  duracionMinutos: number
  precio?: number
  reservableOnline?: boolean
  recursoIds?: string[]
  orden?: number
  activo?: boolean
}

export interface CrearBloqueo {
  modulo: Modulo
  recursoId?: string
  fechaDesde: string
  minutoDesde?: number
  fechaHasta?: string
  minutoHasta?: number
  motivo?: string
}

export interface AnotarseEnEspera {
  modulo: Modulo
  recursoId: string
  fecha: string
  inicioMinutos: number
  cliente: Cliente
}

export interface FiltroAgenda {
  modulo?: Modulo
  desde?: string
  hasta?: string
  recursoId?: string
  clienteId?: string
  estado?: Estado[]
  q?: string
  page?: number
  limit?: number
}
