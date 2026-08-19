// Sidebar del panel admin — diseño del prototipo "Panel Admin 34":
// logo orbital, selector de espacio, buscador con resultados en vivo y
// módulos expandibles con badges, dots de alerta y sub-secciones.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { LayoutDashboard, ShoppingBag, Users, Package, MessageSquare, Tag, Settings, Search, ChevronDown, Check, Plus, Store, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { ComponentType } from 'react'

import { panelSearch, getUnreadConversationsCount, ApiError, type ApiSearchResults } from '@/lib/api'
import { fmtMoney } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { adminPath, currentSlug } from '@/lib/tenant'

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
        // Sin badge/alert hardcodeados: los contadores reales viven en el
        // dashboard (alertas) y en las pestañas de cada sección. Poner "4" fijo
        // acá mentía para todos los negocios, incluso los recién creados.
        id: 'pedidos', label: 'Pedidos', Icon: ShoppingBag, seccion: 'pedidos',
        subs: [
            { label: 'Lista', seccion: 'pedidos' },
            { label: 'Historial', seccion: 'pedidos', vista: 'historial' },
            { label: 'Postventa', seccion: 'pedidos', vista: 'devoluciones' },
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
        id: 'config', label: 'Configuración', Icon: Settings, seccion: 'configuracion',
        subs: [
            { label: 'General', seccion: 'configuracion', permisos: ['config.edit'] },
            { label: 'Apariencia', seccion: 'configuracion', vista: 'apariencia', permisos: ['config.edit'] },
            { label: 'Equipo', seccion: 'configuracion', vista: 'equipo', permisos: ['config.team.view', 'config.team.manage'] },
            { label: 'Notificaciones', seccion: 'configuracion', vista: 'notificaciones', permisos: ['config.edit'] },
        ],
    },
]

const SECCION_MODULO: Record<string, string> = {
    dashboard: 'dashboard', pedidos: 'pedidos', clientes: 'clientes',
    catalogo: 'productos', categorias: 'productos', inventario: 'productos', reportes: 'productos',
    mensajes: 'mensajes', descuentos: 'descuentos', cupones: 'descuentos', configuracion: 'config',
}

// Qué permiso necesita cada módulo para APARECER en el menú (alcanza con
// tener alguno de la lista). La autoridad es el backend — sus endpoints ya
// piden permiso —; esto evita mostrarle a un empleado secciones enteras
// donde todo le daría "sin permiso". Un módulo sin entrada acá se muestra
// siempre. El dashboard es facturación: pide reports.view como los reportes.
const PERMISOS_MODULO: Record<string, string[]> = {
    dashboard: ['reports.dashboard'],
    pedidos: ['orders.view'],
    clientes: ['customers.view'],
    productos: ['catalog.view', 'inventory.view'],
    mensajes: ['orders.view', 'customers.view'], // atención al cliente
    descuentos: ['discounts.view', 'discounts.manage'],
    config: ['config.edit', 'config.team.view', 'config.team.manage', 'config.audit.view', 'config.domains.manage'],
}

interface Props { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: Props) {
    const router     = useRouter()
    const { user }   = useAuth()
    const negocioId  = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
    // La sección viva sale del catch-all [...slug] (último segmento de la URL):
    // query.seccion dejó de existir con la reorganización de rutas a
    // pages/admin/[...slug].tsx — leerlo hacía que el sidebar marcara SIEMPRE
    // "Dashboard" como activo, estés en la pantalla que estés.
    const partesSlug = router.query.slug
    const seccion    = ((Array.isArray(partesSlug) ? partesSlug[partesSlug.length - 1] : undefined) ?? (router.query.seccion as string)) ?? 'dashboard'
    const vista      = (router.query.vista       as string) ?? ''

    const moduloActivo = seccion === 'reportes'
        ? (vista === 'clientes' ? 'clientes' : 'productos')
        : SECCION_MODULO[seccion] ?? 'dashboard'

