// Sidebar del panel admin — diseño del prototipo "Panel Admin 34":
// logo orbital, selector de espacio, buscador con resultados en vivo y
// módulos expandibles con badges, dots de alerta y sub-secciones.
//
// Toda la navegación entre pantallas vive acá, incluidas las de Configuración
// (antes tenían un menú propio adentro de la pantalla). Lo que queda adentro
// de una pantalla es solo su índice de secciones, si lo tiene (ver
// configuracion/components/IndiceDeVista.tsx).
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
import { LayoutDashboard, ShoppingBag, Users, Package, MessageSquare, Tag, Settings, BookOpen, Sparkles, Maximize2, Minimize2, MousePointer } from 'lucide-react'
import type { ComponentType } from 'react'

import { getUnreadConversationsCount, ApiError } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'
import { OrbiTrigger } from '@/components/orbi/OrbiTrigger'
import { moduloDeSeccion } from './moduloActivo'
import { PERMISOS_MODULO } from './permisosDelMenu'
import { adminPath, currentSlug } from '@/lib/tenant'
import { useSidebarMode, type SidebarMode } from '@/layouts/SidebarModeContext'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
// `permisos`: con tener ALGUNO de la lista el ítem se muestra; sin lista se
// muestra siempre (dentro de un módulo ya filtrado). La regla de todo el
// menú: nada visible que el rol no pueda usar.
// `separador`: abre un grupo nuevo (una línea fina antes del ítem). `peligro`:
// se pinta en rojo cuando está activo (Zona peligrosa).
interface Sub { label: string; seccion: string; vista?: string; permisos?: string[]; separador?: boolean; peligro?: boolean }
interface Modulo { id: string; label: string; Icon: IconType; seccion: string; badge?: number; alert?: boolean; subs?: Sub[] }

const MODULOS: Modulo[] = [
    { id: 'dashboard', label: 'Inicio', Icon: LayoutDashboard, seccion: 'dashboard' },
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
        // Cada sub es una pantalla de Configuración (`?vista=`, ver
        // VISTAS_DE_CONFIGURACION en panel/secciones.ts). "Negocio" no lleva
        // vista: es la pantalla por defecto, y adonde lleva tocar el módulo.
        id: 'config', label: 'Configuración', Icon: Settings, seccion: 'configuracion',
        subs: [
            { label: 'Suscripción', seccion: 'configuracion', vista: 'suscripcion', permisos: ['config.edit'] },
            { label: 'Negocio', seccion: 'configuracion', permisos: ['config.edit'], separador: true },
            { label: 'Contacto', seccion: 'configuracion', vista: 'contacto', permisos: ['config.edit'] },
            { label: 'Pagos', seccion: 'configuracion', vista: 'pagos', permisos: ['config.edit'] },
            { label: 'Envíos', seccion: 'configuracion', vista: 'envios', permisos: ['config.edit'] },
            { label: 'Redes sociales', seccion: 'configuracion', vista: 'redes', permisos: ['config.edit'] },
            { label: 'Dominios', seccion: 'configuracion', vista: 'dominios', permisos: ['config.domains.manage'] },
            { label: 'Cancelaciones y devoluciones', seccion: 'configuracion', vista: 'postventa', permisos: ['config.edit'] },
            { label: 'Apariencia', seccion: 'configuracion', vista: 'apariencia', permisos: ['config.edit'], separador: true },
            { label: 'Equipo', seccion: 'configuracion', vista: 'equipo', permisos: ['config.team.view', 'config.team.manage'] },
            { label: 'Notificaciones', seccion: 'configuracion', vista: 'notificaciones', permisos: ['config.edit'] },
            { label: 'Registro de actividad', seccion: 'configuracion', vista: 'actividad', permisos: ['config.audit.view'] },
            { label: 'Soporte', seccion: 'configuracion', vista: 'soporte', separador: true },
            { label: 'Zona peligrosa', seccion: 'configuracion', vista: 'peligro', permisos: ['config.edit'], separador: true, peligro: true },
        ],
    },
    {
        id: 'avanzado', label: 'Avanzado', Icon: Sparkles, seccion: 'avanzado',
    },
    {
        id: 'manual', label: 'Manual', Icon: BookOpen, seccion: 'manual',
    },
]

const ROLES_MODULO: Record<string, string[]> = {}

