import { useOrbiStore } from './useOrbiStore'
import { OrbiIcon } from './OrbiIcon'

interface Props {
  collapsed?: boolean
}

export function OrbiTrigger({ collapsed }: Props) {
  const toggle = useOrbiStore(s => s.toggle)

  return (
    <button
      onClick={toggle}
      title="Orbi AI (Ctrl+K)"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%',
        padding: collapsed ? '10px 0' : '10px 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: 'transparent',
        border: 'none', borderRadius: 8,
        cursor: 'pointer',
        color: 'var(--color-text)',
        transition: 'background 140ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-alt)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <OrbiIcon size={28} disc />

      {!collapsed && (
        <>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Orbi AI</span>
          <kbd style={{
            fontSize: 10, fontWeight: 500,
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-muted)',
            fontFamily: 'inherit',
          }}>
            Ctrl+K
          </kbd>
        </>
      )}
    </button>
  )
}
