// src/modules/ventas/panel/configuracion/Suscripcion.tsx — Vista "Suscripción"
//
// Pestaña nueva (Fase 1 del plan "Avanzado") separada de Pagos: muestra el
// estado de la suscripción del negocio (ya facturada de verdad, ver
// subscriptions.service.ts) y el upsell del paquete "Avanzado" — un add-on
// aparte, todavía otorgado a mano (ver businesses.service.ts#getAddons) hasta
// que la Fase 5 del plan sume su propio checkout de Mercado Pago. Por eso acá
// el botón de activarlo no cobra nada: abre un contacto directo con el equipo.
//
// El bloque "Plan actual" tiene TRES estados posibles (RBT — planes múltiples,
// 2026-09), según `sub.planActive` y `sub.currentPeriodEnd`:
//   1. Cursando el beneficio de bienvenida (planActive=false, todavía no
//      venció): se puede elegir/cambiar a qué plan se pasa después, pero no
//      hay nada para activar todavía.
//   2. El período actual venció y no hay un plan activo (planActive=false,
//      ya venció) o cambió de plan (nextPlan seteado, ya venció): hay que
//      autorizar la preapproval real — "Activá tu plan" manda a MP.
//   3. Plan activo (planActive=true): muestra precio/próxima renovación y
//      deja pedir un cambio de plan, que rige recién en la próxima
//      renovación (ver SubscriptionsService.changePlan).

import { useEffect, useState } from 'react'
import { Crown, Check, Gamepad2, LayoutTemplate, MessageSquareText, Timer, Gift, ArrowRight } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonText } from '@/design-system/components/Skeleton'
import {
    ApiError, panelGetSubscription, panelGetAddons, panelActivatePlan, panelChangePlan,
    type ApiSubscription, type PlanKey,
} from '@/lib/api'

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

// Mismos planes y montos que pages/onboarding/plan.tsx y
// subscriptions.service.ts (PLANES) — si cambian de un lado, cambian del otro.
// 'mensualAvanzado' (RBT — rediseño "Base"/"Base + Avanzado", 2026-09): único
// plan que YA NO se ofrece en el alta (ver StartPendingCheckoutDto) pero sigue
// disponible acá — es el que arma "Activar Avanzado" más abajo, y cualquier
// cliente puede pasarse a él (o salir) como cualquier otro cambio de plan.
const PLANES: Record<PlanKey, { nombre: string; precioMes: number; total: number | null; periodo: string }> = {
    mensual:         { nombre: 'Mensual',           precioMes: 16500, total: null,   periodo: 'Sin compromiso' },
    semestral:       { nombre: 'Semestral',         precioMes: 14667, total: 88000,  periodo: 'cada 6 meses' },
    anual:           { nombre: 'Anual',             precioMes: 13000, total: 156000, periodo: 'por año' },
    mensualAvanzado: { nombre: 'Mensual + Avanzado', precioMes: 21700, total: null,   periodo: 'Sin compromiso' },
}
const PLAN_KEYS: PlanKey[] = ['mensual', 'semestral', 'anual', 'mensualAvanzado']

function esPlanKey(v: string): v is PlanKey {
    return (PLAN_KEYS as string[]).includes(v)
}

