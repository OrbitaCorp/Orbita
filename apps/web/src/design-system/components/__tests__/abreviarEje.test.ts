import { describe, expect, it } from 'vitest'
import { abreviarEje } from '../Chart'

describe('abreviarEje: el eje Y del gráfico de líneas', () => {
    it('abrevia millones y miles para que el número entre entero', () => {
        expect(abreviarEje(3459996)).toBe('3,5 M')
        expect(abreviarEje(864999)).toBe('865 k')
        expect(abreviarEje(25_400_000)).toBe('25 M')
        expect(abreviarEje(950)).toBe('950')
        expect(abreviarEje(0)).toBe('0')
    })
})
