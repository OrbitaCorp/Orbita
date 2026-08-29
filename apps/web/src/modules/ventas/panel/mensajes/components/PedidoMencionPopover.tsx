import { useEffect, useRef, useState } from 'react'
import { Search, Package } from 'lucide-react'
import type { PedidoResumen } from '../mock/mensajes.mock'
import { ESTADO_PEDIDO } from '../mock/mensajes.mock'

interface Props {
  pedidos:       PedidoResumen[]
  clienteNombre: string
  query:         string
  onSelect:      (pedidoId: string) => void
  onClose:       () => void
}

const MONO = '"Geist Mono", "Fira Code", monospace'

function fmtMonto(n: number) {
  return `$ ${n.toLocaleString('es-AR')}`
}

export function PedidoMencionPopover({ pedidos, clienteNombre, query, onSelect, onClose }: Props) {
  const [search, setSearch] = useState(query)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external query changes into local search
  useEffect(() => setSearch(query), [query])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  // Focus search input on open
  useEffect(() => { inputRef.current?.focus() }, [])

  const filtrados = pedidos.filter((p) =>
    search === '' || p.id.includes(search) || p.fecha.includes(search),
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 44,
        width: 400,
        zIndex: 210,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,.14)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Pedidos de {clienteNombre.split(' ')[0]}
        </div>

        {/* Buscador interno */}
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
          <input
            className="ds-field"
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por número…"
            style={{
              width: '100%', boxSizing: 'border-box',
              height: 30, paddingLeft: 26, paddingRight: 10,
              border: '1px solid var(--color-border)', borderRadius: 7,
              background: 'var(--color-surface-alt)',
              fontSize: 12, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Lista */}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
            No se encontraron pedidos
          </div>
        ) : (
          filtrados.map((p) => {
            const est = ESTADO_PEDIDO[p.estado] ?? { color: 'var(--color-muted)', bg: 'var(--color-surface-alt)' }
            return (
              <button
                key={p.id}
                className="ds-hover"
                onClick={() => { onSelect(p.id); onClose() }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--color-border)',
                  background: 'transparent', fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                {/* Ícono */}
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--color-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={14} color="var(--color-muted)" />
                </div>

                {/* Número + fecha */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: MONO }}>
                    #{p.id}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                    {p.fecha}
                  </div>
                </div>

                {/* Badge estado */}
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 9999, background: est.bg, color: est.color, fontSize: 11, fontWeight: 600 }}>
                  {p.estado}
                </span>

                {/* Monto */}
                <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', fontFamily: MONO, minWidth: 72, textAlign: 'right' }}>
                  {fmtMonto(p.total)}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
