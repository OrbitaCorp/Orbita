import { useEffect, useMemo, useState } from 'react'
import { FileText, Mail, X } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { Badge } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { fmtMoney } from '@/lib/utils'
import type { Pedido } from '../types/pedidos.types'

const COLS = '36px 90px 1.3fr 1.6fr 112px 120px 148px 140px 96px'

const ESTADO_COLORS: Record<string, string> = {
    pendiente:   '#F59E0B',
    confirmado:  '#10B981',
    preparacion: '#8B5CF6',
    enviado:     '#3B82F6',
    entregado:   '#94A3B8',
    cancelado:   '#EF4444',
}

function fechaCorta(iso: string): string {
    const d = new Date(iso)
    const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${d.getDate()} ${m[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const canalChip = (canal: Pedido['canal']) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
        borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
        background: canal === 'Online' ? 'var(--color-primary-bg)' : 'var(--color-warning-bg)',
        color:      canal === 'Online' ? 'var(--color-primary)'    : 'var(--color-warning)',
    }}>
        {canal}
    </span>
)

interface PedidoTableProps {
    rows:          Pedido[]
    onRowClick:    (p: Pedido) => void
    onComprobante: (p: Pedido) => void
    onEmail:       (p: Pedido) => void
    // (Fase 2 — Alex) Acciones masivas: la barra de selección le avisa al padre
    // qué pedidos están tildados. Opcionales para no romper otros usos.
    onConfirmarLote?: (ids: string[]) => void
    onEtiquetas?:     (ids: string[]) => void
    onEmailLote?:     (ids: string[]) => void
}

// ── Card mobile ────────────────────────────────────────────────────────────────
function PedidoCard({ p, onRowClick, onComprobante, onEmail }: { p: Pedido } & Omit<PedidoTableProps, 'rows'>) {
    const accentColor = ESTADO_COLORS[p.estado] ?? 'var(--color-border)'
    const [hov, setHov] = useState(false)
    return (
        <div
            onClick={() => onRowClick(p)}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background:   hov ? 'var(--color-surface)' : 'var(--color-bg)',
                border:       '1px solid var(--color-border)',
                borderLeft:   `3px solid ${accentColor}`,
                borderRadius: 10,
                padding:      '12px 12px 10px',
                cursor:       'pointer',
                transition:   'background 150ms',
                display:      'flex',
                flexDirection:'column',
                gap:          5,
            }}
        >
            {/* id + canal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{p.numero ?? p.id}</span>
                {canalChip(p.canal)}
            </div>

            {/* Estado */}
            <div><Badge status={p.estado} size="sm" /></div>

            {/* Cliente */}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>

            {/* Monto */}
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.monto)}</div>

            {/* Productos */}
            <div style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.productos.map(x => `${x.cantidad}× ${x.nombre}`).join(' · ')}
            </div>

            {/* fecha + acciones */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{fechaCorta(p.fecha)}</span>
                <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                    <button title="Comprobante" onClick={() => onComprobante(p)} style={iconBtn}><FileText size={13} /></button>
                    <button title="Email"        onClick={() => onEmail(p)}        style={iconBtn}><Mail size={13} /></button>
                </div>
            </div>
        </div>
    )
}

