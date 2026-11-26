import { describe, expect, it } from 'vitest'
import { totalesTxt, unionesListas, unionesPropuestas } from '../configuracion/ganancias'

describe('importar ganancias de Airbnb: a qué propiedad va cada aviso', () => {
  it('unionesListas: con todos decididos devuelve la lista; si falta uno, undefined', () => {
    expect(unionesListas([{ nombre: 'A' }, { nombre: 'B' }], { A: 'p1', B: null })).toEqual([{ nombre: 'A', recursoId: 'p1' }, { nombre: 'B', recursoId: null }])
    expect(unionesListas([{ nombre: 'A' }, { nombre: 'B' }], { A: 'p1' })).toBeUndefined()
    expect(unionesListas([], {})).toEqual([])
  })

  it('unionesPropuestas: respeta la unión guardada; con una sola propiedad propone esa; con varias no adivina', () => {
    expect(unionesPropuestas([{ nombre: 'A', recursoId: 'p2' }], [{ id: 'p1' }, { id: 'p2' }])).toEqual({ A: 'p2' })
    expect(unionesPropuestas([{ nombre: 'A', recursoId: null }], [{ id: 'p1' }])).toEqual({ A: 'p1' })
    expect(unionesPropuestas([{ nombre: 'A', recursoId: null }], [{ id: 'p1' }, { id: 'p2' }])).toEqual({})
  })

  it('una unión guardada a una propiedad que ya no está en la lista no se propone', () => {
    expect(unionesPropuestas([{ nombre: 'A', recursoId: 'borrada' }], [{ id: 'p1' }, { id: 'p2' }])).toEqual({})
  })
})

describe('importar ganancias de Airbnb: el total de la vista previa', () => {
  it('cada moneda por separado, los pesos con su signo y lo demás con su código', () => {
    expect(totalesTxt([{ moneda: 'ARS', neto: 2340000, estadias: 12 }, { moneda: 'USD', neto: 300.5, estadias: 2 }])).toBe('$2.340.000 · USD 300,5')
    expect(totalesTxt([])).toBe('')
  })
})
