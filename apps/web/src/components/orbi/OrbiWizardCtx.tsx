import { X } from 'lucide-react'
import { OrbiIcon } from './OrbiIcon'
import { useOrbiContext } from './useOrbiContext'
import { useOrbiChat } from './useOrbiChat'
import { ORBI_STEP_LABELS } from './orbiWizardSteps'

// La tira de contexto del sheet full-screen de Orbi en el wizard: reemplaza
// "ver el wizard por detrás" — decís en qué paso estás y qué campos puede
// tocar Orbi, sin el formulario entero.
export function OrbiWizardCtx({ onClose }: { onClose: () => void }) {
  const context = useOrbiContext()
  const { send } = useOrbiChat()

  const label = context.stepName ? (ORBI_STEP_LABELS[context.stepName] ?? '') : ''
  const nums = context.stepIndex && context.totalSteps
    ? `Paso ${context.stepIndex} de ${context.totalSteps}`
    : ''
  const sub = [nums, label].filter(Boolean).join(' · ')

  const chips = context.stepChips ?? []

  return (
    <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="orbi-ctx-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 9px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <OrbiIcon size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)' }}>Orbi</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>{sub}</div>}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar Orbi"
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
            color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>

      {/* orbi-hide-kb: con el teclado abierto esta fila se esconde para dejarle
          el alto al chat (ver el <style> de OrbiBottomSheet). */}
      {chips.length > 0 && (
        <div className="orbi-hide-kb" style={{ display: 'flex', gap: 7, padding: '0 16px 11px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {chips.map(chip => {
            const done = chip.kind === 'field' && chip.filled === true
            const miss = chip.kind === 'field' && chip.filled === false
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => send(chip.send, context)}
                style={{
                  flexShrink: 0, font: 'inherit', fontSize: 11.5, fontWeight: 600,
                  padding: '6px 11px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${miss ? 'rgba(139,92,246,.4)' : done ? 'rgba(22,163,74,.35)' : 'var(--color-border)'}`,
                  background: miss ? 'rgba(139,92,246,.07)' : done ? 'rgba(22,163,74,.06)' : 'var(--color-surface)',
                  color: miss ? '#8B5CF6' : done ? '#16A34A' : 'var(--color-body)',
                }}
              >
                {miss ? '✦ ' : done ? '✓ ' : ''}{chip.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
