// Sidebar del panel admin — diseño del prototipo "Panel Admin 34":
// logo orbital, selector de espacio, buscador con resultados en vivo y
// módulos expandibles con badges, dots de alerta y sub-secciones.
//
// Tres modos (SidebarModeContext):
//   expanded  — ancho completo con etiquetas, buscador y selector
//   collapsed — riel de íconos fijo
//   hover     — riel de íconos que se expande como overlay al pasar el mouse
//
// En hover el sidebar es `position: fixed` y un spacer div ocupa su
// lugar en el flex layout de AdminLayout. Así se superpone al
// contenido sin empujarlo.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { LayoutDashboard, ShoppingBag, Users, Package, MessageSquare, Tag, Settings, BookOpen, Search, ChevronDown, Check, Plus, Store, X, Sparkles, Maximize2, Minimize2, MousePointer } from 'lucide-react'
import type { ComponentType } from 'react'

import { panelSearch, getUnreadConversationsCount, ApiError, type ApiSearchResults } from '@/lib/api'
import { fmtMoney } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { OrbiTrigger } from '@/components/orbi/OrbiTrigger'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { adminPath, currentSlug } from '@/lib/tenant'
import { useSidebarMode, type SidebarMode } from '@/layouts/SidebarModeContext'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
// `permisos`: con tener ALGUNO de la lista el ítem se muestra; sin lista se
// muestra siempre (dentro de un módulo ya filtrado). La regla de todo el
// menú: nada visible que el rol no pueda usar.
interface Sub { label: string; seccion: string; vista?: string; permisos?: string[] }
interface Modulo { id: string; label: string; Icon: IconType; seccion: string; badge?: number; alert?: boolean; subs?: Sub[] }

// El negocio tiene UN espacio activo (su rubro). El selector no lista rubros
// ajenos que no existen: muestra el espacio actual y ofrece crear otro — el
// alta de un espacio nuevo pasa por el onboarding de rubro, no por acá.
const ESPACIO_ACTUAL = { id: 'tienda', label: 'Tienda', desc: 'E-commerce y retail', Icon: Store, color: '#2563EB', bg: 'rgba(37,99,235,0.10)' }

const MODULOS: Modulo[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, seccion: 'dashboard' },
    {
        id: 'pedidos', label: 'Pedidos', Icon: ShoppingBag, seccion: 'pedidos',
        subs: [
            { label: 'Lista', seccion: 'pedidos' },
            { label: 'Historial', seccion: 'pedidos', vista: 'historial' },
            { label: 'Cancelaciones y devoluciones', seccion: 'pedidos', vista: 'devoluciones' },
            { label: 'Nuevo +', seccion: 'pedidos', vista: 'nuevo', permisos: ['orders.manage'] },
        ],
    },
    {
        id: 'clientes', label: 'Clientes', Icon: Users, seccion: 'clientes',
        subs: [
            { label: 'Lista', seccion: 'clientes' },
            { label: 'Reporte de clientes', seccion: 'reportes', vista: 'clientes', permisos: ['reports.view'] },
        ],
    },
    {
        id: 'productos', label: 'Productos', Icon: Package, seccion: 'catalogo',
        subs: [
            { label: 'Lista de productos', seccion: 'catalogo' },
            { label: 'Crear producto', seccion: 'catalogo', vista: 'nuevo', permisos: ['catalog.manage'] },
            { label: 'Categorías', seccion: 'categorias' },
            { label: 'Reporte de productos', seccion: 'reportes', vista: 'productos', permisos: ['reports.view'] },
        ],
    },
    {
        id: 'mensajes', label: 'Mensajes', Icon: MessageSquare, seccion: 'mensajes',
        subs: [
            { label: 'Bandeja', seccion: 'mensajes' },
            { label: 'Plantillas', seccion: 'mensajes', vista: 'plantillas' },
        ],
    },
    {
        id: 'descuentos', label: 'Descuentos', Icon: Tag, seccion: 'descuentos',
        subs: [
            { label: 'Descuentos',  seccion: 'descuentos' },
            { label: 'Cupones',     seccion: 'cupones' },
            { label: 'Rendimiento', seccion: 'descuentos', vista: 'metricas' },
        ],
    },
    {
        // Sin `subs`: la navegación fina pasó a vivir en su propio menú guía
        // (ConfigSidebar.tsx), columna fija a la derecha de este riel.
        id: 'config', label: 'Configuración', Icon: Settings, seccion: 'configuracion',
    },
    {
        id: 'avanzado', label: 'Avanzado', Icon: Sparkles, seccion: 'avanzado',
    },
    {
        id: 'manual', label: 'Manual', Icon: BookOpen, seccion: 'manual',
    },
]

