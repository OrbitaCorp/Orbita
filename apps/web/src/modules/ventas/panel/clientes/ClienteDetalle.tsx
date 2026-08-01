// src/modules/ventas/panel/clientes/ClienteDetalle.tsx — Vista 10
// Perfil de un cliente: KPIs, pestañas (pedidos/notas/info/actividad), acciones.
//
// (Fase 3 — Ale, 01/08) Antes era 100% maqueta. Ahora todo sale de
// GET /customers/:id: los KPIs calculados al leer, los pedidos con acceso al
// detalle, la info completa (con las direcciones guardadas) y la actividad
// real — registro, compras y los emails que le mandamos (email_logs).
//
// Dos decisiones del contrato que esta pantalla respeta:
// - Las notas internas quedaron FUERA de V1 (sin tabla ni endpoint): la
//   pestaña lo dice tal cual, en vez de mostrar notas de mentira.
// - "Segmento" y "tags" no existen en la base: el badge es la misma etiqueta
//   derivada de los números que ya usa la lista, y las tags se fueron.

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Mail, Plus, TrendingUp, Eye, Banknote, ShoppingBag, BarChart3, Clock, MapPin, StickyNote } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Badge } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Loader } from '@/design-system/components/Loader'
import { fmtMoney } from '@/lib/utils'
import { StatCard } from '../_shared/StatCard'
import { SegmentoBadge } from './components/SegmentoBadge'
import { ModalEmail } from '../pedidos/components/ModalEmail'
import { ApiError, getCustomer, sendCustomersEmail, type ApiCustomerDetail, type ApiOrderStatus } from '@/lib/api'
import type { Segmento } from './types/clientes.types'
import type { EstadoPedido } from '../pedidos/types/pedidos.types'

type TabKey = 'pedidos' | 'notas' | 'info' | 'actividad'

// Misma traducción de estados que usa la lista.
const ESTADO_UI: Record<ApiOrderStatus, EstadoPedido> = {
    PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'preparacion',
    SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'entregado', CANCELLED: 'cancelado',
}

// La misma etiqueta derivada de los números que calcula la lista.
function segmentoDe(c: ApiCustomerDetail): Segmento {
    const dias = c.lastOrderAt ? Math.floor((Date.now() - new Date(c.lastOrderAt).getTime()) / 86400000) : null
    return c.orderCount === 0 ? 'nuevo' : dias != null && dias > 60 ? 'inactivo' : c.orderCount >= 5 ? 'vip' : 'recurrente'
}

