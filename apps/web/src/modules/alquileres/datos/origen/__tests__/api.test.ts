import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config, Paginado, Recurso, Reserva } from '@/lib/reservasApi/tipos'

const panel = vi.hoisted(() => ({
  config: vi.fn(), recursos: vi.fn(), servicios: vi.fn(), bloqueos: vi.fn(), agenda: vi.fn(),
  crearRecurso: vi.fn(), editarRecurso: vi.fn(), borrarRecurso: vi.fn(), guardarConfig: vi.fn(),
  crear: vi.fn(), pago: vi.fn(), confirmar: vi.fn(), completar: vi.fn(), cancelar: vi.fn(),
  crearBloqueo: vi.fn(), borrarBloqueo: vi.fn(),
  calendarios: vi.fn(), conectarCalendario: vi.fn(), desconectarCalendario: vi.fn(), sincronizarCalendario: vi.fn(),
}))
const panelGetBusiness = vi.hoisted(() => vi.fn())
vi.mock('@/lib/reservasApi/cliente', () => ({ panel }))
vi.mock('@/lib/api', () => ({ panelGetBusiness }))

import { DIAS_POR_PEDIDO, cargarApi, escriturasDe, origenApi, reservasEntre, tramosDeFechas } from '../api'
import type { Bloqueo, Propiedad, Reserva as ReservaPanel } from '../../index'

/** Un negocio de estadía ya cargado, con una cabaña y una reserva pendiente, y las escrituras sobre él. */
async function conCabana() {
  panel.recursos.mockResolvedValue([recurso({ id: 'p1', tipo: 'ALOJAMIENTO', nombre: 'Arrayán', precio: 85000, duracionMinutos: null, datos: { checkIn: 840, checkOut: 600, nochesMinimas: 2, tarifa: { limpieza: 15000, finDeSemanaPct: 20 } } })])
  const base = { recursoId: 'p1', fecha: '2026-12-04', inicio: '2026-12-04T17:00:00.000Z', fin: '2026-12-07T13:00:00.000Z', inicioMinutos: 840, finMinutos: 600, clienteNombre: 'Ana', clienteTelefono: '1', clienteEmail: null, clienteId: null, extras: null, creadaEn: '2026-11-20T00:00:00.000Z', notas: null }
  panel.agenda.mockResolvedValue({ data: [{ ...base, id: 'x1', estado: 'PENDIENTE', precio: 255000, sena: 76500, pagado: 0 }], total: 1, page: 1, limit: 100 })
  const datos = await cargarApi('2026-11-23')
  const recargar = vi.fn().mockResolvedValue(undefined)
  return { datos, recargar, e: escriturasDe(datos, recargar) }
}

const recurso = (r: Partial<Recurso>): Recurso => ({
  id: 'r', modulo: 'ALQUILERES', tipo: 'CANCHA', nombre: 'X', descripcion: null, cupo: 1, duracionMinutos: 60, pasoMinutos: 60,
  margenMinutos: null, maximoSeguidos: 1, precio: 1000, horario: null, datos: null, orden: 0, activo: true, ...r,
})
const config = { modulo: 'ALQUILERES', activo: true, confirmacion: 'AUTOMATICA', retencionMinutos: 15, anticipacionMinimaMinutos: 0, anticipacionMaximaDias: 180, cancelacionHastaHoras: 48, reprogramacionHastaHoras: 48, reprogramacionesMaximas: 1, senaPorcentaje: 30, senaReembolsable: true, maximoActivasPorCliente: 0, listaDeEspera: false, margenMinutos: 0, horario: {} } satisfies Config
const pagina = (n: number, total: number): Paginado<Reserva> => ({ data: Array.from({ length: n }, (_, i) => ({ id: `r${i}` }) as Reserva), total, page: 1, limit: 100 })

beforeEach(() => {
  vi.resetAllMocks()
  panelGetBusiness.mockResolvedValue({ id: 'b', name: 'Cabañas', subdomain: 'cabanas', description: null, industry: 'alquileres', subrubros: ['cabana'] })
  panel.config.mockResolvedValue(config)
  panel.recursos.mockResolvedValue([])
  panel.servicios.mockResolvedValue([])
  panel.bloqueos.mockResolvedValue([])
  panel.agenda.mockResolvedValue(pagina(0, 0))
  panel.calendarios.mockResolvedValue([])
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
    panelGetBusiness.mockResolvedValue({ id: 'b', name: 'Complejo', subdomain: 'complejo', description: null, industry: 'alquileres', subrubros: ['canchas'] })
    const base = { recursoId: 'c1', fecha: '2026-11-18', inicio: '2026-11-18T20:00:00.000Z', fin: '2026-11-18T21:00:00.000Z', inicioMinutos: 1020, finMinutos: 1080, clienteNombre: 'A', clienteTelefono: '1', clienteEmail: null, clienteId: null, extras: null, precio: 1, sena: 0, pagado: 0, creadaEn: '2026-11-01T00:00:00.000Z', notas: null }
    panel.agenda.mockResolvedValueOnce({ data: [{ ...base, id: 'ok', estado: 'CONFIRMADA' }, { ...base, id: 'no', estado: 'VENCIDA' }], total: 2, page: 1, limit: 100 })
    const d = await cargarApi('2026-11-18')
    expect(d.reservas.map(r => r.id)).toEqual(['ok'])
    expect(d.clientes).toHaveLength(1)
  })
})

