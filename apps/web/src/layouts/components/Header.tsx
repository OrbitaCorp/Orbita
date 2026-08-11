import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Bell, Moon, Sun, Search, LogOut, User, ChevronDown, AlertCircle, AlertTriangle, X, Menu, ArrowLeft, ShoppingBag, Users, Package, Tag, LayoutGrid } from 'lucide-react'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useAuth } from '@/hooks/useAuth'
import { nombreConversacion } from '@/modules/ventas/panel/mensajes/mock/mensajes.mock'
import { ApiError, panelSearch, type ApiSearchResults } from '@/lib/api'
import { fmtMoney } from '@/lib/utils'

const seccionLabels: Record<string, string> = {
    dashboard: 'Inicio',
    pedidos: 'Pedidos',
    catalogo: 'Catálogo',
    clientes: 'Clientes',
    reportes: 'Reportes',
    inventario: 'Inventario',
    descuentos: 'Descuentos',
    cupones: 'Cupones',
    mensajes: 'Mensajes',
    configuracion: 'Configuración',
}

const DESCUENTOS_VISTA_LABELS: Record<string, string> = {
    crear: 'Crear descuento',
    editar: 'Editar descuento',
    detalle: 'Detalle',
    metricas: 'Rendimiento',
}

const CUPONES_VISTA_LABELS: Record<string, string> = {
    crear: 'Crear cupón',
    editar: 'Editar cupón',
}

type BcItem = { label: string; onClick?: () => void }

interface Notif { id: string; nivel: 'danger' | 'warning'; titulo: string; desc: string; tiempo: string }
// La campana arranca vacía a propósito: el motor de notificaciones (que genera
// y entrega los avisos reales) es de otra tarea de esta fase (RBT-645, Alan).
// Hasta que exista su endpoint, no se inventan avisos ni se pinta un badge
// falso — mejor sin número que con "4" mentiroso para todos.
const NOTIFS: Notif[] = []

// Los roles de fábrica llegan con el nombre técnico en inglés; se muestran en
// español. Un rol custom se muestra tal cual lo nombró el negocio.
const NOMBRES_ROL: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', empleado: 'Empleado' }
const iniciales = (nombre: string) =>
    nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '·'

interface Props { onMenuClick: () => void }

