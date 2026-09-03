// Rastreo del embudo del wizard de onboarding.
//
// Todo el onboarding pasa antes de que exista una cuenta, así que hasta ahora
// de la gente que abandonaba no quedaba ningún rastro: no sabíamos en qué paso
// se caía ni qué dato le costaba. Esto lo registra.
//
// Tres reglas que valen para todo el archivo:
//
//  1. NUNCA rompe el wizard. Cada llamada está envuelta en try/catch y todos
//     los errores se comen en silencio. Que la analítica falle no puede
//     costarnos un alta.
//  2. NUNCA manda lo que la persona tipeó. Solo qué campo tocó, cuánto tardó y
//     si dio error. El backend además poda `meta` por las dudas.
//  3. Manda de a lotes. Un fetch por tecla sería absurdo: los eventos se
//     encolan y se descargan cada 5s, al cambiar de paso, y al cerrar la
//     pestaña con sendBeacon (que sobrevive a la navegación).

import type { WizardEventType } from './wizardEvents'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
const ENDPOINT = `${API}/wizard-analytics/events`

const CLAVE_ANON = 'orbita_anon_id'
const CLAVE_SESION = 'orbita_wizard_session'
const INTERVALO_MS = 5000
const TOPE_COLA = 100

interface EventoEnCola {
  type: WizardEventType
  step?: number
  stepName?: string
  field?: string
  rubro?: string
  durationMs?: number
  meta?: Record<string, string | number | boolean>
}

let cola: EventoEnCola[] = []
let timer: ReturnType<typeof setInterval> | null = null
let engancheListo = false

// Estado para poder medir duraciones sin que cada pantalla lleve la cuenta.
let pasoActual: { step: number; stepName: string } | null = null
let pasoActualDesde = 0
let campoEnfocado: { field: string; desde: number } | null = null
const vecesQueSeEdito = new Map<string, number>()

// ─── Identidad anónima ────────────────────────────────────────────────────────

function idAleatorio(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function idGuardado(almacen: Storage, clave: string): string {
  const existente = almacen.getItem(clave)
  if (existente) return existente
  const nuevo = idAleatorio()
  almacen.setItem(clave, nuevo)
  return nuevo
}

/**
 * `anonId` identifica al NAVEGADOR (sobrevive recargas y visitas de otro día);
 * `sessionId`, a esta visita puntual. Ninguno de los dos dice quién es la
 * persona: son dos números al azar, sin nombre, mail ni nada atrás.
 */
export function wizardIds(): { sessionId: string; anonId: string } | null {
  if (typeof window === 'undefined') return null
  try {
    return {
      anonId: idGuardado(window.localStorage, CLAVE_ANON),
      sessionId: idGuardado(window.sessionStorage, CLAVE_SESION),
    }
  } catch {
    // Modo incógnito con almacenamiento bloqueado: sin ids no hay rastreo.
    return null
  }
}

// Respeta Do Not Track. Es una línea de código y es lo correcto: si alguien
// pidió explícitamente que no lo sigan, no lo seguimos.
function rastreoHabilitado(): boolean {
  if (typeof window === 'undefined') return false
  return window.navigator.doNotTrack !== '1'
}

function dispositivo(): 'mobile' | 'desktop' {
  return window.innerWidth < 640 ? 'mobile' : 'desktop'
}

// ─── Cola y envío ─────────────────────────────────────────────────────────────

export function track(type: WizardEventType, evento: Omit<EventoEnCola, 'type'> = {}): void {
  try {
    if (!rastreoHabilitado()) return

    cola.push({ type, ...evento })
    if (cola.length >= TOPE_COLA) {
      void flush()
      return
    }
    engancharUnaVez()
  } catch {
    // Silencio deliberado: ver regla 1 arriba.
  }
}

/** Descarga la cola. `conBeacon` para cuando la pestaña se está yendo. */
export function flush(conBeacon = false): void {
  try {
    if (cola.length === 0) return
    const ids = wizardIds()
    if (!ids) return

    const cuerpo = JSON.stringify({ ...ids, device: dispositivo(), events: cola })
    cola = []

    if (conBeacon && typeof navigator.sendBeacon === 'function') {
      // sendBeacon es lo único que sobrevive a que la pestaña se cierre: el
      // navegador se hace cargo del envío después de que la página murió.
      navigator.sendBeacon(ENDPOINT, new Blob([cuerpo], { type: 'application/json' }))
      return
    }

    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // idem
  }
}

function engancharUnaVez(): void {
  if (engancheListo || typeof window === 'undefined') return
  engancheListo = true

  timer = setInterval(() => flush(), INTERVALO_MS)

  // `pagehide` y no `beforeunload`: es el único que dispara confiable en
  // Safari de iPhone, que es de donde viene buena parte del tráfico.
  window.addEventListener('pagehide', () => flush(true))
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true)
  })
}

