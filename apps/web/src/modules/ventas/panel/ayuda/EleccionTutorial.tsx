// ─── "Ver tutorial": ¿video o recorrido guiado? ──────────────────────────────
//
// Al tocar "Ver tutorial" (la barra de arriba, la fila del celular o el aviso del
// módulo) se elige cómo aprender la pantalla:
//   · Video: el tutorial grabado, alojado en YouTube (videos.ts lo pide a la API). Si la pantalla
//     tiene varios, primero la lista; con uno solo, se reproduce directo.
//   · Recorrido guiado: los pasos sobre la pantalla real (Recorrido.tsx).
// Si la pantalla todavía no tiene video, la opción se ve pero no se puede tocar.

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, MousePointerClick, PlayCircle, X } from 'lucide-react'
import { EstilosAyuda } from './piezas'
import { useVideosDe, type VideoTutorial } from './videos'

interface Props {
    clave: string
    /** false si la pantalla no tiene recorrido (solo videos). */
    hayRecorrido: boolean
    onRecorrido: () => void
    onCerrar: () => void
}

export default function EleccionTutorial({ clave, hayRecorrido, onRecorrido, onCerrar }: Props) {
    const cargados = useVideosDe(clave)
    const videos = cargados ?? []
    const [vista, setVista] = useState<'elegir' | 'lista'>('elegir')
    const [video, setVideo] = useState<VideoTutorial | null>(null)
    const primero = useRef<HTMLButtonElement>(null)

    useEffect(() => { primero.current?.focus() }, [vista, video])
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [onCerrar])

    const abrirVideos = () => {
        if (videos.length === 1) setVideo(videos[0])
        else setVista('lista')
    }
    // "Volver" desde el video: a la lista si se llegó por ahí, si no a la elección.
    const volver = () => {
        if (video) setVideo(null)
        else setVista('elegir')
    }

    const cerrarBtn = (
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ayu-cerrar">
            <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>
    )
    const volverBtn = (
        <button type="button" onClick={volver} className="ayv-volver" ref={video ? primero : undefined}>
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Volver
        </button>
    )

    let contenido: React.ReactNode
    if (video) {
        contenido = (
            <div className="ayu-tarjeta ayv-tarjeta ayv-ancha" role="dialog" aria-modal="true" aria-label={video.titulo} onClick={e => e.stopPropagation()}>
                {cerrarBtn}
                <div className="ayv-cab">{volverBtn}</div>
                <h2 className="ayu-h2 ayv-h2">{video.titulo}</h2>
                <div className="ayv-marco">
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                        title={video.titulo}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                </div>
                {hayRecorrido && (
                    <p className="ayv-pie">
                        ¿Preferís verlo en tu pantalla?{' '}
                        <button type="button" className="ayu-link" onClick={onRecorrido}>Recorrido guiado</button>
                    </p>
                )}
            </div>
        )
    } else if (vista === 'lista') {
        contenido = (
            <div className="ayu-tarjeta ayv-tarjeta" role="dialog" aria-modal="true" aria-label="Videos de esta pantalla" onClick={e => e.stopPropagation()}>
                {cerrarBtn}
                <div className="ayv-cab">{volverBtn}</div>
                <h2 className="ayu-h2">¿Qué querés ver?</h2>
                <div className="ayv-opciones">
                    {videos.map((v, i) => (
                        <button key={v.id} type="button" className="ayv-opcion" onClick={() => setVideo(v)} ref={i === 0 ? primero : undefined}>
                            <PlayCircle size={20} strokeWidth={1.7} aria-hidden="true" className="ayv-icono" />
                            <span className="ayv-txt"><span className="ayv-titulo">{v.titulo}</span></span>
                            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className="ayv-flecha" />
                        </button>
                    ))}
                </div>
            </div>
        )
    } else {
        const sinVideo = videos.length === 0
        contenido = (
            <div className="ayu-tarjeta ayv-tarjeta" role="dialog" aria-modal="true" aria-label="¿Cómo querés verlo?" onClick={e => e.stopPropagation()}>
                {cerrarBtn}
                <div className="ayu-etiqueta">Tutorial</div>
                <h2 className="ayu-h2">¿Cómo querés verlo?</h2>
                <div className="ayv-opciones">
                    <button type="button" className="ayv-opcion" onClick={abrirVideos} disabled={sinVideo} ref={sinVideo ? undefined : primero}>
                        <PlayCircle size={20} strokeWidth={1.7} aria-hidden="true" className="ayv-icono" />
                        <span className="ayv-txt">
                            <span className="ayv-titulo">Video</span>
                            <span className="ayv-desc">
                                {cargados === null ? 'Buscando videos…'
                                    : sinVideo ? 'Muy pronto para esta pantalla.'
                                    : videos.length === 1 ? 'Mirá cómo se hace, con voz.'
                                        : `${videos.length} videos cortos, con voz.`}
                            </span>
                        </span>
                        {!sinVideo && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className="ayv-flecha" />}
                    </button>
                    {hayRecorrido && (
                        <button type="button" className="ayv-opcion" onClick={onRecorrido} ref={sinVideo ? primero : undefined}>
                            <MousePointerClick size={20} strokeWidth={1.7} aria-hidden="true" className="ayv-icono" />
                            <span className="ayv-txt">
                                <span className="ayv-titulo">Recorrido guiado</span>
                                <span className="ayv-desc">Paso a paso sobre tu pantalla, a tu ritmo.</span>
                            </span>
                            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className="ayv-flecha" />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <>
            <EstilosAyuda />
            <style>{CSS_ELECCION}</style>
            <div className="ayu-velo" onClick={onCerrar}>{contenido}</div>
        </>
    )
}

const CSS_ELECCION = `
.ayv-tarjeta { padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
.ayv-ancha { max-width: 880px; }
.ayv-cab { display: flex; align-items: center; min-height: 40px; margin: -8px 40px 4px -8px; }
.ayv-volver {
    display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 10px;
    border: none; border-radius: 8px; background: none; cursor: pointer; font-family: inherit;
    font-size: 13.5px; font-weight: 500; color: var(--color-muted);
    transition: background-color 150ms ease, color 150ms ease;
}
.ayv-volver:hover { background: var(--color-surface-alt); color: var(--color-text); }
.ayv-volver:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.ayv-h2 { padding-right: 36px; }
.ayv-opciones { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.ayv-opcion {
    width: 100%; min-height: 64px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;
    border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg); color: var(--color-text);
    font-family: inherit; text-align: left; cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease;
}
.ayv-opcion:hover:not(:disabled) { background: var(--color-surface-alt); border-color: var(--color-border-strong); }
.ayv-opcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.ayv-opcion:disabled { cursor: default; opacity: 0.55; }
.ayv-icono { flex-shrink: 0; color: var(--color-muted); }
.ayv-txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ayv-titulo { font-size: 15px; font-weight: 600; line-height: 1.35; }
.ayv-desc { font-size: 13.5px; line-height: 1.45; color: var(--color-muted); }
.ayv-flecha { flex-shrink: 0; color: var(--color-muted); }
.ayv-marco {
    position: relative; width: 100%; aspect-ratio: 16 / 9; margin-top: 12px;
    border-radius: 12px; overflow: hidden; background: #000;
}
.ayv-marco iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.ayv-pie { margin: 12px 0 0; font-size: 13.5px; color: var(--color-muted); }
.ayv-pie .ayu-link { font-size: 13.5px; min-height: 0; }
@media (prefers-reduced-motion: reduce) { .ayv-opcion, .ayv-volver { transition: none; } }
`
