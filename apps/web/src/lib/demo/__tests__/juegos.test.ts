// Juegos con premio de la tienda demo (lib/demo/recursos/juegos.ts): la
// partida y el cupón se simulan en el navegador, y el carrito acepta el cupón.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const API = 'http://localhost:3000/api/v1'

const JUEGOS_ACTIVOS = [{ type: 'GOAL', name: 'Metela y ganá', campaignVersion: 1, maxPercent: 15, maxAttempts: 5 }]
const VALIDACION = {
  items: [{ variantId: 'v1', ok: true, nombre: 'Funda', variante: null, precio: 10000, precioAnt: null, maxQty: 9, imgUrl: null, promoLabel: null, promoId: null }],
  ticketDiscount: null,
  coupon: null,
}

function entorno() {
  const datos = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() { return datos.size },
    key: (i: number) => [...datos.keys()][i] ?? null,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  })
  const eventos = new EventTarget()
  const cuerpos: unknown[] = []
  const fetchReal = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada)
    const ok = (b: unknown) => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } })
    if (url.endsWith('/games/active')) return ok(JUEGOS_ACTIVOS)
    if (url.endsWith('/cart/validate')) {
      cuerpos.push(JSON.parse(String(init?.body)))
      return ok(VALIDACION)
    }
    return new Response(JSON.stringify({ error: 'DEMO_SOLO_LECTURA' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('window', {
    location: { host: 'demo.orbita.site', pathname: '/' },
    fetch: fetchReal,
    addEventListener: eventos.addEventListener.bind(eventos),
    removeEventListener: eventos.removeEventListener.bind(eventos),
    dispatchEvent: eventos.dispatchEvent.bind(eventos),
  })
  vi.stubGlobal('CustomEvent', class extends Event { detail: unknown; constructor(t: string, o?: { detail?: unknown }) { super(t); this.detail = o?.detail } })
  return { cuerpos }
}

const post = (ruta: string, body: unknown) =>
  window.fetch(`${API}${ruta}`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json())

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'orbita.site')
  vi.stubEnv('NEXT_PUBLIC_API_URL', API)
})

async function instalar() {
  const { instalarInterceptorDemo } = await import('../interceptor')
  await import('../recursos/juegos')
  instalarInterceptorDemo()
}

describe('juegos con premio en la demo', () => {
  it('ganar deja un cupón local con el % de los aciertos, topeado', async () => {
    entorno()
    await instalar()
    const sesion = await post('/storefront/demo/games/GOAL/start', {})
    expect(sesion).toMatchObject({ percentPerWin: 3, maxPercent: 15, maxAttempts: 5 })
    const fin = await post('/storefront/demo/games/finish', { sessionId: sesion.sessionId, hits: 99 })
    expect(fin).toMatchObject({ status: 'CLAIMED', discountPercent: 15 })
    expect(fin.code).toMatch(/^PREMIO-/)
  })

  it('sin aciertos no hay premio', async () => {
    entorno()
    await instalar()
    const sesion = await post('/storefront/demo/games/GOAL/start', {})
    expect(await post('/storefront/demo/games/finish', { sessionId: sesion.sessionId, hits: 0 })).toMatchObject({ status: 'LOST', code: null })
  })

  it('el carrito acepta el cupón del premio y no se lo manda a la API', async () => {
    const { cuerpos } = entorno()
    await instalar()
    const sesion = await post('/storefront/demo/games/GOAL/start', {})
    const { code } = await post('/storefront/demo/games/finish', { sessionId: sesion.sessionId, hits: 2 })
    const items = [{ variantId: 'v1', quantity: 2 }]
    const validacion = await post('/storefront/demo/cart/validate', { items, couponCode: code.toLowerCase() })
    expect(validacion.coupon).toMatchObject({ ok: true, code })
    expect(validacion.ticketDiscount).toMatchObject({ monto: 1200, esPorcentaje: true, valor: 6 })
    expect(cuerpos).toEqual([{ items }])
  })

  it('un cupón que no es premio sigue a la API tal cual', async () => {
    const { cuerpos } = entorno()
    await instalar()
    await post('/storefront/demo/cart/validate', { items: [], couponCode: 'NEBULA15' })
    expect(cuerpos).toEqual([{ items: [], couponCode: 'NEBULA15' }])
  })
})
