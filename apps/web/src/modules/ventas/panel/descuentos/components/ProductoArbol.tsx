import { useState } from 'react'
import { ChevronRight, ChevronDown, Check } from 'lucide-react'
import { SearchInput } from '../../../_shared/components'
import { useCategoriasDescuento, useProductosPorCategoria, useBuscarProductosDescuento } from '../hooks/useCatalogoDescuento'
import type { ApiProductRow, ApiCategory } from '@/lib/api'

interface Props {
  productosIds: string[]
  onChange: (ids: string[]) => void
}

function CheckBox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange() }}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
        border: checked || indeterminate ? 'none' : '1.5px solid var(--color-border-strong)',
        background: checked || indeterminate ? 'var(--color-primary)' : 'var(--color-bg)',
        display: 'grid', placeItems: 'center', padding: 0, transition: 'background 150ms ease',
      }}
    >
      {checked && <Check size={10} color="#fff" strokeWidth={3} />}
      {indeterminate && !checked && (
        <div style={{ width: 8, height: 2, borderRadius: 1, background: '#fff' }} />
      )}
    </button>
  )
}

function FilaProducto({ producto, checked, onToggle }: {
  producto: ApiProductRow; checked: boolean; onToggle: () => void
}) {
  return (
    <div
      className="ds-hover"
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 36px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
    >
      <CheckBox checked={checked} onChange={onToggle} />
      <span style={{ fontSize: 13, color: 'var(--color-body)', flex: 1 }}>{producto.name}</span>
    </div>
  )
}

function CategoriaNode({ cat, expanded, selected, onToggleExpand, onToggleProducto, onToggleCategoriaSelect }: {
  cat: ApiCategory
  expanded: boolean
  selected: Set<string>
  onToggleExpand: () => void
  onToggleProducto: (id: string) => void
  onToggleCategoriaSelect: (productos: ApiProductRow[]) => void
}) {
  const { data, isLoading } = useProductosPorCategoria(cat.id, expanded)
  const productos = data?.productos ?? []
  const seleccionados = productos.filter((p) => selected.has(p.id)).length

  const catState: 'none' | 'some' | 'all' =
    !expanded || productos.length === 0 || seleccionados === 0
      ? 'none'
      : seleccionados === productos.length ? 'all' : 'some'

  const handleCheckboxClick = () => {
    if (!expanded) onToggleExpand()
    else onToggleCategoriaSelect(productos)
  }

  return (
    <div>
      <div
        className="ds-hover"
        onClick={onToggleExpand}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
        }}
      >
        {expanded ? <ChevronDown size={14} color="var(--color-muted)" /> : <ChevronRight size={14} color="var(--color-muted)" />}
        <CheckBox checked={catState === 'all'} indeterminate={catState === 'some'} onChange={handleCheckboxClick} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>{cat.name}</span>
      </div>
      {expanded && (
        isLoading ? (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1, 2].map((i) => <div key={i} style={{ height: 24, borderRadius: 6, background: 'var(--color-surface-alt)' }} />)}
          </div>
        ) : productos.length === 0 ? (
          <p style={{ margin: 0, padding: '10px 12px 10px 36px', fontSize: 12, color: 'var(--color-muted)' }}>
            Sin productos publicados en esta categoría.
          </p>
        ) : (
          <>
            {productos.map((p) => (
              <FilaProducto key={p.id} producto={p} checked={selected.has(p.id)} onToggle={() => onToggleProducto(p.id)} />
            ))}
            {data && data.total > productos.length && (
              <p style={{ margin: 0, padding: '6px 12px 6px 36px', fontSize: 11, color: 'var(--color-muted)' }}>
                Mostrando los primeros {productos.length} de {data.total} — usá el buscador para encontrar el resto.
              </p>
            )}
          </>
        )
      )}
    </div>
  )
}

export function ProductoArbol({ productosIds, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const selected = new Set(productosIds)

  const { data: categorias, isLoading: cargandoCategorias } = useCategoriasDescuento()
  const { data: resultado, isLoading: buscando } = useBuscarProductosDescuento(query)

  const toggleExpand = (catId: string) => {
    setExpandedCats((prev) => {
      const s = new Set(prev)
      s.has(catId) ? s.delete(catId) : s.add(catId)
      return s
    })
  }

  const toggleProducto = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange([...next])
  }

  const toggleCategoriaSelect = (productos: ApiProductRow[]) => {
    const todosMarcados = productos.length > 0 && productos.every((p) => selected.has(p.id))
    const next = new Set(selected)
    productos.forEach((p) => (todosMarcados ? next.delete(p.id) : next.add(p.id)))
    onChange([...next])
  }

  const hayBusqueda = query.trim().length > 0

  let grupos: Array<[string, ApiProductRow[]]> = []
  if (hayBusqueda && resultado) {
    const mapa = new Map<string, ApiProductRow[]>()
    for (const p of resultado.productos) {
      const key = p.categoryName ?? 'Sin categoría'
      if (!mapa.has(key)) mapa.set(key, [])
      mapa.get(key)!.push(p)
    }
    grupos = [...mapa.entries()]
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar producto…" />
      </div>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
        {hayBusqueda ? (
          buscando ? (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 24, borderRadius: 6, background: 'var(--color-surface-alt)' }} />)}
            </div>
          ) : grupos.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
              Sin resultados para "{query}"
            </div>
          ) : (
            <>
              {grupos.map(([nombreCat, productos]) => (
                <div key={nombreCat}>
                  <div style={{ padding: '9px 12px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                    {nombreCat}
                  </div>
                  {productos.map((p) => (
                    <FilaProducto key={p.id} producto={p} checked={selected.has(p.id)} onToggle={() => toggleProducto(p.id)} />
                  ))}
                </div>
              ))}
              {resultado && resultado.total > resultado.productos.length && (
                <p style={{ margin: 0, padding: '6px 12px', fontSize: 11, color: 'var(--color-muted)' }}>
                  Mostrando los primeros {resultado.productos.length} de {resultado.total} — refiná la búsqueda para encontrar el resto.
                </p>
              )}
            </>
          )
        ) : cargandoCategorias ? (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1, 2, 3].map((i) => <div key={i} style={{ height: 32, borderRadius: 6, background: 'var(--color-surface-alt)' }} />)}
          </div>
        ) : !categorias?.length ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
            Todavía no creaste categorías en el catálogo.
          </div>
        ) : (
          categorias.map((cat) => (
            <CategoriaNode
              key={cat.id}
              cat={cat}
              expanded={expandedCats.has(cat.id)}
              selected={selected}
              onToggleExpand={() => toggleExpand(cat.id)}
              onToggleProducto={toggleProducto}
              onToggleCategoriaSelect={toggleCategoriaSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
