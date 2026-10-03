// P1 — Núcleo del panel: configuración, servicios, agendas, turnos y agenda.
// Rutas: /api/v1/appointments/... (CONTRATO.md § P1). Sesión del panel.
import { panelRequest } from '@/lib/api'
import { conCuerpo, qs, seg } from './http'
import type {
  AgendaDiaDto, AgendaRangoDto, ChangeStatusDto, CreateAppointmentDto, DisponibilidadDiaDto, DisponibilidadQuery,
  DisponibilidadRangoDto, DisponibilidadRangoQuery, Fecha, ListAppointmentsQuery, ListResourcesQuery, MensajeEnviadoDto, MensajeId,
  MensajeRenderizadoDto, MoveAppointmentDto, Paginado, RecursoDto, RegisterDepositDto, ResumenDelDiaDto, ServicioDto, SettingsConAfectadosDto,
  SettingsDto, TurnoDetalleDto, TurnoDto, UpdateBookingDto, UpdateBusinessDto, UpdateMessagesDto, UpdatePaymentsDto, UpdateScheduleDto,
  UpdateSiteDto, UpdateWhatsappDto, UpsertServiceDto, UpsertSpaceDto,
} from './tipos'

const A = '/appointments'

// ─── P1.1 Configuración ─────────────────────────────────────────────────────

export const getSettings = () => panelRequest<SettingsDto>(`${A}/settings`)
export const updateSettingsBusiness = (dto: UpdateBusinessDto) => panelRequest<SettingsDto>(`${A}/settings/business`, conCuerpo('PUT', dto))
export const updateSettingsSite = (dto: UpdateSiteDto) => panelRequest<SettingsDto>(`${A}/settings/site`, conCuerpo('PUT', dto))
export const updateSettingsSchedule = (dto: UpdateScheduleDto) => panelRequest<SettingsConAfectadosDto>(`${A}/settings/schedule`, conCuerpo('PUT', dto))
export const updateSettingsBooking = (dto: UpdateBookingDto) => panelRequest<SettingsDto>(`${A}/settings/booking`, conCuerpo('PUT', dto))
export const updateSettingsMessages = (dto: UpdateMessagesDto) => panelRequest<SettingsDto>(`${A}/settings/messages`, conCuerpo('PUT', dto))
export const updateSettingsPayments = (dto: UpdatePaymentsDto) => panelRequest<SettingsDto>(`${A}/settings/payments`, conCuerpo('PUT', dto))
export const updateSettingsWhatsapp = (dto: UpdateWhatsappDto) => panelRequest<SettingsDto>(`${A}/settings/whatsapp`, conCuerpo('PUT', dto))

// ─── P1.2 Servicios ─────────────────────────────────────────────────────────

export const listServices = (includeInactive = false) => panelRequest<ServicioDto[]>(`${A}/services${qs({ includeInactive: includeInactive || undefined })}`)
export const createService = (dto: UpsertServiceDto) => panelRequest<ServicioDto>(`${A}/services`, conCuerpo('POST', dto))
export const updateService = (id: string, dto: UpsertServiceDto) => panelRequest<ServicioDto>(`${A}/services/${seg(id)}`, conCuerpo('PUT', dto))
export const reorderServices = (ids: string[]) => panelRequest<ServicioDto[]>(`${A}/services/order`, conCuerpo('PUT', { ids }))
export const deleteService = (id: string) => panelRequest<{ ok: true }>(`${A}/services/${seg(id)}`, conCuerpo('DELETE'))

// ─── P1.3 Agendas (espacios; las personas se manejan en Equipo) ─────────────

export const listResources = (q: ListResourcesQuery = {}) => panelRequest<RecursoDto[]>(`${A}/resources${qs({ kind: q.kind, bookable: q.bookable })}`)
export const createSpace = (dto: UpsertSpaceDto) => panelRequest<RecursoDto>(`${A}/resources`, conCuerpo('POST', dto))
export const updateSpace = (id: string, dto: UpsertSpaceDto) => panelRequest<RecursoDto>(`${A}/resources/${seg(id)}`, conCuerpo('PUT', dto))
export const deleteResource = (id: string) => panelRequest<{ ok: true }>(`${A}/resources/${seg(id)}`, conCuerpo('DELETE'))

// ─── P1.4 Turnos ────────────────────────────────────────────────────────────

export const listAppointments = (q: ListAppointmentsQuery = {}) => panelRequest<Paginado<TurnoDto>>(`${A}${qs({ ...q })}`)
export const getAvailability = (q: DisponibilidadQuery) => panelRequest<DisponibilidadDiaDto>(`${A}/availability${qs({ ...q })}`)
export const getAvailabilityRange = (q: DisponibilidadRangoQuery) => panelRequest<DisponibilidadRangoDto>(`${A}/availability/range${qs({ ...q })}`)
export const getAppointment = (id: string) => panelRequest<TurnoDetalleDto>(`${A}/${seg(id)}`)
export const createAppointment = (dto: CreateAppointmentDto) => panelRequest<TurnoDetalleDto>(A, conCuerpo('POST', dto))
export const changeAppointmentStatus = (id: string, dto: ChangeStatusDto) => panelRequest<TurnoDetalleDto>(`${A}/${seg(id)}/status`, conCuerpo('PATCH', dto))
export const moveAppointment = (id: string, dto: MoveAppointmentDto) => panelRequest<TurnoDetalleDto>(`${A}/${seg(id)}/move`, conCuerpo('POST', dto))
export const registerDeposit = (id: string, dto: RegisterDepositDto) => panelRequest<TurnoDetalleDto>(`${A}/${seg(id)}/deposit`, conCuerpo('POST', dto))
export const updateAppointmentNote = (id: string, internalNote: string | null) => panelRequest<TurnoDetalleDto>(`${A}/${seg(id)}/note`, conCuerpo('PATCH', { internalNote }))
export const getAppointmentMessage = (id: string, template: MensajeId) => panelRequest<MensajeRenderizadoDto>(`${A}/${seg(id)}/message${qs({ template })}`)
export const sendAppointmentMessage = (id: string, template: MensajeId) => panelRequest<MensajeEnviadoDto[]>(`${A}/${seg(id)}/messages`, conCuerpo('POST', { template }))

// ─── P1.5 Agenda y resumen ──────────────────────────────────────────────────

export const getAgendaDay = (date: Fecha) => panelRequest<AgendaDiaDto>(`${A}/agenda/day${qs({ date })}`)
/** Hasta 42 días (la grilla del mes). */
export const getAgendaRange = (from: Fecha, to: Fecha) => panelRequest<AgendaRangoDto>(`${A}/agenda/range${qs({ from, to })}`)
/** Sin fecha, hoy. */
export const getSummary = (date?: Fecha) => panelRequest<ResumenDelDiaDto>(`${A}/summary${qs({ date })}`)
