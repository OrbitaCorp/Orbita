// Conexión de WhatsApp Business por Embedded Signup (la incorporación integrada de Meta).
//
// El panel abre el flujo de Meta en una ventana (FB.login con la configuración de Órbita como proveedor de
// tecnología). Cuando el cliente termina, llegan DOS cosas, en cualquier orden: el código de autorización (en el
// callback de FB.login) y, por un mensaje de la ventana de Meta, los ids de la cuenta de WhatsApp Business y del
// número que eligió. Con los dos se llama a la API de Órbita, que canjea el código por el token (vale unos segundos).
//
// Los ids de la app y de la configuración NO son secretos (van en cualquier página que use el login de Facebook):
// quedan como valores por defecto y se pueden cambiar con NEXT_PUBLIC_META_APP_ID y NEXT_PUBLIC_WHATSAPP_CONFIG_ID.

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? '1634368494718041'
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID ?? '28952638967708467'
const VERSION = 'v23.0'
// Coexistencia: el dueño conecta el número de su app WhatsApp Business y sigue usándola (lo que escribe desde el celular
// también se ve en Órbita). Es el `featureType` del flujo de Meta para esos números; se puede cambiar por entorno.
const FEATURE_TYPE = process.env.NEXT_PUBLIC_WHATSAPP_FEATURE_TYPE ?? 'whatsapp_business_app_onboarding'
const SDK_URL = 'https://connect.facebook.net/es_LA/sdk.js'
const ORIGENES_DE_META = ['https://www.facebook.com', 'https://web.facebook.com', 'https://business.facebook.com']
/** Cuánto se espera a que el cliente termine el proceso en Meta antes de rendirse. */
const ESPERA_MAXIMA_MS = 10 * 60 * 1000

interface FbLoginRespuesta { authResponse?: { code?: string } | null; status?: string }
interface FbSdk {
  init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void
  login(cb: (r: FbLoginRespuesta) => void, opts: Record<string, unknown>): void
}
declare global { interface Window { FB?: FbSdk } }

export interface ResultadoDeSignup {
  code: string
  /** En coexistencia Meta no devuelve el id del número, solo el de la cuenta: la API lo busca en la cuenta. */
  phoneNumberId?: string
  wabaId: string
  businessId?: string
}

/** Un fallo con un mensaje que se le puede mostrar a la persona tal cual. */
export class ErrorDeSignup extends Error {
  constructor(mensaje: string, readonly cancelado = false) {
    super(mensaje)
  }
}

export type MensajeDeMeta =
  | { tipo: 'terminado'; phoneNumberId?: string; wabaId: string; businessId?: string }
  | { tipo: 'sin-numero'; wabaId?: string }
  | { tipo: 'cancelado'; paso?: string }
  | { tipo: 'error'; mensaje: string }

/**
 * Lee un mensaje de la ventana de Meta. Devuelve null si no es de Meta ni del flujo de WhatsApp (la página recibe
 * mensajes de todo tipo): solo se confía en los que vienen de un origen de Facebook.
 */
export function interpretarMensajeDeMeta(origen: string, datos: unknown): MensajeDeMeta | null {
  if (!ORIGENES_DE_META.includes(origen)) return null
  let d: unknown = datos
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d)
    } catch {
      return null
    }
  }
  if (typeof d !== 'object' || d === null) return null
  const m = d as { type?: unknown; event?: unknown; data?: Record<string, unknown> }
  if (m.type !== 'WA_EMBEDDED_SIGNUP') return null
  const info = m.data ?? {}
  const texto = (v: unknown): string | undefined => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined)

  if (m.event === 'FINISH') {
    const phoneNumberId = texto(info.phone_number_id)
    const wabaId = texto(info.waba_id)
    if (!phoneNumberId || !wabaId) return { tipo: 'error', mensaje: 'Meta no devolvió los datos del número. Probá de nuevo.' }
    return { tipo: 'terminado', phoneNumberId, wabaId, businessId: texto(info.business_id) }
  }
  // Coexistencia: terminó de conectar el número de su app WhatsApp Business. Meta da solo el id de la cuenta.
  if (m.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
    const wabaId = texto(info.waba_id)
    if (!wabaId) return { tipo: 'error', mensaje: 'Meta no devolvió los datos de tu cuenta. Probá de nuevo.' }
    return { tipo: 'terminado', wabaId, businessId: texto(info.business_id) }
  }
  // Terminó pero sin agregar un número: no se puede conectar nada.
  if (m.event === 'FINISH_ONLY_WABA') return { tipo: 'sin-numero', wabaId: texto(info.waba_id) }
  // Meta también usa CANCEL para avisar de un error de la persona (con su mensaje): eso se muestra como error.
  if (m.event === 'CANCEL') {
    const motivo = texto(info.error_message)
    return motivo ? { tipo: 'error', mensaje: motivo } : { tipo: 'cancelado', paso: texto(info.current_step) }
  }
  if (m.event === 'ERROR') return { tipo: 'error', mensaje: texto(info.error_message) ?? 'Meta no pudo completar la conexión. Probá de nuevo.' }
  return null
}

