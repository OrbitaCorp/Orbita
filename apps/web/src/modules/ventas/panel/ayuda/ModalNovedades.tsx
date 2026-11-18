import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    ArrowUpRight, Check, CheckCircle2, ChevronLeft, ChevronRight,
    Image as ImageIcon, Maximize2, Sparkles, X,
} from 'lucide-react'
import type { SeccionDelPanel } from '../secciones'
import type { Novedad } from './novedades'

interface Props {
    novedades: readonly Novedad[]
    indiceInicial?: number
    onCerrar: () => void
    onIrA: (seccion: SeccionDelPanel, query?: Record<string, string>) => void
    /** Se llama con cada novedad cuya diapositiva se mostró: eso es "leerla" (ver novedades.ts). */
    onLeida?: (id: string) => void
}

export default function ModalNovedades({ novedades, indiceInicial = 0, onCerrar, onIrA, onLeida }: Props) {
    const clampedInicial = Math.min(Math.max(0, indiceInicial), Math.max(0, novedades.length - 1))
    const [idx, setIdx] = useState(clampedInicial)
    const [imgIdx, setImgIdx] = useState(0)
    const [lightboxAbierto, setLightboxAbierto] = useState(false)
    const tarjetaRef = useRef<HTMLDivElement>(null)

    const novedad = novedades[idx]
    const total = novedades.length

    // Leída = su diapositiva estuvo en pantalla. Antes se marcaban todas al
    // abrir el modal, aunque se mirara solo la primera.
    const idActual = novedad?.id
    useEffect(() => {
        if (idActual) onLeida?.(idActual)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idActual])
    const imagenes = novedad?.imagenes
    const imagenesCount = imagenes?.length ?? 0
    const imgActualIdx = imagenesCount > 0 ? Math.min(imgIdx, imagenesCount - 1) : 0
    const imagenActual = imagenes?.[imgActualIdx]

    const cambiarPaso = (nuevoIdx: number) => {
        if (nuevoIdx < 0 || nuevoIdx >= total) return
        setIdx(nuevoIdx)
        setImgIdx(0)
        setLightboxAbierto(false)
    }

    const moverImagen = (delta: number) => {
        if (imagenesCount <= 1) return
        setImgIdx(prev => (prev + delta + imagenesCount) % imagenesCount)
    }

    useEffect(() => {
        tarjetaRef.current?.focus({ preventScroll: true })
    }, [])

    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (lightboxAbierto) {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    setLightboxAbierto(false)
                } else if (e.key === 'ArrowLeft' && imagenesCount > 1) {
                    e.preventDefault()
                    setImgIdx(prev => (prev - 1 + imagenesCount) % imagenesCount)
                } else if (e.key === 'ArrowRight' && imagenesCount > 1) {
                    e.preventDefault()
                    setImgIdx(prev => (prev + 1) % imagenesCount)
                }
                return
            }

            if (e.key === 'Escape') {
                e.preventDefault()
                onCerrar()
            } else if (e.key === 'ArrowLeft' && idx > 0) {
                e.preventDefault()
                setIdx(idx - 1)
                setImgIdx(0)
            } else if (e.key === 'ArrowRight' && idx < total - 1) {
                e.preventDefault()
                setIdx(idx + 1)
                setImgIdx(0)
            }
        }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [lightboxAbierto, imagenesCount, idx, total, onCerrar])

    if (!novedad || typeof document === 'undefined') return null

    const esUltima = idx >= total - 1
    const etiquetaMejoras = total === 1 ? '1 mejora' : `${total} mejoras`

    return createPortal(
        <>
            <style>{CSS_NOVEDADES}</style>
            <div className="nov-velo" onClick={onCerrar}>
                <div
                    ref={tarjetaRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="nov-modal-titulo"
                    className="nov-tarjeta"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Encabezado */}
                    <header className="nov-cab">
                        <div className="nov-cab-izq">
                            <div className="nov-cab-ico" aria-hidden="true">
                                <Sparkles size={16} strokeWidth={1.8} />
                            </div>
                            <h2 id="nov-modal-titulo" className="nov-cab-titulo">
                                Novedades en tu panel
                            </h2>
                            <span className="nov-cab-pill">{etiquetaMejoras}</span>
                        </div>

                        <div className="nov-cab-der">
                            {total > 1 && (
                                <div className="nov-kbd-grupo" aria-hidden="true" title="Navegá con las flechas del teclado">
                                    <kbd className="nov-kbd">←</kbd>
                                    <kbd className="nov-kbd">→</kbd>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={onCerrar}
                                aria-label="Cerrar novedades"
                                className="nov-cerrar"
                            >
                                <X size={16} strokeWidth={1.9} aria-hidden="true" />
                            </button>
                        </div>
                    </header>

                    {/* Barra de progreso segmentada */}
                    {total > 1 && (
                        <div className="nov-progreso" role="tablist" aria-label="Navegación de novedades">
                            {novedades.map((item, i) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={i === idx}
                                    aria-label={`Ir a ${i + 1}: ${item.titulo}`}
                                    onClick={() => cambiarPaso(i)}
                                    className={`nov-seg ${i <= idx ? 'nov-seg-on' : ''}`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Cuerpo de la novedad actual */}
                    <div key={novedad.id} className="nov-cuerpo">
                        {imagenActual && (
                            <div>
                                <div className="nov-visor">
                                    <button
                                        type="button"
                                        onClick={() => setLightboxAbierto(true)}
                                        aria-label={`Ampliar imagen: ${imagenActual.epigrafe}`}
                                        className="nov-visor-zoom-area"
                                    >
                                        <img
                                            src={imagenActual.src}
                                            alt={imagenActual.epigrafe}
                                            className="nov-visor-img"
                                        />
                                    </button>

                                    <div className="nov-epigrafe">
                                        <ImageIcon size={12} strokeWidth={1.8} aria-hidden="true" />
                                        <span>
                                            {imagenesCount > 1
                                                ? `${imgActualIdx + 1}/${imagenesCount} · ${imagenActual.epigrafe}`
                                                : imagenActual.epigrafe}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setLightboxAbierto(true)}
                                        aria-label="Ampliar captura"
                                        title="Ampliar captura"
                                        className="nov-overlay-btn nov-zoom-btn"
                                    >
                                        <Maximize2 size={13} strokeWidth={1.9} aria-hidden="true" />
                                    </button>

                                    {imagenesCount > 1 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => moverImagen(-1)}
                                                aria-label="Captura anterior"
                                                className="nov-overlay-btn nov-img-prev"
                                            >
                                                <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moverImagen(1)}
                                                aria-label="Siguiente captura"
                                                className="nov-overlay-btn nov-img-next"
                                            >
                                                <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {imagenes && imagenesCount > 1 && (
                                    <div className="nov-thumbs" role="group" aria-label="Capturas adjuntas">
                                        {imagenes.map((img, i) => {
                                            const activa = i === imgActualIdx
                                            return (
                                                <button
                                                    key={img.src}
                                                    type="button"
                                                    onClick={() => setImgIdx(i)}
                                                    className={`nov-thumb ${activa ? 'nov-thumb-on' : ''}`}
                                                >
                                                    <span className="nov-thumb-num">{String(i + 1).padStart(2, '0')}</span>
                                                    <span className="nov-thumb-txt">{img.epigrafe}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="nov-info">
                            <div className="nov-meta">
                                <span className={`nov-badge ${novedad.etiqueta === 'Nuevo' ? 'nov-badge-nuevo' : 'nov-badge-mejora'}`}>
                                    {novedad.etiqueta}
                                </span>
                                <span className="nov-modulo">Módulo de {novedad.modulo}</span>
                            </div>

                            <h3 className="nov-h3">{novedad.titulo}</h3>
                            <p className="nov-p">{novedad.descripcion}</p>

                            {novedad.puntos && novedad.puntos.length > 0 && (
                                <ul className="nov-puntos">
                                    {novedad.puntos.map(punto => (
                                        <li key={punto} className="nov-punto">
                                            <CheckCircle2 size={14} strokeWidth={2} className="nov-punto-ico" aria-hidden="true" />
                                            <span>{punto}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Pie */}
                    <footer className="nov-pie">
                        <div className="nov-pie-izq">
                            <span className="nov-contador">
                                Actualización {idx + 1} de {total}
                            </span>
                            {total > 1 && (
                                <div className="nov-dots" role="group" aria-label="Pasos del carrusel">
                                    {novedades.map((item, i) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => cambiarPaso(i)}
                                            aria-label={`Paso ${i + 1}: ${item.titulo}`}
                                            className={`nov-dot ${i === idx ? 'nov-dot-on' : ''}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="nov-pie-der">
                            {novedad.irA && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCerrar()
                                        onIrA(novedad.irA!.seccion, novedad.irA!.query)
                                    }}
                                    className="nov-btn nov-btn-sec"
                                >
                                    <span>{novedad.irA.texto}</span>
                                    <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" />
                                </button>
                            )}

                            {total > 1 && (
                                <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => cambiarPaso(idx - 1)}
                                    className="nov-btn nov-btn-fantasma"
                                >
                                    <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
                                    <span>Anterior</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => (esUltima ? onCerrar() : cambiarPaso(idx + 1))}
                                className="nov-btn nov-btn-prim"
                            >
                                <span>{esUltima ? 'Entendido' : 'Siguiente'}</span>
                                {esUltima
                                    ? <Check size={14} strokeWidth={2.2} aria-hidden="true" />
                                    : <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>

            {/* Lightbox de captura ampliada */}
            {lightboxAbierto && imagenActual && (
                <div
                    className="nov-lb"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Vista ampliada: ${imagenActual.epigrafe}`}
                    onClick={() => setLightboxAbierto(false)}
                >
                    <div className="nov-lb-cab" onClick={e => e.stopPropagation()}>
                        <div className="nov-lb-meta">
                            {imagenesCount > 1 && (
                                <span className="nov-lb-count">{imgActualIdx + 1} / {imagenesCount}</span>
                            )}
                            <span>{imagenActual.epigrafe}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setLightboxAbierto(false)}
                            aria-label="Cerrar vista ampliada"
                            className="nov-lb-cerrar"
                        >
                            <X size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                    </div>

                    <div className="nov-lb-centro" onClick={e => e.stopPropagation()}>
                        {imagenesCount > 1 && (
                            <button
                                type="button"
                                onClick={() => moverImagen(-1)}
                                aria-label="Captura anterior"
                                className="nov-overlay-btn nov-lb-flecha"
                            >
                                <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
                            </button>
                        )}
                        <div className="nov-lb-marco">
                            <img src={imagenActual.src} alt={imagenActual.epigrafe} className="nov-lb-img" />
                        </div>
                        {imagenesCount > 1 && (
                            <button
                                type="button"
                                onClick={() => moverImagen(1)}
                                aria-label="Siguiente captura"
                                className="nov-overlay-btn nov-lb-flecha"
                            >
                                <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>,
        document.body,
    )
}

const CSS_NOVEDADES = `
.nov-velo {
    position: fixed; inset: 0; z-index: 300;
    display: flex; align-items: safe center; justify-content: center;
    padding: 16px; overflow-y: auto;
    background: rgba(15, 23, 42, 0.50);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
    animation: novVelo 180ms ease-out;
}
.dark .nov-velo { background: rgba(3, 6, 14, 0.72); }

.nov-tarjeta {
    width: 100%; max-width: 560px; outline: none;
    background: var(--color-surface); color: var(--color-text);
    border: 1px solid var(--color-border-strong); border-radius: 14px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
    overflow: hidden; display: flex; flex-direction: column;
    animation: novEntra 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.dark .nov-tarjeta { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 24px 64px rgba(0, 0, 0, 0.65); }
.nov-tarjeta button:focus-visible, .nov-lb button:focus-visible {
    outline: 2px solid var(--color-primary); outline-offset: 2px;
}

.nov-cab {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 16px; border-bottom: 1px solid var(--color-border);
}
.nov-cab-izq { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.nov-cab-ico {
    width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
    display: grid; place-items: center;
    background: var(--color-primary-bg); color: var(--color-primary);
}
.nov-cab-titulo { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); }
.nov-cab-pill {
    font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 6px;
    background: var(--color-surface-alt); color: var(--color-muted);
    border: 1px solid var(--color-border); font-variant-numeric: tabular-nums;
}
.nov-cab-der { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.nov-kbd-grupo { display: none; align-items: center; gap: 4px; }
@media (min-width: 640px) { .nov-kbd-grupo { display: flex; } }
.nov-kbd {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 22px; padding: 0 5px; border-radius: 5px;
    font-family: inherit; font-size: 11px; font-weight: 600;
    color: var(--color-muted); background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
}
.nov-cerrar {
    width: 32px; height: 32px; border-radius: 8px; border: none;
    background: transparent; color: var(--color-muted); cursor: pointer;
    display: grid; place-items: center; transition: background-color 140ms ease, color 140ms ease;
}
.nov-cerrar:hover { background: var(--color-surface-alt); color: var(--color-text); }

.nov-progreso { display: flex; gap: 6px; padding: 12px 16px 0; }
.nov-seg {
    flex: 1; height: 5px; border: none; border-radius: 9999px; padding: 0;
    background: var(--color-border); cursor: pointer;
    transition: background-color 180ms ease;
}
.nov-seg-on { background: var(--color-primary); }

.nov-cuerpo { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 14px; animation: novPaso 180ms ease-out; }

.nov-visor {
    position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 250px;
    border-radius: 10px; border: 1px solid var(--color-border);
    background: var(--color-bg); overflow: hidden;
}
.nov-visor-zoom-area {
    width: 100%; height: 100%; padding: 0; border: none; background: transparent;
    display: block; cursor: zoom-in;
}
.nov-visor-img { width: 100%; height: 100%; object-fit: contain; display: block; }
.nov-epigrafe {
    position: absolute; top: 10px; left: 10px; max-width: calc(100% - 58px);
    display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
    border-radius: 6px; font-size: 11px; font-weight: 500; pointer-events: none;
    background: rgba(11, 16, 29, 0.78); color: #E8EDF7;
    border: 1px solid rgba(255, 255, 255, 0.14);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
.nov-epigrafe > svg { flex-shrink: 0; }
.nov-epigrafe > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.nov-overlay-btn {
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(11, 16, 29, 0.76); color: #E8EDF7;
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    display: grid; place-items: center; cursor: pointer;
    transition: background-color 140ms ease;
}
.nov-overlay-btn:hover { background: rgba(11, 16, 29, 0.94); }
.nov-zoom-btn { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 6px; }
.nov-img-prev, .nov-img-next {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 28px; height: 28px; border-radius: 9999px;
}
.nov-img-prev { left: 10px; }
.nov-img-next { right: 10px; }

.nov-thumbs { display: flex; gap: 6px; margin-top: 8px; overflow-x: auto; scrollbar-width: none; }
.nov-thumbs::-webkit-scrollbar { display: none; }
.nov-thumb {
    display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
    padding: 5px 10px; border-radius: 7px; font-family: inherit; font-size: 11.5px; font-weight: 500;
    background: var(--color-bg); color: var(--color-muted);
    border: 1px solid var(--color-border); cursor: pointer;
    transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}
.nov-thumb:hover { border-color: var(--color-border-strong); color: var(--color-text); }
.nov-thumb-on {
    background: var(--color-primary-bg); border-color: var(--color-primary); color: var(--chip-primary-fg);
}
.nov-thumb-num { font-family: "Geist Mono", "Fira Code", monospace; font-variant-numeric: tabular-nums; }
.nov-thumb-txt { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.nov-info { display: flex; flex-direction: column; gap: 8px; }
.nov-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.nov-badge { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 9999px; }
.nov-badge-nuevo { background: var(--color-success-bg); color: var(--chip-success-fg); }
.nov-badge-mejora { background: var(--color-primary-bg); color: var(--chip-primary-fg); }
.nov-modulo { font-size: 12px; font-weight: 500; color: var(--color-muted); }
.nov-h3 { margin: 0; font-size: 17px; font-weight: 650; line-height: 1.3; letter-spacing: -0.015em; color: var(--color-text); }
.nov-p { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--color-body); }
.nov-puntos {
    margin: 2px 0 0; padding: 0; list-style: none;
    display: grid; grid-template-columns: 1fr; gap: 6px;
}
@media (min-width: 560px) { .nov-puntos { grid-template-columns: 1fr 1fr; gap: 8px; } }
.nov-punto { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; line-height: 1.4; color: var(--color-body); }
.nov-punto-ico { flex-shrink: 0; margin-top: 2px; color: var(--color-success); }

.nov-pie {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 16px; border-top: 1px solid var(--color-border); background: var(--color-bg);
}
.nov-pie-izq { display: flex; align-items: center; gap: 10px; }
.nov-contador { font-size: 12px; font-weight: 500; color: var(--color-muted); font-variant-numeric: tabular-nums; }
.nov-dots { display: flex; align-items: center; gap: 5px; }
.nov-dot {
    width: 8px; height: 8px; padding: 0; border: none; border-radius: 9999px;
    background: var(--color-border-strong); cursor: pointer;
    transition: width 160ms ease, background-color 160ms ease;
}
.nov-dot-on { width: 18px; background: var(--color-primary); }

.nov-pie-der { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
.nov-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    min-height: 36px; padding: 0 12px; border-radius: 8px;
    font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
    transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease;
}
.nov-btn:disabled { opacity: 0.42; cursor: not-allowed; }
.nov-btn-sec {
    background: transparent; color: var(--color-text); border: 1px solid var(--color-border); font-weight: 500;
}
.nov-btn-sec:hover { background: var(--color-surface-alt); border-color: var(--color-border-strong); }
.nov-btn-fantasma {
    background: var(--color-surface-alt); color: var(--color-text); border: 1px solid var(--color-border); font-weight: 500;
}
.nov-btn-fantasma:hover:not(:disabled) { border-color: var(--color-border-strong); }
.nov-btn-prim {
    background: var(--color-primary); color: var(--color-on-primary); border: 1px solid transparent; padding: 0 14px;
}
.nov-btn-prim:hover { background: var(--color-primary-h); }

/* Lightbox */
.nov-lb {
    position: fixed; inset: 0; z-index: 320;
    display: flex; flex-direction: column; padding: 16px;
    background: rgba(3, 6, 14, 0.90);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    animation: novVelo 150ms ease-out;
}
.nov-lb-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; }
.nov-lb-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: #E8EDF7; min-width: 0; }
.nov-lb-meta > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nov-lb-count {
    font-size: 11.5px; padding: 2px 8px; border-radius: 6px; flex-shrink: 0;
    background: rgba(255, 255, 255, 0.12); font-variant-numeric: tabular-nums;
}
.nov-lb-cerrar {
    width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.10);
    color: #FFFFFF; display: grid; place-items: center; cursor: pointer;
}
.nov-lb-cerrar:hover { background: rgba(255, 255, 255, 0.20); }
.nov-lb-centro { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 12px; }
.nov-lb-flecha { width: 38px; height: 38px; border-radius: 9999px; flex-shrink: 0; }
.nov-lb-marco {
    max-width: 960px; width: 100%; max-height: calc(100dvh - 100px); aspect-ratio: 16 / 9;
    border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.16);
    background: #05080F; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
}
.nov-lb-img { width: 100%; height: 100%; object-fit: contain; display: block; }

@media (max-width: 639px) {
    .nov-velo { padding: 10px; align-items: flex-end; }
    .nov-tarjeta { max-height: calc(100dvh - 20px); overflow-y: auto; }
    .nov-btn { min-height: 40px; }
    .nov-lb { padding: 10px; }
    .nov-lb-flecha { width: 32px; height: 32px; }
}

@keyframes novVelo { from { opacity: 0; } to { opacity: 1; } }
@keyframes novEntra { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes novPaso { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
    .nov-velo, .nov-tarjeta, .nov-cuerpo, .nov-lb { animation: none; }
    .nov-seg, .nov-dot, .nov-btn, .nov-cerrar, .nov-thumb, .nov-overlay-btn { transition: none; }
}
`
