import { useState } from 'react'
import { Folder, Check } from 'lucide-react'
import { useCategoriasDescuento, useProductosPorIds } from '../hooks/useCatalogoDescuento'
import type { Descuento } from '../types'

const MAX_VISIBLE = 5

interface Props { descuento: Descuento }

export function DetalleProductos({ descuento }: Props) {
  const [expandido, setExpandido] = useState(false)
  const { data: categorias } = useCategoriasDescuento()
  // Solo se piden los productos si el alcance es 'producto' — evita llamadas
  // de más cuando el descuento aplica a categoría o a ticket completo.
  const { productos, isLoading: cargandoProductos } = useProductosPorIds(
    descuento.alcance === 'producto' ? descuento.productosIds ?? [] : []
  )

  if (descuento.alcance === 'ticket') {
    return (
      <SectionWrap>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
          Aplica al ticket completo — sin restricción de productos.
        </p>
      </SectionWrap>
    )
  }

  if (descuento.alcance === 'categoria') {
    const cats = (categorias ?? []).filter((c) => descuento.categoriasIds?.includes(c.id))
    return (
      <SectionWrap>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cats.map((c) => (
            <span
              key={c.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px',
                borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'var(--color-primary-bg)', color: 'var(--color-primary-h)',
                border: '1px solid rgba(59,130,246,.2)',
              }}
            >
              <Folder size={13} />
              {c.name}
            </span>
          ))}
          {cats.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Sin categorías seleccionadas</p>}
        </div>
      </SectionWrap>
    )
  }

  // alcance === 'producto'
  if (cargandoProductos) {
    return (
      <SectionWrap>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 24, borderRadius: 6, background: 'var(--color-surface-alt)' }} />)}
        </div>
      </SectionWrap>
    )
  }

  const visibles = expandido ? productos : productos.slice(0, MAX_VISIBLE)

  return (
    <SectionWrap>
      {productos.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Sin productos seleccionados</p>
      )}
      {visibles.map((p, pi) => (
        <div
          key={p.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
            borderBottom: pi < visibles.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}
        >
          <Check size={13} color="var(--color-success)" />
          <span style={{ fontSize: 13, color: 'var(--color-body)', flex: 1 }}>{p.name}</span>
        </div>
      ))}
      {productos.length > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          style={{
            marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 13, color: 'var(--color-primary)', fontFamily: 'inherit',
          }}
        >
          {expandido ? 'Ver menos' : `Ver todos (${productos.length} productos)`}
        </button>
      )}
    </SectionWrap>
  )
}

function SectionWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
      <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>
        Productos afectados
      </p>
      {children}
    </div>
  )
}
