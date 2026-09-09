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

  // Scroll lock del fondo. Nada de `position: fixed` en el body — en iOS pelea
  // con el teclado y termina desplazando el sheet. El sheet es un overlay opaco
  // a pantalla completa (z altísimo), así que con `overflow: hidden` alcanza:
  // aunque el fondo rebote un poco, no se ve.
  useEffect(() => {
    const de = document.documentElement
    const body = document.body
    const prev = { de: de.style.overflow, body: body.style.overflow }
    de.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      de.style.overflow = prev.de
      body.style.overflow = prev.body
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
      {/* Fondo OPACO, no translúcido: el sheet llega hasta el borde del visual
          viewport, pero abajo queda la franja de la barra de Safari (y el
          desfasaje del teclado) donde se veía asomar el wizard. Con el fondo
          del tema tapando toda la pantalla, ese hueco deja de existir pase lo
          que pase con la aritmética del viewport. */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: Z_BACKDROP, background: 'var(--color-bg)', animation: 'orbi-fade-in 200ms ease-out' }}
      />

      <div
        ref={sheetRef}
        className="orbi-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Orbi asistente"
        style={{
          // Anclado al VISUAL VIEWPORT en píxeles (ver useOrbiViewport): top y
          // height los maneja JS en cada evento del teclado. Así el sheet ocupa
          // exactamente lo que se ve arriba del teclado, y si iOS lo scrollea al
          // enfocar el input, la próxima medición lo devuelve a su lugar.
          position: 'fixed',
          left: 0,
          right: 0,
          top: 'var(--orbi-vv-top, 0px)',
          height: 'var(--orbi-vv-h, 100dvh)',
          // Suaviza el reacomodo cuando sube/baja el teclado, para que no se
          // vea un salto seco (iOS avisa del resize de golpe, no gradual).
          transition: 'top 160ms ease-out, height 160ms ease-out',
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
        {/* pill de arrastre — se esconde con el teclado abierto (no se puede
            arrastrar mientras escribís, y son 14px que le sirven al chat). */}
        <div className="orbi-hide-kb" style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px', flexShrink: 0, touchAction: 'none' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
        </div>

        <OrbiWizardCtx onClose={onClose} />

        <OrbiMessages />

        {context.surface === 'wizard' && context.canAdvance === true && (
          <div aria-live="polite" className="orbi-compact-kb" style={{
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

        {/* Acá iba un aviso ámbar "Te falta: X". Se sacó: aparecía apenas
            abrías el chat, antes de que hicieras nada, y lo único que hacía era
            comerse alto y retar al usuario de entrada. Lo que falta ya lo dice
            Orbi en la conversación, y el footer real del wizard lo repite al
            lado del botón. Cuando el paso SÍ está completo se sigue mostrando
            la tarjeta de "Continuar", que es la que aporta. */}

        <OrbiInput
          onSend={(m) => send(m, context)}
          disabled={isStreaming}
          quickChips={context.quickChips}
        />
      </div>

      <style>{`
        @keyframes orbi-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes orbi-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }

        /* Con el teclado abierto el alto útil se parte casi al medio: se
           esconden las filas de chips y el pill, y se achican los avisos, para
           que lo que quede sea el CHAT y no el cromo alrededor. */
        html[data-orbi-kb="1"] .orbi-hide-kb { display: none !important; }
        html[data-orbi-kb="1"] .orbi-ctx-row { padding: 7px 16px !important; }
        html[data-orbi-kb="1"] .orbi-compact-kb {
          margin-bottom: 6px !important;
          padding-top: 7px !important;
          padding-bottom: 7px !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .orbi-sheet { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  )
}
