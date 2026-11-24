// src/layouts/components/SubscriptionStatusBanner.tsx
//
// Banner persistente arriba de TODO el panel (se monta en AdminLayout, no en
// una sola vista) avisando del estado de la suscripción — antes esto era
// invisible fuera de Configuración → Suscripción (RBT — ciclo de vida de
// suscripciones, 2026-09). Mismo criterio de "gracia → suspendida" que
// Suscripcion.tsx.
//
// Nunca bloquea el render del panel: si falla la carga de la suscripción,
// simplemente no se muestra nada — el panel tiene que seguir andando igual.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { AlertTriangle, Clock } from 'lucide-react'
import { panelGetSubscription, type ApiSubscription } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { esVisitanteDemo } from '@/lib/demo/modo'
import { adminPath, currentSlug } from '@/lib/tenant'
import { estadoCortesiaDe, EVENTO_SUSCRIPCION_ACTUALIZADA } from '@/lib/cortesia'

export default function SubscriptionStatusBanner() {
    const router = useRouter()
    const { user } = useAuth()
    const [sub, setSub] = useState<ApiSubscription | null>(null)
    const puedeGestionar = user?.type === 'member' && (user.role === 'owner' || user.role === 'admin') && !esVisitanteDemo()

    useEffect(() => {
        if (!puedeGestionar) return
        let cancelado = false
        const cargar = () => {
            panelGetSubscription()
                .then(s => { if (!cancelado) setSub(s) })
                .catch(() => { /* silencioso: nunca bloquea el panel por esto */ })
        }
        cargar()
        window.addEventListener('focus', cargar)
        window.addEventListener(EVENTO_SUSCRIPCION_ACTUALIZADA, cargar)
        return () => {
            cancelado = true
            window.removeEventListener('focus', cargar)
            window.removeEventListener(EVENTO_SUSCRIPCION_ACTUALIZADA, cargar)
        }
    }, [puedeGestionar])

    // No repetir el banner adentro de la propia pantalla de Suscripción — ya
    // tiene su propio bloque con el mismo mensaje y el botón de activar.
    if (router.pathname.startsWith('/admin') && router.query.vista === 'suscripcion') return null
    if (!puedeGestionar || !sub) return null

    const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? user.business.id
    const irASuscripcion = () => router.push({ pathname: adminPath(negocioId, 'ventas', 'configuracion'), query: { vista: 'suscripcion' } })

    const cortesia = estadoCortesiaDe(sub)
    const esCortesia = !!cortesia
    const venciendo = new Date(sub.currentPeriodEnd ?? 0) <= new Date()

    // Cortesía vigente dentro de los últimos 3 días: ya puede ejecutar el pago.
    if (cortesia?.porVencer) {
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={() => void irASuscripcion()}
                onKeyDown={e => { if (e.key === 'Enter') void irASuscripcion() }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    padding: '9px 18px', cursor: 'pointer',
                    background: 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))',
                    borderBottom: '1px solid var(--color-warning, #d97706)',
                    fontSize: 12.5,
                }}
            >
                <Clock size={15} strokeWidth={2} color="var(--color-warning, #d97706)" style={{ flexShrink: 0 }} />
                <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                    Tu cortesía está a punto de vencer (te quedan <strong>{cortesia.tiempoRestante}</strong>). Ya podés ejecutar el pago de tu plan para seguir sin cortes.
                </span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-warning, #b45309)', whiteSpace: 'nowrap' }}>
                    {cortesia.tienePlanElegido ? 'Ejecutar pago →' : 'Elegí tu plan y pagá →'}
                </span>
            </div>
        )
    }

    // Cortesía vigente con más de 3 días: el contador vive en el Header en
    // escritorio; en celular (<768px) se muestra esta tira liviana.
    if (!venciendo && cortesia?.mostrarContador) {
        return (
            <>
                <style>{`
                    .admin-cortesia-banner-mobile { display: none; }
                    @media (max-width: 768px) {
                        .admin-cortesia-banner-mobile { display: flex; }
                    }
                `}</style>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => void irASuscripcion()}
                    onKeyDown={e => { if (e.key === 'Enter') void irASuscripcion() }}
                    className="admin-cortesia-banner-mobile"
                    style={{
                        alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        padding: '7px 14px', cursor: 'pointer',
                        background: 'var(--color-surface)',
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: 12,
                    }}
                >
                    <Clock size={14} strokeWidth={2} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                    <span style={{ color: 'var(--color-body)', fontWeight: 500 }}>
                        Cortesía activa · te quedan <strong style={{ color: 'var(--color-text)' }}>{cortesia.tiempoRestante}</strong>
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                        {cortesia.tienePlanElegido ? 'Ver suscripción →' : 'Elegir plan →'}
                    </span>
                </div>
            </>
        )
    }

    if (!venciendo) return null // todo al día — sin banner

    const suspendida = sub.status === 'SUSPENDED'
    const diasDeGracia = !suspendida && sub.currentPeriodEnd
        ? Math.max(Math.ceil((new Date(sub.currentPeriodEnd).getTime() + sub.gracePeriodDays * 86_400_000 - new Date().getTime()) / 86_400_000), 0)
        : null

    const mensaje = suspendida
        ? 'Tu tienda está pausada por falta de pago — el panel quedó en modo solo lectura.'
        : esCortesia
            ? 'Tu período de cortesía terminó.'
            : sub.planActive
                ? 'Tu plan cambió y hay que autorizarlo.'
                : 'Tu primer período terminó: activá tu plan para seguir.'

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => void irASuscripcion()}
            onKeyDown={e => { if (e.key === 'Enter') void irASuscripcion() }}
            style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '9px 18px', cursor: 'pointer',
                background: suspendida ? 'var(--color-error-bg)' : 'var(--color-primary-bg)',
                borderBottom: `1px solid ${suspendida ? 'var(--color-error)' : 'var(--color-primary)'}`,
                fontSize: 12.5,
            }}
        >
            {suspendida
                ? <AlertTriangle size={15} strokeWidth={2} color="var(--color-error)" style={{ flexShrink: 0 }} />
                : <Clock size={15} strokeWidth={2} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                {mensaje}
                {diasDeGracia !== null && (
                    <> Te qued{diasDeGracia === 1 ? 'a' : 'an'} <strong>{diasDeGracia} día{diasDeGracia === 1 ? '' : 's'}</strong> de plazo para regularizar antes de que se pause.</>
                )}
            </span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: suspendida ? 'var(--color-error)' : 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                {esCortesia && !cortesia.tienePlanElegido ? 'Elegí tu plan →' : 'Activar mi plan →'}
            </span>
        </div>
    )
}
