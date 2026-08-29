import { Zap, Hand } from 'lucide-react'
import type { TipoDescuento, Aplicacion } from '../types'
import { TIPO_DESCUENTO_LABELS } from '../types'

interface Props {
  nombre: string
  tipo: TipoDescuento | null
  aplicacion: Aplicacion
  fechaInicio: string
  fechaFin: string
  sinVencimiento: boolean
  diasVigencia: number[]
  ilimitadoUsos: boolean
  limiteUsosTotal: string
}

const DIA_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--color-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', textAlign: 'right' }}>
        {value || '-'}
      </span>
    </div>
  )
}

export function ResumenSidebar({
  nombre, tipo, aplicacion,
  fechaInicio, fechaFin, sinVencimiento,
  diasVigencia, ilimitadoUsos, limiteUsosTotal,
}: Props) {
  const tipoLabel = tipo ? TIPO_DESCUENTO_LABELS[tipo] : '-'

  const vigencia = sinVencimiento
    ? 'Sin vencimiento'
    : fechaFin
      ? `${fechaInicio} → ${fechaFin}`
      : fechaInicio || '-'

  const dias = diasVigencia.length === 0
    ? 'Todos los días'
    : diasVigencia.map((d) => DIA_LABELS[d]).join(', ')

  const usos = ilimitadoUsos ? 'Ilimitado' : limiteUsosTotal ? `${limiteUsosTotal} usos max.` : '-'

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--color-muted)',
        }}
      >
        Resumen
      </p>
      <Row label="Nombre" value={nombre || 'Sin nombre'} />
      <Row label="Tipo" value={tipoLabel} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: 12, color: 'var(--color-muted)', flexShrink: 0 }}>Aplicación</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {aplicacion === 'automatico' ? <><Zap size={12} color="var(--color-warning)" /> Automático</> : <><Hand size={12} /> Manual</>}
        </span>
      </div>
      <Row label="Vigencia" value={vigencia} />
      <Row label="Días" value={dias} />
      <div style={{ paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Límite de usos</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)' }}>{usos}</span>
        </div>
      </div>
    </div>
  )
}