const SECCION_MODULO: Record<string, string> = {
    dashboard: 'dashboard', pedidos: 'pedidos', clientes: 'clientes',
    catalogo: 'productos', categorias: 'productos', inventario: 'productos', reportes: 'productos',
    mensajes: 'mensajes', descuentos: 'descuentos', cupones: 'descuentos', configuracion: 'config',
    avanzado: 'avanzado', manual: 'manual',
}

const ROLES_MODULO: Record<string, string[]> = {}

const PERMISOS_MODULO: Record<string, string[]> = {
    dashboard: ['reports.dashboard'],
    pedidos: ['orders.view'],
    clientes: ['customers.view'],
    productos: ['catalog.view', 'inventory.view'],
    mensajes: ['messages.view'],
    descuentos: ['discounts.view', 'discounts.manage'],
    config: ['config.edit', 'config.team.view', 'config.team.manage', 'config.audit.view', 'config.domains.manage'],
    avanzado: ['advanced.manage'],
}

// Anchos en px — mismos valores que los antiguos w-16/w-60 de Tailwind.
const W_NARROW = 64
const W_WIDE = 240

// Opciones del selector de modo
const MODOS: { key: SidebarMode; label: string; Icon: IconType }[] = [
    { key: 'expanded',  label: 'Expandido',         Icon: Maximize2 },
    { key: 'collapsed', label: 'Colapsado',          Icon: Minimize2 },
    { key: 'hover',     label: 'Al pasar el mouse',  Icon: MousePointer },
]

interface Props { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: Props) {
    const router     = useRouter()
    const { user }   = useAuth()
    const { mode, setMode } = useSidebarMode()
    const negocioId  = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
    const partesSlug = router.query.slug
    const seccion    = ((Array.isArray(partesSlug) ? partesSlug[partesSlug.length - 1] : undefined) ?? (router.query.seccion as string)) ?? 'dashboard'
    const vista      = (router.query.vista       as string) ?? ''

    const moduloActivo = seccion === 'reportes'
        ? (vista === 'clientes' ? 'clientes' : 'productos')
        : SECCION_MODULO[seccion] ?? 'dashboard'

    // Módulos visibles según los permisos del rol.
    const permisos = user?.type === 'member' && user.role !== 'owner' ? user.permissions : null
    const rol = user?.type === 'member' ? user.role : null
    const modulosVisibles = MODULOS.filter(m => {
        const roles = ROLES_MODULO[m.id]
        if (roles && rol && !roles.includes(rol)) return false
        if (!permisos) return true
        const req = PERMISOS_MODULO[m.id]
        return !req || req.some(p => permisos.includes(p))
    })

    const [abierto,   setAbierto]   = useState(moduloActivo)
    const [busqueda,  setBusqueda]  = useState('')
    const [rubroOpen, setRubroOpen] = useState(false)

    useEffect(() => { setAbierto(moduloActivo) }, [moduloActivo])

