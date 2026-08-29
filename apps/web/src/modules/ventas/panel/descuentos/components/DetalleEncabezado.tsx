import { Pencil } from 'lucide-react'
import { BadgeEstado } from './BadgeEstado'
import { BadgeTipo } from './BadgeTipo'
import { isoADisplay } from '../utils'
import type { Descuento } from '../types'

interface Props {
  descuento: Descuento
  onEditar: () => void
}

export function DetalleEncabezado({ descuento, onEditar }: Props) {
  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 28,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: '0 0 10px',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text)',
              lineHeight: 1.25,
            }}
          >
            {descuento.nombre}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <BadgeTipo tipo={descuento.tipo} aplicacion={descuento.aplicacion} />
            <BadgeEstado estado={descuento.estado} />
          </div>

          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            Creado el{' '}
            <span style={{ color: 'var(--color-body)' }}>
              {isoADisplay(descuento.createdAt.split('T')[0]) || descuento.createdAt}
            </span>{' '}
            por{' '}
            <span style={{ color: 'var(--color-body)', fontWeight: 500 }}>
              {descuento.creadoPor === 'usr-admin' ? 'Marcos Olivera' : descuento.creadoPor}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="ds-hover"
          onClick={onEditar}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            padding: '0 14px',
            borderRadius: 8,
            border: '1.5px solid var(--color-primary)',
            background: 'transparent',
            color: 'var(--color-primary)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Pencil size={13} />
          Editar
        </button>
      </div>
    </div>
  )
}
