// P4 — Avanzado (add-on ADVANCED) y lista de espera de turnos.
// Rutas: /api/v1/appointments/... (CONTRATO.md § P4). Sesión del panel. Sin el
// add-on, las escrituras responden 403 ADDON_REQUIRED:ADVANCED.
//
// Donde el contrato no dice qué devuelve un endpoint, se asume lo más cercano
// (la entidad modificada) y está marcado con "(respuesta asumida)".
import { panelRequest } from '@/lib/api'
import { conCuerpo, qs, seg } from './http'
import type {
  AudienciaRecuperarDto, AvanzadoDto, AvanzadoTurnos, CampaniaRecuperarDto, CreateMembershipDto, CreateRecurringDto, EsperaDto,
  Fecha, FuncionAvanzada, GiftCardDto, IssueGiftCardDto, ListGiftCardsQuery, MembresiaDto, MetodoEnLocal, OfferWaitlistDto,
  PackCompradoDto, PaginaQuery, Paginado, PaqueteDto, PlanMembresiaDto, ReglaPrecioDto, SellPackageDto, TarjetaFidelidadDto,
  TurnoFijoCreadoDto, TurnoFijoDto, UpdateAdvancedDto, UpsertMembershipPlanDto, UpsertPackageDto, UpsertPriceRuleDto,
  UpsertWinbackDto, AppointmentMembershipStatus, AppointmentWaitlistStatus,
} from './tipos'

const A = '/appointments'

// ─── Hub ────────────────────────────────────────────────────────────────────

/** No pide el add-on: el hub se muestra igual, con el candado. */
export const getAdvanced = () => panelRequest<AvanzadoDto>(`${A}/advanced`)
export const updateAdvanced = <F extends FuncionAvanzada>(funcion: F, dto: UpdateAdvancedDto<F>) =>
  panelRequest<AvanzadoTurnos>(`${A}/advanced/${seg(funcion)}`, conCuerpo('PUT', dto))

// ─── P4.1 Paquetes ──────────────────────────────────────────────────────────

export const listPackages = () => panelRequest<PaqueteDto[]>(`${A}/packages`)
export const createPackage = (dto: UpsertPackageDto) => panelRequest<PaqueteDto>(`${A}/packages`, conCuerpo('POST', dto))
export const updatePackage = (id: string, dto: UpsertPackageDto) => panelRequest<PaqueteDto>(`${A}/packages/${seg(id)}`, conCuerpo('PUT', dto))
export const deletePackage = (id: string) => panelRequest<{ ok: true }>(`${A}/packages/${seg(id)}`, conCuerpo('DELETE'))
export const listPackagePurchases = (q: { customerId?: string; active?: boolean } & PaginaQuery = {}) =>
  panelRequest<Paginado<PackCompradoDto>>(`${A}/package-purchases${qs({ ...q })}`)
/** Venta en el local (respuesta asumida: el pack vendido). */
export const sellPackage = (dto: SellPackageDto) => panelRequest<PackCompradoDto>(`${A}/package-purchases`, conCuerpo('POST', dto))

// ─── P4.2 Membresías ────────────────────────────────────────────────────────

export const listMembershipPlans = () => panelRequest<PlanMembresiaDto[]>(`${A}/membership-plans`)
export const createMembershipPlan = (dto: UpsertMembershipPlanDto) => panelRequest<PlanMembresiaDto>(`${A}/membership-plans`, conCuerpo('POST', dto))
export const updateMembershipPlan = (id: string, dto: UpsertMembershipPlanDto) => panelRequest<PlanMembresiaDto>(`${A}/membership-plans/${seg(id)}`, conCuerpo('PUT', dto))
export const deleteMembershipPlan = (id: string) => panelRequest<{ ok: true }>(`${A}/membership-plans/${seg(id)}`, conCuerpo('DELETE'))
export const listMemberships = (q: { status?: AppointmentMembershipStatus } & PaginaQuery = {}) => panelRequest<Paginado<MembresiaDto>>(`${A}/memberships${qs({ ...q })}`)
/** (respuesta asumida) */
export const createMembership = (dto: CreateMembershipDto) => panelRequest<MembresiaDto>(`${A}/memberships`, conCuerpo('POST', dto))
/** (respuesta asumida) */
export const pauseMembership = (id: string, until: Fecha) => panelRequest<MembresiaDto>(`${A}/memberships/${seg(id)}/pause`, conCuerpo('POST', { until }))
/** (respuesta asumida) */
export const resumeMembership = (id: string) => panelRequest<MembresiaDto>(`${A}/memberships/${seg(id)}/resume`, conCuerpo('POST'))
/** (respuesta asumida) */
export const cancelMembership = (id: string) => panelRequest<MembresiaDto>(`${A}/memberships/${seg(id)}/cancel`, conCuerpo('POST'))
/** Registrar la cuota a mano (respuesta asumida). */
export const registerMembershipPayment = (id: string, method: MetodoEnLocal) => panelRequest<MembresiaDto>(`${A}/memberships/${seg(id)}/payments`, conCuerpo('POST', { method }))

