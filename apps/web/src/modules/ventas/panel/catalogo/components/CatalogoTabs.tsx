// ─── Badge de estado de producto ──────────────────────────────────────────────
// (La navegación entre secciones del módulo catálogo — lista/crear/categorías/
// reportes — vive únicamente en el sidebar; este archivo tenía antes también
// un tab-bar duplicado, CatalogoTabs, que se sacó por redundante.)

import type { EstadoProducto } from '../types/catalogo.types'

const ESTADO: Record<EstadoProducto, { label: string; bg: string; fg: string; dot: string }> = {
    publicado: { label: 'Publicado', bg: 'var(--color-success-bg)', fg: 'var(--color-success)', dot: 'var(--color-success)' },
    borrador:  { label: 'Borrador',  bg: 'var(--color-surface-alt)', fg: 'var(--color-muted)', dot: 'var(--color-muted)' },
    sin_stock: { label: 'Sin stock', bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)', dot: 'var(--color-warning)' },
}

// `sobreImagen`: para cuando el badge flota SOBRE la foto del producto (la
// card de la grilla) en vez de estar en una fila/card de fondo plano. Los
// colores semánticos (fondo clarito + texto de color) pueden perderse contra
// fotos muy claras o muy saturadas — ahí se usa el mismo criterio que ya usa
// el contador "1/3" del carrusel: chip oscuro sólido + texto blanco, siempre
// legible sin importar la foto de fondo. El color de estado no se pierde: un
// puntito lo conserva.
export function ProductoEstadoBadge({ estado, sobreImagen }: { estado: EstadoProducto; sobreImagen?: boolean }) {
    const c = ESTADO[estado]
    if (sobreImagen) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px 0 7px', borderRadius: 9999, background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 11, fontWeight: 600, width: 'fit-content' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                {c.label}
            </span>
        )
    }
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600, width: 'fit-content' }}>{c.label}</span>
    )
}
