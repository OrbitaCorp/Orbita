import { Search } from 'lucide-react'
import { useRouter } from 'next/router'
import { useDescuentosFiltros } from '../hooks/useDescuentosFiltros'
import { ESTADO_DESCUENTO_LABELS, ESTADOS_DESCUENTO_FILTRABLES, TIPO_DESCUENTO_LABELS, ESTADO_CUPON_LABELS, TIPO_CUPON_LABELS } from '../types'

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: '0 8px',
  paddingRight: 28,
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-body)',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  appearance: 'none' as const,
}

export function DescuentosFiltros() {
  const { query } = useRouter()
  const { estado, tipo, busqueda, setEstado, setTipo, setBusqueda } = useDescuentosFiltros()

  const esDescuentos = (query.seccion as string) !== 'cupones'

  const opcionesEstado = esDescuentos
    ? [
        { value: 'todos', label: 'Estado: Todos' },
        // 'agotado' se muestra como badge pero no es filtrable (ver el type).
        ...ESTADOS_DESCUENTO_FILTRABLES.map((v) => ({ value: v, label: ESTADO_DESCUENTO_LABELS[v] })),
      ]
    : [
        { value: 'todos', label: 'Estado: Todos' },
        ...Object.entries(ESTADO_CUPON_LABELS).map(([v, l]) => ({ value: v, label: l })),
      ]

  const opcionesTipo = esDescuentos
    ? [
        { value: 'todos', label: 'Tipo: Todos' },
        ...Object.entries(TIPO_DESCUENTO_LABELS).map(([v, l]) => ({ value: v, label: l })),
      ]
    : [
        { value: 'todos', label: 'Tipo: Todos' },
        ...Object.entries(TIPO_CUPON_LABELS).map(([v, l]) => ({ value: v, label: l })),
      ]

  return (
    <div
      className="df-root"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <style>{`@media (max-width: 768px) { .df-root { width: 100%; } .df-search { flex: 1 1 100%; } .df-search input { width: 100% !important; } }`}</style>
      {/* Estado */}
      <div style={{ position: 'relative' }}>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          style={selectStyle}
        >
          {opcionesEstado.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--color-muted)',
            fontSize: 10,
          }}
        >
          ▼
        </span>
      </div>

      {/* Tipo */}
      <div style={{ position: 'relative' }}>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          style={selectStyle}
        >
          {opcionesTipo.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--color-muted)',
            fontSize: 10,
          }}
        >
          ▼
        </span>
      </div>

      {/* Búsqueda */}
      <div className="df-search" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            pointerEvents: 'none',
            color: 'var(--color-subtle)',
            display: 'flex',
          }}
        >
          <Search size={15} />
        </span>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={esDescuentos ? 'Buscar descuento...' : 'Buscar por nombre o código...'}
          style={{
            height: 36,
            width: esDescuentos ? 220 : 240,
            padding: '0 12px 0 32px',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
