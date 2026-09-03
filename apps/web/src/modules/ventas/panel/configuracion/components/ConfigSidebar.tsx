// Menú guía de Configuración — reemplaza el modelo anterior (una sola
// pantalla "General" con 6 tarjetas apiladas de a dos columnas + 3 pantallas
// sueltas para Apariencia/Equipo/Notificaciones, elegidas desde el sidebar
// PRINCIPAL del panel). Ahora cada sección es una raíz propia acá, en un
// menú dedicado — el sidebar principal se colapsa a la franja de íconos
// apenas se entra a Configuración (ver Sidebar.tsx) para hacerle lugar a
// este, mismo patrón que un módulo de configuración típico (paneles de
// administración de flotas, IDEs, etc. — la referencia que pasó el usuario).

import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
    Building2, Phone, Wallet, Truck, Share2, RotateCcw, Palette, Users, Bell, AlertTriangle,
    PanelLeftClose, PanelLeftOpen, Crown, Globe, LifeBuoy,
    Droplets, Type, LayoutGrid, Eye, AlignLeft, Hash, PanelBottom,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { VistaConfig } from './ConfigTabs'

const COLLAPSE_KEY = 'orbita-config-sidebar-collapsed'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>
interface Item { vista: VistaConfig; label: string; Icon: IconType; permisos?: string[]; peligro?: boolean }
interface Grupo { label?: string; items: Item[] }

const GRUPOS: Grupo[] = [
    {
        // Suscripción sola arriba de todo — es el estado de la cuenta en sí
        // (plan + upsell del paquete Avanzado), no una configuración del
        // negocio como el resto de los grupos de abajo.
        items: [
            { vista: 'suscripcion', label: 'Suscripción', Icon: Crown, permisos: ['config.edit'] },
        ],
    },
    {
        items: [
            { vista: 'negocio',  label: 'Negocio',  Icon: Building2, permisos: ['config.edit'] },
            { vista: 'contacto', label: 'Contacto', Icon: Phone,     permisos: ['config.edit'] },
            { vista: 'pagos',    label: 'Pagos',    Icon: Wallet,    permisos: ['config.edit'] },
            { vista: 'envios',   label: 'Envíos',   Icon: Truck,     permisos: ['config.edit'] },
            { vista: 'redes',    label: 'Redes sociales', Icon: Share2, permisos: ['config.edit'] },
            { vista: 'dominios', label: 'Dominios', Icon: Globe, permisos: ['config.domains.manage'] },
            { vista: 'postventa', label: 'Cancelaciones y devoluciones', Icon: RotateCcw, permisos: ['config.edit'] },
        ],
    },
    {
        label: 'Avanzado',
        items: [
            { vista: 'apariencia',     label: 'Apariencia',     Icon: Palette, permisos: ['config.edit'] },
            { vista: 'equipo',         label: 'Equipo',         Icon: Users,   permisos: ['config.team.view', 'config.team.manage'] },
            { vista: 'notificaciones', label: 'Notificaciones', Icon: Bell,    permisos: ['config.edit'] },
        ],
    },
    {
        // Sin `permisos` a propósito — cualquiera con sesión de panel puede
        // pedir ayuda, no es una acción sensible como el resto (mismo
        // criterio que support.controller.ts del lado del backend: sin
        // @RequirePermission).
        items: [
            { vista: 'soporte', label: 'Soporte', Icon: LifeBuoy },
        ],
    },
    {
        items: [
            { vista: 'peligro', label: 'Zona peligrosa', Icon: AlertTriangle, permisos: ['config.edit'], peligro: true },
        ],
    },
]

