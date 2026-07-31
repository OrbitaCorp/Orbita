import { Check } from 'lucide-react'
import { useCategoriasDescuento } from '../hooks/useCatalogoDescuento'

interface Props {
  categoriasIds: string[]
  onChange: (ids: string[]) => void
}

function CheckBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange() }}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
        border: checked ? 'none' : '1.5px solid var(--color-border-strong)',
        background: checked ? 'var(--color-primary)' : 'var(--color-bg)',
        display: 'grid', placeItems: 'center', padding: 0, transition: 'background 150ms ease',
      }}
    >
      {checked && <Check size={10} color="#fff" strokeWidth={3} />}
    </button>
  )
}

export function CategoriaLista({ categoriasIds, onChange }: Props) {
  const { data: categorias, isLoading } = useCategoriasDescuento()
  const selected = new Set(categoriasIds)

  const toggle = (catId: string) => {
    const next = new Set(selected)
    next.has(catId) ? next.delete(catId) : next.add(catId)
    onChange([...next])
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 40, borderRadius: 8, background: 'var(--color-surface-alt)' }} />
        ))}
      </div>
    )
  }

  if (!categorias?.length) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
        Todavía no creaste categorías en el catálogo.
      </p>
    )
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
      {categorias.map((cat, i) => {
        const checked = selected.has(cat.id)
        return (
          <div
            key={cat.id}
            onClick={() => toggle(cat.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: i < categorias.length - 1 ? '1px solid var(--color-border)' : 'none',
              background: checked ? 'var(--color-primary-bg)' : 'var(--color-bg)',
              cursor: 'pointer',
              transition: 'background 120ms ease',
            }}
          >
            <CheckBox checked={checked} onChange={() => toggle(cat.id)} />
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                color: checked ? 'var(--color-primary-h)' : 'var(--color-text)',
              }}
            >
              {cat.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
