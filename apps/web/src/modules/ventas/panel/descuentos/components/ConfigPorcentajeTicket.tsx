import { FormField, LabelRow } from './FormField'
import { PresetsValor } from './PresetsValor'
import { Toggle } from '../../../_shared/components/Toggle'
import { sanitizarPorcentaje } from '../utils'

const PRESETS_PORCENTAJE = [10, 20, 30, 50, 70]

interface Props {
  valor: string
  montoMinimo: string
  sinMontoMinimo: boolean
  onChangeValor: (v: string) => void
  onChangeMontoMinimo: (v: string) => void
  onToggleSinMinimo: (v: boolean) => void
  errores?: Record<string, string>
}

export function ConfigPorcentajeTicket({
  valor, montoMinimo, sinMontoMinimo,
  onChangeValor, onChangeMontoMinimo, onToggleSinMinimo,
  errores = {},
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FormField
          label="Porcentaje de descuento"
          suffix="%"
          type="number"
          min="0"
          max="100"
          placeholder="15"
          value={valor}
          onChange={(e) => onChangeValor(sanitizarPorcentaje(e.target.value))}
          mono
          error={errores.valor}
        />
        <PresetsValor valores={PRESETS_PORCENTAJE} valorActual={valor} onSelect={onChangeValor} formatear={(v) => `${v}%`} />
      </div>

      <div>
        <LabelRow
          label="Compra mínima"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Sin mínimo</span>
              <Toggle checked={sinMontoMinimo} onChange={onToggleSinMinimo} />
            </div>
          }
        />
        <FormField
          prefix="$"
          type="number"
          min="0"
          placeholder="20000"
          value={montoMinimo}
          onChange={(e) => onChangeMontoMinimo(e.target.value)}
          disabled={sinMontoMinimo}
          mono
          error={errores.montoMinimo}
        />
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: 'var(--color-primary-bg)',
          border: '1px solid rgba(59,130,246,.15)',
          fontSize: 12,
          color: 'var(--color-primary-h)',
        }}
      >
        El descuento se aplica automáticamente sobre el total del ticket una vez cumplido el mínimo.
      </div>
    </div>
  )
}