    // Módulos visibles según los permisos del rol. Mientras la sesión carga
    // (user null) se muestran todos para no hacer parpadear el menú. El DUEÑO
    // nunca se filtra (permisos = null = ver todo): su acceso no puede
    // depender de que un permiso nuevo ya exista en la base — con el filtro a
    // secas, reports.dashboard sin backfill le escondió su propio dashboard.
    const permisos = user?.type === 'member' && user.role !== 'owner' ? user.permissions : null
    const modulosVisibles = MODULOS.filter(m => {
        if (!permisos) return true
        const req = PERMISOS_MODULO[m.id]
        return !req || req.some(p => permisos.includes(p))
    })

    const [abierto,   setAbierto]   = useState(moduloActivo)
    const [busqueda,  setBusqueda]  = useState('')
    const [rubroOpen, setRubroOpen] = useState(false)

    // Sincronizar módulo abierto al navegar
    useEffect(() => { setAbierto(moduloActivo) }, [moduloActivo])

    // Sidebar colapsable (solo desktop — en mobile ya es un drawer que se
    // abre/cierra entero, colapsarlo a una franja de íconos no tiene sentido
    // ahí). Se recuerda entre sesiones vía localStorage, mismo criterio que
    // `orbita-theme`. Arranca en `false` en el primer render (server Y
    // cliente) a propósito — así no hay mismatch de hidratación — y recién
    // después de montado se lee el valor guardado.
    const [colapsado, setColapsado] = useState(false)
    const [isDesktop, setIsDesktop] = useState(true)
    useEffect(() => {
        try { if (localStorage.getItem('orbita-sidebar-collapsed') === '1') setColapsado(true) } catch { /* sin localStorage: arranca expandida */ }
        const mq = window.matchMedia('(min-width: 769px)')
        const actualizar = () => setIsDesktop(mq.matches)
        actualizar()
        mq.addEventListener('change', actualizar)
        return () => mq.removeEventListener('change', actualizar)
    }, [])
    const colapsadoEfectivo = colapsado && isDesktop
    const toggleColapsado = () => {
        setColapsado(c => {
            const next = !c
            try { localStorage.setItem('orbita-sidebar-collapsed', next ? '1' : '0') } catch { /* no persiste, sigue andando en memoria */ }
            return next
        })
    }

