import { Zap, Timer } from 'lucide-react'
import type { TipoDescuento, Aplicacion } from '../types'
import { TIPO_DESCUENTO_LABELS } from '../types'

interface PropsTipoDescuento {
  tipo: TipoDescuento
  aplicacion: Aplicacion
}

interface PropsTipoCupon {
  label: string
}

type Props = PropsTipoDescuento | PropsTipoCupon

function esDescuento(p: Props): p is PropsTipoDescuento {
  return 'tipo' in p
}

const badgeBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 22,
  padding: '0 8px',
  borderRadius: 6,
  background: 'var(--color-surface-alt)',
  color: 'var(--color-body)',
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  border: '1px solid var(--color-border)',
}

export function BadgeTipo(props: Props) {
  if (esDescuento(props)) {
    // La oferta relámpago se distingue en ámbar con el reloj: es la única
    // promo que además de descontar se muestra en la portada.
    if (props.tipo === 'oferta_relampago') {
      return (
        <span style={{ ...badgeBase, color: 'var(--color-warning)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)' }}>
          <Timer size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          {TIPO_DESCUENTO_LABELS[props.tipo]}
        </span>
      )
    }
    const esAuto = props.aplicacion === 'automatico'
    return (
      <span style={badgeBase}>
        {esAuto && <Zap size={10} color="var(--color-warning)" style={{ flexShrink: 0 }} />}
        {TIPO_DESCUENTO_LABELS[props.tipo]}
      </span>
    )
  }
  return (
    <span style={badgeBase}>
      {props.label}
    </span>
  )
}
