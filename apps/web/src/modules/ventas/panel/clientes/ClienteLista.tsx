// src/modules/ventas/panel/clientes/ClienteLista.tsx — Vista 09 + hub del módulo

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Download, Mail, ChevronRight, Eye, Search, BarChart2 } from 'lucide-react'
import { Badge } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { SkeletonCircle, SkeletonFilas, SkeletonText } from '@/design-system/components/Skeleton'
import { Toast } from '@/design-system/components/Toast'
import { fmtMoney, toastEsError } from '@/lib/utils'
import { adminPath, currentSlug } from '@/lib/tenant'

import { EmailMasivoModal } from './components/EmailMasivoModal'
import ClienteDetalle from './ClienteDetalle'
import { ModalEmail, type ClienteEmail } from '../pedidos/components/ModalEmail'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, getCustomers, getCustomer, sendCustomersEmail, type ApiCustomer, type ApiCustomersPage, type ApiCustomerDetail, type ApiOrderStatus } from '@/lib/api'
import type { Cliente } from './types/clientes.types'
import type { EstadoPedido } from '../pedidos/types/pedidos.types'

const COLS = '24px 1.4fr 90px 110px 110px 110px 70px'

// (Fase 2 — Alex) "Hace cuánto" en criollo. Con datos reales usa la fecha de
// HOY de verdad (antes estaba clavada en una fecha de muestra) y contempla
// clientes que todavía no compraron nunca.
function relTime(iso: string): string {
    if (!iso) return 'Sin compras'
    const d = new Date(iso), now = new Date()
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (days <= 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    if (days < 30) return `Hace ${days} días`
    const meses = Math.floor(days / 30)
    return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
}

// ─── Card mobile ─────────────────────────────────────────────────────────────

function ClienteCard({ c, onVer, onEmail }: {
    c: Cliente
    onVer: () => void
    onEmail?: () => void   // undefined = el rol no puede mandar emails → sin botón
}) {
    const [hov, setHov] = useState(false)
    return (
        <div
            onClick={onVer}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background:    hov ? 'var(--color-surface)' : 'var(--color-bg)',
                border:        '1px solid var(--color-border)',
                borderRadius:  12,
                padding:       '14px 14px 12px',
                cursor:        'pointer',
                transition:    'background 150ms',
                display:       'flex',
                flexDirection: 'column',
                gap:           8,
            }}
        >
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Avatar name={c.nombre} size={38} />
                <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--color-text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nombre}</div>
                    <div style={{ fontSize:11, color:'var(--color-subtle)', fontFamily:'"Geist Mono", monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.email}</div>
                </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                {[
                    ['Pedidos', String(c.pedidos)],
                    ['Gastado', fmtMoney(c.gasto)],
                    ['Ticket',  fmtMoney(c.ticket)],
                ].map(([k, v]) => (
                    <div key={k} style={{ background:'var(--color-surface)', borderRadius:8, padding:'6px 8px' }}>
                        <div style={{ fontSize:10, color:'var(--color-muted)', marginBottom:2 }}>{k}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{v}</div>
                    </div>
                ))}
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:11, color:'var(--color-subtle)' }}>{relTime(c.ultima)}</span>
                <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={onVer}   style={iconBtn}><Eye size={13} /></button>
                    {onEmail && <button onClick={onEmail} style={iconBtn}><Mail size={13} /></button>}
                </div>
            </div>
        </div>
    )
}

// ─── Lista (V09) ─────────────────────────────────────────────────────────────
// (Fase 2 — Alex) La lista ya muestra los clientes REALES del negocio con sus
// números calculados por el backend (pedidos, gastado, ticket promedio y
// última compra). La búsqueda y la paginación también son reales. Al abrir la
// flechita de una fila se cargan sus últimos pedidos de verdad. El perfil
// completo (ClienteDetalle) sigue con datos de muestra: es tarjeta de Fase 3.