    // Badge de "Mensajes": conteo real de conversaciones sin leer (RBT-657),
    // no un número fijo — mismo criterio que el comentario de arriba sobre
    // "Pedidos". Se sondea mientras el panel está montado (la Sidebar vive en
    // todo el layout, no solo en la pantalla de Mensajes).
    //
    // Mensajería es función solo de modo FULL (BusinessModeGuard tira 403
    // "SHOWCASE_MODE" para negocios en Vidriera) — si ese es el motivo del
    // fallo, cortamos el polling en vez de seguir insistiendo cada 15s para
    // siempre (el negocio no va a dejar de estar en SHOWCASE a mitad de sesión).
    // También corta en 401 (no solo 403): sin esto, una sesión que nunca
    // logra refrescar (o que ni siquiera es de dueño) insiste cada 15s para
    // siempre contra un endpoint que le va a seguir devolviendo error.
    // El gate por `user?.type === 'member'` es el fix real: este Sidebar solo
    // se monta dentro de AdminLayout (RequireAuth type="member"), pero antes
    // el efecto arrancaba en el mismo render sin esperar a que la sesión
    // terminara de resolverse — la primera pasada podía salir sin token.
    const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
    useEffect(() => {
        if (user?.type !== 'member') return
        let cancelado = false
        const cargar = () => getUnreadConversationsCount()
            .then(r => { if (!cancelado) setMensajesNoLeidos(r.count) })
            .catch(err => { if (err instanceof ApiError && (err.status === 403 || err.status === 401)) clearInterval(interval) })
        cargar()
        const interval = setInterval(cargar, 15000)
        // Mismo motivo que Bandeja.tsx/ChatPanel.tsx: el navegador throttlea
        // los timers en pestañas sin foco — sin esto, el badge quedaba
        // desactualizado hasta el próximo tick real al volver a la pestaña.
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

    // Navega al detalle de un resultado de búsqueda con su id real (los hubs de
    // pedidos y clientes leen vista=detalle + id de la query).
    const irDetalle = (sec: string, id: string) => {
        router.push({ pathname: adminPath(negocioId, 'ventas', sec), query: { vista: 'detalle', id } })
        onClose()
    }

    // Búsqueda real contra GET /search (mismo endpoint que el buscador del
    // header): pedidos, clientes y productos con sus ids de verdad. Antes
    // pedidos/clientes salían de mocks y el click navegaba a un detalle sin id.
    const [resultados, setResultados] = useState<ApiSearchResults | null>(null)
    useEffect(() => {
        const q = busqueda.trim()
        if (q.length < 2) { setResultados(null); return }
        let vigente = true
        const t = setTimeout(() => {
            panelSearch(q)
                .then(r => {
                    if (!vigente) return
                    // Los grupos siempre como arrays, venga lo que venga del
                    // backend — el panelcito los mapea directo.
                    setResultados({
                        query: r?.query ?? q,
                        pedidos: r?.pedidos ?? [], clientes: r?.clientes ?? [],
                        productos: r?.productos ?? [], descuentos: r?.descuentos ?? [],
                    })
                })
                .catch(() => { if (vigente) setResultados(null) })
        }, 350)
        return () => { vigente = false; clearTimeout(t) }
    }, [busqueda])

    const subActiva = (m: Modulo, s: Sub) => {
        if (seccion !== s.seccion) return false
        // "Postventa" agrupa tres vistas (devoluciones, notas de crédito y
        // cancelaciones): a efectos del resaltado, las otras dos cuentan
        // como devoluciones.
        const v = seccion === 'pedidos' && (vista === 'notas' || vista === 'cancelaciones') ? 'devoluciones' : (vista || '')
        if (s.vista) return v === s.vista
        const siblingsWithVista = (m.subs ?? []).filter(sub => sub.seccion === s.seccion && sub.vista)
        return !siblingsWithVista.some(sub => v === sub.vista)
    }

    return (
        <>
            <style>{`
                .admin-sidebar {
                    position: relative;
                    transform: none;
                    transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
                                box-shadow 280ms ease,
                                width 200ms ease;
                }
                .sidebar-collapse-toggle { display: flex; }
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
                    /* Colapsar es un concepto solo de desktop — en mobile el
                       drawer ya se abre/cierra entero, así que el botón ni
                       se ofrece ahí. */
                    .sidebar-collapse-toggle { display: none !important; }
                }
            `}</style>

            <aside
                className={`admin-sidebar flex flex-col ${colapsadoEfectivo ? 'w-16' : 'w-60'} shrink-0 h-full${isOpen ? ' sidebar-open' : ''}`}
                style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)' }}
            >
                {/* Logo */}
                {/* Misma altura que el header (h-16): la línea de abajo del logo
                    tiene que quedar EXACTAMENTE a la altura de la del header,
                    si no el borde se ve quebrado donde se encuentran. */}
                <div className="flex items-center gap-2.5 h-16 px-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)', justifyContent: colapsadoEfectivo ? 'center' : 'flex-start' }}>
                    <OrbitLogo />
                    {!colapsadoEfectivo && <span className="text-[14px] font-bold" style={{ color: 'var(--color-text)' }}>Orbita</span>}
                </div>

                {/* Selector de espacio — muestra el espacio actual del negocio
                    y ofrece crear otro (va al onboarding de rubro). Se oculta
                    colapsado: el dropdown necesita ancho para mostrar nombre +
                    descripción. Expandir para usarlo. */}
                {!colapsadoEfectivo && (
                <div style={{ margin: '10px 12px 4px', position: 'relative' }}>
                    <button
                        onClick={() => setRubroOpen(o => !o)}
                        style={{
                            width: '100%', height: 36, padding: '0 10px',
                            borderRadius: 8, cursor: 'pointer',
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
                            <button
                                onClick={() => { setRubroOpen(false); router.push('/onboarding/rubro') }}
                                style={{ width: 'calc(100% - 12px)', margin: '8px 6px 6px', padding: '9px 8px', display: 'flex', alignItems: 'center', gap: 9, borderRadius: 8, border: '1px dashed var(--color-border-strong)', background: 'transparent', cursor: 'pointer', transition: 'all 140ms', fontFamily: 'inherit' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-bg)'; e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border-strong)' }}
                            >
                                <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'var(--color-primary-bg)', display: 'grid', placeItems: 'center' }}>
                                    <Plus size={14} strokeWidth={2} color="var(--color-primary)" />
                                </div>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>Crear otro espacio</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-subtle)', lineHeight: 1.3 }}>Sumá otro rubro a tu cuenta</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
                )}


