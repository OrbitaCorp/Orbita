import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

export interface ItemMenuContextual {
  label: string
  Icono?: React.ComponentType<{ size?: number; color?: string }>
  onClick?: () => void
  destructivo?: boolean
  separadorAntes?: boolean
}

interface Props {
  items: ItemMenuContextual[]
}

function FilaMenu({
  item,
  onClose,
}: {
  item: ItemMenuContextual
  onClose: () => void
}) {
  return (
    <button
      className="ds-hover"
      onClick={() => {
        item.onClick?.()
        onClose()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        borderRadius: 6,
        fontSize: 13,
        textAlign: 'left',
        border: 'none',
        fontFamily: 'inherit',
        color: item.destructivo ? 'var(--color-error)' : 'var(--color-body)',
        background: 'transparent',
      }}
    >
      {item.Icono && (
        <item.Icono
          size={14}
          color={item.destructivo ? 'var(--color-error)' : undefined}
        />
      )}
      {item.label}
    </button>
  )
}

export function MenuContextual({ items }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const actualizarPos = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }

  // Portal a document.body + position:fixed: si se posicionara relativo al
  // trigger (como antes), cualquier ancestro con overflow:hidden (la tabla
  // envolvente, por ejemplo) lo recorta cuando hay pocas filas y no sobra
  // alto — quedaba "atrás" del contenido en vez de flotar por encima.
  useEffect(() => {
    if (!abierto) return
    actualizarPos()
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', actualizarPos, true)
    window.addEventListener('resize', actualizarPos)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', actualizarPos, true)
      window.removeEventListener('resize', actualizarPos)
    }
  }, [abierto])

  return (
    <>
      <button
        ref={btnRef}
        className="ds-hover"
        onClick={() => setAbierto((a) => !a)}
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          border: '1px solid var(--color-border)',
          background: abierto ? 'var(--color-surface-alt)' : 'var(--color-bg)',
          color: 'var(--color-body)',
          display: 'grid',
          placeItems: 'center',
          transition: 'background 100ms ease',
        }}
        title="Más opciones"
      >
        <MoreVertical size={14} />
      </button>

      {abierto && pos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            width: 192,
            borderRadius: 10,
            zIndex: 9999,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            padding: 4,
          }}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.separadorAntes && (
                <div
                  style={{
                    height: 1,
                    background: 'var(--color-border)',
                    margin: '4px 0',
                  }}
                />
              )}
              <FilaMenu item={item} onClose={() => setAbierto(false)} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