function fmtPesos(n: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string | null): string {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Selector compacto de plan — mismo uso en dos lugares (elegir el próximo
// plan durante el beneficio, y pedir un cambio con un plan ya activo), así
// que queda de una vez como pieza chica en vez de duplicar el markup.
function SelectorPlan({ valor, onElegir, disabled }: { valor: PlanKey; onElegir: (p: PlanKey) => void; disabled?: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PLAN_KEYS.map(key => {
                const p = PLANES[key]
                const activo = key === valor
                return (
                    <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => onElegir(key)}
                        className="ds-hover"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                            width: '100%', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
                            padding: '9px 12px', borderRadius: 10,
                            border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                            opacity: disabled && !activo ? 0.55 : 1,
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{p.nombre}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
                            {fmtPesos(p.precioMes)}{p.total ? '/mes' : ''} {!p.total && `· ${p.periodo}`}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

export default function Suscripcion() {
    const [sub, setSub] = useState<ApiSubscription | null>(null)
    const [advanced, setAdvanced] = useState(false)
    const [advancedExpiresAt, setAdvancedExpiresAt] = useState<string | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [activando, setActivando] = useState(false)
    const [errorActivar, setErrorActivar] = useState<string | null>(null)

    const [editandoPlan, setEditandoPlan] = useState(false)
    const [guardandoPlan, setGuardandoPlan] = useState(false)
    const [errorPlan, setErrorPlan] = useState<string | null>(null)

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

    function activarPlan() {
        setActivando(true)
        setErrorActivar(null)
        panelActivatePlan()
            .then(({ initPoint }) => { window.location.href = initPoint })
            .catch(e => {
                setErrorActivar(e instanceof ApiError ? e.message : 'No se pudo iniciar la activación')
                setActivando(false)
            })
    }

    function elegirPlan(p: PlanKey) {
        if (!sub) return
        setGuardandoPlan(true)
        setErrorPlan(null)
        panelChangePlan(p)
            .then(() => panelGetSubscription())
            .then(s => { setSub(s); setEditandoPlan(false) })
            .catch(e => setErrorPlan(e instanceof ApiError ? e.message : 'No se pudo guardar el cambio de plan'))
            .finally(() => setGuardandoPlan(false))
    }

    const venciendo = sub ? new Date(sub.currentPeriodEnd ?? 0) <= new Date() : false
    // Cortesías (COMP) no pasan por nada de esto: no tienen preapproval real
    // ni un plan que activar, se renuevan a mano desde la ficha del negocio.
    const esCortesia = sub?.origin === 'COMP'
    const planMostrado = sub && esPlanKey(sub.nextPlan ?? sub.plan) ? (sub.nextPlan ?? sub.plan) as PlanKey : null

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
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                                {esCortesia ? 'Cuenta de cortesía' : sub.planActive ? `Plan ${PLANES[sub.plan as PlanKey]?.nombre ?? sub.plan}` : 'Beneficio de bienvenida'}
                            </div>
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
                            {esCortesia ? 'Suscripción de cortesía, sin cargo.' : `${sub.currency} ${sub.amount.toLocaleString('es-AR')} por período`}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--color-subtle)', marginTop: 4 }}>
                            Período actual: {formatFecha(sub.currentPeriodStart)} — {formatFecha(sub.currentPeriodEnd)}
                        </div>

                        {/* ── Caso 2: período vencido, hay que autorizar el plan ── */}
                        {!esCortesia && venciendo && (
                            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <Gift size={16} strokeWidth={1.8} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>
                                        {sub.planActive ? 'Tu plan cambió — hay que autorizarlo' : 'Tu beneficio de bienvenida terminó'}
                                    </span>
                                </div>
                                <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '6px 0 12px' }}>
                                    {planMostrado
                                        ? `Activá el plan ${PLANES[planMostrado].nombre} (${fmtPesos(PLANES[planMostrado].precioMes)}${PLANES[planMostrado].total ? '/mes' : ` · ${PLANES[planMostrado].periodo}`}) para seguir usando Órbita sin cortes.`
                                        : 'Activá tu plan para seguir usando Órbita sin cortes.'}
                                </p>
                                {errorActivar && <p style={{ fontSize: 12.5, color: 'var(--color-error)', margin: '0 0 10px' }}>{errorActivar}</p>}
                                <Button variant="primary" size="sm" onClick={activarPlan} disabled={activando} icon={<ArrowRight size={13} strokeWidth={2.2} />}>
                                    {activando ? 'Abriendo Mercado Pago…' : `Activar mi plan${planMostrado ? ` ${PLANES[planMostrado].nombre}` : ''}`}
                                </Button>
                            </div>
                        )}

                        {/* ── Caso 1 y 3: elegir/cambiar el plan (todavía sin vencer) ── */}
                        {!esCortesia && !venciendo && (
                            <div style={{ marginTop: 16 }}>
                                {!editandoPlan ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
                                            {sub.planActive
                                                ? sub.nextPlan
                                                    ? <>Pasás a <strong style={{ color: 'var(--color-text)' }}>{PLANES[sub.nextPlan as PlanKey]?.nombre ?? sub.nextPlan}</strong> el {formatFecha(sub.currentPeriodEnd)}</>
                                                    : 'Podés cambiar de plan para la próxima renovación'
                                                : <>Vas a pasar a <strong style={{ color: 'var(--color-text)' }}>{planMostrado ? PLANES[planMostrado].nombre : sub.plan}</strong> cuando termine el beneficio</>}
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setEditandoPlan(true)}>
                                            {sub.planActive ? 'Cambiar plan' : 'Elegir otro plan'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-body)', marginBottom: 8 }}>
                                            {sub.planActive ? 'Elegí tu próximo plan (rige desde la próxima renovación)' : 'Elegí con qué plan seguís después del beneficio'}
                                        </div>
                                        {errorPlan && <p style={{ fontSize: 12.5, color: 'var(--color-error)', margin: '0 0 8px' }}>{errorPlan}</p>}
                                        <SelectorPlan
                                            valor={planMostrado ?? 'semestral'}
                                            onElegir={elegirPlan}
                                            disabled={guardandoPlan}
                                        />
                                        <Button variant="ghost" size="sm" onClick={() => setEditandoPlan(false)} style={{ marginTop: 8 }}>
                                            Cerrar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
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
                            {/* 'Incluido en...' cuando el addon viene del plan combinado (el
                                caso normal desde este rediseño); la fecha de vencimiento sola
                                queda para el caso, todavía posible, de un addon otorgado a
                                mano por un admin sin el plan combinado. */}
                            {sub?.plan === 'mensualAvanzado'
                                ? 'Incluido en tu plan Base + Avanzado'
                                : advancedExpiresAt ? `Vence el ${formatFecha(advancedExpiresAt)}` : 'Sin fecha de vencimiento'}
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
                            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>
                                {fmtPesos(PLANES.mensualAvanzado.precioMes)}/mes — reemplaza tu suscripción actual (no se cobra aparte)
                            </div>
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

                    {errorPlan && <p style={{ fontSize: 12.5, color: 'var(--color-error)', margin: '0 0 10px' }}>{errorPlan}</p>}
                    <Button variant="primary" onClick={() => elegirPlan('mensualAvanzado')} disabled={guardandoPlan}>
                        {guardandoPlan ? 'Guardando…' : 'Activar Avanzado'}
                    </Button>
                </Card>
            )}
        </div>
    )
}
