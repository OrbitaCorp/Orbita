import { describe, expect, it } from 'vitest'
import type { ApiSubscription } from '@/lib/api'
import { CORTESIA_VENTANA_PAGO_DIAS, estadoCortesiaDe } from '../cortesia'

const DIA = 86_400_000
const HORA = 3_600_000

const baseSub = (extra: Partial<ApiSubscription> = {}): ApiSubscription => ({
    id: 'sub-1',
    plan: 'standard',
    nextPlan: null,
    origin: 'COMP',
    status: 'ACTIVE',
    planActive: false,
    amount: 0,
    currency: 'ARS',
    currentPeriodStart: new Date(0).toISOString(),
    currentPeriodEnd: new Date(5 * DIA).toISOString(),
    gracePeriodDays: 7,
    grantReason: null,
    frozen: null,
    ...extra,
})

describe('estadoCortesiaDe', () => {
    it('devuelve null si no es cuenta de cortesía', () => {
        expect(estadoCortesiaDe(baseSub({ origin: 'PAID' }))).toBeNull()
        expect(estadoCortesiaDe(null)).toBeNull()
    })

    it('muestra días restantes sin habilitar pago cuando faltan más de 3 días', () => {
        const ahora = 0
        const r = estadoCortesiaDe(baseSub({ currentPeriodEnd: new Date((CORTESIA_VENTANA_PAGO_DIAS + 3) * DIA).toISOString() }), ahora)!
        expect(r.mostrarContador).toBe(true)
        expect(r.porVencer).toBe(false)
        expect(r.puedePagar).toBe(false)
        expect(r.tiempoRestante).toBe('6 días')
        expect(r.tienePlanElegido).toBe(false)
    })

    it('cambia a porVencer y habilita pago dentro de los últimos 3 días', () => {
        const ahora = 0
        const r = estadoCortesiaDe(baseSub({ currentPeriodEnd: new Date(2 * DIA).toISOString(), nextPlan: 'mensual' }), ahora)!
        expect(r.porVencer).toBe(true)
        expect(r.vencida).toBe(false)
        expect(r.puedePagar).toBe(true)
        expect(r.tienePlanElegido).toBe(true)
        expect(r.tiempoRestante).toBe('2 días')
    })

    it('muestra horas cuando falta menos de un día', () => {
        const r = estadoCortesiaDe(baseSub({ currentPeriodEnd: new Date(5 * HORA).toISOString() }), 0)!
        expect(r.porVencer).toBe(true)
        expect(r.tiempoRestante).toBe('5 horas')
    })

    it('marca vencida cuando ya pasó currentPeriodEnd', () => {
        const r = estadoCortesiaDe(baseSub({ currentPeriodEnd: new Date(-DIA).toISOString(), status: 'PAST_DUE' }), 0)!
        expect(r.vencida).toBe(true)
        expect(r.porVencer).toBe(false)
        expect(r.puedePagar).toBe(true)
        expect(r.tiempoRestante).toBe('vencida')
    })

    it('oculta el contador para cortesías técnicas a +20 años (demo)', () => {
        const r = estadoCortesiaDe(baseSub({ currentPeriodEnd: new Date(7300 * DIA).toISOString() }), 0)!
        expect(r.mostrarContador).toBe(false)
        expect(r.porVencer).toBe(false)
    })
})
