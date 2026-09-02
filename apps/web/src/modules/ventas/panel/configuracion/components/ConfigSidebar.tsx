// Menú guía de Configuración — reemplaza el modelo anterior (una sola
// pantalla "General" con 6 tarjetas apiladas de a dos columnas + 3 pantallas
// sueltas para Apariencia/Equipo/Notificaciones, elegidas desde el sidebar
// PRINCIPAL del panel). Ahora cada sección es una raíz propia acá, en un
// menú dedicado — el sidebar principal se colapsa a la franja de íconos
// apenas se entra a Configuración (ver Sidebar.tsx) para hacerle lugar a
// este, mismo patrón que un módulo de configuración típico (paneles de
// administración de flotas, IDEs, etc. — la referencia que pasó el usuario).

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
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
    function toggleColapsado() {
        setColapsado(c => {
            const next = !c
            try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* no persiste, sigue andando en memoria */ }
            return next
        })
    }

    return (
        <nav
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
                vertical no entra en un celular — pasa a ser una franja
                horizontal con scroll propio, sin agrupar por sección (los
                títulos "Avanzado"/separadores no entran en una fila), mismo
                criterio del ícono-solo que el colapsado de escritorio. */}
            <style>{`
                @media (max-width: 768px) {
                    .cfg-sidebar {
                        width: 100% !important; position: static !important;
                        max-height: none !important; flex-direction: row !important;
                        align-items: center !important; overflow-x: auto !important;
                        overflow-y: hidden !important; gap: 6px !important;
                        padding: 8px !important;
                    }
                    .cfg-sidebar-header, .cfg-sidebar-group-label, .cfg-sidebar-divider { display: none !important; }
                    .cfg-sidebar-group { flex-direction: row !important; flex-shrink: 0 !important; }
                    .cfg-sidebar-item { flex-shrink: 0 !important; width: auto !important; padding: 0 12px !important; }
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

            {/* Índice de Apariencia — solo mientras se está viendo esa
                pantalla. No navega a ningún lado: scrollea la página actual
                hasta la tarjeta correspondiente (ver SECCIONES_APARIENCIA
                arriba, con el porqué de esta lista y sus límites). */}
            {activa === 'apariencia' && (
                <>
                    <div className="cfg-sidebar-group" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {SECCIONES_APARIENCIA.map(sec => (
                            <button
                                key={sec.id}
                                className="cfg-sidebar-item ds-hover"
                                // SIN `behavior: 'smooth'` a propósito — bug real
                                // encontrado probándolo: `html` ya tiene
                                // `scroll-behavior: smooth` por CSS global, y
                                // pasarle TAMBIÉN `behavior: 'smooth'` acá lo
                                // hace un no-op silencioso en Chrome (el scroll
                                // nunca arranca, sin error en consola). Con
                                // `block: 'start'` sin `behavior`, el scroll
                                // queda en 'auto' — que respeta el smooth ya
                                // declarado en el CSS, y anda.
                                onClick={() => document.getElementById(sec.id)?.scrollIntoView({ block: 'start' })}
                                title={sec.label}
                                style={{
                                    display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center',
                                    width: 36, height: 36, padding: 0,
                                    borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: 'transparent', color: 'var(--color-body)',
                                    transition: 'background 120ms, color 120ms',
                                }}
                            >
                                <sec.Icon size={15} strokeWidth={1.7} />
                            </button>
                        ))}
                    </div>
                    <div className="cfg-sidebar-divider" style={{ height: 1, background: 'var(--color-border)', margin: '2px 4px 6px' }} />
                </>
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
                            return (
                                <button
                                    key={item.vista}
                                    className="cfg-sidebar-item ds-hover"
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
                        })}
                    </div>
                )
            })}
        </nav>
    )
}
