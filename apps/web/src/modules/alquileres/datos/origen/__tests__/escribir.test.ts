import { describe, expect, it } from 'vitest'
import type { Reserva as ReservaApi } from '@/lib/reservasApi/tipos'
import { NEGOCIOS_DEMO, type Bloqueo, type Propiedad, type Reserva } from '../../index'
import { bloqueoParaApi, calendarioParaApi, cambiosDePropiedades, configDeCambio, idDeBloqueo, pasosDeCambio, pedidoDeReserva, pedidoDelSitio, recursoDePropiedad } from '../escribir'
import { propiedadDeApi } from '../mapear'

const PROP: Propiedad = { ...NEGOCIOS_DEMO.estadia.propiedades[0], id: 'p1', nombre: 'Cabaña Arrayán', modalidad: 'noche', checkIn: 900, checkOut: 600, tarifa: { precioNoche: 85000, temporadas: [], finDeSemanaPct: 0, limpieza: 0, minNoches: 2 } }

const api = (r: Partial<ReservaApi>): ReservaApi => ({ id: 'x', estado: 'PENDIENTE', precio: 100000, sena: 30000, pagado: 0, ...r }) as ReservaApi

describe('recursoDePropiedad', () => {
  it('arma el recurso ALOJAMIENTO con lo que el servidor usa para reservar y lo descriptivo en datos', () => {
    const r = recursoDePropiedad(PROP, 2)
    expect(r).toMatchObject({ modulo: 'ALQUILERES', tipo: 'ALOJAMIENTO', nombre: 'Cabaña Arrayán', cupo: 1, precio: 85000, orden: 2, activo: true })
    expect(r.datos).toMatchObject({ checkIn: 900, checkOut: 600, nochesMinimas: 2, tipo: PROP.tipo, huespedes: PROP.huespedes, fotos: PROP.fotos, modalidad: 'noche' })
  })
  it('ida y vuelta: lo que se guarda se lee igual', () => {
    const r = recursoDePropiedad(PROP, 0)
    const vuelta = propiedadDeApi({ id: 'p1', modulo: 'ALQUILERES', tipo: 'ALOJAMIENTO', nombre: r.nombre, descripcion: r.descripcion ?? null, cupo: 1, duracionMinutos: null, pasoMinutos: null, margenMinutos: null, maximoSeguidos: 1, precio: r.precio ?? 0, horario: null, datos: r.datos ?? null, orden: 0, activo: true })
    expect(vuelta).toEqual({ ...PROP, mensual: undefined })
  })
})

describe('cambiosDePropiedades', () => {
  it('separa las nuevas, las que cambiaron y las que se quitaron', () => {
    const a = { ...PROP, id: 'a' }, b = { ...PROP, id: 'b' }, c = { ...PROP, id: 'c' }
    const d = cambiosDePropiedades([a, b, c], [a, { ...b, nombre: 'Otro nombre' }, { ...PROP, id: 'nueva' }])
    expect(d.crear.map(p => p.id)).toEqual(['nueva'])
    expect(d.editar.map(p => p.id)).toEqual(['b'])
    expect(d.borrar).toEqual(['c'])
  })
  it('sin cambios no hace nada', () => {
    expect(cambiosDePropiedades([PROP], [{ ...PROP }])).toEqual({ crear: [], editar: [], borrar: [] })
  })
})

describe('configDeCambio', () => {
  it('traduce el plazo de cancelación, la seña y si se devuelve', () => {
    expect(configDeCambio({ cancelaHastaHoras: 72 })).toEqual({ modulo: 'ALQUILERES', cancelacionHastaHoras: 72, reprogramacionHastaHoras: 72 })
    expect(configDeCambio({ senaPct: 40, pagos: { ...NEGOCIOS_DEMO.estadia.pagos, cancelaATiempo: 'credito' } })).toEqual({ modulo: 'ALQUILERES', senaPorcentaje: 40, senaReembolsable: false })
  })
  it('lo que no es de la config no genera ningún pedido', () => {
    expect(configDeCambio({ nombre: 'Otro' })).toBeNull()
    expect(configDeCambio({ propiedades: [] })).toBeNull()
  })
})

