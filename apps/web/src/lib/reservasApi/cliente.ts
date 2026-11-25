// El cliente de la API de reservas (apps/api/src/reservas), para los tres
// módulos. Dos mitades:
//
// - `panel`: las rutas del panel (/reservas/...), con la sesión del panel
//   (authedFetch: token, X-Business-Slug y renovación), igual que lib/api.ts.
// - `sitio(slug)`: las rutas públicas del sitio del negocio
//   (/storefront/:slug/reservas/...), sin sesión. Lo único que identifica una
//   reserva es el token del enlace personal.
//
// Los errores salen como ReservasApiError con el `message` de la API, que ya
// viene en castellano y listo para mostrar: "Ese horario se acaba de ocupar.
// Elegí otro." es un 409; "Hay que reservar con al menos 1 hora de
// anticipación." es un 400. Ver apps/api/src/reservas/README.md.
import { authedFetch } from '@/lib/auth/authClient'
import { mensajeDeError } from '@/lib/api'
import type {
  AnotarseEnEspera, Bloqueo, CalendarioExterno, CambioDeEstado, Cancelar, ConectarCalendario, Config, ConfigPublica, Confirmar, CrearBloqueo, CrearDesdePanel,
  DisponibilidadDia, DisponibilidadRango, Espera, FiltroAgenda, GuardarConfig, GuardarRecurso, GuardarServicio, Historial, MiEspera,
  MiReserva, Modulo, Noches, Pago, Paginado, Recurso, Reprogramar, Reserva, ReservaConToken, Reservar, Resumen, Retener, SenaAlCancelar,
  Servicio,
} from './tipos'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export class ReservasApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
  /** El lugar se ocupó o la reserva cambió: hay que volver a mirar. */
  get esConflicto() { return this.status === 409 }
}

/**
 * Un uuid por intento de reserva: se manda como `clave` y, si hay que
 * reintentar, se repite el mismo. `crypto.randomUUID` solo existe en un
 * contexto seguro (https o localhost): en un subdominio por http, como
 * <slug>.orbita.local en desarrollo, se arma el v4 con getRandomValues.
 */
