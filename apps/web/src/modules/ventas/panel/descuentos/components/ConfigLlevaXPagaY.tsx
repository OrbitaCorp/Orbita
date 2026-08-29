import { FormField } from './FormField'
import { SelectorProductoOCategoria } from './SelectorProductoOCategoria'
import type { AlcanceDescuento } from '../types'

interface Props {
  llevaCantidad: string
  pagaCantidad: string
  alcance: AlcanceDescuento
  productosIds: string[]
  categoriasIds: string[]
  onChangeLleva: (v: string) => void
  onChangePaga: (v: string) => void
  onChangeAlcance: (a: AlcanceDescuento) => void
  onChangeProductos: (ids: string[]) => void
  onChangeCategorias: (ids: string[]) => void
  errores?: Record<string, string>
}

export function ConfigLlevaXPagaY({
  llevaCantidad, pagaCantidad,
  alcance, productosIds, categoriasIds,
  onChangeLleva, onChangePaga,
  onChangeAlcance, onChangeProductos, onChangeCategorias,
  errores = {},
}: Props) {
  const lleva = parseInt(llevaCantidad, 10) || 0
  const paga = parseInt(pagaCantidad, 10) || 0
  const ahorroItems = Math.max(0, lleva - paga)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dcto-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField
          label="Llevá (cantidad total)"
          type="number"
          min="2"
          placeholder="3"
          value={llevaCantidad}
          onChange={(e) => onChangeLleva(e.target.value)}
          mono
          error={errores.llevaCantidad}
        />
        <FormField
          label="Pagá (cantidad cobrada)"
          type="number"
          min="1"
          placeholder="2"
          value={pagaCantidad}
          onChange={(e) => onChangePaga(e.target.value)}
          mono
          error={errores.pagaCantidad}
        />
      </div>

      {ahorroItems > 0 && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'var(--color-success-bg)',
            border: '1px solid rgba(16,185,129,.15)',
            fontSize: 12,
            color: 'var(--color-success)',
          }}
        >
          El cliente paga {paga} unidad{paga !== 1 ? 'es' : ''} y se lleva {lleva}, ahorra{' '}
          <strong>{ahorroItems} unidad{ahorroItems !== 1 ? 'es' : ''}</strong> gratis.
        </div>
      )}

      {errores.cantidades && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>{errores.cantidades}</p>
      )}

      <SelectorProductoOCategoria
        alcance={alcance}
        productosIds={productosIds}
        categoriasIds={categoriasIds}
        onChangeAlcance={onChangeAlcance}
        onChangeProductos={onChangeProductos}
        onChangeCategorias={onChangeCategorias}
        label="¿A qué productos aplica?"
        error={errores.seleccion}
      />
    </div>
  )
}
