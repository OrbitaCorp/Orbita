// Hooks de React Query de P3: clases con cupo, clientes, equipo y roles,
// ganancias y liquidaciones. Un hook por operación.
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clavesTurnos as K } from '../claves'
import * as api from '../equipo'
import { invalidar } from './nucleo'
import type {
  ClaseDetalleDto, CreateClientDto, EnrollDto, Fecha, InvitePersonDto, ListClientsQuery, PaginaQuery, PayFormDto, RangoFechasQuery,
  RegisterPayoutDto, UpdateClassSessionDto, UpdateClientDto, UpsertClassTemplateDto, UpsertPersonDto, UpsertRoleDto,
} from '../tipos'

// ─── Clases con cupo ────────────────────────────────────────────────────────

export function usePlantillasClase() {
  return useQuery({ queryKey: K.plantillasClase, queryFn: api.listClassTemplates, staleTime: 60_000 })
}

export function useCrearPlantillaClase() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertClassTemplateDto) => api.createClassTemplate(dto), onSuccess: () => invalidar(qc, K.clases, K.agenda) })
}

export function useEditarPlantillaClase() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpsertClassTemplateDto }) => api.updateClassTemplate(id, dto), onSuccess: () => invalidar(qc, K.clases, K.agenda) })
}

export function useEliminarPlantillaClase() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteClassTemplate(id), onSuccess: () => invalidar(qc, K.clases, K.agenda) })
}

/** Las clases de un rango (hasta 14 días). */
export function useClases(desde: Fecha, hasta: Fecha) {
  return useQuery({ queryKey: K.clasesRango(desde, hasta), queryFn: () => api.listClasses(desde, hasta) })
}

export function useClase(templateId: string | null, fecha: Fecha | null) {
  return useQuery({ queryKey: K.clase(templateId ?? '', fecha ?? ''), queryFn: templateId && fecha ? () => api.getClass(templateId, fecha) : skipToken })
}

/** Lo que cambia al tocar una clase: su detalle (con la respuesta), la grilla, la agenda y el resumen. */
function useTrasCambiarClase() {
  const qc = useQueryClient()
  return (clase?: ClaseDetalleDto) => {
    if (clase) qc.setQueryData(K.clase(clase.templateId, clase.date), clase)
    return invalidar(qc, K.clases, K.agenda, K.resumenes)
  }
}

/** Cupo propio de ese día o suspenderla. */
export function useEditarClase() {
  const tras = useTrasCambiarClase()
  return useMutation({
    mutationFn: ({ templateId, fecha, dto }: { templateId: string; fecha: Fecha; dto: UpdateClassSessionDto }) => api.updateClassSession(templateId, fecha, dto),
    onSuccess: c => tras(c),
  })
}

export function useAnotarEnClase() {
  const tras = useTrasCambiarClase()
  return useMutation({
    mutationFn: ({ templateId, fecha, dto }: { templateId: string; fecha: Fecha; dto: EnrollDto }) => api.enrollClient(templateId, fecha, dto),
    onSuccess: c => tras(c),
  })
}

export function useSacarDeClase() {
  const tras = useTrasCambiarClase()
  return useMutation({ mutationFn: (inscripcionId: string) => api.removeEnrollment(inscripcionId), onSuccess: c => tras(c) })
}

export function useMarcarAsistencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ inscripcionId, asistio }: { inscripcionId: string; asistio: boolean | null }) => api.setAttendance(inscripcionId, asistio),
    // Las visitas de los clientes cuentan las clases con asistencia.
    onSuccess: () => invalidar(qc, K.clases, K.clientes, K.ganancias),
  })
}

// ─── Clientes ───────────────────────────────────────────────────────────────

export function useClientesTurnos(q: ListClientsQuery = {}) {
  return useQuery({ queryKey: K.clientesLista(q), queryFn: () => api.listClients(q) })
}

