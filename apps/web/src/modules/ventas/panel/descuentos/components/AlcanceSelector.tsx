import { ReceiptText, FolderOpen, Tag } from 'lucide-react'
import type { AlcanceDescuento } from '../types'

interface AlcanceCard {
  valor: AlcanceDescuento
  Icono: React.ComponentType<{ size?: number; color?: string }>
  nombre: string
  desc: string
}

const CARDS: AlcanceCard[] = [
  { valor: 'ticket',    Icono: ReceiptText, nombre: 'Ticket completo', desc: 'Se aplica sobre el total del ticket' },
  { valor: 'categoria', Icono: FolderOpen,  nombre: 'Categoría',       desc: 'Solo productos de ciertas categorías' },
  { valor: 'producto',  Icono: Tag,         nombre: 'Productos',        desc: 'Productos específicos o variantes' },
]

interface Props {
  alcance: AlcanceDescuento
  onChange: (alcance: AlcanceDescuento) => void
  /** Cuáles opciones mostrar. Default: todos los 3. */
  opciones?: AlcanceDescuento[]
  error?: string
}

export function AlcanceSelector({ alcance, onChange, opciones, error }: Props) {
  const cards = opciones ? CARDS.filter((c) => opciones.includes(c.valor)) : CARDS
  return (
    <div>
      <div className="dcto-g2" style={{ display: 'grid', gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 10 }}>
        {cards.map(({ valor, Icono, nombre, desc }) => {
          const activo = alcance === valor
          return (
            <button
              key={valor}
              type="button"
              className="ds-hover"
              onClick={() => onChange(valor)}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 10,
                border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                cursor: 'pointer',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: 8, marginBottom: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                  transition: 'background 150ms ease',
                }}
              >
                <Icono size={15} color={activo ? '#fff' : 'var(--color-muted)'} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: activo ? 'var(--color-primary-h)' : 'var(--color-text)', marginBottom: 2 }}>
                {nombre}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>
                {desc}
              </div>
            </button>
          )
        })}
      </div>
      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-error)' }}>{error}</p>}
    </div>
  )
}
