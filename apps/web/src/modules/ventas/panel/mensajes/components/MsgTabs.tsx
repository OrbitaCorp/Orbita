// Barra de tabs del módulo de mensajes.

export type VistaMensaje = 'bandeja' | 'chat' | 'plantillas'

interface MsgTabsProps {
    activo: VistaMensaje
    ir:     (vista: VistaMensaje) => void
}

// La vista 'chat' (pantalla completa) se muestra bajo la tab "Bandeja".
const TABS: { id: VistaMensaje; label: string }[] = [
    { id: 'bandeja',    label: 'Bandeja'    },
    { id: 'plantillas', label: 'Plantillas' },
]

export function MsgTabs({ activo, ir }: MsgTabsProps) {
    const efectivo = activo === 'chat' ? 'bandeja' : activo
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map(tb => {
                const a = efectivo === tb.id
                return (
                    <button
                        key={tb.id}
                        className="ds-hover"
                        onClick={() => ir(tb.id)}
                        style={{
                            padding: '10px 14px', border: 'none', background: 'transparent',
                            color: a ? 'var(--color-text)' : 'var(--color-muted)',
                            fontSize: 13.5, fontWeight: a ? 600 : 500, cursor: 'pointer',
                            fontFamily: 'inherit', borderBottom: `2px solid ${a ? 'var(--color-primary)' : 'transparent'}`,
                            // Radio solo arriba: el velo de hover no curva el subrayado activo.
                            borderRadius: '7px 7px 0 0',
                            marginBottom: -1, whiteSpace: 'nowrap',
                        }}
                    >
                        {tb.label}
                    </button>
                )
            })}
        </div>
    )
}
