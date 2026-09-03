// src/modules/ventas/panel/configuracion/Suscripcion.tsx — Vista "Suscripción"
//
// Pestaña nueva (Fase 1 del plan "Avanzado") separada de Pagos: muestra el
// estado de la suscripción mensual del negocio (ya facturada de verdad, ver
// subscriptions.service.ts) y el upsell del paquete "Avanzado" — un add-on
// aparte, todavía otorgado a mano (ver businesses.service.ts#getAddons) hasta
// que la Fase 5 del plan sume su propio checkout de Mercado Pago. Por eso acá
// el botón de activarlo no cobra nada: abre un contacto directo con el equipo.

import { useEffect, useState } from 'react'
import { Crown, Check, Gamepad2, LayoutTemplate, MessageSquareText, Timer } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { ApiError, panelGetSubscription, panelGetAddons, type ApiSubscription } from '@/lib/api'

// Placeholder fácil de encontrar y cambiar cuando se defina el precio real
// (Fase 5 — checkout real de MP, todavía no construido).
const PRECIO_AVANZADO = '$X/año'
const CONTACTO_AVANZADO = 'mailto:hola@orbita.com?subject=Quiero activar el paquete Avanzado'

const INCLUYE = [
    { label: 'Juegos con premio', Icon: Gamepad2 },
    { label: 'Modales de anuncios', Icon: MessageSquareText },
    { label: 'Plantillas de Home', Icon: LayoutTemplate },
    { label: 'Countdown y prueba social', Icon: Timer },
]

const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE:    { label: 'Activa',    color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    TRIALING:  { label: 'A prueba',  color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
    PAST_DUE:  { label: 'Pago vencido', color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
    CANCELED:  { label: 'Cancelada', color: 'var(--color-muted)', bg: 'var(--color-surface-alt)' },
}

function formatFecha(iso: string | null): string {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Suscripcion() {
    const [sub, setSub] = useState<ApiSubscription | null>(null)
    const [advanced, setAdvanced] = useState(false)
    const [advancedExpiresAt, setAdvancedExpiresAt] = useState<string | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelado = false
        Promise.all([panelGetSubscription(), panelGetAddons()])
            .then(([s, a]) => {
                if (cancelado) return
                setSub(s)
                setAdvanced(a.advanced)
                setAdvancedExpiresAt(a.advancedExpiresAt)
            })
            .catch(e => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar tu suscripción') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    return (
        <div className="panel-page panel-page--form">
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 4px' }}>Suscripción</h1>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>El estado de tu plan y el paquete Avanzado, en un solo lugar.</div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, maxWidth: 820, fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {/* Plan actual */}
            <Card padding="md" style={{ maxWidth: 820, marginBottom: 16 }}>
                {cargando ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <SkeletonText width="30%" height={16} />
                        <SkeletonText width="55%" height={12} />
                        <SkeletonText width="40%" height={12} />
                    </div>
                ) : sub ? (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', textTransform: 'capitalize' }}>Plan {sub.plan}</div>
                            {(() => {
                                const meta = ESTADO_META[sub.status] ?? { label: sub.status, color: 'var(--color-muted)', bg: 'var(--color-surface-alt)' }
                                return (
                                    <span style={{ fontSize: 11.5, fontWeight: 600, color: meta.color, background: meta.bg, borderRadius: 9999, padding: '3px 10px' }}>
                                        {meta.label}
                                    </span>
                                )
                            })()}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 8 }}>
                            {sub.origin === 'COMP'
                                ? 'Suscripción de cortesía, sin cargo.'
                                : `${sub.currency} ${sub.amount.toLocaleString('es-AR')} por período`}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--color-subtle)', marginTop: 4 }}>
                            Período actual: {formatFecha(sub.currentPeriodStart)} — {formatFecha(sub.currentPeriodEnd)}
                        </div>
                    </div>
                ) : (
                    <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>No encontramos una suscripción activa para este negocio.</div>
                )}
            </Card>

            {/* Paquete Avanzado */}
            {cargando ? (
                <Card padding="md" style={{ maxWidth: 820 }}>
                    <SkeletonText width="35%" height={16} />
                    <SkeletonText width="70%" height={12} style={{ marginTop: 10 }} />
                </Card>
            ) : advanced ? (
                <Card padding="md" style={{ maxWidth: 820, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-success-bg)' }}>
                        <Crown size={19} strokeWidth={1.8} color="var(--color-success)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Paquete Avanzado activo</div>
                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>
                            {advancedExpiresAt ? `Vence el ${formatFecha(advancedExpiresAt)}` : 'Sin fecha de vencimiento'}
                        </div>
                    </div>
                </Card>
            ) : (
                <Card padding="md" style={{ maxWidth: 820 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                            <Crown size={19} strokeWidth={1.8} color="var(--color-primary)" />
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Paquete Avanzado</div>
                            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>{PRECIO_AVANZADO} — aparte de tu suscripción actual</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
                        {INCLUYE.map(i => (
                            <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--color-body)' }}>
                                <Check size={14} strokeWidth={2.2} color="var(--color-success)" style={{ flexShrink: 0 }} />
                                {i.label}
                            </div>
                        ))}
                    </div>

                    <Button variant="primary" onClick={() => { window.location.href = CONTACTO_AVANZADO }}>
                        Activar Avanzado
                    </Button>
                </Card>
            )}
        </div>
    )
}

