// Menú guía de Configuración — columna fija a la derecha del riel principal.
//
// Estilo columna (borde derecho, sin card ni rounded corners) en escritorio,
// tira horizontal de chips en celular (misma pieza que antes).
//
// Cuando la vista activa es "apariencia", las secciones de Apariencia se
// despliegan como sub-ítems bajo el botón de Apariencia (misma mecánica que
// los sub-ítems de módulos en Sidebar.tsx). Reemplaza el viejo popover por
// hover que salía de un portal.

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import { TiraScrollHint, useTiraScroll } from '@/components/TiraScroll'
import {
    Building2, Phone, Wallet, Truck, Share2, RotateCcw, Palette, Users, Bell, AlertTriangle,
    Crown, Globe, LifeBuoy, History,
    Droplets, Type, LayoutGrid, Eye, AlignLeft, Hash, PanelBottom, BadgeCheck, Video, Image as ImageIcon, MessageCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { VistaConfig } from './ConfigTabs'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>
interface Item { vista: VistaConfig; label: string; Icon: IconType; permisos?: string[]; peligro?: boolean }
interface Grupo { label?: string; items: Item[] }

const GRUPOS: Grupo[] = [
    {
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
            { vista: 'actividad',      label: 'Registro de actividad', Icon: History, permisos: ['config.audit.view'] },
        ],
    },
    {
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

// Sub-ítems de Apariencia: cada `id` es el mismo que la SecCard de
// Apariencia.tsx — al hacer click scrollea a esa sección.
const SECCIONES_APARIENCIA: { id: string; label: string; Icon: IconType }[] = [
    { id: 'ap-sec-identidad',     label: 'Identidad de marca',       Icon: Palette },
    { id: 'ap-sec-paleta',        label: 'Paleta de colores',        Icon: Droplets },
    { id: 'ap-sec-tipografia',    label: 'Tipografía',               Icon: Type },
    { id: 'ap-sec-layout',        label: 'Diseño y layout',          Icon: LayoutGrid },
    { id: 'ap-sec-parallax',      label: 'Banner con efecto parallax', Icon: ImageIcon },
    { id: 'ap-sec-marcas',        label: 'Marcas con las que trabajás', Icon: BadgeCheck },
    { id: 'ap-sec-video',         label: 'Video en tu tienda',       Icon: Video },
    { id: 'ap-sec-whatsapp',      label: 'Banner de WhatsApp',       Icon: MessageCircle },
    { id: 'ap-sec-visibilidad',   label: '¿Qué ven tus clientes?',   Icon: Eye },
    { id: 'ap-sec-textos',        label: 'Textos de tu tienda',      Icon: AlignLeft },
    { id: 'ap-sec-estadisticas',  label: 'Barra de estadísticas',    Icon: Hash },
    { id: 'ap-sec-pie',           label: 'Pie de página',            Icon: PanelBottom },
]

export function ConfigSidebar({ activa, onNavigate }: { activa: VistaConfig; onNavigate: (v: VistaConfig) => void }) {
    const { user } = useAuth()
    const permisos = user?.type === 'member' && user.role !== 'owner' ? user.permissions : null
    const puedeVer = (item: Item) => !permisos || !item.permisos || item.permisos.some(p => permisos.includes(p))

    // Desktop detection — en mobile la columna pasa a ser una tira horizontal
    // de chips (misma pieza que el sidebar principal).
    const [isDesktop, setIsDesktop] = useState(true)
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 769px)')
        const actualizar = () => setIsDesktop(mq.matches)
        actualizar()
        mq.addEventListener('change', actualizar)
        return () => mq.removeEventListener('change', actualizar)
    }, [])

    // Mobile: la tira es horizontal y con 13 ítems no entran todos.
    const { scrollerRef: navRef, hintRef } = useTiraScroll<HTMLElement>(activa, !isDesktop)

    return (
        <>
        <nav
            ref={navRef}
            className="cfg-sidebar ds-tira"
            style={{
                width: 208, flexShrink: 0,
                padding: '16px 8px',
                // Estilo columna: borde derecho, sin card, sin sombra
                borderRight: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                display: 'flex', flexDirection: 'column', gap: 16,
                boxSizing: 'border-box',
                // Sticky para seguir el scroll de .admin-main
                position: 'sticky', top: 0,
                maxHeight: 'calc(100vh - 64px)', overflowY: 'auto', overflowX: 'hidden',
            }}
        >
            <style>{`
                @media (max-width: 768px) {
                    .cfg-sidebar {
                        position: sticky !important; top: 0 !important; z-index: 20 !important;
                        width: auto !important; align-self: stretch !important;
                        margin: -12px -12px 0 !important; min-width: 0 !important;
                        max-height: none !important; flex-direction: row !important;
                        align-items: center !important; overflow-x: auto !important;
                        overflow-y: hidden !important; gap: 8px !important;
                        padding: 10px 12px 8px !important; border-radius: 0 !important;
                        border: none !important; border-right: none !important;
                        box-shadow: none !important; background: var(--color-surface) !important;
                        scrollbar-width: none; -webkit-overflow-scrolling: touch;
                        scroll-snap-type: x proximity; scroll-padding: 0 12px;
                    }
                    .cfg-sidebar::-webkit-scrollbar { display: none; }
                    .cfg-scroll-hint {
                        display: block !important; position: sticky; top: 56px; z-index: 20;
                        width: auto; align-self: stretch;
                        margin: -12px -12px 0; min-width: 0;
                        background: var(--color-surface);
                        border-bottom: 1px solid var(--color-border);
                    }
                    .cfg-sidebar-header, .cfg-sidebar-group-label, .cfg-sidebar-divider { display: none !important; }
                    .cfg-sidebar-group { flex-direction: row !important; flex-shrink: 0 !important; gap: 8px !important; }
                    .cfg-sidebar-ap-subs { display: none !important; }
                }
            `}</style>

            {/* Título */}
            <div className="cfg-sidebar-header" style={{ padding: '0 8px', fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
                Configuración
            </div>

            {GRUPOS.map((g, gi) => {
                const visibles = g.items.filter(puedeVer)
                if (visibles.length === 0) return null
                return (
                    <div key={gi} className="cfg-sidebar-group" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {g.label && (
                            <div className="cfg-sidebar-group-label" style={{ padding: '0 8px 6px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)' }}>
                                {g.label}
                            </div>
                        )}
                        {visibles.map(item => {
                            const act = activa === item.vista
                            const color = item.peligro
                                ? (act ? 'var(--color-error)' : 'var(--color-muted)')
                                : (act ? 'var(--color-primary)' : 'var(--color-body)')
                            return (
                                <div key={item.vista}>
                                    <button
                                        className="cfg-sidebar-item ds-tira-chip ds-hover"
                                        data-activa={act || undefined}
                                        data-peligro={item.peligro || undefined}
                                        onClick={() => onNavigate(item.vista)}
                                        title={item.label}
                                        style={{
                                            display: 'flex', gap: 10,
                                            width: '100%', minHeight: 36, padding: '8px 10px',
                                            borderRadius: 8,
                                            border: 'none', cursor: 'pointer', textAlign: 'left',
                                            fontSize: 13, fontWeight: act ? 600 : 500, color,
                                            background: act
                                                ? (item.peligro ? 'var(--color-error-bg)' : 'var(--color-primary-bg)')
                                                : 'transparent',
                                            transition: 'background 120ms, color 120ms',
                                            whiteSpace: 'normal', lineHeight: 1.3, alignItems: 'flex-start',
                                        }}
                                    >
                                        <item.Icon size={15} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: 1 }} />
                                        {item.label}
                                    </button>

                                    {/* Sub-ítems de Apariencia — aparecen cuando Apariencia está activa.
                                        Cada uno scrollea a su sección dentro de Apariencia.tsx. */}
                                    {item.vista === 'apariencia' && act && (
                                        <div className="cfg-sidebar-ap-subs" style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 18, paddingTop: 4, paddingBottom: 4 }}>
                                            {SECCIONES_APARIENCIA.map(sec => (
                                                <button
                                                    key={sec.id}
                                                    className="ds-hover"
                                                    onClick={() => {
                                                        document.getElementById(sec.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                                        padding: '6px 8px', borderRadius: 6, border: 'none',
                                                        background: 'transparent', color: 'var(--color-muted)',
                                                        fontSize: 12, fontWeight: 500, textAlign: 'left',
                                                        cursor: 'pointer', fontFamily: 'inherit',
                                                        transition: 'color 120ms',
                                                    }}
                                                >
                                                    <sec.Icon size={13} strokeWidth={1.7} style={{ flexShrink: 0 }} />
                                                    {sec.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </nav>
        {/* Solo celular: pista + pulgar del scroll horizontal. */}
        <TiraScrollHint hintRef={hintRef} className="cfg-scroll-hint" style={{ display: 'none' }} />
        </>
    )
}
