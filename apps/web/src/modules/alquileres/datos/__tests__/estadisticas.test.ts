import { describe, expect, it } from 'vitest'
import { estadiaDelBloqueo, estadisticasDeEstadia } from '../estadisticas'
import type { Bloqueo, IngresoExterno, NegocioAlquiler, Reserva } from '../index'

// Las cuentas de las Estadísticas de la estadía. Dos propiedades (p1 y p2),
// diciembre de 2026 entero y hoy el 31, salvo que el test diga otra cosa: 31
// noches por propiedad.

const DESDE = '2026-12-01'
const HASTA = '2026-12-31'

const propiedades = [{ id: 'p1', nombre: 'Cabaña del Monte' }, { id: 'p2', nombre: 'Depto Centro' }] as NegocioAlquiler['propiedades']
const reserva = (id: string, entrada: string, salida: string, total: number, over: Partial<Reserva> = {}): Reserva =>
  ({ id, unidadId: 'p1', clienteId: 'k1', estado: 'confirmada', creada: '2026-11-20', entrada, salida, total, sena: 0, extras: [], senaPagada: false, saldoPagado: false, ...over }) as Reserva
const bloqueo = (id: string, desde: string, hasta: string, over: Partial<Bloqueo> = {}): Bloqueo => ({ id, unidadId: 'p1', desde, hasta, motivo: 'x', origen: 'dueno', ...over })
const deAirbnb = (codigo: string, entrada: string, salida: string, neto: number, over: Partial<IngresoExterno> = {}): IngresoExterno =>
  ({ id: codigo, unidadId: 'p1', canal: 'airbnb', codigo, entrada, salida, noches: 0, neto, bruto: neto, comision: 0, moneda: 'ARS', ...over })

const calcular = (o: { reservas?: Reserva[]; bloqueos?: Bloqueo[]; externos?: IngresoExterno[]; hoy?: string; desde?: string; hasta?: string } = {}) =>
  estadisticasDeEstadia({ propiedades, bloqueos: o.bloqueos ?? [], ingresosExternos: o.externos ?? [] }, o.reservas ?? [], o.desde ?? DESDE, o.hasta ?? HASTA, o.hoy ?? HASTA)

describe('estadisticasDeEstadia · ocupación', () => {
  it('noches ocupadas sobre disponibles, sin contar lo que bloqueó el dueño', () => {
    const e = calcular({ reservas: [reserva('r1', '2026-12-10', '2026-12-15', 250000)], bloqueos: [bloqueo('b1', '2026-12-20', '2026-12-22')] })
    expect(e.nochesDisponibles).toBe(60)
    expect(e.nochesOcupadas).toBe(5)
    expect(e.ocupacion).toBeCloseTo(5 / 60)
  })

  it('lo que el dueño cerró a mano en Airbnb tampoco es disponible, ni es ocupación', () => {
    const e = calcular({ bloqueos: [bloqueo('b1', '2026-12-20', '2026-12-22', { origen: 'ical', externoTipo: 'CERRADO' })] })
    expect(e.nochesDisponibles).toBe(60)
    expect(e.nochesOcupadas).toBe(0)
  })

  it('una noche bloqueada que además está ocupada sigue siendo disponible y ocupada', () => {
    const e = calcular({ reservas: [reserva('r1', '2026-12-20', '2026-12-22', 100000)], bloqueos: [bloqueo('b1', '2026-12-20', '2026-12-22', { origen: 'ical', externoTipo: 'CERRADO' })] })
    expect(e.nochesDisponibles).toBe(62)
    expect(e.nochesOcupadas).toBe(2)
  })

  it('todo mira hasta hoy, y lo que falta del período va aparte', () => {
    const e = calcular({ reservas: [reserva('r1', '2026-12-10', '2026-12-15', 250000)], hoy: '2026-12-10' })
    expect(e.nochesDisponibles).toBe(20)
    expect(e.nochesOcupadas).toBe(1)
    expect(e.ingresos).toBeCloseTo(50000)
    expect(e.porVenir.noches).toBe(4)
    expect(e.porVenir.ingresos).toBeCloseTo(200000)
  })

  it('un período que ya terminó no tiene nada por venir, y uno que todavía no empezó no tiene nada', () => {
    expect(calcular({ reservas: [reserva('r1', '2026-12-10', '2026-12-15', 250000)], hoy: '2027-01-20' }).porVenir).toEqual({ ingresos: 0, noches: 0 })
    const futuro = calcular({ reservas: [reserva('r1', '2026-12-10', '2026-12-15', 250000)], hoy: '2026-11-20' })
    expect(futuro).toMatchObject({ nochesDisponibles: 0, nochesOcupadas: 0, ocupacion: 0, ingresos: 0, precioPorNoche: null, ingresoPorNocheDisponible: null })
    expect(futuro.porVenir).toEqual({ ingresos: 250000, noches: 5 })
  })

  it('una noche que está por dos lados cuenta una vez', () => {
    const e = calcular({
      bloqueos: [bloqueo('b1', '2026-12-10', '2026-12-15', { origen: 'ical', externoTipo: 'RESERVADO' })],
      externos: [deAirbnb('HM1', '2026-12-10', '2026-12-15', 400000)],
    })
    expect(e.nochesOcupadas).toBe(5)
  })

  it('las noches de una estadía importada cuentan aunque no haya bloqueo, y las de un bloqueo de Airbnb aunque no se haya importado', () => {
    expect(calcular({ externos: [deAirbnb('HM1', '2026-12-10', '2026-12-15', 400000)] }).nochesOcupadas).toBe(5)
    expect(calcular({ bloqueos: [bloqueo('b1', '2026-12-10', '2026-12-15', { origen: 'ical', externoTipo: 'RESERVADO' })] }).nochesOcupadas).toBe(5)
    // Un bloqueo de Airbnb de antes de que el panel supiera el tipo se toma como una reserva.
    expect(calcular({ bloqueos: [bloqueo('b1', '2026-12-10', '2026-12-15', { origen: 'ical' })] }).nochesOcupadas).toBe(5)
  })
})

