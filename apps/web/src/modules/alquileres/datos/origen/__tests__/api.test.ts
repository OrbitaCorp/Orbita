import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config, Paginado, Recurso, Reserva } from '@/lib/reservasApi/tipos'

const panel = vi.hoisted(() => ({
  config: vi.fn(), recursos: vi.fn(), servicios: vi.fn(), bloqueos: vi.fn(), agenda: vi.fn(),
}))
const getBusiness = vi.hoisted(() => vi.fn())
vi.mock('@/lib/reservasApi/cliente', () => ({ panel }))
vi.mock('@/lib/api', () => ({ getBusiness }))

import { DIAS_POR_PEDIDO, cargarApi, origenApi, reservasEntre, tramosDeFechas } from '../api'

const recurso = (r: Partial<Recurso>): Recurso => ({
  id: 'r', modulo: 'ALQUILERES', tipo: 'CANCHA', nombre: 'X', descripcion: null, cupo: 1, duracionMinutos: 60, pasoMinutos: 60,
  margenMinutos: null, maximoSeguidos: 1, precio: 1000, horario: null, datos: null, orden: 0, activo: true, ...r,
})
const config = { modulo: 'ALQUILERES', activo: true, confirmacion: 'AUTOMATICA', retencionMinutos: 15, anticipacionMinimaMinutos: 0, anticipacionMaximaDias: 180, cancelacionHastaHoras: 48, reprogramacionHastaHoras: 48, reprogramacionesMaximas: 1, senaPorcentaje: 30, senaReembolsable: true, maximoActivasPorCliente: 0, listaDeEspera: false, margenMinutos: 0, horario: {} } satisfies Config
const pagina = (n: number, total: number): Paginado<Reserva> => ({ data: Array.from({ length: n }, (_, i) => ({ id: `r${i}` }) as Reserva), total, page: 1, limit: 100 })

beforeEach(() => {
  vi.resetAllMocks()
  getBusiness.mockResolvedValue({ id: 'b', name: 'Cabañas', subdomain: 'cabanas', description: null, industry: 'alquileres', subrubros: ['cabana'] })
  panel.config.mockResolvedValue(config)
  panel.recursos.mockResolvedValue([])
  panel.servicios.mockResolvedValue([])
  panel.bloqueos.mockResolvedValue([])
  panel.agenda.mockResolvedValue(pagina(0, 0))
})

describe('tramosDeFechas', () => {
  it('parte el rango en tramos de hasta 90 días que lo cubren entero', () => {
    const t = tramosDeFechas('2026-01-01', '2026-07-01')
    expect(t).toHaveLength(3)
    expect(t[0]).toEqual(['2026-01-01', '2026-03-31'])
    expect(t[t.length - 1][1]).toBe('2026-07-01')
    expect(DIAS_POR_PEDIDO).toBe(90)
  })
})

describe('reservasEntre', () => {
  it('trae todas las páginas de un tramo', async () => {
    panel.agenda.mockResolvedValueOnce(pagina(100, 130)).mockResolvedValueOnce(pagina(30, 130))
    const rs = await reservasEntre('2026-11-01', '2026-11-30')
    expect(rs).toHaveLength(130)
    expect(panel.agenda).toHaveBeenNthCalledWith(2, expect.objectContaining({ modulo: 'ALQUILERES', page: 2, limit: 100 }))
  })
})

describe('cargarApi', () => {
  it('sin config de Alquileres avisa que el negocio no lo tiene configurado', async () => {
    panel.config.mockResolvedValue(null)
    await expect(cargarApi('2026-11-18')).rejects.toThrow('Este negocio todavía no tiene Alquileres configurado.')
  })

  it('el modo sale del rubro y solo entran los recursos de ese modo', async () => {
    panel.recursos.mockResolvedValue([recurso({ id: 'p1', tipo: 'ALOJAMIENTO' }), recurso({ id: 'c1', tipo: 'CANCHA' })])
    const d = await cargarApi('2026-11-18')
    expect(d.tipo).toBe('estadia')
    expect(d.negocio.propiedades.map(p => p.id)).toEqual(['p1'])
    expect(d.negocio.unidades).toEqual([])
    expect(d.negocio.nombre).toBe('Cabañas')
    expect(d.negocio.slug).toBe('cabanas')
    expect(panel.config).toHaveBeenCalledWith('ALQUILERES')
  })

  it('no muestra las reservas vencidas', async () => {
    panel.recursos.mockResolvedValue([recurso({ id: 'c1' })])
    getBusiness.mockResolvedValue({ id: 'b', name: 'Complejo', subdomain: 'complejo', description: null, industry: 'alquileres', subrubros: ['canchas'] })
    const base = { recursoId: 'c1', fecha: '2026-11-18', inicio: '2026-11-18T20:00:00.000Z', fin: '2026-11-18T21:00:00.000Z', inicioMinutos: 1020, finMinutos: 1080, clienteNombre: 'A', clienteTelefono: '1', clienteEmail: null, clienteId: null, extras: null, precio: 1, sena: 0, pagado: 0, creadaEn: '2026-11-01T00:00:00.000Z', notas: null }
    panel.agenda.mockResolvedValueOnce({ data: [{ ...base, id: 'ok', estado: 'CONFIRMADA' }, { ...base, id: 'no', estado: 'VENCIDA' }], total: 2, page: 1, limit: 100 })
    const d = await cargarApi('2026-11-18')
    expect(d.reservas.map(r => r.id)).toEqual(['ok'])
    expect(d.clientes).toHaveLength(1)
  })
})

describe('origenApi', () => {
  it('es el origen de la API', () => {
    expect(origenApi.tipo).toBe('api')
  })
})
