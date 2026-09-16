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
import { Upload, Trash2, Loader2, FileVideo } from 'lucide-react'

interface VideoUploaderProps {
    /** El mismo ap.videoUrl — puede ser un link pegado a mano o el resultado de una subida anterior. */
    value:    string
    onChange: (v: string) => void
    onUpload: (file: File) => Promise<string>
    maxMB?: number
}

export function VideoUploader({ value, onChange, onUpload, maxMB = 40 }: VideoUploaderProps) {
    const ref = useRef<HTMLInputElement>(null)
    const [subiendo, setSubiendo] = useState(false)
    const [error, setError] = useState('')
    const [drag, setDrag] = useState(false)

    // Distingue "hay un archivo subido" de "hay un link de YouTube/Vimeo
    // pegado" — MISMA regla que parseVideoEmbed, así el estado de este
    // control coincide siempre con lo que el storefront va a dibujar.
    const esArchivo = /\.(mp4|webm|ogg|mov)(\?\S*)?$/i.test(value)

    async function handle(file: File | undefined | null) {
        if (!file || subiendo) return
        setError('')
        if (!file.type.startsWith('video/')) { setError('Tiene que ser un archivo de video'); return }
        if (file.size > maxMB * 1024 * 1024) { setError(`El archivo supera el máximo de ${maxMB} MB`); return }
        try {
            setSubiendo(true)
            onChange(await onUpload(file))
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
                {subiendo
                    ? <Loader2 size={18} color="var(--color-muted)" style={{ animation: 'spin 800ms linear infinite', flexShrink: 0 }} />
                    : <FileVideo size={18} color="var(--color-muted)" style={{ flexShrink: 0 }} />}

                <div style={{ flex: 1, minWidth: 0 }}>
                    {esArchivo ? (
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                            {subiendo ? 'Subiendo…' : 'Video subido'}
                        </div>
                    ) : (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                                {subiendo ? 'Subiendo…' : 'Arrastrá un video acá, o elegilo'}
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
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

            {error && <p style={{ fontSize: 11.5, color: 'var(--color-error)', margin: '5px 0 0' }}>{error}</p>}

            <input ref={ref} type="file" accept="video/*" onChange={e => void handle(e.target.files?.[0])} style={{ display: 'none' }} />
        </div>
    )
}