// PERMISOS_MODULO vive en permisosDelMenu.ts: también lo lee el manual de Orbi.

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

    const moduloActivo = moduloDeSeccion(seccion, vista)

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

    const ir = (sec: string, v?: string) => {
        router.push({ pathname: adminPath(negocioId, 'ventas', sec), query: v ? { vista: v } : undefined })
        onClose()
    }

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

    // Menú colapsado fijo: las sub-secciones no entran en el riel de íconos, así
    // que salen en un panel flotante al lado del ícono (con el mouse o con el
    // foco del teclado). En modo "al pasar el mouse" no hace falta: el menú
    // entero se expande y las muestra en su lugar.
    const [flotante, setFlotante] = useState<{ id: string; top: number } | null>(null)
    const flotanteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => () => { if (flotanteTimer.current) clearTimeout(flotanteTimer.current) }, [])
    const usaFlotante = isDesktop && mode === 'collapsed'
    const abrirFlotante = (id: string, el: HTMLElement) => {
        if (flotanteTimer.current) clearTimeout(flotanteTimer.current)
        setFlotante({ id, top: el.getBoundingClientRect().top })
    }
    const cerrarFlotante = () => {
        if (flotanteTimer.current) clearTimeout(flotanteTimer.current)
        flotanteTimer.current = setTimeout(() => setFlotante(null), 200)
    }
    const mantenerFlotante = () => { if (flotanteTimer.current) clearTimeout(flotanteTimer.current) }

    // La lista de sub-secciones de un módulo: la misma en el menú expandido y
    // en el panel flotante del menú colapsado.
    const listaDeSubs = (m: Modulo, subs: Sub[]) => subs.map((s, i) => {
        const sa = subActiva(m, s)
        const color = s.peligro && sa ? 'var(--color-error)' : sa ? 'var(--color-primary)' : 'var(--color-muted)'
        return (
            <div key={s.label} className="flex flex-col">
                {s.separador && i > 0 && <div aria-hidden="true" style={{ height: 1, margin: '5px 8px', background: 'var(--color-border)' }} />}
                <button
                    onClick={() => { ir(s.seccion, s.vista); setFlotante(null) }}
                    aria-current={sa ? 'page' : undefined}
                    className="ds-hover min-h-[30px] px-2 py-1.5 rounded-md text-left text-xs"
                    style={{ border: 'none', lineHeight: 1.3, fontWeight: sa ? 600 : 500, color, background: sa ? (s.peligro ? 'var(--color-error-bg)' : 'var(--color-primary-bg)') : 'transparent' }}
                >
                    {s.label}
                </button>
            </div>
        )
    })

    // Ancho actual del sidebar
    const anchoActual = esAngosto ? W_NARROW : W_WIDE
    // En modo hover, el sidebar es position:fixed y el spacer ocupa lugar en flex
    const esHoverDesktop = mode === 'hover' && isDesktop

    // Posición del popover del selector de modo: cuando el sidebar está
    // colapsado, el popover se posiciona con fixed para escapar el
    // overflow:hidden del aside.
    const selectorRect = selectorAbierto && esAngosto && selectorRef.current
        ? selectorRef.current.getBoundingClientRect() : null

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

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-3 flex flex-col gap-0.5">
                {modulosVisibles.map(m => {
                    const activo = moduloActivo === m.id
                    const open   = abierto === m.id
                    const subs   = (m.subs ?? []).filter(s => !permisos || !s.permisos || s.permisos.some(p => permisos.includes(p)))
                    const badge  = m.id === 'mensajes' ? (mensajesNoLeidos || undefined) : m.badge
                    // Tocar el módulo lleva a su pantalla por defecto (la sub sin
                    // `vista`); si el rol no la ve, a la primera que sí.
                    const destino = subs.find(s => s.seccion === m.seccion && !s.vista) ?? subs[0] ?? { seccion: m.seccion, vista: undefined }
                    const conFlotante = usaFlotante && subs.length > 0
                    return (
                        <div key={m.id} onMouseLeave={conFlotante ? cerrarFlotante : undefined}>
                            <button
                                onClick={() => { ir(destino.seccion, destino.vista); setAbierto(m.id) }}
                                onMouseEnter={conFlotante ? e => abrirFlotante(m.id, e.currentTarget) : undefined}
                                onFocus={conFlotante ? e => abrirFlotante(m.id, e.currentTarget) : undefined}
                                onBlur={conFlotante ? cerrarFlotante : undefined}
                                aria-expanded={conFlotante ? flotante?.id === m.id : undefined}
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
                                    {listaDeSubs(m, subs)}
                                </div>
                            )}

                            {conFlotante && flotante?.id === m.id && (
                                <div
                                    role="group"
                                    aria-label={`Secciones de ${m.label}`}
                                    onMouseEnter={mantenerFlotante}
                                    onFocus={mantenerFlotante}
                                    onBlur={cerrarFlotante}
                                    className="flex flex-col gap-px"
                                    style={{
                                        // `fixed` para escapar el overflow:hidden del aside
                                        // (mismo recurso que el selector de modo de abajo).
                                        // Si no entra hacia abajo, sube hasta que entre.
                                        position: 'fixed', left: W_NARROW - 4, zIndex: 80,
                                        top: Math.max(8, Math.min(flotante.top, window.innerHeight - 8 - (44 + subs.length * 36))),
                                        maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
                                        width: 220, padding: 6, borderRadius: 10,
                                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                        boxShadow: '0 10px 30px rgba(15,23,42,0.16)',
                                    }}
                                >
                                    <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {m.label}
                                    </div>
                                    {listaDeSubs(m, subs)}
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
                        position: selectorRect ? 'fixed' : 'absolute',
                        ...(selectorRect
                            ? { left: selectorRect.right + 4, bottom: window.innerHeight - selectorRect.bottom }
                            : { bottom: 'calc(100% + 4px)', left: 8 }),
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

