// Mensajes de la demo (lib/demo/recursos/mensajes.ts): el chat de la tienda y
// la bandeja del panel son el mismo hilo, guardado en el navegador.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const API = 'http://localhost:3000/api/v1'

const SEMBRADA = {
  id: 'cv-1', customerId: 'cli-1', customerName: 'María Gómez', customerEmail: 'maria@mail.test', customerAvatar: null,
  isUnread: true, isArchived: false, updatedAt: '2026-09-29T10:00:00.000Z',
  lastMessage: { id: 'm-1', sender: 'CUSTOMER', text: 'Hola! Tienen stock?', orderId: null, createdAt: '2026-09-29T10:00:00.000Z' },
}
const MENSAJE_SEMBRADO = SEMBRADA.lastMessage
const PERFIL = { id: 'cli-invitado', firstName: 'Invitado', lastName: 'Demo', email: 'invitado@demo.invalid', phone: null, dni: null, birthDate: null, avatarUrl: null, emailVerified: true }

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
  const cambios: string[] = []
  const fetchReal = vi.fn(async (entrada: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(entrada).replace(API, '')
    const ok = (b: unknown) => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } })
    if (url === '/conversations') return ok([SEMBRADA])
    if (url === '/conversations/cv-1/messages') return ok([MENSAJE_SEMBRADO])
    if (url === '/me/conversation') return ok({ id: null, messages: [] })
    if (url === '/me') return ok(PERFIL)
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
  eventos.addEventListener('orbita-demo:cambio', (e) => cambios.push(String((e as CustomEvent).detail)))
  return { cambios, fetchReal }
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'orbita.site')
  vi.stubEnv('NEXT_PUBLIC_API_URL', API)
})

async function instalar() {
  const { instalarInterceptorDemo } = await import('../interceptor')
  const { marcarVisitanteDemo } = await import('../modo')
  await import('../recursos/mensajes')
  instalarInterceptorDemo()
  marcarVisitanteDemo(true)
}

const pedir = (metodo: string, ruta: string, body?: unknown) =>
  window.fetch(`${API}${ruta}`, { method: metodo, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async (r) => ({ status: r.status, cuerpo: await r.json() }))

describe('mensajes entre la tienda y el panel en la demo', () => {
  it('lo que escribe el cliente le llega al panel como conversación sin leer', async () => {
    entorno()
    await instalar()
    expect((await pedir('POST', '/me/conversation/messages', { text: '  ¿Cuándo llega mi pedido?  ' })).cuerpo).toMatchObject({ sender: 'CUSTOMER', text: '¿Cuándo llega mi pedido?' })

    const hilo = (await pedir('GET', '/me/conversation')).cuerpo
    expect(hilo.messages).toHaveLength(1)
    expect(hilo.id).toBeTruthy()

    const bandeja = (await pedir('GET', '/conversations')).cuerpo
    expect(bandeja).toHaveLength(2)
    expect(bandeja[0]).toMatchObject({ id: hilo.id, customerId: 'cli-invitado', customerName: 'Invitado Demo', isUnread: true, lastMessage: { text: '¿Cuándo llega mi pedido?' } })
    // La sembrada sigue sin leer + la del Invitado.
    expect((await pedir('GET', '/conversations/unread-count')).cuerpo).toEqual({ count: 2 })
  })

  it('lo que contesta el dueño aparece en el chat del cliente y deja la conversación al día', async () => {
    entorno()
    await instalar()
    await pedir('POST', '/me/conversation/messages', { text: 'Hola' })
    const { id } = (await pedir('GET', '/me/conversation')).cuerpo

    const abierta = (await pedir('GET', `/conversations/${id}/messages`)).cuerpo
    expect(abierta.map((m: { text: string }) => m.text)).toEqual(['Hola'])
    const respuesta = await pedir('POST', `/conversations/${id}/messages`, { text: '¡Hola! Te contamos enseguida.' })
    expect(respuesta.cuerpo).toMatchObject({ sender: 'STORE', text: '¡Hola! Te contamos enseguida.' })

    const chat = (await pedir('GET', '/me/conversation')).cuerpo
    expect(chat.messages.map((m: { sender: string }) => m.sender)).toEqual(['CUSTOMER', 'STORE'])
    const fila = (await pedir('GET', '/conversations')).cuerpo.find((c: { id: string }) => c.id === id)
    expect(fila).toMatchObject({ isUnread: false, lastMessage: { sender: 'STORE' } })
  })

  it('si el cliente vuelve a escribir, la conversación vuelve a quedar sin leer', async () => {
    entorno()
    await instalar()
    await pedir('POST', '/me/conversation/messages', { text: 'Hola' })
    const { id } = (await pedir('GET', '/me/conversation')).cuerpo
    await pedir('GET', `/conversations/${id}/messages`)
    expect((await pedir('GET', '/conversations/unread-count')).cuerpo).toEqual({ count: 1 })
    await pedir('POST', '/me/conversation/messages', { text: '¿Sigue ahí?' })
    expect((await pedir('GET', '/conversations/unread-count')).cuerpo).toEqual({ count: 2 })
  })

  it('el panel puede contestar y leer una conversación sembrada; queda solo en el navegador', async () => {
    const { fetchReal } = entorno()
    await instalar()
    const abierta = await pedir('GET', '/conversations/cv-1/messages')
    expect(abierta.cuerpo).toHaveLength(1)
    expect((await pedir('GET', '/conversations/unread-count')).cuerpo).toEqual({ count: 0 })

    await pedir('POST', '/conversations/cv-1/messages', { text: 'Sí, tenemos.' })
    expect((await pedir('GET', '/conversations/cv-1/messages')).cuerpo.map((m: { text: string }) => m.text)).toEqual(['Hola! Tienen stock?', 'Sí, tenemos.'])
    expect((await pedir('GET', '/conversations')).cuerpo[0]).toMatchObject({ id: 'cv-1', lastMessage: { text: 'Sí, tenemos.' } })
    // La API real nunca recibió una escritura.
    expect(fetchReal.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')).toEqual([])
  })

  it('archivar y marcar sin leer se guardan en el navegador', async () => {
    entorno()
    await instalar()
    await pedir('PATCH', '/conversations/cv-1', { isArchived: true, isUnread: false })
    expect((await pedir('GET', '/conversations')).cuerpo[0]).toMatchObject({ isArchived: true, isUnread: false })
  })

  it('abrir una conversación ya leída no vuelve a escribir en el almacén (el chat sondea seguido)', async () => {
    const { cambios } = entorno()
    await instalar()
    await pedir('GET', '/conversations/cv-1/messages')
    const tras = cambios.length
    await pedir('GET', '/conversations/cv-1/messages')
    await pedir('GET', '/conversations/cv-1/messages')
    expect(cambios.length).toBe(tras)
  })

  it('un mensaje vacío o de más de 5000 caracteres se rechaza', async () => {
    entorno()
    await instalar()
    expect((await pedir('POST', '/me/conversation/messages', { text: '   ' })).status).toBe(400)
    expect((await pedir('POST', '/conversations/cv-1/messages', { text: 'x'.repeat(5001) })).status).toBe(400)
  })
})
