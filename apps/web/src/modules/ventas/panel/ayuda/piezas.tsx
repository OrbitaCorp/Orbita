// ─── Piezas visuales de la ayuda ─────────────────────────────────────────────
//
// La tarjeta de los primeros pasos y la sugerencia flotante. Criterio: lindo
// sin ser recargado — botones con hover y foco visibles, una entrada suave de
// pocas décimas, y nada que se mueva de forma rara. Todo el movimiento se
// apaga con "reducir movimiento" del sistema.

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function EstilosAyuda() {
    return <style>{CSS_AYUDA}</style>
}

interface PropsTarjeta {
    etiqueta: string
    titulo: string
    texto: string
    boton: string
    onBoton: () => void
    secundario?: string
    onSecundario: () => void
    /** Un tercer botón de texto, para "Ahora no" cuando el secundario es otra opción real. */
    terciario?: string
    onTerciario?: () => void
    /** Qué hace tocar afuera o la X. Si se pasa, el secundario es una opción más (no un "después"). */
    cerrar?: () => void
    /** Avance del flujo: "Categoría" → "Producto". */
    pasos?: { actual: number; nombres: readonly string[] }
}

/** Tarjeta central (hoja desde abajo en el celular) para pedir una acción. */
export function Tarjeta(p: PropsTarjeta) {
    const principal = useRef<HTMLButtonElement>(null)
    useEffect(() => { principal.current?.focus() }, [])
    const alCerrar = p.cerrar ?? p.onSecundario
    return (
        <div className="ayu-velo" onClick={alCerrar}>
            <div
                className="ayu-tarjeta"
                role="dialog"
                aria-modal="true"
                aria-label={p.titulo}
                onClick={e => e.stopPropagation()}
            >
                <button type="button" onClick={alCerrar} aria-label="Cerrar" className="ayu-cerrar">
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                </button>
                {p.pasos && (
                    <div className="ayu-pasos" aria-hidden="true">
                        {p.pasos.nombres.map((n, i) => (
                            <div key={n} className={i < p.pasos!.actual ? 'ayu-paso ayu-paso-on' : 'ayu-paso'}>
                                <span />
                                <small>{n}</small>
                            </div>
                        ))}
                    </div>
                )}
                <div className="ayu-etiqueta">{p.etiqueta}</div>
                <h2 className="ayu-h2">{p.titulo}</h2>
                <p className="ayu-p">{p.texto}</p>
                <div className="ayu-botones">
                    <button ref={principal} type="button" onClick={p.onBoton} className="ayu-btn ayu-btn-prim ayu-btn-grande">
                        {p.boton}
                    </button>
                    {p.secundario && (
                        <button type="button" onClick={p.onSecundario} className={p.cerrar ? 'ayu-btn ayu-btn-sec' : 'ayu-btn ayu-btn-txt'}>
                            {p.secundario}
                        </button>
                    )}
                    {p.terciario && p.onTerciario && (
                        <button type="button" onClick={p.onTerciario} className="ayu-btn ayu-btn-txt">{p.terciario}</button>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Sugerencia que entra de derecha a izquierda: arriba en el celular, abajo a la derecha en la compu. */
export function SugerenciaFlotante(p: {
    accion: string
    onSabe: () => void
    onNoSabe: () => void
    /** Se ignoró un rato: se va sola. */
    onExpira: () => void
}) {
    // Si nadie la toca, se retira sola; con el mouse encima espera.
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { onExpira } = p
    const armar = () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(onExpira, 25_000)
    }
    useEffect(() => {
        armar()
        return () => { if (timer.current) clearTimeout(timer.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return (
        <div
            className="ayu-sug"
            role="region"
            aria-label="Sugerencia de tutorial"
            onMouseEnter={() => { if (timer.current) clearTimeout(timer.current) }}
            onMouseLeave={armar}
        >
            <div className="ayu-sug-titulo">¿Ya sabés {p.accion}?</div>
            <div className="ayu-sug-texto">Si no, te mostramos cómo en un minuto.</div>
            <div className="ayu-sug-botones">
                <button type="button" onClick={p.onNoSabe} className="ayu-btn ayu-btn-prim">No, mostrame</button>
                <button type="button" onClick={p.onSabe} className="ayu-btn ayu-btn-sec">Sí, ya sé</button>
            </div>
        </div>
    )
}

const CSS_AYUDA = `
.ayu-btn {
    min-height: 44px; padding: 0 18px; border-radius: 10px; cursor: pointer;
    font-family: inherit; font-size: 14.5px; font-weight: 600; line-height: 1;
    border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center;
    transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease, color 150ms ease;
}
.ayu-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.ayu-btn-grande { min-height: 50px; font-size: 16px; }
.ayu-btn-prim { flex: 1; background: var(--color-primary); color: #fff; }
.ayu-btn-prim:hover { transform: translateY(-1px); filter: brightness(1.07); box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 38%, transparent); }
.ayu-btn-prim:active { transform: none; box-shadow: none; }
.ayu-btn-sec { background: var(--color-bg); color: var(--color-text); border-color: var(--color-border); }
.ayu-btn-sec:hover { background: var(--color-surface-alt); border-color: var(--color-border-strong); }
.ayu-btn-txt { background: none; color: var(--color-muted); }
.ayu-btn-txt:hover { background: var(--color-surface-alt); color: var(--color-text); }

.ayu-velo {
    position: fixed; inset: 0; z-index: 250; display: flex; align-items: flex-end; justify-content: center;
    padding: 12px; background: rgba(15, 23, 42, 0.5);
    -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
    animation: ayuVelo 200ms ease-out;
}
@media (min-width: 640px) { .ayu-velo { align-items: center; } }
.ayu-tarjeta {
    position: relative; width: 100%; max-width: 440px; box-sizing: border-box;
    background: var(--color-bg); color: var(--color-text);
    border: 1px solid var(--color-border); border-radius: 18px;
    padding: 22px 20px calc(20px + env(safe-area-inset-bottom));
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.26);
    animation: ayuEntra 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ayu-cerrar {
    position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; border: none; border-radius: 10px;
    background: none; color: var(--color-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background-color 150ms ease, color 150ms ease;
}
.ayu-cerrar:hover { background: var(--color-surface-alt); color: var(--color-text); }
.ayu-cerrar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.ayu-etiqueta { font-size: 13px; font-weight: 500; color: var(--color-muted); margin-bottom: 6px; padding-right: 36px; }
.ayu-h2 { margin: 0 0 8px; font-size: 21px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.3; }
.ayu-p { margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: var(--color-body); }
.ayu-botones { display: flex; flex-direction: column; gap: 8px; }

.ayu-pasos { display: flex; gap: 8px; margin: 0 36px 16px 0; }
.ayu-paso { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.ayu-paso > span { height: 4px; border-radius: 2px; background: var(--color-border); transition: background-color 250ms ease; }
.ayu-paso-on > span { background: var(--color-primary); }
.ayu-paso > small { font-size: 12px; font-weight: 500; color: var(--color-muted); }
.ayu-paso-on > small { color: var(--color-text); }

.ayu-sug {
    position: fixed; z-index: 160; box-sizing: border-box;
    background: var(--color-bg); color: var(--color-text);
    border: 1px solid var(--color-border-strong); border-radius: 16px; padding: 16px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
    animation: ayuDesliza 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@media (max-width: 639px) { .ayu-sug { top: 68px; left: 12px; right: 12px; } }
@media (min-width: 640px) { .ayu-sug { bottom: 20px; right: 20px; width: 360px; } }
.ayu-sug-titulo { font-size: 15.5px; font-weight: 600; line-height: 1.4; }
.ayu-sug-texto { margin-top: 3px; font-size: 13.5px; color: var(--color-muted); line-height: 1.5; }
.ayu-sug-botones { display: flex; gap: 8px; margin-top: 14px; }
.ayu-sug-botones .ayu-btn { min-height: 42px; padding: 0 14px; font-size: 14px; }

@keyframes ayuVelo { from { opacity: 0 } to { opacity: 1 } }
@keyframes ayuEntra { from { opacity: 0; transform: translateY(14px) scale(0.98) } to { opacity: 1; transform: none } }
@keyframes ayuDesliza { from { opacity: 0; transform: translateX(36px) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) {
    .ayu-velo, .ayu-tarjeta, .ayu-sug { animation: none; }
    .ayu-btn, .ayu-paso > span { transition: none; }
    .ayu-btn-prim:hover { transform: none; }
}
`
