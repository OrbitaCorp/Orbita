// La ventana de la agenda (62 días para cada lado) no entra en un solo pedido del listado: la API
// acepta hasta 93 días por vez. Encontrado al probar el panel contra el negocio de prueba (16/11).
import { describe, expect, it, vi } from 'vitest'
import { sumarDias } from '@/lib/reservas/fechas'

const agenda = vi.fn()
const crearServicio = vi.fn()
const editarServicio = vi.fn()
const borrarServicio = vi.fn()
const crearRecurso = vi.fn()
const editarRecurso = vi.fn()
vi.mock('@/lib/reservasApi/cliente', () => ({
  panel: {
    agenda: (f: unknown) => agenda(f),
    crearRecurso: (d: unknown) => crearRecurso(d),
    editarRecurso: (id: string, d: unknown) => editarRecurso(id, d),
    crearServicio: (d: unknown) => crearServicio(d),
    editarServicio: (id: string, d: unknown) => editarServicio(id, d),
    borrarServicio: (id: string) => borrarServicio(id),
  },
}))

const { DIAS_POR_PEDIDO, VENTANA_DIAS, origenApi, reservasEntre, tramosDeFechas } = await import('../api')
const { semanaDeHorario } = await import('../mapear')
const { rubroPorKey } = await import('@/modules/turnos/datos')
const PARTIDO: [number, number][] = [[540, 780], [960, 1200]]

const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400_000) + 1

describe('la agenda de la API en tramos', () => {
  it('cubre la ventana entera, sin huecos ni días repetidos, de a 90 días como mucho', () => {
    const hoy = '2026-11-16'
    const tramos = tramosDeFechas(sumarDias(hoy, -VENTANA_DIAS), sumarDias(hoy, VENTANA_DIAS))
    expect(tramos).toHaveLength(2)
    expect(tramos[0][0]).toBe(sumarDias(hoy, -VENTANA_DIAS))
    expect(tramos.at(-1)?.[1]).toBe(sumarDias(hoy, VENTANA_DIAS))
    for (const [i, [d, h]] of tramos.entries()) {
      expect(dias(d, h)).toBeLessThanOrEqual(DIAS_POR_PEDIDO)
      if (i > 0) expect(d).toBe(sumarDias(tramos[i - 1][1], 1))
    }
    expect(tramosDeFechas('2026-11-16', '2026-11-16')).toEqual([['2026-11-16', '2026-11-16']])
  })

  it('pide cada tramo con todas sus páginas y junta todo', async () => {
    agenda.mockImplementation(async (f: { desde: string; page: number }) => {
      const total = f.desde < '2026-11-01' ? 150 : 20
      const data = Array.from({ length: Math.min(100, total - (f.page - 1) * 100) }, (_, i) => ({ id: `${f.desde}-${f.page}-${i}` }))
      return { data, total }
    })
    const reservas = await reservasEntre('2026-09-15', '2027-01-17')
    expect(reservas).toHaveLength(170)
    for (const [f] of agenda.mock.calls) expect(dias(f.desde, f.hasta)).toBeLessThan(93)
  })
})

describe('servicios guardados en la API', () => {
  const deApi = (d: Record<string, unknown>, id = 'srv-1') => ({ id, modulo: 'TURNOS', descripcion: null, recursoIds: [], orden: 0, ...d })

  it('crear manda todo lo que maneja el panel y devuelve el servicio con el id de la API', async () => {
    crearServicio.mockImplementation(async (d: Record<string, unknown>) => deApi(d))
    const s = await origenApi.servicios.crear({ id: 's123', nombre: 'Corte', duracion: 30, precio: 12000, online: false }, 5)
    expect(crearServicio).toHaveBeenCalledWith({ modulo: 'TURNOS', nombre: 'Corte', duracionMinutos: 30, precio: 12000, reservableOnline: false, activo: true, orden: 5 })
    expect(s).toEqual({ id: 'srv-1', nombre: 'Corte', duracion: 30, precio: 12000, online: false })
  })

  it('pausar es editar con activo en falso, y vuelve pausado', async () => {
    editarServicio.mockImplementation(async (id: string, d: Record<string, unknown>) => deApi(d, id))
    const s = await origenApi.servicios.editar({ id: 'srv-1', nombre: 'Corte', duracion: 45, precio: 0, online: true, pausado: true })
    expect(editarServicio).toHaveBeenCalledWith('srv-1', expect.objectContaining({ duracionMinutos: 45, precio: 0, activo: false }))
    expect(s.pausado).toBe(true)
  })

  it('borrar llama a la baja y el error de la API sale con su mensaje', async () => {
    borrarServicio.mockResolvedValueOnce({ ok: true })
    await origenApi.servicios.borrar('srv-1')
    expect(borrarServicio).toHaveBeenCalledWith('srv-1')
    crearServicio.mockRejectedValueOnce(new Error('Ya tenés un servicio con ese nombre.'))
    await expect(origenApi.servicios.crear({ id: 'x', nombre: 'Corte', duracion: 30, precio: 1, online: true }, 0)).rejects.toThrow('Ya tenés un servicio con ese nombre.')
  })
})

describe('agendas guardadas en la API', () => {
  const barberia = rubroPorKey('barberia')
  const spa = rubroPorKey('spa')
  // Lunes a sábado partido, domingo cerrado: la semana de la barbería de prueba.
  const semana = semanaDeHorario({ 1: PARTIDO, 2: PARTIDO, 3: PARTIDO, 4: PARTIDO, 5: PARTIDO, 6: PARTIDO })
  const deApi = (d: Record<string, unknown>, id = 'rec-9') => ({ id, modulo: 'TURNOS', descripcion: null, duracionMinutos: null, pasoMinutos: null, margenMinutos: null, maximoSeguidos: 1, precio: 0, memberId: null, activo: true, orden: 0, ...d })

  it('una persona con el horario del negocio va sin horario propio, con su rol del equipo en datos', async () => {
    crearRecurso.mockImplementation(async (d: Record<string, unknown>) => deApi(d))
    const r = await origenApi.agendas.crear(
      { id: 'r1001', nombre: 'Sofi', rol: 'Aprendiz', color: '#3B82F6', atiende: [0, 1, 2, 3, 4, 5], horario: '', dias: 'Lun a sáb' },
      { rubro: barberia, semana, rolId: 'aprendiz', orden: 3 },
    )
    expect(crearRecurso).toHaveBeenLastCalledWith({ modulo: 'TURNOS', tipo: 'PROFESIONAL', nombre: 'Sofi', cupo: 1, horario: null, datos: { rol: 'Aprendiz', color: '#3B82F6', rolId: 'aprendiz' }, orden: 3 })
    expect(r).toMatchObject({ id: 'rec-9', nombre: 'Sofi', rol: 'Aprendiz', atiende: [0, 1, 2, 3, 4, 5], horario: '' })
  })

  it('con días u horario propio va día por día, y vuelve igual', async () => {
    editarRecurso.mockImplementation(async (id: string, d: Record<string, unknown>) => deApi(d, id))
    const r = await origenApi.agendas.editar(
      { id: 'rec-2', nombre: 'Cabina 2', rol: 'Espacio', color: '#10B981', atiende: [1, 3], horario: '16:00 – 20:00', dias: 'Mar y jue' },
      { rubro: spa, semana },
    )
    expect(editarRecurso).toHaveBeenLastCalledWith('rec-2', expect.objectContaining({ tipo: 'ESPACIO', horario: { 2: [[960, 1200]], 4: [[960, 1200]] } }))
    expect(r).toMatchObject({ atiende: [1, 3], horario: '16:00 – 20:00' })
  })
})