describe('cargarApi con recursos desactivados', () => {
  it('pide también los inactivos, conserva sus reservas y solo lista los activos', async () => {
    panelGetBusiness.mockResolvedValue({ id: 'b', name: 'Complejo', subdomain: 'complejo', description: null, industry: 'alquileres', subrubros: ['canchas'] })
    panel.recursos.mockResolvedValue([recurso({ id: 'c1' }), recurso({ id: 'c2', activo: false })])
    const base = { fecha: '2026-11-18', inicio: '2026-11-18T20:00:00.000Z', fin: '2026-11-18T21:00:00.000Z', inicioMinutos: 1020, finMinutos: 1080, clienteNombre: 'A', clienteTelefono: '1', clienteEmail: null, clienteId: null, extras: null, precio: 1, sena: 0, pagado: 0, creadaEn: '2026-11-01T00:00:00.000Z', notas: null, estado: 'COMPLETADA' }
    panel.agenda.mockResolvedValueOnce({ data: [{ ...base, id: 'a', recursoId: 'c1' }, { ...base, id: 'b', recursoId: 'c2' }], total: 2, page: 1, limit: 100 })
    const d = await cargarApi('2026-11-18')
    expect(panel.recursos).toHaveBeenCalledWith('ALQUILERES', true)
    expect(d.negocio.unidades.map(u => u.id)).toEqual(['c1'])
    expect(d.reservas.map(r => r.id).sort()).toEqual(['a', 'b'])
  })
})

