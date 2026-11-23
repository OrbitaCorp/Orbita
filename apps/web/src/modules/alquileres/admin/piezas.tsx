// Piezas propias del panel de Alquileres (prefijo ala-): la fila de cabecera
// de una lista, la ayuda al pie de una tarjeta y el botón que pide
// confirmación antes de quitar algo. Lo genérico (campos, modal, tabla, chips,
// el indicador con ícono y variación, la barra de guardar) viene del kit de
// reservas del design system; acá va solo lo que el kit no tiene.
import { useState, type ReactNode } from 'react'

export const CSS_PANEL = `
  /* Una fila de la lista con su rótulo y su acción a la derecha. */
  .ala-cab-lista { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }

  /* La ayuda de una página: un renglón chico al pie de una tarjeta. */
  .ala-pie-nota { margin: 12px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }

  /* La pregunta de BotonConfirmar: ocupa el lugar del botón, con la pregunta y las dos respuestas. */
  .ala-confirmar { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ala-confirmar-txt { font-size: 13.5px; font-weight: 600; color: var(--color-text); }

  /* En la ficha de una reserva, Cancelar va último (abajo de todo en celular) y a la izquierda en escritorio. */
  .rv-modal-pie > .ala-ultimo { order: -1; margin-right: auto; }
  @media (max-width: 768px) { .rv-modal-pie > .ala-ultimo { order: 99; flex: 1 1 100%; margin-right: 0; } }
`

export const EstiloPanelAlquileres = () => <style>{CSS_PANEL}</style>

/**
 * Un botón que quita algo (un bloqueo, un calendario, una persona, la cuenta
 * de Mercado Pago). El primer toque no hace nada irreversible: cambia el botón
 * por la pregunta y dos respuestas, en el mismo lugar. Así un toque de más en
 * el celular no borra nada.
 */
export function BotonConfirmar({ children, pregunta, si = 'Sí, quitar', onConfirmar, className = 'rv-btn rv-btn--sm' }: {
  children: ReactNode
  pregunta: string
  si?: string
  onConfirmar: () => void
  className?: string
}) {
  const [preguntando, setPreguntando] = useState(false)
  if (!preguntando) return <button type="button" className={className} onClick={() => setPreguntando(true)}>{children}</button>
  return (
    <span className="ala-confirmar" role="group" aria-label={pregunta}>
      <span className="ala-confirmar-txt">{pregunta}</span>
      {/* El foco va a "No": Enter por reflejo no quita nada. */}
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => setPreguntando(false)} autoFocus>No</button>
      <button type="button" className="rv-btn rv-btn--sm rv-btn--peligro" onClick={() => { setPreguntando(false); onConfirmar() }}>{si}</button>
    </span>
  )
}
