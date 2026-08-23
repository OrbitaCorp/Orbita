import { useEffect, useMemo, useState } from 'react'
import { FileText, Mail, X } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { Badge } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { fmtMoney } from '@/lib/utils'
import type { EstadoPedido, Pedido } from '../types/pedidos.types'

// Columna de estado: 184px, no 148 — "Devolución pendiente"/"Devolución
// aprobada" (lo que reemplaza al chip normal cuando aplica) no entraba en
// el ancho pensado solo para "Confirmado"/"En preparación".
const COLS = '36px 90px 1.3fr 1.6fr 112px 120px 184px 140px 96px'

const ESTADO_COLORS: Record<string, string> = {
    pendiente:   '#F59E0B',
    confirmado:  '#10B981',
    preparacion: '#8B5CF6',
    enviado:     '#3B82F6',
    entregado:   '#94A3B8',
    cancelado:   '#EF4444',
}

// Las mismas reglas del backend (y del detalle): desde cada estado, a cuáles
// se puede pasar. Hacia adelante se puede saltear pasos; nunca hacia atrás.
// Cancelar solo antes de "En preparación" — a partir de ahí, cualquier
// problema se resuelve como devolución, no como cancelación. Entregado y
// cancelado son finales.
const PERMITIDAS: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
    pendiente:   ['confirmado', 'preparacion', 'enviado', 'entregado', 'cancelado'],
    confirmado:  ['preparacion', 'enviado', 'entregado', 'cancelado'],
    preparacion: ['enviado', 'entregado'],
    enviado:     ['entregado'],
}

const ESTADO_LABEL: Record<EstadoPedido, string> = {
    pendiente:   'Pendiente',
    confirmado:  'Confirmado',
    preparacion: 'En preparación',
    enviado:     'Enviado',
    entregado:   'Entregado',
    cancelado:   'Cancelado',
}

// Todos los chips de estado de la tabla con el MISMO ancho, para que la
// columna quede pareja (como Tienda/Manual en el canal) en vez de que cada
// chip mida según su texto. Entra "Confirmado" con punto y flechita.
// TODOS los chips de estado con el mismo ancho — incluidos los de devolución,
// que antes quedaban sin ancho fijo y se veían más grandes que el resto
// (columna serruchada). 160 hace entrar el texto más largo ("Devolución
// pendiente") y también "En preparación" con su flechita.
const ANCHO_ESTADO = 160

// Qué mostrar en el chip de estado — antes un pedido "Entregado" con
// devolución aprobada se veía IDÉNTICO a uno sin ninguna, había que abrir
// cada uno para enterarse. Con devolución, el chip pasa a decir eso en vez
// del estado (que solo puede ser Entregado/Completado para tener una
// devolución — la regla de negocio ya lo exige, así que no se pierde
// información real, solo se prioriza lo más relevante en ese momento):
// naranja "Devolución pendiente" o verde "Devolución aprobada", mismo
// tamaño/lugar que el chip de siempre. `status` solo elige el color de
// Badge (pendiente=naranja, entregado=verde); `label` pisa el texto.
function estadoBadgeProps(p: Pedido): { status: EstadoPedido; label?: string } {
    if (p.devolucionAprobada) return { status: 'entregado', label: 'Devolución aprobada' }
    if (p.devolucionPendiente) return { status: 'pendiente', label: 'Devolución pendiente' }
    if (p.cancelacionPendiente) return { status: 'pendiente', label: 'Cancelación pedida' }
    return { status: p.estado }
}

