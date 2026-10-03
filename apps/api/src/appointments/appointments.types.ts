// Tipos de respuesta COMPARTIDOS de la API de Turnos. Son el contrato con el
// frontend: lo que describe CONTRATO.md con palabras, acá está con tipos. Los
// services devuelven estas formas; los DTO de entrada viven en dto/ de cada
// paquete (class-validator), no acá.
//
// Convenciones de serialización (valen para todo el módulo):
// - Plata: `number` en pesos (los Decimal de Prisma se convierten con Number()).
// - Instantes: string ISO 8601 en UTC ("2026-10-05T13:00:00.000Z").
// - Días: "YYYY-MM-DD" del día argentino.
// - Horas del día: minutos desde las 00:00 de Argentina.
// - Día de la semana: 0 = lunes … 6 = domingo.
// - Los enums viajan con el valor de Prisma (CONFIRMED, PERSON, ON_SITE…).
import type {
  AppointmentAgendaMode, AppointmentCancelledBy, AppointmentEnrollmentStatus, AppointmentGiftCardKind,
  AppointmentMembershipStatus, AppointmentMessageChannel, AppointmentMessageStatus, AppointmentModality, AppointmentOrigin, AppointmentPayEvery, AppointmentPayForm,
  AppointmentPaymentKind, AppointmentPayoutDirection, AppointmentRecurrence, AppointmentResourceKind,
  AppointmentSpecialDayKind, AppointmentStatus, AppointmentWaitlistStatus, PaymentMethod, PaymentStatus,
} from '@prisma/client';
import type { AlcancesTurnos } from './catalogo/roles';
import type { SemanaTurnos, Tramo } from './horarios/horarios';
import type { MotivoSinHorarios } from './disponibilidad/disponibilidad';

export type Iso = string;
export type Fecha = string;

// ─── Estado visible ──────────────────────────────────────────────────────────

/**
 * Lo que muestra la agenda. Es el estado guardado más "en curso", que no se
 * persiste: un turno CONFIRMED cuyo horario contiene a "ahora".
 */
export type EstadoVisible = AppointmentStatus | 'IN_PROGRESS';

export function estadoVisible(t: { status: AppointmentStatus; startsAt: Date; endsAt: Date }, ahora: Date): EstadoVisible {
  return t.status === 'CONFIRMED' && t.startsAt.getTime() <= ahora.getTime() && ahora.getTime() < t.endsAt.getTime() ? 'IN_PROGRESS' : t.status;
}

/**
 * Transiciones de estado que permite el panel (las mismas que la demo):
 * - PENDING   → CONFIRMED, CANCELLED (y NO_SHOW si el turno ya empezó).
 * - CONFIRMED → COMPLETED y NO_SHOW (solo si ya empezó), CANCELLED.
 * - COMPLETED, NO_SHOW y CANCELLED son finales: no se sale de ahí.
 * "Ya empezó" = startsAt <= ahora.
 */