describe('pedidoDeReserva', () => {
  const r: Reserva = { id: 'n1', unidadId: 'p1', clienteId: 'k', estado: 'pendiente', creada: '2026-11-23', entrada: '2026-12-04', salida: '2026-12-07', huespedes: 3, extras: [], total: 255000, sena: 76500, senaPagada: false, saldoPagado: false, nota: 'Llegan tarde' }
  it('una estadía va con entrada, salida, el cliente, la nota y cuántos vienen; el precio lo pone el servidor', () => {
    const p = pedidoDeReserva(r, { id: 'k', nombre: 'Ana Ríos', telefono: '3757 55-0101', email: 'ana@ejemplo.com' })
    expect(p).toEqual({ modulo: 'ALQUILERES', recursoId: 'p1', fecha: '2026-12-04', fechaHasta: '2026-12-07', cliente: { nombre: 'Ana Ríos', telefono: '3757 55-0101', email: 'ana@ejemplo.com' }, notaInterna: 'Llegan tarde', datos: { huespedes: 3 }, estado: 'PENDIENTE' })
    expect(p).not.toHaveProperty('precio')
  })
  it('si ya pagó la seña nace confirmada', () => {
    expect(pedidoDeReserva({ ...r, estado: 'confirmada', senaPagada: true }, { id: 'k', nombre: 'Ana', telefono: '' }).estado).toBe('CONFIRMADA')
  })
  it('una cancha o un salón todavía no se guardan desde el panel real', () => {
    expect(() => pedidoDeReserva({ ...r, entrada: undefined, salida: undefined, fecha: '2026-12-04', inicio: 600, fin: 660 }, { id: 'k', nombre: 'Ana', telefono: '' })).toThrow(/estadías/)
  })
})

describe('pasosDeCambio', () => {
  it('registrar la seña: se anota el pago y se confirma', () => {
    expect(pasosDeCambio(api({}), { estado: 'confirmada', senaPagada: true })).toEqual([{ tipo: 'pago', monto: 30000 }, { tipo: 'confirmar' }])
  })
  it('registrar el saldo: lo que falta para llegar al total', () => {
    expect(pasosDeCambio(api({ estado: 'CONFIRMADA', pagado: 30000 }), { saldoPagado: true })).toEqual([{ tipo: 'pago', monto: 70000 }])
  })
  it('marcar realizada cobrando el saldo, o dejándolo pendiente', () => {
    expect(pasosDeCambio(api({ estado: 'CONFIRMADA', pagado: 30000 }), { estado: 'completada', saldoPagado: true })).toEqual([{ tipo: 'pago', monto: 70000 }, { tipo: 'completar' }])
    expect(pasosDeCambio(api({ estado: 'CONFIRMADA', pagado: 30000 }), { estado: 'completada' })).toEqual([{ tipo: 'completar' }])
  })
  it('cancelar es un solo paso, y no se paga dos veces lo ya pagado', () => {
    expect(pasosDeCambio(api({ estado: 'CONFIRMADA' }), { estado: 'cancelada' })).toEqual([{ tipo: 'cancelar' }])
    expect(pasosDeCambio(api({ estado: 'CONFIRMADA', pagado: 100000 }), { saldoPagado: true })).toEqual([])
  })
})

describe('bloqueos', () => {
  const b: Bloqueo = { id: 'bl1', unidadId: 'p1', desde: '2026-12-10', hasta: '2026-12-14', motivo: 'Arreglo del techo', origen: 'dueno' }
  it('un bloqueo de fechas ocupa lo mismo que una estadía: de la entrada a la salida', () => {
    expect(bloqueoParaApi(b, PROP)).toEqual({ modulo: 'ALQUILERES', recursoId: 'p1', fechaDesde: '2026-12-10', minutoDesde: 900, fechaHasta: '2026-12-14', minutoHasta: 600, motivo: 'Arreglo del techo' })
  })
  it('el id que muestra el panel vuelve al id del bloqueo de la API', () => {
    expect(idDeBloqueo('abc-123')).toBe('abc-123')
    expect(idDeBloqueo('abc-123:p1')).toBe('abc-123')
  })
})

