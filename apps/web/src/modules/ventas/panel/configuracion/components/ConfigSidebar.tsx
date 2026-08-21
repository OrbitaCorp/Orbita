// Menú guía de Configuración — reemplaza el modelo anterior (una sola
// pantalla "General" con 6 tarjetas apiladas de a dos columnas + 3 pantallas
// sueltas para Apariencia/Equipo/Notificaciones, elegidas desde el sidebar
// PRINCIPAL del panel). Ahora cada sección es una raíz propia acá, en un
// menú dedicado — el sidebar principal se colapsa a la franja de íconos
// apenas se entra a Configuración (ver Sidebar.tsx) para hacerle lugar a
// este, mismo patrón que un módulo de configuración típico (paneles de
// administración de flotas, IDEs, etc. — la referencia que pasó el usuario).

import type { ComponentType } from 'react'
import {
    Building2, Phone, Wallet, Truck, Share2, Palette, Users, Bell, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { VistaConfig } from './ConfigTabs'

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

    return (
        <nav
            style={{
                width: 216, flexShrink: 0, padding: '20px 12px',
                borderRadius: 12, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                display: 'flex', flexDirection: 'column', gap: 20,
                boxSizing: 'border-box',
                // "Flotante": nada de línea divisoria fija contra el contenido —
                // una card con su propio borde entero, sticky + scroll propio,
                // mismo criterio que el filtro del catálogo del storefront
                // (Catalogo.tsx, .sf-cat-sidebar) — sigue el scroll de la
                // página en vez de quedar cortada a la altura de la ventana.
                position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
            }}
        >
            <div style={{ padding: '0 8px', fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
                Configuración
            </div>
            {GRUPOS.map((g, gi) => {
                const visibles = g.items.filter(puedeVer)
                if (visibles.length === 0) return null
                return (
                    <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {g.label && (
                            <div style={{ padding: '0 8px 6px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)' }}>
                                {g.label}
                            </div>
                        )}
                        {visibles.map(item => {
                            const act = activa === item.vista
                            const color = item.peligro
                                ? (act ? 'var(--color-error)' : 'var(--color-muted)')
                                : (act ? 'var(--color-primary)' : 'var(--color-body)')
                            return (
                                <button
                                    key={item.vista}
                                    onClick={() => onNavigate(item.vista)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        height: 36, padding: '0 10px', borderRadius: 8,
                                        border: 'none', cursor: 'pointer', textAlign: 'left',
                                        fontSize: 13, fontWeight: act ? 600 : 500, color,
                                        background: act
                                            ? (item.peligro ? 'var(--color-error-bg)' : 'var(--color-primary-bg)')
                                            : 'transparent',
                                        transition: 'background 120ms, color 120ms',
                                    }}
                                    onMouseEnter={e => { if (!act) e.currentTarget.style.background = 'var(--color-surface-alt)' }}
                                    onMouseLeave={e => { if (!act) e.currentTarget.style.background = 'transparent' }}
                                >
                                    <item.Icon size={15} strokeWidth={1.7} />
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>
                )
            })}
        </nav>
    )
}
