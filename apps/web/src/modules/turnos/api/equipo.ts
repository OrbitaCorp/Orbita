// P3 — Clases con cupo, clientes, equipo y roles, ganancias y liquidaciones.
// Rutas: /api/v1/appointments/... (CONTRATO.md § P3). Sesión del panel.
import { panelRequest } from '@/lib/api'
import { conCuerpo, qs, seg } from './http'
import type {
  AnotadoDto, ClaseDelDiaDto, ClaseDetalleDto, ClienteDto, ClienteFichaDto, CreateClientDto, EnrollDto, Fecha, GananciasDto,
  GananciasPersonaDto, InvitacionDto, InvitePersonDto, ListClientsQuery, PagoEquipoDto, PaginaQuery, Paginado, PayFormDto,
  PersonaDto, PlantillaClaseDto, RangoFechasQuery, RegisterPayoutDto, RolTurnosDto, UpdateClassSessionDto, UpdateClientDto,
  UpsertClassTemplateDto, UpsertPersonDto, UpsertRoleDto,
} from './tipos'

const A = '/appointments'
const clase = (templateId: string, date: Fecha) => `${A}/classes/${seg(templateId)}/${seg(date)}`

// ─── P3.1 Clases con cupo ───────────────────────────────────────────────────

export const listClassTemplates = () => panelRequest<PlantillaClaseDto[]>(`${A}/class-templates`)
export const createClassTemplate = (dto: UpsertClassTemplateDto) => panelRequest<PlantillaClaseDto>(`${A}/class-templates`, conCuerpo('POST', dto))
export const updateClassTemplate = (id: string, dto: UpsertClassTemplateDto) => panelRequest<PlantillaClaseDto>(`${A}/class-templates/${seg(id)}`, conCuerpo('PUT', dto))
export const deleteClassTemplate = (id: string) => panelRequest<{ ok: true }>(`${A}/class-templates/${seg(id)}`, conCuerpo('DELETE'))
/** Hasta 14 días. */
export const listClasses = (from: Fecha, to: Fecha) => panelRequest<ClaseDelDiaDto[]>(`${A}/classes${qs({ from, to })}`)
export const getClass = (templateId: string, date: Fecha) => panelRequest<ClaseDetalleDto>(clase(templateId, date))
export const updateClassSession = (templateId: string, date: Fecha, dto: UpdateClassSessionDto) => panelRequest<ClaseDetalleDto>(clase(templateId, date), conCuerpo('PUT', dto))
export const enrollClient = (templateId: string, date: Fecha, dto: EnrollDto) => panelRequest<ClaseDetalleDto>(`${clase(templateId, date)}/enrollments`, conCuerpo('POST', dto))
export const removeEnrollment = (id: string) => panelRequest<ClaseDetalleDto>(`${A}/class-enrollments/${seg(id)}`, conCuerpo('DELETE'))
/** null = sin marcar. */
export const setAttendance = (id: string, attended: boolean | null) => panelRequest<AnotadoDto>(`${A}/class-enrollments/${seg(id)}/attendance`, conCuerpo('PATCH', { attended }))

// ─── P3.2 Clientes ──────────────────────────────────────────────────────────

export const listClients = (q: ListClientsQuery = {}) => panelRequest<Paginado<ClienteDto>>(`${A}/clients${qs({ ...q })}`)
export const getClient = (id: string) => panelRequest<ClienteFichaDto>(`${A}/clients/${seg(id)}`)
export const createClient = (dto: CreateClientDto) => panelRequest<ClienteDto>(`${A}/clients`, conCuerpo('POST', dto))
export const updateClient = (id: string, dto: UpdateClientDto) => panelRequest<ClienteFichaDto>(`${A}/clients/${seg(id)}`, conCuerpo('PUT', dto))

// ─── P3.3 Equipo y roles ────────────────────────────────────────────────────

export const listTeam = () => panelRequest<PersonaDto[]>(`${A}/team`)
export const invitePerson = (dto: InvitePersonDto) => panelRequest<InvitacionDto>(`${A}/team/invite`, conCuerpo('POST', dto))
/** Una persona sin acceso al panel. */
export const createPerson = (dto: UpsertPersonDto) => panelRequest<PersonaDto>(`${A}/team`, conCuerpo('POST', dto))
export const updatePerson = (resourceId: string, dto: UpsertPersonDto) => panelRequest<PersonaDto>(`${A}/team/${seg(resourceId)}`, conCuerpo('PUT', dto))
export const updatePersonPay = (resourceId: string, dto: PayFormDto) => panelRequest<PersonaDto>(`${A}/team/${seg(resourceId)}/pay`, conCuerpo('PUT', dto))
export const deletePerson = (resourceId: string) => panelRequest<{ ok: true }>(`${A}/team/${seg(resourceId)}`, conCuerpo('DELETE'))

export const listRoles = () => panelRequest<RolTurnosDto[]>(`${A}/roles`)
export const createRole = (dto: UpsertRoleDto) => panelRequest<RolTurnosDto>(`${A}/roles`, conCuerpo('POST', dto))
export const updateRole = (id: string, dto: UpsertRoleDto) => panelRequest<RolTurnosDto>(`${A}/roles/${seg(id)}`, conCuerpo('PUT', dto))
/** Vuelve un rol de fábrica a como viene para el rubro. */
export const resetRole = (id: string) => panelRequest<RolTurnosDto>(`${A}/roles/${seg(id)}/reset`, conCuerpo('POST'))
export const deleteRole = (id: string) => panelRequest<{ ok: true }>(`${A}/roles/${seg(id)}`, conCuerpo('DELETE'))

// ─── P3.4 Ganancias y liquidaciones ─────────────────────────────────────────

/** Hasta 366 días. */
export const getEarnings = (q: RangoFechasQuery) => panelRequest<GananciasDto>(`${A}/earnings${qs({ ...q })}`)
export const getPersonEarnings = (resourceId: string, q: RangoFechasQuery) => panelRequest<GananciasPersonaDto>(`${A}/earnings/${seg(resourceId)}${qs({ ...q })}`)
export const listPayouts = (resourceId: string, q: PaginaQuery = {}) => panelRequest<Paginado<PagoEquipoDto>>(`${A}/earnings/${seg(resourceId)}/payouts${qs({ ...q })}`)
export const registerPayout = (resourceId: string, dto: RegisterPayoutDto) => panelRequest<GananciasPersonaDto>(`${A}/earnings/${seg(resourceId)}/payouts`, conCuerpo('POST', dto))