describe('pedidoDelSitio', () => {
  const base = { propiedadId: 'p1', entrada: '2026-12-10', salida: '2026-12-13', nombre: '  Ana Ríos ', telefono: ' 0000 55-0101 ', email: '', notas: '', huespedes: 3, clave: 'k-1' }

  it('pide las noches con la clave del intento y sin precio: lo calcula el servidor', () => {
    const p = pedidoDelSitio(base)
    expect(p).toEqual({ modulo: 'ALQUILERES', recursoId: 'p1', fecha: '2026-12-10', fechaHasta: '2026-12-13', clave: 'k-1', cliente: { nombre: 'Ana Ríos', telefono: '0000 55-0101' }, datos: { huespedes: 3, canal: 'sitio' } })
    expect(p).not.toHaveProperty('precio')
  })
  it('manda el email y la nota solo si los escribieron; los huéspedes van aparte', () => {
    const p = pedidoDelSitio({ ...base, email: ' ana@example.com ', notas: ' Llegamos tarde ', huespedes: 1 })
    expect(p.cliente).toEqual({ nombre: 'Ana Ríos', telefono: '0000 55-0101', email: 'ana@example.com' })
    expect(p.notas).toBe('Llegamos tarde')
    expect(p.datos).toEqual({ huespedes: 1, canal: 'sitio' })
  })
})

describe('configDeCambio: lo que el sitio muestra para coordinar la seña', () => {
  const pagos = NEGOCIOS_DEMO.estadia.pagos
  const actual = { negocio: { telefono: '', pagos: { ...pagos, alias: '', titular: '' } }, datos: null }

  it('el alias, el titular y el WhatsApp van a datos.publico, recortados', () => {
    const c = configDeCambio({ telefono: ' 0000 15-0000 ', pagos: { ...pagos, alias: ' monte.cabanas ', titular: 'Monte SRL' } }, actual)
    expect(c?.datos).toEqual({ publico: { alias: 'monte.cabanas', titular: 'Monte SRL', telefono: '0000 15-0000' } })
  })
  it('conserva lo demás que tenga guardado la config, adentro y afuera de publico', () => {
    const guardado = { mensajes: { confirmada: 'Hola' }, publico: { alias: 'viejo', horario: 'de 9 a 18' } }
    const c = configDeCambio({ pagos: { ...pagos, alias: 'nuevo', titular: '' } }, { negocio: { telefono: '0000 15-0000', pagos: { ...pagos, alias: 'viejo', titular: '' } }, datos: guardado })
    expect(c?.datos).toEqual({ mensajes: { confirmada: 'Hola' }, publico: { alias: 'nuevo', titular: '', telefono: '0000 15-0000', horario: 'de 9 a 18' } })
  })
  it('si nada de eso cambió, no manda datos (un cambio de seña no los pisa)', () => {
    const c = configDeCambio({ senaPct: 40, pagos: { ...pagos, alias: '', titular: '' } }, actual)
    expect(c).not.toHaveProperty('datos')
    expect(c).toMatchObject({ senaPorcentaje: 40 })
  })
  it('sin saber qué hay guardado no toca datos', () => {
    expect(configDeCambio({ telefono: '0000 15-0000' })).toBeNull()
  })
})

describe('calendarioParaApi', () => {
  it('conecta el enlace a la propiedad, con su nombre', () => {
    expect(calendarioParaApi({ id: 'tmp', unidadId: 'p1', nombre: ' Airbnb ', url: ' https://www.airbnb.com/calendar/ical/1.ics?s=a ', ultimaSync: '2026-11-25' }))
      .toEqual({ modulo: 'ALQUILERES', recursoId: 'p1', nombre: 'Airbnb', url: 'https://www.airbnb.com/calendar/ical/1.ics?s=a' })
  })
  it('sin nombre no manda nombre: el servidor lo llama "Airbnb"', () => {
    expect(calendarioParaApi({ id: 'tmp', unidadId: 'p1', nombre: '  ', url: 'https://www.airbnb.com/calendar/ical/1.ics', ultimaSync: '2026-11-25' })).not.toHaveProperty('nombre')
  })
})
