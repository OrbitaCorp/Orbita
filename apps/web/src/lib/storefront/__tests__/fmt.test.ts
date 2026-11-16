import { describe, expect, it } from 'vitest'
import { fmt } from '../utils'

describe('fmt: pesos en la tienda', () => {
    it('un monto entero va sin decimales', () => {
        expect(fmt(119999)).toBe('$ 119.999')
        expect(fmt(0)).toBe('$ 0')
    })

    it('con centavos, siempre dos decimales (nunca tres, nunca uno)', () => {
        expect(fmt(37124.325)).toMatch(/^\$ 37\.124,3\d$/)
        expect(fmt(37124.3)).toBe('$ 37.124,30')
        expect(fmt(91398.5)).toBe('$ 91.398,50')
        expect(fmt(84999.15)).toBe('$ 84.999,15')
    })

    it('si el redondeo da un entero, va sin decimales', () => {
        expect(fmt(107999.999)).toBe('$ 108.000')
    })
})
