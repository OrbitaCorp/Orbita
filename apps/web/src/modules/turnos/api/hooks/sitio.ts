// Hooks de React Query del sitio público de turnos (P2 y las partes públicas
// de P3/P4), de "mi turno" por enlace personal y de la cuenta del cliente.
// Un hook por operación.
//
// Reservar guarda el `accessToken` de la reserva en el dispositivo
// (misReservas.ts): es la única vez que la API lo devuelve.
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clavesTurnos as K } from '../claves'
import * as cuenta from '../cuenta'
import * as api from '../publico'
import { depurarReservas, guardarReserva, useReservasGuardadas } from '../misReservas'
import { invalidar } from './nucleo'
import type {
  BuyGiftCardDto, BuyPackageDto, CreateBookingDto, DisponibilidadMiTurnoQuery, DisponibilidadQuery, DisponibilidadRangoQuery, Fecha,
  JoinWaitlistDto, PublicEnrollDto, RescheduleDto,
} from '../tipos'

// ─── Sitio ──────────────────────────────────────────────────────────────────

export function useSitioTurnos(slug: string) {
  return useQuery({ queryKey: K.sitioDatos(slug), queryFn: () => api.getSite(slug), staleTime: 5 * 60_000 })
}

export function useServiciosSitio(slug: string) {
  return useQuery({ queryKey: K.sitioServicios(slug), queryFn: () => api.listPublicServices(slug), staleTime: 5 * 60_000 })
}

export function useAgendasSitio(slug: string, serviceId?: string) {
  return useQuery({ queryKey: K.sitioAgendas(slug, serviceId ?? null), queryFn: () => api.listPublicResources(slug, serviceId), staleTime: 5 * 60_000 })
}

/** null = todavía no eligió servicio o día. */
export function useDisponibilidadSitio(slug: string, q: Omit<DisponibilidadQuery, 'except'> | null) {
  return useQuery({
    queryKey: K.sitioDisponibilidadDia(slug, q ?? { serviceId: '', date: '' }),
    queryFn: q ? () => api.getPublicAvailability(slug, q) : skipToken,
    staleTime: 30_000,
  })
}

export function useDisponibilidadRangoSitio(slug: string, q: Omit<DisponibilidadRangoQuery, 'except'> | null) {
  return useQuery({
    queryKey: K.sitioDisponibilidadRango(slug, q ?? { serviceId: '', from: '', to: '' }),
    queryFn: q ? () => api.getPublicAvailabilityRange(slug, q) : skipToken,
    staleTime: 30_000,
  })
}

export function useReservar(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateBookingDto) => api.createBooking(slug, dto),
    onSuccess: r => {
      guardarReserva(slug, r.accessToken)
      return invalidar(qc, K.sitioDisponibilidad(slug), K.misReservasTodas(slug))
    },
    // Un 409 (el horario se acaba de ocupar) también deja la disponibilidad vieja.
    onError: () => invalidar(qc, K.sitioDisponibilidad(slug)),
  })
}

export function useClasesSitio(slug: string, desde: Fecha, hasta: Fecha) {
  return useQuery({ queryKey: K.sitioClases(slug, desde, hasta), queryFn: () => api.listPublicClasses(slug, desde, hasta), staleTime: 30_000 })
}

export function useAnotarseEnClase(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: PublicEnrollDto) => api.enrollInClass(slug, dto),
    onSuccess: r => {
      guardarReserva(slug, r.accessToken)
      return invalidar(qc, K.sitioClasesTodas(slug), K.misReservasTodas(slug))
    },
  })
}

export function usePaquetesSitio(slug: string) {
  return useQuery({ queryKey: K.sitioPaquetes(slug), queryFn: () => api.listPublicPackages(slug), staleTime: 5 * 60_000 })
}

/** Devuelve la preferencia de Mercado Pago (`payment.initPoint`). */
export function useComprarPaquete(slug: string) {
  return useMutation({ mutationFn: ({ packageId, dto }: { packageId: string; dto: BuyPackageDto }) => api.buyPackage(slug, packageId, dto) })
}

export function usePlanesMembresiaSitio(slug: string) {
  return useQuery({ queryKey: K.sitioPlanes(slug), queryFn: () => api.listPublicMembershipPlans(slug), staleTime: 5 * 60_000 })
}

export function useComprarGiftCard(slug: string) {
  return useMutation({ mutationFn: (dto: BuyGiftCardDto) => api.buyGiftCard(slug, dto) })
}

/** Consultar el saldo de una gift card. null = todavía no hay código. */
export function useGiftCardSitio(slug: string, codigo: string | null) {
  return useQuery({ queryKey: K.sitioGiftCard(slug, codigo ?? ''), queryFn: codigo ? () => api.getGiftCard(slug, codigo) : skipToken, retry: false })
}

