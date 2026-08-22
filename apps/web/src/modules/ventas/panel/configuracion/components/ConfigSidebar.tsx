// Menú guía de Configuración — reemplaza el modelo anterior (una sola
// pantalla "General" con 6 tarjetas apiladas de a dos columnas + 3 pantallas
// sueltas para Apariencia/Equipo/Notificaciones, elegidas desde el sidebar
// PRINCIPAL del panel). Ahora cada sección es una raíz propia acá, en un
// menú dedicado — el sidebar principal se colapsa a la franja de íconos
// apenas se entra a Configuración (ver Sidebar.tsx) para hacerle lugar a
// este, mismo patrón que un módulo de configuración típico (paneles de
// administración de flotas, IDEs, etc. — la referencia que pasó el usuario).

import { useEffect, useState, type ComponentType } from 'react'
import {
    Building2, Phone, Wallet, Truck, Share2, RotateCcw, Palette, Users, Bell, AlertTriangle,
    PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { VistaConfig } from './ConfigTabs'

const COLLAPSE_KEY = 'orbita-config-sidebar-collapsed'

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>
interface Item { vista: VistaConfig; label: string; Icon: IconType; permisos?: string[]; peligro?: boolean }
interface Grupo { label?: string; items: Item[] }

const GRUPOS: Grupo[] = [
    {
        items: [
            { vista: 'negocio',  label: 'Negocio',  Icon: Building2, permisos: ['config.edit'] },
            { vista: 'contacto', label: 'Contacto', Icon: Phone,     permisos: ['config.edit'] },
            { vista: 'pagos',    label: 'Pagos',    Icon: Wallet,    permisos: ['config.edit'] },
            { vista: 'envios',   label: 'Envíos',   Icon: Truck,     permisos: ['config.edit'] },
            { vista: 'redes',    label: 'Redes sociales', Icon: Share2, permisos: ['config.edit'] },
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
        items: [
            { vista: 'peligro', label: 'Zona peligrosa', Icon: AlertTriangle, permisos: ['config.edit'], peligro: true },
        ],
    },
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
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-alt)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                        <PanelLeftClose size={15} strokeWidth={1.7} />
                    </button>
                </div>
            )}
            {colapsadoEfectivo && (
                <button
                    className="cfg-sidebar-header"
                    onClick={toggleColapsado} title="Expandir menú" aria-label="Expandir menú"
                    style={{ width: 36, height: 36, margin: '0 auto', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'grid', placeItems: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-alt)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
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
                            return (
                                <button
                                    key={item.vista}
                                    className="cfg-sidebar-item"
                                    onClick={() => onNavigate(item.vista)}
                                    title={colapsadoEfectivo ? item.label : undefined}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        height: 36, borderRadius: 8,
                                        border: 'none', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
                                        fontSize: 13, fontWeight: act ? 600 : 500, color,
                                        background: act
                                            ? (item.peligro ? 'var(--color-error-bg)' : 'var(--color-primary-bg)')
                                            : 'transparent',
                                        transition: 'background 120ms, color 120ms',
                                        ...(colapsadoEfectivo ? { width: 36, padding: 0, justifyContent: 'center' } : { width: '100%', padding: '0 10px' }),
                                    }}
                                    onMouseEnter={e => { if (!act) e.currentTarget.style.background = 'var(--color-surface-alt)' }}
                                    onMouseLeave={e => { if (!act) e.currentTarget.style.background = 'transparent' }}
                                >
                                    <item.Icon size={15} strokeWidth={1.7} />
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
