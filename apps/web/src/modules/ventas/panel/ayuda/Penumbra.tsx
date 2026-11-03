// ─── Penumbra: atenúa y difumina todo menos lo señalado ──────────────────────
//
// Es el "foco" de la ayuda: la pantalla se oscurece y se desenfoca con un
// degradado que se abre alrededor del elemento, y el elemento queda nítido con
// un aro. Estática (solo un fundido de entrada) y sin capturar clics: la
// persona puede tocar lo que quiera mientras la ayuda está abierta.

import { useEffect, useRef, useState } from 'react'
import { traerAVista, type Donde, ubicar } from './ubicar'

export interface Caja { top: number; left: number; width: number; height: number }

const AIRE = 8

/**
 * Sigue a un elemento de la pantalla: lo busca (la pantalla puede tardar en
 * armarse), lo trae a la vista y vuelve a medirlo cada tanto por si se mueve.
 * `noEncontrado` pasa a true si después de un rato no apareció.
 */
export function useCaja(donde: Donde | null | undefined, clave: string, movil: boolean, alTocar?: () => void) {
    const [caja, setCaja] = useState<Caja | null>(null)
    const [noEncontrado, setNoEncontrado] = useState(false)
    const dondeRef = useRef(donde)
    const alTocarRef = useRef(alTocar)
    useEffect(() => { dondeRef.current = donde; alTocarRef.current = alTocar })

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCaja(null)
        setNoEncontrado(false)
        if (!dondeRef.current) return
        let el: HTMLElement | null = null
        let intentos = 0
        const tocado = () => alTocarRef.current?.()
        const medir = () => {
            const d = dondeRef.current
            const actual = d ? ubicar(d) : null
            if (actual !== el) {
                el?.removeEventListener('click', tocado, true)
                el = actual
                if (el) {
                    el.addEventListener('click', tocado, true)
                    traerAVista(el, movil)
                }
            }
            if (!el) {
                intentos += 1
                if (intentos >= 6) setNoEncontrado(true)
                setCaja(prev => (prev ? null : prev))
                return
            }
            setNoEncontrado(false)
            const r = el.getBoundingClientRect()
            setCaja(prev => (
                prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
                    ? prev
                    : { top: r.top, left: r.left, width: r.width, height: r.height }
            ))
        }
        medir()
        const t = setInterval(medir, 250)
        window.addEventListener('resize', medir)
        return () => {
            clearInterval(t)
            window.removeEventListener('resize', medir)
            el?.removeEventListener('click', tocado, true)
        }
    }, [clave, movil])

    return { caja, noEncontrado }
}

export function Penumbra({ caja }: { caja: Caja }) {
    const cx = caja.left + caja.width / 2
    const cy = caja.top + caja.height / 2
    // El círculo nítido cubre lo señalado con un poco de aire; de ahí hacia afuera
    // se va oscureciendo y desenfocando de a poco.
    const radio = Math.min(Math.hypot(caja.width, caja.height) / 2 + AIRE, 420)
    const mascara = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${radio}px, #000 ${radio + 140}px)`
    return (
        <div aria-hidden="true" data-ayuda-ui className="ayu-penumbra" style={{ position: 'fixed', inset: 0, zIndex: 220, pointerEvents: 'none' }}>
            <style>{CSS_PENUMBRA}</style>
            <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(circle at ${cx}px ${cy}px, rgba(15,23,42,0) ${radio}px, rgba(15,23,42,0.58) ${radio + 220}px)`,
                backdropFilter: 'blur(3px)',
                WebkitBackdropFilter: 'blur(3px)',
                maskImage: mascara,
                WebkitMaskImage: mascara,
            }} />
            <div style={{
                position: 'absolute',
                top: caja.top - 4, left: caja.left - 4, width: caja.width + 8, height: caja.height + 8,
                borderRadius: 12, transition: 'top 160ms ease, left 160ms ease, width 160ms ease, height 160ms ease',
                boxShadow: '0 0 0 2px var(--color-primary), 0 0 26px 4px color-mix(in srgb, var(--color-primary) 45%, transparent)',
            }} />
        </div>
    )
}

// Aparece con un fundido corto (no se mueve): el foco entra suave y se queda quieto.
const CSS_PENUMBRA = `
.ayu-penumbra { animation: ayuFoco 280ms ease-out; }
@keyframes ayuFoco { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .ayu-penumbra { animation: none; } }
`