// Qué dice el tooltip del chip de cancelación — el método que pidió el
// cliente (nota de crédito / reembolso MP) de un vistazo, sin tener que
// entrar a Cancelaciones para enterarse antes de resolverla.
function tituloCancelacion(p: Pedido): string {
    if (p.cancelacionMetodo === 'CREDIT_NOTE') return 'Cancelación pedida — el cliente eligió nota de crédito. Click para resolver.'
    if (p.cancelacionMetodo === 'REFUND') return 'Cancelación pedida — el cliente eligió reembolso por Mercado Pago. Click para resolver.'
    return 'Cancelación pedida — click para resolver.'
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
        background: canal === 'Tienda' ? 'var(--color-primary-bg)' : 'var(--color-warning-bg)',
        color:      canal === 'Tienda' ? 'var(--color-primary)'    : 'var(--color-warning)',
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
    // Cambio de estado directo desde la fila, sin entrar al detalle: el chip
    // de estado se vuelve un botón con menú. Solo llega si el rol puede
    // gestionar pedidos; sin esto el chip queda como siempre, de lectura.
    onCambiarEstado?:  (p: Pedido, nuevo: EstadoPedido) => void
    cambiandoEstadoId?: string | null
    // Con una devolución o cancelación PENDIENTE, el chip lleva a Postventa a
    // resolverla (se manejan ahí — rechazo con motivo, elegir el método de
    // reembolso, etc. — no con un atajo desde la fila). Recibe el pedido
    // para poder mandar a la pestaña que corresponda (Devoluciones o
    // Cancelaciones). La devolución aprobada es final: chip fijo.
    onVerPostventa?:   (p: Pedido) => void
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

            {/* Estado — reemplazado por "Devolución pendiente/aprobada" cuando
                corresponde, mismo lugar y tamaño que el chip de siempre. */}
            <div><Badge {...estadoBadgeProps(p)} size="sm" /></div>

            {/* Cliente */}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>

            {/* Monto */}
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.monto)}</div>

            {/* Productos — con "—" cuando no hay renglones (una celda vacía
                parecía un error de carga) */}
            <div style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.productos.length > 0 ? p.productos.map(x => `${x.cantidad}× ${x.nombre}`).join(' · ') : '—'}
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
export function PedidoTable({ rows, onRowClick, onComprobante, onEmail, onConfirmarLote, onEtiquetas, onEmailLote, onCambiarEstado, cambiandoEstadoId, onVerPostventa }: PedidoTableProps) {
    const [sel,     setSel]     = useState<Set<string>>(new Set())
    const [hovered, setHovered] = useState<string | null>(null)
    // El menú de estado abierto: de qué fila es y dónde dibujarlo. Va con
    // position:fixed (coordenadas del chip) porque la tabla tiene
    // overflow:hidden y un menú absoluto quedaría cortado en las filas de abajo.
    const [menuEstado, setMenuEstado] = useState<{ id: string; x: number; y: number } | null>(null)

    // Al cambiar el conjunto de filas (paginar, cambiar de pestaña, buscar o
    // recargar) la selección deja de tener sentido: se limpia. Sin esto, la
    // barra de acciones en lote operaba sobre ids que ya no están en pantalla
    // (confirmar/etiquetas sobre pedidos de la vista anterior).
    const idsKey = useMemo(() => rows.map(r => r.id).join(','), [rows])
    useEffect(() => { setSel(new Set()); setMenuEstado(null) }, [idsKey])

    // Un click en cualquier otro lado cierra el menú de estado (el botón que
    // lo abre corta la propagación, así que no se pisa con esta escucha).
    useEffect(() => {
        if (!menuEstado) return
        const cerrar = () => setMenuEstado(null)
        document.addEventListener('click', cerrar)
        return () => document.removeEventListener('click', cerrar)
    }, [menuEstado])

    const toggle = (id: string) => setSel(s => {
        const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
    })

    return (
        <>
            <style>{`
                .ped-table-wrap { display: block; }
                .ped-cards-wrap { display: none; }
                /* El chip-botón de estado se aviva apenas al pasar el mouse (opción
                   elegida: flecha integrada adentro del pill, siempre visible). */
                .ped-estado-btn:hover:not(:disabled) { filter: brightness(0.96) saturate(1.35); }
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
                                {p.productos.length > 0 ? p.productos.map(x => `${x.cantidad}× ${x.nombre}`).join(' · ') : '—'}
                            </span>
                            {canalChip(p.canal)}
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.monto)}</span>
                            {/* Con una devolución o cancelación encima (aprobada o pendiente),
                                el chip deja de ser botón: la plata ya se devolvió (o está por
                                resolverse en Postventa) — ofrecer "En preparación/Enviado/
                                Entregado" ahí no tiene sentido y confundía. */}
                            {onCambiarEstado && !p.devolucionAprobada && !p.devolucionPendiente && !p.cancelacionPendiente && (PERMITIDAS[p.estado]?.length ?? 0) > 0 ? (
                                /* El chip de estado como botón: abre el menú con los saltos
                                   válidos, sin tener que entrar al detalle del pedido. */
                                <div onClick={e => e.stopPropagation()} style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                        className="ped-estado-btn"
                                        title="Cambiar estado"
                                        disabled={cambiandoEstadoId === p.id}
                                        onClick={e => {
                                            const r = e.currentTarget.getBoundingClientRect()
                                            setMenuEstado(m => m?.id === p.id ? null : { id: p.id, x: r.left, y: r.bottom + 4 })
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: cambiandoEstadoId === p.id ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: cambiandoEstadoId === p.id ? 0.55 : 1, transition: 'filter 150ms' }}
                                    >
                                        <Badge {...estadoBadgeProps(p)} size="sm" caret width={ANCHO_ESTADO} />
                                    </button>
                                    {menuEstado?.id === p.id && (
                                        <div style={{ position: 'fixed', left: menuEstado.x, top: menuEstado.y, zIndex: 400, minWidth: 176, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,.14)', overflow: 'hidden' }}>
                                            {(PERMITIDAS[p.estado] ?? []).filter(x => x !== 'cancelado').map(x => (
                                                <button key={x} onClick={() => { setMenuEstado(null); onCambiarEstado(p, x) }} style={menuItem}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_COLORS[x], flexShrink: 0 }} />
                                                    {ESTADO_LABEL[x]}
                                                </button>
                                            ))}
                                            {(PERMITIDAS[p.estado] ?? []).includes('cancelado') && (
                                                <button onClick={() => { setMenuEstado(null); onCambiarEstado(p, 'cancelado') }} style={{ ...menuItem, color: 'var(--color-error)', borderTop: '1px solid var(--color-border)' }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_COLORS.cancelado, flexShrink: 0 }} />
                                                    Cancelar pedido
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                (p.devolucionPendiente || p.cancelacionPendiente) && onVerPostventa ? (
                                    /* Devolución o cancelación pendiente: el chip lleva a
                                       Postventa a resolverla (aprobar, o rechazar con su
                                       motivo) — a la pestaña que corresponda. */
                                    <button
                                        title={p.cancelacionPendiente ? tituloCancelacion(p) : 'Resolver en Cancelaciones y devoluciones'}
                                        onClick={e => { e.stopPropagation(); onVerPostventa(p) }}
                                        style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        <Badge {...estadoBadgeProps(p)} size="sm" caret width={ANCHO_ESTADO} />
                                    </button>
                                ) : (
                                /* Sin permiso, estado final o devolución aprobada: mismo
                                   ancho fijo SIEMPRE, así la columna queda pareja. */
                                <span>
                                    <Badge {...estadoBadgeProps(p)} size="sm" width={ANCHO_ESTADO} />
                                </span>
                                )
                            )}
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

const menuItem: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
    border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, color: 'var(--color-text)', textAlign: 'left',
}
