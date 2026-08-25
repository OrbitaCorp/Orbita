import { OrbiIcon } from './OrbiIcon'
import { useOrbiStore } from './useOrbiStore'
import { useOrbiChat } from './useOrbiChat'
import type { OrbiContext } from './types'

const FIELD_LABELS: Record<string, string> = {
  nombre: 'el nombre de tu negocio',
  descripcion: 'la descripción',
  subdominio: 'el subdominio',
}

interface Props {
  field: string
  context: OrbiContext
  onDismiss: () => void
}

export function OrbiNudge({ field, context, onDismiss }: Props) {
  const open = useOrbiStore(s => s.open)
  const { send } = useOrbiChat()
  const label = FIELD_LABELS[field] ?? field

  const handleAccept = () => {
    open()
    send(`Ayudame con ${label}`, context)
  }

  return (
    <>
      <div
        className="orbi-nudge"
        style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 180,
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 18px', borderRadius: 16,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          maxWidth: 320,
          animation: 'orbi-nudge-in 300ms ease-out',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <OrbiIcon size={18} color="white" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, lineHeight: 1.4 }}>
            ¿Te ayudo con {label}?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAccept}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: '#3B82F6', color: 'white',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Sí, dale
            </button>
            <button
              onClick={onDismiss}
              style={{
                padding: '6px 14px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-alt)', color: 'var(--color-text)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              No, gracias
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes orbi-nudge-in {
          from { opacity: 0; transform: translateY(16px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @media (max-width: 767px) {
          .orbi-nudge {
            left: 12px !important; right: 12px !important; bottom: 12px !important;
            max-width: none !important;
          }
        }
      `}</style>
    </>
  )
}
