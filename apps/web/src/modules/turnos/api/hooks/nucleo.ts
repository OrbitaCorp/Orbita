// Hooks de React Query del núcleo del panel (P1): configuración, servicios,
// agendas, turnos, agenda y resumen. Un hook por operación; las claves salen
// de claves.ts y cada mutación invalida lo que cambia en onSuccess.
import { skipToken, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { clavesTurnos as K } from '../claves'
import * as api from '../nucleo'
import type {
  ChangeStatusDto, CreateAppointmentDto, DisponibilidadQuery, DisponibilidadRangoQuery, Fecha, ListAppointmentsQuery, ListResourcesQuery,
  MensajeId, MoveAppointmentDto, RegisterDepositDto, SettingsDto, TurnoDetalleDto, UpdateBookingDto, UpdateBusinessDto, UpdateMessagesDto,
  UpdatePaymentsDto, UpdateScheduleDto, UpdateSiteDto, UpdateWhatsappDto, UpsertServiceDto, UpsertSpaceDto,
} from '../tipos'

/** Invalida varias claves de una. */
export const invalidar = (qc: QueryClient, ...claves: QueryKey[]) => Promise.all(claves.map(queryKey => qc.invalidateQueries({ queryKey })))

// ─── Configuración ──────────────────────────────────────────────────────────

/** Lo puede leer cualquier miembro: el panel lo necesita para dibujarse. */
export function useConfiguracionTurnos() {
  return useQuery({ queryKey: K.settings, queryFn: api.getSettings, staleTime: 60_000 })
}

/** Guardar una pestaña de Configuración: la respuesta trae la configuración entera. */
function useGuardarConfig<T, R extends SettingsDto>(guardar: (dto: T) => Promise<R>, ademas: QueryKey[] = []) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: guardar,
    onSuccess: settings => {
      qc.setQueryData(K.settings, settings)
      return invalidar(qc, ...ademas)
    },
  })
}

export const useGuardarNegocio = () => useGuardarConfig((dto: UpdateBusinessDto) => api.updateSettingsBusiness(dto))
export const useGuardarSitio = () => useGuardarConfig((dto: UpdateSiteDto) => api.updateSettingsSite(dto))
/** La respuesta suma `affected`: turnos futuros que quedaron fuera del horario nuevo (para avisar). */
export const useGuardarHorarios = () => useGuardarConfig((dto: UpdateScheduleDto) => api.updateSettingsSchedule(dto), [K.disponibilidad, K.agenda, K.resumenes])
export const useGuardarReglasReserva = () => useGuardarConfig((dto: UpdateBookingDto) => api.updateSettingsBooking(dto), [K.disponibilidad, K.resumenes])
export const useGuardarMensajes = () => useGuardarConfig((dto: UpdateMessagesDto) => api.updateSettingsMessages(dto))
export const useGuardarPagos = () => useGuardarConfig((dto: UpdatePaymentsDto) => api.updateSettingsPayments(dto))
export const useGuardarWhatsapp = () => useGuardarConfig((dto: UpdateWhatsappDto) => api.updateSettingsWhatsapp(dto))

// ─── Servicios ──────────────────────────────────────────────────────────────

export function useServiciosTurnos(incluirInactivos = false) {
  return useQuery({ queryKey: K.serviciosLista(incluirInactivos), queryFn: () => api.listServices(incluirInactivos), staleTime: 60_000 })
}

export function useCrearServicio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertServiceDto) => api.createService(dto), onSuccess: () => invalidar(qc, K.servicios) })
}

export function useEditarServicio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpsertServiceDto }) => api.updateService(id, dto),
    // Cambia la duración o el precio: cambian los horarios libres.
    onSuccess: () => invalidar(qc, K.servicios, K.disponibilidad),
  })
}

export function useOrdenarServicios() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (ids: string[]) => api.reorderServices(ids), onSuccess: () => invalidar(qc, K.servicios) })
}

export function useEliminarServicio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteService(id), onSuccess: () => invalidar(qc, K.servicios, K.disponibilidad) })
}

// ─── Agendas (espacios) ─────────────────────────────────────────────────────

export function useAgendasTurnos(q: ListResourcesQuery = {}) {
  return useQuery({ queryKey: K.agendasLista(q), queryFn: () => api.listResources(q), staleTime: 60_000 })
}

