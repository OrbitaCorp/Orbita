// Tipos de la API de Turnos & Agenda, copiados del contrato del backend:
// apps/api/src/appointments/appointments.types.ts (respuestas) y
// apps/api/src/appointments/CONTRATO.md (entradas de cada endpoint). El front
// no puede importar de apps/api: si el contrato cambia, se actualiza acá.
//
// Convenciones (las mismas de la API):
// - Plata: `number` en pesos.
// - Instantes: string ISO 8601 en UTC ("2026-10-05T13:00:00.000Z").
// - Días: "YYYY-MM-DD" del día argentino.
// - Horas del día: minutos desde las 00:00 de Argentina.
// - Día de la semana: 0 = lunes … 6 = domingo.
// - Los enums viajan con el valor de Prisma (CONFIRMED, PERSON, ON_SITE…).
//
// Lo que no viene del archivo de tipos (enums de Prisma, tramos, alcances,
// DTO de entrada) está marcado con la fuente en cada bloque.

// ─── Enums de Prisma (apps/api/prisma/schema.prisma) ────────────────────────

export type AppointmentAgendaMode = 'PROFESSIONAL' | 'RESOURCE' | 'COURT' | 'CLASS'
export type AppointmentCancelledBy = 'CUSTOMER' | 'BUSINESS' | 'SYSTEM'
export type AppointmentEnrollmentStatus = 'ENROLLED' | 'WAITLIST' | 'CANCELLED'
export type AppointmentGiftCardKind = 'AMOUNT' | 'SERVICE'
export type AppointmentMembershipStatus = 'ACTIVE' | 'PAUSED' | 'PAST_DUE' | 'CANCELLED'
export type AppointmentMessageChannel = 'EMAIL' | 'WHATSAPP'
export type AppointmentMessageStatus = 'SENT' | 'FAILED' | 'SIMULATED'
export type AppointmentModality = 'ON_SITE' | 'HOME'
export type AppointmentOrigin = 'PANEL' | 'STOREFRONT'
export type AppointmentPayEvery = 'WEEK' | 'FORTNIGHT' | 'MONTH'
export type AppointmentPayForm = 'COMMISSION' | 'SALARY' | 'MIXED' | 'RENT' | 'PER_CLASS'
export type AppointmentPaymentKind = 'DEPOSIT' | 'FULL' | 'BALANCE' | 'PACKAGE' | 'GIFT_CARD' | 'MEMBERSHIP'
export type AppointmentPayoutDirection = 'BUSINESS_TO_PERSON' | 'PERSON_TO_BUSINESS'
export type AppointmentRecurrence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
export type AppointmentResourceKind = 'PERSON' | 'SPACE'
export type AppointmentSpecialDayKind = 'CLOSED' | 'SPECIAL'
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'
export type AppointmentWaitlistStatus = 'WAITING' | 'OFFERED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'
export type PaymentMethod = 'MERCADOPAGO' | 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'TRANSFER' | 'QR' | 'CREDIT_NOTE'
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'CANCELLED'

// ─── Horarios (horarios/horarios.ts) y disponibilidad (disponibilidad/disponibilidad.ts) ──

/** [desde, hasta) en minutos desde las 00:00 de Argentina. */
export type Tramo = [number, number]
/** Los siete días, de lunes (0) a domingo (6). [] = ese día está cerrado. */
export type SemanaTurnos = Tramo[][]

export type MotivoCerrado = 'vacaciones' | 'dia-especial' | 'no-abre'
export type MotivoSinHorarios = MotivoCerrado | 'pasado' | 'fuera-de-ventana' | 'no-atiende' | 'completo'

/** El valor de `resourceId` para "me da lo mismo con quién" (disponibilidad/disponibilidad.ts → CUALQUIERA). */
export const CUALQUIERA = 'cualquiera'

// ─── Permisos por alcance (catalogo/roles.ts) ───────────────────────────────

export type AlcanceTurnos = 'todo' | 'propio' | 'no'

/** Los permisos de la demo, con el código (o el par de códigos) que le corresponde a cada uno. */
export const PERMISOS_TURNOS = {
  'agenda.ver': { base: 'appointments.agenda.view', todo: 'appointments.agenda.view_all' },
  'agenda.editar': { base: 'appointments.agenda.manage', todo: 'appointments.agenda.manage_all' },
  'clientes.ver': { base: 'appointments.clients.view', todo: 'appointments.clients.view_all' },
  'clientes.contacto': { base: 'appointments.clients.contact', todo: null },
  'caja.cobrar': { base: 'appointments.cash.charge', todo: null },
  'ganancias.ver': { base: 'appointments.earnings.view', todo: 'appointments.earnings.view_all' },
  'ganancias.liquidar': { base: 'appointments.earnings.settle', todo: null },
  'reportes.ver': { base: 'appointments.reports.view', todo: null },
  'servicios.editar': { base: 'appointments.services.manage', todo: null },
  'equipo.editar': { base: 'appointments.team.manage', todo: null },
  'config.editar': { base: 'appointments.settings.manage', todo: null },
} as const

export type PermisoTurnosId = keyof typeof PERMISOS_TURNOS
export type AlcancesTurnos = Record<PermisoTurnosId, AlcanceTurnos>

// ─── Respuestas (appointments.types.ts) ─────────────────────────────────────

// Iso: instante en UTC; Fecha: "YYYY-MM-DD" de Argentina.
export type Iso = string
export type Fecha = string

// ─── Estado visible ──────────────────────────────────────────────────────────

/**
 * Lo que muestra la agenda. Es el estado guardado más "en curso", que no se
 * persiste: un turno CONFIRMED cuyo horario contiene a "ahora".
 */
export type EstadoVisible = AppointmentStatus | 'IN_PROGRESS'


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
}

/** Estados a los que solo se puede pasar cuando el turno ya empezó. */
export const SOLO_SI_YA_EMPEZO: AppointmentStatus[] = ['COMPLETED', 'NO_SHOW']


