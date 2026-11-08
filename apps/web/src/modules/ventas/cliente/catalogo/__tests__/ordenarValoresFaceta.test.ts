import { describe, expect, it } from 'vitest'
import { ordenarValoresFaceta } from '../Catalogo'

const v = (...xs: string[]) => xs.map(value => ({ value }))

describe('ordenarValoresFaceta', () => {
  it('ordena de menor a mayor cuando todos los valores son números (ml)', () => {
    expect(ordenarValoresFaceta(v('60 ml', '100 ml', '50 ml', '7,5 ml')).map(x => x.value)).toEqual(['7,5 ml', '50 ml', '60 ml', '100 ml'])
  })
  it('deja como vienen los talles con letras o los colores', () => {
    expect(ordenarValoresFaceta(v('S', 'M', 'L', 'XL')).map(x => x.value)).toEqual(['S', 'M', 'L', 'XL'])
    expect(ordenarValoresFaceta(v('38', 'Único')).map(x => x.value)).toEqual(['38', 'Único'])
  })
})
