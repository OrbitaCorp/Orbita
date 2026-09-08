import { Edit2, Trash2 } from 'lucide-react'
import { MenuContextual } from '../../../_shared/components'
import type { Plantilla, CategoriaPlantilla } from '../mock/mensajes.mock'

interface Props {
  p:           Plantilla
  onEditar:    (p: Plantilla) => void
  onEliminar:  (id: string) => void
}

const CATEGORIA_LABELS: Record<CategoriaPlantilla, string> = {
  pedido: 'Pedido', retiro: 'Retiro', envio: 'Envío', postventa: 'Postventa', otro: 'Otro',
}

function ResaltarVariables({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\{[^}]+\})/).map((part, i) =>
        part.startsWith('{') ? (
          <span key={i} style={{ color: 'var(--color-primary)', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

export function PlantillaCard({ p, onEditar, onEliminar }: Props) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 18px' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>
          {p.nombre}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 10.5, fontWeight: 600 }}>
          {CATEGORIA_LABELS[p.categoria]}
        </span>
        <MenuContextual items={[
          { label: 'Editar', Icono: Edit2, onClick: () => onEditar(p) },
          { label: 'Eliminar', Icono: Trash2, onClick: () => onEliminar(p.id), destructivo: true, separadorAntes: true },
        ]} />
      </div>

      {/* Preview del texto */}
      <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.6, padding: 12, background: 'var(--color-surface)', borderRadius: 8 }}>
        <ResaltarVariables texto={p.texto} />
      </div>
    </div>
  )
}
