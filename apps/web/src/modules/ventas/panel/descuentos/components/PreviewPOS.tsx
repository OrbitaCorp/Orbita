import { Zap } from 'lucide-react'
import type { TipoDescuento, Aplicacion } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'

interface Props {
  nombre: string
  tipo: TipoDescuento | null
  aplicacion: Aplicacion
  valor: string
  llevaCantidad?: string
  pagaCantidad?: string
  montoMinimo?: string
}

function PriceLine({ label, price, descuento }: { label: string; price: string; descuento?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed var(--color-border)' }}>
      <span style={{ fontSize: 13, color: descuento ? 'var(--color-success)' : 'var(--color-body)' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: descuento ? 'var(--color-success)' : 'var(--color-text)' }}>
        {descuento ? '-' : ''}{price}
      </span>
    </div>
  )
}

function PreviewContent({ tipo, valor, llevaCantidad, pagaCantidad, montoMinimo }: Omit<Props, 'nombre' | 'aplicacion'>) {
  const pct = parseFloat(valor) || 0
  const monto = parseFloat(valor) || 0
  const llevaNum = parseInt(llevaCantidad ?? '', 10) || 2
  const pagaNum = parseInt(pagaCantidad ?? '', 10) || 1
  const minNum = parseFloat(montoMinimo ?? '0') || 0

  if (!tipo) {
    return (
      <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 12, margin: '16px 0' }}>
        Seleccioná un tipo para ver el preview
      </p>
    )
  }

  if (tipo === 'porcentaje_producto' || tipo === 'porcentaje_ticket') {
    const base = tipo === 'porcentaje_ticket' ? 45000 : 8990
    const desc = Math.round(base * (pct / 100))
    return (
      <>
        <PriceLine label="Subtotal" price={`$${base.toLocaleString('es-AR')}`} />
        <PriceLine label={`Descuento ${pct || '?'}%`} price={`$${(desc || 0).toLocaleString('es-AR')}`} descuento />
        <PriceLine label="Total" price={`$${(base - desc).toLocaleString('es-AR')}`} />
      </>
    )
  }

  if (tipo === 'monto_fijo_producto' || tipo === 'monto_fijo_ticket') {
    const base = tipo === 'monto_fijo_ticket' ? 45000 : 8990
    return (
      <>
        {minNum > 0 && <PriceLine label={`Mínimo: $${minNum.toLocaleString('es-AR')}`} price="" />}
        <PriceLine label="Subtotal" price={`$${base.toLocaleString('es-AR')}`} />
        <PriceLine label={`Descuento fijo`} price={`$${monto.toLocaleString('es-AR')}`} descuento />
        <PriceLine label="Total" price={`$${Math.max(0, base - monto).toLocaleString('es-AR')}`} />
      </>
    )
  }

  if (tipo === 'lleva_x_paga_y') {
    return (
      <>
        <div style={{ padding: '8px 0', borderBottom: '1px dashed var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--color-body)' }}>Remera básica × {llevaCantidad || '?'}</span>
            <span style={{ fontFamily: MONO, fontSize: 13 }}>× {llevaNum}</span>
          </div>
        </div>
        <PriceLine label={`Pagás ${pagaNum} un.`} price={`$${(pagaNum * 8990).toLocaleString('es-AR')}`} />
        <PriceLine label={`${llevaNum - pagaNum} gratis`} price={`$${((llevaNum - pagaNum) * 8990).toLocaleString('es-AR')}`} descuento />
        <PriceLine label="Total" price={`$${(pagaNum * 8990).toLocaleString('es-AR')}`} />
      </>
    )
  }

  if (tipo === 'compra_x_obtiene_z') {
    return (
      <>
        <PriceLine label="Producto A" price="$32.990" />
        <PriceLine label="Producto bonus" price="$8.990" descuento />
        <PriceLine label="Total" price="$32.990" />
      </>
    )
  }

  if (tipo === 'volumen') {
    return (
      <>
        <div style={{ padding: '6px 0', borderBottom: '1px dashed var(--color-border)', fontSize: 12, color: 'var(--color-muted)' }}>
          Escala activa: {pct || '?'}% descuento
        </div>
        <PriceLine label="3 × Remera básica" price="$26.970" />
        <PriceLine label={`Descuento ${pct || '?'}%`} price={`$${Math.round(26970 * (pct / 100)).toLocaleString('es-AR')}`} descuento />
        <PriceLine label="Total" price={`$${Math.round(26970 * (1 - pct / 100)).toLocaleString('es-AR')}`} />
      </>
    )
  }

  return null
}

export function PreviewPOS({ nombre, tipo, aplicacion, valor, llevaCantidad, pagaCantidad, montoMinimo }: Props) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-muted)' }}>
          Preview
        </p>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {aplicacion === 'automatico' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,.2)' }}>
            <Zap size={12} color="var(--color-warning)" />
            <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>Se aplica automáticamente</span>
          </div>
        )}
        {nombre && (
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{nombre}</p>
        )}
        <PreviewContent
          tipo={tipo}
          valor={valor}
          llevaCantidad={llevaCantidad}
          pagaCantidad={pagaCantidad}
          montoMinimo={montoMinimo}
        />
      </div>
    </div>
  )
}
