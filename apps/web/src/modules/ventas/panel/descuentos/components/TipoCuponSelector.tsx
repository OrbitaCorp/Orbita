import type { TipoCupon } from '../types'

interface TipoCard {
  tipo: TipoCupon
  icono: string
  nombre: string
  desc: string
}

const CARDS: TipoCard[] = [
  { tipo: 'porcentaje', icono: '%', nombre: 'Porcentaje',  desc: 'El cupón aplica un descuento porcentual sobre el total o productos elegidos' },
  { tipo: 'monto_fijo', icono: '$', nombre: 'Monto fijo',  desc: 'El cupón resta un monto fijo del total de la compra' },
]

interface Props {
  tipo: TipoCupon | null
  onChange: (tipo: TipoCupon) => void
  error?: string
}

export function TipoCuponSelector({ tipo, onChange, error }: Props) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {CARDS.map((card) => {
          const activo = tipo === card.tipo
          return (
            <button
              key={card.tipo}
              type="button"
              className="ds-hover"
              onClick={() => onChange(card.tipo)}
              style={{
                textAlign: 'left',
                padding: 20,
                borderRadius: 10,
                border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                cursor: 'pointer',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10, marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                  fontSize: 18, fontWeight: 700,
                  color: activo ? '#fff' : 'var(--color-body)',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                {card.icono}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: activo ? 'var(--color-primary-h)' : 'var(--color-text)', marginBottom: 4 }}>
                {card.nombre}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                {card.desc}
              </div>
            </button>
          )
        })}
      </div>
      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-error)' }}>{error}</p>}
    </div>
  )
}