export const TRANSICIONES: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ['CONFIRMED', 'NO_SHOW', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

/** Estados a los que solo se puede pasar cuando el turno ya empezó. */
export const SOLO_SI_YA_EMPEZO: AppointmentStatus[] = ['COMPLETED', 'NO_SHOW'];

/** ¿Se puede pasar de un estado a otro ahora? */
export function puedePasarA(t: { status: AppointmentStatus; startsAt: Date }, nuevo: AppointmentStatus, ahora: Date): boolean {
  if (!TRANSICIONES[t.status].includes(nuevo)) return false;
  return !SOLO_SI_YA_EMPEZO.includes(nuevo) || t.startsAt.getTime() <= ahora.getTime();
}

/** Los estados que ocupan lugar en la agenda y cuentan para el límite por cliente. */
export const ESTADOS_ACTIVOS: AppointmentStatus[] = ['PENDING', 'CONFIRMED'];

// ─── Configuración ───────────────────────────────────────────────────────────

/** `AppointmentSettings.appearance`. Lo que falta vale lo de la plantilla. */
export interface AparienciaTurnos {
  plantilla?: string;
  /** #RRGGBB. */
  color?: string;
  /** id del par tipográfico. */
  tipo?: string;
  /** Radio de los bordes, en px. */
  radio?: number;
  /** URL de la foto de portada; '' = la de la plantilla. */
  foto?: string;
  estiloBoton?: 'relleno' | 'borde' | 'suave' | null;
  hero?: 'sangre' | 'partido' | null;
  monograma?: boolean;
  secciones?: { id: string; on: boolean }[];
  /** Textos del sitio: nombre a mostrar, frase y texto del botón. */
  nombre?: string;
  frase?: string;
  boton?: string;
}

export type CanalMensaje = 'wa' | 'email';
export type MensajeId = 'confirmacion' | 'recordatorio' | 'recordatorio2' | 'cancelacion' | 'reprogramacion' | 'espera' | 'extranamos';

export interface MensajeAutomatico {
  id: MensajeId;
  on: boolean;
  canales: CanalMensaje[];
  /** Horas antes (recordatorios) o días después (extranamos), como texto: "24", "2", "60". '' si no aplica. */
  cuando: string;
  /** Con variables {nombre} {servicio} {fecha} {hora} {profesional} {negocio} {link}. */
  texto: string;
}

/** `AppointmentSettings.messages`. */
export interface MensajesTurnos {
  wa: boolean;
  email: boolean;
  /** Número de WhatsApp desde el que salen. */
  numero: string;
  firma: boolean;
  mensajes: MensajeAutomatico[];
}

export type FuncionAvanzada = 'paquetes' | 'membresias' | 'gift-cards' | 'fidelidad' | 'turno-fijo' | 'recuperar' | 'precios-horario' | 'plantillas';

/** Config de cada función de Avanzado que no tiene tabla propia (va en `advanced[funcion].config`). */
export interface ConfigAvanzado {
  paquetes?: { compartir: boolean; avisoUltimas: boolean; avisoVence: boolean };
  membresias?: { renueva: boolean; diaCobro: number; pausa: boolean; diasPausa: number; matricula: number };
  'gift-cards'?: { montoLibre: boolean; montos: number[]; mesesValidez: number; saldoAFavor: boolean };
  fidelidad?: {
    sellos: number; premio: 'gratis' | 'descuento'; serviceId: string | null; pct: number;
    suma: 'todos' | 'desde'; minimo: number; icono: 'rubro' | 'estrella' | 'corazon' | 'sello'; vencenMeses: number; selloDeBienvenida: boolean;
  };
  'turno-fijo'?: { frecuencias: AppointmentRecurrence[]; maximo: number; serviceIds: string[]; cobro: 'cada' | 'mes'; liberarAusencias: number; saltearFeriados: boolean };
  'precios-horario'?: { mostrarTachado: boolean };
  recuperar?: Record<string, never>;
  plantillas?: Record<string, never>;
}

/** `AppointmentSettings.advanced`. */
export type AvanzadoTurnos = { [F in FuncionAvanzada]?: { on: boolean; config?: ConfigAvanzado[F] } };

export interface ReglasReserva {
  minAdvanceMin: number;
  maxAdvanceDays: number;
  slotMin: number;
  bufferMin: number;
  confirmation: 'auto' | 'manual';
  letChooseResource: boolean;
  offerAnyResource: boolean;
  maxActivePerCustomer: number;
  waitlistEnabled: boolean;
  waitlistAcceptMin: number;
  classDefaultCapacity: number;
  classOpenDays: number;
  classMinEnrolled: number;
  askInsurance: boolean;
  askDni: boolean;
  askReason: boolean;
  rescheduleEnabled: boolean;
  rescheduleUntilHours: number;
  rescheduleMax: number;
  depositEnabled: boolean;
  depositType: 'percent' | 'fixed';
  depositPercent: number;
  depositFixed: number;
  depositForNoShows: boolean;
}

export interface PoliticaReserva {
  cancelUntilHours: number;
  depositOutOfWindow: 'forfeit' | 'credit';
  toleranceMin: number;
}

export interface BeneficiosCuenta {
  accountEnabled: boolean;
  welcomeDiscountPercent: number;
  loyaltyStamps: number;
  promosEnabled: boolean;
}

export interface DiaEspecialDto {
  id: string;
  date: Fecha;
  kind: AppointmentSpecialDayKind;
  ranges: Tramo[];
  reason: string | null;
}

export interface HorariosDto {
  weekSchedule: SemanaTurnos;
  specialDays: DiaEspecialDto[];
  vacation: { enabled: boolean; from: Fecha | null; to: Fecha | null; message: string | null };
}

export interface NegocioDto {
  name: string;
  description: string | null;
  logoUrl: string | null;
  subdomain: string;
  /** Dirección y mapa: los de la sucursal principal. */
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  neighborhood: string | null;
  floor: string | null;
  directions: string | null;
  homeZones: string | null;
  modalities: AppointmentModality[];
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
}

export interface PagosDto {
  mercadopago: { connected: boolean; mpUserName: string | null };
  onlineCharge: 'deposit' | 'total' | 'customer_choice';
  onSiteMethods: PaymentMethod[];
  transferAlias: string | null;
  transferCbu: string | null;
  transferHolder: string | null;
  showTransferData: boolean;
}

/** GET /appointments/settings: todo lo que configura el dueño, por pestaña. */
export interface SettingsDto {
  rubroKey: string;
  agendaMode: AppointmentAgendaMode;
  business: NegocioDto;
  site: { siteForm: 'web' | 'simple'; simpleDesign: string; appearance: AparienciaTurnos | null };
  schedule: HorariosDto;
  rules: ReglasReserva;
  policy: PoliticaReserva;
  account: BeneficiosCuenta;
  payments: PagosDto;
  messages: MensajesTurnos;
  /** Conexión de WhatsApp. `provider` es el que está activo en el servidor: 'stub' = los mensajes se registran pero no se envían. */
  whatsapp: { connected: boolean; number: string | null; provider: 'stub' | string };
  advanced: AvanzadoTurnos;
  /** El negocio tiene el paquete Avanzado activo. */
  hasAdvanced: boolean;
}

// ─── Servicios y agendas ─────────────────────────────────────────────────────

export interface ServicioDto {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
  bookableOnline: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface FormaDePagoDto {
  payForm: AppointmentPayForm;
  commissionPercent: number;
  salary: number;
  rent: number;
  perClass: number;
  payEvery: AppointmentPayEvery;
}

export interface RecursoDto {
  id: string;
  kind: AppointmentResourceKind;
  name: string;
  roleLabel: string | null;
  color: string | null;
  photoUrl: string | null;
  bio: string | null;
  isBookable: boolean;
  assignedSpaceId: string | null;
  workDays: number[];
  ownSchedule: SemanaTurnos | null;
  isActive: boolean;
  sortOrder: number;
}

/** Una persona del equipo: su agenda (si tiene), su acceso al panel y cómo cobra. */
export interface PersonaDto extends RecursoDto {
  kind: 'PERSON';
  /** null = no tiene login en el panel. */
  member: { id: string; email: string; status: 'ACTIVE' | 'PENDING'; roleId: string; roleName: string; isOwner: boolean } | null;
  email: string | null;
  phone: string | null;
  /** null = es el dueño: lo que factura queda para el negocio. */
  pay: FormaDePagoDto | null;
}

export interface RolTurnosDto {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  /** El del dueño: puede todo, no se cambia ni se borra. */
  isOwner: boolean;
  /** Key del rol de fábrica del que salió; null = lo creó el dueño. */
  factoryKey: string | null;
  /** Un rol de fábrica que se cambió respecto de cómo viene para el rubro. */
  changed: boolean;
  takesAppointments: boolean;
  permissions: string[];
  /** Los mismos permisos, como alcances (todo / propio / no). */
  scopes: AlcancesTurnos;
  members: number;
}

// ─── Turnos ──────────────────────────────────────────────────────────────────

export interface ClienteDelTurno {
  /** null = reservó sin cuenta y no está vinculado a una ficha. */
  id: string | null;
  name: string;
  /** Tapado ("•••• ••55-0101") si quien mira no tiene appointments.clients.contact. */
  phone: string;
  email: string | null;
}

export interface TurnoDto {
  id: string;
  code: string;
  status: AppointmentStatus;
  /** Con "en curso" calculado. */
  visibleStatus: EstadoVisible;
  origin: AppointmentOrigin;
  modality: AppointmentModality;
  resourceId: string;
  resourceName: string;
  serviceId: string;
  serviceName: string;
  customer: ClienteDelTurno;
  date: Fecha;
  startMin: number;
  startsAt: Iso;
  endsAt: Iso;
  durationMin: number;
  price: number;
  discountAmount: number;
  /** price - discountAmount. */
  total: number;
  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt: Iso | null;
  depositMethod: PaymentMethod | null;
  rescheduleCount: number;
  customerNote: string | null;
  internalNote: string | null;
  recurringSeriesId: string | null;
}

/** GET /appointments/:id */
export interface TurnoDetalleDto extends TurnoDto {
  customerAddress: string | null;
  customerDni: string | null;
  insuranceName: string | null;
  insuranceNumber: string | null;
  reason: string | null;
  confirmedAt: Iso | null;
  completedAt: Iso | null;
  cancelledAt: Iso | null;
  cancelledBy: AppointmentCancelledBy | null;
  cancelReason: string | null;
  wantsReminder: boolean;
  reminderSentAt: Iso | null;
  packagePurchaseId: string | null;
  giftCardId: string | null;
  membershipId: string | null;
  createdByMemberName: string | null;
  createdAt: Iso;
  payments: PagoTurnoDto[];
  messages: MensajeEnviadoDto[];
  /** Qué puede hacer con este turno quien lo está mirando. */
  can: { edit: boolean; charge: boolean; contact: boolean; transitions: AppointmentStatus[] };
}

export interface PagoTurnoDto {
  id: string;
  kind: AppointmentPaymentKind;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  paidAt: Iso | null;
  reference: string | null;
  registeredByMemberName: string | null;
}

export interface HorarioLibreDto {
  startMin: number;
  startsAt: Iso;
  endsAt: Iso;
  resourceId: string;
  /** Precio del servicio a esa hora, con el ajuste de "Precios por horario" si aplica. */
  price: number;
  /** % del ajuste aplicado; 0 si no hay. */
  adjustPercent: number;
}

export interface DisponibilidadDiaDto {
  date: Fecha;
  closed: boolean;
  reason: MotivoSinHorarios | null;
  /** Mensaje de vacaciones, si el motivo es ese. */
  message: string | null;
  slots: HorarioLibreDto[];
}

export interface DisponibilidadRangoDto {
  days: { date: Fecha; closed: boolean; reason: MotivoSinHorarios | null; free: number; firstStartMin: number | null }[];
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

/** Un renglón de appointment_message_logs, para "qué se le mandó" en el detalle del turno. */
export interface MensajeEnviadoDto {
  id: string;
  channel: AppointmentMessageChannel;
  template: MensajeId;
  /** Tapado si quien mira no tiene appointments.clients.contact. */
  recipient: string;
  status: AppointmentMessageStatus;
  error: string | null;
  createdAt: Iso;
}

/** El texto de una plantilla ya armado para un turno, para mandarlo a mano (wa.me) mientras no haya proveedor real. */
export interface MensajeRenderizadoDto {
  template: MensajeId;
  text: string;
  /** Teléfono en formato internacional sin "+", listo para wa.me; null si quien mira no puede ver contactos o no hay teléfono. */
  phone: string | null;
  /** https://wa.me/<phone>?text=<texto> ; null si no hay teléfono. */
  waLink: string | null;
}

/**
 * Proveedor de WhatsApp. Hoy solo existe el STUB (loguea "[WHATSAPP STUB]" y
 * devuelve SIMULATED, igual que el modo STUB de MailService). El real se elige
 * por variable de entorno (WHATSAPP_PROVIDER) y queda para después.
 */
export interface WhatsappProvider {
  readonly nombre: string;
  enviar(
    to: string,
    contenido: { texto: string } | { plantilla: string; idioma?: string },
    variables?: Record<string, string>,
  ): Promise<{ estado: 'SENT' | 'FAILED' | 'SIMULATED'; error?: string; idProveedor?: string }>;
}

// ─── Agenda y resumen ────────────────────────────────────────────────────────

export interface AgendaDiaDto {
  date: Fecha;
  /** Horario del negocio ese día. */
  businessRanges: Tramo[];
  closedReason: MotivoSinHorarios | null;
  resources: { resource: RecursoDto; ranges: Tramo[]; appointments: TurnoDto[] }[];
  /** Solo en modo CLASS: las clases de ese día. */
  classes: ClaseDelDiaDto[];
}

export interface AgendaRangoDto {
  from: Fecha;
  to: Fecha;
  days: { date: Fecha; businessRanges: Tramo[]; appointments: TurnoDto[]; classes: ClaseDelDiaDto[] }[];
}

export interface ResumenDelDiaDto {
  date: Fecha;
  now: Iso;
  open: { isOpen: boolean; closesAtMin: number | null; opensAtMin: number | null };
  kpis: {
    appointments: number;
    pending: number;
    completed: number;
    noShow: number;
    cancelled: number;
    /** 0..100: minutos tomados / minutos que atienden las agendas. */
    occupancyPercent: number;
    /** null si quien mira no tiene appointments.reports.view. */
    expectedRevenue: number | null;
    collectedRevenue: number | null;
  };
  inProgress: TurnoDto[];
  upcoming: TurnoDto[];
  /** Huecos para ofrecer: por agenda, los horarios de inicio libres de lo que queda del día. */
  gaps: { resourceId: string; resourceName: string; startMins: number[] }[];
}

// ─── Clases con cupo ─────────────────────────────────────────────────────────

export interface PlantillaClaseDto {
  id: string;
  serviceId: string;
  serviceName: string;
  weekday: number;
  startMin: number;
  durationMin: number;
  instructorResourceId: string | null;
  instructorName: string | null;
  roomResourceId: string | null;
  roomName: string | null;
  capacity: number;
  isActive: boolean;
}

export interface ClaseDelDiaDto {
  templateId: string;
  /** null = todavía no se materializó (nadie anotado, no suspendida). */
  sessionId: string | null;
  date: Fecha;
  startMin: number;
  startsAt: Iso;
  endsAt: Iso;
  durationMin: number;
  serviceId: string;
  serviceName: string;
  instructorName: string | null;
  roomName: string | null;
  capacity: number;
  enrolled: number;
  waitlist: number;
  isCancelled: boolean;
  price: number;
  /** Para el sitio: se puede reservar (ya abrió la reserva y no pasó). */
  bookable: boolean;
}

export interface AnotadoDto {
  id: string;
  code: string;
  status: AppointmentEnrollmentStatus;
  waitlistPosition: number | null;
  customer: ClienteDelTurno;
  attended: boolean | null;
  depositAmount: number;
  depositPaid: boolean;
  createdAt: Iso;
}

export interface ClaseDetalleDto extends ClaseDelDiaDto {
  enrollments: AnotadoDto[];
}

// ─── Clientes ────────────────────────────────────────────────────────────────

export interface ClienteDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  hasAccount: boolean;
  visits: number;
  lastVisit: Fecha | null;
  /** null si quien mira no tiene appointments.reports.view. */
  spent: number | null;
  noShows: number;
  note: string | null;
  insuranceName: string | null;
}

export interface ClienteFichaDto extends ClienteDto {
  insuranceNumber: string | null;
  dni: string | null;
  depositCredit: number;
  loyalty: { stamps: number; needed: number; rewardsAvailable: number } | null;
  next: TurnoDto | null;
  history: TurnoDto[];
  packages: PackCompradoDto[];
  membership: MembresiaDto | null;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Ganancias ───────────────────────────────────────────────────────────────

export interface RenglonLiquidacion {
  appointmentId: string;
  date: Fecha;
  startMin: number;
  customerName: string;
  serviceName: string;
  price: number;
  /** Lo que le toca a la persona de ese turno. */
  share: number;
}

/** El cálculo de `liquidarEntre` de la demo, con fechas reales. */
export interface LiquidacionTurnos {
  resourceId: string;
  from: Fecha;
  to: Fecha;
  /** Turnos atendidos (COMPLETED) de su agenda. */
  appointments: number;
  /** Clases que dio. */
  classes: number;
  /** Lo que se cobró por los turnos que atendió. */
  billed: number;
  commission: number;
  /** La parte del sueldo que corresponde a los días del período. */
  salary: number;
  perClass: number;
  /** Lo que le paga al negocio por el alquiler en el período. */
  rent: number;
  toPerson: number;
  /** Puede ser negativo: un sueldo sin turnos propios. */
  toBusiness: number;
  lines: RenglonLiquidacion[];
}

export interface GananciasPersonaDto {
  person: { resourceId: string; name: string; color: string | null; roleName: string | null; pay: FormaDePagoDto | null };
  /** La liquidación del período pedido. */
  period: LiquidacionTurnos;
  /** Lo que falta pagar: desde el día siguiente al último pago hasta hoy. */
  pending: LiquidacionTurnos;
  paidUntil: Fecha | null;
  /** Lo que el negocio le debe (comisión, sueldo, clases). 0 si alquila o es el dueño. */
  toPay: number;
  /** Lo que la persona le debe al negocio (alquiler). */
  toCollect: number;
}

export interface GananciasDto {
  from: Fecha;
  to: Fecha;
  /** null si quien mira solo ve las suyas. */
  totals: { billed: number; appointments: number; toTeam: number; toBusiness: number } | null;
  people: GananciasPersonaDto[];
}

export interface PagoEquipoDto {
  id: string;
  resourceId: string;
  periodFrom: Fecha;
  periodTo: Fecha;
  amount: number;
  direction: AppointmentPayoutDirection;
  note: string | null;
  paidAt: Iso;
  registeredByMemberName: string | null;
}

// ─── Avanzado ────────────────────────────────────────────────────────────────

export interface PaqueteDto {
  id: string;
  serviceId: string;
  serviceName: string;
  sessions: number;
  price: number;
  validDays: number;
  isActive: boolean;
  sold: number;
}

export interface PackCompradoDto {
  id: string;
  packageId: string;
  serviceName: string;
  customerName: string;
  sessionsTotal: number;
  sessionsUsed: number;
  paid: boolean;
  expiresAt: Iso | null;
}

export interface PlanMembresiaDto {
  id: string;
  name: string;
  perWeek: number;
  price: number;
  isFeatured: boolean;
  isActive: boolean;
  members: number;
}

export interface MembresiaDto {
  id: string;
  planId: string;
  planName: string;
  customerName: string;
  status: AppointmentMembershipStatus;
  startedAt: Iso;
  pausedUntil: Iso | null;
  nextChargeAt: Iso | null;
}

export interface GiftCardDto {
  id: string;
  code: string;
  kind: AppointmentGiftCardKind;
  amount: number | null;
  balance: number | null;
  serviceId: string | null;
  serviceName: string | null;
  style: string;
  recipientName: string | null;
  senderName: string | null;
  message: string | null;
  paid: boolean;
  redeemedAt: Iso | null;
  expiresAt: Iso | null;
  voided: boolean;
}

export interface ReglaPrecioDto {
  id: string;
  weekdays: number[];
  fromMin: number;
  toMin: number;
  adjustPercent: number;
  isActive: boolean;
}

export interface TurnoFijoDto {
  id: string;
  customerName: string;
  resourceId: string;
  resourceName: string;
  serviceId: string;
  serviceName: string;
  frequency: AppointmentRecurrence;
  weekday: number;
  startMin: number;
  startDate: Fecha;
  maxOccurrences: number;
  isActive: boolean;
  /** Los turnos de la serie que quedan por delante. */
  upcoming: { id: string; date: Fecha; status: AppointmentStatus }[];
}

export interface CampaniaRecuperarDto {
  id: string;
  inactiveDays: number;
  message: string;
  couponEnabled: boolean;
  couponPercent: number;
  couponValidDays: number;
  mode: 'auto' | 'manual';
  isActive: boolean;
  sentCount: number;
  lastRunAt: Iso | null;
  /** Cuántos clientes cumplen hoy la condición y todavía no la recibieron. */
  audience: number;
}

export interface EsperaDto {
  id: string;
  customer: ClienteDelTurno;
  serviceId: string;
  serviceName: string;
  resourceId: string | null;
  date: Fecha;
  fromMin: number | null;
  toMin: number | null;
  status: AppointmentWaitlistStatus;
  offerExpiresAt: Iso | null;
  createdAt: Iso;
}

// ─── Sitio público ───────────────────────────────────────────────────────────

/** GET /storefront/:slug/appointments/site: lo que necesita el sitio para dibujarse. Nada interno. */
export interface SitioTurnosDto {
  business: {
    name: string;
    description: string | null;
    logoUrl: string | null;
    subdomain: string;
    isActive: boolean;
    isPaused: boolean;
    rubroKey: string;
    agendaMode: AppointmentAgendaMode;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    neighborhood: string | null;
    floor: string | null;
    directions: string | null;
    homeZones: string | null;
    modalities: AppointmentModality[];
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    instagram: string | null;
  };
  site: { siteForm: 'web' | 'simple'; simpleDesign: string; appearance: AparienciaTurnos | null };
  schedule: { weekSchedule: SemanaTurnos; specialDays: { date: Fecha; kind: AppointmentSpecialDayKind; ranges: Tramo[]; reason: string | null }[]; vacation: { from: Fecha; to: Fecha; message: string | null } | null };
  /** Solo lo que el cliente necesita saber de las reglas. */
  booking: {
    minAdvanceMin: number;
    maxAdvanceDays: number;
    slotMin: number;
    confirmation: 'auto' | 'manual';
    letChooseResource: boolean;
    offerAnyResource: boolean;
    maxActivePerCustomer: number;
    waitlistEnabled: boolean;
    askInsurance: boolean;
    askDni: boolean;
    askReason: boolean;
    rescheduleEnabled: boolean;
    rescheduleUntilHours: number;
    rescheduleMax: number;
    depositEnabled: boolean;
    depositType: 'percent' | 'fixed';
    depositPercent: number;
    depositFixed: number;
    onlineCharge: 'deposit' | 'total' | 'customer_choice';
    /** false = el negocio no conectó Mercado Pago: no se cobra nada online. */
    onlinePaymentAvailable: boolean;
    onSiteMethods: PaymentMethod[];
  };
  policy: PoliticaReserva;
  account: BeneficiosCuenta;
  /** Funciones de Avanzado prendidas Y con el add-on activo. */
  advanced: FuncionAvanzada[];
}

export interface ServicioPublicoDto {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
}

export interface RecursoPublicoDto {
  id: string;
  kind: AppointmentResourceKind;
  name: string;
  roleLabel: string | null;
  color: string | null;
  photoUrl: string | null;
  bio: string | null;
  workDays: number[];
}

/**
 * "Mi turno": lo que ve el cliente de UNA reserva, entrando por su enlace
 * personal (accessToken) o con su cuenta. Deliberadamente chica: nada de
 * sellos, beneficios, notas internas ni datos de otros turnos.
 */
export interface MiTurnoDto {
  kind: 'appointment' | 'class';
  /** Referencia visible para decirle al negocio. No autentica. */
  code: string;
  status: AppointmentStatus | AppointmentEnrollmentStatus;
  serviceName: string;
  /** Con quién o dónde: la persona, la cancha, la sala. null si el negocio no deja elegir. */
  resourceName: string | null;
  modality: AppointmentModality;
  date: Fecha;
  startMin: number;
  startsAt: Iso;
  endsAt: Iso;
  durationMin: number;
  /** price - discountAmount. */
  total: number;
  deposit: { amount: number; paid: boolean };
  /** Solo en clases, si está en lista de espera. */
  waitlistPosition: number | null;
  /** Hasta cuándo puede cancelar sin cargo; null = ya no (puede cancelar igual, con la consecuencia de `depositOnCancel`). */
  canCancelUntil: Iso | null;
  /** Hasta cuándo puede reprogramar; null = no puede (apagado, plazo vencido o ya usó todos los cambios). */
  canRescheduleUntil: Iso | null;
  reschedulesLeft: number;
  /** Qué pasa con la seña si cancela ahora. */
  depositOnCancel: 'refund' | 'forfeit' | 'credit' | 'none';
  /** La política del negocio, en palabras (la misma de los Términos del sitio). */
  policy: { changes: string; late: string };
}

/** Respuesta de crear una reserva o anotarse a una clase. */
export interface ReservaCreadaDto {
  /**
   * El secreto del enlace personal: <sitio>/mi-turno/<accessToken>. Se devuelve
   * UNA vez, acá (y va en el mail/WhatsApp de confirmación). El sitio lo guarda
   * en el dispositivo para listar "mis turnos" sin cuenta.
   */
  accessToken: string;
  booking: MiTurnoDto;
  /** Si hay que pagar algo online: adónde mandar al cliente. null = no hay pago online. */
  payment: { paymentId: string; amount: number; initPoint: string } | null;
  /** Datos para transferir, si el negocio los muestra y no hay pago online. */
  transfer: { alias: string | null; cbu: string | null; holder: string | null } | null;
}

export interface MiCuentaTurnosDto {
  upcoming: MiTurnoDto[];
  history: MiTurnoDto[];
  loyalty: { stamps: number; needed: number; rewardsAvailable: number } | null;
  welcomeDiscountAvailable: boolean;
  depositCredit: number;
  packages: PackCompradoDto[];
  membership: MembresiaDto | null;
}
