import { FormField } from './FormField'
import type { BonusTipoBeneficio } from '../types'

const OPCIONES: { valor: BonusTipoBeneficio; label: string }[] = [
  { valor: 'gratis',     label: 'Gratis' },
  { valor: 'porcentaje', label: 'Descuento %' },
  { valor: 'monto_fijo', label: 'Descuento $' },
]

interface Props {
  tipo: BonusTipoBeneficio
  valor: string
  onChangeTipo: (t: BonusTipoBeneficio) => void
  onChangeValor: (v: string) => void
  errorValor?: string
}

export function BeneficioBonusSelector({ tipo, valor, onChangeTipo, onChangeValor, errorValor }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {OPCIONES.map((op, i) => (
          <button
            key={op.valor}
            type="button"
            className="ds-hover"
            onClick={() => onChangeTipo(op.valor)}
            style={{
              flex: 1,
              height: 36,
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
              background: tipo === op.valor ? 'var(--color-primary)' : 'var(--color-bg)',
              color: tipo === op.valor ? '#fff' : 'var(--color-body)',
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >
            {op.label}
          </button>
        ))}
      </div>

      {tipo !== 'gratis' && (
        <FormField
          label={tipo === 'porcentaje' ? 'Porcentaje de descuento' : 'Monto de descuento'}
          prefix={tipo === 'porcentaje' ? undefined : '$'}
          suffix={tipo === 'porcentaje' ? '%' : undefined}
          type="number"
          min="0"
          max={tipo === 'porcentaje' ? '100' : undefined}
          placeholder={tipo === 'porcentaje' ? '10' : '5000'}
          value={valor}
          onChange={(e) => onChangeValor(e.target.value)}
          mono
          error={errorValor}
        />
      )}
    </div>
  )
}
