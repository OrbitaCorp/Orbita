// P2 — Sitio público de un negocio de turnos, y las partes públicas de P3
// (clases) y P4 (packs, membresías, gift cards, lista de espera).
// Rutas: /api/v1/storefront/:slug/appointments/... Sin sesión, salvo reservar
// y anotarse a una clase (@OptionalAuth: si hay cliente logueado, va su token).
//
// "Mi turno" entra por el `accessToken` de la reserva (el enlace personal): va
// en la URL porque ES el enlace que recibe la persona. No se loguea.
import { conCuerpo, publico, qs, seg } from './http'
import type {
  BuyGiftCardDto, BuyPackageDto, ClaseDelDiaDto, CompraOnlineDto, CreateBookingDto, DisponibilidadDiaDto, DisponibilidadMiTurnoQuery,
  DisponibilidadQuery, DisponibilidadRangoDto, DisponibilidadRangoQuery, Fecha, GiftCardPublicaDto, JoinWaitlistDto, MiTurnoDto,
  PagoPendienteDto, PaquetePublicoDto, PlanMembresiaPublicoDto, PublicEnrollDto, RecursoPublicoDto, ReservaCreadaConSesionDto,
  ReservaCreadaDto, RescheduleDto, ServicioPublicoDto, SitioTurnosDto,
} from './tipos'

// ─── P2.1 Sitio ─────────────────────────────────────────────────────────────

/** Responde también con el sitio pausado o sin publicar (trae isActive / isPaused). */
export const getSite = (slug: string) => publico<SitioTurnosDto>(slug, '/site')
export const listPublicServices = (slug: string) => publico<ServicioPublicoDto[]>(slug, '/services')
/** [] si el negocio no deja elegir con quién. */
export const listPublicResources = (slug: string, serviceId?: string) => publico<RecursoPublicoDto[]>(slug, `/resources${qs({ serviceId })}`)
export const getPublicAvailability = (slug: string, q: Omit<DisponibilidadQuery, 'except'>) =>
  publico<DisponibilidadDiaDto>(slug, `/availability${qs({ serviceId: q.serviceId, date: q.date, resourceId: q.resourceId })}`)
/** Hasta 62 días. */
export const getPublicAvailabilityRange = (slug: string, q: Omit<DisponibilidadRangoQuery, 'except'>) =>
  publico<DisponibilidadRangoDto>(slug, `/availability/range${qs({ serviceId: q.serviceId, from: q.from, to: q.to, resourceId: q.resourceId })}`)

// ─── P2.2 Reservar ──────────────────────────────────────────────────────────

/** Devuelve el `accessToken` UNA sola vez: guardarlo en el dispositivo (misReservas.ts). */
export const createBooking = (slug: string, dto: CreateBookingDto) =>
  publico<ReservaCreadaConSesionDto>(slug, '/bookings', conCuerpo('POST', dto), true)

// ─── P2.3 Mi turno, por enlace personal ─────────────────────────────────────

const mine = (token: string) => `/mine/${seg(token)}`

export const getMyBooking = (slug: string, token: string) => publico<MiTurnoDto>(slug, mine(token))
/** Las reservas de este dispositivo: vuelven SOLO las que existen (las demás no vienen), ordenadas por inicio. 1–20 tokens. */
export const listMyBookings = (slug: string, tokens: string[]) =>
  publico<{ token: string; booking: MiTurnoDto }[]>(slug, '/mine', conCuerpo('POST', { tokens }))
export const cancelMyBooking = (slug: string, token: string, reason?: string) =>
  publico<MiTurnoDto>(slug, `${mine(token)}/cancel`, conCuerpo('POST', { reason }))
export const getMyBookingAvailability = <Q extends DisponibilidadMiTurnoQuery>(slug: string, token: string, q: Q) =>
  publico<Q extends { date: Fecha } ? DisponibilidadDiaDto : DisponibilidadRangoDto>(slug, `${mine(token)}/availability${qs({ ...q })}`)
export const rescheduleMyBooking = (slug: string, token: string, dto: RescheduleDto) =>
  publico<MiTurnoDto>(slug, `${mine(token)}/reschedule`, conCuerpo('POST', dto))
/** Aceptar el lugar ofrecido en una clase (inscripción en lista de espera con oferta vigente). */
export const acceptMyOffer = (slug: string, token: string) => publico<MiTurnoDto>(slug, `${mine(token)}/accept`, conCuerpo('POST'))
export const payMyBooking = (slug: string, token: string) => publico<PagoPendienteDto>(slug, `${mine(token)}/pay`, conCuerpo('POST'))
/** Al volver de Mercado Pago: aplica el pago aunque el webhook no haya llegado. */
export const syncMyBookingPayment = (slug: string, token: string) => publico<MiTurnoDto>(slug, `${mine(token)}/sync-payment`, conCuerpo('POST'))

// ─── P3.1 Clases (público) ──────────────────────────────────────────────────

/** Hasta 14 días. */
export const listPublicClasses = (slug: string, from: Fecha, to: Fecha) => publico<ClaseDelDiaDto[]>(slug, `/classes${qs({ from, to })}`)
export const enrollInClass = (slug: string, dto: PublicEnrollDto) =>
  publico<ReservaCreadaDto>(slug, '/classes/enroll', conCuerpo('POST', dto), true)

// ─── P4 Avanzado (público; sin add-on, listas vacías o 404) ─────────────────

export const listPublicPackages = (slug: string) => publico<PaquetePublicoDto[]>(slug, '/packages')
export const buyPackage = (slug: string, packageId: string, dto: BuyPackageDto) =>
  publico<CompraOnlineDto>(slug, `/packages/${seg(packageId)}/buy`, conCuerpo('POST', dto))
export const listPublicMembershipPlans = (slug: string) => publico<PlanMembresiaPublicoDto[]>(slug, '/membership-plans')
export const buyGiftCard = (slug: string, dto: BuyGiftCardDto) => publico<CompraOnlineDto>(slug, '/gift-cards', conCuerpo('POST', dto))
export const getGiftCard = (slug: string, code: string) => publico<GiftCardPublicaDto>(slug, `/gift-cards/${seg(code)}`)
export const joinWaitlist = (slug: string, dto: JoinWaitlistDto) => publico<{ ok: true }>(slug, '/waitlist', conCuerpo('POST', dto))
/** `offer`: el token firmado del enlace del mensaje "se liberó un lugar". */
export const acceptWaitlistOffer = (slug: string, offer: string) => publico<ReservaCreadaDto>(slug, '/waitlist/accept', conCuerpo('POST', { offer }))
