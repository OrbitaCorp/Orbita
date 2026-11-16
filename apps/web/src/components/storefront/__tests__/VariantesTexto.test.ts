import { describe, expect, it } from 'vitest'
import { textoVariantes } from '../VariantesTexto'

const contenido = { name: 'Contenido', isVisual: false, values: [{ value: '50 ml' }, { value: '100 ml' }] }
const color = { name: 'Color', isVisual: true, values: [{ value: 'Rojo' }, { value: 'Azul' }] }

describe('textoVariantes (lo que muestran las tarjetas)', () => {
  it('lista los valores de la primera opción que se puede elegir', () => {
    expect(textoVariantes([contenido])).toEqual({ nombre: 'Contenido', texto: '50 ml · 100 ml' })
  })

  it('una opción con un solo valor no es una elección: no muestra nada', () => {
    expect(textoVariantes([{ ...contenido, values: [{ value: '100 ml' }] }])).toBeNull()
    expect(textoVariantes([])).toBeNull()
    expect(textoVariantes(undefined)).toBeNull()
  })

  it('en la tarjeta real los colores ya van como círculos: sinVisuales los saltea', () => {
    expect(textoVariantes([color, contenido], true)?.texto).toBe('50 ml · 100 ml')
    expect(textoVariantes([color], true)).toBeNull()
    expect(textoVariantes([color, contenido])?.texto).toBe('Rojo · Azul')
  })
})
