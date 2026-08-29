interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function Toggle({ checked, onChange, size = 'sm', disabled }: Props) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 20 : 24
  const dot = size === 'sm' ? 14 : 18
  return (
    <button
      type="button"
      className="ds-hover"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: w,
        height: h,
        borderRadius: 9999,
        padding: 3,
        background: checked ? 'var(--color-primary)' : 'var(--color-border-strong)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 150ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'all 150ms ease',
        }}
      />
    </button>
  )
}
