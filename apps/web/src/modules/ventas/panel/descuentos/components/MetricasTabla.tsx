import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react'
import { BadgeEstado } from './BadgeEstado'
import type { RendimientoItem, OrdenColumnaRendimiento, OrdenDireccion, EstadoDescuento } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'
const COLS = '1.8fr 0.9fr 0.7fr 1fr 1fr 0.9fr 0.7fr'

function fmt(n: number) {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`
}

function SortIcon({ col, orden, dir }: { col: OrdenColumnaRendimiento; orden: OrdenColumnaRendimiento; dir: OrdenDireccion }) {
  if (col !== orden) return <ChevronsUpDown size={12} color="var(--color-muted)" />
  return dir === 'asc' ? <ChevronUp size={12} color="var(--color-primary)" /> : <ChevronDown size={12} color="var(--color-primary)" />
}

function Th({
  label, col, orden, dir, onSort, style,
}: {
  label: string
  col?: OrdenColumnaRendimiento
  orden: OrdenColumnaRendimiento
  dir: OrdenDireccion
  onSort: (c: OrdenColumnaRendimiento) => void
  style?: React.CSSProperties
}) {
  if (!col) {
    return (
      <div
        style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', ...style }}
      >
        {label}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="ds-hover"
      onClick={() => onSort(col)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px',
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: col === orden ? 'var(--color-primary)' : 'var(--color-muted)',
        ...style,
      }}
    >
      {label}
      <SortIcon col={col} orden={orden} dir={dir} />
    </button>
  )
}

interface Props {
  items: RendimientoItem[]
  onRowClick: (id: string) => void
}

const POR_PAGINA = 10

export function MetricasTabla({ items, onRowClick }: Props) {
  const [orden, setOrden] = useState<OrdenColumnaRendimiento>('usos')
  const [dir, setDir] = useState<OrdenDireccion>('desc')
  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')

  function handleSort(col: OrdenColumnaRendimiento) {
    if (col === orden) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setOrden(col)
      setDir('desc')
    }
    setPagina(1)
  }

  function handleBusqueda(v: string) {
    setBusqueda(v)
    setPagina(1)
  }

  const q = busqueda.trim().toLowerCase()
  const filtrados = q
    ? items.filter((i) => i.nombre.toLowerCase().includes(q) || i.tipoLabel.toLowerCase().includes(q))
    : items

  const sorted = [...filtrados].sort((a, b) => {
    const va = a[orden] as number
    const vb = b[orden] as number
    return dir === 'asc' ? va - vb : vb - va
  })

  const totalPaginas = Math.ceil(sorted.length / POR_PAGINA)
  const paginados = sorted.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const thProps = { orden, dir, onSort: handleSort }

  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Buscador */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div style={{ position: 'relative', maxWidth: 320 }}>
          <Search size={13} color="var(--color-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            className="ds-field"
            value={busqueda}
            onChange={(e) => handleBusqueda(e.target.value)}
            placeholder="Buscar por nombre o tipo…"
            style={{
              width: '100%', height: 32, paddingLeft: 30, paddingRight: busqueda ? 28 : 10,
              borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-text)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {busqueda && (
            <button className="ds-hover" onClick={() => handleBusqueda('')} type="button" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 6 }}>
              <X size={13} color="var(--color-muted)" />
            </button>
          )}
        </div>
      </div>

      {/* Encabezado columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: COLS, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <Th label="Nombre" col="nombre" {...thProps} />
        <Th label="Tipo" {...thProps} />
        <Th label="Estado" {...thProps} />
        <Th label="Usos" col="usos" {...thProps} />
        <Th label="Rev. sacrificado" col="revenueSacrificado" {...thProps} />
        <Th label="Rev. c/desc" col="revenueConDesc" {...thProps} />
        <Th label="Ticket prom." col="ticketPromedio" {...thProps} />
      </div>

      {/* Estado vacío */}
      {paginados.length === 0 && (
        <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
          Sin resultados para "<strong>{busqueda}</strong>"
        </div>
      )}

      {/* Filas */}
      {paginados.map((item) => (
        <button
          key={item.id}
          type="button"
          className="ds-hover"
          onClick={() => onRowClick(item.id)}
          style={{
            display: 'grid', gridTemplateColumns: COLS, width: '100%',
            background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <div style={{ padding: '11px 12px', fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
            {item.nombre}
          </div>
          <div style={{ padding: '11px 12px', fontSize: 12, color: 'var(--color-muted)' }}>
            {item.tipoLabel}
          </div>
          <div style={{ padding: '11px 12px', display: 'flex', alignItems: 'center' }}>
            <BadgeEstado estado={item.estado as EstadoDescuento} />
          </div>
          <div style={{ padding: '11px 12px', fontSize: 13, fontFamily: MONO }}>
            {item.usos.toLocaleString('es-AR')}
          </div>
          <div style={{ padding: '11px 12px', fontSize: 13, fontFamily: MONO, color: 'var(--color-error)' }}>
            {fmt(item.revenueSacrificado)}
          </div>
          <div style={{ padding: '11px 12px', fontSize: 13, fontFamily: MONO }}>
            {fmt(item.revenueConDesc)}
          </div>
          <div style={{ padding: '11px 12px', fontSize: 13, fontFamily: MONO }}>
            {fmt(item.ticketPromedio)}
          </div>
        </button>
      ))}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtrados.length)} de {filtrados.length}{q ? ` (filtrado de ${items.length})` : ''}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <PagBtn onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} label="← Ant." />
            {Array.from({ length: totalPaginas }, (_, i) => (
              <PagBtn key={i} onClick={() => setPagina(i + 1)} active={pagina === i + 1} label={String(i + 1)} />
            ))}
            <PagBtn onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} label="Sig. →" />
          </div>
        </div>
      )}
    </div>
  )
}

function PagBtn({ onClick, disabled, active, label }: { onClick: () => void; disabled?: boolean; active?: boolean; label: string }) {
  return (
    <button
      type="button"
      className="ds-hover"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 30, height: 30, padding: '0 8px', borderRadius: 6,
        border: active ? 'none' : '1px solid var(--color-border)',
        background: active ? 'var(--color-primary)' : 'var(--color-bg)',
        color: active ? '#fff' : 'var(--color-body)',
        fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  )
}
