// src/modules/ventas/panel/configuracion/SoporteAdjuntos.tsx
//
// Capturas para una consulta o una respuesta: zona de arrastre, botón para
// elegir, previews con quitar. No sube nada: los archivos quedan en memoria
// y se suben recién al enviar (Soporte.tsx / SoporteHilo.tsx), así una
// captura que se eligió y se sacó no ocupa lugar en el bucket.
//
// La lista la tiene el padre (necesita los File para subirlos), y el padre
// también recibe lo que se pega con Ctrl+V en el textarea. Por eso la
// validación es una función suelta (agregarAdjuntos) y no vive en el
// componente: los dos caminos (elegir/arrastrar y pegar) pasan por la misma.

import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { pesoLegible } from './SoporteComun'

export const MAX_ADJUNTOS = 3
export const MAX_BYTES = 10 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface AdjuntoLocal {
    /** Clave estable para la lista: el nombre se puede repetir. */
    id: string
    file: File
    nombre: string
    peso: number
    /** Object URL para la miniatura; lo libera el componente al quitar/desmontar. */
    previewUrl: string
}

/** Suma archivos a la lista actual respetando cantidad, tipo y peso. Devuelve
 *  la lista nueva y, si algo quedó afuera, un motivo para mostrar. Los
 *  archivos que sí pasaron se agregan igual: un error no descarta el resto. */
export function agregarAdjuntos(actuales: AdjuntoLocal[], archivos: Iterable<File>): { lista: AdjuntoLocal[]; error: string | null } {
    const lista = [...actuales]
    const motivos: string[] = []
    for (const file of archivos) {
        if (lista.length >= MAX_ADJUNTOS) {
            motivos.push(`Hasta ${MAX_ADJUNTOS} imágenes por mensaje.`)
            break
        }
        if (!TIPOS.includes(file.type)) {
            motivos.push(`"${file.name}" no es una imagen (JPG, PNG, WEBP o GIF).`)
            continue
        }
        if (file.size > MAX_BYTES) {
            motivos.push(`"${file.name}" pesa más de 10 MB.`)
            continue
        }
        lista.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            nombre: file.name || 'captura.png',
            peso: file.size,
            previewUrl: URL.createObjectURL(file),
        })
    }
    // Un solo motivo alcanza: si hubo varios, el primero es el más útil.
    return { lista, error: motivos[0] ?? null }
}

export function SoporteAdjuntos({
    adjuntos,
    onAgregar,
    onQuitar,
    error,
    disabled = false,
    /** Texto de la zona de arrastre; el cuadro de respuesta usa uno más corto. */
    titulo = 'Adjuntá capturas de pantalla',
}: {
    adjuntos: AdjuntoLocal[]
    onAgregar: (archivos: File[]) => void
    onQuitar: (id: string) => void
    error: string | null
    disabled?: boolean
    titulo?: string
}) {
    const inputId = useId()
    const errorId = useId()
    const [arrastrando, setArrastrando] = useState(false)

    // Liberar los object URLs de lo que salió de la lista (quitar, envío
    // exitoso que la vacía, desmontaje). Se hace por diferencia con la lista
    // anterior en vez de en el onQuitar del padre para que ningún camino se
    // lo olvide.
    const previos = useRef<AdjuntoLocal[]>([])
    useEffect(() => {
        const vivos = new Set(adjuntos.map(a => a.previewUrl))
        for (const a of previos.current) if (!vivos.has(a.previewUrl)) URL.revokeObjectURL(a.previewUrl)
        previos.current = adjuntos
    }, [adjuntos])
    useEffect(() => () => {
        for (const a of previos.current) URL.revokeObjectURL(a.previewUrl)
    }, [])

    const lleno = adjuntos.length >= MAX_ADJUNTOS

    function onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setArrastrando(false)
        if (disabled) return
        onAgregar(Array.from(e.dataTransfer.files ?? []))
    }

    return (
        <div>
            <div
                className="sop-drop"
                data-arrastrando={arrastrando ? 'true' : 'false'}
                onDragOver={e => { e.preventDefault(); if (!disabled && !arrastrando) setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={onDrop}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '12px 14px', borderRadius: 10,
                    border: `1.5px dashed ${arrastrando ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                    background: arrastrando ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)',
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                <ImagePlus size={18} strokeWidth={1.8} color="var(--color-muted)" aria-hidden="true" style={{ flexShrink: 0 }} />
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                        Arrastralas acá o pegalas con Ctrl+V en el texto. Hasta {MAX_ADJUNTOS}, de 10 MB cada una.
                    </div>
                </div>
                {/* El input queda fuera de la vista pero enfocable: el label es el
                    botón visible y el foco de teclado cae en el input real. */}
                <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={disabled || lleno}
                    aria-describedby={error ? errorId : undefined}
                    className="sop-file-input"
                    onChange={e => {
                        onAgregar(Array.from(e.target.files ?? []))
                        // Sin esto, elegir la misma imagen dos veces seguidas no dispara onChange.
                        e.target.value = ''
                    }}
                />
                <label
                    htmlFor={inputId}
                    className="ds-hover sop-file-label"
                    aria-disabled={disabled || lleno ? 'true' : undefined}
                    style={{
                        display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 12px', borderRadius: 8,
                        fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                        border: '1px solid var(--color-border-strong)', background: 'var(--color-bg)',
                        color: lleno ? 'var(--color-subtle)' : 'var(--color-text)',
                        cursor: disabled || lleno ? 'not-allowed' : 'pointer',
                    }}
                >
                    Elegir imágenes
                </label>
            </div>

            {error && (
                <div id={errorId} role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 8 }}>{error}</div>
            )}

            {adjuntos.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {adjuntos.map(a => (
                        <li key={a.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 6px 6px', borderRadius: 8,
                            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                        }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.previewUrl} alt="" width={40} height={40}
                                style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'var(--color-surface-alt)' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{pesoLegible(a.peso)}</div>
                            </div>
                            <button
                                type="button"
                                className="ds-hover sop-quitar"
                                onClick={() => onQuitar(a.id)}
                                disabled={disabled}
                                aria-label={`Quitar ${a.nombre}`}
                                style={{
                                    width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center',
                                    border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer',
                                }}
                            >
                                <X size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