// ── Tabla + Cards ──────────────────────────────────────────────────────────────
export function PedidoTable({ rows, onRowClick, onComprobante, onEmail, onConfirmarLote, onEtiquetas, onEmailLote }: PedidoTableProps) {
    const [sel,     setSel]     = useState<Set<string>>(new Set())
    const [hovered, setHovered] = useState<string | null>(null)

    // Al cambiar el conjunto de filas (paginar, cambiar de pestaña, buscar o
    // recargar) la selección deja de tener sentido: se limpia. Sin esto, la
    // barra de acciones en lote operaba sobre ids que ya no están en pantalla
    // (confirmar/etiquetas sobre pedidos de la vista anterior).
    const idsKey = useMemo(() => rows.map(r => r.id).join(','), [rows])
    useEffect(() => { setSel(new Set()) }, [idsKey])

    const toggle = (id: string) => setSel(s => {
        const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
    })

    return (
        <>
            <style>{`
                .ped-table-wrap { display: block; }
                .ped-cards-wrap { display: none; }
                @media (max-width: 768px) {
                    .ped-table-wrap { display: none !important; }
                    .ped-cards-wrap { display: grid !important; grid-template-columns: 1fr !important; }
                }
            `}</style>

            {/* ── Barra de selección masiva (solo desktop) ── */}
            {sel.size > 0 && (
                <div className="ped-table-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--color-primary-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>{sel.size} seleccionados</span>
                    <div style={{ flex: 1 }} />
                    {onConfirmarLote && <Button variant="outline" size="sm" onClick={() => { onConfirmarLote([...sel]); setSel(new Set()) }}>Confirmar</Button>}
                    {onEtiquetas && <Button variant="outline" size="sm" onClick={() => onEtiquetas([...sel])}>Imprimir etiquetas</Button>}
                    {onEmailLote && <Button variant="outline" size="sm" onClick={() => onEmailLote([...sel])}>Email masivo</Button>}
                    <button onClick={() => setSel(new Set())} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                        <X size={14} strokeWidth={1.8} />
                    </button>
                </div>
            )}

            {/* ── DESKTOP: tabla ── */}
            <div className="ped-table-wrap" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Encabezado */}
                <div style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 16, alignItems: 'center', padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <input
                        type="checkbox"
                        checked={sel.size === rows.length && rows.length > 0}
                        onChange={() => setSel(sel.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))}
                        style={{ width: 15, height: 15, accentColor: 'var(--color-primary)' }}
                    />
                    <span># Pedido</span><span>Cliente</span><span>Productos</span><span>Canal</span><span>Monto</span><span>Estado</span><span>Fecha</span>
                    <span style={{ textAlign: 'right' }}>Acciones</span>
                </div>

                {/* Filas */}
                {rows.map((p, i) => {
                    const s = sel.has(p.id)
                    return (
                        <div
                            key={p.id}
                            onClick={() => onRowClick(p)}
                            onMouseEnter={() => setHovered(p.id)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display: 'grid', gridTemplateColumns: COLS, columnGap: 16, alignItems: 'center',
                                padding: '0 16px', height: 52,
                                borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                                background: s ? 'var(--color-primary-bg)' : hovered === p.id ? 'var(--color-surface)' : 'transparent',
                                cursor: 'pointer', transition: 'background 150ms',
                            }}
                        >
                            <input type="checkbox" checked={s} onClick={e => e.stopPropagation()} onChange={() => toggle(p.id)} style={{ width: 15, height: 15, accentColor: 'var(--color-primary)' }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{p.numero ?? p.id}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Avatar name={p.cliente} size={26} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cliente}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</div>
                                </div>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--color-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.productos.map(x => `${x.cantidad}× ${x.nombre}`).join(' · ')}
                            </span>
                            {canalChip(p.canal)}
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.monto)}</span>
                            <Badge status={p.estado} size="sm" />
                            <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fechaCorta(p.fecha)}</span>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }} onClick={e => e.stopPropagation()}>
                                <button title="Comprobante" onClick={() => onComprobante(p)} style={iconBtn}><FileText size={15} /></button>
                                <button title="Email"        onClick={() => onEmail(p)}        style={iconBtn}><Mail size={15} /></button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── MOBILE: cards 2 columnas ── */}
            <div className="ped-cards-wrap" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                {rows.map(p => (
                    <PedidoCard
                        key={p.id} p={p}
                        onRowClick={onRowClick}
                        onComprobante={onComprobante}
                        onEmail={onEmail}
                    />
                ))}
            </div>
        </>
    )
}

const iconBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
    color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center',
}
