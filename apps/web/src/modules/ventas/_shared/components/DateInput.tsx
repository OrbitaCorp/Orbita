import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string // ISO 'YYYY-MM-DD', o '' si está vacío
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  style?: React.CSSProperties
  id?: string
  className?: string
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
}

function isoADisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function digitsAFormato(digits: string): string {
  const d = digits.slice(0, 2)
  const m = digits.slice(2, 4)
  const y = digits.slice(4, 8)
  return [d, m, y].filter(Boolean).join('/')
}

// Input de fecha con máscara DD/MM/AAAA (orden argentino), en reemplazo de
// <input type="date"> cuyo orden de segmentos depende del locale del SO/navegador
// y no puede forzarse de forma confiable con el atributo lang de la página.
export function DateInput({ value, onChange, disabled, placeholder = 'DD/MM/AAAA', style, id, className, onFocus, onBlur }: Props) {
  const [local, setLocal] = useState(() => isoADisplay(value))
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setLocal(isoADisplay(value))
      lastEmitted.current = value
    }
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    setLocal(digitsAFormato(digits))
    if (digits.length === 8) {
      const iso = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`
      lastEmitted.current = iso
      onChange(iso)
    } else if (digits.length === 0) {
      lastEmitted.current = ''
      onChange('')
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      className={className}
      value={local}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={10}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        width: '100%',
        fontFamily: 'inherit',
        fontSize: 14,
        color: 'var(--color-text)',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        ...style,
      }}
    />
  )
}
