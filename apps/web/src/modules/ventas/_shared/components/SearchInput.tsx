import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounce?: number
  autoFocus?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  debounce = 300,
  autoFocus,
}: Props) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), debounce)
  }

  const clear = () => {
    setLocal('')
    onChange('')
    if (timer.current) clearTimeout(timer.current)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <Search
        size={15}
        style={{
          position: 'absolute',
          left: 10,
          color: 'var(--color-muted)',
          pointerEvents: 'none',
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        className="ds-field"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          padding: '8px 32px 8px 33px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
      />
      {local && (
        <button
          className="ds-hover"
          onClick={clear}
          style={{
            position: 'absolute',
            right: 8,
            background: 'none',
            border: 'none',
            color: 'var(--color-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: 2,
            borderRadius: 4,
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
