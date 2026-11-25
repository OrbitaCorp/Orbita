// El sitio de Turnos sobre la API pública de reservas (semana 4 del plan).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rubroPorKey } from '@/modules/turnos/datos'

const api = {
  config: vi.fn(), servicios: vi.fn(), recursos: vi.fn(), disponibilidad: vi.fn(), disponibilidadRango: vi.fn(), retener: vi.fn(), confirmar: vi.fn(),
}
vi.mock('@/lib/reservasApi/cliente', () => ({ sitio: () => api }))
const { cargarSitio } = await import('../origenSitio')

const barberia = rubroPorKey('barberia')
const agenda = (id: string, orden: number, tipo = 'PROFESIONAL') => ({ id, modulo: 'TURNOS', tipo, nombre: id, descripcion: null, cupo: 1, duracionMinutos: null, pasoMinutos: null, margenMinutos: null, maximoSeguidos: 1, precio: 0, horario: null, datos: null, orden, activo: true })
const servicio = (id: string, orden: number, extra: Record<string, unknown> = {}) => ({ id, modulo: 'TURNOS', nombre: `S ${id}`, descripcion: null, duracionMinutos: 30, precio: 1000 * (orden + 1), reservableOnline: true, recursoIds: [], orden, activo: true, ...extra })

beforeEach(() => {
  vi.clearAllMocks()
  api.config.mockResolvedValue({ modulo: 'TURNOS', confirmacion: 'AUTOMATICA', retencionMinutos: 10, anticipacionMinimaMinutos: 60, anticipacionMaximaDias: 60, cancelacionHastaHoras: 12, reprogramacionHastaHoras: 24, reprogramacionesMaximas: 2, senaPorcentaje: 30, senaReembolsable: true, listaDeEspera: true, horario: { 1: [[540, 780]] }, publico: { tolerancia: 15 } })
  api.servicios.mockResolvedValue([servicio('b', 1), servicio('a', 0), servicio('x', 2, { reservableOnline: false })])
  api.recursos.mockResolvedValue([agenda('r2', 1), agenda('r1', 0), agenda('cab', 0, 'ESPACIO')])
})

describe('el sitio con la API', () => {
  it('trae los servicios online en orden, las agendas del modo, la seña y la política', async () => {
    const s = await cargarSitio('turnos-prueba', barberia)
    expect(s.rubro.servicios.map(x => x.nombre)).toEqual(['S a', 'S b'])
    expect(s.servicioIds).toEqual(['a', 'b'])
    expect(s.rubro.sena).toBe(30)
    expect(s.recursos.map(r => r.id)).toEqual(['r1', 'r2'])
    expect(s.politica).toEqual({ cancelaHasta: 12, tolerancia: 15 })
    expect(s.senaSeDevuelve).toBe(true)
  })

  it('con "Cualquiera" suma los días de todas y en cada horario gana la primera libre', async () => {
    const s = await cargarSitio('turnos-prueba', barberia)
    api.disponibilidadRango.mockImplementation(async ({ recursoId }: { recursoId: string }) => ({
      recursoId, dias: [{ fecha: '2026-11-26', libres: recursoId === 'r1' ? 0 : 3, cerrado: false }, { fecha: '2026-11-29', libres: 0, cerrado: true }],
    }))
    const rango = await s.rango(['r1', 'r2'], 'a', '2026-11-26', 4)
    expect(api.disponibilidadRango).toHaveBeenCalledWith({ modulo: 'TURNOS', recursoId: 'r1', servicioId: 'a', desde: '2026-11-26', hasta: '2026-11-29' })
    expect(rango.get('2026-11-26')).toEqual({ libres: 3, cerrado: false })
    expect(rango.get('2026-11-29')).toEqual({ libres: 0, cerrado: true })

    api.disponibilidad.mockImplementation(async ({ recursoId }: { recursoId: string }) => ({
      recursoId, franjas: [{ inicioMinutos: 540, finMinutos: 570, libres: recursoId === 'r1' ? 0 : 1, cupo: 1 }, { inicioMinutos: 600, finMinutos: 630, libres: recursoId === 'r1' ? 1 : 0, cupo: 1 }],
    }))
    expect(await s.horarios(['r1', 'r2'], 'a', '2026-11-26')).toEqual([
      { m: 540, libre: true, recursoId: 'r2' }, { m: 600, libre: true, recursoId: 'r1' },
    ])
  })

  it('reservar retiene con la clave y confirma con los datos', async () => {
    const s = await cargarSitio('turnos-prueba', barberia)
    api.retener.mockResolvedValue({ token: 'tok', estado: 'RETENIDA', codigo: 'ABCDEF', precio: 12000, sena: 3600 })
    api.confirmar.mockResolvedValue({ token: 'tok', estado: 'CONFIRMADA', codigo: 'ABCDEF', precio: 12000, sena: 3600 })
    const r = await s.reservar({ recursoId: 'r1', servicioId: 'a', fecha: '2026-11-26', inicio: 540, clave: 'c1', nombre: 'Ana', telefono: '11 0000-0001' })
    expect(api.retener).toHaveBeenCalledWith({ modulo: 'TURNOS', recursoId: 'r1', servicioId: 'a', fecha: '2026-11-26', inicioMinutos: 540, clave: 'c1' })
    expect(api.confirmar).toHaveBeenCalledWith('tok', { cliente: { nombre: 'Ana', telefono: '11 0000-0001' } })
    expect(r).toEqual({ codigo: 'ABCDEF', token: 'tok', estado: 'CONFIRMADA', precio: 12000, sena: 3600 })
  })

  it('si el mismo intento ya estaba confirmado, no lo vuelve a confirmar', async () => {
    const s = await cargarSitio('turnos-prueba', barberia)
    api.retener.mockResolvedValue({ token: 'tok', estado: 'CONFIRMADA', codigo: 'ABCDEF', precio: 12000, sena: 0 })
    await s.reservar({ recursoId: 'r1', servicioId: 'a', fecha: '2026-11-26', inicio: 540, clave: 'c1', nombre: 'Ana' })
    expect(api.confirmar).not.toHaveBeenCalled()
  })
})

describe('lo que el sitio dice de la seña', () => {
  it('es lo mismo que dice el email: si se devuelve y hasta cuándo', async () => {
    const { senaDevolucionTxt } = await import('../Reserva')
    expect(senaDevolucionTxt({ senaSeDevuelve: true, politica: { cancelaHasta: 24 } })).toBe(' Si cancelás hasta 24 horas antes, se devuelve.')
    expect(senaDevolucionTxt({ senaSeDevuelve: true, politica: { cancelaHasta: 1 } })).toBe(' Si cancelás hasta 1 hora antes, se devuelve.')
    expect(senaDevolucionTxt({ senaSeDevuelve: false, politica: { cancelaHasta: 24 } })).toBe(' Si cancelás, la seña no se devuelve.')
  })
})
