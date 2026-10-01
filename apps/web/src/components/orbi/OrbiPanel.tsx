import { useEffect } from 'react'
import { SquarePen, X } from 'lucide-react'
import { useOrbiStore } from './useOrbiStore'
import { useOrbiChat } from './useOrbiChat'
import { useOrbiContext } from './useOrbiContext'
import { OrbiPet } from './pet/OrbiPet'
import { usePetEstado } from './pet/usePetEstado'
import { OrbiMessages } from './OrbiMessages'
import { OrbiInput } from './OrbiInput'
import { OrbiBottomSheet } from './OrbiBottomSheet'
import { useMediaQuery } from './useMediaQuery'
import { track } from '@/lib/analytics/wizardTracker'
import { ID_PANEL_ORBI } from './types'

export function OrbiPanel() {
  const isOpen = useOrbiStore(s => s.isOpen)
  const close = useOrbiStore(s => s.close)
  const reset = useOrbiStore(s => s.reset)
  const abortar = useOrbiStore(s => s.abortar)
  const { send, isStreaming } = useOrbiChat()
  const context = useOrbiContext()
  const isWizard = context.surface === 'wizard'
  const isMobile = useMediaQuery('(max-width: 767px)')
  const estadoPet = usePetEstado()

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
        id={ID_PANEL_ORBI}
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
          {/* En el panel toma la forma del módulo y reacciona al chat; en "Crear tu
              espacio" (wizard) queda en su forma base. */}
          {isWizard ? <OrbiPet modulo="dashboard" size={40} disc /> : <OrbiPet size={40} disc estado={estadoPet} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Orbi</div>
            {context.module && (
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                {context.module}{context.section ? ` / ${context.section}` : ''}
              </div>
            )}
          </div>
          {/* Solo en el panel: el wizard no guarda la conversación en el
              servidor, así que ahí no hay hilo que reiniciar. reset() corta
              lo que esté en curso y el saludo vuelve a aparecer. El alto
              visible es 32px; el margen negativo extiende el área táctil a
              44px sin agrandar el encabezado. */}
          {!isWizard && (
            <button
              type="button"
              onClick={reset}
              aria-label="Nueva conversación con Orbi"
              className="orbi-foco"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                minHeight: 44, margin: '-6px 0', padding: '0 6px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderRadius: 8, font: 'inherit', fontSize: 12, fontWeight: 600,
                color: 'var(--color-muted)', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)' }}
            >
              <SquarePen size={14} strokeWidth={2} aria-hidden />
              Nueva conversación
            </button>
          )}
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
          streaming={isStreaming}
          onStop={abortar}
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