/** Los estados que ocupan lugar en la agenda y cuentan para el límite por cliente. */
export const ESTADOS_ACTIVOS: AppointmentStatus[] = ['PENDING', 'CONFIRMED']

// ─── Configuración ───────────────────────────────────────────────────────────

/** `AppointmentSettings.appearance`. Lo que falta vale lo de la plantilla. */
export interface AparienciaTurnos {
  plantilla?: string
  /** #RRGGBB. */
  color?: string
  /** id del par tipográfico. */
  tipo?: string
  /** Radio de los bordes, en px. */
  radio?: number
  /** URL de la foto de portada; '' = la de la plantilla. */
  foto?: string
  estiloBoton?: 'relleno' | 'borde' | 'suave' | null
  hero?: 'sangre' | 'partido' | null
  monograma?: boolean
  secciones?: { id: string; on: boolean }[]
  /** Textos del sitio: nombre a mostrar, frase y texto del botón. */
  nombre?: string
  frase?: string
  boton?: string
}

export type CanalMensaje = 'wa' | 'email'
export type MensajeId = 'confirmacion' | 'recordatorio' | 'recordatorio2' | 'cancelacion' | 'reprogramacion' | 'espera' | 'extranamos'

export interface MensajeAutomatico {
  id: MensajeId
  on: boolean
  canales: CanalMensaje[]
  /** Horas antes (recordatorios) o días después (extranamos), como texto: "24", "2", "60". '' si no aplica. */
  cuando: string
  /** Con variables {nombre} {servicio} {fecha} {hora} {profesional} {negocio} {link}. */
  texto: string
}

/** `AppointmentSettings.messages`. */
export interface MensajesTurnos {
  wa: boolean
  email: boolean
  /** Número de WhatsApp desde el que salen. */
  numero: string
  firma: boolean
  mensajes: MensajeAutomatico[]
}

export type FuncionAvanzada = 'paquetes' | 'membresias' | 'gift-cards' | 'fidelidad' | 'turno-fijo' | 'recuperar' | 'precios-horario' | 'plantillas'

/** Config de cada función de Avanzado que no tiene tabla propia (va en `advanced[funcion].config`). */
export interface ConfigAvanzado {
  paquetes?: { compartir: boolean; avisoUltimas: boolean; avisoVence: boolean }
  membresias?: { renueva: boolean; diaCobro: number; pausa: boolean; diasPausa: number; matricula: number }
  'gift-cards'?: { montoLibre: boolean; montos: number[]; mesesValidez: number; saldoAFavor: boolean }
  fidelidad?: {
    sellos: number; premio: 'gratis' | 'descuento'; serviceId: string | null; pct: number
    suma: 'todos' | 'desde'; minimo: number; icono: 'rubro' | 'estrella' | 'corazon' | 'sello'; vencenMeses: number; selloDeBienvenida: boolean
  }
  'turno-fijo'?: { frecuencias: AppointmentRecurrence[]; maximo: number; serviceIds: string[]; cobro: 'cada' | 'mes'; liberarAusencias: number; saltearFeriados: boolean }
  'precios-horario'?: { mostrarTachado: boolean }
  recuperar?: Record<string, never>
  plantillas?: Record<string, never>
}

/** `AppointmentSettings.advanced`. */
export type AvanzadoTurnos = { [F in FuncionAvanzada]?: { on: boolean; config?: ConfigAvanzado[F] } }

export interface ReglasReserva {
  minAdvanceMin: number
  maxAdvanceDays: number
  slotMin: number
  bufferMin: number
  confirmation: 'auto' | 'manual'
  letChooseResource: boolean
  offerAnyResource: boolean
  maxActivePerCustomer: number
  waitlistEnabled: boolean
  waitlistAcceptMin: number
  classDefaultCapacity: number
  classOpenDays: number
  classMinEnrolled: number
  askInsurance: boolean
  askDni: boolean
  askReason: boolean
  rescheduleEnabled: boolean
  rescheduleUntilHours: number
  rescheduleMax: number
  depositEnabled: boolean
  depositType: 'percent' | 'fixed'
  depositPercent: number
  depositFixed: number
  depositForNoShows: boolean
}

export interface PoliticaReserva {
  cancelUntilHours: number
  depositOutOfWindow: 'forfeit' | 'credit'
  toleranceMin: number
}

export interface BeneficiosCuenta {
  accountEnabled: boolean
  welcomeDiscountPercent: number
  loyaltyStamps: number
  promosEnabled: boolean
}

export interface DiaEspecialDto {
  id: string
  date: Fecha
  kind: AppointmentSpecialDayKind
  ranges: Tramo[]
  reason: string | null
}

export interface HorariosDto {
  weekSchedule: SemanaTurnos
  specialDays: DiaEspecialDto[]
  vacation: { enabled: boolean; from: Fecha | null; to: Fecha | null; message: string | null }
}

export interface NegocioDto {
  name: string
  description: string | null
  logoUrl: string | null
  subdomain: string
  /** Dirección y mapa: los de la sucursal principal. */
  address: string | null
  latitude: number | null
  longitude: number | null
  city: string | null
  neighborhood: string | null
  floor: string | null
  directions: string | null
  homeZones: string | null
  modalities: AppointmentModality[]
  phone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
}

export interface PagosDto {
  mercadopago: { connected: boolean; mpUserName: string | null }
  onlineCharge: 'deposit' | 'total' | 'customer_choice'
  onSiteMethods: PaymentMethod[]
  transferAlias: string | null
  transferCbu: string | null
  transferHolder: string | null
  showTransferData: boolean
}

/** GET /appointments/settings: todo lo que configura el dueño, por pestaña. */
export interface SettingsDto {
  rubroKey: string
  agendaMode: AppointmentAgendaMode
  business: NegocioDto
  site: { siteForm: 'web' | 'simple'; simpleDesign: string; appearance: AparienciaTurnos | null }
  schedule: HorariosDto
  rules: ReglasReserva
  policy: PoliticaReserva
  account: BeneficiosCuenta
  payments: PagosDto
  messages: MensajesTurnos
  /** Conexión de WhatsApp. `provider` es el que está activo en el servidor: 'stub' = los mensajes se registran pero no se envían. */
  whatsapp: { connected: boolean; number: string | null; provider: 'stub' | string }
  advanced: AvanzadoTurnos
  /** El negocio tiene el paquete Avanzado activo. */
  hasAdvanced: boolean
}