export function useAnotarseEnEspera(slug: string) {
  return useMutation({ mutationFn: (dto: JoinWaitlistDto) => api.joinWaitlist(slug, dto) })
}

export function useAceptarLugarEspera(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (oferta: string) => api.acceptWaitlistOffer(slug, oferta),
    onSuccess: r => {
      guardarReserva(slug, r.accessToken)
      return invalidar(qc, K.sitioDisponibilidad(slug), K.misReservasTodas(slug))
    },
  })
}

// ─── Mi turno (por enlace personal) ─────────────────────────────────────────

export function useMiTurno(slug: string, token: string | null) {
  return useQuery({ queryKey: K.miTurno(slug, token ?? ''), queryFn: token ? () => api.getMyBooking(slug, token) : skipToken, retry: false })
}

/**
 * Las reservas hechas desde este dispositivo para ese negocio. Lee los tokens
 * guardados y, con la respuesta, olvida los que la API ya no reconoce.
 */
export function useMisReservas(slug: string) {
  const tokens = useReservasGuardadas(slug)
  return useQuery({
    queryKey: K.misReservas(slug, tokens),
    queryFn: tokens.length
      ? async () => {
          const r = await api.listMyBookings(slug, [...tokens])
          depurarReservas(slug, tokens, r.map(x => x.token))
          return r
        }
      : skipToken,
  })
}

/** Lo que cambia al tocar una reserva propia: ella misma, la lista del dispositivo y los horarios libres. */
function useTrasMiTurno(slug: string, token: string) {
  const qc = useQueryClient()
  return () => invalidar(qc, K.miTurno(slug, token), K.misReservasTodas(slug), K.sitioDisponibilidad(slug))
}

export function useCancelarMiTurno(slug: string, token: string) {
  const tras = useTrasMiTurno(slug, token)
  return useMutation({ mutationFn: (motivo?: string) => api.cancelMyBooking(slug, token, motivo), onSuccess: tras })
}

/** Horarios para cambiar el turno: un día o un rango. null = no pedirlos todavía. */
export function useDisponibilidadMiTurno<Q extends DisponibilidadMiTurnoQuery>(slug: string, token: string, q: Q | null) {
  return useQuery({
    queryKey: K.miTurnoDisponibilidad(slug, token, q ?? { date: '' }),
    queryFn: q ? () => api.getMyBookingAvailability(slug, token, q) : skipToken,
  })
}

export function useReprogramarMiTurno(slug: string, token: string) {
  const tras = useTrasMiTurno(slug, token)
  return useMutation({ mutationFn: (dto: RescheduleDto) => api.rescheduleMyBooking(slug, token, dto), onSuccess: tras })
}

/** Aceptar el lugar que se liberó en una clase. */
export function useAceptarOfertaMiTurno(slug: string, token: string) {
  const tras = useTrasMiTurno(slug, token)
  return useMutation({ mutationFn: () => api.acceptMyOffer(slug, token), onSuccess: tras })
}

/** Genera (o reutiliza) la preferencia de Mercado Pago de la seña pendiente. */
export function usePagarMiTurno(slug: string, token: string) {
  return useMutation({ mutationFn: () => api.payMyBooking(slug, token) })
}

export function useSincronizarPagoMiTurno(slug: string, token: string) {
  const tras = useTrasMiTurno(slug, token)
  return useMutation({ mutationFn: () => api.syncMyBookingPayment(slug, token), onSuccess: tras })
}

// ─── Mis turnos, con cuenta ─────────────────────────────────────────────────

/** `activo`: solo con sesión de cliente (sin sesión la API responde 401). */
export function useMiCuentaTurnos(activo = true) {
  return useQuery({ queryKey: K.cuenta, queryFn: activo ? cuenta.getMyAccountAppointments : skipToken })
}

export function useCancelarTurnoCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo, tipo }: { id: string; motivo?: string; tipo?: 'appointment' | 'class' }) => cuenta.cancelMyAccountAppointment(id, { reason: motivo, kind: tipo }),
    onSuccess: () => invalidar(qc, K.cuenta),
  })
}

export function useDisponibilidadTurnoCuenta<Q extends DisponibilidadMiTurnoQuery>(id: string | null, q: Q | null) {
  return useQuery({
    queryKey: K.cuentaDisponibilidad(id ?? '', q ?? { date: '' }),
    queryFn: id && q ? () => cuenta.getMyAccountAvailability(id, q) : skipToken,
  })
}

export function useReprogramarTurnoCuenta() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: RescheduleDto }) => cuenta.rescheduleMyAccountAppointment(id, dto), onSuccess: () => invalidar(qc, K.cuenta) })
}
