import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Bell, Moon, Sun, Search, LogOut, User, ChevronDown, AlertCircle, AlertTriangle, X, Menu, ArrowLeft } from 'lucide-react'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useAuth } from '@/hooks/useAuth'
import { nombreConversacion } from '@/modules/ventas/panel/mensajes/mock/mensajes.mock'

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
const NOTIFS: Notif[] = [
    { id: 'n1', nivel: 'danger',  titulo: '4 pedidos necesitan atención', desc: 'Confirmá pagos y movelos a preparación', tiempo: 'Ahora' },
    { id: 'n2', nivel: 'danger',  titulo: '2 pedidos sin atender +2hs',    desc: 'Pedidos P-0182 y P-0183 sin respuesta', tiempo: 'Hace 2hs' },
    { id: 'n3', nivel: 'warning', titulo: '3 productos con stock < 5',      desc: 'Remera oversize, Buzo frisa, Gorra', tiempo: 'Hace 3hs' },
    { id: 'n4', nivel: 'warning', titulo: '1 pago por confirmar',           desc: 'Transferencia pendiente de validación', tiempo: 'Hace 5hs' },
]

interface Props { onMenuClick: () => void }

export default function Header({ onMenuClick }: Props) {
    const { isDark, toggle } = useDarkMode()

    // (Alex) Hice andar SOLO el botón "Cerrar sesión" para poder probar entrar y
    // salir mientras desarrollamos. La tarjeta completa del perfil de usuario
    // ("Globales: Perfil de usuario y cerrar sesión") sigue siendo de Alan.
    const { logout } = useAuth()
    const cerrarSesion = async () => {
        await logout()
        window.location.href = '/login'   // con recarga completa: así maneja el equipo la vuelta al login
    }
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

                    {/* Buscador (oculto en mobile) */}
                    <div className="admin-search-wrap relative">
                        <Search size={15} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-subtle)' }} />
                        <input
                            type="text"
                            placeholder="Buscar en Orbita..."
                            className="h-9 pl-9 pr-3 text-sm rounded-lg outline-none"
                            style={{ width: 220, background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
                        />
                    </div>

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
                                RM
                            </div>
                            <div className="admin-user-name text-left">
                                <div className="text-sm font-medium leading-none mb-0.5" style={{ color: 'var(--color-text)' }}>Alexander</div>
                                <div className="text-xs leading-none" style={{ color: 'var(--color-muted)' }}>Propietario</div>
                            </div>
                            <ChevronDown size={14} strokeWidth={1.5} className="admin-user-name" style={{ color: 'var(--color-subtle)', transform: userMenuAbierto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }} />
                        </button>

                        {userMenuAbierto && (
                            <div className="absolute right-0 mt-1 w-52 rounded-xl overflow-hidden z-50" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Alexander</div>
                                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>alexander@orbita.com</div>
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
