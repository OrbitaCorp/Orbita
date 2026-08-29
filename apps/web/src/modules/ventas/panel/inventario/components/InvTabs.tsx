// Barra de tabs del módulo de inventario.

export type VistaInventario = 'stock' | 'entrada' | 'ajuste' | 'movimientos' | 'proveedores'

const TABS: { id: VistaInventario; label: string }[] = [
    { id: 'stock',        label: 'Stock general' },
    { id: 'entrada',      label: 'Entrada'       },
    { id: 'ajuste',       label: 'Ajuste'        },
    { id: 'movimientos',  label: 'Movimientos'   },
    { id: 'proveedores',  label: 'Proveedores'   },
]

interface InvTabsProps {
    activo: VistaInventario
    ir:     (vista: VistaInventario) => void
}

export function InvTabs({ activo, ir }: InvTabsProps) {
    return (
        <>
        <style>{`.mod-tabs{-ms-overflow-style:none;scrollbar-width:none}.mod-tabs::-webkit-scrollbar{display:none}`}</style>
        <div className="mod-tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 20, overflowX: 'auto' }}>
            {TABS.map(tb => {
                const a = activo === tb.id
                return (
                    <button
                        key={tb.id}
                        className="ds-hover"
                        onClick={() => ir(tb.id)}
                        style={{
                            padding: '10px 14px', border: 'none', background: 'transparent',
                            color: a ? 'var(--color-text)' : 'var(--color-muted)',
                            fontSize: 13.5, fontWeight: a ? 600 : 500,
                            fontFamily: 'inherit', borderBottom: `2px solid ${a ? 'var(--color-primary)' : 'transparent'}`,
                            marginBottom: -1, whiteSpace: 'nowrap',
                        }}
                    >
                        {tb.label}
                    </button>
                )
            })}
        </div>
        </>
    )
}