// ─── Servicios y agendas ─────────────────────────────────────────────────────

export interface ServicioDto {
  id: string
  name: string
  description: string | null
  durationMin: number
  price: number
  bookableOnline: boolean
  isActive: boolean
  sortOrder: number
}

export interface FormaDePagoDto {
  payForm: AppointmentPayForm
  commissionPercent: number
  salary: number
  rent: number
  perClass: number
  payEvery: AppointmentPayEvery
}

export interface RecursoDto {
  id: string
  kind: AppointmentResourceKind
  name: string
  roleLabel: string | null
  color: string | null
  photoUrl: string | null
  bio: string | null
  isBookable: boolean
  assignedSpaceId: string | null
  workDays: number[]
  ownSchedule: SemanaTurnos | null
  isActive: boolean
  sortOrder: number
}

/** Una persona del equipo: su agenda (si tiene), su acceso al panel y cómo cobra. */
export interface PersonaDto extends RecursoDto {
  kind: 'PERSON'
  /** null = no tiene login en el panel. */
  member: { id: string; email: string; status: 'ACTIVE' | 'PENDING'; roleId: string; roleName: string; isOwner: boolean } | null
  email: string | null
  phone: string | null
  /** null = es el dueño: lo que factura queda para el negocio. */
  pay: FormaDePagoDto | null
}

export interface RolTurnosDto {
  id: string
  name: string
  description: string | null
  color: string | null
  /** El del dueño: puede todo, no se cambia ni se borra. */
  isOwner: boolean
  /** Key del rol de fábrica del que salió; null = lo creó el dueño. */
  factoryKey: string | null
  /** Un rol de fábrica que se cambió respecto de cómo viene para el rubro. */
  changed: boolean
  takesAppointments: boolean
  permissions: string[]
  /** Los mismos permisos, como alcances (todo / propio / no). */
  scopes: AlcancesTurnos
  members: number
}

// ─── Turnos ──────────────────────────────────────────────────────────────────

export interface ClienteDelTurno {
  /** null = reservó sin cuenta y no está vinculado a una ficha. */
  id: string | null
  name: string
  /** Tapado ("•••• ••55-0101") si quien mira no tiene appointments.clients.contact. */
  phone: string
  email: string | null
}

export interface TurnoDto {
  id: string
  code: string
  status: AppointmentStatus
  /** Con "en curso" calculado. */
  visibleStatus: EstadoVisible
  origin: AppointmentOrigin
  modality: AppointmentModality
  resourceId: string
  resourceName: string
  serviceId: string
  serviceName: string
  customer: ClienteDelTurno
  date: Fecha
  startMin: number
  startsAt: Iso
  endsAt: Iso
  durationMin: number
  price: number
  discountAmount: number
  /** price - discountAmount. */
  total: number
  depositAmount: number
  depositPaid: boolean
  depositPaidAt: Iso | null
  depositMethod: PaymentMethod | null
  rescheduleCount: number
  customerNote: string | null
  internalNote: string | null
  recurringSeriesId: string | null
}

/** GET /appointments/:id */
export interface TurnoDetalleDto extends TurnoDto {
  customerAddress: string | null
  customerDni: string | null
  insuranceName: string | null
  insuranceNumber: string | null
  reason: string | null
  confirmedAt: Iso | null
  completedAt: Iso | null
  cancelledAt: Iso | null
  cancelledBy: AppointmentCancelledBy | null
  cancelReason: string | null
  wantsReminder: boolean
  reminderSentAt: Iso | null
  packagePurchaseId: string | null
  giftCardId: string | null
  membershipId: string | null
  createdByMemberName: string | null
  createdAt: Iso
  payments: PagoTurnoDto[]
  messages: MensajeEnviadoDto[]
  /** Qué puede hacer con este turno quien lo está mirando. */
  can: { edit: boolean; charge: boolean; contact: boolean; transitions: AppointmentStatus[] }
}

export interface PagoTurnoDto {
  id: string
  kind: AppointmentPaymentKind
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  paidAt: Iso | null
  reference: string | null
  registeredByMemberName: string | null
}

export interface HorarioLibreDto {
  startMin: number
  startsAt: Iso
  endsAt: Iso
  resourceId: string
  /** Precio del servicio a esa hora, con el ajuste de "Precios por horario" si aplica. */
  price: number
  /** % del ajuste aplicado; 0 si no hay. */
  adjustPercent: number
}

export interface DisponibilidadDiaDto {
  date: Fecha
  closed: boolean
  reason: MotivoSinHorarios | null
  /** Mensaje de vacaciones, si el motivo es ese. */
  message: string | null
  slots: HorarioLibreDto[]
}

