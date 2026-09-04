import { useRef, useState, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { useOrbiStore } from './useOrbiStore'
import { useOrbiChat } from './useOrbiChat'
import { useOrbiContext } from './useOrbiContext'
import { OrbiIcon } from './OrbiIcon'
import { OrbiMessages } from './OrbiMessages'
import { OrbiInput } from './OrbiInput'
import { track } from '@/lib/analytics/wizardTracker'

type SheetState = 'peek' | 'full'

const PEEK_VH = 45
const DRAG_THRESHOLD = 50

export function OrbiBottomSheet({ onClose }: { onClose: () => void }) {
  const { send, isStreaming } = useOrbiChat()
  const context = useOrbiContext()
  const [sheetState, setSheetState] = useState<SheetState>('peek')

  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragDelta = useRef(0)
  const isDragging = useRef(false)

  useEffect(() => {
    if (context.surface === 'wizard') {
      track('orbi_open', { step: context.step, stepName: context.stepName, rubro: context.rubro })
    }
  }, [context])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.orbi-messages-scroll') || target.closest('.orbi-input-area')) return
    isDragging.current = true
    dragStartY.current = e.touches[0].clientY
    dragDelta.current = 0
    if (sheetRef.current) sheetRef.current.style.willChange = 'transform'
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    dragDelta.current = e.touches[0].clientY - dragStartY.current
    if (sheetRef.current) {
      const clampedDelta = Math.max(0, dragDelta.current)
      sheetRef.current.style.transition = 'none'
      sheetRef.current.style.transform = `translateY(${clampedDelta}px)`
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (sheetRef.current) {
      sheetRef.current.style.willChange = ''
      sheetRef.current.style.transition = ''
      sheetRef.current.style.transform = ''
    }

    const delta = dragDelta.current
    if (delta > DRAG_THRESHOLD) {
      if (sheetState === 'full') setSheetState('peek')
      else onClose()
    } else if (delta < -DRAG_THRESHOLD) {
      setSheetState('full')
    }
    dragDelta.current = 0
  }, [sheetState, onClose])

  const height = sheetState === 'full'
    ? 'calc(100vh - env(safe-area-inset-top, 0px))'
    : `${PEEK_VH}vh`

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.15)',
          animation: 'orbi-fade-in 200ms ease-out',
        }}
      />

      <div
        ref={sheetRef}
        className="orbi-bottom-sheet"
        aria-modal={sheetState === 'full' ? 'true' : undefined}
        role="dialog"
        aria-label="Orbi asistente"
        style={{
          position: 'fixed',
          left: 0, right: 0, bottom: 0,
          height,
          zIndex: 200,
          background: 'var(--color-bg)',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          transition: 'height 250ms ease-out',
          overflow: 'hidden',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '10px 0 6px', flexShrink: 0, cursor: 'grab',
          touchAction: 'none',
        }}>
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: 'var(--color-border)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 16px 14px', flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
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

          {sheetState === 'peek' && (
            <button
              onClick={() => setSheetState('full')}
              aria-label="Expandir"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: 'none', background: 'transparent',
                cursor: 'pointer', display: 'grid', placeItems: 'center',
                color: 'var(--color-muted)', fontSize: 18,
              }}
            >
              ⌃
            </button>
          )}

          <button
            onClick={onClose}
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
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <OrbiInput
            onSend={(message) => send(message, context)}
            disabled={isStreaming}
          />
        </div>
      </div>

      <style>{`
        @keyframes orbi-fade-in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbi-bottom-sheet { transition: none !important; }
        }
      `}</style>
    </>
  )
}
