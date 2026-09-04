import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { X } from 'lucide-react'
import { OrbiIcon } from './OrbiIcon'
import { useOrbiStore } from './useOrbiStore'
import type { OrbiBubbleData } from './useOrbiStore'

interface Props {
  onChipClick: (actionKey: string) => void
}

export function OrbiBubble({ onChipClick }: Props) {
  const bubble = useOrbiStore(s => s.bubble)
  const hideBubble = useOrbiStore(s => s.hideBubble)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [bottomPx, setBottomPx] = useState(24 + 48 + 12) // FAB bottom + FAB size + gap
  const prevBubble = useRef<OrbiBubbleData | null>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const sync = () => {
      const raw = root.style.getPropertyValue('--orbi-wizard-bottom')
      const footerH = parseInt(raw, 10) || 0
      const fabBottom = footerH > 0 ? footerH + 16 : 24
      setBottomPx(fabBottom + 48 + 12)
    }
    sync()
    const mo = new MutationObserver(() => requestAnimationFrame(sync))
    mo.observe(root, { attributes: true, attributeFilter: ['style'] })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    if (bubble && bubble !== prevBubble.current) {
      prevBubble.current = bubble
      setExiting(false)
      requestAnimationFrame(() => setVisible(true))

      if (bubble.autoHideMs) {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => dismiss(), bubble.autoHideMs)
      }
    }
    if (!bubble) {
      setVisible(false)
      setExiting(false)
      prevBubble.current = null
    }
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubble])

  useEffect(() => {
    if (!bubble) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismiss()
      }
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    document.addEventListener('mousedown', handler)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', esc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubble])

  function dismiss() {
    setExiting(true)
    setTimeout(() => {
      hideBubble()
      setExiting(false)
      setVisible(false)
    }, 150)
  }

  function handleChip(actionKey: string) {
    onChipClick(actionKey)
    hideBubble()
    setVisible(false)
  }

  if (!bubble) return null

  return (
    <>
      <div
        ref={containerRef}
        role="alert"
        aria-live="polite"
        className="orbi-bubble"
        style={{
          position: 'fixed',
          bottom: bottomPx,
          right: 24,
          zIndex: 175,
          maxWidth: 280,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '14px 16px',
          borderRadius: 16,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          opacity: visible && !exiting ? 1 : 0,
          transform: visible && !exiting ? 'scale(1)' : 'scale(0.9)',
          transformOrigin: 'bottom right',
          transition: exiting
            ? 'opacity 150ms ease-in, transform 150ms ease-in'
            : 'opacity 250ms ease-out, transform 250ms ease-out',
          pointerEvents: visible && !exiting ? 'auto' : 'none',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <OrbiIcon size={16} color="white" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--color-text)',
            lineHeight: 1.45, marginBottom: bubble.chips?.length ? 10 : 0,
          }}>
            {bubble.message}
          </div>

          {bubble.chips && bubble.chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {bubble.chips.map(chip => (
                <button
                  key={chip.actionKey}
                  onClick={() => handleChip(chip.actionKey)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: chip.actionKey === 'dismiss'
                      ? 'var(--color-surface-alt)'
                      : 'rgba(59,130,246,0.1)',
                    color: chip.actionKey === 'dismiss'
                      ? 'var(--color-text)'
                      : '#3B82F6',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    minHeight: 34,
                    transition: 'background 150ms',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            width: 24, height: 24, borderRadius: 6,
            border: 'none', background: 'transparent',
            cursor: 'pointer', display: 'grid', placeItems: 'center',
            color: 'var(--color-muted)', flexShrink: 0, marginTop: -2,
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .orbi-bubble { left: 16px !important; right: 16px !important; max-width: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbi-bubble { transition: none !important; }
        }
      `}</style>
    </>
  )
}
