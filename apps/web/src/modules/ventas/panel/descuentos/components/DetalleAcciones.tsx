import { useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { Toggle } from '../../../_shared/components'
import { useToggleDescuento } from '../hooks/useToggleDescuento'
import { useDuplicarDescuento } from '../hooks/useDuplicarDescuento'
import { useEliminarDescuento } from '../hooks/useEliminarDescuento'
import type { Descuento } from '../types'

interface Props {
  descuento: Descuento
  onVolver: () => void
}

export function DetalleAcciones({ descuento, onVolver }: Props) {
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const toggle = useToggleDescuento()
  const duplicar = useDuplicarDescuento()
  const eliminar = useEliminarDescuento()

  const activo = descuento.estado === 'activo'

  function handleEliminar() {
    eliminar.mutate(descuento.id, { onSuccess: onVolver })
  }

  return (
    <div
      style={{
        background: activo ? 'var(--color-success-bg)' : 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'background 0.2s',
      }}
    >
      {/* Toggle de estado */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
              {activo ? 'Descuento activo' : 'Descuento inactivo'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
              {activo ? 'Se aplica automáticamente a compras.' : 'No se aplica en ningún canal.'}
            </p>
          </div>
          <Toggle
            checked={activo}
            onChange={() => toggle.mutate({ id: descuento.id, activo: !activo })}
            size="md"
            disabled={toggle.isPending}
          />
        </div>
      </div>

      {/* Duplicar */}
      <button
        type="button"
        onClick={() => duplicar.mutate(descuento.id)}
        disabled={duplicar.isPending}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '14px 20px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--color-border)',
          cursor: duplicar.isPending ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          color: 'var(--color-body)',
        }}
      >
        <Copy size={15} />
        <span style={{ fontSize: 14 }}>Duplicar descuento</span>
      </button>

      {/* Eliminar */}
      {!confirmarEliminar ? (
        <button
          type="button"
          onClick={() => setConfirmarEliminar(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '14px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'var(--color-error)',
          }}
        >
          <Trash2 size={15} />
          <span style={{ fontSize: 14 }}>Eliminar descuento</span>
        </button>
      ) : (
        <div style={{ padding: '14px 20px', background: 'var(--color-error-bg)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-error)', fontWeight: 500 }}>
            ¿Confirmar eliminación?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleEliminar}
              disabled={eliminar.isPending}
              style={{
                flex: 1, height: 32, borderRadius: 7, border: 'none',
                background: 'var(--color-error)', color: 'var(--color-on-primary)', fontSize: 13,
                fontWeight: 600, cursor: eliminar.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirmarEliminar(false)}
              style={{
                flex: 1, height: 32, borderRadius: 7, border: '1px solid var(--color-border)',
                background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