/** Para tests y para desmontar el wizard sin dejar el interval colgado. */
export function detenerTracker(): void {
  if (timer) clearInterval(timer)
  timer = null
  engancheListo = false
}

// ─── Atajos con la lógica de medición adentro ─────────────────────────────────

/**
 * Entrada a un paso. Cierra el anterior con su duración, así ninguna pantalla
 * tiene que llevar cronómetros a mano.
 *
 * Es IDEMPOTENTE por paso a propósito: los efectos de React que llaman acá
 * dependen de props que cambian de identidad tras la hidratación (el rubro, el
 * catálogo de opciones), así que se re-ejecutan varias veces para el mismo
 * paso. Sin este guard, cada re-ejecución generaba un step_next de más con una
 * duración de milisegundos que no era el tiempo de nadie.
 */
export function trackPaso(step: number, stepName: string, rubro?: string): void {
  if (pasoActual?.step === step) return

  const ahora = Date.now()
  if (pasoActual) {
    // El step_next se etiqueta con el paso que se ESTÁ DEJANDO, no con el que
    // se entra: la duración es de ese paso, y tenerlos con etiquetas distintas
    // hacía que el dato se leyera al revés.
    track('step_next', {
      step: pasoActual.step,
      stepName: pasoActual.stepName,
      rubro,
      durationMs: ahora - pasoActualDesde,
    })
  }
  pasoActual = { step, stepName }
  pasoActualDesde = ahora
  track('step_view', { step, stepName, rubro })
  flush() // el cambio de paso es el momento natural para descargar
}

export function trackVolverAtras(step: number, stepName: string): void {
  track('step_back', { step, stepName })
}

export function trackFoco(field: string, stepName?: string): void {
  campoEnfocado = { field, desde: Date.now() }
  track('field_focus', { field, stepName })
}

/**
 * Salida de un campo. `durationMs` es cuánto lo tuvo enfocado y `meta.vacio`
 * si se fue sin completarlo — las dos señales que arman el índice de fricción.
 */
export function trackDesenfoque(field: string, stepName: string | undefined, vacio: boolean): void {
  const desde = campoEnfocado?.field === field ? campoEnfocado.desde : null
  campoEnfocado = null

  const veces = (vecesQueSeEdito.get(field) ?? 0) + 1
  vecesQueSeEdito.set(field, veces)

  track('field_blur', {
    field,
    stepName,
    durationMs: desde ? Date.now() - desde : undefined,
    meta: { vacio, edicion: veces },
  })
}

/** Una validación le dijo que no. `motivo` es una etiqueta corta, nunca el valor. */
export function trackErrorDeCampo(field: string, stepName: string | undefined, motivo: string): void {
  track('field_error', { field, stepName, meta: { motivo } })
}

/**
 * Pulgar arriba/abajo sobre una respuesta de Orbi. Va por su propio endpoint
 * (no por la cola) porque es una acción deliberada del usuario: si la manda y
 * cierra la pestaña, el voto no se puede perder esperando el próximo lote.
 */
export function votarRespuestaOrbi(turnId: string, rating: 1 | -1): void {
  try {
    void fetch(`${API}/wizard-analytics/ai-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnId, rating }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ídem: nunca rompe la conversación.
  }
}

/** Chequeos de disponibilidad (subdominio, email): cuántas veces prueba hasta pegarle. */
export function trackDisponibilidad(
  field: string,
  stepName: string,
  estado: 'disponible' | 'ocupado',
): void {
  track('availability_check', { field, stepName, meta: { estado } })
}
