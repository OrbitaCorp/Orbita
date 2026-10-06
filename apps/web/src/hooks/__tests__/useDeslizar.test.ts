import { describe, expect, it } from 'vitest'
import { direccionDelGesto, DISTANCIA_MINIMA } from '../useDeslizar'

describe('direccionDelGesto', () => {
    it('arrastrar hacia la izquierda pasa al siguiente; hacia la derecha, al anterior', () => {
        expect(direccionDelGesto(-120, 0)).toBe(1)
        expect(direccionDelGesto(120, 0)).toBe(-1)
    })

    it('un toque o un arrastre corto no cuenta', () => {
        expect(direccionDelGesto(0, 0)).toBe(0)
        expect(direccionDelGesto(DISTANCIA_MINIMA - 1, 0)).toBe(0)
        expect(direccionDelGesto(-(DISTANCIA_MINIMA - 1), 0)).toBe(0)
    })

    it('un scroll vertical que se desvía un poco hacia el costado no cambia el slide', () => {
        expect(direccionDelGesto(-60, 140)).toBe(0)
        expect(direccionDelGesto(60, -90)).toBe(0)
    })

    it('un gesto diagonal pero claramente más horizontal sí cuenta', () => {
        expect(direccionDelGesto(-130, 40)).toBe(1)
    })
})
