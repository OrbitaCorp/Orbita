import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
}

export function OrbiInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div style={{
      padding: '12px',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 6px 6px 14px',
        borderRadius: 999,
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Escribí un mensaje..."
          disabled={disabled}
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: text.trim() && !disabled ? '#3B82F6' : 'var(--color-border)',
            border: 'none', cursor: text.trim() && !disabled ? 'pointer' : 'default',
            display: 'grid', placeItems: 'center',
            transition: 'background 200ms',
            flexShrink: 0,
          }}
        >
          <Send size={14} strokeWidth={2} color="white" style={{ marginLeft: 1 }} />
        </button>
      </div>
    </div>
  )
}