describe('lo que el panel real escribe en la API (estadía)', () => {
  it('lee la tarifa completa de la propiedad: el servidor cobra con la misma cuenta', async () => {
    const { datos } = await conCabana()
    expect(datos.negocio.propiedades[0].tarifa).toEqual({ precioNoche: 85000, temporadas: [], finDeSemanaPct: 20, limpieza: 15000, minNoches: 2 })
  })

  it('guardar las propiedades crea las nuevas, edita las que cambiaron, borra las que se quitaron y recarga', async () => {
    const { datos, recargar, e } = await conCabana()
    const p1 = datos.negocio.propiedades[0]
    const nueva: Propiedad = { ...p1, id: 'c-local', nombre: 'Lapacho' }
    await e.configurar('estadia', { propiedades: [{ ...p1, nombre: 'Arrayán II' }, nueva] })
    expect(panel.editarRecurso).toHaveBeenCalledWith('p1', expect.objectContaining({ nombre: 'Arrayán II', tipo: 'ALOJAMIENTO', orden: 0 }))
    expect(panel.crearRecurso).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Lapacho', orden: 1 }))
    expect(panel.borrarRecurso).not.toHaveBeenCalled()
    expect(recargar).toHaveBeenCalledTimes(1)

    await e.configurar('estadia', { propiedades: [] })
    expect(panel.borrarRecurso).toHaveBeenCalledWith('p1')
  })

  it('guardar la seña o el plazo de cancelación va a la config', async () => {
    const { e } = await conCabana()
    await e.configurar('estadia', { senaPct: 50 })
    expect(panel.guardarConfig).toHaveBeenCalledWith({ modulo: 'ALQUILERES', senaPorcentaje: 50 })
  })

  it('lo que la API todavía no guarda falla con un mensaje, en vez de decir "guardado"', async () => {
    const { e, recargar } = await conCabana()
    await expect(Promise.resolve().then(() => e.configurar('estadia', { mensajes: [] }))).rejects.toThrow(/todavía no se guarda/)
    expect(recargar).not.toHaveBeenCalled()
  })

  it('una reserva a mano se crea en la API; si ya pagó la seña, se anota el pago', async () => {
    const { e, recargar } = await conCabana()
    panel.crear.mockResolvedValue({ id: 'nueva', sena: 76500 })
    const r: ReservaPanel = { id: 'n1', unidadId: 'p1', clienteId: 'k', estado: 'confirmada', creada: '2026-11-23', entrada: '2026-12-10', salida: '2026-12-13', extras: [], total: 255000, sena: 76500, senaPagada: true, saldoPagado: false }
    await e.reservar('estadia', r, { id: 'k', nombre: 'Leo Paz', telefono: '3757 55-0102' })
    expect(panel.crear).toHaveBeenCalledWith(expect.objectContaining({ recursoId: 'p1', fecha: '2026-12-10', fechaHasta: '2026-12-13', estado: 'CONFIRMADA', cliente: { nombre: 'Leo Paz', telefono: '3757 55-0102' } }))
    expect(panel.pago).toHaveBeenCalledWith('nueva', { monto: 76500, metodo: 'OTRO' })
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('registrar la seña anota el pago y confirma; cancelar cancela', async () => {
    const { e } = await conCabana()
    await e.cambiarReserva('x1', { estado: 'confirmada', senaPagada: true })
    expect(panel.pago).toHaveBeenCalledWith('x1', { monto: 76500, metodo: 'OTRO' })
    expect(panel.confirmar).toHaveBeenCalledWith('x1')
    await e.cambiarReserva('x1', { estado: 'cancelada' })
    expect(panel.cancelar).toHaveBeenCalledWith('x1')
  })

  it('bloquear y quitar un bloqueo', async () => {
    const { e } = await conCabana()
    const b: Bloqueo = { id: 'local', unidadId: 'p1', desde: '2026-12-20', hasta: '2026-12-23', motivo: 'Uso propio', origen: 'dueno' }
    await e.agregarBloqueo('estadia', b)
    expect(panel.crearBloqueo).toHaveBeenCalledWith({ modulo: 'ALQUILERES', recursoId: 'p1', fechaDesde: '2026-12-20', minutoDesde: 840, fechaHasta: '2026-12-23', minutoHasta: 600, motivo: 'Uso propio' })
    await e.quitarBloqueo('estadia', 'abc:p1')
    expect(panel.borrarBloqueo).toHaveBeenCalledWith('abc')
  })
})

describe('origenApi', () => {
  it('es el origen de la API', () => {
    expect(origenApi.tipo).toBe('api')
  })
})

describe('calendarios de Airbnb en el panel real', () => {
  const deLaApi = { id: 'cal-1', recursoId: 'p1', nombre: 'Airbnb', url: 'https://www.airbnb.com/calendar/ical/1.ics', activo: true, ultimaSync: '2026-11-23T13:10:00.000Z', ultimoError: null, conflictos: [] }

  it('carga los calendarios conectados con su estado', async () => {
    panel.calendarios.mockResolvedValue([deLaApi])
    const { datos } = await conCabana()
    expect(panel.calendarios).toHaveBeenCalledWith('ALQUILERES')
    expect(datos.negocio.calendariosExternos).toEqual([{ id: 'cal-1', unidadId: 'p1', nombre: 'Airbnb', url: deLaApi.url, ultimaSync: '2026-11-23', ultimaSyncEn: '2026-11-23T13:10:00.000Z', conflictos: [] }])
  })

  it('si la API todavía no tiene calendarios (se desplegó el front antes), el panel carga igual, sin ellos', async () => {
    panel.calendarios.mockRejectedValue(new Error('Cannot GET /reservas/calendarios'))
    const { datos } = await conCabana()
    expect(datos.negocio.calendariosExternos).toEqual([])
    expect(datos.negocio.propiedades).toHaveLength(1)
  })

  it('conectar manda el enlace a la API y recarga; desconectar y sincronizar, lo mismo', async () => {
    const { e, recargar } = await conCabana()
    panel.conectarCalendario.mockResolvedValue(deLaApi)
    await e.agregarCalendario('estadia', { id: 'tmp', unidadId: 'p1', nombre: 'Airbnb', url: deLaApi.url, ultimaSync: '2026-11-23' }, [])
    expect(panel.conectarCalendario).toHaveBeenCalledWith({ modulo: 'ALQUILERES', recursoId: 'p1', nombre: 'Airbnb', url: deLaApi.url })
    await e.quitarCalendario('estadia', 'cal-1')
    expect(panel.desconectarCalendario).toHaveBeenCalledWith('cal-1')
    await e.sincronizarCalendario('estadia', 'cal-1')
    expect(panel.sincronizarCalendario).toHaveBeenCalledWith('cal-1')
    expect(recargar).toHaveBeenCalledTimes(3)
  })

  it('si Airbnb rechaza el enlace, llega el mensaje de la API y no se recarga', async () => {
    const { e, recargar } = await conCabana()
    panel.conectarCalendario.mockRejectedValue(new Error('Pegá el enlace de Airbnb que termina en .ics'))
    await expect(e.agregarCalendario('estadia', { id: 'tmp', unidadId: 'p1', nombre: '', url: 'https://otro.sitio/a.ics', ultimaSync: '2026-11-23' }, [])).rejects.toThrow(/enlace de Airbnb/)
    expect(recargar).not.toHaveBeenCalled()
  })
})
