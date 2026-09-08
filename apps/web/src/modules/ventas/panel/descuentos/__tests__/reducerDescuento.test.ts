import { describe, expect, it } from 'vitest'
import { initialDescuentoState, reducerDescuento, validarDescuentoForm } from '../reducerDescuento'
import type { DescuentoFormState } from '../reducerDescuento'

// Un "ahora" fijo para que las pruebas no dependan del reloj de la máquina:
// 8 de septiembre de 2026, 15:00 hora local.
const AHORA = new Date(2026, 8, 8, 15, 0).getTime()

function estado(over: Partial<DescuentoFormState> = {}): DescuentoFormState {
  return {
    ...initialDescuentoState,
    nombre: 'Cyber Week',
    tipo: 'oferta_relampago',
    valor: '40',
    alcance: 'producto',
    productosIds: ['p1'],
    fechaInicio: '2026-09-08',
    fechaFin: '2026-09-12',
    horaFinRelampago: '23:59',
    sinVencimiento: false,
    ...over,
  }
}

describe('reducerDescuento — tipo "Oferta relámpago"', () => {
  it('elegir el tipo apaga "Sin vencimiento": una oferta relámpago siempre termina', () => {
    const s = reducerDescuento({ ...initialDescuentoState, sinVencimiento: true }, { type: 'SET_TIPO', tipo: 'oferta_relampago' })
    expect(s.tipo).toBe('oferta_relampago')
    expect(s.sinVencimiento).toBe(false)
    expect(s.alcance).toBe('producto')
  })

  it('cambiar a otro tipo conserva lo que había en "Sin vencimiento"', () => {
    const s = reducerDescuento({ ...initialDescuentoState, sinVencimiento: true }, { type: 'SET_TIPO', tipo: 'porcentaje_producto' })
    expect(s.sinVencimiento).toBe(true)
  })

  it('la hora de fin arranca en 23:59 y se edita como cualquier campo', () => {
    expect(initialDescuentoState.horaFinRelampago).toBe('23:59')
    const s = reducerDescuento(initialDescuentoState, { type: 'SET', key: 'horaFinRelampago', value: '20:00' })
    expect(s.horaFinRelampago).toBe('20:00')
  })
})

describe('validarDescuentoForm — tipo "Oferta relámpago"', () => {
  it('una oferta bien cargada pasa sin errores', () => {
    expect(validarDescuentoForm(estado(), false, AHORA)).toEqual({})
  })

  it('exige la fecha de fin', () => {
    const e = validarDescuentoForm(estado({ fechaFin: '' }), false, AHORA)
    expect(e.fechaFin).toMatch(/fecha/i)
  })

  it('exige la hora de fin', () => {
    const e = validarDescuentoForm(estado({ horaFinRelampago: '' }), false, AHORA)
    expect(e.horaFinRelampago).toMatch(/hora/i)
  })

  it('rechaza un fin que ya pasó, aunque sea el mismo día', () => {
    // Hoy a las 14:00, siendo las 15:00.
    const e = validarDescuentoForm(estado({ fechaFin: '2026-09-08', horaFinRelampago: '14:00' }), false, AHORA)
    expect(e.fechaFin).toMatch(/futuro/i)
  })

  it('acepta terminar HOY más tarde: "solo por hoy hasta las 20:00"', () => {
    const e = validarDescuentoForm(estado({ fechaFin: '2026-09-08', horaFinRelampago: '20:00' }), false, AHORA)
    expect(e).toEqual({})
  })

  it('rechaza un fin anterior al inicio', () => {
    const e = validarDescuentoForm(estado({ fechaInicio: '2026-09-20', fechaFin: '2026-09-12' }), true, AHORA)
    expect(e.fechaFin).toMatch(/inicio/i)
  })

  it('el porcentaje se valida como en "% Producto" (1 a 100)', () => {
    expect(validarDescuentoForm(estado({ valor: '0' }), false, AHORA).valor).toBeTruthy()
    expect(validarDescuentoForm(estado({ valor: '120' }), false, AHORA).valor).toMatch(/100/)
    expect(validarDescuentoForm(estado({ valor: '55' }), false, AHORA).valor).toBeUndefined()
  })

  it('exige al menos un producto o categoría, como cualquier descuento por alcance', () => {
    expect(validarDescuentoForm(estado({ productosIds: [] }), false, AHORA).seleccion).toBeTruthy()
    expect(validarDescuentoForm(estado({ alcance: 'categoria', categoriasIds: [] }), false, AHORA).seleccion).toBeTruthy()
  })

  it('un descuento común NO pide hora: "Sin vencimiento" sigue valiendo', () => {
    const e = validarDescuentoForm(estado({ tipo: 'porcentaje_producto', sinVencimiento: true, fechaFin: '', horaFinRelampago: '' }), false, AHORA)
    expect(e).toEqual({})
  })
})