export function useClienteTurnos(id: string | null) {
  return useQuery({ queryKey: K.cliente(id ?? ''), queryFn: id ? () => api.getClient(id) : skipToken })
}

export function useCrearClienteTurnos() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: CreateClientDto) => api.createClient(dto), onSuccess: () => invalidar(qc, K.clientes) })
}

export function useEditarClienteTurnos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateClientDto }) => api.updateClient(id, dto),
    onSuccess: ficha => {
      qc.setQueryData(K.cliente(ficha.id), ficha)
      return invalidar(qc, K.clientes, K.turnos)
    },
  })
}

// ─── Equipo y roles ─────────────────────────────────────────────────────────

export function useEquipoTurnos() {
  return useQuery({ queryKey: K.equipo, queryFn: api.listTeam, staleTime: 60_000 })
}

/** Una persona del equipo también es una agenda: se refrescan las dos cosas. */
const trasCambiarEquipo = [K.equipo, K.agendas, K.agenda, K.disponibilidad, K.ganancias] as const

export function useInvitarPersona() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: InvitePersonDto) => api.invitePerson(dto), onSuccess: () => invalidar(qc, ...trasCambiarEquipo, K.roles) })
}

export function useCrearPersona() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertPersonDto) => api.createPerson(dto), onSuccess: () => invalidar(qc, ...trasCambiarEquipo) })
}

export function useEditarPersona() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ resourceId, dto }: { resourceId: string; dto: UpsertPersonDto }) => api.updatePerson(resourceId, dto), onSuccess: () => invalidar(qc, ...trasCambiarEquipo, K.roles) })
}

export function useEditarPagoPersona() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ resourceId, dto }: { resourceId: string; dto: PayFormDto }) => api.updatePersonPay(resourceId, dto), onSuccess: () => invalidar(qc, K.equipo, K.ganancias) })
}

export function useEliminarPersona() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (resourceId: string) => api.deletePerson(resourceId), onSuccess: () => invalidar(qc, ...trasCambiarEquipo, K.roles) })
}

export function useRolesTurnos() {
  return useQuery({ queryKey: K.roles, queryFn: api.listRoles, staleTime: 60_000 })
}

export function useCrearRol() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertRoleDto) => api.createRole(dto), onSuccess: () => invalidar(qc, K.roles) })
}

export function useEditarRol() {
  const qc = useQueryClient()
  // Cambiar "atiende turnos" o los permisos cambia quién tiene agenda.
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpsertRoleDto }) => api.updateRole(id, dto), onSuccess: () => invalidar(qc, K.roles, K.equipo) })
}

export function useRestablecerRol() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.resetRole(id), onSuccess: () => invalidar(qc, K.roles, K.equipo) })
}

export function useEliminarRol() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteRole(id), onSuccess: () => invalidar(qc, K.roles) })
}

// ─── Ganancias ──────────────────────────────────────────────────────────────

/** Los períodos (hoy, semana, mes, mes pasado) se arman con reloj.ts: semanaDe, mesDe, mesAnterior. */
export function useGanancias(q: RangoFechasQuery) {
  return useQuery({ queryKey: K.gananciasRango(q), queryFn: () => api.getEarnings(q) })
}

export function useGananciasPersona(resourceId: string | null, q: RangoFechasQuery) {
  return useQuery({ queryKey: K.gananciasPersona(resourceId ?? '', q), queryFn: resourceId ? () => api.getPersonEarnings(resourceId, q) : skipToken })
}

export function usePagosEquipo(resourceId: string | null, q: PaginaQuery = {}) {
  return useQuery({ queryKey: K.pagosEquipo(resourceId ?? '', q), queryFn: resourceId ? () => api.listPayouts(resourceId, q) : skipToken })
}

export function useRegistrarPagoEquipo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ resourceId, dto }: { resourceId: string; dto: RegisterPayoutDto }) => api.registerPayout(resourceId, dto), onSuccess: () => invalidar(qc, K.ganancias) })
}
