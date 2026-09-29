// ─── Interceptor de fetch de la demo pública ────────────────────────────────
//
// Un solo punto por donde pasan TODAS las llamadas a la API mientras se
// recorre la demo (ver lib/demo/modo.ts), en vez de tocar cada pantalla:
//
//   - Lecturas: van a la API real (datos sembrados de la demo) y la
//     respuesta se ajusta con lo que el visitante cambió (lib/demo/almacen).
//   - Escrituras con manejador: se resuelven en el navegador y responden con
//     la misma forma que respondería la API.
//   - Escrituras SIN manejador: siguen a la API, que las rechaza con
//     DEMO_SOLO_LECTURA (DemoGuard) y el mensaje "Estás en la demo…" — la
//     pantalla lo muestra como cualquier error. Nunca se inventa un éxito
//     que la pantalla no espera.
//
// Los manejadores de cada recurso viven en lib/demo/recursos/ y se registran
// con `registrar()`.

import { esTiendaDemo, esVisitanteDemo } from './modo'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export type Pedido = {
  metodo: string
  /** Ruta relativa a la API, sin query: `/products/123` */
  ruta: string
  query: URLSearchParams
  /** Body ya parseado si era JSON; FormData tal cual; null si no había. */
  body: unknown
  /** La llamada original a la API, para las lecturas que ajustan lo real. */
  real: () => Promise<Response>
  /** Headers de la llamada original (token del visitante incluido), para pedir otros datos reales. */
  headers: HeadersInit | undefined
}

type Manejador = {
  metodo: string
  ruta: RegExp
  /** Quién lo usa: el panel (visitante anónimo) o la tienda (cualquiera en la demo). */
  lado: 'panel' | 'tienda'
  responder: (p: Pedido, m: RegExpMatchArray) => Promise<Response | unknown>
}

const manejadores: Manejador[] = []

export function registrar(m: Manejador): void {
  manejadores.push(m)
}

/** Respuesta JSON como la de la API. */
export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Lee el JSON de una respuesta real; null si no era JSON o falló. */
export async function leerJson<T>(res: Response): Promise<T | null> {
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null
  return (await res.json().catch(() => null)) as T | null
}

function parsearBody(body: BodyInit | null | undefined): unknown {
  if (body == null) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  return body
}

let fetchOriginal: typeof fetch | null = null

/** Llamada directa a la API, sin pasar por los manejadores (para armar respuestas con datos reales). */
export function apiReal(ruta: string, init?: RequestInit): Promise<Response> {
  return (fetchOriginal ?? fetch)(API_BASE + ruta, init)
}

export function instalarInterceptorDemo(): void {
  if (fetchOriginal || typeof window === 'undefined') return
  const original = window.fetch.bind(window)
  fetchOriginal = original

  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
    if (!esTiendaDemo() || !url.startsWith(API_BASE)) return original(entrada, init)

    const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase()
    const u = new URL(url)
    const ruta = u.pathname.slice(new URL(API_BASE).pathname.length) || '/'
    // Los de la tienda valen para cualquiera en la demo (también el visitante
    // del panel que abre "Ver tienda"); los del panel, solo con la sesión
    // anónima: el dueño que cura la demo escribe de verdad.
    const visitante = esVisitanteDemo()

    for (const m of manejadores) {
      if (m.metodo !== metodo || (m.lado === 'panel' && !visitante)) continue
      const match = ruta.match(m.ruta)
      if (!match) continue
      const resultado = await m.responder(
        { metodo, ruta, query: u.searchParams, body: parsearBody(init?.body), real: () => original(entrada, init), headers: init?.headers },
        match,
      )
      return resultado instanceof Response ? resultado : json(resultado)
    }
    return original(entrada, init)
  }
}
