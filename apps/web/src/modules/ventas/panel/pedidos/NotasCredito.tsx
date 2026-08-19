// src/modules/ventas/panel/pedidos/NotasCredito.tsx — Vista 07
// Saldos a favor y reembolsos emitidos a clientes + modal de alta.
//
// (Fase 3 — Ale, 01/08) Antes era 100% maqueta. Ahora sale todo del backend:
// - Los KPIs de la cabecera (total emitido, activas, vencen en 7 días) vienen
//   de GET /credit-notes junto con la lista paginada.
// - Las notas se emiten solas al aprobar una devolución con resolución "nota
//   de crédito"; desde acá también se pueden emitir a mano (el modal de alta,
//   sobre un pedido real).
// - "Aplicar" usa el saldo: el backend valida que esté vigente y la marca
//   aplicada. El modelo no guarda remanente, así que se aplica entera.
// - El estado "Vencida" no existe en la base: se deriva de expiresAt.

import { useEffect, useState } from 'react'
import { FileText, Check, Clock, Search, Eye, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { KpiCard } from '@/design-system/components/KpiCard'
import { Modal } from '@/design-system/components/Modal'
import { SkeletonFilas, SkeletonText } from '@/design-system/components/Skeleton'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { fmtMoney } from '@/lib/utils'
import type { VistaPedido } from './components/PedidoTabs'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'
import {
    ApiError, applyCreditNote, createCreditNote, getCreditNotes, getOrders, sendOrderEmail,
    type ApiCreditNote, type ApiCreditNotesPage, type ApiOrderSummary,
} from '@/lib/api'

const COLS = '90px minmax(140px,1.3fr) 80px 110px 120px 100px 110px 130px'
// La tabla no entra en un celular: en vez de recortarla (que dejaba "Aplicar"
// inalcanzable) scrollea horizontal DENTRO de la tarjeta, como PedidoTable.
const MIN_TABLA = 840

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// El estado que se muestra: la base solo distingue emitida/aplicada — la
// vencida se deriva de la fecha.
function estadoDe(n: ApiCreditNote): 'vigente' | 'aplicada' | 'vencida' {
    if (n.status === 'APPLIED') return 'aplicada'
    if (n.expiresAt && new Date(n.expiresAt) < new Date()) return 'vencida'
    return 'vigente'
}

interface NotasCreditoProps {
    ir:      (vista: VistaPedido, id?: string) => void
    onToast: (msg: string) => void
}

export default function NotasCredito({ ir, onToast }: NotasCreditoProps) {
    // Emitir una nota y aplicar saldo mueven plata a favor del cliente: acción
    // de gestión, mismo gate que el resto de postventa.
    const { user } = useAuth()
    const puedeGestionar = user?.type === 'member' && user.permissions.includes('orders.manage')

    const [page, setPage]             = useState(1)
    const [datos, setDatos]           = useState<ApiCreditNotesPage | null>(null)
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [recarga, setRecarga]       = useState(0)
    const [aplicando, setAplicando]   = useState<string | null>(null)
    const [comprobante, setComprobante] = useState<string | null>(null)
    const [email, setEmail]           = useState<(ClienteEmail & { pedidoId: string }) | null>(null)

    // ── Modal de alta ──
    const [open, setOpen]         = useState(false)
    const [q, setQ]               = useState('')
    const [qLista, setQLista]     = useState('')
    const [resultados, setResultados] = useState<ApiOrderSummary[]>([])
    const [buscando, setBuscando] = useState(false)
    const [ped, setPed]           = useState<ApiOrderSummary | null>(null)
    const [monto, setMonto]       = useState('')
    const [tipo, setTipo]         = useState<'BALANCE' | 'REFUND'>('BALANCE')
    const [creando, setCreando]   = useState(false)
    const [errorMonto, setErrorMonto] = useState<string | null>(null)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        getCreditNotes({ page })
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudieron cargar las notas de crédito') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [page, recarga])

    // Búsqueda de pedidos del modal de alta (350ms desde la última tecla).
    useEffect(() => {
        const t = setTimeout(() => setQLista(q), 350)
        return () => clearTimeout(t)
    }, [q])
    useEffect(() => {
        if (!open || ped) return
        let cancelado = false
        setBuscando(true)
        getOrders({ search: qLista || undefined, limit: 4 })
            .then(r => { if (!cancelado) setResultados(r?.data ?? []) })
            .catch(() => { if (!cancelado) setResultados([]) })
            .finally(() => { if (!cancelado) setBuscando(false) })
        return () => { cancelado = true }
    }, [open, ped, qLista])

    const notas   = datos?.data ?? []
    const metrics = datos?.metrics
    const total   = datos?.total ?? 0
    const limite  = datos?.limit ?? 20
    const desde   = total === 0 ? 0 : (page - 1) * limite + 1
    const hasta   = Math.min(page * limite, total)

    const reset = () => { setPed(null); setQ(''); setQLista(''); setMonto(''); setTipo('BALANCE'); setErrorMonto(null) }

    const crear = async () => {
        if (!ped || creando) return
        const montoNum = parseInt(monto, 10) || 0
        // El error va al lado del campo, no como toast al pie de la pantalla:
        // el modal tapa el toast y el usuario no entiende por qué no pasa nada.
        if (montoNum <= 0) { setErrorMonto('Cargá un monto mayor a cero.'); return }
        if (montoNum > Math.round(ped.total)) { setErrorMonto(`El máximo es el total del pedido: ${fmtMoney(ped.total)}.`); return }
        setErrorMonto(null)
        setCreando(true)
        try {
            await createCreditNote({ orderId: ped.id, amount: montoNum, type: tipo })
            setOpen(false)
            reset()
            setRecarga(n => n + 1)
            onToast('Nota de crédito emitida')
        } catch (e) {
            // Adentro del modal, junto al campo: el toast del pie queda tapado
            // por el modal abierto y parecía que "no pasaba nada".
            setErrorMonto(e instanceof ApiError ? e.message : 'No se pudo emitir la nota.')
        } finally {
            setCreando(false)
        }
    }

    const aplicar = async (n: ApiCreditNote) => {
        if (aplicando) return
        setAplicando(n.id)
        try {
            await applyCreditNote(n.id)
            onToast(`Saldo de ${fmtMoney(n.amount)} aplicado`)
            setRecarga(x => x + 1)
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo aplicar la nota.')
        } finally {
            setAplicando(null)
        }
    }

    return (
        <div className="nc-page" style={pageWrap}>
            <style>{`
                .nc-field:focus-visible {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
                }
                .nc-monto-wrap:focus-within {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
                }
                .nc-iconbtn:focus-visible, .nc-rowbtn:focus-visible {
                    outline: 2px solid var(--color-primary);
                    outline-offset: 2px;
                }
                .nc-iconbtn:hover { background: var(--color-surface-alt); color: var(--color-text); }
                .nc-rowbtn:hover  { border-color: var(--color-primary); background: var(--color-primary-bg); }
                @media (max-width: 768px) {
                    .nc-page { padding: 16px 14px 48px !important; }
                    .nc-kpis { grid-template-columns: 1fr !important; }
                    .nc-field { font-size: 16px !important; }
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Postventa</h1>
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{cargando && !datos ? '…' : `${total} emitidas`}</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Gestioná los saldos a favor y reembolsos de tus clientes.</div>
                </div>
                {puedeGestionar && <Button variant="primary" icon={<FileText size={16} />} onClick={() => { reset(); setOpen(true) }}>Nueva nota</Button>}
            </div>

            {/* Switch de sub-sección (Devoluciones ↔ Notas de crédito) — el
                mismo que muestra Devoluciones, para que se sienta UNA sección. */}
            <div role="tablist" aria-label="Sección de postventa" style={{ display: 'inline-flex', gap: 2, padding: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16 }}>
                <button role="tab" aria-selected={false} onClick={() => ir('devoluciones')} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Devoluciones</button>
                <button role="tab" aria-selected style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'default', fontFamily: 'inherit' }}>Notas de crédito</button>
                <button role="tab" aria-selected={false} onClick={() => ir('cancelaciones')} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelaciones</button>
            </div>

            {/* KPIs reales */}
            <div className="nc-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Total emitido" value={metrics?.totalEmitido ?? 0} delta={0} prefix="$" accent="#3B82F6" icon={FileText} loading={!datos && !errorCarga} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>acumulado</span>} />
                <KpiCard label="Notas activas" value={metrics?.activas ?? 0} delta={0} accent="#10B981" icon={Check} loading={!datos && !errorCarga} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>vigentes</span>} />
                <KpiCard label="Vencen en 7 días" value={metrics?.porVencer ?? 0} delta={0} accent="#F59E0B" icon={Clock} loading={!datos && !errorCarga} footnote={<span style={{ fontSize: 11, color: 'var(--color-muted)' }}>requieren acción</span>} />
            </div>

            {/* Error con reintento */}
            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {/* Tabla — mientras carga, la silueta de las filas reales
                (avatar, cliente, chip de estado e importe) dentro del mismo
                recuadro, para que no salte el layout al llegar los datos. */}
            {cargando && !datos ? (
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <SkeletonFilas filas={5} />
                </div>
            ) : (
            /* Refetch con datos en pantalla (cambio de página): se atenúa y
               avisa, para que la espera no parezca una pantalla muerta. */
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflowX: 'auto', overflowY: 'hidden', position: 'relative', opacity: cargando ? 0.45 : 1, pointerEvents: cargando ? 'none' : 'auto', transition: 'opacity 180ms ease' }} aria-busy={cargando}>
                {cargando && (
                    /* Con fondo propio: flotando pelado se pisaba con el encabezado de la tabla. */
                    <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 5, fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '3px 10px', borderRadius: 9999, boxShadow: '0 2px 8px rgba(15,23,42,0.10)' }}>Actualizando…</div>
                )}
              <div style={{ minWidth: MIN_TABLA }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span># Nota</span><span>Cliente</span><span>Pedido</span><span>Monto</span><span>Tipo</span><span>Estado</span><span>Vence</span><span />
                </div>
                {notas.length === 0 ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6, maxWidth: '62ch', margin: '0 auto' }}>
                        Todavía no hay notas de crédito: se emiten solas al aprobar una devolución, o a mano desde "Nueva nota".
                    </div>
                ) : notas.map((n, i) => {
                    const estado = estadoDe(n)
                    return (
                        <div key={n.id} style={{ display: 'grid', gridTemplateColumns: COLS, minWidth: MIN_TABLA, alignItems: 'center', padding: '0 16px', height: 56, borderBottom: i < notas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }} title={n.id}>NC-{n.id.slice(0, 4).toUpperCase()}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Avatar name={n.customerName ?? 'Sin cliente'} size={26} />
                                <span style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.customerName ?? 'Sin cliente'}</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{n.orderNumber}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(n.amount)}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, width: 'fit-content', background: n.type === 'REFUND' ? 'var(--color-error-bg)' : 'var(--color-primary-bg)', color: n.type === 'REFUND' ? 'var(--chip-error-fg)' : 'var(--chip-primary-fg)' }}>{n.type === 'REFUND' ? 'Reembolso' : 'Saldo a favor'}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, width: 'fit-content', background: estado === 'aplicada' ? 'var(--color-surface-alt)' : estado === 'vencida' ? 'var(--color-error-bg)' : 'var(--color-success-bg)', color: estado === 'aplicada' ? 'var(--color-body)' : estado === 'vencida' ? 'var(--chip-error-fg)' : 'var(--chip-success-fg)' }}>{estado === 'aplicada' ? 'Aplicada' : estado === 'vencida' ? 'Vencida' : 'Vigente'}</span>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fechaCorta(n.expiresAt)}</span>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                                {estado === 'vigente' && puedeGestionar && (
                                    <Button variant="outline" size="sm" loading={aplicando === n.id} onClick={() => void aplicar(n)}>Aplicar</Button>
                                )}
                                <button onClick={() => setComprobante(n.orderId)} aria-label={`Ver pedido #${n.orderNumber}`} className="nc-iconbtn" style={iconBtn}><Eye size={15} /></button>
                                <button onClick={() => setEmail({ nombre: n.customerName ?? 'Cliente', email: n.customerEmail ?? '', pedidoId: n.orderId })} aria-label={`Enviar email a ${n.customerName ?? 'el cliente'}`} className="nc-iconbtn" style={iconBtn}><Mail size={15} /></button>
                            </div>
                        </div>
                    )
                })}
              </div>
            </div>
            )}

            {/* Paginación */}
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

            {/* Modal nueva nota (emisión manual sobre un pedido real) */}
            <Modal
                isOpen={open}
                onClose={() => setOpen(false)}
                title="Nueva nota de crédito"
                maxWidth={560}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={creando}>Cancelar</Button>
                        <Button variant="primary" disabled={!ped || !monto} loading={creando} onClick={() => void crear()}>Emitir nota de crédito</Button>
                    </>
                }
            >
                <label htmlFor="nc-buscar-pedido" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Pedido de origen</label>
                {ped ? (
                    <div style={{ background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <Avatar name={ped.customerName ?? 'Sin cliente'} size={34} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>#{ped.orderNumber} · {ped.customerName ?? 'Sin cliente'}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>Total {fmtMoney(ped.total)}</div>
                        </div>
                        <button onClick={() => { setPed(null); setErrorMonto(null) }} className="nc-iconbtn" style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '12px 10px', margin: '-12px -10px', minHeight: 44, borderRadius: 6 }}>Cambiar</button>
                    </div>
                ) : (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                            <input id="nc-buscar-pedido" className="nc-field" value={q} onChange={e => setQ(e.target.value)} placeholder="# Pedido o cliente…" style={{ ...inputBase, height: 44, paddingLeft: 34, paddingRight: 12, fontSize: 13 }} />
                        </div>
                        {buscando ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                                        <SkeletonText width={30} height={12} delay={i * 90} />
                                        <div style={{ flex: 1 }}><SkeletonText width={['52%', '38%', '60%'][i % 3]} height={12} delay={i * 90 + 40} /></div>
                                        <SkeletonText width={58} height={11} delay={i * 90 + 70} />
                                    </div>
                                ))}
                            </div>
                        ) : resultados.length === 0 ? (
                            <div style={{ padding: '14px 8px', fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>No hay pedidos que coincidan.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {resultados.map(p => (
                                    <button key={p.id} onClick={() => { setPed(p); setMonto(String(Math.floor(p.total))); setErrorMonto(null) }} className="nc-rowbtn" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, minHeight: 44, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color 150ms ease, background 150ms ease' }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{p.orderNumber}</span>
                                        <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>{p.customerName ?? 'Sin cliente'}</span>
                                        <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.total)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {ped && (
                    <>
                        <label htmlFor="nc-monto" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>Monto</label>
                        <div className="nc-monto-wrap" style={{ display: 'flex', alignItems: 'center', height: 48, padding: '0 14px', background: 'var(--color-bg)', border: `1px solid ${errorMonto ? 'var(--color-error)' : 'var(--color-border)'}`, borderRadius: 8, marginBottom: 4, transition: 'border-color 150ms ease, box-shadow 150ms ease' }}>
                            <span style={{ color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', fontSize: 18 }}>$</span>
                            <input id="nc-monto" inputMode="numeric" value={monto} onChange={e => { setMonto(e.target.value.replace(/\D/g, '')); setErrorMonto(null) }} style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', paddingLeft: 6 }} />
                        </div>
                        {errorMonto
                            ? <div role="alert" style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 16 }}>{errorMonto}</div>
                            : <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 16 }}>El monto máximo es el total del pedido: {fmtMoney(ped.total)} · vence a los 6 meses</div>}

                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 8 }}>Tipo de nota</label>
                        <div role="radiogroup" aria-label="Tipo de nota" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {([['BALANCE', 'Saldo a favor', 'Lo usa en su próxima compra', true], ['REFUND', 'Reembolso', 'Devolver el dinero', false]] as ['BALANCE' | 'REFUND', string, string, boolean][]).map(([id, l, d, rec]) => {
                                const a = tipo === id
                                return (
                                    <button key={id} onClick={() => setTipo(id)} className="nc-rowbtn" role="radio" aria-checked={a} style={{ padding: 12, border: `${a ? 2 : 1}px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, background: a ? 'var(--color-primary-bg)' : 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{l}</span>
                                            {rec && <span style={{ display: 'inline-flex', alignItems: 'center', height: 16, padding: '0 6px', borderRadius: 9999, background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 9, fontWeight: 600 }}>Recomendado</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{d}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
            </Modal>

            {/* El ojito "Ver pedido" abre directo el comprobante real con su botón
                de Imprimir — sin el resumen intermedio que pedía otro click. */}
            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} id={comprobante ?? undefined} onToast={onToast} abrirDirecto />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} onToast={onToast} onEnviar={async (a, c) => { await sendOrderEmail(email.pedidoId, a, c) }} />}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)',
    border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)',
    fontFamily: 'inherit', outline: 'none',
}
const iconBtn: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 6, border: 'none', background: 'transparent',
    color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center',
    transition: 'background 150ms ease, color 150ms ease',
}
