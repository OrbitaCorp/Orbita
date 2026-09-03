import { FormField, LabelRow } from './FormField'
import { Toggle, RangoFechasPicker } from '../../../_shared/components'

const DIAS = [
  { idx: 1, label: 'L' },
  { idx: 2, label: 'Ma' },
  { idx: 3, label: 'Mi' },
  { idx: 4, label: 'J' },
  { idx: 5, label: 'V' },
  { idx: 6, label: 'S' },
  { idx: 0, label: 'D' },
]

interface Props {
  fechaInicio: string
  fechaFin: string
  sinVencimiento: boolean
  diasVigencia: number[]
  todosDias: boolean
  todoElDia: boolean
  horaInicio: string
  horaFin: string
  limiteUsosTotal: string
  ilimitadoUsos: boolean
  onChange: (field: string, value: unknown) => void
  errores?: Record<string, string>
}

export function VigenciaForm({
  fechaInicio, fechaFin, sinVencimiento,
  diasVigencia, todosDias, todoElDia, horaInicio, horaFin,
  limiteUsosTotal, ilimitadoUsos,
  onChange, errores = {},
}: Props) {
  const toggleDia = (idx: number) => {
    const siguiente = diasVigencia.includes(idx)
      ? diasVigencia.filter((d) => d !== idx)
      : [...diasVigencia, idx]
    onChange('diasVigencia', siguiente)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@media (max-width: 768px) { .vf-g2 { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
      {/* Fechas */}
      <div>
        <LabelRow
          label="Vigencia"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Sin vencimiento</span>
              <Toggle checked={sinVencimiento} onChange={(v) => onChange('sinVencimiento', v)} />
            </div>
          }
        />
        <RangoFechasPicker
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          onChangeInicio={(v) => onChange('fechaInicio', v)}
          onChangeFin={(v) => onChange('fechaFin', v)}
          finDeshabilitado={sinVencimiento}
          error={errores.fechaInicio || errores.fechaFin}
        />
        {(errores.fechaInicio || errores.fechaFin) && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--color-error)' }}>
            {errores.fechaInicio || errores.fechaFin}
          </span>
        )}
      </div>

      {/* Días de la semana */}
      <div>
        <LabelRow
          label="Días de la semana"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Todos los días</span>
              <Toggle
                checked={todosDias}
                onChange={(v) => {
                  onChange('todosDias', v)
                  if (v) onChange('diasVigencia', [])
                }}
              />
            </div>
          }
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {DIAS.map(({ idx, label }) => {
            const activo = !todosDias && diasVigencia.includes(idx)
            return (
              <button
                key={idx}
                type="button"
                className="ds-hover"
                disabled={todosDias}
                onClick={() => toggleDia(idx)}
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none',
                  background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                  color: activo ? '#fff' : 'var(--color-muted)',
                  fontSize: 12, fontWeight: 600,
                  cursor: todosDias ? 'not-allowed' : 'pointer',
                  opacity: todosDias ? 0.45 : 1,
                  transition: 'background 150ms ease, color 150ms ease, opacity 150ms ease',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Horario */}
      <div>
        <LabelRow
          label="Horario"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Todo el día</span>
              <Toggle checked={todoElDia} onChange={(v) => onChange('todoElDia', v)} />
            </div>
          }
        />
        <div className="vf-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
          <FormField
            label="Desde"
            type="time"
            value={horaInicio}
            onChange={(e) => onChange('horaInicio', e.target.value)}
            disabled={todoElDia}
            error={errores.horaInicio}
          />
          <FormField
            label="Hasta"
            type="time"
            value={horaFin}
            onChange={(e) => onChange('horaFin', e.target.value)}
            disabled={todoElDia}
            error={errores.horaFin}
          />
        </div>
      </div>

      {/* Límite de usos */}
      <div>
        <LabelRow
          label="Límite de usos totales"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Ilimitado</span>
              <Toggle checked={ilimitadoUsos} onChange={(v) => onChange('ilimitadoUsos', v)} />
            </div>
          }
        />
        <FormField
          type="number"
          min="1"
          placeholder="100"
          value={limiteUsosTotal}
          onChange={(e) => onChange('limiteUsosTotal', e.target.value)}
          disabled={ilimitadoUsos}
          mono
          error={errores.limiteUsosTotal}
        />
      </div>
    </div>
  )
}