describe('estadisticasDeEstadia · plata', () => {
  it('ingresos por canal, con la plata repartida por noche en el borde del período', () => {
    const e = calcular({
      reservas: [
        reserva('directa', '2026-12-10', '2026-12-12', 100000, { canal: 'directo' }),
        reserva('delSitio', '2026-12-12', '2026-12-13', 50000, { canal: 'sitio', unidadId: 'p2' }),
        reserva('deNoviembre', '2026-11-28', '2026-12-02', 80000),
      ],
      externos: [deAirbnb('HM1', '2026-12-20', '2026-12-27', 580000)],
    })
    expect(e.ingresos).toBeCloseTo(750000)
    expect(e.porCanal.directo.estadias).toBe(2)
    expect(e.porCanal.directo.ingresos).toBeCloseTo(120000)
    expect(e.porCanal.sitio).toEqual({ estadias: 1, ingresos: 50000 })
    expect(e.porCanal.airbnb).toEqual({ estadias: 1, ingresos: 580000 })
  })

  it('pesos y dólares no se suman: lo que no es ARS va aparte y no entra en los promedios', () => {
    const e = calcular({
      reservas: [reserva('r1', '2026-12-10', '2026-12-12', 100000)],
      externos: [deAirbnb('HM2', '2026-12-15', '2026-12-18', 300, { moneda: 'USD' })],
    })
    expect(e.ingresos).toBe(100000)
    expect(e.otrasMonedas).toEqual([{ moneda: 'USD', neto: 300, estadias: 1 }])
    expect(e.precioPorNoche).toBe(50000)
    expect(e.porCanal.airbnb).toEqual({ estadias: 1, ingresos: 0 })
    expect(e.nochesOcupadas).toBe(5)
    expect(e.nochesVendidas).toBe(2)
  })

  it('precio por noche, ingreso por noche disponible, estadía promedio y anticipación', () => {
    const e = calcular({ reservas: [
      reserva('A', '2026-12-10', '2026-12-15', 250000, { creada: '2026-12-01' }),
      reserva('B', '2026-12-20', '2026-12-23', 150000, { creada: '2026-12-05', unidadId: 'p2' }),
    ] })
    expect(e.nochesVendidas).toBe(8)
    expect(e.precioPorNoche).toBe(50000)
    expect(e.ingresoPorNocheDisponible).toBeCloseTo(400000 / 62)
    expect(e.estadiaPromedio).toBe(4)
    expect(e.anticipacionPromedio).toBe(12)
  })

  it('la anticipación es solo de las reservas propias; la estadía promedio cuenta también las de Airbnb', () => {
    const e = calcular({ reservas: [reserva('A', '2026-12-10', '2026-12-12', 100000, { creada: '2026-12-01' })], externos: [deAirbnb('HM1', '2026-12-20', '2026-12-26', 300000)] })
    expect(e.anticipacionPromedio).toBe(9)
    expect(e.estadiaPromedio).toBe(4)
  })

  it('sin nada en el período no inventa promedios', () => {
    const e = calcular()
    expect(e).toMatchObject({ ocupacion: 0, ingresos: 0, nochesVendidas: 0, precioPorNoche: null, estadiaPromedio: null, anticipacionPromedio: null, otrasMonedas: [], cruces: [] })
    expect(e.ingresoPorNocheDisponible).toBe(0)
  })

  it('por propiedad: cada una con sus noches, su ocupación, sus ingresos y su precio por noche', () => {
    const e = calcular({
      reservas: [reserva('A', '2026-12-10', '2026-12-15', 250000)],
      externos: [deAirbnb('HM1', '2026-12-20', '2026-12-22', 90000, { unidadId: 'p2' })],
      bloqueos: [bloqueo('b1', '2026-12-01', '2026-12-02', { unidadId: 'p2' })],
    })
    expect(e.porPropiedad).toEqual([
      { unidadId: 'p1', nombre: 'Cabaña del Monte', nochesDisponibles: 31, nochesOcupadas: 5, ocupacion: 5 / 31, ingresos: 250000, precioPorNoche: 50000 },
      { unidadId: 'p2', nombre: 'Depto Centro', nochesDisponibles: 30, nochesOcupadas: 2, ocupacion: 2 / 30, ingresos: 90000, precioPorNoche: 45000 },
    ])
  })

  it('una pendiente o cancelada no cuenta, ni una importada con neto en cero (una devolución)', () => {
    const e = calcular({
      reservas: [reserva('p', '2026-12-10', '2026-12-12', 100000, { estado: 'pendiente' }), reserva('c', '2026-12-14', '2026-12-16', 100000, { estado: 'cancelada' }), reserva('ok', '2026-12-18', '2026-12-19', 40000, { estado: 'completada' })],
      externos: [deAirbnb('DEVUELTA', '2026-12-20', '2026-12-25', 0), deAirbnb('NEGATIVA', '2026-12-26', '2026-12-28', -500)],
    })
    expect(e.nochesOcupadas).toBe(1)
    expect(e.ingresos).toBe(40000)
    expect(e.porCanal.airbnb).toEqual({ estadias: 0, ingresos: 0 })
  })
})

