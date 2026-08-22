// src/modules/ventas/panel/pedidos/Cancelaciones.tsx
//
// Cancelaciones PEDIDAS por el cliente sobre un pedido que ya no se
// autocancela solo (Confirmado/En preparación) — el negocio las acepta o
// rechaza. Al aceptar, el pedido se cancela de verdad (mismo mecanismo que
// cualquier cancelación: reingresa stock si corresponde) y, si se había
// pagado con Mercado Pago, se intenta el reembolso real por API — sin
// wizard de alta: a diferencia de una devolución, esto no lo puede cargar
// el negocio a mano, siempre nace de un pedido del cliente.

import { useEffect, useState } from 'react'
import { Eye, Mail, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Modal } from '@/design-system/components/Modal'
import { SkeletonFilas } from '@/design-system/components/Skeleton'
import type { VistaPedido } from './components/PedidoTabs'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'
import {
    ApiError, getCancellations, approveCancellation, rejectCancellation, sendOrderEmail,
    type ApiCancellationRequest, type ApiCancellationsPage, type ApiCancellationStatus,
} from '@/lib/api'

const ESTADO_CHIP: Record<ApiCancellationStatus, { label: string; bg: string; fg: string }> = {
    PENDING:  { label: 'Pendiente', bg: 'var(--color-warning-bg)', fg: 'var(--chip-warning-fg)' },
    APPROVED: { label: 'Aprobada',  bg: 'var(--color-success-bg)', fg: 'var(--chip-success-fg)' },
    REJECTED: { label: 'Rechazada', bg: 'var(--color-error-bg)',   fg: 'var(--chip-error-fg)'   },
}

// El estado del reembolso solo importa una vez aprobada — antes de eso no
// se intentó nada todavía.
const REEMBOLSO_LABEL: Record<string, string> = {
    NONE: 'Sin pago por MP',
    REFUNDED: 'Reembolsado',
    FAILED: 'Reembolso falló',
}

const TABS: { id: ApiCancellationStatus | 'todas'; label: string }[] = [
    { id: 'todas',    label: 'Todas' },
    { id: 'PENDING',  label: 'Pendientes' },
    { id: 'APPROVED', label: 'Aprobadas' },
    { id: 'REJECTED', label: 'Rechazadas' },
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso: string) {
    const d = new Date(iso)
    return `${d.getDate()} ${MESES[d.getMonth()]}`
}

interface CancelacionesProps {
    ir:      (vista: VistaPedido, id?: string) => void
    onToast: (msg: string) => void
}