export interface DisponibilidadRangoDto {
  days: { date: Fecha; closed: boolean; reason: MotivoSinHorarios | null; free: number; firstStartMin: number | null }[]
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

/** Un renglón de appointment_message_logs, para "qué se le mandó" en el detalle del turno. */
export interface MensajeEnviadoDto {
  id: string
  channel: AppointmentMessageChannel
  template: MensajeId
  /** Tapado si quien mira no tiene appointments.clients.contact. */
  recipient: string
  status: AppointmentMessageStatus
  error: string | null
  createdAt: Iso
}

/** El texto de una plantilla ya armado para un turno, para mandarlo a mano (wa.me) mientras no haya proveedor real. */
export interface MensajeRenderizadoDto {
  template: MensajeId
  text: string
  /** Teléfono en formato internacional sin "+", listo para wa.me; null si quien mira no puede ver contactos o no hay teléfono. */
  phone: string | null
  /** https://wa.me/<phone>?text=<texto> ; null si no hay teléfono. */
  waLink: string | null
}


// ─── Agenda y resumen ────────────────────────────────────────────────────────

export interface AgendaDiaDto {
  date: Fecha
  /** Horario del negocio ese día. */
  businessRanges: Tramo[]
  closedReason: MotivoSinHorarios | null
  resources: { resource: RecursoDto; ranges: Tramo[]; appointments: TurnoDto[] }[]
  /** Solo en modo CLASS: las clases de ese día. */
  classes: ClaseDelDiaDto[]
}

export interface AgendaRangoDto {
  from: Fecha
  to: Fecha
  days: { date: Fecha; businessRanges: Tramo[]; appointments: TurnoDto[]; classes: ClaseDelDiaDto[] }[]
}

export interface ResumenDelDiaDto {
  date: Fecha
  now: Iso
  open: { isOpen: boolean; closesAtMin: number | null; opensAtMin: number | null }
  kpis: {
    appointments: number
    pending: number
    completed: number
    noShow: number
    cancelled: number
    /** 0..100: minutos tomados / minutos que atienden las agendas. */
    occupancyPercent: number
    /** null si quien mira no tiene appointments.reports.view. */
    expectedRevenue: number | null
    collectedRevenue: number | null
  }
  inProgress: TurnoDto[]
  upcoming: TurnoDto[]
  /** Huecos para ofrecer: por agenda, los horarios de inicio libres de lo que queda del día. */
  gaps: { resourceId: string; resourceName: string; startMins: number[] }[]
}

// ─── Clases con cupo ─────────────────────────────────────────────────────────

export interface PlantillaClaseDto {
  id: string
  serviceId: string
  serviceName: string
  weekday: number
  startMin: number
  durationMin: number
  instructorResourceId: string | null
  instructorName: string | null
  roomResourceId: string | null
  roomName: string | null
  capacity: number
  isActive: boolean
}

export interface ClaseDelDiaDto {
  templateId: string
  /** null = todavía no se materializó (nadie anotado, no suspendida). */
  sessionId: string | null
  date: Fecha
  startMin: number
  startsAt: Iso
  endsAt: Iso
  durationMin: number
  serviceId: string
  serviceName: string
  instructorName: string | null
  roomName: string | null
  capacity: number
  enrolled: number
  waitlist: number
  isCancelled: boolean
  price: number
  /** Para el sitio: se puede reservar (ya abrió la reserva y no pasó). */
  bookable: boolean
}

export interface AnotadoDto {
  id: string
  code: string
  status: AppointmentEnrollmentStatus
  waitlistPosition: number | null
  customer: ClienteDelTurno
  attended: boolean | null
  depositAmount: number
  depositPaid: boolean
  createdAt: Iso
}

export interface ClaseDetalleDto extends ClaseDelDiaDto {
  enrollments: AnotadoDto[]
}

// ─── Clientes ────────────────────────────────────────────────────────────────

export interface ClienteDto {
  id: string
  name: string
  phone: string
  email: string | null
  hasAccount: boolean
  visits: number
  lastVisit: Fecha | null
  /** null si quien mira no tiene appointments.reports.view. */
  spent: number | null
  noShows: number
  note: string | null
  insuranceName: string | null
}

export interface ClienteFichaDto extends ClienteDto {
  insuranceNumber: string | null
  dni: string | null
  depositCredit: number
  loyalty: { stamps: number; needed: number; rewardsAvailable: number } | null
  next: TurnoDto | null
  history: TurnoDto[]
  packages: PackCompradoDto[]
  membership: MembresiaDto | null
}

export interface Paginado<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ─── Ganancias ───────────────────────────────────────────────────────────────

export interface RenglonLiquidacion {
  appointmentId: string
  date: Fecha
  startMin: number
  customerName: string
  serviceName: string
  price: number
  /** Lo que le toca a la persona de ese turno. */
  share: number
}

/** El cálculo de `liquidarEntre` de la demo, con fechas reales. */
export interface LiquidacionTurnos {
  resourceId: string
  from: Fecha
  to: Fecha
  /** Turnos atendidos (COMPLETED) de su agenda. */
  appointments: number
  /** Clases que dio. */
  classes: number
  /** Lo que se cobró por los turnos que atendió. */
  billed: number
  commission: number
  /** La parte del sueldo que corresponde a los días del período. */
  salary: number
  perClass: number
  /** Lo que le paga al negocio por el alquiler en el período. */
  rent: number
  toPerson: number
  /** Puede ser negativo: un sueldo sin turnos propios. */
  toBusiness: number
  lines: RenglonLiquidacion[]
}

export interface GananciasPersonaDto {
  person: { resourceId: string; name: string; color: string | null; roleName: string | null; pay: FormaDePagoDto | null }
  /** La liquidación del período pedido. */
  period: LiquidacionTurnos
  /** Lo que falta pagar: desde el día siguiente al último pago hasta hoy. */
  pending: LiquidacionTurnos
  paidUntil: Fecha | null
  /** Lo que el negocio le debe (comisión, sueldo, clases). 0 si alquila o es el dueño. */
  toPay: number
  /** Lo que la persona le debe al negocio (alquiler). */
  toCollect: number
}

export interface GananciasDto {
  from: Fecha
  to: Fecha
  /** null si quien mira solo ve las suyas. */
  totals: { billed: number; appointments: number; toTeam: number; toBusiness: number } | null
  people: GananciasPersonaDto[]
}

export interface PagoEquipoDto {
  id: string
  resourceId: string
  periodFrom: Fecha
  periodTo: Fecha
  amount: number
  direction: AppointmentPayoutDirection
  note: string | null
  paidAt: Iso
  registeredByMemberName: string | null
}

// ─── Avanzado ────────────────────────────────────────────────────────────────

export interface PaqueteDto {
  id: string
  serviceId: string
  serviceName: string
  sessions: number
  price: number
  validDays: number
  isActive: boolean
  sold: number
}

export interface PackCompradoDto {
  id: string
  packageId: string
  serviceName: string
  customerName: string
  sessionsTotal: number
  sessionsUsed: number
  paid: boolean
  expiresAt: Iso | null
}

export interface PlanMembresiaDto {
  id: string
  name: string
  perWeek: number
  price: number
  isFeatured: boolean
  isActive: boolean
  members: number
}

export interface MembresiaDto {
  id: string
  planId: string
  planName: string
  customerName: string
  status: AppointmentMembershipStatus
  startedAt: Iso
  pausedUntil: Iso | null
  nextChargeAt: Iso | null
}

export interface GiftCardDto {
  id: string
  code: string
  kind: AppointmentGiftCardKind
  amount: number | null
  balance: number | null
  serviceId: string | null
  serviceName: string | null
  style: string
  recipientName: string | null
  senderName: string | null
  message: string | null
  paid: boolean
  redeemedAt: Iso | null
  expiresAt: Iso | null
  voided: boolean
}

export interface ReglaPrecioDto {
  id: string
  weekdays: number[]
  fromMin: number
  toMin: number
  adjustPercent: number
  isActive: boolean
}

export interface TurnoFijoDto {
  id: string
  customerName: string
  resourceId: string
  resourceName: string
  serviceId: string
  serviceName: string
  frequency: AppointmentRecurrence
  weekday: number
  startMin: number
  startDate: Fecha
  maxOccurrences: number
  isActive: boolean
  /** Los turnos de la serie que quedan por delante. */
  upcoming: { id: string; date: Fecha; status: AppointmentStatus }[]
}

export interface CampaniaRecuperarDto {
  id: string
  inactiveDays: number
  message: string
  couponEnabled: boolean
  couponPercent: number
  couponValidDays: number
  mode: 'auto' | 'manual'
  isActive: boolean
  sentCount: number
  lastRunAt: Iso | null
  /** Cuántos clientes cumplen hoy la condición y todavía no la recibieron. */
  audience: number
}

export interface EsperaDto {
  id: string
  customer: ClienteDelTurno
  serviceId: string
  serviceName: string
  resourceId: string | null
  date: Fecha
  fromMin: number | null
  toMin: number | null
  status: AppointmentWaitlistStatus
  offerExpiresAt: Iso | null
  createdAt: Iso
}

// ─── Sitio público ───────────────────────────────────────────────────────────

/** GET /storefront/:slug/appointments/site: lo que necesita el sitio para dibujarse. Nada interno. */
export interface SitioTurnosDto {
  business: {
    name: string
    description: string | null
    logoUrl: string | null
    subdomain: string
    isActive: boolean
    isPaused: boolean
    rubroKey: string
    agendaMode: AppointmentAgendaMode
    address: string | null
    latitude: number | null
    longitude: number | null
    city: string | null
    neighborhood: string | null
    floor: string | null
    directions: string | null
    homeZones: string | null
    modalities: AppointmentModality[]
    phone: string | null
    whatsapp: string | null
    email: string | null
    instagram: string | null
  }
  site: { siteForm: 'web' | 'simple'; simpleDesign: string; appearance: AparienciaTurnos | null }
  schedule: { weekSchedule: SemanaTurnos; specialDays: { date: Fecha; kind: AppointmentSpecialDayKind; ranges: Tramo[]; reason: string | null }[]; vacation: { from: Fecha; to: Fecha; message: string | null } | null }
  /** Solo lo que el cliente necesita saber de las reglas. */
  booking: {
    minAdvanceMin: number
    maxAdvanceDays: number
    slotMin: number
    confirmation: 'auto' | 'manual'
    letChooseResource: boolean
    offerAnyResource: boolean
    maxActivePerCustomer: number
    waitlistEnabled: boolean
    askInsurance: boolean
    askDni: boolean
    askReason: boolean
    rescheduleEnabled: boolean
    rescheduleUntilHours: number
    rescheduleMax: number
    depositEnabled: boolean
    depositType: 'percent' | 'fixed'
    depositPercent: number
    depositFixed: number
    onlineCharge: 'deposit' | 'total' | 'customer_choice'
    /** false = el negocio no conectó Mercado Pago: no se cobra nada online. */
    onlinePaymentAvailable: boolean
    onSiteMethods: PaymentMethod[]
  }
  policy: PoliticaReserva
  account: BeneficiosCuenta
  /** Funciones de Avanzado prendidas Y con el add-on activo. */
  advanced: FuncionAvanzada[]
}

export interface ServicioPublicoDto {
  id: string
  name: string
  description: string | null
  durationMin: number
  price: number
}

export interface RecursoPublicoDto {
  id: string
  kind: AppointmentResourceKind
  name: string
  roleLabel: string | null
  color: string | null
  photoUrl: string | null
  bio: string | null
  workDays: number[]
}

/**
 * "Mi turno": lo que ve el cliente de UNA reserva, entrando por su enlace
 * personal (accessToken) o con su cuenta. Deliberadamente chica: nada de
 * sellos, beneficios, notas internas ni datos de otros turnos.
 */
export interface MiTurnoDto {
  kind: 'appointment' | 'class'
  /** Referencia visible para decirle al negocio. No autentica. */
  code: string
  status: AppointmentStatus | AppointmentEnrollmentStatus
  serviceName: string
  /** Con quién o dónde: la persona, la cancha, la sala. null si el negocio no deja elegir. */
  resourceName: string | null
  modality: AppointmentModality
  date: Fecha
  startMin: number
  startsAt: Iso
  endsAt: Iso
  durationMin: number
  /** price - discountAmount. */
  total: number
  deposit: { amount: number; paid: boolean }
  /** Solo en clases, si está en lista de espera. */
  waitlistPosition: number | null
  /** Hasta cuándo puede cancelar sin cargo; null = ya no (puede cancelar igual, con la consecuencia de `depositOnCancel`). */
  canCancelUntil: Iso | null
  /** Hasta cuándo puede reprogramar; null = no puede (apagado, plazo vencido o ya usó todos los cambios). */
  canRescheduleUntil: Iso | null
  reschedulesLeft: number
  /** Qué pasa con la seña si cancela ahora. */
  depositOnCancel: 'refund' | 'forfeit' | 'credit' | 'none'
  /** La política del negocio, en palabras (la misma de los Términos del sitio). */
  policy: { changes: string; late: string }
}

/** Respuesta de crear una reserva o anotarse a una clase. */
export interface ReservaCreadaDto {
  /**
   * El secreto del enlace personal: <sitio>/mi-turno/<accessToken>. Se devuelve
   * UNA vez, acá (y va en el mail/WhatsApp de confirmación). El sitio lo guarda
   * en el dispositivo para listar "mis turnos" sin cuenta.
   */
  accessToken: string
  booking: MiTurnoDto
  /** Si hay que pagar algo online: adónde mandar al cliente. null = no hay pago online. */
  payment: { paymentId: string; amount: number; initPoint: string } | null
  /** Datos para transferir, si el negocio los muestra y no hay pago online. */
  transfer: { alias: string | null; cbu: string | null; holder: string | null } | null
}

export interface MiCuentaTurnosDto {
  upcoming: MiTurnoDto[]
  history: MiTurnoDto[]
  loyalty: { stamps: number; needed: number; rewardsAvailable: number } | null
  welcomeDiscountAvailable: boolean
  depositCredit: number
  packages: PackCompradoDto[]
  membership: MembresiaDto | null
}

// ─── Entradas (CONTRATO.md) ─────────────────────────────────────────────────
// Los DTO de entrada de cada endpoint, con los nombres del contrato. Los rangos
// y las listas cerradas que valida el backend van en el comentario de cada campo.

/** Un cliente cargado en el momento (cuando no se elige uno existente). */
export interface ClienteNuevoInput {
  /** 3–120. */
  name: string
  phone?: string
  email?: string
  insuranceName?: string
}

// P1.1 Configuración

/** PUT appointments/settings/business */
export interface UpdateBusinessDto {
  /** 2–80. */
  name: string
  /** ≤500. */
  description?: string
  /** ≤200. */
  address?: string
  latitude?: number
  longitude?: number
  city?: string
  neighborhood?: string
  floor?: string
  /** ≤400. */
  directions?: string
  /** ≤400. */
  homeZones?: string
  /** Mínimo una, dentro de las posibles del rubro. */
  modalities: AppointmentModality[]
  phone?: string
  whatsapp?: string
  email?: string
  instagram?: string
}

/** PUT appointments/settings/site */
export interface UpdateSiteDto {
  siteForm: 'web' | 'simple'
  simpleDesign: 'tarjeta' | 'portada' | 'partida' | 'editorial' | 'enlaces'
  appearance?: AparienciaTurnos
}

/** PUT appointments/settings/schedule. `specialDays` REEMPLAZA la lista entera (≤60). */
export interface UpdateScheduleDto {
  weekSchedule: SemanaTurnos
  specialDays: { date: Fecha; kind: AppointmentSpecialDayKind; ranges: Tramo[]; reason?: string }[]
  vacation: { enabled: boolean; from?: Fecha; to?: Fecha; message?: string }
}

/** Respuesta de PUT appointments/settings/schedule: suma cuántos turnos futuros quedaron fuera del horario nuevo. */
export type SettingsConAfectadosDto = SettingsDto & { affected: number }

/** PUT appointments/settings/booking */
export interface UpdateBookingDto {
  rules: ReglasReserva
  policy: PoliticaReserva
  account: BeneficiosCuenta
}

/** PUT appointments/settings/messages */
export type UpdateMessagesDto = MensajesTurnos

/** PUT appointments/settings/payments */
export interface UpdatePaymentsDto {
  onlineCharge: 'deposit' | 'total' | 'customer_choice'
  /** ⊆ CASH, TRANSFER, DEBIT_CARD, CREDIT_CARD, QR. */
  onSiteMethods: PaymentMethod[]
  /** ≤40. */
  transferAlias?: string
  /** 22 dígitos. */
  transferCbu?: string
  /** ≤120. */
  transferHolder?: string
  showTransferData: boolean
}

/** PUT appointments/settings/whatsapp */
export interface UpdateWhatsappDto {
  /** Dígitos, 8–15. */
  number?: string
}

// P1.2 Servicios

/** POST appointments/services, PUT appointments/services/:id */
export interface UpsertServiceDto {
  /** 1–120. */
  name: string
  /** ≤500. */
  description?: string
  /** 5–600. */
  durationMin: number
  /** 0–100.000.000, hasta 2 decimales. */
  price: number
  bookableOnline: boolean
  isActive?: boolean
}

// P1.3 Agendas

/** POST appointments/resources, PUT appointments/resources/:id (solo espacios). */
export interface UpsertSpaceDto {
  /** 1–120. */
  name: string
  /** ≤80. */
  roleLabel?: string
  /** #RRGGBB. */
  color?: string
  /** 0–6, sin repetir, mínimo uno. */
  workDays: number[]
  ownSchedule?: SemanaTurnos | null
  isActive?: boolean
}

export interface ListResourcesQuery {
  kind?: AppointmentResourceKind
  bookable?: boolean
}

// P1.4 Turnos

/** GET appointments */
export interface ListAppointmentsQuery {
  /** Por defecto, hoy. Rango ≤ 92 días. */
  from?: Fecha
  to?: Fecha
  resourceId?: string
  customerId?: string
  /** Se mandan separados por comas. */
  status?: AppointmentStatus[]
  /** Nombre o teléfono, sin acentos. */
  q?: string
  /** ≥1. */
  page?: number
  /** 1–100, defecto 50. */
  limit?: number
}

/** GET appointments/availability (panel), GET storefront/:slug/appointments/availability (sin `except`). */
export interface DisponibilidadQuery {
  serviceId: string
  date: Fecha
  /** Ausente o "cualquiera" = cualquier agenda. */
  resourceId?: string
  /** Solo panel: el turno que se está moviendo. */
  except?: string
}

/** GET …/availability/range */
export interface DisponibilidadRangoQuery {
  serviceId: string
  from: Fecha
  to: Fecha
  resourceId?: string
  /** Solo panel. */
  except?: string
}

/** POST appointments. Va `customerId` O `customer`, exactamente uno. */
export interface CreateAppointmentDto {
  serviceId: string
  /** uuid o "cualquiera". */
  resourceId: string
  date: Fecha
  /** 0–1439. */
  startMin: number
  customerId?: string
  customer?: ClienteNuevoInput
  modality?: AppointmentModality
  internalNote?: string
  /** 0–100.000.000; exige appointments.services.manage. */
  priceOverride?: number
}

/** PATCH appointments/:id/status */
export interface ChangeStatusDto {
  status: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'
  /** ≤300. */
  reason?: string
  keepDeposit?: boolean
}

/** POST appointments/:id/move */
export interface MoveAppointmentDto {
  date: Fecha
  startMin: number
  resourceId?: string
}

/** POST appointments/:id/deposit */
export interface RegisterDepositDto {
  method: 'CASH' | 'TRANSFER' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'QR'
  /** Defecto: la seña del turno. 0 < amount ≤ total. */
  amount?: number
  /** Defecto DEPOSIT. */
  kind?: 'DEPOSIT' | 'BALANCE' | 'FULL'
  /** ≤120. */
  reference?: string
}

// P2 Público

/** POST storefront/:slug/appointments/bookings */
export interface CreateBookingDto {
  serviceId: string
  /** uuid o "cualquiera". */
  resourceId?: string
  date: Fecha
  startMin: number
  /** 3–120. */
  name: string
  /** 10 dígitos tras normalizar. */
  phone: string
  /** ≤254. */
  email?: string
  /** ≤500. */
  note?: string
  modality?: AppointmentModality
  /** Obligatoria con HOME: ≥5 caracteres y al menos un dígito. */
  address?: string
  /** 7–8 dígitos; obligatorio si askDni. */
  dni?: string
  /** ≤120; obligatorio si askInsurance. */
  insuranceName?: string
  /** ≤60. */
  insuranceNumber?: string
  /** ≤500; solo se guarda si askReason. */
  reason?: string
  /** Defecto true. */
  wantsReminder?: boolean
  /** Solo con onlineCharge = customer_choice. */
  pay?: 'deposit' | 'total'
  /** 8–72; solo si accountEnabled y hay email. */
  createAccount?: { password: string }
  giftCardCode?: string
  packagePurchaseId?: string
  couponCode?: string
  /** Avanzado (turno fijo); sin add-on se ignora. */
  recurring?: { frequency: AppointmentRecurrence; occurrences: number }
}

/**
 * Respuesta de crear una reserva. El contrato (P2.2, paso 2) dice que con
 * `createAccount` se devuelve además `session`, "el mismo objeto que el
 * registro de cliente"; ReservaCreadaDto no lo tipa: va opcional y sin forma.
 */
export type ReservaCreadaConSesionDto = ReservaCreadaDto & { session?: unknown }

/** GET …/mine/:token/availability y GET me/appointments/:id/availability: un día o un rango. */
export type DisponibilidadMiTurnoQuery = { date: Fecha } | { from: Fecha; to: Fecha }

/** POST …/mine/:token/reschedule y POST me/appointments/:id/reschedule */
export interface RescheduleDto {
  date: Fecha
  startMin: number
}

/** POST storefront/:slug/appointments/mine/:token/pay */
export interface PagoPendienteDto {
  paymentId: string
  amount: number
  initPoint: string
}

// P3.1 Clases

/** POST/PUT appointments/class-templates */
export interface UpsertClassTemplateDto {
  serviceId: string
  /** 0–6. */
  weekday: number
  /** 0–1439. */
  startMin: number
  /** 15–600. */
  durationMin: number
  /** Una persona (PERSON). */
  instructorResourceId?: string
  /** Un espacio (SPACE). */
  roomResourceId?: string
  /** 1–500. */
  capacity: number
  isActive?: boolean
}

/** PUT appointments/classes/:templateId/:date */
export interface UpdateClassSessionDto {
  /** null = el de la plantilla. */
  capacity?: number | null
  cancelled?: boolean
  cancelReason?: string
}

/** POST appointments/classes/:templateId/:date/enrollments. Va `customerId` O `customer`. */
export interface EnrollDto {
  customerId?: string
  customer?: { name: string; phone?: string; email?: string }
}

/** POST storefront/:slug/appointments/classes/enroll */
export interface PublicEnrollDto {
  templateId: string
  date: Fecha
  name: string
  phone: string
  email?: string
  note?: string
  wantsReminder?: boolean
  createAccount?: { password: string }
}

// P3.2 Clientes

export type FiltroClientes = 'todos' | 'frecuentes' | 'nuevos'

export interface ListClientsQuery {
  q?: string
  filter?: FiltroClientes
  page?: number
  limit?: number
}

/** POST appointments/clients */
export interface CreateClientDto {
  /** 3–120. */
  name: string
  /** ≥8 dígitos si viene. */
  phone?: string
  email?: string
  /** ≤1000. */
  note?: string
  insuranceName?: string
}

/** PUT appointments/clients/:id */
export interface UpdateClientDto extends CreateClientDto {
  insuranceNumber?: string
  dni?: string
}

// P3.3 Equipo y roles

/** POST appointments/team/invite */
export interface InvitePersonDto {
  name: string
  email: string
  roleId: string
}

export interface InvitacionDto {
  person: PersonaDto
  tempPassword?: string
}

/** POST appointments/team, PUT appointments/team/:resourceId */
export interface UpsertPersonDto {
  name: string
  roleId?: string
  email?: string
  phone?: string
  color?: string
  photoUrl?: string
  /** ≤400. */
  bio?: string
  isBookable: boolean
  workDays: number[]
  ownSchedule?: SemanaTurnos | null
  /** Modo RESOURCE: un espacio del negocio. */
  assignedSpaceId?: string | null
}

/** PUT appointments/team/:resourceId/pay */
export interface PayFormDto {
  payForm: AppointmentPayForm
  /** 0–100. */
  commissionPercent: number
  salary: number
  rent: number
  perClass: number
  payEvery: AppointmentPayEvery
}

/** POST appointments/roles, PUT appointments/roles/:id */
export interface UpsertRoleDto {
  /** 2–40. */
  name: string
  /** ≤200. */
  description?: string
  color?: string
  takesAppointments: boolean
  /** Solo códigos appointments.*. */
  permissions: string[]
}

// P3.4 Ganancias

export interface RangoFechasQuery {
  from: Fecha
  to: Fecha
}

/** POST appointments/earnings/:resourceId/payouts */
export interface RegisterPayoutDto {
  /** Defecto hoy; > paidUntil, ≤ hoy. */
  periodTo?: Fecha
  /** Defecto: lo que da la liquidación pendiente hasta periodTo. */
  amount?: number
  /** ≤300. */
  note?: string
}

export interface PaginaQuery {
  page?: number
  limit?: number
}

// P4 Avanzado

/** GET appointments/advanced */
export interface AvanzadoDto {
  hasAdvanced: boolean
  functions: AvanzadoTurnos
  recommended: FuncionAvanzada[]
}

/** PUT appointments/advanced/:funcion */
export interface UpdateAdvancedDto<F extends FuncionAvanzada = FuncionAvanzada> {
  on: boolean
  config?: ConfigAvanzado[F]
}

/** Métodos para cobrar en el local (ventas de packs, membresías, gift cards). */
export type MetodoEnLocal = 'CASH' | 'TRANSFER' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'QR'

/** POST/PUT appointments/packages */
export interface UpsertPackageDto {
  serviceId: string
  /** 2–100. */
  sessions: number
  /** > 0. */
  price: number
  /** 0–730; 0 = no vence. */
  validDays: number
  isActive: boolean
}

/** POST appointments/package-purchases. Va `customerId` O `customer`. */
export interface SellPackageDto {
  packageId: string
  customerId?: string
  customer?: ClienteNuevoInput
  method: MetodoEnLocal
}

/** POST storefront/:slug/appointments/packages/:id/buy */
export interface BuyPackageDto {
  name: string
  phone: string
  email?: string
}

/** Respuesta de comprar un pack (o una gift card) desde el sitio: la preferencia de Mercado Pago. */
export interface CompraOnlineDto {
  purchaseId: string
  payment: { paymentId: string; amount: number; initPoint: string } | null
}

/** Lo que el sitio ve de un pack (sin `sold`). */
export type PaquetePublicoDto = Omit<PaqueteDto, 'sold'>

/** POST/PUT appointments/membership-plans */
export interface UpsertMembershipPlanDto {
  /** 2–80. */
  name: string
  /** 0–14; 0 = libre. */
  perWeek: number
  /** > 0. */
  price: number
  isFeatured: boolean
  isActive?: boolean
}

/** POST appointments/memberships. Va `customerId` O `customer`. */
export interface CreateMembershipDto {
  planId: string
  customerId?: string
  customer?: ClienteNuevoInput
  method: MetodoEnLocal
}

export type PlanMembresiaPublicoDto = Omit<PlanMembresiaDto, 'members'>

/** POST appointments/gift-cards (emitir en el local). El contrato no detalla el cuerpo: se toma el de la compra pública sin los datos de Mercado Pago. */
export interface IssueGiftCardDto {
  kind: AppointmentGiftCardKind
  amount?: number
  serviceId?: string
  style: string
  recipientName?: string
  senderName?: string
  message?: string
  method: MetodoEnLocal
}

/** POST storefront/:slug/appointments/gift-cards */
export interface BuyGiftCardDto {
  kind: AppointmentGiftCardKind
  amount?: number
  serviceId?: string
  style: string
  recipientName?: string
  senderName?: string
  message?: string
  buyerName: string
  buyerPhone: string
  buyerEmail: string
}

/** GET storefront/:slug/appointments/gift-cards/:code */
export interface GiftCardPublicaDto {
  kind: AppointmentGiftCardKind
  balance: number | null
  serviceName: string | null
  expiresAt: Iso | null
}

export interface ListGiftCardsQuery extends PaginaQuery {
  q?: string
  status?: string
}

/** POST/PUT appointments/price-rules */
export interface UpsertPriceRuleDto {
  /** 0–6, mínimo uno. */
  weekdays: number[]
  /** 0–1440, fromMin < toMin. */
  fromMin: number
  toMin: number
  /** −90..100, distinto de 0. */
  adjustPercent: number
  isActive: boolean
}

/** Un renglón de GET appointments/loyalty. */
export interface TarjetaFidelidadDto {
  customerId: string
  customerName: string
  stamps: number
  needed: number
  rewardsAvailable: number
  lastStampAt: Iso | null
}

/** POST appointments/recurring. Va `customerId` O `customer`. */
export interface CreateRecurringDto {
  customerId?: string
  customer?: ClienteNuevoInput
  resourceId: string
  serviceId: string
  frequency: AppointmentRecurrence
  startDate: Fecha
  startMin: number
  occurrences: number
}

/** Respuesta de crear un turno fijo: la serie y las fechas que no entraron. */
export type TurnoFijoCreadoDto = TurnoFijoDto & { skipped: Fecha[] }

/** PUT appointments/winback */
export interface UpsertWinbackDto {
  /** 30, 45, 60, 90 o 120. */
  inactiveDays: number
  /** ≤600. */
  message: string
  couponEnabled: boolean
  /** 5–50. */
  couponPercent: number
  /** 7–60. */
  couponValidDays: number
  mode: 'auto' | 'manual'
  isActive: boolean
}

/** GET appointments/winback/audience */
export interface AudienciaRecuperarDto {
  count: number
  sample: { name: string; lastVisit: Fecha | null; visits: number }[]
}

/** POST appointments/waitlist/:id/offer */
export interface OfferWaitlistDto {
  date: Fecha
  startMin: number
  resourceId: string
}

/** POST storefront/:slug/appointments/waitlist */
export interface JoinWaitlistDto {
  serviceId: string
  resourceId?: string
  date: Fecha
  fromMin?: number
  toMin?: number
  name: string
  phone: string
  email?: string
}
