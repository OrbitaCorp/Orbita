// EstudioFondoModal.tsx — "Fondo con IA" (paquete Avanzado), paso 2 del
// wizard de producto ("Variantes e imágenes").
//
// Flujo: el vendedor elige un estilo del catálogo (GET /image-studio/
// background-styles, con thumbnail real de R2) → se genera un preview
// contra la PRIMERA foto pendiente (POST /image-studio/background) → si
// confirma, "Aplicar a todas las imágenes" corre lo mismo contra el resto
// de las fotos generales del producto, reusando el resultado del preview
// para la primera (no la vuelve a pedir).
//
// A propósito NO toca imágenes ya guardadas (subidas a un producto que se
// está editando) — solo las pendientes de esta sesión del wizard, que ya
// están en memoria como File. Ampliarlo a guardadas necesitaría bajar esa
// imagen de su URL primero (CORS entre dominios, sin resolver todavía).
import { useEffect, useState } from 'react'
import { Sparkles, Check, AlertCircle } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { ApiError, panelListBackgroundStyles, panelGenerateProductBackground, type ApiBackgroundStyle } from '@/lib/api'

export interface ImagenParaFondo {
    key: string
    file: File
    preview: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
    imagenes: ImagenParaFondo[]
    /** Reemplaza el File/preview de una imagen pendiente por el resultado ya compuesto. */
    onAplicar: (key: string, file: File, preview: string) => void
    onToast: (m: string) => void
}

