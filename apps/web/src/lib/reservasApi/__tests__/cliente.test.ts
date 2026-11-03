import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/authClient', () => ({
  authedFetch: (path: string, init?: RequestInit) => fetch(path, init),
}))

import { ReservasApiError, panel, query, sitio } from '../cliente'

const respuesta = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('reservasApi · cliente', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('query deja afuera lo vacío y une las listas con coma', () => {
    expect(query({ modulo: 'TURNOS', desde: undefined, q: '', estado: ['CONFIRMADA', 'PENDIENTE'], page: 2 })).toBe('?modulo=TURNOS&estado=CONFIRMADA%2CPENDIENTE&page=2')
    expect(query({})).toBe('')
  })

  it('el sitio pega a /storefront/:slug/reservas y devuelve el cuerpo', async () => {
    const fetchMock = vi.fn(async () => respuesta(201, { id: 'r1', estado: 'RETENIDA', token: 'abc' }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await sitio('la-barberia').retener({ modulo: 'TURNOS', recursoId: 'x', fecha: '2026-11-10', inicioMinutos: 600, clave: 'k' })
    expect(r.token).toBe('abc')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/storefront\/la-barberia\/reservas\/retener$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ clave: 'k', inicioMinutos: 600 })
  })

  it('un 409 llega como ReservasApiError con el mensaje de la API y esConflicto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(409, { statusCode: 409, error: 'Conflict', message: 'Ese horario se acaba de ocupar. Elegí otro.' })))
    const error = await panel.crear({ modulo: 'ALQUILERES', recursoId: 'x', fecha: '2026-11-10', inicioMinutos: 600 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ReservasApiError)
    expect((error as ReservasApiError).esConflicto).toBe(true)
    expect((error as ReservasApiError).message).toBe('Ese horario se acaba de ocupar. Elegí otro.')
  })

  it('el panel pega a /reservas con la sesión del panel', async () => {
    const fetchMock = vi.fn(async () => respuesta(200, { data: [], total: 0, page: 1, limit: 50 }))
    vi.stubGlobal('fetch', fetchMock)
    await panel.agenda({ modulo: 'GIMNASIO', desde: '2026-11-10', hasta: '2026-11-16', estado: ['CONFIRMADA'] })
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toMatch(/\/reservas\?modulo=GIMNASIO&desde=2026-11-10&hasta=2026-11-16&estado=CONFIRMADA$/)
  })
})
