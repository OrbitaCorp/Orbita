import { BookOpen, Wrench } from 'lucide-react'

/**
 * Aviso fijo arriba del input mientras Orbi está en mantenimiento. Uno solo,
 * no un mensaje por envío: el input queda deshabilitado mientras está.
 * `role="status"`: el lector de pantalla lo anuncia una vez al aparecer.
 */
export function OrbiAvisoMantenimiento({ mensaje, onAbrirManual }: {
  mensaje: string
  /** Solo en el panel: el alta de negocios no tiene Manual. */
  onAbrirManual?: () => void
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        margin: '0 12px 8px', padding: '10px 12px', borderRadius: 10,
        background: 'var(--color-warning-bg)',
        border: '1px solid var(--color-warning)',
        color: 'var(--chip-warning-fg)',
        fontSize: 13, lineHeight: 1.45,
      }}
    >
      <Wrench size={16} strokeWidth={2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>{mensaje}</div>
        {onAbrirManual && (
          <button
            type="button"
            onClick={onAbrirManual}
            className="orbi-foco"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              minHeight: 44, margin: '-6px 0 -10px', padding: '0 2px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              font: 'inherit', fontSize: 13, fontWeight: 600,
              color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            <BookOpen size={14} strokeWidth={2} aria-hidden />
            Abrir el Manual del panel
          </button>
        )}
      </div>
    </div>
  )
}