// Arma un archivo CSV y lo descarga. Excel lo abre con doble click: lleva la
// marca de codificación (para las tildes) y separa con punto y coma, que es
// lo que Excel espera acá en Argentina.
// N\u00FAmero con coma decimal para que Excel es-AR lo lea como n\u00FAmero (no como
// texto "1234.56"). Sin separador de miles para no romper el parseo.
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

// Traducción de estados del backend a los de la pantalla (para los pedidos de la fila).
const ESTADO_UI: Record<ApiOrderStatus, EstadoPedido> = {
    PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'preparacion',
    SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'entregado', CANCELLED: 'cancelado',
}

// Convierte un cliente como viene del backend al formato de estas pantallas.
// El "segmento" es solo una etiqueta derivada de los números (no existe en la
// base — decisión del contrato); acá lo calculamos por arriba para el tipo.
function apiACliente(c: ApiCustomer): Cliente {
    const dias = c.lastOrderAt ? Math.floor((Date.now() - new Date(c.lastOrderAt).getTime()) / 86400000) : null
    return {
        id: c.id,
        nombre: `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`,
        email: c.email ?? '',
        tel: c.phone ?? '',
        pedidos: c.orderCount,
        gasto: c.totalSpent,
        ticket: c.avgTicket,
        ultima: c.lastOrderAt ?? '',
        segmento: c.orderCount === 0 ? 'nuevo' : dias != null && dias > 60 ? 'inactivo' : c.orderCount >= 5 ? 'vip' : 'recurrente',
        tags: [],
    }
}

