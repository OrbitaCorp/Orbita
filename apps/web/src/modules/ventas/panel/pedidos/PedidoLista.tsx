// src/modules/ventas/panel/pedidos/PedidoLista.tsx — Vista 02 + hub del módulo
//
// Este componente es el punto de entrada del módulo `pedidos` (registrado en el
// componentMap del router admin). Funciona como HUB: según `router.query.vista`
// renderiza la sub-vista correspondiente, igual que ProductoLista en catálogo.
//
//   /admin/[negocioId]/ventas/pedidos                  → lista (esta vista, V02)
//   …/pedidos?vista=detalle&id=1284                    → PedidoDetalle (V03)
//   …/pedidos?vista=nuevo                              → PedidoNuevo (V04)
//   …/pedidos?vista=historial                          → PedidoHistorial (V05)
//   …/pedidos?vista=devoluciones                       → Devoluciones (V06)
//   …/pedidos?vista=notas                              → NotasCredito (V07)

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Download, Plus, Search, Clock, ChevronDown, Globe, Store } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { toastEsError } from '@/lib/utils'
import { SkeletonFilas } from '@/design-system/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, getOrders, getOrder, sendOrderEmail, updateOrderStatus, type ApiOrderDetail, type ApiOrdersPage, type ApiOrderStatus, type ApiOrderSummary } from '@/lib/api'

import type { VistaPedido } from './components/PedidoTabs'
import { PedidoTable } from './components/PedidoTable'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail, type ClienteEmail } from './components/ModalEmail'

import PedidoDetalle from './PedidoDetalle'
import PedidoNuevo from './PedidoNuevo'
import PedidoHistorial from './PedidoHistorial'
import Devoluciones from './Devoluciones'
import NotasCredito from './NotasCredito'

import type { EstadoPedido, Pedido } from './types/pedidos.types'

// ─── Lista (V02) ────────────────────────────────────────────────────────────
// (Fase 2 — Alex) Esta vista ya muestra los pedidos REALES del negocio: la
// tabla, las pestañas por estado (con contadores de verdad), el filtro por
// canal y fecha, la búsqueda y la paginación le pegan al backend. Las otras
// sub-vistas (historial, cola, devoluciones, notas) siguen con datos de
// muestra hasta sus propias tarjetas.

const ESTADO_TABS: { id: EstadoPedido | 'todos'; label: string; dot: string | null }[] = [
    { id: 'todos',       label: 'Todos',      dot: null      },
    { id: 'pendiente',   label: 'Pendientes', dot: '#F59E0B' },
    { id: 'confirmado',  label: 'Confirmados', dot: '#10B981' },
    { id: 'preparacion', label: 'En prep.',   dot: '#8B5CF6' },
    { id: 'enviado',     label: 'Enviados',   dot: '#3B82F6' },
    { id: 'entregado',   label: 'Entregados', dot: '#94A3B8' },
    { id: 'cancelado',   label: 'Cancelados', dot: '#EF4444' },
]

// Traducción entre los estados del backend (en inglés) y los de las pantallas.
// COMPLETED es la venta de mostrador ya cobrada: acá se muestra como entregado.
const API_A_UI: Record<ApiOrderStatus, EstadoPedido> = {
    PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'preparacion',
    SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'entregado', CANCELLED: 'cancelado',
}
const UI_A_API: Partial<Record<EstadoPedido | 'todos', ApiOrderStatus>> = {
    pendiente: 'PENDING', confirmado: 'CONFIRMED', preparacion: 'PREPARING',
    enviado: 'SHIPPED', entregado: 'DELIVERED', cancelado: 'CANCELLED',
}

// Colorcito estable para el dibujito de cada producto, calculado de su nombre.
const hueDe = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

// Convierte un pedido como viene del backend al formato que dibuja la tabla.
function apiAPedido(o: ApiOrderSummary): Pedido {
    return {
        id: o.id,
        numero: String(o.orderNumber),
        clienteId: o.customerId ?? '',
        cliente: o.customerName ?? 'Sin cliente',
        email: o.customerEmail ?? '',
        productos: o.items.map(it => ({ nombre: it.productName, cantidad: it.quantity, precio: it.unitPrice, hue: hueDe(it.productName) })),
        canal: o.channel === 'ONLINE' ? 'Online' : 'Presencial',
        monto: o.total,
        estado: API_A_UI[o.status],
        fecha: typeof o.createdAt === 'string' ? o.createdAt : String(o.createdAt),
    }
}


