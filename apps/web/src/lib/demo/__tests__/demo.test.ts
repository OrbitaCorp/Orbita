// Demo pública: la capa de localStorage y el interceptor de fetch (ver
// lib/demo/modo.ts). Entorno node: se arma un window/localStorage mínimo.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const API = 'http://localhost:3000/api/v1'

function entorno(host: string) {
  const datos = new Map<string, string>()
  const localStorage = {
    get length() { return datos.size },
    key: (i: number) => [...datos.keys()][i] ?? null,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  }
  const eventos = new EventTarget()
  const llamadas: string[] = []
  const fetchReal = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    llamadas.push(`${init?.method ?? 'GET'} ${String(entrada)}`)
    if (String(entrada).endsWith('/products')) {
      return new Response(JSON.stringify([{ id: 'p1', name: 'Auriculares' }, { id: 'p2', name: 'Mouse' }]), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'DEMO_SOLO_LECTURA' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('window', {
    location: { host, pathname: '/' },
    fetch: fetchReal,
    addEventListener: eventos.addEventListener.bind(eventos),
    removeEventListener: eventos.removeEventListener.bind(eventos),
    dispatchEvent: eventos.dispatchEvent.bind(eventos),
  })
  vi.stubGlobal('CustomEvent', class extends Event { detail: unknown; constructor(t: string, o?: { detail?: unknown }) { super(t); this.detail = o?.detail } })
  return { llamadas, fetchReal }
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'orbita.site')
  vi.stubEnv('NEXT_PUBLIC_API_URL', API)
})

describe('almacén de la demo', () => {
  it('aplica creados, parches y borrados sobre la lista real sin tocarla', async () => {
    entorno('demo.orbita.site')
    const a = await import('../almacen')
    const reales = [{ id: 'p1', name: 'Auriculares' }, { id: 'p2', name: 'Mouse' }]
    a.crear('products', { id: 'demo-1', name: 'Teclado' })
    a.editar('products', 'p1', { name: 'Auriculares Pro' })
    a.borrar('products', 'p2')
    expect(a.aplicarALista('products', reales).map((p) => p.name)).toEqual(['Teclado', 'Auriculares Pro'])
    expect(reales[0].name).toBe('Auriculares')
    expect(a.aplicarARegistro('products', 'p2', reales[1])).toBeNull()
  })

  it('editar un creado lo reemplaza; borrarlo no deja parches colgados', async () => {
    entorno('demo.orbita.site')
    const a = await import('../almacen')
    a.crear('products', { id: 'demo-1', name: 'Teclado' })
    a.editar('products', 'demo-1', { name: 'Teclado mecánico' })
    expect(a.leerCapa('products').creados).toEqual([{ id: 'demo-1', name: 'Teclado mecánico' }])
    a.borrar('products', 'demo-1')
    expect(a.aplicarALista('products', [])).toEqual([])
  })

  it('reiniciar deja la demo como vino', async () => {
    entorno('demo.orbita.site')
    const a = await import('../almacen')
    a.crear('coupons', { id: 'demo-1' })
    expect(a.hayCambiosLocales()).toBe(true)
    a.reiniciarDemo()
    expect(a.hayCambiosLocales()).toBe(false)
  })
})

describe('interceptor de la demo', () => {
  it('fuera de la demo no se mete con nada', async () => {
    const { fetchReal } = entorno('tienda1.orbita.site')
    const { instalarInterceptorDemo, registrar } = await import('../interceptor')
    const responder = vi.fn()
    registrar({ metodo: 'POST', ruta: /^\/storefront\/[^/]+\/visit$/, lado: 'tienda', responder })
    instalarInterceptorDemo()
    await window.fetch(`${API}/storefront/tienda1/visit`, { method: 'POST' })
    expect(responder).not.toHaveBeenCalled()
    expect(fetchReal).toHaveBeenCalledOnce()
  })

  it('resuelve en el navegador la escritura con manejador, sin llegar a la API', async () => {
    const { fetchReal } = entorno('demo.orbita.site')
    const { instalarInterceptorDemo, registrar } = await import('../interceptor')
    registrar({ metodo: 'POST', ruta: /^\/storefront\/[^/]+\/visit$/, lado: 'tienda', responder: async () => ({ ok: true }) })
    instalarInterceptorDemo()
    const res = await window.fetch(`${API}/storefront/demo/visit`, { method: 'POST', body: '{}' })
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchReal).not.toHaveBeenCalled()
  })

  it('las rutas del panel solo se interceptan con la sesión anónima de la demo', async () => {
    const { fetchReal } = entorno('demo.orbita.site')
    const { instalarInterceptorDemo, registrar, json } = await import('../interceptor')
    const { marcarVisitanteDemo } = await import('../modo')
    const a = await import('../almacen')
    registrar({
      metodo: 'GET', ruta: /^\/products$/, lado: 'panel',
      responder: async (p) => json(a.aplicarALista('products', (await (await p.real()).json()) as { id: string }[])),
    })
    instalarInterceptorDemo()
    a.borrar('products', 'p2')

    // El dueño real curando la demo: ve lo que hay en la base, sin capa.
    const delDueno = await (await window.fetch(`${API}/products`)).json()
    expect(delDueno).toHaveLength(2)

    marcarVisitanteDemo(true)
    const delVisitante = await (await window.fetch(`${API}/products`)).json()
    expect(delVisitante.map((p: { id: string }) => p.id)).toEqual(['p1'])
    expect(fetchReal).toHaveBeenCalledTimes(2)
  })

  it('una escritura sin manejador sigue a la API (que la rechaza), no inventa un éxito', async () => {
    entorno('demo.orbita.site')
    const { instalarInterceptorDemo } = await import('../interceptor')
    const { marcarVisitanteDemo } = await import('../modo')
    instalarInterceptorDemo()
    marcarVisitanteDemo(true)
    const res = await window.fetch(`${API}/support`, { method: 'POST', body: '{}' })
    expect(res.status).toBe(403)
  })
})
