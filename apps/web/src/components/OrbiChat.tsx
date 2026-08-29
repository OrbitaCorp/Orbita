import { X, Send } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuickAction = {
  label:   string
  onClick: () => void
}

type Props = {
  abierto:         boolean
  onToggle:        () => void
  tooltipVisible?: boolean
  conBarra?:       boolean
  mensaje?:        string
  quickActions?:   QuickAction[]
}

type Msg = { from: 'user' | 'orbi'; text: string }

const RESPUESTA_CANNED = 'Gracias por escribir. Por ahora estoy en modo demo — muy pronto voy a poder responderte con IA en tiempo real 🚀'

// ─── Orbi SVG icon ────────────────────────────────────────────────────────────

function OrbiIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle cx="12" cy="12" r="9.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeDasharray="38 16" strokeLinecap="round"/>
      <circle cx="18.5" cy="5.5" r="2.5" fill="rgba(255,255,255,0.9)"/>
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="typing-dot"
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--color-muted)',
            display: 'inline-block',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── OrbiChat ─────────────────────────────────────────────────────────────────

export function OrbiChat({
  abierto,
  onToggle,
  tooltipVisible = false,
  conBarra       = false,
  mensaje        = '¿En qué te puedo ayudar? Estoy acá para acompañarte 😊',
  quickActions   = [],
}: Props) {
  const [msgs,    setMsgs]    = useState<Msg[]>([])
  const [input,   setInput]   = useState('')
  const [typing,  setTyping]  = useState(false)
  const bodyRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (abierto) inputRef.current?.focus()
  }, [abierto])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [msgs, typing])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setMsgs(prev => [...prev, { from: 'user', text: trimmed }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMsgs(prev => [...prev, { from: 'orbi', text: RESPUESTA_CANNED }])
    }, 1400)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  function handleQuickAction(qa: QuickAction) {
    qa.onClick()
    send(qa.label)
  }

  const showQuickActions = quickActions.length > 0 && msgs.length === 0 && !typing

  return (
    <div style={{
      position:      'fixed',
      bottom:        conBarra ? 100 : 24,
      right:         24,
      zIndex:        200,
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'flex-end',
      gap:           10,
      transition:    'bottom 250ms ease',
    }}>

      {/* ── Panel de chat ── */}
      {abierto && (
        <div style={{
          width:        308,
          background:   'var(--color-bg)',
          border:       '1px solid var(--color-border)',
          borderRadius: 18,
          overflow:     'hidden',
          boxShadow:    '0 16px 48px rgba(0,0,0,0.16)',
          animation:    'fadeUp 0.28s ease forwards',
          display:      'flex',
          flexDirection:'column',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px',
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <OrbiIcon size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Orbi</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 500 }}>En línea</span>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="ds-hover"
              style={{ background: 'none', border: 'none', padding: 4, borderRadius: 6, color: 'var(--color-muted)', display: 'flex' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Cuerpo con scroll */}
          <div
            ref={bodyRef}
            style={{
              padding:    '14px 14px 10px',
              overflowY:  'auto',
              maxHeight:  340,
              display:    'flex',
              flexDirection: 'column',
              gap:        10,
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--color-border) transparent',
            }}
          >
            {/* Mensaje inicial de Orbi */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <OrbiIcon size={14} />
              </div>
              <div style={{
                background:   'var(--color-surface)',
                borderRadius: '4px 14px 14px 14px',
                padding:      '9px 12px',
                fontSize:     13,
                color:        'var(--color-body)',
                lineHeight:   1.55,
                maxWidth:     '85%',
              }}>
                Hola! 👋 Soy <strong style={{ color: 'var(--color-text)' }}>Orbi</strong>, el asistente de Órbita.
                <br /><br />
                {mensaje}
              </div>
            </div>

            {/* Quick actions (solo antes de escribir) */}
            {showQuickActions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 32 }}>
                {quickActions.map((qa, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(qa)}
                    style={{
                      textAlign:    'left',
                      padding:      '8px 11px',
                      borderRadius: 10,
                      border:       '1px solid var(--color-border)',
                      background:   'transparent',
                      color:        'var(--color-body)',
                      fontSize:     12,
                      cursor:       'pointer',
                      fontWeight:   500,
                      transition:   'all 150ms',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background  = 'var(--color-primary-bg)'
                      e.currentTarget.style.borderColor = 'var(--color-primary)'
                      e.currentTarget.style.color       = 'var(--color-primary)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background  = 'transparent'
                      e.currentTarget.style.borderColor = 'var(--color-border)'
                      e.currentTarget.style.color       = 'var(--color-body)'
                    }}
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Historial de mensajes */}
            {msgs.map((m, i) =>
              m.from === 'user' ? (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background:   '#2563EB',
                    borderRadius: '14px 4px 14px 14px',
                    padding:      '9px 12px',
                    fontSize:     13,
                    color:        'white',
                    lineHeight:   1.5,
                    maxWidth:     '80%',
                    wordBreak:    'break-word',
                  }}>
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <OrbiIcon size={14} />
                  </div>
                  <div style={{
                    background:   'var(--color-surface)',
                    borderRadius: '4px 14px 14px 14px',
                    padding:      '9px 12px',
                    fontSize:     13,
                    color:        'var(--color-body)',
                    lineHeight:   1.55,
                    maxWidth:     '85%',
                    wordBreak:    'break-word',
                  }}>
                    {m.text}
                  </div>
                </div>
              )
            )}

            {/* Typing indicator */}
            {typing && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <OrbiIcon size={14} />
                </div>
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '4px 14px 14px 14px',
                  padding: '9px 12px',
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            padding:      '10px 12px',
            borderTop:    '1px solid var(--color-border)',
            background:   'var(--color-surface)',
            flexShrink:   0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribí tu mensaje..."
              disabled={typing}
              className="ds-field"
              style={{
                flex:         1,
                padding:      '8px 12px',
                borderRadius: 20,
                border:       '1.5px solid var(--color-border)',
                background:   'var(--color-bg)',
                color:        'var(--color-text)',
                fontSize:     13,
                outline:      'none',
                fontFamily:   'inherit',
                transition:   'border-color 150ms',
                opacity:      typing ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || typing}
              className="ds-hover"
              style={{
                width:        34, height: 34, borderRadius: '50%', flexShrink: 0,
                border:       'none',
                background:   input.trim() && !typing ? '#2563EB' : 'var(--color-surface-alt)',
                color:        input.trim() && !typing ? 'white'   : 'var(--color-subtle)',
                display:      'flex', alignItems: 'center', justifyContent: 'center',
                transition:   'all 150ms',
              }}
            >
              <Send size={15} />
            </button>
          </div>

          {/* Footer */}
          <div style={{
            padding:   '6px 14px',
            borderTop: '1px solid var(--color-border)',
            fontSize:  10,
            color:     'var(--color-subtle)',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            Powered by <strong>Órbita AI</strong>
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      {!abierto && tooltipVisible && (
        <div style={{
          background:   'var(--color-bg)',
          border:       '1px solid var(--color-border)',
          borderRadius: 10,
          padding:      '8px 12px',
          fontSize:     12, fontWeight: 500,
          color:        'var(--color-body)',
          whiteSpace:   'nowrap',
          boxShadow:    '0 2px 12px rgba(0,0,0,0.1)',
          animation:    'fadeUp 0.3s ease forwards',
        }}>
          Haceme click si necesitás ayuda 👋
        </div>
      )}

      {/* ── Botón ── */}
      <button
        onClick={onToggle}
        aria-label="Abrir Orbi"
        className="ds-hover"
        style={{
          width:        52, height: 52,
          borderRadius: '50%',
          border:       'none',
          color:        'white', // para que el velo de ds-hover aclare sobre el gradiente
          background:   'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
          boxShadow:    '0 4px 20px rgba(59,130,246,0.45)',
          display:      'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <OrbiIcon size={28} />
      </button>
    </div>
  )
}
