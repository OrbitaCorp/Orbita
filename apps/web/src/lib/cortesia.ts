import type { ApiSubscription } from '@/lib/api'

// Mismos 3 días que CORTESIA_VENTANA_PAGO_DIAS en subscriptions.service.ts.
export const CORTESIA_VENTANA_PAGO_DIAS = 3

const DIA_MS = 86_400_000
const HORA_MS = 3_600_000
// Cortesías técnicas sin vencimiento práctico (ej. la demo pública a +20 años).
const MAX_DIAS_CONTADOR = 3650

const PLANES_REALES = new Set([
    'mensual', 'semestral', 'anual', 'mensualAvanzado', 'semestralAvanzado', 'anualAvanzado',
])

export type EstadoCortesia = {
    esCortesia: boolean
    mostrarContador: boolean
    vencida: boolean
    porVencer: boolean
    puedePagar: boolean
    tienePlanElegido: boolean
    msRestantes: number
    tiempoRestante: string
}

export function estadoCortesiaDe(sub: ApiSubscription | null, ahoraMs = Date.now()): EstadoCortesia | null {
    if (!sub || sub.origin !== 'COMP') return null
    const cancelada = sub.status === 'CANCELLED'
    const finMs = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0
    const msRestantes = finMs - ahoraMs
    const vencida = finMs <= ahoraMs
    const dias = msRestantes > 0 ? Math.ceil(msRestantes / DIA_MS) : 0
    const porVencer = !cancelada && !vencida && msRestantes <= CORTESIA_VENTANA_PAGO_DIAS * DIA_MS
    const mostrarContador = !cancelada && !!sub.currentPeriodEnd && dias <= MAX_DIAS_CONTADOR
    const horas = msRestantes > 0 && msRestantes < DIA_MS ? Math.max(1, Math.ceil(msRestantes / HORA_MS)) : 0
    const tiempoRestante = vencida
        ? 'vencida'
        : msRestantes < DIA_MS
            ? `${horas} ${horas === 1 ? 'hora' : 'horas'}`
            : `${dias} ${dias === 1 ? 'día' : 'días'}`

    return {
        esCortesia: true,
        mostrarContador,
        vencida,
        porVencer,
        puedePagar: !cancelada && (vencida || porVencer),
        tienePlanElegido: PLANES_REALES.has(sub.nextPlan ?? sub.plan),
        msRestantes,
        tiempoRestante,
    }
}

export const EVENTO_SUSCRIPCION_ACTUALIZADA = 'orbita:subscription-updated'

export function notificarSuscripcionActualizada() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(EVENTO_SUSCRIPCION_ACTUALIZADA))
    }
}
