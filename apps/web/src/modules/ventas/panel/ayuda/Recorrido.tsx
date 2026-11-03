// ─── Recorrido: el tutorial de un módulo, sobre la pantalla real ──────────────
//
// Un paso por vez: el elemento señalado queda nítido (Penumbra) y al lado, o
// abajo en el celular, una explicación de dos renglones con [Siguiente]. No
// navega, no mueve nada y se puede omitir en cualquier momento; la pantalla
// sigue usable mientras tanto.
//
// Un paso sin `donde` es solo la explicación, sin resaltar nada. Un paso
// `opcional` se salta solo si lo que señala no está en la pantalla (por ejemplo,
// un botón que solo aparece cuando hay datos).

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Penumbra, useCaja } from './Penumbra'
import type { Recorrido as RecorridoDef } from './recorridos'

interface Props {
    recorrido: RecorridoDef
    onCerrar: () => void
    /** Tocó lo señalado en un paso que sigue con otra guía (ver PasoRecorrido.alTocar). */
    onAbrir?: (clave: string) => void
}

const ANCHO = 320
const ALTO_ESTIMADO = 190
const AIRE = 16

export default function Recorrido({ recorrido, onCerrar, onAbrir }: Props) {
    const { pasos } = recorrido
    const [i, setI] = useState(0)
    const paso = pasos[i]
    const ultimo = i === pasos.length - 1
    const movil = typeof window !== 'undefined' && window.innerWidth < 640
    const { caja, noEncontrado } = useCaja(paso.donde, String(i), movil, () => { if (paso.alTocar) onAbrir?.(paso.alTocar) })

    const siguiente = useCallback(() => {
        if (i >= pasos.length - 1) onCerrar()
        else setI(i + 1)
    }, [i, pasos.length, onCerrar])

    // Un paso opcional cuyo elemento no está en la pantalla se salta solo.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (paso.opcional && paso.donde && noEncontrado) siguiente()
    }, [paso, noEncontrado, siguiente])

    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCerrar()
            else if (e.key === 'ArrowRight') siguiente()
            else if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1))
        }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [onCerrar, siguiente])

    // En el celular la explicación va al pie. En la compu, pegada al elemento
    // (debajo; arriba si no entra); sin elemento, abajo a la derecha.
    let posicion: React.CSSProperties
    if (movil) {
        posicion = { left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))' }
    } else if (caja && paso.donde) {
        const entraAbajo = caja.top + caja.height + AIRE + ALTO_ESTIMADO < window.innerHeight
        const top = entraAbajo ? caja.top + caja.height + AIRE : Math.max(12, caja.top - AIRE - ALTO_ESTIMADO)
        const left = Math.max(12, Math.min(caja.left + caja.width / 2 - ANCHO / 2, window.innerWidth - ANCHO - 12))
        posicion = { top, left, width: ANCHO }
    } else {
        posicion = { right: 20, bottom: 20, width: ANCHO }
    }

    return (
        <>
            {caja && paso.donde && <Penumbra caja={caja} />}
            <div className="ayu-rec" data-ayuda-ui role="dialog" aria-label={`Tutorial de ${recorrido.titulo}`} style={posicion}>
                <div className="ayu-rec-cab">
                    <span className="ayu-rec-n">{i + 1} de {pasos.length}</span>
                    <button type="button" className="ayu-rec-omitir" onClick={onCerrar}>
                        Omitir <X size={13} strokeWidth={2} aria-hidden="true" />
                    </button>
                </div>
                <div className="ayu-rec-titulo">{paso.titulo}</div>
                <p className="ayu-rec-texto">{paso.texto}</p>
                <div className="ayu-rec-pie">
                    {i > 0 && <button type="button" className="ayu-link ayu-link-sec" onClick={() => setI(i - 1)}>Anterior</button>}
                    <button type="button" className="ayu-btn ayu-btn-prim ayu-btn-chico" onClick={siguiente} autoFocus>
                        {ultimo ? 'Listo' : 'Siguiente'}
                    </button>
                </div>
            </div>
        </>
    )
}
