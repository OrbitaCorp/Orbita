// ─── Foco: resalta el botón que hay que tocar ────────────────────────────────
//
// Sin cursor fantasma ni animaciones: la pantalla se atenúa y se difumina con
// un degradado, y el botón del paso queda nítido, con un aro y una frase corta
// al lado (ver Penumbra). No bloquea nada: quien quiera tocar otra cosa puede
// hacerlo, y en cuanto toca el botón el foco se va.
//
// El botón se encuentra por `data-ayuda="<objetivo>"`, no por su texto: si
// alguien le cambia el rótulo, el foco sigue andando. Sin el atributo (o con el
// botón fuera de pantalla) simplemente no se dibuja nada.

import { useState } from 'react'
import { Penumbra, useCaja } from './Penumbra'

interface Props {
    /** Valor de data-ayuda del botón a resaltar. */
    objetivo: string
    texto: string
    /** Tocó el botón señalado. */
    alTocar?: () => void
}

const ALTO_FRASE = 44
const AIRE = 8

export default function Foco({ objetivo, texto, alTocar }: Props) {
    const [tocado, setTocado] = useState(false)
    const movil = typeof window !== 'undefined' && window.innerWidth < 640
    const { caja } = useCaja({ ayuda: objetivo }, objetivo, movil, () => { setTocado(true); alTocar?.() })

    if (!caja || tocado) return null

    const cx = caja.left + caja.width / 2
    // La frase va debajo del botón; si no entra, arriba.
    const abajo = caja.top + caja.height + AIRE + ALTO_FRASE + 12 < window.innerHeight
    const top = abajo ? caja.top + caja.height + AIRE + 8 : caja.top - AIRE - 8 - ALTO_FRASE
    const ancho = Math.min(260, window.innerWidth - 24)
    const left = Math.max(12, Math.min(cx - ancho / 2, window.innerWidth - ancho - 12))

    return (
        <>
            <Penumbra caja={caja} />
            <div aria-hidden="true" data-ayuda-ui style={{
                position: 'fixed', zIndex: 221, pointerEvents: 'none', top, left, width: ancho, minHeight: ALTO_FRASE,
                display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                padding: '8px 12px', borderRadius: 10, boxSizing: 'border-box',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                border: '1px solid var(--color-border-strong)',
                fontSize: 14, fontWeight: 600, lineHeight: 1.35,
                boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                transition: 'top 160ms ease, left 160ms ease',
            }}>
                {texto}
            </div>
        </>
    )
}