const trasCambiarAgendas = (qc: QueryClient) => invalidar(qc, K.agendas, K.equipo, K.agenda, K.disponibilidad, K.resumenes)

export function useCrearEspacio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertSpaceDto) => api.createSpace(dto), onSuccess: () => trasCambiarAgendas(qc) })
}

export function useEditarEspacio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpsertSpaceDto }) => api.updateSpace(id, dto), onSuccess: () => trasCambiarAgendas(qc) })
}

export function useEliminarAgenda() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteResource(id), onSuccess: () => trasCambiarAgendas(qc) })
}

// ─── Turnos ─────────────────────────────────────────────────────────────────

export function useTurnos(q: ListAppointmentsQuery = {}) {
  return useQuery({ queryKey: K.turnosLista(q), queryFn: () => api.listAppointments(q) })
}

export function useTurno(id: string | null) {
  return useQuery({ queryKey: K.turno(id ?? ''), queryFn: id ? () => api.getAppointment(id) : skipToken })
}

/** Horarios libres de un día (modo panel). null = todavía no hay servicio o fecha elegidos. */
export function useDisponibilidad(q: DisponibilidadQuery | null) {
  return useQuery({ queryKey: K.disponibilidadDia(q ?? { serviceId: '', date: '' }), queryFn: q ? () => api.getAvailability(q) : skipToken })
}

export function useDisponibilidadRango(q: DisponibilidadRangoQuery | null) {
  return useQuery({ queryKey: K.disponibilidadRango(q ?? { serviceId: '', from: '', to: '' }), queryFn: q ? () => api.getAvailabilityRange(q) : skipToken })
}

/** Lo que cambia cuando se toca un turno: listas, agenda, resumen, horarios libres, clientes (visitas) y ganancias. */
function trasCambiarTurno(qc: QueryClient, turno?: TurnoDetalleDto) {
  if (turno) qc.setQueryData(K.turno(turno.id), turno)
  return invalidar(qc, K.turnos, K.agenda, K.resumenes, K.disponibilidad, K.clientes, K.ganancias)
}

export function useCrearTurno() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: CreateAppointmentDto) => api.createAppointment(dto), onSuccess: t => trasCambiarTurno(qc, t) })
}

export function useCambiarEstadoTurno() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: ChangeStatusDto }) => api.changeAppointmentStatus(id, dto), onSuccess: t => trasCambiarTurno(qc, t) })
}

export function useMoverTurno() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: MoveAppointmentDto }) => api.moveAppointment(id, dto), onSuccess: t => trasCambiarTurno(qc, t) })
}

export function useRegistrarSena() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: RegisterDepositDto }) => api.registerDeposit(id, dto), onSuccess: t => trasCambiarTurno(qc, t) })
}

export function useEditarNotaTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, nota }: { id: string; nota: string | null }) => api.updateAppointmentNote(id, nota),
    onSuccess: t => {
      qc.setQueryData(K.turno(t.id), t)
      return invalidar(qc, K.turnos, K.agenda)
    },
  })
}

/** El texto de una plantilla para mandarlo a mano (wa.me). null = no pedirlo todavía. */
export function useMensajeTurno(id: string | null, plantilla: MensajeId | null) {
  return useQuery({
    queryKey: K.mensajeTurno(id ?? '', plantilla ?? ''),
    queryFn: id && plantilla ? () => api.getAppointmentMessage(id, plantilla) : skipToken,
  })
}

export function useEnviarMensajeTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, plantilla }: { id: string; plantilla: MensajeId }) => api.sendAppointmentMessage(id, plantilla),
    // El detalle del turno lista los mensajes enviados.
    onSuccess: (_r, { id }) => invalidar(qc, K.turno(id)),
  })
}

// ─── Agenda y resumen ───────────────────────────────────────────────────────

export function useAgendaDia(fecha: Fecha) {
  return useQuery({ queryKey: K.agendaDia(fecha), queryFn: () => api.getAgendaDay(fecha) })
}

/** Semana o mes (hasta 42 días). */
export function useAgendaRango(desde: Fecha, hasta: Fecha) {
  return useQuery({ queryKey: K.agendaRango(desde, hasta), queryFn: () => api.getAgendaRange(desde, hasta) })
}

/** Sin fecha, el de hoy. */
export function useResumenDia(fecha?: Fecha) {
  return useQuery({ queryKey: K.resumen(fecha ?? null), queryFn: () => api.getSummary(fecha), refetchInterval: 60_000 })
}
