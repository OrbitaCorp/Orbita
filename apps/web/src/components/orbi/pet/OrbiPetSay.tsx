// Globo de texto del pet: escribe la frase letra por letra, como en el diseño.
// Vive en su propio componente a propósito: el tipeo re-renderiza ~40 veces por
// segundo y no tiene que arrastrar al chat entero. Con movimiento reducido la
// frase aparece completa.

import { useEffect, useState } from 'react'
import { useMovimientoReducido } from './movimiento'

export function OrbiPetSay({ texto }: { texto: string }) {
  // La key reinicia el tipeo desde cero cada vez que cambia la frase.
  return <Tipeo key={texto} texto={texto} />
}

function Tipeo({ texto }: { texto: string }) {
  const reducido = useMovimientoReducido()
  const [n, setN] = useState(0)

  useEffect(() => {
    if (reducido) return
    const t = setInterval(() => {
      setN(i => {
        if (i + 1 >= texto.length) clearInterval(t)
        return i + 1
      })
    }, 26)
    return () => clearInterval(t)
  }, [texto, reducido])

  const visible = reducido ? texto : texto.slice(0, n)

  return (
    <div
      // El texto completo para lectores de pantalla; lo tipeado es solo visual.
      aria-label={texto}
      style={{
        background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 14,
        padding: '10px 14px', fontSize: 13, lineHeight: 1.45, color: 'var(--color-text)',
        textAlign: 'center', maxWidth: 280, minHeight: 20, textWrap: 'pretty',
      }}
    >
      {/* El texto completo, invisible, reserva el lugar: así el globo no crece
          (ni empuja lo de abajo) mientras se va escribiendo. */}
      <span aria-hidden="true" style={{ display: 'grid' }}>
        <span style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{texto}</span>
        <span style={{ gridArea: '1 / 1' }}>{visible}</span>
      </span>
    </div>
  )
}
