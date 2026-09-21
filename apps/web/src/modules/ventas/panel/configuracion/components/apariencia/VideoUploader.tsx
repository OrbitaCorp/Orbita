// Uploader del archivo de video de Apariencia — alternativa a pegar un link
// (ver Apariencia.tsx § "Video en tu tienda"). Escribe el resultado en el
// MISMO campo que el link (`value`/`onChange` son literalmente ap.videoUrl):
// parseVideoEmbed ya reconoce una URL que termina en .mp4/.webm/etc como
// "archivo directo" (lib/storefront/utils.ts), así que no hace falta un
// campo aparte para esto — subir un archivo es otra forma de completar el
// mismo link, no una alternativa que vive en otro lado.
//
// No hay preview de video acá (a diferencia de ImgUploader/LogoPicker, que sí
// muestran la imagen): un <video> chico adentro de un formulario pesa más de
// lo que aporta. En su lugar, una fila de estado ("Video subido" + cambiar/
// quitar) — mismo criterio que "sabés que está, no hace falta verlo".

import { useRef, useState } from 'react'
import { Upload, Trash2, FileVideo } from 'lucide-react'

interface VideoUploaderProps {
    /** El mismo ap.videoUrl — puede ser un link pegado a mano o el resultado de una subida anterior. */
    value:    string
    onChange: (v: string) => void
    /** `onProgress` (0-100) es opcional a propósito: lo llenan las variantes
     *  que suben directo a R2 (panelPresignStorefrontVideo/ProductVideo, ver
     *  lib/api.ts) — si algún caller viejo lo ignora, el uploader igual
     *  funciona, solo se queda mostrando 0% mientras dura la subida. */
    onUpload: (file: File, onProgress?: (pct: number) => void) => Promise<string>
    maxMB?: number
}

// Anillo circular de progreso — mismo tamaño (36px) que la miniatura/ícono
// que reemplaza mientras sube, así el layout de la fila no salta entre
// estados. `stroke-dashoffset` es lo único que se anima; con
// prefers-reduced-motion la transición se saca en globals.css (regla
// genérica `*`, no hace falta una acá).
function AnilloProgreso({ pct }: { pct: number }) {
    const size = 36, grosor = 3, r = (size - grosor) / 2, circ = 2 * Math.PI * r
    return (
        <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Subiendo video"
            style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
        >
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-border)" strokeWidth={grosor} fill="none" />
                <circle
                    cx={size / 2} cy={size / 2} r={r} stroke="var(--color-primary)" strokeWidth={grosor} fill="none"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 200ms ease' }}
                />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                {pct}
            </span>
        </div>
    )
}

// Distingue "hay un archivo subido" de "hay un link de YouTube/Vimeo pegado"
// — MISMA regla que parseVideoEmbed, así el estado de este control coincide
// siempre con lo que el storefront va a dibujar. Exportada para que
// Apariencia.tsx/ProductoNuevo.tsx puedan ocultar el input de link cuando ya
// hay un archivo subido (no tiene sentido editar un link que no se usa).
export function esVideoArchivo(url: string): boolean {
    return /\.(mp4|webm|ogg|mov)(\?\S*)?$/i.test(url)
}

export function VideoUploader({ value, onChange, onUpload, maxMB = 40 }: VideoUploaderProps) {
    const ref = useRef<HTMLInputElement>(null)
    const [subiendo, setSubiendo] = useState(false)
    // 0 mientras dura el presign (round-trip chico, pide la URL firmada) y
    // recién arranca a moverse cuando el PUT grande contra R2 empieza a
    // mandar bytes — ver xhr.upload.onprogress en subirVideoDirectoAR2.
    const [progreso, setProgreso] = useState(0)
    const [error, setError] = useState('')
    const [drag, setDrag] = useState(false)

    const esArchivo = esVideoArchivo(value)

    async function handle(file: File | undefined | null) {
        if (!file || subiendo) return
        setError('')
        if (!file.type.startsWith('video/')) { setError('Tiene que ser un archivo de video'); return }
        if (file.size > maxMB * 1024 * 1024) { setError(`El archivo supera el máximo de ${maxMB} MB`); return }
        try {
            setSubiendo(true)
            setProgreso(0)
            onChange(await onUpload(file, setProgreso))
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo subir el video')
        } finally {
            setSubiendo(false)
        }
    }

    return (
        <div>
            <div
                onClick={() => !subiendo && ref.current?.click()}
                onDragOver={e => { e.preventDefault(); if (!subiendo) setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files[0]) }}
                className="ds-hover"
                style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 8, border: `1.5px dashed ${drag ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                    background: drag ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)',
                    cursor: subiendo ? 'default' : 'pointer',
                }}
            >
                {subiendo ? (
                    <AnilloProgreso pct={progreso} />
                ) : esArchivo ? (
                    // Miniatura real del video (primer frame) en vez del ícono
                    // genérico — sin controles ni autoplay, solo para reconocer
                    // de un vistazo cuál archivo quedó subido. El seek a 0.1s en
                    // onLoadedMetadata es necesario: sin él, algunos navegadores
                    // (Firefox) dejan el cuadro en negro hasta que se reproduce.
                    <video
                        src={value}
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={e => { const v = e.currentTarget; try { v.currentTime = Math.min(0.1, v.duration || 0) } catch { /* noop */ } }}
                        style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: 'var(--color-border)' }}
                    />
                ) : (
                    <FileVideo size={18} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                    {esArchivo ? (
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                            {subiendo ? `Subiendo… ${progreso}%` : 'Video subido'}
                        </div>
                    ) : (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                                {subiendo ? `Subiendo… ${progreso}%` : 'Arrastrá un video acá, o elegilo'}
                            </div>
                            {!subiendo && (
                                <div style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', marginTop: 2 }}>
                                    MP4, WEBM, MOV · máx {maxMB}MB
                                </div>
                            )}
                        </>
                    )}
                </div>

                {esArchivo && !subiendo && (
                    <>
                        <span title="Cambiar archivo" style={{ display: 'grid', placeItems: 'center', color: 'var(--color-muted)', flexShrink: 0 }}>
                            <Upload size={14} />
                        </span>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onChange('') }}
                            title="Quitar"
                            aria-label="Quitar el video subido"
                            style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </>
                )}
            </div>

            {error && <p style={{ fontSize: 11.5, color: 'var(--color-error)', margin: '5px 0 0' }}>{error}</p>}

            <input ref={ref} type="file" accept="video/*" onChange={e => void handle(e.target.files?.[0])} style={{ display: 'none' }} />
        </div>
    )
}
