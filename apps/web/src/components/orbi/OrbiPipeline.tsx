import { Check, Loader2 } from 'lucide-react'
import type { OrbiAction } from './types'

export function OrbiPipeline({ actions }: { actions: OrbiAction[] }) {
  if (!actions.length) return null
  const allDone = actions.every(a => a.status === 'complete')

  return (
    <div style={{
      background: allDone ? '#ECFDF5' : 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: '10px 12px',
      margin: '6px 0',
      transition: 'background 300ms',
    }}>
      {actions.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          {a.status === 'complete' && (
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#10B981', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Check size={11} strokeWidth={3} color="white" />
            </div>
          )}
          {a.status === 'active' && (
            <div style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Loader2 size={14} strokeWidth={2} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          {a.status === 'error' && (
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#EF4444', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>!</span>
            </div>
          )}
          <span style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: a.status === 'active' ? 600 : 400 }}>
            {a.result ?? a.label}
          </span>
        </div>
      ))}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
