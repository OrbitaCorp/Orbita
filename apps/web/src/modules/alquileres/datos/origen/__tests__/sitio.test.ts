import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recurso } from '@/lib/reservasApi/tipos'

const api = vi.hoisted(() => ({ config: vi.fn(), recursos: vi.fn(), noches: vi.fn(), reservar: vi.fn() }))
const getStorefrontConfig = vi.hoisted(() => vi.fn())
// El error de la API, como el de verdad: lo que el sitio mira es el status.
const ReservasApiError = vi.hoisted(() => class extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
  get esConflicto() { return this.status === 409 }
})
vi.mock('@/lib/reservasApi/cliente', () => ({ sitio: () => api, ReservasApiError }))
vi.mock('@/lib/storefront/api', () => ({ getStorefrontConfig }))

import { DIAS_DE_CALENDARIO, cargarSitio, reservarEnSitio } from '../sitio'

const cabana = (id: string, r: Partial<Recurso> = {}): Recurso => ({
  id, modulo: 'ALQUILERES', tipo: 'ALOJAMIENTO', nombre: `Cabaña ${id}`, descripcion: null, cupo: 1, duracionMinutos: null, pasoMinutos: null,
  margenMinutos: null, maximoSeguidos: 1, precio: 90000, horario: null, datos: { nochesMinimas: 2 }, orden: 0, activo: true, ...r,
})
const config = (c: object = {}) => ({
  modulo: 'ALQUILERES', confirmacion: 'MANUAL', retencionMinutos: 15, anticipacionMinimaMinutos: 0, anticipacionMaximaDias: 365,
  cancelacionHastaHoras: 48, reprogramacionHastaHoras: 48, reprogramacionesMaximas: 1, senaPorcentaje: 50, senaReembolsable: true, listaDeEspera: false, horario: {}, ...c,
})
const pedido = { propiedadId: 'p1', entrada: '2026-12-10', salida: '2026-12-13', nombre: 'Ana Ríos', telefono: '0000 55-0101', email: '', notas: '', huespedes: 2, clave: 'k-1' }

beforeEach(() => {
  vi.clearAllMocks()
  getStorefrontConfig.mockResolvedValue({ business: { name: 'Cabañas del Monte', subdomain: 'monte', subrubros: ['cabana'] }, appearance: null, contact: null, payment: null })
  api.config.mockResolvedValue(config())
  api.recursos.mockResolvedValue([cabana('p1'), cabana('p2')])
  api.noches.mockImplementation(async (q: { recursoId: string; desde: string }) => ({ recursoId: q.recursoId, ocupadas: q.recursoId === 'p1' && q.desde === '2026-11-23' ? ['2026-12-10', '2026-12-11'] : [], nochesMinimas: 2, checkInMinutos: 840, checkOutMinutos: 600 }))
})

describe('cargarSitio', () => {
  it('arma el negocio con lo público y las noches ocupadas de cada propiedad', async () => {
    const c = await cargarSitio('monte', '2026-11-23')
    expect(c.tipo).toBe('estadia')
    expect(c.negocio.propiedades.map(p => p.id)).toEqual(['p1', 'p2'])
    expect(c.negocio.bloqueos.map(b => [b.unidadId, b.desde, b.hasta])).toEqual([['p1', '2026-12-10', '2026-12-12']])
    expect(c.confirmaElNegocio).toBe(true)
  })

  it('pide las noches hasta la anticipación máxima, en rangos que la API acepta (menos de 186 días)', async () => {
    const c = await cargarSitio('monte', '2026-11-23')
    expect(c.ultimoDia).toBe('2027-11-23')
    const deP1 = api.noches.mock.calls.map(([q]) => q).filter(q => q.recursoId === 'p1')
    expect(deP1.map(q => [q.desde, q.hasta])).toEqual([['2026-11-23', '2027-05-21'], ['2027-05-22', '2027-11-17'], ['2027-11-18', '2027-11-23']])
  })

  it('un negocio que deja reservar a más de un año no pide más que el año del calendario', async () => {
    api.config.mockResolvedValue(config({ anticipacionMaximaDias: 900 }))
    const c = await cargarSitio('monte', '2026-11-23')
    expect(c.ultimoDia).toBe('2027-11-23')
    expect(DIAS_DE_CALENDARIO).toBe(365)
  })

  it('con confirmación automática la reserva no nace pendiente', async () => {
    api.config.mockResolvedValue(config({ confirmacion: 'AUTOMATICA' }))
    expect((await cargarSitio('monte', '2026-11-23')).confirmaElNegocio).toBe(false)
  })

  it('si las reservas están en pausa, falla con el mensaje de la API', async () => {
    api.config.mockRejectedValue(new ReservasApiError(404, 'Las reservas online están pausadas por el momento.'))
    await expect(cargarSitio('monte', '2026-11-23')).rejects.toThrow('Las reservas online están pausadas por el momento.')
  })
})

