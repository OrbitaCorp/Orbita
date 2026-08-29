import { useState } from 'react'
import { Package, Archive, ExternalLink } from 'lucide-react'
import { MenuContextual } from '../../../_shared/components'
import type { Conversacion } from '../mock/mensajes.mock'
import { Avatar } from './Avatar'

interface Props {
  cv:         Conversacion
  activa:     boolean
  onSelect:   () => void
  onArchivar: () => void
}

export function ConversacionItem({ cv, activa, onSelect, onArchivar }: Props) {
  const [hovered, setHovered] = useState(false)

  const items = [
    ...(cv.pedido
      ? [{ label: `Ver pedido #${cv.pedido}`, Icono: ExternalLink }]
      : []),
    {
      label: cv.archivado ? 'Desarchivar' : 'Archivar conversación',
      Icono: Archive,
      onClick: onArchivar,
      separadorAntes: !!cv.pedido,
    },
  ]

  return (
    <div
      className="ds-hover"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 10,
        padding: '11px 14px',
        borderBottom: '1px solid var(--color-border)',
        borderLeft: `3px solid ${activa ? 'var(--color-primary)' : 'transparent'}`,
        background: activa ? 'var(--color-primary-bg)' : 'transparent',
      }}
    >
      <Avatar name={cv.cliente} size={36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 13,
            fontWeight: cv.unread ? 700 : 600,
            color: 'var(--color-text)',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {cv.cliente}
          </span>
          <span style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
            {cv.tiempo}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
          {cv.preview}
        </div>
        {cv.pedido && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            height: 18, padding: '0 7px', borderRadius: 6,
            background: 'var(--color-surface-alt)',
            color: 'var(--color-muted)',
            fontSize: 10, marginTop: 5,
            fontFamily: '"Geist Mono", monospace',
          }}>
            <Package size={9} />
            #{cv.pedido}
          </span>
        )}
      </div>

      {/* Right slot: unread dot OR contextual menu */}
      <div style={{ flexShrink: 0, width: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 4 }}>
        {hovered ? (
          <div onClick={(e) => e.stopPropagation()}>
            <MenuContextual items={items} />
          </div>
        ) : cv.unread && !activa ? (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', marginTop: 4, flexShrink: 0 }} />
        ) : null}
      </div>
    </div>
  )
}
