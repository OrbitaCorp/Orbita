// ─── Badge de estado de producto ──────────────────────────────────────────────
// (La navegación entre secciones del módulo catálogo — lista/crear/categorías/
// reportes — vive únicamente en el sidebar; este archivo tenía antes también
// un tab-bar duplicado, CatalogoTabs, que se sacó por redundante.)

import type { EstadoProducto } from '../types/catalogo.types'

const ESTADO: Record<EstadoProducto, { label: string; bg: string; fg: string }> = {
    publicado: { label: 'Publicado', bg: 'var(--color-success-bg)', fg: 'var(--color-success)' },
    borrador:  { label: 'Borrador',  bg: 'var(--color-surface-alt)', fg: 'var(--color-muted)' },
    sin_stock: { label: 'Sin stock', bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' },
}

export function ProductoEstadoBadge({ estado }: { estado: EstadoProducto }) {
    const c = ESTADO[estado]
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600, width: 'fit-content' }}>{c.label}</span>
    )
}
