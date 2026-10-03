// Hooks de React Query de P4 (Avanzado) y de la lista de espera de turnos.
// Un hook por operación.
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clavesTurnos as K } from '../claves'
import * as api from '../avanzado'
import { invalidar } from './nucleo'
import type {
  AppointmentMembershipStatus, AppointmentWaitlistStatus, CreateMembershipDto, CreateRecurringDto, Fecha, FuncionAvanzada, IssueGiftCardDto,
  ListGiftCardsQuery, MetodoEnLocal, OfferWaitlistDto, PaginaQuery, SellPackageDto, UpdateAdvancedDto, UpsertMembershipPlanDto,
  UpsertPackageDto, UpsertPriceRuleDto, UpsertWinbackDto,
} from '../tipos'

// ─── Hub ────────────────────────────────────────────────────────────────────

export function useAvanzadoTurnos() {
  return useQuery({ queryKey: K.avanzado, queryFn: api.getAdvanced, staleTime: 60_000 })
}

/** Prender, apagar o configurar una función. Cambia lo que el sitio ofrece y cómo se calculan precios. */
export function useGuardarFuncionAvanzada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ funcion, dto }: { funcion: FuncionAvanzada; dto: UpdateAdvancedDto }) => api.updateAdvanced(funcion, dto),
    onSuccess: () => invalidar(qc, K.avanzado, K.settings, K.disponibilidad),
  })
}

// ─── Paquetes ───────────────────────────────────────────────────────────────

export function usePaquetes() {
  return useQuery({ queryKey: K.paquetes, queryFn: api.listPackages })
}

export function useCrearPaquete() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertPackageDto) => api.createPackage(dto), onSuccess: () => invalidar(qc, K.paquetes) })
}

export function useEditarPaquete() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpsertPackageDto }) => api.updatePackage(id, dto), onSuccess: () => invalidar(qc, K.paquetes) })
}

export function useEliminarPaquete() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deletePackage(id), onSuccess: () => invalidar(qc, K.paquetes) })
}

export function usePaquetesVendidos(q: { customerId?: string; active?: boolean } & PaginaQuery = {}) {
  return useQuery({ queryKey: K.paquetesVendidos(q), queryFn: () => api.listPackagePurchases(q) })
}

export function useVenderPaquete() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: SellPackageDto) => api.sellPackage(dto), onSuccess: () => invalidar(qc, K.paquetes, K.clientes) })
}

// ─── Membresías ─────────────────────────────────────────────────────────────

export function usePlanesMembresia() {
  return useQuery({ queryKey: K.planesMembresia, queryFn: api.listMembershipPlans })
}

export function useCrearPlanMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertMembershipPlanDto) => api.createMembershipPlan(dto), onSuccess: () => invalidar(qc, K.planesMembresia) })
}

export function useEditarPlanMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpsertMembershipPlanDto }) => api.updateMembershipPlan(id, dto), onSuccess: () => invalidar(qc, K.planesMembresia) })
}

export function useEliminarPlanMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteMembershipPlan(id), onSuccess: () => invalidar(qc, K.planesMembresia) })
}

export function useMembresias(q: { status?: AppointmentMembershipStatus } & PaginaQuery = {}) {
  return useQuery({ queryKey: K.membresiasLista(q), queryFn: () => api.listMemberships(q) })
}

/** Toda escritura sobre una membresía cambia la lista, los socios de cada plan y la ficha del cliente. */
const trasMembresia = [K.membresias, K.planesMembresia, K.clientes] as const

export function useCrearMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: CreateMembershipDto) => api.createMembership(dto), onSuccess: () => invalidar(qc, ...trasMembresia) })
}

export function usePausarMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, hasta }: { id: string; hasta: Fecha }) => api.pauseMembership(id, hasta), onSuccess: () => invalidar(qc, ...trasMembresia) })
}

export function useReanudarMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.resumeMembership(id), onSuccess: () => invalidar(qc, ...trasMembresia) })
}

export function useCancelarMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.cancelMembership(id), onSuccess: () => invalidar(qc, ...trasMembresia) })
}

