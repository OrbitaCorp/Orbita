import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  activo: boolean
  onToggle: (nuevoValor: boolean) => void
  textoConfirmacion?: string
  textoBotonConfirmar?: string
  size?: 'sm' | 'md'
}

export function ToggleConfirmacion({
  activo,
  onToggle,
  textoConfirmacion = '¿Desactivar? No se aplicará en nuevas ventas.',
  textoBotonConfirmar = 'Desactivar',
  size = 'sm',
}: Props) {
  const [pendiente, setPendiente] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnWrapRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 20 : 24
  const dot = size === 'sm' ? 14 : 18

  const actualizarPos = () => {
    const r = btnWrapRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
  }

  // Portal a document.body + position:fixed: posicionado relativo al trigger
  // (como antes) quedaba recortado por cualquier ancestro con overflow:hidden
  // (la tabla envolvente, por ejemplo) cuando hay pocas filas.
  useEffect(() => {
    if (!pendiente) return
    actualizarPos()
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (btnWrapRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setPendiente(false)
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', actualizarPos, true)
    window.addEventListener('resize', actualizarPos)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', actualizarPos, true)
      window.removeEventListener('resize', actualizarPos)
    }
  }, [pendiente])

  function handleClick() {
    if (activo) {
      setPendiente(true)
    } else {
      onToggle(true)
    }
  }

  return (
    <div ref={btnWrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Toggle switch */}
      <button
        className="ds-hover"
        onClick={handleClick}
        style={{
          width: w,
          height: h,
          borderRadius: 9999,
          padding: 3,
          background: activo ? 'var(--color-primary)' : 'var(--color-border-strong)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: activo ? 'flex-end' : 'flex-start',
          transition: 'background 150ms ease',
          flexShrink: 0,
        }}
        title={activo ? 'Desactivar' : 'Activar'}
      >
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            transition: 'all 150ms ease',
          }}
        />
      </button>

      {/* Popover de confirmación */}
      {pendiente && pos && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            width: 252,
            zIndex: 9999,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          }}
        >
          {/* Flecha */}
          <div
            style={{
              position: 'absolute',
              top: -5,
              right: 12,
              width: 9,
              height: 9,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderBottom: 'none',
              borderRight: 'none',
              transform: 'rotate(45deg)',
            }}
          />
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 4,
            }}
          >
            ¿Desactivar?
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-muted)',
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            {textoConfirmacion}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="ds-hover"
              onClick={() => setPendiente(false)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-body)',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
            <button
              className="ds-hover"
              onClick={() => {
                onToggle(false)
                setPendiente(false)
              }}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 6,
                border: 'none',
                background: 'var(--color-error)',
                color: '#fff',
                fontSize: 13,
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
            >
              {textoBotonConfirmar}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