export function claveDeIntento(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Arma el query string sin los valores vacíos; las listas van separadas por coma. */
export function query(params: object): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue
    q.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

async function leer<T>(res: Response): Promise<T> {
  const esJson = res.headers.get('content-type')?.includes('application/json')
  const body = esJson ? await res.json().catch(() => null) : null
  if (!res.ok) throw new ReservasApiError(res.status, mensajeDeError(res.status, body))
  return body as T
}

/** Lo que devuelve cancelar: la reserva, con `sena` diciendo qué pasó con la seña (pisa el monto). */
export type Cancelada = Omit<Reserva, 'sena'> & { sena: SenaAlCancelar }

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

async function delPanel<T>(path: string, init: RequestInit = {}): Promise<T> {
  return leer<T>(await authedFetch(`${API_BASE}/reservas${path}`, init))
}

async function delSitio<T>(slug: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) }
  return leer<T>(await fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}/reservas${path}`, { ...init, headers }))
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export const panel = {
  config: (modulo: Modulo) => delPanel<Config | null>(`/config${query({ modulo })}`),
  guardarConfig: (datos: GuardarConfig) => delPanel<Config>('/config', { method: 'PUT', body: JSON.stringify(datos) }),

  recursos: (modulo: Modulo, inactivos = false) => delPanel<Recurso[]>(`/recursos${query({ modulo, inactivos: inactivos || undefined })}`),
  crearRecurso: (datos: GuardarRecurso) => delPanel<Recurso>('/recursos', json(datos)),
  editarRecurso: (id: string, datos: GuardarRecurso) => delPanel<Recurso>(`/recursos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  borrarRecurso: (id: string) => delPanel<{ ok: true }>(`/recursos/${id}`, { method: 'DELETE' }),

  servicios: (modulo: Modulo, inactivos = false) => delPanel<Servicio[]>(`/servicios${query({ modulo, inactivos: inactivos || undefined })}`),
  crearServicio: (datos: GuardarServicio) => delPanel<Servicio>('/servicios', json(datos)),
  editarServicio: (id: string, datos: GuardarServicio) => delPanel<Servicio>(`/servicios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  borrarServicio: (id: string) => delPanel<{ ok: true }>(`/servicios/${id}`, { method: 'DELETE' }),

  bloqueos: (modulo: Modulo, desde?: string, hasta?: string) => delPanel<Bloqueo[]>(`/bloqueos${query({ modulo, desde, hasta })}`),
  /** Devuelve cuántas reservas activas quedaron adentro: no las cancela, el panel avisa. */
  crearBloqueo: (datos: CrearBloqueo) => delPanel<{ id: string; inicio: string; fin: string; afectadas: number }>('/bloqueos', json(datos)),
  borrarBloqueo: (id: string) => delPanel<{ ok: true }>(`/bloqueos/${id}`, { method: 'DELETE' }),

  calendarios: (modulo: Modulo) => delPanel<CalendarioExterno[]>(`/calendarios${query({ modulo })}`),
  /** Lo conecta y lo baja en el momento: la respuesta ya trae si el enlace sirvió (`ultimoError`). */
  conectarCalendario: (datos: ConectarCalendario) => delPanel<CalendarioExterno>('/calendarios', json(datos)),
  /** Se lleva sus bloqueos: devuelve cuántos eran. */
  desconectarCalendario: (id: string) => delPanel<{ ok: true; bloqueos: number }>(`/calendarios/${id}`, { method: 'DELETE' }),
  sincronizarCalendario: (id: string) => delPanel<CalendarioExterno>(`/calendarios/${id}/sincronizar`, json({})),

  disponibilidad: (p: { modulo: Modulo; recursoId: string; fecha: string; servicioId?: string; duracionMinutos?: number; salvo?: string }) =>
    delPanel<DisponibilidadDia>(`/disponibilidad${query(p)}`),
  disponibilidadRango: (p: { modulo: Modulo; recursoId: string; desde: string; hasta: string; servicioId?: string; duracionMinutos?: number }) =>
    delPanel<DisponibilidadRango>(`/disponibilidad/rango${query(p)}`),
  noches: (p: { modulo: Modulo; recursoId: string; desde: string; hasta: string }) => delPanel<Noches>(`/disponibilidad/noches${query(p)}`),

  agenda: (f: FiltroAgenda = {}) => delPanel<Paginado<Reserva>>(query(f)),
  detalle: (id: string) => delPanel<Reserva & { historial: Historial[] }>(`/${id}`),
  resumen: (modulo: Modulo, desde: string, hasta: string) => delPanel<Resumen>(`/resumen${query({ modulo, desde, hasta })}`),
  crear: (datos: CrearDesdePanel) => delPanel<Reserva>('', json(datos)),
  confirmar: (id: string, datos: CambioDeEstado = {}) => delPanel<Reserva>(`/${id}/confirmar`, json(datos)),
  completar: (id: string, datos: CambioDeEstado = {}) => delPanel<Reserva>(`/${id}/completar`, json(datos)),
  ausente: (id: string, datos: CambioDeEstado = {}) => delPanel<Reserva>(`/${id}/ausente`, json(datos)),
  cancelar: (id: string, datos: Cancelar = {}) => delPanel<Cancelada & { promovida: Reserva | null }>(`/${id}/cancelar`, json(datos)),
  reprogramar: (id: string, datos: Reprogramar) => delPanel<Reserva>(`/${id}/reprogramar`, json(datos)),
  pago: (id: string, datos: Pago) => delPanel<Reserva>(`/${id}/pago`, json(datos)),
  nota: (id: string, notaInterna: string | null) => delPanel<Reserva>(`/${id}/nota`, { method: 'PATCH', body: JSON.stringify({ notaInterna }) }),

  espera: (modulo: Modulo, recursoId?: string, fecha?: string) => delPanel<Espera[]>(`/espera${query({ modulo, recursoId, fecha })}`),
  quitarDeEspera: (id: string) => delPanel<{ ok: true }>(`/espera/${id}`, { method: 'DELETE' }),
}

/**
 * La dirección pública del .ics de un recurso, para pegar en Airbnb ("Importar
 * calendario"). Trae solo noches ocupadas, sin datos de nadie.
 */
export const urlDelCalendario = (slug: string, recursoId: string): string =>
  `${API_BASE}/storefront/${encodeURIComponent(slug)}/reservas/ical/${encodeURIComponent(recursoId)}.ics`

// ─── Sitio público ───────────────────────────────────────────────────────────

export const sitio = (slug: string) => ({
  config: (modulo: Modulo) => delSitio<ConfigPublica>(slug, `/config${query({ modulo })}`),
  recursos: (modulo: Modulo) => delSitio<Recurso[]>(slug, `/recursos${query({ modulo })}`),
  servicios: (modulo: Modulo) => delSitio<Servicio[]>(slug, `/servicios${query({ modulo })}`),
  disponibilidad: (p: { modulo: Modulo; recursoId: string; fecha: string; servicioId?: string; duracionMinutos?: number }) =>
    delSitio<DisponibilidadDia>(slug, `/disponibilidad${query(p)}`),
  disponibilidadRango: (p: { modulo: Modulo; recursoId: string; desde: string; hasta: string; servicioId?: string; duracionMinutos?: number }) =>
    delSitio<DisponibilidadRango>(slug, `/disponibilidad/rango${query(p)}`),
  noches: (p: { modulo: Modulo; recursoId: string; desde: string; hasta: string }) => delSitio<Noches>(slug, `/disponibilidad/noches${query(p)}`),

  /** Paso 1: tomar el lugar. Guardá el `token` de la respuesta: es lo único que identifica la reserva. */
  retener: (datos: Retener) => delSitio<ReservaConToken>(slug, '/retener', json(datos)),
  /** Paso 2. */
  confirmar: (token: string, datos: Confirmar) => delSitio<ReservaConToken>(slug, `/mi/${token}/confirmar`, json(datos)),
  /** En un paso. */
  reservar: (datos: Reservar) => delSitio<ReservaConToken>(slug, '/reservar', json(datos)),

  miReserva: (token: string) => delSitio<MiReserva>(slug, `/mi/${token}`),
  cancelar: (token: string, datos: Cancelar = {}) => delSitio<Cancelada>(slug, `/mi/${token}/cancelar`, json(datos)),
  reprogramar: (token: string, datos: Reprogramar) => delSitio<Reserva>(slug, `/mi/${token}/reprogramar`, json(datos)),

  anotarseEnEspera: (datos: AnotarseEnEspera) => delSitio<MiEspera & { token: string }>(slug, '/espera', json(datos)),
  miEspera: (token: string) => delSitio<MiEspera>(slug, `/espera/${token}`),
  salirDeEspera: (token: string) => delSitio<{ ok: true }>(slug, `/espera/${token}`, { method: 'DELETE' }),
})

export type ClientePanel = typeof panel
export type ClienteSitio = ReturnType<typeof sitio>
