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
import { Crown, Check, Gift, ArrowRight } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Modal } from '@/design-system/components/Modal'
import { useAuth } from '@/hooks/useAuth'
import {
    ApiError, panelGetSubscription, panelGetAddons, panelActivatePlan, panelChangePlan, panelPreviewActivationDiscount,
    panelGetBusiness, panelCancelBusiness, panelReactivateFromCancellation,
    type ApiSubscription, type PlanKey,
} from '@/lib/api'

// Todo lo que el add-on ADVANCED habilita de verdad en el backend (cada una de
// estas funciones está detrás de AddonGuard / hasActiveAddon). Si se suma o se
// saca una función del paquete, hay que cambiarla acá y en DETALLE_AVANZADO de
// pages/onboarding/plan.tsx.
const INCLUYE = [
    'Plantillas de Home',
    'Modales de anuncios',
    'Juegos con premio',
    'Prueba social',
    '2x1 y 3x2',
    'Oferta relámpago',
    'Fotos sin fondo automáticas',
    'Fondo con IA para tus productos',
]

// SUSPENDED y CANCELLED sumados (RBT — ciclo de vida de suscripciones,
// 2026-09): antes faltaban, así que un negocio en cualquiera de esos dos
// estados caía en el fallback genérico ("SUSPENDED"/"CANCELLED" en crudo) más
// abajo. De paso se corrige "CANCELED" (una sola L) — el enum real del
// backend es CANCELLED, ese valor nunca había matcheado nada.
const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE:    { label: 'Activa',    color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    TRIALING:  { label: 'A prueba',  color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
    PAST_DUE:  { label: 'Pago vencido', color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
    SUSPENDED: { label: 'Suspendida', color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
    CANCELLED: { label: 'Cancelada', color: 'var(--color-muted)', bg: 'var(--color-surface-alt)' },
}

// Mismos planes y montos que pages/onboarding/plan.tsx y
// subscriptions.service.ts (PLANES) — si cambian de un lado, cambian del otro.
// 'mensualAvanzado' (RBT — rediseño "Base"/"Base + Avanzado", 2026-09): único
// plan que YA NO se ofrece en el alta (ver StartPendingCheckoutDto) pero sigue
// disponible acá — es el que arma "Activar Avanzado" más abajo, y cualquier
// cliente puede pasarse a él (o salir) como cualquier otro cambio de plan.
const PLANES: Record<PlanKey, { nombre: string; precioMes: number; total: number | null; periodo: string }> = {
    mensual:           { nombre: 'Mensual',             precioMes: 16500, total: null,   periodo: 'Sin compromiso' },
    semestral:         { nombre: 'Semestral',           precioMes: 14667, total: 88000,  periodo: 'cada 6 meses' },
    anual:             { nombre: 'Anual',               precioMes: 13000, total: 156000, periodo: 'por año' },
    mensualAvanzado:   { nombre: 'Mensual + Avanzado',   precioMes: 21700, total: null,   periodo: 'Sin compromiso' },
    semestralAvanzado: { nombre: 'Semestral + Avanzado', precioMes: 19333, total: 116000, periodo: 'cada 6 meses' },
    anualAvanzado:     { nombre: 'Anual + Avanzado',     precioMes: 17083, total: 205000, periodo: 'por año' },
}
const PLAN_KEYS: PlanKey[] = ['mensual', 'semestral', 'anual', 'mensualAvanzado', 'semestralAvanzado', 'anualAvanzado']

function esPlanKey(v: string): v is PlanKey {
    return (PLAN_KEYS as string[]).includes(v)
}

// Los tres planes que traen el paquete Avanzado. Espejo de incluyeAvanzado()
// en subscriptions.service.ts — si allá se suma una key, acá también.
const CON_AVANZADO: PlanKey[] = ['mensualAvanzado', 'semestralAvanzado', 'anualAvanzado']

/**
 * El equivalente CON Avanzado del plan que el negocio tiene hoy. Sumar el
 * paquete no le cambia el período a nadie: quien está en semestral pasa a
 * semestral + Avanzado, no a mensual (antes "Activar Avanzado" mandaba
 * siempre a mensualAvanzado porque era el único que existía).
 */
function conAvanzado(plan: string | null | undefined): PlanKey {
    if (plan === 'semestral' || plan === 'semestralAvanzado') return 'semestralAvanzado'
    if (plan === 'anual' || plan === 'anualAvanzado') return 'anualAvanzado'
    return 'mensualAvanzado'
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

// Código ya validado por el backend. `amountFinal` es lo que se paga en el
// PRIMER cobro; desde el segundo la suscripción vuelve al precio de lista.
type DescuentoActivacion = { code: string; percentOff: number; amountBase: number; amountFinal: number }

// Campo opcional de código de descuento para activar el plan. Mismo patrón que
// el del alta (pages/onboarding/plan.tsx), pero contra el precio de lista del
// plan: el descuento vale solo para el primer cobro y eso se dice explícito
// para que nadie crea que queda rebajado para siempre.
function CodigoDescuento({ descuento, onAplicado, onQuitar, disabled }: {
    descuento: DescuentoActivacion | null
    onAplicado: (d: DescuentoActivacion) => void
    onQuitar: () => void
    disabled?: boolean
}) {
    const [code, setCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [validando, setValidando] = useState(false)

    async function aplicar() {
        const limpio = code.trim()
        if (!limpio) return
        setValidando(true)
        setError(null)
        try {
            onAplicado(await panelPreviewActivationDiscount(limpio))
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No pudimos validar el código.')
        } finally {
            setValidando(false)
        }
    }

    if (descuento) {
        return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 0 12px' }}>
                <Check size={15} strokeWidth={2.4} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ flex: 1, margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-body)' }}>
                    Código <strong style={{ fontFamily: '"Geist Mono", monospace' }}>{descuento.code}</strong> aplicado:{' '}
                    pagás <strong style={{ color: 'var(--color-text)' }}>{fmtPesos(descuento.amountFinal)}</strong> el primer cobro
                    y desde el segundo vuelve a {fmtPesos(descuento.amountBase)}.
                </p>
                <button
                    type="button"
                    onClick={() => { onQuitar(); setCode('') }}
                    disabled={disabled}
                    className="ds-link"
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-muted)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                >
                    Quitar
                </button>
            </div>
        )
    }

    return (
        <div style={{ margin: '0 0 12px' }}>
            <label htmlFor="codigo-descuento-activacion" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-body)', marginBottom: 6 }}>
                ¿Tenés un código de descuento? <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>(vale para el primer cobro)</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    id="codigo-descuento-activacion"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void aplicar() } }}
                    placeholder="Tu código"
                    disabled={disabled || validando}
                    autoComplete="off"
                    className="ds-field"
                    style={{
                        flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 10,
                        border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`, background: 'var(--color-bg)',
                        color: 'var(--color-text)', fontSize: 13.5, fontFamily: '"Geist Mono", monospace',
                        letterSpacing: '0.05em', outline: 'none',
                    }}
                />
                <Button variant="outline" size="sm" onClick={() => void aplicar()} disabled={disabled || validando || !code.trim()}>
                    {validando ? 'Validando…' : 'Aplicar'}
                </Button>
            </div>
            {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
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
    // Código de descuento ya validado contra el backend (vale para el primer cobro).
    const [descuento, setDescuento] = useState<DescuentoActivacion | null>(null)
    // Aviso de "listo" cuando se elige el plan con Avanzado y todavía no hay nada que pagar.
    const [avisoPlan, setAvisoPlan] = useState<string | null>(null)

    // Cancelación: la ventana de 60 días vive en el negocio, no en la suscripción.
    const { user } = useAuth()
    const esOwner = user?.type === 'member' && user.role === 'owner'
    const [cancelledAt, setCancelledAt] = useState<string | null>(null)
    const [scheduledDeletionAt, setScheduledDeletionAt] = useState<string | null>(null)
    const [modalCancelar, setModalCancelar] = useState(false)
    const [cancelando, setCancelando] = useState(false)
    const [errorCancelar, setErrorCancelar] = useState<string | null>(null)

    const [editandoPlan, setEditandoPlan] = useState(false)
    const [guardandoPlan, setGuardandoPlan] = useState(false)
    const [errorPlan, setErrorPlan] = useState<string | null>(null)

    useEffect(() => {
        let cancelado = false
        Promise.all([panelGetSubscription(), panelGetAddons(), panelGetBusiness().catch(() => null)])
            .then(([s, a, b]) => {
                if (cancelado) return
                setSub(s)
                setAdvanced(a.advanced)
                setAdvancedExpiresAt(a.advancedExpiresAt)
                setCancelledAt(b?.cancelledAt ?? null)
                setScheduledDeletionAt(b?.scheduledDeletionAt ?? null)
            })
            .catch(e => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar tu suscripción') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    // Si el usuario vuelve con "atrás" desde Mercado Pago, el navegador restaura
    // la página tal cual quedó — con el botón en "Abriendo Mercado Pago…" para
    // siempre. Al volver desde la caché se rehabilita.
    useEffect(() => {
        function alVolver(e: PageTransitionEvent) { if (e.persisted) setActivando(false) }
        window.addEventListener('pageshow', alVolver)
        return () => window.removeEventListener('pageshow', alVolver)
    }, [])

    function activarPlan(codigo?: string) {
        setActivando(true)
        setErrorActivar(null)
        panelActivatePlan(codigo)
            .then(({ initPoint }) => {
                window.location.href = initPoint
                // Si la redirección no llega a ocurrir (bloqueada, sin red), no dejar el botón muerto.
                window.setTimeout(() => setActivando(false), 15000)
            })
            .catch(e => {
                setErrorActivar(e instanceof ApiError ? e.message : 'No se pudo iniciar la activación')
                setActivando(false)
            })
    }

    // `activar`: además de guardar el plan, seguir derecho a Mercado Pago cuando
    // el período ya venció (lo que espera quien aprieta "Activar Avanzado").
    async function elegirPlan(p: PlanKey, activar = false) {
        if (!sub) return
        setGuardandoPlan(true)
        setErrorPlan(null)
        setAvisoPlan(null)
        try {
            await panelChangePlan(p)
            const s = await panelGetSubscription()
            setSub(s)
            setEditandoPlan(false)

            // Un código aplicado se calculó contra el precio del plan anterior:
            // se vuelve a calcular contra el nuevo, o se descarta si ya no sirve.
            let codigo = descuento?.code
            if (descuento) {
                try { setDescuento(await panelPreviewActivationDiscount(descuento.code)) }
                catch { setDescuento(null); codigo = undefined }
            }

            const vencido = s.origin !== 'COMP' && new Date(s.currentPeriodEnd ?? 0) <= new Date()
            if (activar && vencido) {
                setGuardandoPlan(false)
                activarPlan(codigo)
                return
            }
            if (activar) setAvisoPlan('Listo: cuando termine tu beneficio de bienvenida pasás al plan con Avanzado.')
        } catch (e) {
            setErrorPlan(e instanceof ApiError ? e.message : 'No se pudo guardar el cambio de plan')
        } finally {
            setGuardandoPlan(false)
        }
    }

    async function confirmarCancelacion() {
        setModalCancelar(false)
        setCancelando(true)
        setErrorCancelar(null)
        try {
            if (cancelledAt) {
                await panelReactivateFromCancellation()
                setCancelledAt(null)
                setScheduledDeletionAt(null)
            } else {
                const r = await panelCancelBusiness()
                setCancelledAt(new Date().toISOString())
                setScheduledDeletionAt(r.scheduledDeletionAt)
                setDescuento(null)
            }
            setSub(await panelGetSubscription())
        } catch (e) {
            setErrorCancelar(e instanceof ApiError ? e.message : 'No se pudo completar la operación')
        } finally {
            setCancelando(false)
        }
    }

    const venciendo = sub ? new Date(sub.currentPeriodEnd ?? 0) <= new Date() : false
    // Cuenta regresiva de gracia (RBT — ciclo de vida de suscripciones,
    // 2026-09): mismo cálculo que reconcileOverdueSubscriptions() en el
    // backend (currentPeriodEnd + gracePeriodDays), solo para mostrarlo acá —
    // el backend es quien decide de verdad cuándo se pasa a SUSPENDED.
    const diasDeGracia = sub && venciendo && sub.status !== 'SUSPENDED' && sub.currentPeriodEnd
        ? Math.max(Math.ceil((new Date(sub.currentPeriodEnd).getTime() + sub.gracePeriodDays * 86_400_000 - new Date().getTime()) / 86_400_000), 0)
        : null
    const suspendida = sub?.status === 'SUSPENDED'
    const cancelada = !!cancelledAt
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

                        {/* ── Caso 2: período vencido, hay que autorizar el plan ──
                            Estilo urgente (rojo) si ya está SUSPENDED — el panel
                            entero está en modo solo-lectura en ese momento; estilo
                            de aviso (azul) mientras todavía está en gracia, con la
                            cuenta regresiva de días. */}
                        {/* Cancelada: la tienda está pausada y dentro de la ventana de 60 días
                            antes del borrado. Reactivar la deja como estaba; si el plan ya
                            había vencido, abajo vuelve a aparecer "Activar mi plan". */}
                        {cancelada && (
                            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)' }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>Tu suscripción está cancelada</div>
                                <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '6px 0 12px', lineHeight: 1.5 }}>
                                    Tu tienda está pausada y se elimina de forma definitiva el <strong style={{ color: 'var(--color-text)' }}>{formatFecha(scheduledDeletionAt)}</strong>.
                                    {esOwner ? ' Si la reactivás antes, vuelve a estar como la dejaste.' : ' El dueño de la cuenta puede reactivarla antes de esa fecha.'}
                                </p>
                                {errorCancelar && <p style={{ fontSize: 12.5, color: 'var(--color-error)', margin: '0 0 10px' }}>{errorCancelar}</p>}
                                {esOwner && (
                                    <Button variant="primary" size="sm" onClick={() => setModalCancelar(true)} disabled={cancelando}>
                                        {cancelando ? 'Reactivando…' : 'Reactivar mi suscripción'}
                                    </Button>
                                )}
                            </div>
                        )}

                        {!esCortesia && !cancelada && venciendo && (
                            <div style={{
                                marginTop: 16, padding: 14, borderRadius: 12,
                                background: suspendida ? 'var(--color-error-bg)' : 'var(--color-primary-bg)',
                                border: `1px solid ${suspendida ? 'var(--color-error)' : 'var(--color-primary)'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <Gift size={16} strokeWidth={1.8} color={suspendida ? 'var(--color-error)' : 'var(--color-primary)'} style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>
                                        {suspendida
                                            ? 'Tu tienda está pausada'
                                            : sub.planActive
                                                ? 'Tu plan cambió — hay que autorizarlo'
                                                : 'Tu beneficio de bienvenida terminó'}
                                    </span>
                                </div>
                                <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '6px 0 12px' }}>
                                    {suspendida
                                        ? 'Tu panel sigue funcionando en modo solo lectura — podés ver todo, pero para volver a editar y que tu tienda sea visible de nuevo hay que activar tu plan.'
                                        : planMostrado
                                            ? `Activá el plan ${PLANES[planMostrado].nombre} (${fmtPesos(PLANES[planMostrado].precioMes)}${PLANES[planMostrado].total ? '/mes' : ` · ${PLANES[planMostrado].periodo}`}) para seguir usando Órbita sin cortes.`
                                            : 'Activá tu plan para seguir usando Órbita sin cortes.'}
                                    {diasDeGracia !== null && (
                                        <> Te qued{diasDeGracia === 1 ? 'a' : 'an'} <strong style={{ color: 'var(--color-text)' }}>{diasDeGracia} día{diasDeGracia === 1 ? '' : 's'}</strong> de plazo para regularizar antes de que se pause.</>
                                    )}
                                </p>
                                <CodigoDescuento
                                    descuento={descuento}
                                    onAplicado={setDescuento}
                                    onQuitar={() => setDescuento(null)}
                                    disabled={activando}
                                />
                                {errorActivar && <p style={{ fontSize: 12.5, color: 'var(--color-error)', margin: '0 0 10px' }}>{errorActivar}</p>}
                                <Button variant="primary" size="sm" onClick={() => activarPlan(descuento?.code)} disabled={activando} icon={<ArrowRight size={13} strokeWidth={2.2} />}>
                                    {activando ? 'Abriendo Mercado Pago…' : `Activar mi plan${planMostrado ? ` ${PLANES[planMostrado].nombre}` : ''}`}
                                </Button>
                            </div>
                        )}

                        {/* ── Caso 1 y 3: elegir/cambiar el plan (todavía sin vencer) ── */}
                        {!esCortesia && !cancelada && !venciendo && (
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
                            {sub?.plan && (CON_AVANZADO as string[]).includes(sub.plan)
                                ? `Incluido en tu plan ${PLANES[sub.plan as PlanKey].nombre}`
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
                                {/* El precio del plan que le tocaría a ESTE negocio, no el
                                    mensual fijo: quien está en semestral/anual pasa al
                                    combinado de su mismo período (ver conAvanzado). */}
                                {fmtPesos(PLANES[conAvanzado(sub?.plan)].precioMes)}/mes — reemplaza tu suscripción actual (no se cobra aparte)
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
                        {INCLUYE.map(label => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--color-body)' }}>
                                <Check size={14} strokeWidth={2.2} color="var(--color-success)" style={{ flexShrink: 0 }} />
                                {label}
                            </div>
                        ))}
                    </div>

                    {errorPlan && <p role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)', margin: '0 0 10px' }}>{errorPlan}</p>}
                    {avisoPlan && <p role="status" style={{ fontSize: 12.5, color: 'var(--color-success)', margin: '0 0 10px' }}>{avisoPlan}</p>}
                    <Button variant="primary" onClick={() => void elegirPlan(conAvanzado(sub?.plan), true)} disabled={guardandoPlan || activando || cancelada}>
                        {guardandoPlan || activando ? 'Un momento…' : 'Activar Avanzado'}
                    </Button>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '8px 0 0' }}>
                        {venciendo && !esCortesia && !cancelada
                            ? 'Te llevamos a Mercado Pago para autorizar el plan con Avanzado.'
                            : 'Se activa cuando termine tu beneficio de bienvenida.'}
                    </p>
                </Card>
            )}

            {/* Cancelar suscripción — solo el dueño, y solo si no está ya cancelada
                (cancelada se reactiva desde el aviso de arriba). Es la MISMA baja
                que "Eliminar espacio" de Configuración general. */}
            {!cargando && esOwner && !cancelada && sub && (
                <Card padding="md" style={{ maxWidth: 820, marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Cancelar suscripción</div>
                            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2, lineHeight: 1.5 }}>
                                Se corta el cobro y tu tienda se pausa al instante. Tenés 60 días para reactivarla y recuperar todo.
                            </div>
                            {errorCancelar && <p role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)', margin: '8px 0 0' }}>{errorCancelar}</p>}
                        </div>
                        <Button variant="outline" onClick={() => setModalCancelar(true)} disabled={cancelando}>
                            {cancelando ? 'Cancelando…' : 'Cancelar suscripción'}
                        </Button>
                    </div>
                </Card>
            )}

            <Modal
                isOpen={modalCancelar}
                onClose={() => setModalCancelar(false)}
                title={cancelada ? '¿Reactivar tu suscripción?' : '¿Cancelar tu suscripción?'}
                variant={cancelada ? 'default' : 'danger'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalCancelar(false)}>Volver</Button>
                        <Button variant={cancelada ? 'primary' : 'danger'} onClick={() => void confirmarCancelacion()}>
                            {cancelada ? 'Sí, reactivar' : 'Sí, cancelar'}
                        </Button>
                    </>
                }
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    {cancelada
                        ? 'Tu tienda vuelve a estar visible para tus clientes, tal cual la dejaste. Si tu plan ya había vencido, vas a poder activarlo de nuevo desde esta misma pantalla.'
                        : 'Se corta el cobro de tu suscripción y tu tienda se pausa al instante: tus clientes dejan de verla. Vas a poder reactivarla y recuperar todo durante los próximos 60 días; pasado ese plazo, se elimina de forma definitiva.'}
                </div>
            </Modal>
        </div>
    )
}
