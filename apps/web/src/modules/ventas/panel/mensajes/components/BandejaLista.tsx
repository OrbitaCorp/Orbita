import { useState } from 'react'
import { Search, MessageCircle } from 'lucide-react'
import type { Conversacion, FiltroBandeja } from '../mock/mensajes.mock'
import { ConversacionItem } from './ConversacionItem'

interface Props {
  conversaciones: Conversacion[]
  activaId:       string | null
  onSelect:       (id: string) => void
  onArchivar:     (id: string) => void
}

const FILTROS: { id: FiltroBandeja; label: string }[] = [
  { id: 'todos',      label: 'Todos'     },
  { id: 'sin_leer',   label: 'Sin leer'  },
  { id: 'archivados', label: 'Archivados'},
]

export function BandejaLista({ conversaciones, activaId, onSelect, onArchivar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroBandeja>('todos')

  const sinLeerCount = conversaciones.filter((cv) => !cv.archivado && cv.unread).length

  const filtradas = conversaciones
    .filter((cv) => {
      if (filtro === 'sin_leer')   return !cv.archivado && cv.unread
      if (filtro === 'archivados') return cv.archivado
      return !cv.archivado
    })
    .filter((cv) => {
      const q = busqueda.trim().toLowerCase()
      if (!q) return true
      return cv.cliente.toLowerCase().includes(q) || (cv.pedido ?? '').includes(q)
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Mensajes</span>
          {sinLeerCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 11, fontWeight: 600 }}>
              {sinLeerCount} sin leer
            </span>
          )}
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input
            className="ds-field"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o nº de pedido..."
            style={{
              width: '100%', boxSizing: 'border-box',
              height: 34, paddingLeft: 30, paddingRight: 10,
              border: '1px solid var(--color-border)', borderRadius: 8,
              background: 'var(--color-surface-alt)',
              fontSize: 12.5, color: 'var(--color-text)', fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>

        {/* Filtro pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              className="ds-hover"
              onClick={() => setFiltro(f.id)}
              style={{
                height: 26, padding: '0 10px', borderRadius: 9999,
                border: `1.5px solid ${filtro === f.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: filtro === f.id ? 'var(--color-primary-bg)' : 'transparent',
                color: filtro === f.id ? 'var(--color-primary)' : 'var(--color-muted)',
                fontSize: 11.5, fontWeight: filtro === f.id ? 600 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 150ms ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtradas.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '48px 24px', color: 'var(--color-muted)' }}>
            <MessageCircle size={28} strokeWidth={1.5} />
            <p style={{ margin: 0, fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
              {busqueda ? 'Sin resultados para esa búsqueda.' : filtro === 'archivados' ? 'No hay conversaciones archivadas.' : 'No hay mensajes todavía.'}
            </p>
          </div>
        ) : (
          filtradas.map((cv) => (
            <ConversacionItem
              key={cv.id}
              cv={cv}
              activa={activaId === cv.id}
              onSelect={() => onSelect(cv.id)}
              onArchivar={() => onArchivar(cv.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
