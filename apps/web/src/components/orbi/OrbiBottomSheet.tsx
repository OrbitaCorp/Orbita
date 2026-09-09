import { useRef, useCallback, useEffect } from 'react'
import { useOrbiChat } from './useOrbiChat'
import { useOrbiContext } from './useOrbiContext'
import { useOrbiViewport } from './useOrbiViewport'
import { OrbiWizardCtx } from './OrbiWizardCtx'
import { OrbiMessages } from './OrbiMessages'
import { OrbiInput } from './OrbiInput'
import { track } from '@/lib/analytics/wizardTracker'

const DRAG_CLOSE = 90

// Tiene que quedar ARRIBA del header (sticky, z 1000) y el footer (fixed, z
// 1000) del wizard — si no, la barra de "Continuar / Anterior" se ve encima
// del sheet y le tapa el input. El panel normal de Orbi usa z 200; acá vamos
// muy por encima porque esto es un takeover de pantalla completa.
const Z_BACKDROP = 2_000_000
const Z_SHEET = 2_000_001

export function OrbiBottomSheet({ onClose }: { onClose: () => void }) {
  const { send, isStreaming } = useOrbiChat()
  const context = useOrbiContext()
  useOrbiViewport() // publica --orbi-kb (alto del teclado) en <html>

  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragDelta = useRef(0)
  const dragging = useRef(false)

  useEffect(() => {
    if (context.surface === 'wizard') {
      track('orbi_open', { step: context.step, stepName: context.stepName, rubro: context.rubro })
    }
  }, [context])

  // Escape cierra.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Scroll lock del fondo mientras el sheet está abierto.
  useEffect(() => {
    const y = window.scrollY
    const body = document.body
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, y)
    }
  }, [])

  // Drag para cerrar: SOLO desde la tira de contexto (no desde el chat ni el input).
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.target as HTMLElement
    if (t.closest('.orbi-messages-scroll') || t.closest('.orbi-input-area')) return
    dragging.current = true
    dragStartY.current = e.touches[0].clientY
    dragDelta.current = 0
    if (sheetRef.current) sheetRef.current.style.willChange = 'transform'
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return
    dragDelta.current = Math.max(0, e.touches[0].clientY - dragStartY.current)
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none'
      sheetRef.current.style.transform = `translateY(${dragDelta.current}px)`
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    const el = sheetRef.current
    if (el) { el.style.willChange = ''; el.style.transition = ''; el.style.transform = '' }
    if (dragDelta.current > DRAG_CLOSE) onClose()
    dragDelta.current = 0
  }, [onClose])

  const avanzar = () => {
    window.dispatchEvent(new CustomEvent('orbi:advance-step'))
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: Z_BACKDROP, background: 'rgba(0,0,0,0.28)', animation: 'orbi-fade-in 200ms ease-out' }}
      />

      <div
        ref={sheetRef}
        className="orbi-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Orbi asistente"
        style={{
          position: 'fixed',
          inset: 0,
          // El área útil (donde vive la columna flex) es 100dvh menos el teclado:
          // así el input queda pegado justo arriba del teclado, sin hueco.
          height: '100dvh',
          paddingBottom: 'var(--orbi-kb, 0px)',
          zIndex: Z_SHEET,
          background: 'var(--color-bg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'orbi-slide-up 280ms cubic-bezier(.32,.72,0,1)',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* pill de arrastre */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px', flexShrink: 0, touchAction: 'none' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
        </div>

        <OrbiWizardCtx onClose={onClose} />

        <OrbiMessages />

        {context.surface === 'wizard' && context.canAdvance === true && (
          <div aria-live="polite" style={{
            flexShrink: 0, margin: '0 12px 8px', padding: '11px 13px',
            border: '1.5px solid rgba(37,99,235,.3)', background: 'rgba(37,99,235,.05)',
            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--color-body)' }}>
              <strong style={{ color: 'var(--color-text)' }}>Este paso está completo.</strong>
            </span>
            <button
              onClick={avanzar}
              style={{
                font: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 9,
                border: 'none', background: '#2563EB', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Continuar →
            </button>
          </div>
        )}

        {context.surface === 'wizard' && context.canAdvance === false && context.blockReason && (
          <div aria-live="polite" style={{
            flexShrink: 0, margin: '0 12px 8px', padding: '9px 11px',
            fontSize: 11.5, color: '#B45309', background: '#FFFBEB',
            border: '1px solid #FDE68A', borderRadius: 10,
          }}>
            Te falta: {context.blockReason}
          </div>
        )}

        <OrbiInput
          onSend={(m) => send(m, context)}
          disabled={isStreaming}
          quickChips={context.quickChips}
        />
      </div>

      <style>{`
        @keyframes orbi-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes orbi-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          .orbi-sheet { animation: none !important; }
        }
      `}</style>
    </>
  )
}
