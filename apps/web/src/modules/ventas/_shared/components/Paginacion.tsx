import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

interface Props {
  total: number
  pagina: number
  porPagina: number
  onCambiarPagina: (pagina: number) => void
  onCambiarPorPagina: (porPagina: number) => void
}

const OPCIONES_POR_PAGINA = [10, 20, 25, 50, 100]

type CSSProps = React.CSSProperties

const btnStyle = (disabled: boolean): CSSProps => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: disabled ? 'var(--color-subtle)' : 'var(--color-body)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'grid',
  placeItems: 'center',
})

function PagBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      className="ds-hover"
      onClick={onClick}
      disabled={disabled}
      style={btnStyle(disabled)}
    >
      {children}
    </button>
  )
}

export function Paginacion({ total, pagina, porPagina, onCambiarPagina, onCambiarPorPagina }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const fin = Math.min(pagina * porPagina, total)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        padding: '0 4px',
      }}
    >
      {/* Izquierda: mostrar N por página */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--color-muted)',
        }}
      >
        <span>Mostrar</span>
        <select
          className="ds-field"
          value={porPagina}
          onChange={(e) => onCambiarPorPagina(Number(e.target.value))}
          style={{
            height: 32,
            padding: '0 8px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-body)',
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {OPCIONES_POR_PAGINA.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>por página</span>
      </div>

      {/* Derecha: rango + botones de navegación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--color-muted)',
            fontFamily: '"Geist Mono", "Fira Code", monospace',
            marginRight: 8,
          }}
        >
          {inicio}–{fin} de {total}
        </span>
        <PagBtn onClick={() => onCambiarPagina(1)} disabled={pagina === 1}>
          <ChevronsLeft size={14} />
        </PagBtn>
        <PagBtn onClick={() => onCambiarPagina(pagina - 1)} disabled={pagina === 1}>
          <ChevronLeft size={14} />
        </PagBtn>
        <PagBtn onClick={() => onCambiarPagina(pagina + 1)} disabled={pagina >= totalPaginas}>
          <ChevronRight size={14} />
        </PagBtn>
        <PagBtn onClick={() => onCambiarPagina(totalPaginas)} disabled={pagina >= totalPaginas}>
          <ChevronsRight size={14} />
        </PagBtn>
      </div>
    </div>
  )
}
