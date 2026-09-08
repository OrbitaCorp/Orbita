import { useLayoutEffect, useRef, useState } from 'react'
import { OrbiIcon } from './OrbiIcon'
import { useOrbiStore } from './useOrbiStore'

interface Props {
  onClick: () => void
}

export function OrbiWizardFAB({ onClick }: Props) {
  const isOpen = useOrbiStore(s => s.isOpen)
  const [bottomPx, setBottomPx] = useState(24)
  const rafRef = useRef(0)

  useLayoutEffect(() => {
    const root = document.documentElement

    const sync = () => {
      const raw = root.style.getPropertyValue('--orbi-wizard-bottom')
      const footerH = parseInt(raw, 10) || 0
      setBottomPx(footerH > 0 ? footerH + 16 : 24)
    }

    sync()

    const mo = new MutationObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(sync)
    })
    mo.observe(root, { attributes: true, attributeFilter: ['style'] })

    return () => {
      mo.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <button
      onClick={onClick}
      aria-label="Abrir asistente Orbi"
      style={{
        position: 'fixed',
        bottom: bottomPx,
        right: 24,
        zIndex: 170,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
        border: 'none',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
        transition: 'bottom 250ms ease-out, transform 150ms, opacity 200ms',
        opacity: isOpen ? 0 : 1,
        pointerEvents: isOpen ? 'none' : 'auto',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <OrbiIcon size={22} color="white" />
    </button>
  )
}
