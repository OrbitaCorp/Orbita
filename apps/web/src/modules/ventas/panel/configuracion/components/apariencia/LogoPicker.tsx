// Uploader chico, de un solo cuadradito — para listas donde hay UNA imagen
// por fila (hoy: las marcas de la tira del home).
//
// Por qué no ImgUploader: ese trae al lado el bloque de "Arrastrá una imagen
// acá / Cambiar imagen / Quitar", que ocupa dos renglones. Repetido en 10
// filas de marcas, la sección del panel se vuelve una torre. Acá el cuadrado
// ES el control: click para subir o reemplazar, y una × arriba a la derecha
// para dejar la marca sin logo (que es un estado válido: sin logo, la tira
// dibuja el nombre en tipografía).
//
// La otra diferencia importante: `object-fit: contain`, no `cover`. Un logo
// recortado deja de ser el logo — ImgUploader usa cover porque sus imágenes
// son fotos (hero, parallax), donde recortar está bien.

import { useRef, useState } from 'react'
import { Image as ImageIcon, X, Loader2 } from 'lucide-react'

interface LogoPickerProps {
    value:    string | null
    onChange: (v: string | null) => void
    onUpload: (file: File) => Promise<string>
    /** Para el aria-label, así el botón no es "subir imagen" a secas cuando hay varios. */
    nombre?:  string
    size?:    number
}

export function LogoPicker({ value, onChange, onUpload, nombre, size = 44 }: LogoPickerProps) {
    const ref = useRef<HTMLInputElement>(null)
    const [subiendo, setSubiendo] = useState(false)
    const de = nombre?.trim() ? ` de ${nombre.trim()}` : ''

    const handle = (file: File | undefined | null) => {
        if (!file || !file.type.startsWith('image/')) return
        const r = new FileReader()
        r.onload = async e => {
            // Preview instantáneo con el dataURL y recién después la URL real
            // — mismo criterio que ImgUploader (si la subida falla, al menos
            // no se pierde de vista lo que el usuario eligió).
            onChange(e.target?.result as string)
            try {
                setSubiendo(true)
                onChange(await onUpload(file))
            } catch {
                /* se queda con el preview local; el guardado avisa después */
            } finally {
                setSubiendo(false)
            }
        }
        r.readAsDataURL(file)
    }

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <button
                type="button"
                onClick={() => ref.current?.click()}
                aria-label={value ? `Cambiar el logo${de}` : `Subir el logo${de}`}
                title={value ? 'Cambiar logo' : 'Subir logo (opcional)'}
                className="ds-hover"
                style={{
                    width: '100%', height: '100%', padding: value ? 3 : 0,
                    borderRadius: 8,
                    border: `1.5px ${value ? 'solid' : 'dashed'} var(--color-border-strong)`,
                    background: value ? 'var(--color-bg)' : 'var(--color-surface-alt)',
                    color: 'var(--color-muted)', cursor: 'pointer',
                    display: 'grid', placeItems: 'center', overflow: 'hidden',
                }}
            >
                {value
                    ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <ImageIcon size={16} strokeWidth={1.5} />}
            </button>

            {value && !subiendo && (
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    aria-label={`Quitar el logo${de}`}
                    title="Quitar logo"
                    className="ds-hover"
                    style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 20, height: 20, borderRadius: '50%',
                        border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                        color: 'var(--color-muted)', cursor: 'pointer',
                        display: 'grid', placeItems: 'center', padding: 0,
                        boxShadow: '0 1px 4px rgba(15,23,42,0.14)',
                    }}
                >
                    <X size={11} strokeWidth={2.5} />
                </button>
            )}

            {subiendo && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center' }}>
                    <Loader2 size={14} color="#fff" style={{ animation: 'spin 800ms linear infinite' }} />
                </div>
            )}

            <input ref={ref} type="file" accept="image/*" onChange={e => handle(e.target.files?.[0])} style={{ display: 'none' }} />
        </div>
    )
}