export default function Cancelaciones({ ir, onToast }: CancelacionesProps) {
    // Aceptar/rechazar cancela pedidos y puede disparar un reembolso real:
    // mismo gate de gestión que devoluciones/notas de crédito.
    const { user } = useAuth()
    const puedeGestionar = user?.type === 'member' && user.permissions.includes('orders.manage')

    const [tab, setTab]               = useState<ApiCancellationStatus | 'todas'>('todas')
    const [page, setPage]             = useState(1)
    const [datos, setDatos]           = useState<ApiCancellationsPage | null>(null)
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [recarga, setRecarga]       = useState(0)

    const [procesando, setProcesando]   = useState<string | null>(null)
    const [rechazar, setRechazar]       = useState<ApiCancellationRequest | null>(null)
    const [motivoRechazo, setMotivoRechazo] = useState('')
    const [comprobante, setComprobante] = useState<string | null>(null)
    const [email, setEmail]             = useState<(ClienteEmail & { pedidoId: string }) | null>(null)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        getCancellations({ status: tab === 'todas' ? undefined : tab, page, limit: 10 })
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudieron cargar las cancelaciones') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [tab, page, recarga])

    const lista = datos?.data ?? []
    const counts = datos?.counts ?? {}
    const totalTab = (id: ApiCancellationStatus | 'todas') =>
        id === 'todas'
            ? (Object.values(counts) as number[]).reduce((s, n) => s + (n ?? 0), 0)
            : counts[id] ?? 0
    const pendientes = counts.PENDING ?? 0
    const total  = datos?.total ?? 0
    const limite = datos?.limit ?? 10
    const desde  = total === 0 ? 0 : (page - 1) * limite + 1
    const hasta  = Math.min(page * limite, total)

    const aprobar = async (c: ApiCancellationRequest) => {
        if (procesando) return
        setProcesando(c.id)
        try {
            const r = await approveCancellation(c.id)
            onToast(
                r.refundStatus === 'REFUNDED' ? `Cancelación del pedido #${c.orderNumber} aprobada — se reembolsó por Mercado Pago`
                : r.refundStatus === 'FAILED' ? `Cancelación del pedido #${c.orderNumber} aprobada — el reembolso por Mercado Pago falló, revisalo a mano`
                : `Cancelación del pedido #${c.orderNumber} aprobada`
            )
            setRecarga(n => n + 1)
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo aprobar la cancelación.')
        } finally {
            setProcesando(null)
        }
    }

    const confirmarRechazo = async () => {
        if (!rechazar || procesando) return
        setProcesando(rechazar.id)
        try {
            await rejectCancellation(rechazar.id, motivoRechazo.trim() || undefined)
            onToast(`Cancelación del pedido #${rechazar.orderNumber} rechazada`)
            setRechazar(null)
            setMotivoRechazo('')
            setRecarga(n => n + 1)
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo rechazar la cancelación.')
        } finally {
            setProcesando(null)
        }
    }

    return (
        <div className="dev-page" style={pageWrap}>
            <style>{`
                .dev-field:focus-visible {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
                }
                .dev-tab:focus-visible, .dev-rowbtn:focus-visible, .dev-iconbtn:focus-visible {
                    outline: 2px solid var(--color-primary);
                    outline-offset: 2px;
                }
                .dev-tab:hover     { background: var(--color-surface-alt); }
                .dev-iconbtn:hover { background: var(--color-surface-alt); color: var(--color-text); }
                @media (max-width: 768px) {
                    .dev-page { padding: 16px 14px 48px !important; }
                }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Postventa</h1>
                        {pendientes > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 12, fontWeight: 600 }}>{pendientes} por resolver</span>
                        )}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Cancelaciones pedidas por clientes sobre pedidos ya confirmados.</div>
                </div>
            </div>

            <div role="tablist" aria-label="Sección de postventa" style={{ display: 'inline-flex', gap: 2, padding: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16 }}>
                <button className="dev-tab" role="tab" aria-selected={false} onClick={() => ir('devoluciones')} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Devoluciones</button>
                <button className="dev-tab" role="tab" aria-selected={false} onClick={() => ir('notas')} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Notas de crédito</button>
                <button className="dev-tab" role="tab" aria-selected style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'default', fontFamily: 'inherit' }}>Cancelaciones</button>
            </div>

            <div role="tablist" aria-label="Estado de las cancelaciones" style={{ display: 'flex', gap: 2, padding: '6px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 16, overflowX: 'auto' }}>
                {TABS.map(({ id, label }) => {
                    const a = tab === id
                    return (
                        <button key={id} onClick={() => { setTab(id); setPage(1) }} className="dev-tab" role="tab" aria-selected={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', minHeight: 44, borderRadius: 8, border: 'none', background: a ? 'var(--color-primary-bg)' : 'transparent', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                            {label}
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 9999, fontFamily: '"Geist Mono", monospace', background: a ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)', color: a ? 'var(--chip-primary-fg)' : 'var(--color-body)' }}>{totalTab(id)}</span>
                        </button>
                    )
                })}
            </div>

            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {cargando && !datos ? (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <SkeletonFilas filas={5} />
                </div>
            ) : lista.length === 0 && !errorCarga ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-alt)', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
                        <RotateCcw size={26} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                        {tab === 'todas' ? 'Sin cancelaciones pedidas' : 'Nada en este estado'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6, maxWidth: '62ch', margin: '0 auto' }}>
                        Acá aparecen cuando un cliente pide cancelar un pedido que ya no se autocancela solo (Confirmado o En preparación).
                    </div>
                </div>
            ) : (
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflowX: 'auto', position: 'relative', opacity: cargando ? 0.45 : 1, pointerEvents: cargando ? 'none' : 'auto', transition: 'opacity 180ms ease' }} aria-busy={cargando}>
                    {cargando && (
                        <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 5, fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '3px 10px', borderRadius: 9999, boxShadow: '0 2px 8px rgba(15,23,42,0.10)' }}>Actualizando…</div>
                    )}
                    <div style={{ minWidth: 900 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: COLS_CAN, alignItems: 'center', gap: 10, padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <span>Pedido</span><span>Cliente</span><span>Motivo</span><span>Método pedido</span><span>Reembolso MP</span><span>Fecha</span><span style={{ textAlign: 'right' }}>Acciones</span>
                        </div>
                        {lista.map((c, i) => {
                            const resoluble = c.status === 'PENDING'
                            return (
                                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: COLS_CAN, alignItems: 'center', gap: 10, padding: '10px 16px', minHeight: 64, borderBottom: i < lista.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{c.orderNumber}</div>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', marginTop: 3, borderRadius: 9999, fontSize: 10.5, fontWeight: 600, background: ESTADO_CHIP[c.status].bg, color: ESTADO_CHIP[c.status].fg }}>{ESTADO_CHIP[c.status].label}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        <Avatar name={c.customerName ?? 'Sin cliente'} size={28} />
                                        <span style={{ fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customerName ?? 'Sin cliente'}</span>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: 'var(--color-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.reason}</div>
                                    <span style={{ fontSize: 12, color: 'var(--color-body)' }}>
                                        {c.refundMethod ? METODO_PEDIDO_LABEL[c.refundMethod] : '—'}
                                    </span>
                                    <span style={{ fontSize: 12, color: c.refundStatus === 'FAILED' ? 'var(--color-error)' : c.refundStatus === 'REFUNDED' ? 'var(--color-success)' : 'var(--color-muted)' }}>
                                        {c.refundStatus ? REEMBOLSO_LABEL[c.refundStatus] : '—'}
                                    </span>
                                    <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fechaCorta(c.createdAt)}</span>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                        {resoluble && puedeGestionar && (
                                            <>
                                                <Button variant="outline" size="sm" loading={procesando === c.id} disabled={procesando !== null} onClick={() => void aprobar(c)}>Aprobar</Button>
                                                <Button variant="danger" size="sm" disabled={procesando !== null} onClick={() => { setRechazar(c); setMotivoRechazo('') }}>Rechazar</Button>
                                            </>
                                        )}
                                        <button className="dev-iconbtn" aria-label={`Ver pedido #${c.orderNumber}`} title="Ver pedido" onClick={() => setComprobante(c.orderId)} style={iconBtnDev}><Eye size={15} strokeWidth={1.8} /></button>
                                        <button className="dev-iconbtn" aria-label={`Email a ${c.customerName ?? 'cliente'}`} title="Enviar email" onClick={() => setEmail({ nombre: c.customerName ?? 'Cliente', email: c.customerEmail ?? '', pedidoId: c.orderId })} style={iconBtnDev}><Mail size={15} strokeWidth={1.8} /></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {total > limite && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 4px', flexWrap: 'wrap', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                        Mostrando <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{desde}–{hasta}</strong> de <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{total}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Anterior</Button>
                        <Button variant="outline" size="sm" disabled={hasta >= total} onClick={() => setPage(p => p + 1)}>Siguiente →</Button>
                    </div>
                </div>
            )}

            {/* Modal de rechazo: pide el motivo que se le explica al cliente */}
            <Modal
                isOpen={rechazar !== null}
                onClose={() => setRechazar(null)}
                title={rechazar ? `Rechazar cancelación del pedido #${rechazar.orderNumber}` : ''}
                maxWidth={480}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setRechazar(null)} disabled={procesando !== null}>Cancelar</Button>
                        <Button variant="danger" loading={procesando !== null} onClick={() => void confirmarRechazo()}>Rechazar y avisar</Button>
                    </>
                }
            >
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 12 }}>
                    El cliente recibe un email con el motivo. Si lo dejás vacío, va el texto estándar de políticas. El pedido sigue su curso normal — no se cancela.
                </div>
                <label htmlFor="can-motivo-rechazo" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Motivo del rechazo (se le envía al cliente)</label>
                <textarea
                    id="can-motivo-rechazo"
                    className="dev-field"
                    value={motivoRechazo}
                    onChange={e => setMotivoRechazo(e.target.value)}
                    placeholder="Ej: el pedido ya está en preparación y no lo podemos frenar a esta altura…"
                    rows={4}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 96, padding: '10px 12px', fontSize: 13, lineHeight: 1.6 }}
                />
            </Modal>

            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} id={comprobante ?? undefined} onToast={onToast} abrirDirecto />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} onToast={onToast} onEnviar={async (a, b) => { await sendOrderEmail(email.pedidoId, a, b) }} />}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
// Pedido · Cliente · Motivo · Reembolso MP · Fecha · Acciones
const COLS_CAN = '90px minmax(150px,1.1fr) minmax(160px,1.4fr) 120px 130px 70px 190px'

// Qué pidió el CLIENTE al solicitar la cancelación — null en solicitudes de
// antes de que existiera este campo (BusinessConfig.cancellations*).
const METODO_PEDIDO_LABEL: Record<string, string> = {
    CREDIT_NOTE: 'Nota de crédito',
    REFUND: 'Reembolso MP',
}
const iconBtnDev: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 6, border: '1px solid var(--color-border)',
    background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', padding: 0,
    transition: 'background 150ms ease, color 150ms ease',
}
const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)',
    border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)',
    fontFamily: 'inherit', outline: 'none',
}
