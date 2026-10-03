// Query keys de React Query para Turnos, en un solo lugar. Todo lo del panel
// cuelga de ['turnos'], lo del sitio público de ['turnos-sitio', slug] y lo de
// la cuenta del cliente de ['turnos-cuenta']: invalidar una raíz refresca todo
// lo que hay debajo. Los hooks (hooks/*) usan solo estas claves.
import type {
  AppointmentMembershipStatus, AppointmentWaitlistStatus, DisponibilidadMiTurnoQuery, DisponibilidadQuery, DisponibilidadRangoQuery, Fecha,
  ListAppointmentsQuery, ListClientsQuery, ListGiftCardsQuery, ListResourcesQuery, PaginaQuery, RangoFechasQuery,
} from './tipos'

const P = 'turnos'
const S = 'turnos-sitio'
const C = 'turnos-cuenta'

export const clavesTurnos = {
  todo: [P] as const,

  // P1
  settings: [P, 'settings'] as const,
  servicios: [P, 'servicios'] as const,
  serviciosLista: (includeInactive: boolean) => [P, 'servicios', { includeInactive }] as const,
  agendas: [P, 'agendas'] as const,
  agendasLista: (q: ListResourcesQuery) => [P, 'agendas', q] as const,
  turnos: [P, 'turnos'] as const,
  turnosLista: (q: ListAppointmentsQuery) => [P, 'turnos', 'lista', q] as const,
  turno: (id: string) => [P, 'turnos', 'detalle', id] as const,
  mensajeTurno: (id: string, plantilla: string) => [P, 'turnos', 'detalle', id, 'mensaje', plantilla] as const,
  disponibilidad: [P, 'disponibilidad'] as const,
  disponibilidadDia: (q: DisponibilidadQuery) => [P, 'disponibilidad', 'dia', q] as const,
  disponibilidadRango: (q: DisponibilidadRangoQuery) => [P, 'disponibilidad', 'rango', q] as const,
  agenda: [P, 'agenda'] as const,
  agendaDia: (fecha: Fecha) => [P, 'agenda', 'dia', fecha] as const,
  agendaRango: (desde: Fecha, hasta: Fecha) => [P, 'agenda', 'rango', desde, hasta] as const,
  resumen: (fecha: Fecha | null) => [P, 'resumen', fecha] as const,
  resumenes: [P, 'resumen'] as const,

  // P3
  plantillasClase: [P, 'clases', 'plantillas'] as const,
  clases: [P, 'clases'] as const,
  clasesRango: (desde: Fecha, hasta: Fecha) => [P, 'clases', 'rango', desde, hasta] as const,
  clase: (templateId: string, fecha: Fecha) => [P, 'clases', 'detalle', templateId, fecha] as const,
  clientes: [P, 'clientes'] as const,
  clientesLista: (q: ListClientsQuery) => [P, 'clientes', 'lista', q] as const,
  cliente: (id: string) => [P, 'clientes', 'detalle', id] as const,
  equipo: [P, 'equipo'] as const,
  roles: [P, 'roles'] as const,
  ganancias: [P, 'ganancias'] as const,
  gananciasRango: (q: RangoFechasQuery) => [P, 'ganancias', 'todos', q] as const,
  gananciasPersona: (resourceId: string, q: RangoFechasQuery) => [P, 'ganancias', 'persona', resourceId, q] as const,
  pagosEquipo: (resourceId: string, q: PaginaQuery) => [P, 'ganancias', 'pagos', resourceId, q] as const,

  // P4
  avanzado: [P, 'avanzado'] as const,
  paquetes: [P, 'avanzado', 'paquetes'] as const,
  paquetesVendidos: (q: object) => [P, 'avanzado', 'paquetes', 'vendidos', q] as const,
  planesMembresia: [P, 'avanzado', 'planes-membresia'] as const,
  membresias: [P, 'avanzado', 'membresias'] as const,
  membresiasLista: (q: { status?: AppointmentMembershipStatus } & PaginaQuery) => [P, 'avanzado', 'membresias', q] as const,
  giftCards: [P, 'avanzado', 'gift-cards'] as const,
  giftCardsLista: (q: ListGiftCardsQuery) => [P, 'avanzado', 'gift-cards', q] as const,
  reglasPrecio: [P, 'avanzado', 'precios-horario'] as const,
  fidelidad: [P, 'avanzado', 'fidelidad'] as const,
  fidelidadLista: (q: PaginaQuery) => [P, 'avanzado', 'fidelidad', q] as const,
  turnosFijos: [P, 'avanzado', 'turno-fijo'] as const,
  recuperar: [P, 'avanzado', 'recuperar'] as const,
  audienciaRecuperar: (dias: number) => [P, 'avanzado', 'recuperar', 'audiencia', dias] as const,
  espera: [P, 'espera'] as const,
  esperaLista: (q: { date?: Fecha; status?: AppointmentWaitlistStatus }) => [P, 'espera', q] as const,

  // Sitio público
  sitio: (slug: string) => [S, slug] as const,
  sitioDatos: (slug: string) => [S, slug, 'sitio'] as const,
  sitioServicios: (slug: string) => [S, slug, 'servicios'] as const,
  sitioAgendas: (slug: string, serviceId: string | null) => [S, slug, 'agendas', serviceId] as const,
  sitioDisponibilidad: (slug: string) => [S, slug, 'disponibilidad'] as const,
  sitioDisponibilidadDia: (slug: string, q: Omit<DisponibilidadQuery, 'except'>) => [S, slug, 'disponibilidad', 'dia', q] as const,
  sitioDisponibilidadRango: (slug: string, q: Omit<DisponibilidadRangoQuery, 'except'>) => [S, slug, 'disponibilidad', 'rango', q] as const,
  sitioClasesTodas: (slug: string) => [S, slug, 'clases'] as const,
  sitioClases: (slug: string, desde: Fecha, hasta: Fecha) => [S, slug, 'clases', desde, hasta] as const,
  sitioPaquetes: (slug: string) => [S, slug, 'paquetes'] as const,
  sitioPlanes: (slug: string) => [S, slug, 'planes-membresia'] as const,
  sitioGiftCard: (slug: string, code: string) => [S, slug, 'gift-card', code] as const,
  // "Mi turno": la clave lleva el token porque ES la identidad de la reserva (no sale del navegador).
  miTurno: (slug: string, token: string) => [S, slug, 'mi-turno', token] as const,
  miTurnoDisponibilidad: (slug: string, token: string, q: DisponibilidadMiTurnoQuery) => [S, slug, 'mi-turno', token, 'disponibilidad', q] as const,
  misReservas: (slug: string, tokens: readonly string[]) => [S, slug, 'mis-reservas', tokens] as const,
  misReservasTodas: (slug: string) => [S, slug, 'mis-reservas'] as const,

  // Cuenta del cliente
  cuenta: [C] as const,
  cuentaDisponibilidad: (id: string, q: DisponibilidadMiTurnoQuery) => [C, 'disponibilidad', id, q] as const,
}
