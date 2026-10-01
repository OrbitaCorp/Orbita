// Estado vacío de un listado del panel con el pet del módulo: la bolsa en
// Pedidos sin pedidos, la caja en Productos sin productos, etc. Va SOLO cuando
// no hay nada todavía; cuando el vacío es por un filtro o una búsqueda se deja
// el mensaje de siempre (un personaje festejando "no encontré nada" no ayuda).

import type { ReactNode } from 'react'
import { OrbiPet } from './OrbiPet'

const NADA = () => {}

export function OrbiPetVacio({ modulo, titulo, descripcion, children }: {
  modulo: string
  titulo: string
  descripcion?: string
  /** Acciones opcionales debajo del texto (por ejemplo, un botón de crear). */
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', textAlign: 'center' }}>
      {/* Se le pueden hacer cosquillas, sin globo: acá el texto es el del listado. */}
      <OrbiPet modulo={modulo} size={88} disc onCosquillas={NADA} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginTop: 4 }}>{titulo}</div>
      {descripcion && (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 340, lineHeight: 1.5 }}>{descripcion}</div>
      )}
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  )
}