function relTime(iso: string | null): string {
    if (!iso) return 'Sin compras'
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days <= 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    if (days < 30) return `Hace ${days} días`
    const meses = Math.floor(days / 30)
    return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso: string) {
    const d = new Date(iso)
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() : ''}`.trim()
}

interface ClienteDetalleProps {
    id:         string
    onVolver:   () => void
    irPedido:   (id: string) => void
    irNuevo:    () => void
    irReportes: () => void
}

export default function ClienteDetalle({ id, onVolver, irPedido, irNuevo, irReportes }: ClienteDetalleProps) {
    const [datos, setDatos]           = useState<ApiCustomerDetail | null>(null)
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [reintento, setReintento]   = useState(0)
    const [tab, setTab]               = useState<TabKey>('pedidos')
    const [emailOpen, setEmailOpen]   = useState(false)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        getCustomer(id)
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar el cliente') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [id, reintento])

    // La línea de tiempo real: registro + cada pedido + cada email enviado,
    // todo mezclado y ordenado del más nuevo al más viejo.
    const actividad = useMemo(() => {
        if (!datos) return []
        const eventos: { fecha: string; color: string; texto: string; detalle?: string }[] = [
            ...datos.orders.map(o => ({
                fecha: o.createdAt,
                color: o.status === 'CANCELLED' ? 'var(--color-error)' : 'var(--color-primary)',
                texto: o.status === 'CANCELLED' ? `Canceló el pedido #${o.orderNumber}` : `Realizó el pedido #${o.orderNumber}`,
                detalle: fmtMoney(o.total),
            })),
            ...datos.emails.map(e => ({
                fecha: e.createdAt,
                color: e.status === 'FAILED' ? 'var(--color-error)' : 'var(--color-success)',
                texto: e.status === 'FAILED' ? `Falló el envío de "${e.subject}"` : `Le enviamos "${e.subject}"`,
                detalle: e.status === 'SIMULATED' ? 'simulado (sin mail configurado)' : undefined,
            })),
            { fecha: datos.createdAt, color: 'var(--color-success)', texto: 'Se registró como cliente' },
        ]
        return eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    }, [datos])

    // ── Cargando / error ──
    if (cargando && !datos) {
        return <div style={pageWrap}><Loader message="Cargando cliente…" style={{ padding: '96px 0' }} /></div>
    }
    if (errorCarga || !datos) {
        return (
            <div style={pageWrap}>
                <div style={{ border: '1px dashed var(--color-error)', borderRadius: 12, padding: '32px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--color-error)', marginBottom: 12 }}>{errorCarga ?? 'No se pudo cargar el cliente'}</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <Button variant="outline" size="sm" onClick={onVolver}>← Volver a la lista</Button>
                        <Button variant="primary" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                    </div>
                </div>
            </div>
        )
    }

    const c = datos
    const nombre = `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`
    const contacto = [c.email, c.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'

    const filasInfo: [string, string][] = [
        ['Nombre', nombre],
        ['Email', c.email ?? 'Sin email'],
        ['Teléfono', c.phone ?? 'Sin teléfono'],
        ['DNI', c.dni ?? 'Sin DNI'],
        ['Cuenta', c.hasAccount ? 'Con cuenta en la tienda online' : 'Creado desde el panel (sin cuenta)'],
        ['Cliente desde', fechaCorta(c.createdAt)],
    ]

    return (
        <div className="clidet-page" style={pageWrap}>
            <style>{`
                @media (max-width: 900px) {
                    .clidet-page  { padding: 16px 14px 48px !important; }
                    .clidet-kpis  { grid-template-columns: repeat(2,1fr) !important; }
                    .clidet-cols  { grid-template-columns: 1fr !important; }
                }
            `}</style>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>
                <button onClick={onVolver} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0 }}>Lista</button>
                <ChevronRight size={12} />
                <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{nombre}</span>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Avatar name={nombre} size={56} />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{nombre}</h1>
                            <SegmentoBadge segmento={segmentoDe(c)} />
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginTop: 2 }}>{contacto}</div>
                    </div>
                </div>
                <Button variant="outline" icon={<Mail size={15} />} onClick={() => setEmailOpen(true)}>Email</Button>
            </div>

            {/* KPIs reales (calculados por el backend al leer) */}
            <div className="clidet-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard label="Total gastado" value={fmtMoney(c.totalSpent)} icon={Banknote} accent="#3B82F6" />
                <StatCard label="Pedidos" value={c.orderCount} icon={ShoppingBag} accent="#10B981" />
                <StatCard label="Ticket prom" value={fmtMoney(c.avgTicket)} icon={BarChart3} accent="#8B5CF6" />
                <StatCard label="Última compra" value={relTime(c.lastOrderAt)} icon={Clock} accent="#F59E0B" />
            </div>

            <div className="clidet-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 16, alignItems: 'start' }}>
                {/* Pestañas */}
                <Card padding="md" style={{ padding: 0 }}>
                    <div style={{ display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid var(--color-border)' }}>
                        {([['pedidos', 'Pedidos'], ['notas', 'Notas'], ['info', 'Info'], ['actividad', 'Actividad']] as [TabKey, string][]).map(([k, l]) => {
                            const a = tab === k
                            return (
                                <button key={k} onClick={() => setTab(k)} style={{ padding: '12px 4px', marginRight: 16, border: 'none', background: 'transparent', color: a ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: 13.5, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', borderBottom: `2px solid ${a ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1, transition: 'color 150ms, border-color 150ms' }}>{l}</button>
                            )
                        })}
                    </div>
                    <div style={{ padding: 20 }}>
                        {/* ── Pedidos reales, con acceso al detalle ── */}
                        {tab === 'pedidos' && (c.orders.length === 0 ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Todavía no tiene pedidos.</div>
                        ) : c.orders.map((o, i) => (
                            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '70px 90px 1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < c.orders.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>#{o.orderNumber}</span>
                                <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fechaCorta(o.createdAt)}</span>
                                <Badge status={ESTADO_UI[o.status]} size="sm" />
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(o.total)}</span>
                                <button onClick={() => irPedido(o.id)} aria-label={`Ver pedido #${o.orderNumber}`} style={iconBtn}><Eye size={15} /></button>
                            </div>
                        )))}

                        {/* ── Notas: fuera de V1 por contrato — se dice, no se inventa ── */}
                        {tab === 'notas' && (
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0' }}>
                                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <StickyNote size={16} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Las notas internas llegan más adelante</div>
                                    <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                                        Todavía no se guardan en el sistema (quedaron fuera de esta versión).
                                        Cuando estén, el equipo va a poder dejar acá comentarios como
                                        «paga siempre por transferencia» o «prefiere envíos a la mañana».
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Info completa ── */}
                        {tab === 'info' && filasInfo.map(([k, v], i) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: i < filasInfo.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <span style={{ fontSize: 13, color: 'var(--color-muted)', flexShrink: 0 }}>{k}</span>
                                <span style={{ fontSize: 13, color: 'var(--color-text)', textAlign: 'right', fontFamily: /Email|Teléfono|DNI|desde/.test(k) ? '"Geist Mono", monospace' : 'inherit' }}>{v}</span>
                            </div>
                        ))}

                        {/* ── Actividad real ── */}
                        {tab === 'actividad' && (actividad.length === 0 ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Sin actividad todavía.</div>
                        ) : actividad.map((ev, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < actividad.length - 1 ? 16 : 0 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, marginTop: 3, flexShrink: 0 }} />
                                    {i < actividad.length - 1 && <span style={{ width: 2, flex: 1, background: 'var(--color-border)', marginTop: 4 }} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: 'var(--color-text)' }}>
                                        {ev.texto}
                                        {ev.detalle && <span style={{ color: 'var(--color-muted)' }}> · {ev.detalle}</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginTop: 2 }}>{fechaCorta(ev.fecha)}</div>
                                </div>
                            </div>
                        )))}
                    </div>
                </Card>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Acciones rápidas</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Button variant="primary" icon={<Plus size={15} />} onClick={irNuevo} style={{ justifyContent: 'center' }}>Nuevo pedido</Button>
                            <Button variant="outline" icon={<Mail size={15} />} onClick={() => setEmailOpen(true)} style={{ justifyContent: 'center' }}>Enviar email</Button>
                            <Button variant="outline" icon={<TrendingUp size={15} />} onClick={irReportes} style={{ justifyContent: 'center' }}>Ver en reportes</Button>
                        </div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Direcciones</div>
                        {c.addresses.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                                Sin direcciones guardadas — se cargan solas cuando el cliente compra online con envío.
                            </div>
                        ) : c.addresses.map((a, i) => (
                            <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < c.addresses.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <MapPin size={15} style={{ color: 'var(--color-muted)', flexShrink: 0, marginTop: 2 }} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: 'var(--color-text)' }}>
                                        {a.street}{a.floor ? `, ${a.floor}` : ''}
                                        {a.isDefault && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', borderRadius: 9999, padding: '1px 7px' }}>Predeterminada</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{a.city}{a.zip ? ` (${a.zip})` : ''}{a.alias ? ` · ${a.alias}` : ''}</div>
                                </div>
                            </div>
                        ))}
                    </Card>
                </div>
            </div>

            {/* Email real: reusa el endpoint del envío a clientes */}
            <ModalEmail
                isOpen={emailOpen}
                onClose={() => setEmailOpen(false)}
                cliente={{ nombre, email: c.email ?? '' }}
                onEnviar={async (a, b) => {
                    const r = await sendCustomersEmail([c.id], a, b)
                    if (!r.sent) throw new Error('El proveedor de email rechazó el envío. Probá de nuevo en un rato.')
                }}
            />
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
