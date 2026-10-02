// Índice interno de una pantalla de Configuración — columna fija a la
// izquierda del contenido, solo para las pantallas que tienen secciones
// propias (hoy, Apariencia). Cada ítem scrollea a su sección y el índice
// sigue el scroll.
//
// La navegación ENTRE pantallas de Configuración (Negocio, Pagos, Equipo…) ya
// no vive acá: son sub-secciones del módulo Configuración en el menú principal
// (layouts/components/Sidebar.tsx). Para darle índice a otra pantalla alcanza
// con sumarla a INDICES: cada `id` es el id del elemento al que se scrollea.
//
// En celular no se muestra: la columna no entra y las secciones se recorren
// con el scroll de siempre.

import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import {
    Palette, Droplets, Type, LayoutGrid, Eye, AlignLeft, Hash, PanelBottom, BadgeCheck, Video,
    Image as ImageIcon, MessageCircle,
} from 'lucide-react'
import type { VistaConfig } from './ConfigTabs'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>
interface SeccionIndice { id: string; label: string; Icon: IconType }
interface Indice { titulo: string; secciones: SeccionIndice[] }

const INDICES: Partial<Record<VistaConfig, Indice>> = {
    // Cada `id` es el de la SecCard de esa sección (ver
    // apariencia/secciones/ y Controles.tsx).
    apariencia: {
        titulo: 'Apariencia',
        secciones: [
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
        ],
    },
}

// Cuánto por debajo del borde superior del panel tiene que haber pasado una
// sección para considerarla "la actual".
const UMBRAL_SECCION_ACTIVA = 120

export function IndiceDeVista({ vista }: { vista: VistaConfig }) {
    const indice = INDICES[vista]

    // La sección actual es la última cuyo borde superior ya pasó el umbral (se
    // compara por posición en pantalla, no por el orden de la lista: el orden en
    // la página puede cambiar y hay secciones que no siempre se dibujan). Al
    // llegar al fondo gana la última, aunque sea corta y nunca alcance el umbral.
    const [seccionActiva, setSeccionActiva] = useState<string | null>(null)
    const navRef = useRef<HTMLElement>(null)
    useEffect(() => {
        if (!indice) return
        const main = document.querySelector('.admin-main') as HTMLElement | null
        if (!main) return
        const calcular = () => {
            const tope = main.getBoundingClientRect().top
            let elegida: string | null = null, mejorTop = -Infinity
            let primera: string | null = null, primeraTop = Infinity
            let ultima: string | null = null, ultimaTop = -Infinity
            for (const sec of indice.secciones) {
                const el = document.getElementById(sec.id)
                if (!el) continue
                const t = el.getBoundingClientRect().top - tope
                if (t < primeraTop) { primeraTop = t; primera = sec.id }
                if (t > ultimaTop) { ultimaTop = t; ultima = sec.id }
                if (t <= UMBRAL_SECCION_ACTIVA && t > mejorTop) { mejorTop = t; elegida = sec.id }
            }
            const alFondo = main.scrollTop > 0 && main.scrollTop + main.clientHeight >= main.scrollHeight - 4
            setSeccionActiva(alFondo ? ultima : (elegida ?? primera))
        }
        let raf = 0
        const alScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(calcular) }
        main.addEventListener('scroll', alScroll, { passive: true })
        window.addEventListener('resize', alScroll)
        // La pantalla dibuja las secciones recién cuando carga (antes hay un
        // esqueleto) y a veces cambian de altura al terminar de cargar imágenes:
        // se recalcula unas veces al entrar además del scroll.
        const timers = [0, 300, 900, 2000].map(ms => window.setTimeout(alScroll, ms))
        return () => {
            cancelAnimationFrame(raf)
            main.removeEventListener('scroll', alScroll)
            window.removeEventListener('resize', alScroll)
            timers.forEach(clearTimeout)
        }
    }, [indice])

    // Si el índice es más alto que la pantalla (scrollea solo), mantener visible
    // el ítem activo — se mueve el scroll de la columna a mano, sin scrollIntoView,
    // que también arrastraría el scroll del panel.
    useEffect(() => {
        const nav = navRef.current
        const btn = seccionActiva ? nav?.querySelector<HTMLElement>(`[data-sec="${seccionActiva}"]`) : null
        if (!nav || !btn) return
        const n = nav.getBoundingClientRect(), b = btn.getBoundingClientRect()
        if (b.top < n.top + 8) nav.scrollTop -= n.top + 8 - b.top
        else if (b.bottom > n.bottom - 8) nav.scrollTop += b.bottom - n.bottom + 8
    }, [seccionActiva])

    if (!indice) return null

    return (
        <nav
            ref={navRef}
            className="cfg-indice"
            aria-label={`Secciones de ${indice.titulo}`}
            style={{
                width: 208, flexShrink: 0,
                padding: '16px 8px',
                // Estilo columna: borde derecho, sin card, sin sombra
                borderRight: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                display: 'flex', flexDirection: 'column', gap: 12,
                boxSizing: 'border-box',
                // Sticky para seguir el scroll de .admin-main
                position: 'sticky', top: 0, alignSelf: 'flex-start',
                height: 'calc(100vh - 64px)', overflowY: 'auto', overflowX: 'hidden',
            }}
        >
            <style>{`
                @media (max-width: 768px) { .cfg-indice { display: none !important; } }
            `}</style>

            <div style={{ padding: '0 8px', fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
                {indice.titulo}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {indice.secciones.map(sec => {
                    const actual = seccionActiva === sec.id
                    return (
                        <button
                            key={sec.id}
                            data-sec={sec.id}
                            aria-current={actual || undefined}
                            className="ds-hover"
                            onClick={() => {
                                document.getElementById(sec.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                            }}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                                minHeight: 36, padding: '8px 10px', borderRadius: 8, border: 'none',
                                background: actual ? 'var(--color-primary-bg)' : 'transparent',
                                color: actual ? 'var(--color-primary)' : 'var(--color-body)',
                                fontSize: 13, fontWeight: actual ? 600 : 500, textAlign: 'left', lineHeight: 1.3,
                                cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'color 120ms, background 120ms',
                            }}
                        >
                            <sec.Icon size={15} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: 1 }} />
                            {sec.label}
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