                {/* Buscador — mismo criterio que el rubro: sin ancho para
                    escribir ni mostrar resultados, se oculta colapsado. */}
                {!colapsadoEfectivo && (
                <div className="relative mx-3 mt-2 mb-1">
                    <Search size={13} strokeWidth={1.6} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-muted)' }} />
                    <input
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setBusqueda('') }}
                        placeholder="Buscar pedidos, clientes..."
                        className="w-full h-8 pl-7 pr-2.5 text-xs rounded-md outline-none"
                        style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    />
                    {resultados && (
                        <div className="absolute left-0 right-0 z-50 mt-1 p-1.5 rounded-lg overflow-y-auto" style={{ top: '100%', maxHeight: 340, background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: '0 12px 32px rgba(15,23,42,0.16)' }}>
                            {resultados.pedidos.length   > 0 && <><div style={resLabel}>PEDIDOS</div>  {resultados.pedidos.map(p   => <button key={p.id} onClick={() => { irDetalle('pedidos', p.id); setBusqueda('') }} style={resItem}>#{p.orderNumber} · {p.customerName ?? 'Sin cliente'} · {fmtMoney(p.total)}</button>)}</>}
                            {resultados.clientes.length  > 0 && <><div style={resLabel}>CLIENTES</div> {resultados.clientes.map(c  => <button key={c.id} onClick={() => { irDetalle('clientes', c.id); setBusqueda('') }} style={resItem}>{c.nombre}{c.email ? ` · ${c.email}` : ''}</button>)}</>}
                            {resultados.productos.length > 0 && <><div style={resLabel}>PRODUCTOS</div>{resultados.productos.map(p => <button key={p.id} onClick={() => { ir('catalogo'); setBusqueda('') }} style={resItem}>{p.name} · {fmtMoney(p.basePrice)}</button>)}</>}
                            {resultados.pedidos.length + resultados.clientes.length + resultados.productos.length === 0 && <div className="p-3 text-xs text-center" style={{ color: 'var(--color-muted)' }}>Sin resultados</div>}
                        </div>
                    )}
                </div>
                )}

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
                    {modulosVisibles.map(m => {
                        const activo = moduloActivo === m.id
                        const open   = abierto === m.id
                        // Sub-ítems filtrados por permiso: lo que el rol no puede usar
                        // no aparece (ej: "Nuevo +" sin orders.manage, "General" sin
                        // config.edit). Misma regla que los módulos.
                        const subs   = (m.subs ?? []).filter(s => !permisos || !s.permisos || s.permisos.some(p => permisos.includes(p)))
                        const badge  = m.id === 'mensajes' ? (mensajesNoLeidos || undefined) : m.badge
                        // El click del módulo aterriza en su primer sub VISIBLE: para
                        // un empleado, tocar "Configuración" va directo a Equipo (su
                        // único permiso) en vez de a General, que le daría "sin permiso".
                        const destino = subs[0] ?? { seccion: m.seccion, vista: undefined }
                        return (
                            <div key={m.id}>
                                <button
                                    onClick={() => { ir(destino.seccion, destino.vista); setAbierto(m.id) }}
                                    title={colapsadoEfectivo ? m.label : undefined}
                                    className={`flex items-center h-9 rounded-md cursor-pointer text-[12.5px]${colapsadoEfectivo ? ' w-9 mx-auto justify-center px-0' : ' gap-2.5 w-full px-2.5'}`}
                                    style={{ border: 'none', background: activo ? 'var(--color-primary-bg)' : 'transparent', color: activo ? 'var(--color-primary)' : 'var(--color-body)', fontWeight: activo ? 600 : 500, position: 'relative' }}
                                    onMouseEnter={e => { if (!activo) e.currentTarget.style.background = 'var(--color-surface-alt)' }}
                                    onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent' }}
                                >
                                    <m.Icon size={16} strokeWidth={1.6} />
                                    {!colapsadoEfectivo && <span className="flex-1 text-left">{m.label}</span>}
                                    {!colapsadoEfectivo && m.alert && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-error)' }} />}
                                    {!colapsadoEfectivo && badge && <span className="grid place-items-center text-[10px] font-bold" style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, fontFamily: '"Geist Mono", monospace', background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: activo ? 'var(--color-on-primary)' : 'var(--color-muted)' }}>{badge}</span>}
                                    {/* Colapsado: el badge/alert se compactan en un puntito arriba a la
                                        derecha del ícono — sin esto, "Mensajes" con no leídos perdía toda
                                        señal visual al colapsar. */}
                                    {colapsadoEfectivo && (m.alert || badge) && (
                                        <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: 'var(--color-error)' }} />
                                    )}
                                </button>

                                {open && subs.length > 0 && !colapsadoEfectivo && (
                                    <div className="flex flex-col gap-px mt-0.5" style={{ paddingLeft: 20 }}>
                                        {subs.map(s => {
                                            const sa = subActiva(m, s)
                                            return (
                                                <button
                                                    key={s.label}
                                                    onClick={() => ir(s.seccion, s.vista)}
                                                    className="h-[28px] px-2 rounded-md text-left cursor-pointer text-[11.5px]"
                                                    style={{ border: 'none', fontWeight: sa ? 600 : 500, color: sa ? 'var(--color-primary)' : 'var(--color-muted)', background: sa ? 'var(--color-primary-bg)' : 'transparent' }}
                                                    onMouseEnter={e => { if (!sa) e.currentTarget.style.color = 'var(--color-body)' }}
                                                    onMouseLeave={e => { if (!sa) e.currentTarget.style.color = 'var(--color-muted)' }}
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

                {/* Colapsar/expandir — solo desktop (ver media query arriba).
                    Siempre visible, en los dos estados, para poder volver. */}
                <div className="sidebar-collapse-toggle shrink-0" style={{ borderTop: '1px solid var(--color-border)', padding: 8 }}>
                    <button
                        onClick={toggleColapsado}
                        title={colapsadoEfectivo ? 'Expandir menú' : 'Colapsar menú'}
                        className={`flex items-center h-9 rounded-md cursor-pointer text-[12.5px]${colapsadoEfectivo ? ' w-9 mx-auto justify-center px-0' : ' gap-2.5 w-full px-2.5'}`}
                        style={{ border: 'none', background: 'transparent', color: 'var(--color-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-alt)'; e.currentTarget.style.color = 'var(--color-body)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-muted)' }}
                    >
                        {colapsadoEfectivo ? <PanelLeftOpen size={16} strokeWidth={1.6} /> : <PanelLeftClose size={16} strokeWidth={1.6} />}
                        {!colapsadoEfectivo && <span className="flex-1 text-left">Colapsar menú</span>}
                    </button>
                </div>
            </aside>
        </>
    )
}

// El logo orbital de verdad (el de la pantalla de carga), compartido en el
// design system — chau el cuadradito azul que no se parecía a la marca.
function OrbitLogo() {
    return <OrbitaLogo size={26} />
}

const resLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 8px 4px' }
const resItem:  React.CSSProperties = { width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--color-body)' }
