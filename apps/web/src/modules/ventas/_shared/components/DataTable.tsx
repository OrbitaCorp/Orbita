import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface ColumnaTabla<T> {
  key: string
  header: string
  width?: string | number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  render: (row: T, index: number) => React.ReactNode
}

type Direccion = 'asc' | 'desc'

interface Paginacion {
  pagina: number
  porPagina: number
  total: number
  onCambiar: (pagina: number) => void
}

interface Props<T> {
  columnas: ColumnaTabla<T>[]
  datos: T[]
  getRowKey: (row: T) => string
  paginacion?: Paginacion
  seleccionable?: boolean
  seleccionados?: Set<string>
  onSeleccionar?: (keys: Set<string>) => void
  cargando?: boolean
  vacio?: React.ReactNode
  onClickFila?: (row: T) => void
}

export function DataTable<T>({
  columnas,
  datos,
  getRowKey,
  paginacion,
  seleccionable,
  seleccionados = new Set(),
  onSeleccionar,
  cargando,
  vacio,
  onClickFila,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<Direccion>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const toggleRow = (key: string) => {
    const next = new Set(seleccionados)
    next.has(key) ? next.delete(key) : next.add(key)
    onSeleccionar?.(next)
  }

  const toggleAll = () => {
    const allKeys = datos.map(getRowKey)
    const allSelected = allKeys.every((k) => seleccionados.has(k))
    onSeleccionar?.(allSelected ? new Set() : new Set(allKeys))
  }

  const th: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }

  const td: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: 14,
    color: 'var(--color-text)',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle',
  }

  if (cargando) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 44, borderRadius: 6, background: 'var(--color-surface)' }} />
        ))}
      </div>
    )
  }

  if (datos.length === 0) {
    return <>{vacio ?? <p style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>Sin datos</p>}</>
  }

  const totalPags = paginacion ? Math.ceil(paginacion.total / paginacion.porPagina) : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {seleccionable && (
                <th style={{ ...th, width: 40, textAlign: 'center' }}>
                  <input type="checkbox" checked={datos.length > 0 && datos.every((r) => seleccionados.has(getRowKey(r)))} onChange={toggleAll} />
                </th>
              )}
              {columnas.map((col) => (
                <th key={col.key} className={col.sortable ? 'ds-hover' : undefined}
                  style={{ ...th, width: col.width, textAlign: col.align ?? 'left', cursor: col.sortable ? 'pointer' : 'default' }}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key
                        ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        : <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.map((row, i) => {
              const key = getRowKey(row)
              const seleccionado = seleccionados.has(key)
              return (
                <tr key={key}
                  onClick={() => onClickFila?.(row)}
                  style={{ background: seleccionado ? 'rgba(59,130,246,.06)' : 'transparent', cursor: onClickFila ? 'pointer' : 'default', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { if (!seleccionado) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = seleccionado ? 'rgba(59,130,246,.06)' : 'transparent' }}>
                  {seleccionable && (
                    <td style={{ ...td, textAlign: 'center' }}>
                      <input type="checkbox" checked={seleccionado} onChange={() => toggleRow(key)} onClick={(e) => e.stopPropagation()} />
                    </td>
                  )}
                  {columnas.map((col) => (
                    <td key={col.key} style={{ ...td, textAlign: col.align ?? 'left' }}>
                      {col.render(row, i)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {paginacion && totalPags > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-muted)' }}>
          <span>Página {paginacion.pagina} de {totalPags} · {paginacion.total} registros</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: totalPags }, (_, i) => i + 1).map((p) => (
              <button key={p} className="ds-hover" onClick={() => paginacion.onCambiar(p)}
                style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${p === paginacion.pagina ? 'var(--color-primary)' : 'var(--color-border)'}`, background: p === paginacion.pagina ? 'var(--color-primary)' : 'transparent', color: p === paginacion.pagina ? '#fff' : 'var(--color-text)', fontSize: 13, fontFamily: 'inherit' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
