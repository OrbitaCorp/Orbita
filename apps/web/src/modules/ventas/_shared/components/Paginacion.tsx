// Paginación de los listados de ventas (descuentos, cupones).
//
// Es la MISMA que usa el resto del panel (modules/ventas/panel/_shared/Paginacion):
// Anterior · "Página X de Y" · Siguiente. Antes tenía además un selector de
// "mostrar N por página" (10/20/25/50/100); se sacó a pedido del dueño — el
// tamaño de página del panel es 10 en todas las secciones y punto — y de paso
// era lo que hacía desbordar la barra en un celular, donde el selector, el
// contador y las cuatro flechas no entran juntos en 390px.
//
// La firma se mantiene para no tocar a quienes la usan; onCambiarPorPagina
// quedó opcional y sin uso.

interface Props {
  total: number
  pagina: number
  porPagina: number
  onCambiarPagina: (pagina: number) => void
  onCambiarPorPagina?: (porPagina: number) => void
}

export function Paginacion({ total, pagina, porPagina, onCambiarPagina }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const fin = Math.min(pagina * porPagina, total)

  if (total === 0) return null

  const btn = (disabled: boolean): React.CSSProperties => ({
    minHeight: 34,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: disabled ? 'var(--color-subtle)' : 'var(--color-body)',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <>
      <style>{`
        @media (max-width: 480px) {
          .vs-pag { flex-wrap: wrap !important; gap: 8px !important; }
          .vs-pag > button { flex: 1 1 0 !important; min-height: 40px !important; }
          .vs-pag > span { order: 3; width: 100% !important; text-align: center; }
        }
      `}</style>
      <div
        className="vs-pag"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14, padding: '0 4px' }}
      >
        <button
          className="ds-hover"
          style={btn(pagina <= 1)}
          disabled={pagina <= 1}
          onClick={() => onCambiarPagina(Math.max(1, pagina - 1))}
        >
          Anterior
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
          {totalPaginas > 1 ? `Página ${pagina} de ${totalPaginas}` : `${inicio}–${fin} de ${total}`}
        </span>
        <button
          className="ds-hover"
          style={btn(pagina >= totalPaginas)}
          disabled={pagina >= totalPaginas}
          onClick={() => onCambiarPagina(Math.min(totalPaginas, pagina + 1))}
        >
          Siguiente
        </button>
      </div>
    </>
  )
}