// Índice de secciones DENTRO de Apariencia (pedido explícito del dueño:
// "que en el sidebar que ya está" — no una vista nueva, ni un submenú que
// navega, solo un ancla que scrollea). Cada `id` tiene que ser EXACTAMENTE
// el `id` que esa SecCard tiene en Apariencia.tsx — es la misma coordinación
// implícita que ya existe entre este archivo y ConfigTabs.tsx (ambos hablan
// de la misma `VistaConfig`), documentada acá para que quien agregue o saque
// una sección en Apariencia se acuerde de actualizar esta lista también.
//
// No incluye "Header" ni "Cupón": esas dos son EXCLUSIVAS del editor de una
// plantilla activa (Avanzado → Plantillas), una pantalla aparte que no pasa
// por este sidebar — acá solo van las secciones de la Apariencia clásica.
//
// Si hay una plantilla de Home activa, Apariencia clásica muestra el cartel
// de "bloqueada" en vez de estas tarjetas — clickear un ítem de acá en ese
// estado no hace nada (el `id` no existe en el DOM), no rompe nada.
const SECCIONES_APARIENCIA: { id: string; label: string; Icon: IconType }[] = [
    { id: 'ap-sec-identidad',     label: 'Identidad de marca',       Icon: Palette },
    { id: 'ap-sec-paleta',        label: 'Paleta de colores',        Icon: Droplets },
    { id: 'ap-sec-tipografia',    label: 'Tipografía',               Icon: Type },
    { id: 'ap-sec-layout',        label: 'Diseño y layout',          Icon: LayoutGrid },
    { id: 'ap-sec-visibilidad',   label: '¿Qué ven tus clientes?',   Icon: Eye },
    { id: 'ap-sec-textos',        label: 'Textos de tu tienda',      Icon: AlignLeft },
    { id: 'ap-sec-estadisticas',  label: 'Barra de estadísticas',    Icon: Hash },
    { id: 'ap-sec-pie',           label: 'Pie de página',            Icon: PanelBottom },
]