function ListaView({
    irDetalle,
    irReporte,
}: {
    irDetalle: (id: string) => void
    irReporte: () => void
}) {
    // Sesión real del panel: sin cuenta no hay clientes que mostrar.
    const { status: authStatus, user } = useAuth()
    const esDueno = authStatus === 'authenticated' && user?.type === 'member'
    const puede = (permiso: string) => user?.type === 'member' && user.permissions.includes(permiso)

    const [busqueda,      setBusqueda]      = useState('')
    const [busquedaLista, setBusquedaLista] = useState('')
    const [page,          setPage]          = useState(1)
    const [reintento,     setReintento]     = useState(0)
    const [datos,         setDatos]         = useState<ApiCustomersPage | null>(null)
    const [cargando,      setCargando]      = useState(true)
    const [errorCarga,    setErrorCarga]    = useState<string | null>(null)
    const [exp,           setExp]           = useState<string | null>(null)
    // Los últimos pedidos de cada fila se cargan recién al abrir la flechita, y quedan guardados.
    const [detalles,      setDetalles]      = useState<Record<string, ApiCustomerDetail | 'cargando' | 'error'>>({})
    const [emailMasivo,   setEmailMasivo]   = useState(false)
    const [email,         setEmail]         = useState<(ClienteEmail & { clienteId: string }) | null>(null)
    const [exportando,    setExportando]    = useState(false)
    const [toast,         setToast]         = useState<string | null>(null)
    const [abriendoMasivo, setAbriendoMasivo] = useState(false)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])
    // Los destinatarios reales del email masivo (la lista filtrada, con email).
    const [masivo,        setMasivo]        = useState<{ id: string; nombre: string; email: string }[] | null>(null)

    // Espero 350ms desde la última tecla antes de buscar.
    useEffect(() => {
        const t = setTimeout(() => setBusquedaLista(busqueda), 350)
        return () => clearTimeout(t)
    }, [busqueda])

    useEffect(() => { setPage(1) }, [busquedaLista])

    // La carga real de la lista.
    useEffect(() => {
        if (authStatus === 'loading') return
        if (!esDueno) { setCargando(false); return }
        let cancelado = false
        setCargando(true)
        getCustomers({ search: busquedaLista || undefined, page })
            .then(r => { if (!cancelado) { setDatos(r); setErrorCarga(null) } })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la lista de clientes') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [authStatus, esDueno, busquedaLista, page, reintento])

    const rows = useMemo(() => (datos?.data ?? []).map(apiACliente), [datos])
    const total = datos?.total ?? 0
    const limite = datos?.limit ?? 20
    const desde = total === 0 ? 0 : (page - 1) * limite + 1
    const hasta = Math.min(page * limite, total)

    // Abrir/cerrar una fila; la primera vez trae sus pedidos reales.
    const toggleFila = (id: string) => {
        const abierta = exp === id
        setExp(abierta ? null : id)
        if (!abierta && !detalles[id]) {
            setDetalles(d => ({ ...d, [id]: 'cargando' }))
            getCustomer(id)
                .then(det => setDetalles(d => ({ ...d, [id]: det })))
                .catch(() => setDetalles(d => ({ ...d, [id]: 'error' })))
        }
    }

    // Trae TODOS los clientes que cumplen la búsqueda actual (no solo la página).
    const traerTodos = async (): Promise<ApiCustomer[]> => {
        const todos: ApiCustomer[] = []
        let pg = 1
        for (;;) {
            const r = await getCustomers({ search: busquedaLista || undefined, page: pg, limit: 100 })
            todos.push(...r.data)
            if (todos.length >= r.total || r.data.length === 0) break
            pg++
        }
        return todos
    }

    // ── Exportar (tarjeta 8) ──
    const exportarClientes = async () => {
        if (exportando) return
        setExportando(true)
        try {
            const todos = await traerTodos()
            descargarCsv(
                `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Nombre', 'Apellido', 'Email', 'Teléfono', 'DNI', 'Tiene cuenta', 'Pedidos', 'Gastado', 'Ticket promedio', 'Última compra', 'Cliente desde'],
                todos.map(c => [
                    c.firstName,
                    c.lastName ?? '',
                    c.email ?? '',
                    c.phone ?? '',
                    c.dni ?? '',
                    c.hasAccount ? 'Sí' : 'No',
                    c.orderCount,
                    numAR(c.totalSpent),
                    numAR(c.avgTicket),
                    c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('es-AR') : 'Sin compras',
                    new Date(c.createdAt).toLocaleDateString('es-AR'),
                ]),
            )
            setToast(`${todos.length} cliente${todos.length === 1 ? '' : 's'} exportado${todos.length === 1 ? '' : 's'} — mirá tu carpeta de descargas`)
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo exportar la lista de clientes.')
        } finally {
            setExportando(false)
        }
    }

    // ── Email masivo real (tarjeta 8): junta la lista filtrada y abre el modal ──
    // Baja la base entera de a 100: sin indicador el botón parecía muerto y el
    // usuario reclickeaba. Y el catch que devolvía [] hacía que un error de red
    // se viera igual que "no hay clientes con email".
    const abrirMasivo = async () => {
        if (abriendoMasivo) return
        setAbriendoMasivo(true)
        try {
            const todos = await traerTodos()
            setMasivo(todos
                .filter(c => c.email)
                .map(c => ({ id: c.id, nombre: `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`, email: c.email as string })))
            setEmailMasivo(true)
        } catch (e) {
            setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo armar la lista de destinatarios.')
        } finally {
            setAbriendoMasivo(false)
        }
    }

    // Sin sesión: aviso con botón, igual que en Pedidos y Configuración.
    if (authStatus !== 'loading' && !esDueno) {
        return (
            <div className="cli-page" style={pageWrap}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 16px' }}>Clientes</h1>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>No hay sesión activa</div>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>
                        Esta pantalla muestra los clientes reales de tu negocio y necesita que entres con tu cuenta.
                    </div>
                    <Button variant="primary" onClick={() => { window.location.href = '/login' }}>Iniciar sesión</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="cli-page" style={pageWrap}>
            <style>{`
                .cli-page        { padding: 24px 32px 64px; }
                .cli-header      { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
                .cli-table-wrap  { display: block; }
                .cli-cards-wrap  { display: none; }
                .cli-tabs        { -ms-overflow-style:none; scrollbar-width:none; }
                .cli-tabs::-webkit-scrollbar { display:none; }
                @media (max-width: 768px) {
                    .cli-page       { padding: 16px 14px 48px !important; }
                    .cli-header     { flex-direction: column; align-items: flex-start !important; }
                    .cli-export-btn { display: none !important; }
                    .cli-table-wrap { display: none !important; }
                    .cli-cards-wrap { display: flex !important; flex-direction: column; gap: 10px; }
                }
            `}</style>

            {/* Tabs */}
            <div className="cli-tabs" style={{ display:'flex', gap:4, borderBottom:'1px solid var(--color-border)', marginBottom:20, overflowX:'auto' }}>
                {([['lista', 'Lista'], ['reporte', 'Reporte clientes']] as const).map(([k, l]) => {
                    const a = k === 'lista'
                    return (
                        <button key={k} onClick={() => k === 'reporte' && irReporte()} style={{ padding:'10px 14px', border:'none', background:'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize:13.5, fontWeight: a ? 600 : 500, cursor:'pointer', fontFamily:'inherit', borderBottom:`2px solid ${a ? 'var(--color-primary)' : 'transparent'}`, marginBottom:-1, whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:6 }}>
                            {k === 'reporte' && <BarChart2 size={13} />}
                            {l}
                        </button>
                    )
                })}
            </div>

            {/* Header */}
            <div className="cli-header">
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.02em', color:'var(--color-text)', margin:0 }}>Clientes</h1>
                    <span style={{ display:'inline-flex', alignItems:'center', height:24, padding:'0 10px', borderRadius:9999, background:'var(--color-surface-alt)', color:'var(--color-muted)', fontSize:12, fontWeight:600, fontFamily:'"Geist Mono", monospace' }}>{cargando && !datos ? '…' : `${total} clientes`}</span>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                    {/* Exportar baja la base entera (con DNI y teléfono): mismo
                        gate de permiso que el email masivo — antes lo veía
                        cualquier rol, a diferencia de Pedidos que sí lo gatea. */}
                    {puede('customers.manage') && (
                        <span className="cli-export-btn"><Button variant="outline" icon={<Download size={15} />} loading={exportando} onClick={() => void exportarClientes()}>Exportar</Button></span>
                    )}
                    {puede('customers.manage') && (
                        <Button variant="primary" icon={<Mail size={16} />} loading={abriendoMasivo} onClick={() => void abrirMasivo()}>Email masivo</Button>
                    )}
                </div>
            </div>

            {/* Búsqueda */}
            <div style={{ position:'relative', marginBottom:16 }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--color-muted)', pointerEvents:'none' }} />
                <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o email…"
                    style={{ width:'100%', boxSizing:'border-box', height:38, paddingLeft:32, paddingRight:12, background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:10, fontSize:13, color:'var(--color-text)', fontFamily:'inherit', outline:'none' }}
                />
            </div>

            {/* Error de carga con reintento */}
            {errorCarga && (
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--color-error-bg)', border:'1px solid var(--color-border)', borderRadius:10, marginBottom:12 }}>
                    <span style={{ fontSize:13, color:'var(--color-error)', flex:1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {/* ── DESKTOP: tabla ── */}
            {/* Mientras carga: el skeleton canónico (el de Descuentos), barras
                flotantes sin recuadro — la tabla con su recuadro aparece con
                los datos. Lleva la misma clase para respetar el corte mobile. */}
            {cargando && !datos ? (
                <div className="cli-table-wrap" style={{ background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:12, overflow:'hidden' }}>
                    <SkeletonFilas filas={6} />
                </div>
            ) : (
            <div className="cli-table-wrap" style={{ background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:COLS, alignItems:'center', gap:10, padding:'0 16px', height:44, background:'var(--color-surface)', borderBottom:'1px solid var(--color-border)', fontSize:11, fontWeight:600, color:'var(--color-muted)', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    <span /><span>Cliente</span><span style={{ textAlign:'right' }}>Pedidos</span><span style={{ textAlign:'right' }}>Gastado</span><span style={{ textAlign:'right' }}>Ticket</span><span>Última</span><span style={{ textAlign:'right' }}>Acc.</span>
                </div>
                {rows.length === 0 ? (
                    <div style={{ padding:'32px 16px', textAlign:'center', fontSize:13, color:'var(--color-muted)' }}>
                        {busquedaLista ? 'Sin resultados para esa búsqueda' : 'Todavía no hay clientes: aparecen solos cuando alguien compra, o al cargarlos desde un pedido.'}
                    </div>
                ) : rows.map((c, i) => {
                    const open = exp === c.id
                    const det = detalles[c.id]
                    return (
                        <div key={c.id}>
                            <div onClick={() => toggleFila(c.id)} style={{ display:'grid', gridTemplateColumns:COLS, alignItems:'center', gap:10, padding:'0 16px', height:60, borderBottom:(open || i < rows.length - 1) ? '1px solid var(--color-border)' : 'none', cursor:'pointer', background: open ? 'var(--color-primary-bg)' : 'transparent', transition:'background 150ms' }}>
                                <span style={{ color:'var(--color-muted)', transform: open ? 'rotate(90deg)' : 'none', transition:'transform 150ms', display:'inline-flex' }}><ChevronRight size={14} strokeWidth={1.8} /></span>
                                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                                    <Avatar name={c.nombre} size={34} />
                                    <div style={{ minWidth:0 }}>
                                        <div style={{ fontSize:13, fontWeight:500, color:'var(--color-text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nombre}</div>
                                        <div style={{ fontSize:11, color:'var(--color-subtle)', fontFamily:'"Geist Mono", monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.email || 'Sin email'}</div>
                                    </div>
                                </div>
                                <span style={{ fontSize:14, fontWeight:700, color:'var(--color-primary)', fontFamily:'"Geist Mono", monospace', textAlign:'right' }}>{c.pedidos}</span>
                                <span style={{ fontSize:13, fontWeight:600, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace', textAlign:'right' }}>{fmtMoney(c.gasto)}</span>
                                <span style={{ fontSize:12, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace', textAlign:'right' }}>{fmtMoney(c.ticket)}</span>
                                <span style={{ fontSize:12, color:'var(--color-muted)' }}>{relTime(c.ultima)}</span>
                                <div style={{ display:'flex', justifyContent:'flex-end', gap:2 }} onClick={e => e.stopPropagation()}>
                                    <button onClick={() => irDetalle(c.id)} style={iconBtn}><Eye size={15} /></button>
                                    {/* Mismo gate que el email masivo: mandar mails es customers.manage. */}
                                    {puede('customers.manage') && <button onClick={() => setEmail({ nombre: c.nombre, email: c.email, clienteId: c.id })} style={iconBtn}><Mail size={15} /></button>}
                                </div>
                            </div>
                            {open && (
                                <div style={{ padding:'14px 16px 14px 50px', background:'var(--color-surface)', borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <div style={{ fontSize:11, fontWeight:600, color:'var(--color-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Últimos pedidos</div>
                                    {det === 'error' ? (
                                        <div style={{ fontSize:12.5, color:'var(--color-error)', padding:'6px 0' }}>No se pudieron cargar los pedidos de este cliente.</div>
                                    ) : det === 'cargando' || !det ? (
                                        <div style={{ fontSize:12.5, color:'var(--color-muted)', padding:'6px 0' }}>Cargando…</div>
                                    ) : det.orders.length === 0 ? (
                                        <div style={{ fontSize:12.5, color:'var(--color-muted)', padding:'6px 0' }}>Este cliente todavía no tiene pedidos.</div>
                                    ) : det.orders.slice(0, 3).map(o => (
                                        <div key={o.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 0' }}>
                                            <span style={{ fontSize:12, fontWeight:600, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace', width:60 }}>#{o.orderNumber}</span>
                                            <Badge status={ESTADO_UI[o.status]} size="sm" />
                                            <div style={{ flex:1 }} />
                                            <span style={{ fontSize:13, fontWeight:600, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(o.total)}</span>
                                        </div>
                                    ))}
                                    <button onClick={() => irDetalle(c.id)} style={{ marginTop:8, background:'none', border:'none', color:'var(--color-primary)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', padding:0 }}>Ver perfil completo →</button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            )}

            {/* ── MOBILE: cards ── */}
            <div className="cli-cards-wrap">
                {cargando && !datos ? (
                    /* En mobile la silueta es la de la card, no la de la fila. */
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{ background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:12, padding:14 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                                    <SkeletonCircle size={34} delay={i * 100} />
                                    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6 }}>
                                        <SkeletonText width={['58%','44%','66%','50%'][i % 4]} height={12} delay={i * 100 + 40} />
                                        <SkeletonText width="72%" height={9} delay={i * 100 + 70} />
                                    </div>
                                </div>
                                <div style={{ display:'flex', gap:16 }}>
                                    <SkeletonText width={54} height={11} delay={i * 100 + 100} />
                                    <SkeletonText width={70} height={11} delay={i * 100 + 120} />
                                    <SkeletonText width={62} height={11} delay={i * 100 + 140} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <div style={{ padding:'32px 16px', textAlign:'center', fontSize:13, color:'var(--color-muted)' }}>Sin resultados</div>
                ) : rows.map(c => (
                    <ClienteCard
                        key={c.id}
                        c={c}
                        onVer={() => irDetalle(c.id)}
                        onEmail={puede('customers.manage') ? () => setEmail({ nombre: c.nombre, email: c.email, clienteId: c.id }) : undefined}
                    />
                ))}
            </div>

            {/* Paginación real */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 4px', flexWrap:'wrap', gap:12 }}>
                <span style={{ fontSize:13, color:'var(--color-muted)' }}>Mostrando <strong style={{ color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{desde}–{hasta}</strong> de <strong style={{ color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{total}</strong></span>
                <div style={{ display:'flex', gap:8 }}>
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Anterior</Button>
                    <Button variant="outline" size="sm" disabled={hasta >= total} onClick={() => setPage(p => p + 1)}>Siguiente →</Button>
                </div>
            </div>

            <EmailMasivoModal
                isOpen={emailMasivo}
                onClose={() => { setEmailMasivo(false); setMasivo(null) }}
                negocio={user?.type === 'member' ? user.business.name : undefined}
                destinatarios={masivo ?? undefined}
                onEnviar={async (ids, asunto, cuerpo) => {
                    const r = await sendCustomersEmail(ids, asunto, cuerpo)
                    return r.sent
                }}
            />
            {email && <ModalEmail isOpen onClose={() => setEmail(null)} cliente={email} onEnviar={async (a, c) => {
                const r = await sendCustomersEmail([email.clienteId], a, c)
                if (!r.sent) throw new Error('El proveedor de email rechazó el envío. Probá de nuevo en un rato.')
            }} />}

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

// ─── Hub ─────────────────────────────────────────────────────────────────────

export default function ClienteLista() {
    const router = useRouter()
    const { vista, id } = router.query

    const irDetalle = (cid: string) => {
        const { vista: _v, id: _i, ...rest } = router.query
        router.push({ query: { ...rest, vista: 'detalle', id: cid } })
    }
    const volver = () => {
        const { vista: _v, id: _i, ...rest } = router.query
        router.push({ query: rest })
    }
    const irSeccion = (seccion: string, extra?: Record<string, string>) => {
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push({
            pathname: adminPath(negocioId, moduloPadre, seccion),
            query:    extra ?? {},
        })
    }

    if (vista === 'detalle') {
        return (
            <ClienteDetalle
                id={id as string}
                onVolver={volver}
                irPedido={(pid) => irSeccion('pedidos', { vista: 'detalle', id: pid })}
                irNuevo={() => irSeccion('pedidos', { vista: 'nuevo', clienteId: id as string })}
                irReportes={() => irSeccion('reportes', { vista: 'clientes' })}
            />
        )
    }

    return (
        <ListaView
            irDetalle={irDetalle}
            irReporte={() => irSeccion('reportes', { vista: 'clientes' })}
        />
    )
}

const pageWrap: React.CSSProperties = { padding:'24px 32px 64px', maxWidth:1280, width:'100%', margin:'0 auto', boxSizing:'border-box' }
const iconBtn:  React.CSSProperties = { width:28, height:28, borderRadius:6, border:'none', background:'transparent', color:'var(--color-muted)', cursor:'pointer', display:'grid', placeItems:'center' }