// Arma un archivo CSV y lo descarga. Excel lo abre con doble click: lleva la
// marca de codificación (para las tildes) y separa con punto y coma, que es
// lo que Excel espera acá en Argentina.
// N\u00FAmero con coma decimal para que Excel es-AR lo lea como n\u00FAmero, no como texto.
function numAR(n: number): string {
    return (Math.round(n * 100) / 100).toString().replace('.', ',')
}

function descargarCsv(nombre: string, encabezados: string[], filas: (string | number)[][]) {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const contenido = '\uFEFF' + [encabezados, ...filas].map(f => f.map(esc).join(';')).join('\r\n')
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nombre
    a.click()
    URL.revokeObjectURL(a.href)
}

const RANGOS: { id: 'todo' | 'hoy' | '7d' | '30d'; label: string }[] = [
    { id: 'todo', label: 'Todas las fechas' },
    { id: 'hoy',  label: 'Hoy' },
    { id: '7d',   label: 'Últimos 7 días' },
    { id: '30d',  label: 'Últimos 30 días' },
]

// Desde cuándo mirar según el filtro de fecha elegido.
function fromDeRango(rango: 'todo' | 'hoy' | '7d' | '30d'): string | undefined {
    if (rango === 'todo') return undefined
    const d = new Date()
    if (rango === 'hoy') d.setHours(0, 0, 0, 0)
    else d.setDate(d.getDate() - (rango === '7d' ? 7 : 30))
    return d.toISOString()
}

