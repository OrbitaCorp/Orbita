import type { MetricasFiltros as MetricasFiltrosType, RangoFechasPreset, CanalMetricas, TipoMetricas } from '../types'
import { DateInput } from '../../../_shared/components'

const RANGOS: { value: RangoFechasPreset; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: 'personalizado', label: 'Personalizado' },
]

const CANALES: { value: CanalMetricas; label: string }[] = [
  { value: 'todos', label: 'Todos los canales' },
  { value: 'pos', label: 'POS' },
  { value: 'storefront', label: 'Storefront' },
]

const TIPOS: { value: TipoMetricas; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'descuentos', label: 'Descuentos' },
  { value: 'cupones', label: 'Cupones' },
]

const selectStyle: React.CSSProperties = {
  height: 34,
  padding: '0 30px 0 10px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  appearance: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
}

interface Props {
  filtros: MetricasFiltrosType
  onChange: (f: Partial<MetricasFiltrosType>) => void
}

export function MetricasFiltros({ filtros, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '12px 18px',
      }}
    >
      {/* Rango de fechas */}
      <select
        className="ds-field"
        value={filtros.rango}
        onChange={(e) => onChange({ rango: e.target.value as RangoFechasPreset })}
        style={selectStyle}
        aria-label="Rango de fechas"
      >
        {RANGOS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {filtros.rango === 'personalizado' && (
        <>
          <DateInput
            value={filtros.fechaDesde ?? ''}
            onChange={(v) => onChange({ fechaDesde: v })}
            style={{ ...selectStyle, padding: '0 10px', backgroundImage: 'none' }}
          />
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>–</span>
          <DateInput
            value={filtros.fechaHasta ?? ''}
            onChange={(v) => onChange({ fechaHasta: v })}
            style={{ ...selectStyle, padding: '0 10px', backgroundImage: 'none' }}
          />
        </>
      )}

      {/* Separador */}
      <div style={{ flex: 1 }} />

      {/* Canal */}
      <select
        className="ds-field"
        value={filtros.canal}
        onChange={(e) => onChange({ canal: e.target.value as CanalMetricas })}
        style={selectStyle}
        aria-label="Canal"
      >
        {CANALES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      {/* Tipo */}
      <select
        className="ds-field"
        value={filtros.tipo}
        onChange={(e) => onChange({ tipo: e.target.value as TipoMetricas })}
        style={selectStyle}
        aria-label="Tipo"
      >
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </div>
  )
}