describe('reservarEnSitio', () => {
  const deLaApi = { id: 'x1', recursoId: 'p1', codigo: 'HKA4NR', estado: 'PENDIENTE', fecha: '2026-12-10', fin: '2026-12-13T13:00:00.000Z', creadaEn: '2026-11-23T15:00:00.000Z', precio: 270000, sena: 135000, pagado: 0, extras: null, notas: '2 huéspedes', clienteNombre: 'Ana Ríos', clienteTelefono: '0000 55-0101', clienteEmail: null, clienteId: null, servicioId: null, token: 'tok-1' }

  it('manda el pedido sin precio y devuelve la reserva con su código, su token y si quedó pendiente', async () => {
    api.reservar.mockResolvedValue(deLaApi)
    const res = await reservarEnSitio('monte', pedido)
    expect(api.reservar).toHaveBeenCalledWith({ modulo: 'ALQUILERES', recursoId: 'p1', fecha: '2026-12-10', fechaHasta: '2026-12-13', clave: 'k-1', cliente: { nombre: 'Ana Ríos', telefono: '0000 55-0101' }, datos: { huespedes: 2, canal: 'sitio' } })
    expect(res).toMatchObject({ ok: true, hecha: { codigo: 'HKA4NR', token: 'tok-1', pendiente: true, reserva: { unidadId: 'p1', entrada: '2026-12-10', salida: '2026-12-13', total: 270000, sena: 135000, huespedes: 2 } } })
  })

  it('una reserva que nace confirmada no queda pendiente', async () => {
    api.reservar.mockResolvedValue({ ...deLaApi, estado: 'CONFIRMADA' })
    expect(await reservarEnSitio('monte', pedido)).toMatchObject({ ok: true, hecha: { pendiente: false } })
  })

  it('si las noches se ocuparon (409), avisa con el mensaje de la API y marca que hay que elegir otras', async () => {
    api.reservar.mockRejectedValue(new ReservasApiError(409, 'Esas fechas se acaban de ocupar. Elegí otras.'))
    expect(await reservarEnSitio('monte', pedido)).toEqual({ ok: false, mensaje: 'Esas fechas se acaban de ocupar. Elegí otras.', ocupado: true })
  })

  it('otro rechazo de la API (estadía mínima, anticipación) se muestra tal cual, sin pedir otras fechas', async () => {
    api.reservar.mockRejectedValue(new ReservasApiError(400, 'La estadía mínima es de 2 noches.'))
    expect(await reservarEnSitio('monte', pedido)).toEqual({ ok: false, mensaje: 'La estadía mínima es de 2 noches.', ocupado: false })
  })

  it('sin conexión no tira: explica que se puede reintentar sin duplicar', async () => {
    api.reservar.mockRejectedValue(new TypeError('Failed to fetch'))
    const res = await reservarEnSitio('monte', pedido)
    expect(res).toMatchObject({ ok: false, ocupado: false })
    expect(res.ok === false && res.mensaje).toMatch(/no se duplica/)
  })
})