// ─── P4.3 Gift cards ────────────────────────────────────────────────────────

export const listGiftCards = (q: ListGiftCardsQuery = {}) => panelRequest<Paginado<GiftCardDto>>(`${A}/gift-cards${qs({ ...q })}`)
/** Emitir en el local (cuerpo y respuesta asumidos). */
export const issueGiftCard = (dto: IssueGiftCardDto) => panelRequest<GiftCardDto>(`${A}/gift-cards`, conCuerpo('POST', dto))
/** (respuesta asumida) */
export const voidGiftCard = (id: string) => panelRequest<GiftCardDto>(`${A}/gift-cards/${seg(id)}/void`, conCuerpo('POST'))

// ─── P4.4 Precios por horario ───────────────────────────────────────────────

export const listPriceRules = () => panelRequest<ReglaPrecioDto[]>(`${A}/price-rules`)
export const createPriceRule = (dto: UpsertPriceRuleDto) => panelRequest<ReglaPrecioDto>(`${A}/price-rules`, conCuerpo('POST', dto))
export const updatePriceRule = (id: string, dto: UpsertPriceRuleDto) => panelRequest<ReglaPrecioDto>(`${A}/price-rules/${seg(id)}`, conCuerpo('PUT', dto))
export const deletePriceRule = (id: string) => panelRequest<{ ok: true }>(`${A}/price-rules/${seg(id)}`, conCuerpo('DELETE'))

// ─── P4.5 Fidelidad ─────────────────────────────────────────────────────────

export const listLoyalty = (q: PaginaQuery = {}) => panelRequest<Paginado<TarjetaFidelidadDto>>(`${A}/loyalty${qs({ ...q })}`)
/** Canjear un premio (respuesta asumida: la tarjeta actualizada). */
export const redeemLoyalty = (customerId: string) => panelRequest<TarjetaFidelidadDto>(`${A}/loyalty/${seg(customerId)}/redeem`, conCuerpo('POST'))

// ─── P4.6 Turno fijo ────────────────────────────────────────────────────────

export const listRecurring = () => panelRequest<TurnoFijoDto[]>(`${A}/recurring`)
export const createRecurring = (dto: CreateRecurringDto) => panelRequest<TurnoFijoCreadoDto>(`${A}/recurring`, conCuerpo('POST', dto))
/** Cancela los turnos futuros de la serie (respuesta asumida). */
export const endRecurring = (id: string) => panelRequest<TurnoFijoDto>(`${A}/recurring/${seg(id)}/end`, conCuerpo('POST'))

// ─── P4.7 Recuperar clientes ────────────────────────────────────────────────

export const getWinback = () => panelRequest<CampaniaRecuperarDto | null>(`${A}/winback`)
/** (respuesta asumida) */
export const updateWinback = (dto: UpsertWinbackDto) => panelRequest<CampaniaRecuperarDto>(`${A}/winback`, conCuerpo('PUT', dto))
export const getWinbackAudience = (inactiveDays: number) => panelRequest<AudienciaRecuperarDto>(`${A}/winback/audience${qs({ inactiveDays })}`)
/** Throttle 3 por día (respuesta asumida). */
export const sendWinback = () => panelRequest<CampaniaRecuperarDto>(`${A}/winback/send`, conCuerpo('POST'))

// ─── P4.8 Lista de espera de turnos ─────────────────────────────────────────

export const listWaitlist = (q: { date?: Fecha; status?: AppointmentWaitlistStatus } = {}) => panelRequest<EsperaDto[]>(`${A}/waitlist${qs({ ...q })}`)
/** (respuesta asumida) */
export const offerWaitlist = (id: string, dto: OfferWaitlistDto) => panelRequest<EsperaDto>(`${A}/waitlist/${seg(id)}/offer`, conCuerpo('POST', dto))
/** (respuesta asumida) */
export const deleteWaitlistEntry = (id: string) => panelRequest<{ ok: true }>(`${A}/waitlist/${seg(id)}`, conCuerpo('DELETE'))
