// Selector visual: una fila de opciones, cada una con su miniatura.

import type { ReactNode } from 'react'

// `disabled` + `motivo`: para opciones que dependen de un dato que la tienda
// todavía no tiene (hoy, los estilos de categoría que necesitan foto). Se
// muestran igual — que el dueño vea que existen y qué le falta para usarlas —
// pero no se pueden elegir. `ayuda` es la descripción corta bajo el label;
// deshabilitada, esa línea se reemplaza por `motivo` (y queda también como
// tooltip) para que el porqué se vea sin depender del hover.
export function VisualPick({ value, onChange, options }: {
    value: string
    onChange: (v: string) => void
    options: { id: string; label: string; svg: ReactNode; ayuda?: string; disabled?: boolean; motivo?: string }[]
}) {
    return (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {options.map(o => {
                const a = value === o.id
                const off = !!o.disabled
                return (
                    <button
                        key={o.id}
                        onClick={() => { if (!off) onChange(o.id) }}
                        disabled={off}
                        title={off ? o.motivo : undefined}
                        className={off ? undefined : 'ds-hover'}
                        style={{
                            width: 120, borderRadius: 10,
                            border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                            cursor: off ? 'not-allowed' : 'pointer', padding: 8, fontFamily: 'inherit',
                            opacity: off ? 0.45 : 1, textAlign: 'center',
                        }}
                    >
                        <div style={{ height: 52, display: 'grid', placeItems: 'center' }}>{o.svg}</div>
                        <div style={{ fontSize: 12, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)', marginTop: 6 }}>{o.label}</div>
                        {(off && o.motivo ? o.motivo : o.ayuda) && (
                            <div style={{ fontSize: 10.5, color: 'var(--color-subtle)', marginTop: 3, lineHeight: 1.3 }}>{off && o.motivo ? o.motivo : o.ayuda}</div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
