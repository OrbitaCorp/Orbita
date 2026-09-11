// src/layouts/components/SubscriptionStatusBanner.tsx
//
// Banner persistente arriba de TODO el panel (se monta en AdminLayout, no en
// una sola vista) avisando del estado de la suscripción — antes esto era
// invisible fuera de Configuración → Suscripción (RBT — ciclo de vida de
// suscripciones, 2026-09). Mismo criterio de "gracia → suspendida" que
// Suscripcion.tsx (duplicado a propósito: son dos lugares chicos, no vale la
// pena una capa de estado global compartido para esto todavía).
//
// Nunca bloquea el render del panel: si falla la carga de la suscripción,
// simplemente no se muestra nada — el panel tiene que seguir andando igual.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { AlertTriangle, Clock } from 'lucide-react'
import { panelGetSubscription, type ApiSubscription } from '@/lib/api'

const URL_SUSCRIPCION = '/admin/ventas/configuracion?vista=suscripcion'

export default function SubscriptionStatusBanner() {
    const router = useRouter()
    const [sub, setSub] = useState<ApiSubscription | null>(null)

    useEffect(() => {
        let cancelado = false
        panelGetSubscription()
            .then(s => { if (!cancelado) setSub(s) })
            .catch(() => { /* silencioso: nunca bloquea el panel por esto */ })
        return () => { cancelado = true }
    }, [])

    // No repetir el banner adentro de la propia pantalla de Suscripción — ya
    // tiene su propio bloque con el mismo mensaje y el botón de activar.
    if (router.pathname.startsWith('/admin') && router.query.vista === 'suscripcion') return null
    if (!sub) return null

    const esCortesia = sub.origin === 'COMP'
    const venciendo = new Date(sub.currentPeriodEnd ?? 0) <= new Date()
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
                : 'Tu beneficio de bienvenida terminó.'

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => router.push(URL_SUSCRIPCION)}
            onKeyDown={e => { if (e.key === 'Enter') router.push(URL_SUSCRIPCION) }}
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
                    <> Te qued{diasDeGracia === 1 ? 'a' : 'an'} <strong>{diasDeGracia} día{diasDeGracia === 1 ? '' : 's'}</strong> antes de que se pause.</>
                )}
            </span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: suspendida ? 'var(--color-error)' : 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                {esCortesia && !sub.planActive ? 'Elegí tu plan →' : 'Activar mi plan →'}
            </span>
        </div>
    )
}