export function ConfigSidebar({ activa, onNavigate }: { activa: VistaConfig; onNavigate: (v: VistaConfig) => void }) {
    const { user } = useAuth()
    // Índice de Apariencia — primero se probó como una franja fija de íconos
    // arriba de los módulos (SECCIONES_APARIENCIA rendida siempre que
    // activa==='apariencia'). No gustó: 8 anclas nuevas mezcladas con los
    // módulos de siempre, sin separación real más que una línea. Ahora es un
    // desplegable que aparece con el mouse sobre el ícono de Apariencia y se
    // cierra solo al sacarlo — usa el hueco que ya existe entre el riel
    // colapsado y el contenido de Apariencia a la derecha, en vez de sumar
    // altura permanente al sidebar.
    const [indiceAbierto, setIndiceAbierto] = useState(false)
    // Posición del desplegable, calculada desde el ícono en cada hover. Hace
    // falta porque el desplegable se saca del sidebar con un portal (ver
    // abajo) — sin esto no tiene de dónde ubicarse.
    const [indicePos, setIndicePos] = useState<{ top: number; left: number } | null>(null)
    const apRef = useRef<HTMLDivElement>(null)
    // Timer de cierre con demora: el ícono y el desplegable son DOS nodos DOM
    // separados por un portal (ver más abajo por qué), así que moverse de
    // uno a otro pasa por un instante SIN mouse encima de ninguno — sin este
    // margen el desplegable se cierra a mitad de camino antes de llegar.
    const cerrarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    function abrirIndice() {
        if (cerrarTimer.current) { clearTimeout(cerrarTimer.current); cerrarTimer.current = null }
        const r = apRef.current?.getBoundingClientRect()
        if (r) setIndicePos({ top: r.top, left: r.right + 10 })
        setIndiceAbierto(true)
    }
    function cerrarIndiceConDemora() {
        cerrarTimer.current = setTimeout(() => setIndiceAbierto(false), 150)
    }
    useEffect(() => () => { if (cerrarTimer.current) clearTimeout(cerrarTimer.current) }, [])
    // Mismo criterio que el sidebar principal (Sidebar.tsx): el dueño ve todo
    // siempre (permisos = null = sin filtro); un empleado solo ve lo que su
    // rol puede tocar.
    const permisos = user?.type === 'member' && user.role !== 'owner' ? user.permissions : null
    const puedeVer = (item: Item) => !permisos || !item.permisos || item.permisos.some(p => permisos.includes(p))

    // Colapsable — Apariencia en particular necesita todo el ancho posible
    // (editor + vista previa lado a lado). Arranca expandido en el primer
    // render (server Y cliente) a propósito, mismo criterio que el sidebar
    // principal: evita un mismatch de hidratación, el valor guardado se lee
    // recién después de montar.
    const [colapsado, setColapsado] = useState(false)
    // En mobile la tira ya pasa a ser horizontal por su cuenta (ver el
    // <style> más abajo) — el colapsado "a íconos" es un concepto de
    // escritorio nomás. Mismo patrón que el sidebar principal (Sidebar.tsx,
    // colapsadoEfectivo): sin esto, un usuario que colapsó en escritorio y
    // después abre el panel en el celular se quedaba sin las etiquetas en la
    // tira horizontal, donde sí entran cómodas.
    const [isDesktop, setIsDesktop] = useState(true)
    useEffect(() => {
        try { if (localStorage.getItem(COLLAPSE_KEY) === '1') setColapsado(true) } catch { /* sin localStorage: arranca expandido */ }
        const mq = window.matchMedia('(min-width: 769px)')
        const actualizar = () => setIsDesktop(mq.matches)
        actualizar()
        mq.addEventListener('change', actualizar)
        return () => mq.removeEventListener('change', actualizar)
    }, [])
    // Auto-colapso de CONTEXTO al entrar a Apariencia — es la sección que de
    // verdad necesita el ancho (editor + vista previa lado a lado), así que
    // se colapsa sola apenas se entra ahí, sin que el usuario tenga que
    // acordarse de tocar el botón. Mismo criterio que el sidebar principal
    // colapsándose solo al entrar a Configuración (Sidebar.tsx): no se
    // persiste — es de esta sección puntual, no una preferencia general —
    // así que al salir de Apariencia vuelve solo a como estaba. El botón
    // manual se OR-ea encima por si alguien lo quiere colapsado en otra
    // sección también.
    const colapsadoEfectivo = (colapsado || activa === 'apariencia') && isDesktop
    // Celular: la tira es horizontal y con 13 ítems no entran todos — el
    // activo se centra solo al entrar y al navegar, así siempre se ve dónde
    // se está y qué hay a los costados. scrollTo del nav y no scrollIntoView:
    // este último también movería verticalmente la página.
    const navRef = useRef<HTMLElement>(null)
    useEffect(() => {
        if (isDesktop) return
        const nav = navRef.current
        const el = nav?.querySelector<HTMLElement>('.cfg-sidebar-item[data-activa="true"]')
        if (!nav || !el) return
        nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    }, [activa, isDesktop])
    // Indicador de scroll finito debajo de la tira (pedido de Ale): que se
    // note que hay más chips a la derecha. Es custom porque en celular el
    // scrollbar nativo no se ve. Se pinta directo sobre el DOM en cada
    // scroll (sin estado: sería un render por píxel).
    const hintRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (isDesktop) return
        const nav = navRef.current
        const hint = hintRef.current
        const thumb = hint?.firstElementChild?.firstElementChild as HTMLElement | null
        if (!nav || !hint || !thumb) return
        const pintar = () => {
            const total = nav.scrollWidth, visible = nav.clientWidth
            if (total <= visible + 1) { hint.style.visibility = 'hidden'; return }
            hint.style.visibility = 'visible'
            const pista = hint.clientWidth - 24 // padding lateral de 12px
            const ancho = Math.max(28, (visible / total) * pista)
            const x = (nav.scrollLeft / (total - visible)) * (pista - ancho)
            thumb.style.width = `${ancho}px`
            thumb.style.transform = `translateX(${x}px)`
        }
        pintar()
        nav.addEventListener('scroll', pintar, { passive: true })
        window.addEventListener('resize', pintar)
        return () => {
            nav.removeEventListener('scroll', pintar)
            window.removeEventListener('resize', pintar)
        }
    }, [isDesktop, activa])
    function toggleColapsado() {
        setColapsado(c => {
            const next = !c
            try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* no persiste, sigue andando en memoria */ }
            return next
        })
    }

    return (
        <>
        <nav
            ref={navRef}
            className="cfg-sidebar"
            style={{
                width: colapsadoEfectivo ? 52 : 216, flexShrink: 0, padding: colapsadoEfectivo ? '20px 8px' : '20px 12px',
                borderRadius: 12, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                display: 'flex', flexDirection: 'column', gap: 20,
                boxSizing: 'border-box', transition: 'width 180ms ease, padding 180ms ease',
                // "Flotante": nada de línea divisoria fija contra el contenido —
                // una card con su propio borde entero, sticky + scroll propio,
                // mismo criterio que el filtro del catálogo del storefront
                // (Catalogo.tsx, .sf-cat-sidebar) — sigue el scroll de la
                // página en vez de quedar cortada a la altura de la ventana.
                position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', overflowX: 'hidden',
            }}
        >
            {/* Mobile (<=768px, mismo corte que el resto del panel): la card
                vertical no entra en un celular — pasa a ser una tira de chips
                a todo el ancho, pegada arriba (sticky) mientras se scrollea la
                sección. Sin card ni scrollbar (el scroll es táctil, con snap),
                cada chip en una sola línea, el activo lleno de color y centrado
                solo (ver el effect de navRef). Los títulos de grupo y
                separadores no entran en una fila y se sacan. Sale a sangre con
                márgenes negativos contra el padding de 12px de .cfg-hub-layout. */}
            <style>{`
                @media (max-width: 768px) {
                    .cfg-sidebar {
                        position: sticky !important; top: 0 !important; z-index: 20 !important;
                        width: calc(100% + 24px) !important; margin: -12px -12px 0 !important;
                        max-height: none !important; flex-direction: row !important;
                        align-items: center !important; overflow-x: auto !important;
                        overflow-y: hidden !important; gap: 8px !important;
                        padding: 10px 12px 8px !important; border-radius: 0 !important;
                        border: none !important;
                        box-shadow: none !important; background: var(--color-surface) !important;
                        scrollbar-width: none; -webkit-overflow-scrolling: touch;
                        scroll-snap-type: x proximity; scroll-padding: 0 12px;
                    }
                    .cfg-sidebar::-webkit-scrollbar { display: none; }
                    /* Indicador de scroll: pegado justo debajo de la tira (misma
                       sticky, top = alto de la tira), a sangre como ella. */
                    .cfg-scroll-hint {
                        display: block !important; position: sticky; top: 56px; z-index: 20;
                        width: calc(100% + 24px); margin: -12px -12px 0; padding: 0 12px 6px;
                        box-sizing: border-box; background: var(--color-surface);
                        border-bottom: 1px solid var(--color-border);
                    }
                    .cfg-scroll-hint > div { height: 3px; border-radius: 2px; background: var(--color-surface-alt); overflow: hidden; }
                    .cfg-scroll-hint > div > div { height: 100%; border-radius: 2px; background: var(--color-primary); opacity: 0.75; transition: transform 40ms linear; }
                    .cfg-sidebar-header, .cfg-sidebar-group-label, .cfg-sidebar-divider { display: none !important; }
                    .cfg-sidebar-group { flex-direction: row !important; flex-shrink: 0 !important; gap: 8px !important; }
                    .cfg-sidebar-item {
                        flex-shrink: 0 !important; width: auto !important; min-height: 38px !important;
                        padding: 0 14px !important; border-radius: 999px !important;
                        white-space: nowrap !important; align-items: center !important; line-height: 1 !important;
                        border: 1px solid var(--color-border) !important; background: var(--color-bg) !important;
                        color: var(--color-body) !important; font-weight: 500 !important;
                        scroll-snap-align: start;
                    }
                    .cfg-sidebar-item svg { margin-top: 0 !important; }
                    .cfg-sidebar-item[data-activa="true"] {
                        background: var(--color-primary) !important; border-color: var(--color-primary) !important;
                        color: var(--color-on-primary) !important; font-weight: 600 !important;
                    }
                    .cfg-sidebar-item[data-peligro="true"] { color: var(--color-error) !important; }
                    .cfg-sidebar-item[data-peligro="true"][data-activa="true"] {
                        background: var(--color-error) !important; border-color: var(--color-error) !important;
                        color: var(--color-on-primary) !important;
                    }
                }
            `}</style>
            {!colapsadoEfectivo && (
                <div className="cfg-sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 0 8px' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>Configuración</span>
                    <button
                        onClick={toggleColapsado} title="Colapsar menú" aria-label="Colapsar menú"
                        className="ds-hover"
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'none', border: 'none', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                    >
                        <PanelLeftClose size={15} strokeWidth={1.7} />
                    </button>
                </div>
            )}
            {colapsadoEfectivo && (
                <button
                    className="cfg-sidebar-header ds-hover"
                    onClick={toggleColapsado} title="Expandir menú" aria-label="Expandir menú"
                    style={{ width: 36, height: 36, margin: '0 auto', borderRadius: 8, background: 'none', border: 'none', color: 'var(--color-muted)', display: 'grid', placeItems: 'center' }}
                >
                    <PanelLeftOpen size={16} strokeWidth={1.7} />
                </button>
            )}

            {GRUPOS.map((g, gi) => {
                const visibles = g.items.filter(puedeVer)
                if (visibles.length === 0) return null
                return (
                    <div key={gi} className="cfg-sidebar-group" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {g.label && !colapsadoEfectivo && (
                            <div className="cfg-sidebar-group-label" style={{ padding: '0 8px 6px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)' }}>
                                {g.label}
                            </div>
                        )}
                        {g.label && colapsadoEfectivo && <div className="cfg-sidebar-divider" style={{ height: 1, background: 'var(--color-border)', margin: '2px 4px 6px' }} />}
                        {visibles.map(item => {
                            const act = activa === item.vista
                            const color = item.peligro
                                ? (act ? 'var(--color-error)' : 'var(--color-muted)')
                                : (act ? 'var(--color-primary)' : 'var(--color-body)')
                            const boton = (
                                <button
                                    className="cfg-sidebar-item ds-hover"
                                    data-activa={act || undefined}
                                    data-peligro={item.peligro || undefined}
                                    onClick={() => onNavigate(item.vista)}
                                    title={item.label}
                                    style={{
                                        display: 'flex', gap: 10,
                                        minHeight: 36, borderRadius: 8,
                                        border: 'none', cursor: 'pointer', textAlign: 'left',
                                        fontSize: 13, fontWeight: act ? 600 : 500, color,
                                        background: act
                                            ? (item.peligro ? 'var(--color-error-bg)' : 'var(--color-primary-bg)')
                                            : 'transparent',
                                        transition: 'background 120ms, color 120ms',
                                        // Labels largos ("Cancelaciones y devoluciones") no entran en una
                                        // línea a este ancho — pasan a 2 líneas en vez de desbordar el
                                        // contenedor (antes `nowrap` + `height` fijo los cortaba a lo bruto).
                                        ...(colapsadoEfectivo
                                            ? { width: 36, height: 36, padding: 0, justifyContent: 'center', alignItems: 'center' } as const
                                            : { width: '100%', padding: '8px 10px', whiteSpace: 'normal', lineHeight: 1.3, alignItems: 'flex-start' } as const),
                                    }}
                                >
                                    <item.Icon size={15} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: colapsadoEfectivo ? 0 : 1 }} />
                                    {!colapsadoEfectivo && item.label}
                                </button>
                            )

                            // El índice de secciones de Apariencia SOLO tiene
                            // sentido acá: colapsado (con expandido, el label
                            // ya alcanza para navegar) y ya estando en esa
                            // pantalla (ahí es donde existe el hueco a la
                            // derecha del riel que el desplegable ocupa). El
                            // wrapper cubre ícono + desplegable con el MISMO
                            // par de handlers — sin eso, el hueco entre los
                            // dos se lee como "el mouse se fue" y se cierra
                            // antes de poder tocar un ítem.
                            if (item.vista === 'apariencia' && act && colapsadoEfectivo) {
                                return (
                                    <div
                                        key={item.vista}
                                        ref={apRef}
                                        style={{ position: 'relative' }}
                                        onMouseEnter={abrirIndice}
                                        onMouseLeave={cerrarIndiceConDemora}
                                    >
                                        {boton}
                                        {/* Portal a document.body: el sidebar colapsado
                                            (`.cfg-sidebar`, más arriba) tiene
                                            `overflow-x: hidden` para no mostrar
                                            scrollbar horizontal en la tira de íconos —
                                            eso mismo recortaba este desplegable, que
                                            necesita salir por afuera del sidebar hacia
                                            la derecha. Posicionado en coords de
                                            viewport (`position: fixed`) calculadas en
                                            `abrirIndice`, no relativas al sidebar. */}
                                        {indiceAbierto && indicePos && typeof document !== 'undefined' && createPortal(
                                            <div
                                                onMouseEnter={abrirIndice}
                                                onMouseLeave={cerrarIndiceConDemora}
                                                style={{
                                                    position: 'fixed', top: indicePos.top, left: indicePos.left, zIndex: 40,
                                                    width: 208, padding: 6, borderRadius: 10,
                                                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                                    boxShadow: '0 10px 30px rgba(15,23,42,0.16)',
                                                }}
                                            >
                                                {SECCIONES_APARIENCIA.map(sec => (
                                                    <button
                                                        key={sec.id}
                                                        className="ds-hover"
                                                        // CON `behavior: 'smooth'` a propósito acá — el
                                                        // que scrollea de verdad no es `html` (que sí
                                                        // tiene scroll-behavior:smooth por CSS global,
                                                        // ver globals.css) sino `.admin-main`
                                                        // (overflow-auto propio, ver AdminLayout.tsx),
                                                        // que NO lo tiene declarado por CSS. Sin pasarlo
                                                        // acá el salto era instantáneo. Mismo patrón que
                                                        // ya usa el tutorial Checklist para este mismo
                                                        // contenedor (tutoriales/anclas.ts).
                                                        onClick={() => {
                                                            document.getElementById(sec.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                                                            setIndiceAbierto(false)
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                                                            padding: '8px 10px', borderRadius: 7, border: 'none',
                                                            background: 'transparent', color: 'var(--color-body)',
                                                            fontSize: 12.5, fontWeight: 500, textAlign: 'left',
                                                            cursor: 'pointer', fontFamily: 'inherit',
                                                        }}
                                                    >
                                                        <sec.Icon size={14} strokeWidth={1.7} style={{ flexShrink: 0 }} />
                                                        {sec.label}
                                                    </button>
                                                ))}
                                            </div>,
                                            document.body,
                                        )}
                                    </div>
                                )
                            }

                            return <div key={item.vista}>{boton}</div>
                        })}
                    </div>
                )
            })}
        </nav>
        {/* Solo celular (display por CSS): pista + pulgar del scroll horizontal. */}
        <div ref={hintRef} className="cfg-scroll-hint" aria-hidden style={{ display: 'none' }}>
            <div><div /></div>
        </div>
        </>
    )
}
