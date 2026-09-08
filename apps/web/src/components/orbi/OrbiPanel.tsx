import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useOrbiStore } from './useOrbiStore'
import { useOrbiChat } from './useOrbiChat'
import { useOrbiContext } from './useOrbiContext'
import { OrbiIcon } from './OrbiIcon'
import { OrbiMessages } from './OrbiMessages'
import { OrbiInput } from './OrbiInput'
import { OrbiBottomSheet } from './OrbiBottomSheet'
import { useMediaQuery } from './useMediaQuery'
import { track } from '@/lib/analytics/wizardTracker'

export function OrbiPanel() {
  const isOpen = useOrbiStore(s => s.isOpen)
  const close = useOrbiStore(s => s.close)
  const { send, isStreaming } = useOrbiChat()
  const context = useOrbiContext()
  const isWizard = context.surface === 'wizard'
  const isMobile = useMediaQuery('(max-width: 767px)')

  useEffect(() => {
    if (!isOpen || !isWizard) return
    track('orbi_open', { step: context.step, stepName: context.stepName, rubro: context.rubro })
  }, [isOpen, isWizard, context.step, context.stepName, context.rubro])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, close])

  if (!isOpen) return null

  if (isMobile && isWizard) {
    return <OrbiBottomSheet onClose={close} />
  }

  return (
    <>
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.15)',
          display: isMobile ? 'block' : 'none',
        }}
      />

      <div
        className="orbi-panel-root"
        style={{
          position: 'fixed',
          top: isWizard ? 'var(--orbi-wizard-top, 0px)' : 0,
          right: 0,
          bottom: isWizard ? 'var(--orbi-wizard-bottom, 0px)' : 0,
          width: 360,
          maxWidth: '100vw',
          zIndex: 200,
          background: 'var(--color-bg)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-6px 0 20px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          animation: 'orbi-slide-in 200ms ease-out',
          borderRadius: isWizard ? '0 0 0 12px' : 0,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#3B82F6', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <OrbiIcon size={17} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Orbi</div>
            {context.module && (
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                {context.module}{context.section ? ` / ${context.section}` : ''}
              </div>
            )}
          </div>
          <button
            onClick={close}
            aria-label="Cerrar Orbi"
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'grid', placeItems: 'center',
              color: 'var(--color-muted)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-alt)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Messages */}
        <OrbiMessages />

        {/* Input */}
        <OrbiInput
          onSend={(message) => send(message, context)}
          disabled={isStreaming}
        />
      </div>

      <style>{`
        @keyframes orbi-slide-in {
          from { transform: translateX(100%) }
          to   { transform: translateX(0) }
        }
        @media (max-width: 767px) {
          .orbi-panel-root { width: 100vw !important; border-left: none !important }
        }
      `}</style>
    </>
  )
}
