import { useState } from 'react'
import { Search, Package } from 'lucide-react'
import { MontoDisplay } from './MontoDisplay'

export interface ProductoBase {
  id: string
  nombre: string
  sku: string
  precio: number
  stock: number
  tieneVariantes: boolean
}

interface Props {
  productos: ProductoBase[]
  cargando?: boolean
  placeholder?: string
  excluirIds?: string[]
  onSeleccionar: (producto: ProductoBase) => void
}

export function SelectorProducto({
  productos,
  cargando = false,
  placeholder = 'Buscar producto por nombre o SKU...',
  excluirIds = [],
  onSeleccionar,
}: Props) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = productos.filter((p) => {
    if (excluirIds.includes(p.id)) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
        <input
          className="ds-field"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={placeholder}
          autoFocus
          style={{
            width: '100%',
            padding: '9px 12px 9px 32px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
        {cargando ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 56, borderRadius: 8, background: 'var(--color-surface)', animation: 'pulse 1.5s infinite' }} />
          ))
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Package size={28} style={{ opacity: 0.4 }} />
            {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin productos disponibles'}
          </div>
        ) : (
          filtrados.map((p) => (
            <button
              key={p.id}
              className="ds-hover"
              onClick={() => onSeleccionar(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                textAlign: 'left',
                fontFamily: 'inherit',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.nombre}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
                  {p.sku} {p.tieneVariantes && '· con variantes'}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <MontoDisplay monto={p.precio} size="sm" />
                <p style={{ margin: '2px 0 0', fontSize: 11, color: p.stock > 0 ? 'var(--color-muted)' : 'var(--color-error)' }}>
                  {p.stock > 0 ? `${p.stock} en stock` : 'Sin stock'}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