let cargando: Promise<FbSdk> | null = null

/** Carga el SDK de Facebook (una sola vez). Conviene llamarlo antes del clic: así FB.login sale del clic y no lo bloquea el navegador. */
export function precargarSdk(): Promise<FbSdk> {
  if (typeof window === 'undefined') return Promise.reject(new ErrorDeSignup('Solo se puede conectar desde el navegador.'))
  if (window.FB) return Promise.resolve(window.FB)
  cargando ??= new Promise<FbSdk>((resolve, reject) => {
    const falla = () => {
      cargando = null
      reject(new ErrorDeSignup('No se pudo cargar el inicio de sesión de Meta. Si tenés un bloqueador de anuncios, desactivalo para esta página y probá de nuevo.'))
    }
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      if (!window.FB) return falla()
      window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: VERSION })
      resolve(window.FB)
    }
    script.onerror = falla
    document.head.appendChild(script)
  })
  return cargando
}

/**
 * Abre el flujo de Meta y devuelve el código y los ids cuando el cliente termina. Se tiene que llamar DIRECTO desde un
 * clic y con el SDK ya cargado (ver `precargarSdk`): FB.login abre una ventana y los navegadores bloquean las que no
 * salen de un gesto de la persona.
 */
export function iniciarEmbeddedSignup(): Promise<ResultadoDeSignup> {
  const sdk = typeof window === 'undefined' ? undefined : window.FB
  if (!sdk) return Promise.reject(new ErrorDeSignup('Todavía se está cargando el inicio de sesión de Meta. Esperá un segundo y probá de nuevo.'))

  return new Promise<ResultadoDeSignup>((resolve, reject) => {
    let code: string | null = null
    let info: Extract<MensajeDeMeta, { tipo: 'terminado' }> | null = null
    let cerrado = false

    const cerrar = () => {
      cerrado = true
      window.removeEventListener('message', alMensaje)
      clearTimeout(timer)
    }
    const terminarSiEstaTodo = () => {
      if (cerrado || !code || !info) return
      cerrar()
      resolve({ code, phoneNumberId: info.phoneNumberId, wabaId: info.wabaId, businessId: info.businessId })
    }
    const fallar = (e: ErrorDeSignup) => {
      if (cerrado) return
      cerrar()
      reject(e)
    }

    const alMensaje = (ev: MessageEvent) => {
      const m = interpretarMensajeDeMeta(ev.origin, ev.data)
      if (!m) return
      if (m.tipo === 'terminado') { info = m; terminarSiEstaTodo() }
      else if (m.tipo === 'sin-numero') fallar(new ErrorDeSignup('Terminaste el proceso sin agregar un número de teléfono. Volvé a intentarlo y agregá el número con el que atendés.'))
      else if (m.tipo === 'cancelado') fallar(new ErrorDeSignup('Cancelaste la conexión con WhatsApp.', true))
      else fallar(new ErrorDeSignup(m.mensaje))
    }
    const timer = setTimeout(() => fallar(new ErrorDeSignup('Pasó demasiado tiempo sin terminar la conexión. Volvé a intentarlo.')), ESPERA_MAXIMA_MS)
    window.addEventListener('message', alMensaje)

    sdk.login(
      (r) => {
        const c = r.authResponse?.code
        if (c) { code = c; terminarSiEstaTodo() }
        // Sin código no hay conexión: la persona cerró la ventana o no autorizó.
        else fallar(new ErrorDeSignup('No se completó la autorización de Meta.', true))
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, version: 'v4', sessionInfoVersion: '3', featureType: FEATURE_TYPE },
      },
    )
  })
}
