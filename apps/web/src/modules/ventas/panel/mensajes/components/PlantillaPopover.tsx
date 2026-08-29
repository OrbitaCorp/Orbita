import { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Plantilla, Conversacion, CategoriaPlantilla } from '../mock/mensajes.mock'
import { resolverVariables, CATEGORIAS_PLANTILLA } from '../mock/mensajes.mock'

interface Props {
  plantillas:       Plantilla[]
  cv:               Conversacion | null
  onSeleccionar:    (texto: string) => void
  onClose:          () => void
  onIrAPlantillas:  () => void
}

const CATEGORIA_LABELS: Record<CategoriaPlantilla, string> = {
  pedido: 'Pedido', retiro: 'Retiro', envio: 'Envío', postventa: 'Postventa', otro: 'Otro',
}

export function PlantillaPopover({ plantillas, cv, onSeleccionar, onClose, onIrAPlantillas }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const categorias = CATEGORIAS_PLANTILLA.filter((c) =>
    plantillas.some((p) => p.categoria === c.id),
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        width: 340,
        zIndex: 200,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,.12)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Plantillas
        </span>
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 6px' }}>
        {categorias.map((cat) => (
          <div key={cat.id}>
            <div style={{ padding: '6px 8px 4px', fontSize: 10.5, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {CATEGORIA_LABELS[cat.id]}
            </div>
            {plantillas
              .filter((p) => p.categoria === cat.id)
              .map((p) => {
                const preview = resolverVariables(p.texto, cv)
                return (
                  <button
                    key={p.id}
                    className="ds-hover"
                    onClick={() => { onSeleccionar(preview); onClose() }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '8px 10px', borderRadius: 7,
                      border: 'none', background: 'transparent',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 2 }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {preview}
                    </div>
                  </button>
                )
              })}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)' }}>
        <button
          className="ds-link"
          onClick={() => { onClose(); onIrAPlantillas() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontWeight: 500 }}
        >
          Gestionar plantillas
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  )
}
