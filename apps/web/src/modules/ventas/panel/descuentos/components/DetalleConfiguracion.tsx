import { Zap, Hand } from 'lucide-react'
import type { Descuento } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'

function fmt(n: number) {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`
}

function DataRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 12,
        padding: '9px 0',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.5 }}>
        {value}
      </span>
    </div>
  )
}

function getRows(d: Descuento): [string, string][] {
  const minimo = d.condicion?.montoMinimo ? fmt(d.condicion.montoMinimo) : 'Sin mínimo'
  switch (d.tipo) {
    case 'porcentaje_producto':
      return [['Tipo', '% Producto'], ['Porcentaje', `${d.valor}%`], ['Alcance', d.alcanceResumen]]
    case 'monto_fijo_producto':
      return [['Tipo', '$ Fijo Producto'], ['Monto', fmt(d.valor)], ['Alcance', d.alcanceResumen]]
    case 'porcentaje_ticket':
      return [['Tipo', '% Ticket'], ['Porcentaje', `${d.valor}%`], ['Compra mínima', minimo]]
    case 'monto_fijo_ticket':
      return [['Tipo', '$ Fijo Ticket'], ['Monto', fmt(d.valor)], ['Compra mínima', minimo]]
    case 'lleva_x_paga_y':
      return [
        ['Tipo', 'Llevá X, Pagá Y'],
        ['Cantidad a llevar', String(d.condicion?.llevaCantidad ?? '-')],
        ['Cantidad a pagar', String(d.condicion?.pagaCantidad ?? '-')],
        ['Regla', 'Se descuenta el de menor precio'],
      ]
    case 'compra_x_obtiene_z': {
      const beneficio =
        d.bonusTipoBeneficio === 'gratis' ? 'Producto gratis' :
        d.bonusTipoBeneficio === 'porcentaje' ? `${d.bonusValor}% de descuento` :
        fmt(d.bonusValor ?? 0)
      return [
        ['Tipo', 'Comprá X, Obtené Z'],
        ['Cantidad mínima', String(d.condicion?.cantidadMinima ?? '1')],
        ['Beneficio', beneficio],
        ['Alcance bonus', d.bonusAlcance ?? '-'],
      ]
    }
    case 'volumen': {
      const escalas = d.condicion?.escalasVolumen ?? []
      const str = escalas.length
        ? escalas.map((e) => `${e.desde}${e.hasta != null ? `–${e.hasta}` : '+'} uds: ${e.porcentaje}%`).join(' · ')
        : '-'
      return [['Tipo', 'Descuento por volumen'], ['Escalas', str]]
    }
  }
}

interface Props { descuento: Descuento }

export function DetalleConfiguracion({ descuento }: Props) {
  const rows = getRows(descuento)
  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 24,
      }}
    >
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-muted)',
        }}
      >
        Configuración
      </p>
      {rows.map(([label, value], i) => (
        <DataRow key={label} label={label} value={value} last={i === rows.length - 1} />
      ))}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr',
          gap: 12,
          padding: '9px 0',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Aplicación</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {descuento.aplicacion === 'automatico'
            ? <><Zap size={13} color="var(--color-warning)" /> Automático</>
            : <><Hand size={13} /> Manual</>}
        </span>
      </div>
    </div>
  )
}

export { fmt, MONO }