    // Desktop detection
    const [isDesktop, setIsDesktop] = useState(true)
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 769px)')
        const actualizar = () => setIsDesktop(mq.matches)
        actualizar()
        mq.addEventListener('change', actualizar)
        return () => mq.removeEventListener('change', actualizar)
    }, [])

    // Hover mode: el sidebar se expande al pasar el mouse y se contrae al
    // sacarlo. Timer de demora para evitar flicker (100 ms para abrir, 200 ms
    // para cerrar — el cierre es más lento para que el usuario pueda
    // corregir un mouse que se escapó).
    const [hoverAbierto, setHoverAbierto] = useState(false)
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])
    const handleMouseEnter = () => {
        if (mode !== 'hover' || !isDesktop) return
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(() => setHoverAbierto(true), 100)
    }
    const handleMouseLeave = () => {
        if (mode !== 'hover' || !isDesktop) return
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(() => setHoverAbierto(false), 200)
    }

    // ¿Angosto? (solo íconos, sin etiquetas)
    const esAngosto = isDesktop && (mode === 'collapsed' || (mode === 'hover' && !hoverAbierto))

    // Badge de "Mensajes": conteo real de conversaciones sin leer.
    const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
    useEffect(() => {
        if (user?.type !== 'member') return
        let cancelado = false
        const cargar = () => getUnreadConversationsCount()
            .then(r => { if (!cancelado) setMensajesNoLeidos(r.count) })
            .catch(err => { if (err instanceof ApiError && (err.status === 403 || err.status === 401)) clearInterval(interval) })
        cargar()
        const interval = setInterval(cargar, 15000)
        const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
        document.addEventListener('visibilitychange', alVolver)
        window.addEventListener('focus', alVolver)
        return () => {
            cancelado = true
            clearInterval(interval)
            document.removeEventListener('visibilitychange', alVolver)
            window.removeEventListener('focus', alVolver)
        }
    }, [user?.type])

    const rubroActual = ESPACIO_ACTUAL

    const ir = (sec: string, v?: string) => {
        router.push({ pathname: adminPath(negocioId, 'ventas', sec), query: v ? { vista: v } : undefined })
        onClose()
    }

    const irDetalle = (sec: string, id: string) => {
        router.push({ pathname: adminPath(negocioId, 'ventas', sec), query: { vista: 'detalle', id } })
        onClose()
    }

    // Búsqueda real contra GET /search.
    const [resultados, setResultados] = useState<ApiSearchResults | null>(null)
    const [buscando, setBuscando] = useState(false)
    const buscadorRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        const afuera = (e: MouseEvent) => {
            if (buscadorRef.current && !buscadorRef.current.contains(e.target as Node)) {
                setResultados(null)
                setBuscando(false)
            }
        }
        document.addEventListener('mousedown', afuera)
        return () => document.removeEventListener('mousedown', afuera)
    }, [])
    useEffect(() => {
        const q = busqueda.trim()
        if (q.length < 2) { setResultados(null); setBuscando(false); return }
        let vigente = true
        setBuscando(true)
        const t = setTimeout(() => {
            panelSearch(q)
                .then(r => {
                    if (!vigente) return
                    setResultados({
                        query: r?.query ?? q,
                        pedidos: r?.pedidos ?? [], clientes: r?.clientes ?? [],
                        productos: r?.productos ?? [], descuentos: r?.descuentos ?? [],
                    })
                })
                .catch(() => { if (vigente) setResultados(null) })
                .finally(() => { if (vigente) setBuscando(false) })
        }, 350)
        return () => { vigente = false; clearTimeout(t) }
    }, [busqueda])

    const subActiva = (m: Modulo, s: Sub) => {
        if (seccion !== s.seccion) return false
        const v = seccion === 'pedidos' && (vista === 'notas' || vista === 'cancelaciones') ? 'devoluciones' : (vista || '')
        if (s.vista) return v === s.vista
        const siblingsWithVista = (m.subs ?? []).filter(sub => sub.seccion === s.seccion && sub.vista)
        return !siblingsWithVista.some(sub => v === sub.vista)
    }

    // Selector de modo — popover
    const [selectorAbierto, setSelectorAbierto] = useState(false)
    const selectorRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        if (!selectorAbierto) return
        const afuera = (e: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
                setSelectorAbierto(false)
            }
        }
        document.addEventListener('mousedown', afuera)
        return () => document.removeEventListener('mousedown', afuera)
    }, [selectorAbierto])

    // Ancho actual del sidebar
    const anchoActual = esAngosto ? W_NARROW : W_WIDE
    // En modo hover, el sidebar es position:fixed y el spacer ocupa lugar en flex
    const esHoverDesktop = mode === 'hover' && isDesktop

    const sidebar = (
        <aside
            className={`admin-sidebar flex flex-col h-full${isOpen ? ' sidebar-open' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                background: 'var(--color-bg)',
                borderRight: '1px solid var(--color-border)',
                width: anchoActual,
                flexShrink: 0,
                transition: 'width 200ms ease, box-shadow 200ms ease, transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                ...(esHoverDesktop ? {
                    position: 'fixed',
                    top: 0, left: 0,
                    zIndex: 30,
                    boxShadow: hoverAbierto ? '8px 0 24px rgba(0,0,0,0.10)' : 'none',
                } : {}),
            }}
        >
            {/* Logo — misma altura que el header (h-16 = 64px). */}
            <div className="flex items-center gap-2.5 h-16 px-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)', justifyContent: esAngosto ? 'center' : 'flex-start' }}>
                <OrbitLogo />
                {!esAngosto && <span className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>Orbita</span>}
            </div>

            {/* Selector de espacio */}
            {!esAngosto && (
            <div style={{ margin: '10px 12px 4px', position: 'relative' }}>
                <button
                    onClick={() => setRubroOpen(o => !o)}
                    className="ds-hover"
                    style={{
                        width: '100%', height: 36, padding: '0 10px',
                        borderRadius: 8,
                        border: `1px solid ${rubroOpen ? rubroActual.color + '55' : 'var(--color-border)'}`,
                        background: rubroOpen ? rubroActual.bg : 'var(--color-surface)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'all 180ms',
                    }}
                >
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: rubroActual.bg, border: `1px solid ${rubroActual.color}33`, display: 'grid', placeItems: 'center' }}>
                        <rubroActual.Icon size={12} strokeWidth={2} color={rubroActual.color} />
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{rubroActual.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--color-subtle)', lineHeight: 1.2 }}>{rubroActual.desc}</div>
                    </div>
                    <ChevronDown size={12} strokeWidth={2} color="var(--color-muted)" style={{ transition: 'transform 200ms', transform: rubroOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                </button>

                {rubroOpen && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 5px)', zIndex: 60, borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 12px 6px' }}>Tu espacio</div>
                        <div style={{ margin: '0 6px', padding: '9px 8px', display: 'flex', alignItems: 'center', gap: 9, borderRadius: 8, background: rubroActual.bg }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: rubroActual.bg, border: `1px solid ${rubroActual.color}33`, display: 'grid', placeItems: 'center' }}>
                                <rubroActual.Icon size={14} strokeWidth={1.8} color={rubroActual.color} />
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{rubroActual.label}</div>
                                <div style={{ fontSize: 10, color: 'var(--color-subtle)', lineHeight: 1.3 }}>{rubroActual.desc}</div>
                            </div>
                            <Check size={13} strokeWidth={2.5} color={rubroActual.color} />
                        </div>
                        <div
                            style={{ width: 'calc(100% - 12px)', margin: '8px 6px 6px', padding: '9px 8px', display: 'flex', alignItems: 'center', gap: 9, borderRadius: 8, border: '1px dashed var(--color-border)', background: 'transparent' }}
                        >
                            <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'var(--color-surface-alt)', display: 'grid', placeItems: 'center' }}>
                                <Plus size={14} strokeWidth={2} color="var(--color-subtle)" />
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', lineHeight: 1.2 }}>Otro espacio</span>
                                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-subtle)', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 999, padding: '2px 6px' }}>Próximamente</span>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--color-subtle)', lineHeight: 1.3, marginTop: 2 }}>Vas a poder sumar otro rubro a tu cuenta</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* Buscador */}
            {!esAngosto && (
            <div className="relative mx-3 mt-2 mb-1" ref={buscadorRef}>
                <Search size={13} strokeWidth={1.6} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-muted)' }} />
                <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { setBusqueda(''); setResultados(null) } }}
                    placeholder="Buscar pedidos, clientes..."
                    className="ds-field w-full h-8 pl-7 pr-7 text-xs rounded-md outline-none"
                    style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
                {busqueda && (
                    <button
                        onClick={() => { setBusqueda(''); setResultados(null) }}
                        title="Limpiar búsqueda"
                        className="ds-hover absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center rounded"
                        style={{ position: 'absolute', width: 18, height: 18, border: 'none', background: 'transparent', color: 'var(--color-muted)' }}
                    >
                        <X size={11} strokeWidth={2.2} />
                    </button>
                )}
                {(buscando || resultados) && (
                    <div className="absolute left-0 right-0 mt-1 p-1.5 rounded-lg overflow-y-auto" style={{ top: '100%', zIndex: 70, maxHeight: 340, background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
                        {buscando ? (
                            <div aria-hidden="true" style={{ padding: '4px 2px' }}>
                                {[0, 1, 2].map(i => (
                                    <div key={i} style={{ padding: '8px' }}>
                                        <SkeletonText width={`${[76, 62, 68][i]}%`} height={10} delay={i * 90} />
                                    </div>
                                ))}
                            </div>
                        ) : resultados ? (
                            <>
                                {resultados.pedidos.length   > 0 && <><div style={resLabel}>PEDIDOS</div>  {resultados.pedidos.map(p   => <ResBtn key={p.id} onClick={() => { irDetalle('pedidos', p.id); setBusqueda(''); setResultados(null) }}>#{p.orderNumber} · {p.customerName ?? 'Sin cliente'} · {fmtMoney(p.total)}</ResBtn>)}</>}
                                {resultados.clientes.length  > 0 && <><div style={resLabel}>CLIENTES</div> {resultados.clientes.map(c  => <ResBtn key={c.id} onClick={() => { irDetalle('clientes', c.id); setBusqueda(''); setResultados(null) }}>{c.nombre}{c.email ? ` · ${c.email}` : ''}</ResBtn>)}</>}
                                {resultados.productos.length > 0 && <><div style={resLabel}>PRODUCTOS</div>{resultados.productos.map(p => <ResBtn key={p.id} onClick={() => { ir('catalogo'); setBusqueda(''); setResultados(null) }}>{p.name} · {fmtMoney(p.basePrice)}</ResBtn>)}</>}
                                {resultados.pedidos.length + resultados.clientes.length + resultados.productos.length === 0 && <div className="p-3 text-xs text-center" style={{ color: 'var(--color-muted)' }}>Sin resultados</div>}
                            </>
                        ) : null}
                    </div>
                )}
            </div>
            )}

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
                {modulosVisibles.map(m => {
                    const activo = moduloActivo === m.id
                    const open   = abierto === m.id
                    const subs   = (m.subs ?? []).filter(s => !permisos || !s.permisos || s.permisos.some(p => permisos.includes(p)))
                    const badge  = m.id === 'mensajes' ? (mensajesNoLeidos || undefined) : m.badge
                    const destino = subs[0] ?? { seccion: m.seccion, vista: undefined }
                    return (
                        <div key={m.id}>
                            <button
                                onClick={() => { ir(destino.seccion, destino.vista); setAbierto(m.id) }}
                                title={esAngosto ? m.label : undefined}
                                className={`ds-hover flex items-center h-9 rounded-md${esAngosto ? ' w-9 mx-auto justify-center px-0' : ' gap-2.5 w-full px-2.5'}`}
                                style={{ border: 'none', fontSize: 14, background: activo ? 'var(--color-primary-bg)' : 'transparent', color: activo ? 'var(--color-primary)' : 'var(--color-body)', fontWeight: activo ? 600 : 500, position: 'relative' }}
                            >
                                <m.Icon size={16} strokeWidth={1.6} />
                                {!esAngosto && <span className="flex-1 text-left">{m.label}</span>}
                                {!esAngosto && m.alert && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} />}
                                {!esAngosto && badge && <span className="grid place-items-center text-[10px] font-bold" style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, fontFamily: '"Geist Mono", monospace', background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: activo ? 'var(--color-on-primary)' : 'var(--color-muted)' }}>{badge}</span>}
                                {esAngosto && (m.alert || badge) && (
                                    <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: 'var(--color-error)' }} />
                                )}
                            </button>

                            {open && subs.length > 0 && !esAngosto && (
                                <div className="flex flex-col gap-px mt-0.5" style={{ paddingLeft: 20 }}>
                                    {subs.map(s => {
                                        const sa = subActiva(m, s)
                                        return (
                                            <button
                                                key={s.label}
                                                onClick={() => ir(s.seccion, s.vista)}
                                                className="ds-hover h-[30px] px-2 rounded-md text-left text-xs"
                                                style={{ border: 'none', fontWeight: sa ? 600 : 500, color: sa ? 'var(--color-primary)' : 'var(--color-muted)', background: sa ? 'var(--color-primary-bg)' : 'transparent' }}
                                            >
                                                {s.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </nav>

            {/* Orbi AI trigger */}
            <div className="sidebar-mode-toggle shrink-0" style={{ padding: '4px 8px 0' }}>
                <OrbiTrigger collapsed={esAngosto} />
            </div>

            {/* Selector de modo — reemplaza el viejo botón de colapsar/expandir.
                Un click abre un popover con las tres opciones (Expandido, Colapsado,
                Al pasar el mouse), con indicador de cuál está activo. */}
            <div className="sidebar-mode-toggle shrink-0" ref={selectorRef} style={{ borderTop: '1px solid var(--color-border)', padding: 8, position: 'relative' }}>
                <button
                    onClick={() => setSelectorAbierto(o => !o)}
                    title="Modo del menú lateral"
                    className={`ds-hover flex items-center h-9 rounded-md text-[13px]${esAngosto ? ' w-9 mx-auto justify-center px-0' : ' gap-2.5 w-full px-2.5'}`}
                    style={{ border: 'none', background: selectorAbierto ? 'var(--color-surface-alt)' : 'transparent', color: 'var(--color-muted)' }}
                >
                    {(() => {
                        const ModoIcon = MODOS.find(m => m.key === mode)?.Icon ?? MousePointer
                        return <ModoIcon size={16} strokeWidth={1.6} />
                    })()}
                    {!esAngosto && <span className="flex-1 text-left">Menú lateral</span>}
                </button>
                {selectorAbierto && (
                    <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 4px)',
                        left: esAngosto ? W_NARROW + 4 : 8,
                        ...(esAngosto ? { bottom: 0 } : {}),
                        width: 210, padding: 6, borderRadius: 10, zIndex: 80,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        boxShadow: '0 10px 30px rgba(15,23,42,0.16)',
                    }}>
                        <div style={{ padding: '6px 8px 8px', fontSize: 11, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Menú lateral
                        </div>
                        {MODOS.map(({ key, label, Icon }) => {
                            const activo = mode === key
                            return (
                                <button
                                    key={key}
                                    className="ds-hover"
                                    onClick={() => { setMode(key); setSelectorAbierto(false); if (key !== 'hover') setHoverAbierto(false) }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                                        padding: '8px 10px', borderRadius: 7, border: 'none',
                                        background: activo ? 'var(--color-primary-bg)' : 'transparent',
                                        color: activo ? 'var(--color-primary)' : 'var(--color-body)',
                                        fontSize: 13, fontWeight: activo ? 600 : 500, textAlign: 'left',
                                        cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                >
                                    <Icon size={14} strokeWidth={1.7} style={{ flexShrink: 0 }} />
                                    <span style={{ flex: 1 }}>{label}</span>
                                    {activo && (
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)' }} />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </aside>
    )

    return (
        <>
            <style>{`
                @media (max-width: 768px) {
                    .admin-sidebar {
                        position: fixed !important;
                        left: 0; top: 0;
                        height: 100vh !important;
                        width: 15rem !important;
                        z-index: 50;
                        transform: translateX(-100%);
                        box-shadow: none;
                    }
                    .admin-sidebar.sidebar-open {
                        transform: translateX(0);
                        box-shadow: 8px 0 32px rgba(0,0,0,0.25);
                    }
                    .sidebar-mode-toggle { display: none !important; }
                }
            `}</style>

            {/* Spacer: en modo hover, el sidebar es position:fixed y este div
                ocupa su ancho en el flex layout de AdminLayout. */}
            {esHoverDesktop && (
                <div aria-hidden="true" style={{ width: W_NARROW, flexShrink: 0 }} />
            )}

            {/* Overlay mobile */}
            <div
                className="admin-backdrop"
                onClick={() => onClose()}
                style={{
                    display: isOpen ? 'block' : 'none',
                    position: 'fixed', inset: 0, zIndex: 40,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(2px)',
                    WebkitBackdropFilter: 'blur(2px)',
                }}
            />
            <style>{`
                @media (min-width: 769px) {
                    .admin-backdrop { display: none !important; }
                }
            `}</style>

            {sidebar}
        </>
    )
}

function OrbitLogo() {
    return <OrbitaLogo size={26} />
}

function ResBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={resItem}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-bg)'; e.currentTarget.style.color = 'var(--color-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-body)' }}
        >
            {children}
        </button>
    )
}

const resLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 8px 4px' }
const resItem:  React.CSSProperties = { width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--color-body)', transition: 'background 140ms, color 140ms' }
