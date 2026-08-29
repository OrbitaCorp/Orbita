import { Archive, Package } from 'lucide-react'
import { MenuContextual } from '../../../_shared/components'
import type { Conversacion, PedidoResumen } from '../mock/mensajes.mock'
import { Avatar } from './Avatar'

interface Props {
  cv:         Conversacion
  pedidos:    PedidoResumen[]
  onPerfil:   () => void
  onArchivar: () => void
}

const btnOutline: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  height: 30, padding: '0 12px', borderRadius: 7,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-body)', fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
}

const MONO = '"Geist Mono", "Fira Code", monospace'

export function ChatHeader({ cv, pedidos, onPerfil, onArchivar }: Props) {
  const visibles = pedidos.slice(0, 3)
  const extras   = pedidos.length - 3

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      flexShrink: 0,
    }}>
      <Avatar name={cv.cliente} size={36} />

      {/* Datos del cliente */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cv.cliente}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: MONO }}>
          {cv.email}
        </div>

        {/* Chips de pedidos — solo si tiene pedidos */}
        {pedidos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
            <Package size={11} color="var(--color-muted)" style={{ flexShrink: 0 }} />
            {visibles.map((p) => (
              <button
                key={p.id}
                title={`Pedido #${p.id} · ${p.estado}`}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  height: 20, padding: '0 8px', borderRadius: 6,
                  background: 'var(--color-surface-alt)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-body)', fontSize: 11,
                  fontFamily: MONO, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-primary-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-alt)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-body)' }}
              >
                #{p.id}
              </button>
            ))}
            {extras > 0 && (
              <button
                className="ds-link"
                onClick={onPerfil}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                ver todos ({pedidos.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingTop: 2 }}>
        <button className="ds-hover" style={btnOutline} onClick={onPerfil}>
          Ver perfil
        </button>
        <MenuContextual items={[
          {
            label: cv.archivado ? 'Desarchivar' : 'Archivar conversación',
            Icono: Archive,
            onClick: onArchivar,
          },
        ]} />
      </div>
    </div>
  )
}
