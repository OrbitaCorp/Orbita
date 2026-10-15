// ─── Foco: resalta el botón que hay que tocar ────────────────────────────────
//
// Sin cursor fantasma ni animaciones: la pantalla se atenúa y se difumina con
// un degradado, y el botón del paso queda nítido, con un aro y una frase corta
// al lado. No bloquea nada (pointer-events: none): quien quiera tocar otra cosa
// puede hacerlo, y en cuanto toca el botón el foco se va.
//
// El botón se encuentra por `data-ayuda="<objetivo>"`, no por su texto: si
// alguien le cambia el rótulo, el foco sigue andando. Sin el atributo (o con el
// botón fuera de pantalla) simplemente no se dibuja nada.

import { useEffect, useState } from 'react'

interface Props {
    /** Valor de data-ayuda del botón a resaltar. */
    objetivo: string
    texto: string
}

interface Caja { top: number; left: number; width: number; height: number }

const AIRE = 8
const ALTO_FRASE = 44

function buscar(objetivo: string): HTMLElement | null {
    const candidatos = document.querySelectorAll<HTMLElement>(`[data-ayuda="${objetivo}"]`)
    for (const el of Array.from(candidatos)) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return el
    }
    return null
}

export default function Foco({ objetivo, texto }: Props) {
    const [caja, setCaja] = useState<Caja | null>(null)
    const [tocado, setTocado] = useState(false)

    useEffect(() => {
        let el: HTMLElement | null = null
        let yaCentrado = false
        const alTocar = () => setTocado(true)

        // La pantalla de atrás se arma sola y puede mover el botón (cargas,
        // scroll, girar el celular): se vuelve a medir cada tanto en vez de
        // confiar en un solo cálculo.
        const medir = () => {
            const actual = buscar(objetivo)
            if (actual !== el) {
                el?.removeEventListener('click', alTocar, true)
                el = actual
                el?.addEventListener('click', alTocar, true)
            }
            if (!el) { setCaja(prev => (prev ? null : prev)); return }
            const r = el.getBoundingClientRect()
            // Si el botón quedó fuera de la pantalla se lo trae, una sola vez y
            // sin animación.
            if (!yaCentrado) {
                yaCentrado = true
                if (r.bottom < 0 || r.top > window.innerHeight) el.scrollIntoView({ block: 'center' })
            }
            setCaja(prev => (
                prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
                    ? prev
                    : { top: r.top, left: r.left, width: r.width, height: r.height }
            ))
        }
        medir()
        const t = setInterval(medir, 300)
        window.addEventListener('resize', medir)
        return () => {
            clearInterval(t)
            window.removeEventListener('resize', medir)
            el?.removeEventListener('click', alTocar, true)
        }
    }, [objetivo])

    if (!caja || tocado) return null

    const cx = caja.left + caja.width / 2
    const cy = caja.top + caja.height / 2
    // El círculo nítido cubre el botón con un poco de aire; de ahí hacia afuera
    // se va oscureciendo y desenfocando de a poco.
    const radio = Math.hypot(caja.width, caja.height) / 2 + AIRE
    const mascara = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${radio}px, #000 ${radio + 140}px)`
    // La frase va debajo del botón; si no entra, arriba.
    const abajo = caja.top + caja.height + AIRE + ALTO_FRASE + 12 < window.innerHeight
    const top = abajo ? caja.top + caja.height + AIRE + 8 : caja.top - AIRE - 8 - ALTO_FRASE
    const ancho = Math.min(260, window.innerWidth - 24)
    const left = Math.max(12, Math.min(cx - ancho / 2, window.innerWidth - ancho - 12))

    return (
        <div aria-hidden="true" className="ayu-foco" style={{ position: 'fixed', inset: 0, zIndex: 140, pointerEvents: 'none' }}>
            <style>{CSS_FOCO}</style>
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
            <div style={{
                position: 'absolute', top, left, width: ancho, minHeight: ALTO_FRASE, transition: 'top 160ms ease, left 160ms ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                padding: '8px 12px', borderRadius: 10, boxSizing: 'border-box',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                border: '1px solid var(--color-border-strong)',
                fontSize: 14, fontWeight: 600, lineHeight: 1.35,
                boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            }}>
                {texto}
            </div>
        </div>
    )
}

// Aparece con un fundido corto (no se mueve): el foco entra suave y se queda quieto.
const CSS_FOCO = `
.ayu-foco { animation: ayuFoco 280ms ease-out; }
@keyframes ayuFoco { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .ayu-foco { animation: none; } }
`
