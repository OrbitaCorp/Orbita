// Barra de tabs del módulo de reportes.

export type VistaReporte = 'ventas' | 'productos' | 'clientes' | 'inventario' | 'pagos'

const TABS: { id: VistaReporte; label: string }[] = [
    { id: 'ventas',     label: 'Ventas'     },
    { id: 'productos',  label: 'Productos'  },
    { id: 'clientes',   label: 'Clientes'   },
    { id: 'inventario', label: 'Inventario' },
    { id: 'pagos',      label: 'Pagos'      },
]

interface ReporteTabsProps {
    activo: VistaReporte
    ir:     (vista: VistaReporte) => void
}

export function ReporteTabs({ activo, ir }: ReporteTabsProps) {
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
                            // redondeo solo arriba: el velo del hover no pisa el subrayado del tab activo
                            borderRadius: '6px 6px 0 0',
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
