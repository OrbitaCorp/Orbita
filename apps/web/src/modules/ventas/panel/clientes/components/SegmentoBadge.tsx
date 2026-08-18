// Badge de segmento de cliente (VIP / Recurrente / Nuevo / Inactivo).
// Colores semi-transparentes legibles tanto en claro como en oscuro.

import type { Segmento } from '../types/clientes.types'

export const SEG_CONFIG: Record<Segmento, { label: string; bg: string; fg: string }> = {
    vip:        { label: 'VIP ★',      bg: 'var(--color-warning-bg)', fg: 'var(--chip-warning-fg)' },
    recurrente: { label: 'Recurrente', bg: 'var(--color-primary-bg)', fg: 'var(--chip-primary-fg)' },
    nuevo:      { label: 'Nuevo',      bg: 'var(--color-success-bg)', fg: 'var(--chip-success-fg)' },
    inactivo:   { label: 'Inactivo',   bg: 'var(--color-surface-alt)', fg: 'var(--color-body)' },
}

export function SegmentoBadge({ segmento, size = 'md' }: { segmento: Segmento; size?: 'sm' | 'md' }) {
    const c = SEG_CONFIG[segmento]
    const h = size === 'sm' ? 22 : 24
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', height: h, padding: '0 10px',
            borderRadius: 9999, background: c.bg, color: c.fg,
            fontSize: size === 'sm' ? 11 : 12, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
            {c.label}
        </span>
    )
}
