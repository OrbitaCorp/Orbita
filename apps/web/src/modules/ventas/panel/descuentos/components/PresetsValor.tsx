interface Props {
  valores: number[]
  valorActual: string
  onSelect: (v: string) => void
  formatear: (v: number) => string
}

// Botones de acceso rápido para el valor del descuento — evita que la
// persona tenga que escribir a mano un porcentaje/monto redondo típico en un
// input numérico incómodo para eso. Los valores los define cada caller según
// el tipo (porcentaje vs monto fijo, producto vs ticket).
export function PresetsValor({ valores, valorActual, onSelect, formatear }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {valores.map((v) => {
        const activo = valorActual === String(v)
        return (
          <button
            key={v}
            type="button"
            className="ds-hover"
            onClick={() => onSelect(String(v))}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: activo ? 'var(--color-primary)' : 'var(--color-bg)',
              color: activo ? '#fff' : 'var(--color-body)',
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: '"Geist Mono", "Fira Code", monospace',
              cursor: 'pointer',
              transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
            }}
          >
            {formatear(v)}
          </button>
        )
      })}
    </div>
  )
}
