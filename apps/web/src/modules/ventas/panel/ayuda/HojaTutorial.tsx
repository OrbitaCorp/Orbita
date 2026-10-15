// ─── Tutorial de un módulo: una hoja, una cosa por pantalla ──────────────────
//
// En el celular sube desde abajo y se recorre de a una pantalla (qué es el
// módulo → un tema por vez); en la computadora es un cuadro centrado. No mueve
// al usuario de lugar ni señala botones: explica con el mismo contenido del
// manual (pasos, definiciones, esquemas) y se puede omitir en cualquier momento.

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { BloqueVista } from '../manual/piezas'
import { Ilustracion } from '../manual/ilustraciones'
import type { AyudaResuelta } from './modulos'

interface Props {
    ayuda: AyudaResuelta
    onCerrar: () => void
    /** "Ver el manual completo": lleva al manual del panel. */
    onManual: () => void
}

export default function HojaTutorial({ ayuda, onCerrar, onManual }: Props) {
    const { titulo, capitulo, temas } = ayuda
    // Pantalla 0 = qué es el módulo; las demás, un tema cada una.
    const total = temas.length + 1
    const [i, setI] = useState(0)
    const cuerpo = useRef<HTMLDivElement>(null)
    const principal = useRef<HTMLButtonElement>(null)
    const ultima = i === total - 1
    const tema = i > 0 ? temas[i - 1] : null

    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
        window.addEventListener('keydown', alTeclear)
        // Con la hoja abierta la página de atrás no se desplaza.
        const previo = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        principal.current?.focus()
        return () => {
            window.removeEventListener('keydown', alTeclear)
            document.body.style.overflow = previo
        }
    }, [onCerrar])

    useEffect(() => { cuerpo.current?.scrollTo({ top: 0 }) }, [i])

    return (
        <div className="ayu-fondo" onClick={onCerrar}>
            <style>{CSS_HOJA}</style>
            <div
                className="ayu-hoja ayu-man"
                role="dialog"
                aria-modal="true"
                aria-label={`Cómo funciona ${titulo}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="ayu-barra">
                    <span className="ayu-pasos" aria-live="polite">{i + 1} de {total}</span>
                    <button type="button" className="ayu-omitir" onClick={onCerrar}>
                        Omitir <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                </div>
                <div className="ayu-progreso" aria-hidden="true">
                    <span style={{ width: `${((i + 1) / total) * 100}%` }} />
                </div>

                <div className="ayu-cuerpo" ref={cuerpo}>
                    {tema ? (
                        <>
                            <h2 className="ayu-titulo">{tema.titulo}</h2>
                            {tema.ilustracion && <Ilustracion id={tema.ilustracion} />}
                            <div className="ayu-bloques">
                                {tema.bloques.map((b, n) => <BloqueVista key={n} bloque={b} />)}
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className="ayu-titulo">Cómo funciona {titulo}</h2>
                            <p className="ayu-resumen">{capitulo.resumen}</p>
                            {capitulo.ilustracion && <Ilustracion id={capitulo.ilustracion} />}
                        </>
                    )}
                </div>

                <div className="ayu-pie">
                    {i > 0 ? (
                        <button type="button" className="ayu-sec" onClick={() => setI(i - 1)}>Anterior</button>
                    ) : (
                        <button type="button" className="ayu-sec" onClick={onManual}>Ver el manual</button>
                    )}
                    <button
                        ref={principal}
                        type="button"
                        className="ayu-prim"
                        onClick={() => (ultima ? onCerrar() : setI(i + 1))}
                    >
                        {ultima ? 'Listo' : 'Siguiente'}
                        {!ultima && <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />}
                    </button>
                </div>
            </div>
        </div>
    )
}

// El chip de botón, las definiciones y el marco de las figuras viven en el CSS
// del Manual (que no se carga fuera de esa pantalla): se repiten acá, en
// versión de una sola columna para el celular.
const CSS_HOJA = `
.ayu-fondo {
    position: fixed; inset: 0; z-index: 250;
    display: flex; align-items: flex-end; justify-content: center;
    background: rgba(15, 23, 42, 0.45);
}
.ayu-hoja {
    width: 100%; max-width: 520px; max-height: 92dvh;
    display: flex; flex-direction: column;
    background: var(--color-bg); color: var(--color-text);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
    animation: ayuSube 220ms ease-out;
}
@keyframes ayuSube { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
@media (min-width: 640px) {
    .ayu-fondo { align-items: center; padding: 24px; }
    .ayu-hoja { border-radius: 16px; max-height: 86dvh; }
}
@media (prefers-reduced-motion: reduce) { .ayu-hoja { animation: none; } }

.ayu-barra { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px 20px; }
.ayu-pasos { font-size: 13px; font-weight: 500; color: var(--color-muted); font-variant-numeric: tabular-nums; }
.ayu-omitir {
    display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 8px;
    border: none; background: none; cursor: pointer; font-family: inherit;
    font-size: 13.5px; font-weight: 500; color: var(--color-muted);
}
.ayu-omitir:hover { color: var(--color-text); }
.ayu-progreso { height: 2px; background: var(--color-border); }
.ayu-progreso > span { display: block; height: 100%; background: var(--color-primary); transition: width 200ms ease; }

.ayu-cuerpo { flex: 1; min-height: 0; overflow-y: auto; padding: 22px 20px 12px; overscroll-behavior: contain; }
.ayu-titulo { margin: 0 0 14px; font-size: 20px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.3; }
.ayu-resumen { margin: 0 0 18px; font-size: 15px; line-height: 1.65; color: var(--color-body); }
.ayu-bloques { display: flex; flex-direction: column; gap: 16px; }
.ayu-cuerpo figure { margin: 0 0 18px; }

.ayu-pie {
    display: flex; gap: 10px; justify-content: space-between;
    padding: 12px 20px calc(14px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-border);
}
.ayu-pie button {
    min-height: 46px; padding: 0 20px; border-radius: 10px; cursor: pointer; font-family: inherit;
    font-size: 15px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.ayu-sec { border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); }
.ayu-prim { flex: 1; max-width: 220px; border: none; background: var(--color-primary); color: #fff; margin-left: auto; }
.ayu-fondo button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.ayu-man .man-btn {
    display: inline-flex; align-items: center;
    height: 22px; padding: 0 8px; border-radius: 6px;
    border: 1px solid var(--color-border-strong); background: var(--color-surface-alt);
    color: var(--color-text); font-size: 12.5px; font-weight: 600; line-height: 1;
    white-space: nowrap; vertical-align: baseline; margin: 0 1px;
}
.ayu-man .man-campos > div { display: block; padding: 10px 0; border-top: 1px solid var(--color-border); }
.ayu-man .man-campos > div:first-child { border-top: none; padding-top: 2px; }
.ayu-man .man-campos dt { font-size: 14px; font-weight: 600; line-height: 1.5; color: var(--color-text); }
.ayu-man .man-campos dd { margin: 2px 0 0; }
.ayu-man .man-fig {
    width: 100%; border: 1px solid var(--color-border); border-radius: 8px;
    background: var(--color-surface); padding: 12px; box-sizing: border-box;
}
.ayu-man .man-fig svg { display: block; width: 100%; height: auto; }
`
