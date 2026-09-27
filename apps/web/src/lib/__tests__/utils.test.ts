import { describe, expect, it } from 'vitest'
import { formatMiles, fmtMoney } from '../utils'

describe('formatMiles', () => {
    it('retorna string vacío ante valores nulos, indefinidos o vacíos', () => {
        expect(formatMiles('')).toBe('')
        expect(formatMiles(null)).toBe('')
        expect(formatMiles(undefined)).toBe('')
    })

    it('formatea números sin separador cuando tienen menos de 4 dígitos', () => {
        expect(formatMiles('0')).toBe('0')
        expect(formatMiles('5')).toBe('5')
        expect(formatMiles('50')).toBe('50')
        expect(formatMiles('500')).toBe('500')
    })

    it('aplica separador de miles con punto', () => {
        expect(formatMiles('1000')).toBe('1.000')
        expect(formatMiles('15000')).toBe('15.000')
        expect(formatMiles('150000')).toBe('150.000')
        expect(formatMiles('1500000')).toBe('1.500.000')
        expect(formatMiles('15000000')).toBe('15.000.000')
    })

    it('funciona también si se le pasa un number', () => {
        expect(formatMiles(0)).toBe('0')
        expect(formatMiles(1200)).toBe('1.200')
        expect(formatMiles(850000)).toBe('850.000')
    })

    it('elimina ceros no significativos a la izquierda pero preserva el cero solo', () => {
        expect(formatMiles('00')).toBe('0')
        expect(formatMiles('000')).toBe('0')
        expect(formatMiles('05')).toBe('5')
        expect(formatMiles('00500')).toBe('500')
        expect(formatMiles('015000')).toBe('15.000')
    })

    it('limpia caracteres no numéricos o símbolos de moneda ya existentes', () => {
        expect(formatMiles('$15000')).toBe('15.000')
        expect(formatMiles('$ 15.000')).toBe('15.000')
        expect(formatMiles('15.000.000')).toBe('15.000.000')
    })
})

describe('fmtMoney', () => {
    it('formatea montos con signo $ y punto de miles', () => {
        expect(fmtMoney(1200)).toBe('$1.200')
        expect(fmtMoney(124300)).toBe('$124.300')
    })
})
