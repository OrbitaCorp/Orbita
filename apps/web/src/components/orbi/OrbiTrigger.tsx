import { useOrbiStore } from './useOrbiStore'
import { OrbiPet } from './pet/OrbiPet'

interface Props {
  collapsed?: boolean
}

export function OrbiTrigger({ collapsed }: Props) {
  const toggle = useOrbiStore(s => s.toggle)

  return (
    <button
      onClick={toggle}
      title="Orbi AI"
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
      {/* Sin disco: el pet suelto sobre el menú, y vivo (flota, parpadea, el
          satélite orbita) para que se sienta presente aunque no se lo toque. */}
      <OrbiPet size={44} animated />

      {!collapsed && (
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Orbi AI</span>
      )}
    </button>
  )
}
