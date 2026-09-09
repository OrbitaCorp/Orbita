import { useState, useRef, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
  quickChips?: string[]
}

const MAX_H = 96 // ~4 líneas

export function OrbiInput({ onSend, disabled, quickChips }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // OrbiPanel/OrbiBottomSheet desmontan este componente al cerrarse, así que
  // este mount ES "el panel se acaba de abrir": enfocamos para poder escribir.
  useEffect(() => { inputRef.current?.focus() }, [])

  const autoGrow = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`
  }, [])

  useEffect(() => { autoGrow() }, [text, autoGrow])

  const handleSend = (value?: string) => {
    const trimmed = (value ?? text).trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    requestAnimationFrame(autoGrow)
    inputRef.current?.focus()
  }

  return (
    <div className="orbi-input-area" style={{
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      padding: '8px 12px',
    }}>
      {/* orbi-hide-kb: se esconde con el teclado abierto para darle alto al chat. */}
      {quickChips && quickChips.length > 0 && (
        <div className="orbi-hide-kb" style={{
          display: 'flex', gap: 7, overflowX: 'auto', padding: '2px 0 9px',
          scrollbarWidth: 'none',
        }}>
          {quickChips.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSend(chip)}
              disabled={disabled}
              style={{
                flexShrink: 0, font: 'inherit', fontSize: 12, fontWeight: 600,
                padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: '#3B82F6', cursor: disabled ? 'default' : 'pointer',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '5px 5px 5px 14px',
        borderRadius: 22,
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder="Escribí un mensaje..."
          disabled={disabled}
          aria-label="Mensaje para Orbi"
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            resize: 'none', fontFamily: 'inherit',
            // 16px es OBLIGATORIO: con menos, iOS Safari hace zoom al enfocar.
            fontSize: 16, lineHeight: 1.35, color: 'var(--color-text)',
            maxHeight: MAX_H, padding: '8px 0',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={disabled || !text.trim()}
          aria-label="Enviar"
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: text.trim() && !disabled ? '#3B82F6' : 'var(--color-border)',
            border: 'none', cursor: text.trim() && !disabled ? 'pointer' : 'default',
            display: 'grid', placeItems: 'center', transition: 'background 200ms',
          }}
        >
          <Send size={15} strokeWidth={2} color="white" style={{ marginLeft: 1 }} />
        </button>
      </div>
    </div>
  )
}
