// Uploader de imágenes con drag & drop y vista previa (logo, favicon, hero).
// Muestra el dataURL como preview instantáneo; si se pasa `onUpload`, sube el
// archivo de verdad y reemplaza el valor por la URL real (lo que efectivamente
// se persiste al guardar) — sin `onUpload`, se queda solo con el dataURL.

import { useRef, useState } from 'react'
import { Image as ImageIcon, Upload, Trash2, Loader2 } from 'lucide-react'

interface ImgUploaderProps {
    value:    string | null
    onChange: (v: string | null) => void
    onUpload?: (file: File) => Promise<string>
    shape?:   'square' | 'circle'
    size?:    number
    formats?: string
}

export function ImgUploader({ value, onChange, onUpload, shape = 'square', size = 96, formats = 'PNG, JPG · máx 2MB' }: ImgUploaderProps) {
    const ref = useRef<HTMLInputElement>(null)
    const [drag, setDrag] = useState(false)
    const [uploading, setUploading] = useState(false)

    const handle = (file: File | undefined | null) => {
        if (!file || !file.type.startsWith('image/')) return
        const r = new FileReader()
        r.onload = async e => {
            onChange(e.target?.result as string)
            if (!onUpload) return
            try {
                setUploading(true)
                const url = await onUpload(file)
                onChange(url)
            } catch {
                // Se queda con el preview local; el guardado de Apariencia fallará
                // más tarde si esa URL nunca se resolvió (no es un dataURL válido
                // para persistir), pero al menos no se pierde lo que el usuario ve.
            } finally {
                setUploading(false)
            }
        }
        r.readAsDataURL(file)
    }

    const radius = shape === 'circle' ? '50%' : 12

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
                className={value ? undefined : 'ds-hover'}
                onClick={() => !value && ref.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
                style={{
                    position: 'relative',
                    width: size, height: size, borderRadius: radius,
                    border: `1.5px dashed ${drag ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                    background: value ? 'transparent' : (drag ? 'var(--color-primary-bg)' : 'var(--color-surface-alt)'),
                    color: 'var(--color-muted)', cursor: value ? 'default' : 'pointer',
                    display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
                    transition: 'border-color 150ms, background 150ms',
                }}
            >
                {value
                    ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', padding: 8 }}><ImageIcon size={22} strokeWidth={1.5} /><div style={{ fontSize: 10, marginTop: 4 }}>Subir</div></div>}
                {uploading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center' }}>
                        <Loader2 size={18} color="#fff" style={{ animation: 'spin 800ms linear infinite' }} />
                    </div>
                )}
                <input ref={ref} type="file" accept="image/*" onChange={e => handle(e.target.files?.[0])} style={{ display: 'none' }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

            <div style={{ flex: 1, minWidth: 0 }}>
                {value ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        <button className="ds-hover" onClick={() => ref.current?.click()} style={smallBtn}><Upload size={12} strokeWidth={1.5} /> Cambiar imagen</button>
                        <button className="ds-hover" onClick={() => onChange(null)} style={{ ...smallBtn, color: 'var(--color-error)', border: 'none', background: 'transparent' }}><Trash2 size={12} strokeWidth={1.5} /> Quitar</button>
                    </div>
                ) : (
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Arrastrá una imagen acá</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                            o <button className="ds-link" onClick={() => ref.current?.click()} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, textDecoration: 'underline' }}>elegila</button> desde tu equipo
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', marginTop: 6 }}>{formats}</div>
                    </div>
                )}
            </div>
        </div>
    )
}

const smallBtn: React.CSSProperties = {
    height: 30, padding: '0 10px', borderRadius: 6, background: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 12,
    fontWeight: 500, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
}