export default function Header({ onMenuClick }: Props) {
    const { isDark, toggle } = useDarkMode()

    // (Alex) El botón "Cerrar sesión" ya andaba; ahora además los datos del menú
    // (nombre, rol, email, iniciales) salen de la sesión real en vez de estar
    // hardcodeados. La pantalla "Mi perfil" completa sigue siendo de Alan.
    const { logout, user } = useAuth()
    const cerrarSesion = async () => {
        await logout()
        window.location.href = '/login'   // con recarga completa: así maneja el equipo la vuelta al login
    }
    const nombreUsuario = user?.type === 'member' ? user.member.name
        : user?.type === 'platform_admin' ? user.admin.name
        : user?.type === 'customer' ? [user.customer.firstName, user.customer.lastName].filter(Boolean).join(' ')
        : ''
    const emailUsuario = user?.type === 'member' ? user.member.email
        : user?.type === 'platform_admin' ? user.admin.email
        : user?.type === 'customer' ? (user.customer.email ?? '')
        : ''
    const rolUsuario = user?.type === 'member' ? (NOMBRES_ROL[user.role] ?? user.role)
        : user?.type === 'platform_admin' ? 'Super Admin'
        : ''
    const router = useRouter()
    const { query } = router
    const negocioId   = (query.negocioId   as string) ?? 'rama-tienda'
    const moduloPadre = (query.moduloPadre as string) ?? 'ventas'
    const seccion     = (query.seccion     as string) ?? ''
    const vista       = (query.vista       as string) ?? ''

    const [userMenuAbierto, setUserMenuAbierto] = useState(false)
    const [notifOpen,       setNotifOpen]       = useState(false)
    const [notifs,          setNotifs]           = useState<Notif[]>(NOTIFS)

    const menuRef  = useRef<HTMLDivElement>(null)
    const notifRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current  && !menuRef.current.contains(e.target  as Node)) setUserMenuAbierto(false)
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const irA = (sec: string, v?: string) => {
        const q: Record<string, string> = { negocioId, moduloPadre, seccion: sec }
        if (v) q.vista = v
        router.push({ pathname: '/admin/[negocioId]/[moduloPadre]/[seccion]', query: q })
    }

    const buildBreadcrumb = (): BcItem[] => {
        if (seccion === 'mensajes') {
            // Conversación abierta: "← <nombre del cliente>", la flecha vuelve a la lista.
            const conv = query.conv as string | undefined
            const nombreConv = conv ? nombreConversacion(conv) : undefined
            if (nombreConv) {
                return [
                    { label: 'Mensajes', onClick: () => irA('mensajes') },
                    { label: nombreConv },
                ]
            }
            if (vista === 'plantillas') {
                return [
                    { label: 'Mensajes', onClick: () => irA('mensajes') },
                    { label: 'Plantillas' },
                ]
            }
            return [{ label: 'Mensajes' }]
        }
        if (seccion === 'descuentos') {
            const subLabel = DESCUENTOS_VISTA_LABELS[vista]
            if (subLabel) {
                return [
                    { label: 'Descuentos', onClick: () => irA('descuentos') },
                    { label: subLabel },
                ]
            }
            return [{ label: 'Descuentos' }]
        }
        if (seccion === 'cupones') {
            const subLabel = CUPONES_VISTA_LABELS[vista]
            if (subLabel) {
                return [
                    { label: 'Descuentos', onClick: () => irA('descuentos') },
                    { label: 'Cupones', onClick: () => irA('cupones') },
                    { label: subLabel },
                ]
            }
            return [
                { label: 'Descuentos', onClick: () => irA('descuentos') },
                { label: 'Cupones' },
            ]
        }
        return [{ label: seccionLabels[seccion] ?? seccion }]
    }

    const bcItems = buildBreadcrumb()
    const bcActual = bcItems[bcItems.length - 1]
    const bcPadre  = bcItems.length > 1 ? bcItems[bcItems.length - 2] : null

    return (
        <>
            <style>{`
                .admin-menu-btn    { display: none; }
                .admin-search-wrap { display: flex; }
                .admin-user-name   { display: block; }
                .admin-bc-full     { display: flex; }
                .admin-bc-mobile   { display: none; }
                @media (max-width: 768px) {
                    .admin-menu-btn    { display: flex !important; }
                    .admin-search-wrap { display: none !important; }
                    .admin-user-name   { display: none !important; }
                    .admin-bc-full     { display: none !important; }
                    .admin-bc-mobile   { display: flex !important; }
                    .dcto-page-head    { display: none !important; }
                }
            `}</style>

            <div className="flex items-center h-16 px-4 shrink-0" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', gap: 12 }}>

                {/* Hamburger — solo mobile */}
                <button
                    onClick={onMenuClick}
                    aria-label="Abrir menú"
                    style={{
                        width: 36, height: 36, borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-body)',
                        cursor: 'pointer',
                        alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}
                    className="admin-menu-btn"
                >
                    <Menu size={18} strokeWidth={1.8} />
                </button>

                {/* Breadcrumb completo — solo desktop */}
                <div className="admin-bc-full items-center gap-2 text-sm" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: 'var(--color-muted)', whiteSpace: 'nowrap' }} className="capitalize">{moduloPadre}</span>
                    {bcItems.map((item, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--color-muted)' }}>›</span>
                            {item.onClick ? (
                                <button
                                    onClick={item.onClick}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 14, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)' }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)' }}
                                >
                                    {item.label}
                                </button>
                            ) : (
                                <span className="font-medium" style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            )}
                        </span>
                    ))}
                </div>

                {/* Header simplificado — solo mobile: flecha de volver + título de la vista actual */}
                <div className="admin-bc-mobile items-center" style={{ flex: 1, minWidth: 0, gap: 10 }}>
                    {bcPadre?.onClick && (
                        <button
                            onClick={bcPadre.onClick}
                            aria-label="Volver"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', cursor: 'pointer', flexShrink: 0 }}
                        >
                            <ArrowLeft size={17} strokeWidth={1.8} />
                        </button>
                    )}
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bcActual.label}
                    </span>
                </div>

                {/* Acciones */}
                <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>

                    {/* Buscador global (oculto en mobile) — Fase 4, Ale */}
                    <BusquedaGlobal />


                    {/* Dark mode toggle */}
                    <button
                        onClick={toggle}
                        aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
                        className="grid place-items-center rounded-lg cursor-pointer"
                        style={{ width: 36, height: 36, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-body)', flexShrink: 0 }}
                    >
                        {isDark ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
                    </button>

                    {/* Notificaciones */}
                    <div className="relative" ref={notifRef} style={{ flexShrink: 0 }}>
                        <button
                            onClick={() => setNotifOpen(o => !o)}
                            className="grid place-items-center rounded-lg cursor-pointer"
                            style={{
                                width: 36, height: 36, position: 'relative',
                                background: notifOpen ? 'var(--color-surface-alt)' : 'transparent',
                                border: `1px solid ${notifOpen ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
                                color: 'var(--color-body)',
                            }}
                        >
                            <Bell size={17} strokeWidth={1.5} />
                            {notifs.length > 0 && (
                                <span style={{
                                    position: 'absolute', top: -4, right: -4,
                                    minWidth: 17, height: 17, borderRadius: 9,
                                    background: 'var(--color-error)', color: '#fff',
                                    fontSize: 10, fontWeight: 700, fontFamily: '"Geist Mono", monospace',
                                    display: 'grid', placeItems: 'center', padding: '0 3px',
                                    border: '2px solid var(--color-bg)', lineHeight: 1,
                                }}>
                                    {notifs.length}
                                </span>
                            )}
                        </button>

                        {notifOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                width: 'min(340px, calc(100vw - 24px))', borderRadius: 12, zIndex: 1000,
                                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                boxShadow: '0 8px 32px rgba(15,23,42,0.12)', overflow: 'hidden',
                            }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Bell size={14} style={{ color: 'var(--color-warning)' }} />
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                                            {notifs.length > 0 ? `${notifs.length} notificaciones` : 'Sin notificaciones'}
                                        </span>
                                    </div>
                                    {notifs.length > 0 && (
                                        <button onClick={() => setNotifs([])} style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            Limpiar todas
                                        </button>
                                    )}
                                </div>
                                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Todo en orden ✓</div>
                                    ) : notifs.map((n, idx) => {
                                        const Icon = n.nivel === 'danger' ? AlertCircle : AlertTriangle
                                        const col  = n.nivel === 'danger' ? 'var(--color-error)' : 'var(--color-warning)'
                                        return (
                                            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: idx < notifs.length - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'default' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <Icon size={14} style={{ color: col, marginTop: 2, flexShrink: 0 }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4 }}>{n.titulo}</div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 1 }}>{n.desc}</div>
                                                    <div style={{ fontSize: 10.5, color: 'var(--color-subtle)', marginTop: 3, fontFamily: '"Geist Mono", monospace' }}>{n.tiempo}</div>
                                                </div>
                                                <button onClick={() => setNotifs(ns => ns.filter(x => x.id !== n.id))} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                                    <X size={11} strokeWidth={2} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Usuario */}
                    <div className="relative" ref={menuRef} style={{ flexShrink: 0 }}>
                        <button
                            onClick={() => setUserMenuAbierto(!userMenuAbierto)}
                            className="flex items-center gap-2 rounded-lg cursor-pointer"
                            style={{ padding: '6px 8px', background: userMenuAbierto ? 'var(--color-surface-alt)' : 'transparent', border: '1px solid transparent', transition: 'background 150ms ease' }}
                        >
                            <div className="grid place-items-center w-8 h-8 rounded-full text-xs font-semibold shrink-0" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                                {iniciales(nombreUsuario)}
                            </div>
                            <div className="admin-user-name text-left">
                                <div className="text-sm font-medium leading-none mb-0.5" style={{ color: 'var(--color-text)' }}>{nombreUsuario || 'Usuario'}</div>
                                <div className="text-xs leading-none" style={{ color: 'var(--color-muted)' }}>{rolUsuario}</div>
                            </div>
                            <ChevronDown size={14} strokeWidth={1.5} className="admin-user-name" style={{ color: 'var(--color-subtle)', transform: userMenuAbierto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }} />
                        </button>

                        {userMenuAbierto && (
                            <div className="absolute right-0 mt-1 w-52 rounded-xl overflow-hidden z-50" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{nombreUsuario || 'Usuario'}</div>
                                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{emailUsuario}</div>
                                </div>
                                <div className="p-1">
                                    <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm cursor-pointer text-left" style={{ background: 'transparent', border: 'none', color: 'var(--color-body)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <User size={16} strokeWidth={1.5} /> Mi perfil
                                    </button>
                                </div>
                                <div className="p-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                                    <button className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm cursor-pointer text-left" style={{ background: 'transparent', border: 'none', color: 'var(--color-error)' }}
                                        onClick={cerrarSesion}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-error-bg)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <LogOut size={16} strokeWidth={1.5} /> Cerrar sesión
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

// ─── Búsqueda global del panel (Fase 4 — Ale) ────────────────────────────────
// El buscador del header, ahora de verdad: manda lo tipeado al nuevo
// GET /search (con debounce y bandera de cancelado para descartar respuestas
// viejas) y muestra los resultados agrupados por tipo — pedidos, clientes,
// productos, descuentos/cupones y secciones del panel — cada uno con su link
// directo. El backend ya filtra los grupos según los permisos del miembro.

const SECCIONES_PANEL: { label: string; seccion: string; vista?: string; alias: string[] }[] = [
    { label: 'Dashboard',            seccion: 'dashboard',     alias: ['inicio', 'dashboard', 'resumen'] },
    { label: 'Pedidos',              seccion: 'pedidos',       alias: ['pedidos', 'ventas', 'ordenes', 'órdenes'] },
    { label: 'Historial de pedidos', seccion: 'pedidos',       vista: 'historial', alias: ['historial'] },
    { label: 'Postventa',            seccion: 'pedidos',       vista: 'devoluciones', alias: ['postventa', 'devoluciones', 'notas de credito', 'notas de crédito'] },
    { label: 'Catálogo',             seccion: 'catalogo',      alias: ['catalogo', 'catálogo', 'productos'] },
    { label: 'Categorías',           seccion: 'categorias',    alias: ['categorias', 'categorías'] },
    { label: 'Clientes',             seccion: 'clientes',      alias: ['clientes'] },
    { label: 'Reportes',             seccion: 'reportes',      alias: ['reportes', 'reporte', 'metricas', 'métricas'] },
    { label: 'Descuentos',           seccion: 'descuentos',    alias: ['descuentos', 'promociones'] },
    { label: 'Cupones',              seccion: 'cupones',       alias: ['cupones', 'cupon', 'cupón'] },
    { label: 'Mensajes',             seccion: 'mensajes',      alias: ['mensajes', 'chat', 'conversaciones'] },
    { label: 'Configuración',        seccion: 'configuracion', alias: ['configuracion', 'configuración', 'ajustes', 'equipo', 'apariencia', 'notificaciones'] },
]

function BusquedaGlobal() {
    const router = useRouter()
    const [q, setQ] = useState('')
    const [abierto, setAbierto] = useState(false)
    const [buscando, setBuscando] = useState(false)
    const [resultados, setResultados] = useState<ApiSearchResults | null>(null)
    const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
    const wrapRef = useRef<HTMLDivElement>(null)

    // Cerrar al clickear afuera.
    useEffect(() => {
        const c = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false) }
        document.addEventListener('mousedown', c)
        return () => document.removeEventListener('mousedown', c)
    }, [])

    // Debounce + bandera de cancelado: si el usuario sigue tipeando, la
    // respuesta vieja se descarta y no pisa a la nueva.
    useEffect(() => {
        const query = q.trim()
        if (query.length < 2) { setResultados(null); setBuscando(false); setErrorBusqueda(null); return }
        let cancelado = false
        setBuscando(true)
        const t = setTimeout(() => {
            panelSearch(query)
                .then(r => { if (!cancelado) { setResultados(r); setErrorBusqueda(null) } })
                .catch(e => { if (!cancelado) { setResultados(null); setErrorBusqueda(e instanceof ApiError ? e.message : 'No se pudo buscar') } })
                .finally(() => { if (!cancelado) setBuscando(false) })
        }, 300)
        return () => { cancelado = true; clearTimeout(t) }
    }, [q])

    const irYCerrar = (seccion: string, extra?: Record<string, string>) => {
        const { negocioId, moduloPadre } = router.query
        setAbierto(false)
        setQ('')
        router.push({
            pathname: '/admin/[negocioId]/[moduloPadre]/[seccion]',
            query: { negocioId: (negocioId as string) ?? 'rama-tienda', moduloPadre: (moduloPadre as string) ?? 'ventas', seccion, ...extra },
        })
    }

    const query = q.trim().toLowerCase()
    const secciones = query.length >= 2
        ? SECCIONES_PANEL.filter(s => s.label.toLowerCase().includes(query) || s.alias.some(a => a.includes(query))).slice(0, 3)
        : []

    const hayResultados = resultados && (
        resultados.pedidos.length > 0 || resultados.clientes.length > 0 ||
        resultados.productos.length > 0 || resultados.descuentos.length > 0 || secciones.length > 0
    )
    const sinNada = !buscando && resultados && !hayResultados && secciones.length === 0

    return (
        <div className="admin-search-wrap relative" ref={wrapRef}>
            <Search size={15} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-subtle)' }} />
            <input
                type="text"
                value={q}
                onChange={e => { setQ(e.target.value); setAbierto(true) }}
                onFocus={() => setAbierto(true)}
                onKeyDown={e => { if (e.key === 'Escape') { setAbierto(false); (e.target as HTMLInputElement).blur() } }}
                placeholder="Buscar en Orbita..."
                className="h-9 pl-9 pr-3 text-sm rounded-lg outline-none"
                style={{ width: 220, background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
            />

            {abierto && q.trim().length >= 2 && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: 'min(400px, calc(100vw - 24px))', borderRadius: 12, zIndex: 1000,
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    boxShadow: '0 8px 32px rgba(15,23,42,0.12)', overflow: 'hidden',
                }}>
                    <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                        {buscando && (
                            <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--color-muted)' }}>Buscando…</div>
                        )}
                        {errorBusqueda && !buscando && (
                            <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--color-error)' }}>{errorBusqueda}</div>
                        )}
                        {sinNada && !errorBusqueda && (
                            <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>
                                Sin resultados para “{q.trim()}”
                            </div>
                        )}

                        {!buscando && resultados && resultados.pedidos.length > 0 && (
                            <GrupoBusqueda titulo="Pedidos" icon={<ShoppingBag size={12} strokeWidth={1.8} />}>
                                {resultados.pedidos.map(p => (
                                    <FilaBusqueda key={p.id} onClick={() => irYCerrar('pedidos', { vista: 'detalle', id: p.id })}>
                                        <span style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 600, color: 'var(--color-primary)', fontSize: 12.5 }}>#{p.orderNumber}</span>
                                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{p.customerName ?? 'Sin cliente'}</span>
                                        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'var(--color-muted)' }}>{fmtMoney(p.total)}</span>
                                    </FilaBusqueda>
                                ))}
                            </GrupoBusqueda>
                        )}

                        {!buscando && resultados && resultados.clientes.length > 0 && (
                            <GrupoBusqueda titulo="Clientes" icon={<Users size={12} strokeWidth={1.8} />}>
                                {resultados.clientes.map(c => (
                                    <FilaBusqueda key={c.id} onClick={() => irYCerrar('clientes', { vista: 'detalle', id: c.id })}>
                                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{c.nombre}</span>
                                        {c.email && <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11.5, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{c.email}</span>}
                                    </FilaBusqueda>
                                ))}
                            </GrupoBusqueda>
                        )}

                        {!buscando && resultados && resultados.productos.length > 0 && (
                            <GrupoBusqueda titulo="Productos" icon={<Package size={12} strokeWidth={1.8} />}>
                                {resultados.productos.map(p => (
                                    <FilaBusqueda key={p.id} onClick={() => irYCerrar('catalogo', { vista: 'nuevo', editar: p.id })}>
                                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{p.name}</span>
                                        <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'var(--color-muted)' }}>{fmtMoney(p.basePrice)}</span>
                                        {p.status !== 'PUBLISHED' && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)' }}>Borrador</span>}
                                    </FilaBusqueda>
                                ))}
                            </GrupoBusqueda>
                        )}

                        {!buscando && resultados && resultados.descuentos.length > 0 && (
                            <GrupoBusqueda titulo="Descuentos y cupones" icon={<Tag size={12} strokeWidth={1.8} />}>
                                {resultados.descuentos.map(dt => (
                                    <FilaBusqueda key={dt.id} onClick={() => dt.esCupon ? irYCerrar('cupones') : irYCerrar('descuentos', { vista: 'detalle', id: dt.id })}>
                                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{dt.name}</span>
                                        {dt.code && <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: 11.5, color: 'var(--color-primary)' }}>{dt.code}</span>}
                                        {!dt.isActive && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)' }}>Inactivo</span>}
                                    </FilaBusqueda>
                                ))}
                            </GrupoBusqueda>
                        )}

                        {secciones.length > 0 && !buscando && (
                            <GrupoBusqueda titulo="Secciones" icon={<LayoutGrid size={12} strokeWidth={1.8} />}>
                                {secciones.map(s => (
                                    <FilaBusqueda key={`${s.seccion}-${s.vista ?? ''}`} onClick={() => irYCerrar(s.seccion, s.vista ? { vista: s.vista } : undefined)}>
                                        <span style={{ flex: 1, fontSize: 13 }}>{s.label}</span>
                                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Ir a la sección →</span>
                                    </FilaBusqueda>
                                ))}
                            </GrupoBusqueda>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function GrupoBusqueda({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 4px', fontSize: 10.5, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {icon} {titulo}
            </div>
            {children}
        </div>
    )
}

function FilaBusqueda({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'var(--color-text)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
            {children}
        </button>
    )
}