export function useRegistrarCuotaMembresia() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, metodo }: { id: string; metodo: MetodoEnLocal }) => api.registerMembershipPayment(id, metodo), onSuccess: () => invalidar(qc, ...trasMembresia) })
}

// ─── Gift cards ─────────────────────────────────────────────────────────────

export function useGiftCards(q: ListGiftCardsQuery = {}) {
  return useQuery({ queryKey: K.giftCardsLista(q), queryFn: () => api.listGiftCards(q) })
}

export function useEmitirGiftCard() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: IssueGiftCardDto) => api.issueGiftCard(dto), onSuccess: () => invalidar(qc, K.giftCards) })
}

export function useAnularGiftCard() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.voidGiftCard(id), onSuccess: () => invalidar(qc, K.giftCards) })
}

// ─── Precios por horario ────────────────────────────────────────────────────

export function useReglasPrecio() {
  return useQuery({ queryKey: K.reglasPrecio, queryFn: api.listPriceRules })
}

/** Las reglas cambian el precio de cada horario libre. */
const trasReglas = [K.reglasPrecio, K.disponibilidad] as const

export function useCrearReglaPrecio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertPriceRuleDto) => api.createPriceRule(dto), onSuccess: () => invalidar(qc, ...trasReglas) })
}

export function useEditarReglaPrecio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpsertPriceRuleDto }) => api.updatePriceRule(id, dto), onSuccess: () => invalidar(qc, ...trasReglas) })
}

export function useEliminarReglaPrecio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deletePriceRule(id), onSuccess: () => invalidar(qc, ...trasReglas) })
}

// ─── Fidelidad ──────────────────────────────────────────────────────────────

export function useFidelidad(q: PaginaQuery = {}) {
  return useQuery({ queryKey: K.fidelidadLista(q), queryFn: () => api.listLoyalty(q) })
}

export function useCanjearPremio() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (customerId: string) => api.redeemLoyalty(customerId), onSuccess: (_r, customerId) => invalidar(qc, K.fidelidad, K.cliente(customerId)) })
}

// ─── Turno fijo ─────────────────────────────────────────────────────────────

export function useTurnosFijos() {
  return useQuery({ queryKey: K.turnosFijos, queryFn: api.listRecurring })
}

/** Crea la serie y sus turnos: cambian la agenda, los horarios libres y los turnos. */
const trasTurnoFijo = [K.turnosFijos, K.turnos, K.agenda, K.resumenes, K.disponibilidad] as const

export function useCrearTurnoFijo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: CreateRecurringDto) => api.createRecurring(dto), onSuccess: () => invalidar(qc, ...trasTurnoFijo) })
}

export function useTerminarTurnoFijo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.endRecurring(id), onSuccess: () => invalidar(qc, ...trasTurnoFijo) })
}

// ─── Recuperar clientes ─────────────────────────────────────────────────────

export function useCampaniaRecuperar() {
  return useQuery({ queryKey: K.recuperar, queryFn: api.getWinback })
}

export function useGuardarCampaniaRecuperar() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: UpsertWinbackDto) => api.updateWinback(dto), onSuccess: () => invalidar(qc, K.recuperar) })
}

/** null = no calcularla todavía. */
export function useAudienciaRecuperar(diasSinVenir: number | null) {
  return useQuery({ queryKey: K.audienciaRecuperar(diasSinVenir ?? 0), queryFn: diasSinVenir ? () => api.getWinbackAudience(diasSinVenir) : skipToken })
}

export function useEnviarCampaniaRecuperar() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => api.sendWinback(), onSuccess: () => invalidar(qc, K.recuperar) })
}

// ─── Lista de espera ────────────────────────────────────────────────────────

export function useListaEspera(q: { date?: Fecha; status?: AppointmentWaitlistStatus } = {}) {
  return useQuery({ queryKey: K.esperaLista(q), queryFn: () => api.listWaitlist(q) })
}

export function useOfrecerLugar() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: OfferWaitlistDto }) => api.offerWaitlist(id, dto), onSuccess: () => invalidar(qc, K.espera) })
}

export function useSacarDeEspera() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api.deleteWaitlistEntry(id), onSuccess: () => invalidar(qc, K.espera) })
}