describe('estadisticasDeEstadia · cruces', () => {
  it('una estadía importada que pisa una reserva propia es un cruce, y sus noches cuentan una vez', () => {
    const e = calcular({ reservas: [reserva('r1', '2026-12-10', '2026-12-15', 250000)], externos: [deAirbnb('HM1', '2026-12-12', '2026-12-14', 120000)] })
    expect(e.nochesOcupadas).toBe(5)
    expect(e.cruces).toEqual([{ codigo: 'HM1', unidadId: 'p1', entrada: '2026-12-12', salida: '2026-12-14', reservaId: 'r1' }])
  })

  it('dos estadías que se tocan (una sale el día que entra la otra) no son un cruce, ni una en otra propiedad', () => {
    expect(calcular({ reservas: [reserva('r1', '2026-12-10', '2026-12-15', 1)], externos: [deAirbnb('HM1', '2026-12-15', '2026-12-17', 1)] }).cruces).toEqual([])
    expect(calcular({ reservas: [reserva('r1', '2026-12-10', '2026-12-15', 1)], externos: [deAirbnb('HM1', '2026-12-12', '2026-12-14', 1, { unidadId: 'p2' })] }).cruces).toEqual([])
  })
})

describe('estadiaDelBloqueo', () => {
  const externos = [deAirbnb('HM1', '2026-12-10', '2026-12-15', 400000), deAirbnb('HM2', '2026-12-10', '2026-12-15', 1, { unidadId: 'p2' })]

  it('la importada de la misma propiedad y las mismas fechas; si no hay, undefined', () => {
    expect(estadiaDelBloqueo(bloqueo('b1', '2026-12-10', '2026-12-15', { origen: 'ical' }), externos)?.codigo).toBe('HM1')
    expect(estadiaDelBloqueo(bloqueo('b1', '2026-12-10', '2026-12-16', { origen: 'ical' }), externos)).toBeUndefined()
    expect(estadiaDelBloqueo(bloqueo('b1', '2026-12-10', '2026-12-15', { origen: 'ical' }), undefined)).toBeUndefined()
  })

  it('un bloqueo del dueño nunca es una estadía de Airbnb', () => {
    expect(estadiaDelBloqueo(bloqueo('b1', '2026-12-10', '2026-12-15'), externos)).toBeUndefined()
  })
})