function base64AFile(base64: string, mimeType: string, nombre: string): File {
    const bytes = atob(base64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new File([arr], nombre, { type: mimeType })
}

export function EstudioFondoModal({ isOpen, onClose, imagenes, onAplicar, onToast }: Props) {
    const [estilos, setEstilos] = useState<ApiBackgroundStyle[] | null>(null)
    const [errorEstilos, setErrorEstilos] = useState<string | null>(null)
    const [estiloElegido, setEstiloElegido] = useState<string | null>(null)

    // Preview: se genera contra la primera foto general apenas se elige un
    // estilo — así el vendedor ve el resultado ANTES de aplicarlo a todas.
    const [generandoPreview, setGenerandoPreview] = useState(false)
    const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
    const [errorPreview, setErrorPreview] = useState<string | null>(null)

    const [aplicando, setAplicando] = useState(false)
    const [progreso, setProgreso] = useState({ hecho: 0, total: 0 })

    const primera = imagenes[0]

    useEffect(() => {
        if (!isOpen) return
        let cancelado = false
        panelListBackgroundStyles()
            .then(r => { if (!cancelado) setEstilos(r) })
            .catch(e => { if (!cancelado) setErrorEstilos(e instanceof ApiError ? e.message : 'No se pudieron cargar los estilos') })
        return () => { cancelado = true }
    }, [isOpen])

    // Al cerrar, se resetea todo — cada apertura arranca de cero (no tiene
    // sentido recordar el estilo elegido la sesión pasada: el objetivo de
    // "Fondo con IA" es probar varios hasta encontrar el que gusta).
    useEffect(() => {
        if (!isOpen) {
            setEstiloElegido(null)
            setPreview(null)
            setErrorPreview(null)
            setAplicando(false)
            setProgreso({ hecho: 0, total: 0 })
        }
    }, [isOpen])

    async function elegirEstilo(key: string) {
        setEstiloElegido(key)
        setPreview(null)
        setErrorPreview(null)
        if (!primera) return
        setGenerandoPreview(true)
        try {
            const r = await panelGenerateProductBackground(primera.file, primera.file.name, { estilo: key })
            const file = base64AFile(r.base64, r.mimeType, primera.file.name)
            setPreview({ file, url: URL.createObjectURL(file) })
        } catch (e) {
            setErrorPreview(e instanceof ApiError ? e.message : 'No se pudo generar el preview. Probá de nuevo.')
        } finally {
            setGenerandoPreview(false)
        }
    }

    async function aplicarATodas() {
        if (!estiloElegido || !preview || !primera) return
        setAplicando(true)
        setProgreso({ hecho: 0, total: imagenes.length })
        try {
            // La primera ya está resuelta (es el preview) — no se vuelve a pedir.
            onAplicar(primera.key, preview.file, preview.url)
            setProgreso({ hecho: 1, total: imagenes.length })

            for (const img of imagenes.slice(1)) {
                try {
                    const r = await panelGenerateProductBackground(img.file, img.file.name, { estilo: estiloElegido })
                    const file = base64AFile(r.base64, r.mimeType, img.file.name)
                    onAplicar(img.key, file, URL.createObjectURL(file))
                } catch {
                    // Una foto puntual puede fallar (red, filtro de contenido) sin
                    // frenar el resto — mejor aplicar 3 de 4 que ninguna.
                    onToast(`No se pudo generar el fondo para "${img.file.name}"`)
                }
                setProgreso(p => ({ ...p, hecho: p.hecho + 1 }))
            }
            onToast('Fondo aplicado a las fotos del producto')
            onClose()
        } finally {
            setAplicando(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={aplicando ? () => {} : onClose}
            dismissable={!aplicando}
            title="Fondo con IA"
            maxWidth={760}
            footer={
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <Button variant="secondary" size="sm" onClick={onClose} disabled={aplicando}>Cancelar</Button>
                    <Button
                        variant="primary" size="sm"
                        icon={<Check size={14} strokeWidth={2.2} />}
                        onClick={aplicarATodas}
                        disabled={!preview || generandoPreview}
                        loading={aplicando}
                    >
                        {aplicando ? `Aplicando ${progreso.hecho}/${progreso.total}...` : `Aplicar a las ${imagenes.length} fotos`}
                    </Button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
                    Elegí un estilo de fondo — se prueba primero en una foto; si te convence, lo aplicás a las {imagenes.length} fotos del producto de una.
                </div>

                {/* Tira de fotos que se van a transformar (solo referencia, no clickeable). */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                    {imagenes.map(img => (
                        <img key={img.key} src={img.preview} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-border)' }} />
                    ))}
                </div>

                {/* Selector de estilo */}
                {errorEstilos && <div style={{ fontSize: 12.5, color: 'var(--color-error)' }}>{errorEstilos}</div>}
                {!estilos && !errorEstilos && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} width="100%" height={84} radius={8} delay={i * 40} />)}
                    </div>
                )}
                {estilos && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
                        {estilos.map(e => {
                            const elegido = e.key === estiloElegido
                            return (
                                <button
                                    key={e.key}
                                    type="button"
                                    onClick={() => elegirEstilo(e.key)}
                                    disabled={aplicando}
                                    title={e.label}
                                    style={{
                                        position: 'relative', display: 'flex', flexDirection: 'column', gap: 4,
                                        padding: 0, border: 'none', background: 'none', cursor: aplicando ? 'default' : 'pointer',
                                        fontFamily: 'inherit', textAlign: 'left',
                                    }}
                                >
                                    <div style={{
                                        width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
                                        border: elegido ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                        outline: elegido ? '2px solid var(--color-primary-bg)' : 'none', outlineOffset: 1,
                                    }}>
                                        <img src={e.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    </div>
                                    <span style={{
                                        fontSize: 10.5, lineHeight: 1.3, color: elegido ? 'var(--color-primary)' : 'var(--color-muted)',
                                        fontWeight: elegido ? 600 : 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                    }}>
                                        {e.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Preview del resultado */}
                {estiloElegido && (
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                        {generandoPreview && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Skeleton width={120} height={120} radius={10} />
                                <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Generando preview...</div>
                            </div>
                        )}
                        {errorPreview && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-error)' }}>
                                <AlertCircle size={15} strokeWidth={2} />
                                {errorPreview}
                            </div>
                        )}
                        {preview && !generandoPreview && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <img src={preview.url} alt="Preview con el nuevo fondo" style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--color-border)' }} />
                                <div style={{ fontSize: 12.5, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Sparkles size={14} fill="var(--color-primary)" color="var(--color-primary)" />
                                    Así queda — si te gusta, aplicalo a las demás fotos.
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    )
}