function ListaView({ ir, onToast }: { ir: (v: VistaPedido, id?: string) => void; onToast?: (m: string) => void }) {
    // Sesión real del panel: sin cuenta de dueño/equipo no hay pedidos que mostrar.
    const { status: authStatus, user } = useAuth()
    const esDueno = authStatus === 'authenticated' && user?.type === 'member'
    // Cada botón se muestra solo si el rol tiene el permiso (los del catálogo de F1).
    const puede = (permiso: string) => user?.type === 'member' && user.permissions.includes(permiso)

    const [tab, setTab] = useState<EstadoPedido | 'todos'>('todos')
    const [canal, setCanal] = useState<'todos' | 'online' | 'presencial'>('todos')
    const [busqueda, setBusqueda] = useState('')
    const [busquedaLista, setBusquedaLista] = useState('')
    const [rango, setRango] = useState<'todo' | 'hoy' | '7d' | '30d'>('todo')
    const [rangoAbierto, setRangoAbierto] = useState(false)
    const [page, setPage] = useState(1)
    const [reintento, setReintento] = useState(0)
    const [datos, setDatos] = useState<ApiOrdersPage | null>(null)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [comprobante, setComprobante] = useState<string | null>(null)
    // El destinatario del modal de email + el pedido desde el que se abre
    // (el envío real sale por POST /orders/:id/email).
    const [email, setEmail] = useState<(ClienteEmail & { pedidoId: string }) | null>(null)
    const [procesandoLote, setProcesandoLote] = useState(false)
    const [exportando, setExportando] = useState(false)
    // Los pedidos elegidos para imprimir etiquetas (se cargan completos al pedirlas).
    const [etiquetas, setEtiquetas] = useState<ApiOrderDetail[] | null>(null)

    // Espero 350ms desde la última tecla antes de buscar, para no bombardear al backend.
    useEffect(() => {
        const t = setTimeout(() => setBusquedaLista(busqueda), 350)
        return () => clearTimeout(t)
    }, [busqueda])

    // Cualquier cambio de filtro vuelve a la primera página.
    useEffect(() => { setPage(1) }, [tab, canal, busquedaLista, rango])

    // La carga de verdad: cada cambio de filtro o de página vuelve a pedir la lista.
    useEffect(() => {
        if (authStatus === 'loading') return
        if (!esDueno) { setCargando(false); return }
        let cancelado = false
        setCargando(true)
        getOrders({
            status: UI_A_API[tab],
            channel: canal === 'todos' ? undefined : canal === 'online' ? 'ONLINE' : 'POS',
            search: busquedaLista || undefined,
            from: fromDeRango(rango),
            page,
        })
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la lista de pedidos') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [authStatus, esDueno, tab, canal, busquedaLista, rango, page, reintento])

    const rows = useMemo(() => (datos?.data ?? []).map(apiAPedido), [datos])

    // Los contadores de las pestañas ya vienen contados del backend.
    const counts = useMemo(() => {
        const api = datos?.counts ?? {}
        const c: Record<string, number> = {}
        let todos = 0
        for (const clave of Object.keys(API_A_UI) as ApiOrderStatus[]) {
            const n = api[clave] ?? 0
            c[API_A_UI[clave]] = (c[API_A_UI[clave]] ?? 0) + n
            todos += n
        }
        c.todos = todos
        return c
    }, [datos])

    const sinAtender = datos?.counts?.PENDING ?? 0
    const total = datos?.total ?? 0
    const limite = datos?.limit ?? 20
    const desde = total === 0 ? 0 : (page - 1) * limite + 1
    const hasta = Math.min(page * limite, total)

    // ── Acciones masivas (tarjeta 6) ──
    // Confirmar en lote: voy pedido por pedido (así cada uno valida su stock y
    // su estado como corresponde) y al final cuento cuántos salieron y cuáles no.
    const confirmarLote = async (ids: string[]) => {
        if (procesandoLote || ids.length === 0) return
        setProcesandoLote(true)
        let ok = 0
        const fallas: string[] = []
        for (const oid of ids) {
            try {
                await updateOrderStatus(oid, 'CONFIRMED')
                ok++
            } catch (e) {
                void e
                const num = rows.find(r => r.id === oid)?.numero ?? '?'
                fallas.push('#' + num)
            }
        }
        setProcesandoLote(false)
        setReintento(n => n + 1) // recargo la lista con los estados nuevos
        onToast?.(fallas.length
            ? `${ok} confirmados · no se pudo con ${fallas.join(', ')} (revisá su estado o stock)`
            : `${ok} pedido${ok === 1 ? '' : 's'} confirmado${ok === 1 ? '' : 's'}`)
    }

    // Etiquetas: traigo los datos completos de cada pedido elegido y abro la
    // hoja imprimible (una etiqueta por pedido, con remitente y destinatario).
    const imprimirEtiquetas = async (ids: string[]) => {
        if (ids.length === 0) return
        const detalles = (await Promise.all(ids.map(oid => getOrder(oid).catch(() => null)))).filter(Boolean) as ApiOrderDetail[]
        if (detalles.length === 0) { onToast?.('No se pudieron cargar los pedidos elegidos.'); return }
        setEtiquetas(detalles)
    }


    // ── Exportar (tarjeta 7) ──
    // Baja TODOS los pedidos que cumplen los filtros de este momento (no solo
    // la página que se ve) y arma el archivo con las mismas columnas de la tabla.
    const exportarPedidos = async () => {
        if (exportando) return
        setExportando(true)
        try {
            const todos: ApiOrderSummary[] = []
            let pg = 1
            for (;;) {
                const r = await getOrders({
                    status: UI_A_API[tab],
                    channel: canal === 'todos' ? undefined : canal === 'online' ? 'ONLINE' : 'POS',
                    search: busquedaLista || undefined,
                    from: fromDeRango(rango),
                    page: pg,
                    limit: 100,
                })
                todos.push(...r.data)
                if (todos.length >= r.total || r.data.length === 0) break
                pg++
            }
            const nombreEstado: Record<string, string> = { pendiente: 'Pendiente', confirmado: 'Confirmado', preparacion: 'En preparación', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' }
            descargarCsv(
                `pedidos-${new Date().toISOString().slice(0, 10)}.csv`,
                ['# Pedido', 'Cliente', 'Email', 'Productos', 'Canal', 'Monto', 'Estado', 'Fecha'],
                todos.map(o => [
                    o.orderNumber,
                    o.customerName ?? 'Sin cliente',
                    o.customerEmail ?? '',
                    o.items.map(it => `${it.quantity}x ${it.productName}`).join(' · '),
                    o.channel === 'ONLINE' ? 'Online' : 'Presencial',
                    numAR(o.total),
                    nombreEstado[API_A_UI[o.status]] ?? o.status,
                    new Date(o.createdAt).toLocaleString('es-AR'),
                ]),
            )
            onToast?.(`${todos.length} pedidos exportados — mirá tu carpeta de descargas`)
        } catch {
            onToast?.('No se pudo exportar la lista.')
        } finally {
            setExportando(false)
        }
    }

    // Sin sesión: aviso con botón, igual que en Configuración.
    if (authStatus !== 'loading' && !esDueno) {
        return (
            <div className="ped-page" style={pageWrap}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 16px' }}>Pedidos</h1>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>No hay sesión activa</div>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>
                        Esta pantalla muestra los pedidos reales de tu negocio y necesita que entres con tu cuenta de dueño (o de tu equipo).
                    </div>
                    <Button variant="primary" onClick={() => { window.location.href = '/login' }}>Iniciar sesión</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="ped-page" style={pageWrap}>
            <style>{`
                .ped-tabs-row { -ms-overflow-style: none; scrollbar-width: none; }
                .ped-tabs-row::-webkit-scrollbar { display: none; }
                @media (max-width: 768px) {
                    .ped-page       { padding: 16px 14px 48px !important; }
                    .ped-header-btn { display: none !important; }
                    .ped-filter-row { flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
                    .ped-search     { max-width: 100% !important; flex: none !important; }
                    .ped-canal-wrap { width: 100% !important; justify-content: stretch; }
                    .ped-canal-wrap button { flex: 1 !important; }
                    .ped-date-btn   { width: 100% !important; justify-content: center !important; }
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Pedidos</h1>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{cargando && !datos ? '…' : total}</span>
                    {sinAtender > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 600 }}>{sinAtender} sin atender</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {puede('orders.export') && (
                        <span className="ped-header-btn"><Button variant="outline" icon={<Download size={15} />} loading={exportando} onClick={() => void exportarPedidos()}>Exportar</Button></span>
                    )}
                    {puede('orders.manage') && (
                        <Button variant="primary" icon={<Plus size={16} />} onClick={() => ir('nuevo')}>Nuevo pedido</Button>
                    )}
                </div>
            </div>

            {/* Filtros */}
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 16 }}>
                <div className="ped-tabs-row" style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
                    {ESTADO_TABS.map(({ id, label, dot }) => {
                        const a = tab === id
                        return (
                            <button key={id} onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, border: 'none', background: a ? 'var(--color-primary-bg)' : 'transparent', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                                {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
                                {label}
                                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 9999, fontFamily: '"Geist Mono", monospace', background: a ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)', color: a ? 'var(--color-primary)' : 'var(--color-muted)' }}>{counts[id] ?? 0}</span>
                            </button>
                        )
                    })}
                </div>
                <div className="ped-filter-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
                    {/* Filtro de fecha real: hoy / 7 días / 30 días / todo */}
                    <div style={{ position: 'relative' }}>
                        <button className="ped-date-btn" onClick={() => setRangoAbierto(o => !o)} style={{ height: 36, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            <Clock size={15} /> {RANGOS.find(r => r.id === rango)?.label} <ChevronDown size={13} style={{ opacity: 0.6, transform: rangoAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
                        </button>
                        {rangoAbierto && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300, minWidth: 180, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,.14)', overflow: 'hidden' }}>
                                {RANGOS.map(r => (
                                    <button key={r.id} onClick={() => { setRango(r.id); setRangoAbierto(false) }} style={{ width: '100%', padding: '9px 14px', border: 'none', background: rango === r.id ? 'var(--color-surface-alt)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--color-text)', textAlign: 'left', fontWeight: rango === r.id ? 600 : 400 }}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="ped-canal-wrap" style={{ display: 'flex', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 2, height: 36 }}>
                        {([['todos', 'Todos', null], ['online', 'Online', Globe], ['presencial', 'Presencial', Store]] as ['todos' | 'online' | 'presencial', string, typeof Globe | null][]).map(([id, l, Icon]) => {
                            const a = canal === id
                            return (
                                <button key={id} onClick={() => { setCanal(id); setTab('todos') }} style={{ height: '100%', padding: '0 12px', borderRadius: 6, border: 'none', background: a ? 'var(--color-bg)' : 'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize: 12, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {Icon && <Icon size={13} />}{l}
                                </button>
                            )
                        })}
                    </div>
                    <div className="ped-search" style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por # o cliente…" style={{ width: '100%', boxSizing: 'border-box', height: 36, paddingLeft: 34, paddingRight: 12, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                </div>
            </div>

            {/* Error de carga con reintento */}
            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {cargando && !datos ? (
                /* Silueta de la tabla real: avatar, cliente, estado y monto. */
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <SkeletonFilas filas={6} />
                </div>
            ) : (
            <PedidoTable
                rows={rows}
                onRowClick={(p: Pedido) => ir('detalle', p.id)}
                onComprobante={(p) => setComprobante(p.id)}
                onEmail={(p) => setEmail({ nombre: p.cliente, email: p.email, pedidoId: p.id })}
                onConfirmarLote={puede('orders.manage') ? ids => void confirmarLote(ids) : undefined}
                onEtiquetas={ids => void imprimirEtiquetas(ids)}
            />
            )}

            {procesandoLote && (
                <div style={{ padding: '10px 4px', fontSize: 13, color: 'var(--color-muted)' }}>Confirmando pedidos…</div>
            )}

            {/* Hoja de etiquetas imprimible (tapa la pantalla; al imprimir sale solo esto) */}
            {etiquetas && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, overflow: 'auto', background: 'var(--color-surface)' }}>
                    <style>{`
                        @media print {
                            body * { visibility: hidden !important; }
                            .etiq-print-zone, .etiq-print-zone * { visibility: visible !important; }
                            .etiq-print-zone { position: absolute !important; left: 0; top: 0; width: 100%; }
                            .etiq-bar { display: none !important; }
                        }
                    `}</style>
                    <div className="etiq-bar" style={{ position: 'sticky', top: 0, zIndex: 50, height: 56, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button onClick={() => setEtiquetas(null)} style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>← Cerrar</button>
                        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{etiquetas.length} etiqueta{etiquetas.length === 1 ? '' : 's'}</span>
                        <Button variant="primary" size="sm" onClick={() => window.print()}>Imprimir</Button>
                    </div>
                    <div className="etiq-print-zone" style={{ maxWidth: 900, margin: '0 auto', padding: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {etiquetas.map(o => {
                            const nombre = o.customer ? `${o.customer.firstName}${o.customer.lastName ? ' ' + o.customer.lastName : ''}` : o.onlineOrderDetails?.buyerName ?? 'Consumidor final'
                            const tel = o.onlineOrderDetails?.buyerPhone
                            const mail = o.customer?.email ?? o.onlineOrderDetails?.buyerEmail
                            const negocio = user?.type === 'member' ? user.business.name : ''
                            return (
                                <div key={o.id} style={{ border: '2px solid #0f172a', borderRadius: 10, padding: 16, background: '#fff', color: '#0f172a', breakInside: 'avoid' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderBottom: '1px dashed #94a3b8', paddingBottom: 8, marginBottom: 10 }}>
                                        <span>Remite: <strong>{negocio}</strong></span>
                                        <span style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 700 }}>Pedido #{o.orderNumber}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>DESTINATARIO</div>
                                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{nombre}</div>
                                    {tel && <div style={{ fontSize: 13, marginBottom: 2 }}>Tel: {tel}</div>}
                                    {mail && <div style={{ fontSize: 12, color: '#334155', marginBottom: 2 }}>{mail}</div>}
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                        {o.items.reduce((s, it) => s + it.quantity, 0)} bulto(s) · Entrega a coordinar
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Vacío */}
            {!cargando && !errorCarga && rows.length === 0 && (
                <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
                    No hay pedidos que coincidan con estos filtros.
                </div>
            )}

            {/* Paginación real */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 4px', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    Mostrando <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{desde}–{hasta}</strong> de <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{total}</strong>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Anterior</Button>
                    <Button variant="outline" size="sm" disabled={hasta >= total} onClick={() => setPage(p => p + 1)}>Siguiente →</Button>
                </div>
            </div>

            <ModalComprobante isOpen={comprobante !== null} onClose={() => setComprobante(null)} id={comprobante ?? undefined} onToast={onToast} />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} onToast={onToast} onEnviar={async (a, c) => { await sendOrderEmail(email.pedidoId, a, c) }} />}
        </div>
    )
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export default function PedidoLista() {
    const router = useRouter()
    const { vista, id } = router.query
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const ir = (v: VistaPedido, pid?: string) => {
        // clienteId también se descarta: es el pasajero de "Nuevo pedido desde
        // el perfil del cliente" y si sobrevive a la navegación interna, TODO
        // "Nuevo pedido" posterior precarga a ese cliente (pedido equivocado).
        const { vista: _v, id: _i, clienteId: _c, ...rest } = router.query
        const q: Record<string, string | string[] | undefined> = { ...rest }
        if (v !== 'lista') q.vista = v
        if (pid) q.id = pid
        router.push({ query: q })
    }

    const sub = vista as VistaPedido | undefined
    let content
    if (sub === 'detalle')          content = <PedidoDetalle key={id as string} id={id as string} ir={ir} />
    else if (sub === 'nuevo')       content = <PedidoNuevo ir={ir} onToast={setToast} />
    else if (sub === 'historial')   content = <PedidoHistorial ir={ir} onToast={setToast} />
    else if (sub === 'devoluciones') content = <Devoluciones ir={ir} onToast={setToast} />
    else if (sub === 'notas')       content = <NotasCredito ir={ir} onToast={setToast} />
    else                            content = <ListaView ir={ir} onToast={setToast} />

    return (
        <>
            {content}
            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
