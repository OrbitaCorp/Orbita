// EstudioFondoModal.tsx — "Fondo con IA" (paquete Avanzado), paso 2 del
// wizard de producto ("Variantes e imágenes").
//
// Flujo: el vendedor elige un estilo del catálogo (GET /image-studio/
// background-styles, con thumbnail real de R2 — incluye "Sin fondo" como
// primera opción, con tratamiento visual propio, ver checkerboard abajo) →
// se genera un preview contra la PRIMERA foto elegida (POST /image-studio/
// background) → si confirma, "Aplicar a todas las imágenes" corre lo mismo
// contra el resto de las fotos generales del producto, reusando el
// resultado del preview para la primera (no la vuelve a pedir).
//
// Acepta tanto fotos PENDIENTES (recién elegidas en esta sesión, en memoria
// como File) como YA GUARDADAS (un producto en edición) — para estas
// últimas se manda `imageUrl` en vez de `file`, el backend la baja server-
// side (ver ImageStudioService.resolverImagenPorUrl, con chequeo de que sea
// de nuestro propio storage). Una guardada NUNCA se reemplaza in-place: el
// resultado se agrega como una foto pendiente NUEVA (ver `onAplicar` — el
// caller decide qué hacer según `origen.tipo`), porque la original ya
// guardada sigue siendo válida y el vendedor puede querer conservarla.
//
// "Sin fondo" (SIN_FONDO_KEY en el catálogo) no depende de Cloudflare en
// absoluto — corre el mismo recorte local (ONNX) que el toggle "Quitar
// fondo" de siempre — así que sigue disponible incluso si la cuota gratis
// de Neurons de Cloudflare se agotó para el resto de los estilos (ver
// CloudflareQuotaExhaustedException en el backend: ese error viene con un
// mensaje ya armado para mostrar tal cual, no hace falta traducirlo acá).
//
// Modo "Gratis" vs "Premium" (24/09/2026, ver el plan "Fondo con IA:
// pipeline 2D/3D"): gratis es el pipeline de siempre (compone local contra
// el catálogo cacheado en R2); premium le pega a un modelo generativo sobre
// la foto completa — Gemini si el producto es plano (`photoType`), Workers
// AI si tiene volumen. "Sin fondo" es igual en los dos modos (siempre ONNX).
import { Fragment, useEffect, useState } from 'react'
import { Sparkles, Check, AlertCircle, Scissors, Maximize2, X } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { ApiError, panelListBackgroundStyles, panelGenerateProductBackground, type ApiBackgroundStyle } from '@/lib/api'

// Mismo valor que SIN_FONDO_KEY en apps/api/src/image-studio/background-styles.ts
// — no compone nada, es el único estilo que se muestra con el checkerboard de
// transparencia. Los estilos premium nuevos (Fase 2: texturas + "podio")
// también llegan con previewUrl null (no tienen thumbnail en R2) pero NO son
// "sin fondo" — se distinguen por key, no por previewUrl===null.
const SIN_FONDO_KEY = 'sin_fondo'

export type ImagenParaFondo =
    | { key: string; tipo: 'pendiente'; file: File; preview: string }
    | { key: string; tipo: 'guardada'; url: string; preview: string }

interface Props {
    isOpen: boolean
    onClose: () => void
    imagenes: ImagenParaFondo[]
    /** El caller decide qué hacer según `origen.tipo`: reemplazar en el lugar
     *  (pendiente) o agregar como una foto pendiente nueva (guardada). */
    onAplicar: (origen: ImagenParaFondo, file: File, preview: string) => void
    onToast: (m: string) => void
    /** Plano o con volumen (Product.photoType) — solo importa en modo premium,
     *  decide si el backend le pega a Gemini o a Workers AI (ver
     *  ImageStudioService.generatePremiumBackground()). */
    photoType?: 'flat' | 'volume'
}

function base64AFile(base64: string, mimeType: string, nombre: string): File {
    const bytes = atob(base64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new File([arr], nombre, { type: mimeType })
}

function origenParaApi(img: ImagenParaFondo): { file: Blob; filename: string } | { imageUrl: string } {
    return img.tipo === 'pendiente' ? { file: img.file, filename: img.file.name } : { imageUrl: img.url }
}

function nombreDeImagen(img: ImagenParaFondo): string {
    if (img.tipo === 'pendiente') return img.file.name
    return img.url.split('/').pop()?.split('?')[0] || 'foto.jpg'
}

export function EstudioFondoModal({ isOpen, onClose, imagenes, onAplicar, onToast, photoType }: Props) {
    const [estilos, setEstilos] = useState<ApiBackgroundStyle[] | null>(null)
    const [errorEstilos, setErrorEstilos] = useState<string | null>(null)
    const [estiloElegido, setEstiloElegido] = useState<string | null>(null)
    // "Gratis" (de siempre, sin cambios) vs "Premium" (Gemini/Workers AI,
    // llamada generativa directa — ver el plan "Fondo con IA: pipeline 2D/3D").
    // Default "gratis": elegir el modo no debe sorprender a nadie que ya usaba
    // esto. Se resetea a "gratis" al cerrar el modal, mismo criterio que el
    // resto del estado de acá abajo.
    const [modo, setModo] = useState<'gratis' | 'premium'>('gratis')

    // Preview: se genera contra la primera foto general apenas se elige un
    // estilo — así el vendedor ve el resultado ANTES de aplicarlo a todas.
    const [generandoPreview, setGenerandoPreview] = useState(false)
    const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
    const [errorPreview, setErrorPreview] = useState<string | null>(null)

    const [aplicando, setAplicando] = useState(false)
    const [progreso, setProgreso] = useState({ hecho: 0, total: 0 })

    // El thumbnail del preview es chico (120px) y recortado (object-fit:
    // cover) — no alcanza para juzgar si el fondo generado realmente queda
    // bien antes de aplicarlo a las demás fotos. Pedido real: poder verlo
    // completo. Un lightbox propio (sin librería nueva) que muestra la
    // imagen entera, sin recortar (contain).
    const [zoomAbierto, setZoomAbierto] = useState(false)

    // Qué fotos de la tira de arriba se van a transformar — pedido real: no
    // forzar "todas o ninguna", poder elegir una sola o un subconjunto. Por
    // default entran todas (mismo comportamiento que antes, para quien no
    // toque nada), y cada miniatura funciona como un checkbox.
    const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
    useEffect(() => {
        if (isOpen) setSeleccionadas(new Set(imagenes.map(i => i.key)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    function toggleSeleccion(key: string) {
        setSeleccionadas(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const imagenesElegidas = imagenes.filter(i => seleccionadas.has(i.key))
    // La preview se genera contra la primera SELECCIONADA, no siempre
    // imagenes[0] — si el vendedor destildó esa, el preview tiene que seguir
    // a lo que realmente se va a aplicar.
    const primera = imagenesElegidas[0]

    useEffect(() => {
        if (!zoomAbierto) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomAbierto(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [zoomAbierto])

    // Re-pide el catálogo al cambiar de modo (Fase 2): premium suma texturas
    // + "podio" que no existen en gratis (ver ListBackgroundStylesDto en el
    // backend). Si había un estilo elegido que no existe en el catálogo
    // nuevo (ej. "podio_estudio" al pasar a gratis), se limpia la selección
    // en vez de dejar un preview de un estilo que ya no está en la grilla.
    useEffect(() => {
        if (!isOpen) return
        let cancelado = false
        setEstilos(null)
        setErrorEstilos(null)
        panelListBackgroundStyles({ modo, photoType })
            .then(r => {
                if (cancelado) return
                setEstilos(r)
                if (estiloElegido && !r.some(e => e.key === estiloElegido)) {
                    setEstiloElegido(null)
                    setPreview(null)
                }
            })
            .catch(e => { if (!cancelado) setErrorEstilos(e instanceof ApiError ? e.message : 'No se pudieron cargar los estilos') })
        return () => { cancelado = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, modo, photoType])

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
            setZoomAbierto(false)
            setModo('gratis')
        }
    }, [isOpen])

    async function generarPreview(key: string, modoElegido: 'gratis' | 'premium') {
        setPreview(null)
        setErrorPreview(null)
        setZoomAbierto(false)
        if (!primera) {
            setErrorPreview('Elegí al menos una foto arriba para probar este estilo.')
            return
        }
        setGenerandoPreview(true)
        try {
            const r = await panelGenerateProductBackground(origenParaApi(primera), { estilo: key, modo: modoElegido, photoType })
            const file = base64AFile(r.base64, r.mimeType, nombreDeImagen(primera))
            setPreview({ file, url: URL.createObjectURL(file) })
        } catch (e) {
            setErrorPreview(e instanceof ApiError ? e.message : 'No se pudo generar el preview. Probá de nuevo.')
        } finally {
            setGenerandoPreview(false)
        }
    }

    function elegirEstilo(key: string) {
        setEstiloElegido(key)
        void generarPreview(key, modo)
    }

    // Cambiar de modo con un estilo ya elegido regenera el preview contra ese
    // mismo estilo — si no, el vendedor vería el resultado del modo anterior.
    function elegirModo(nuevoModo: 'gratis' | 'premium') {
        setModo(nuevoModo)
        if (estiloElegido) void generarPreview(estiloElegido, nuevoModo)
    }

    async function aplicarASeleccionadas() {
        if (!estiloElegido || !preview || !primera) return
        setAplicando(true)
        setProgreso({ hecho: 0, total: imagenesElegidas.length })
        try {
            // La primera ya está resuelta (es el preview) — no se vuelve a pedir.
            onAplicar(primera, preview.file, preview.url)
            setProgreso({ hecho: 1, total: imagenesElegidas.length })

            for (const img of imagenesElegidas.slice(1)) {
                try {
                    const r = await panelGenerateProductBackground(origenParaApi(img), { estilo: estiloElegido, modo, photoType })
                    const file = base64AFile(r.base64, r.mimeType, nombreDeImagen(img))
                    onAplicar(img, file, URL.createObjectURL(file))
                } catch {
                    // Una foto puntual puede fallar (red, filtro de contenido) sin
                    // frenar el resto — mejor aplicar 3 de 4 que ninguna.
                    onToast(`No se pudo generar el fondo para "${nombreDeImagen(img)}"`)
                }
                setProgreso(p => ({ ...p, hecho: p.hecho + 1 }))
            }
            onToast(imagenesElegidas.length === 1 ? 'Fondo aplicado a la foto' : 'Fondo aplicado a las fotos elegidas')
            onClose()
        } finally {
            setAplicando(false)
        }
    }

    return (
        <Fragment>
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
                        onClick={aplicarASeleccionadas}
                        disabled={!preview || generandoPreview || imagenesElegidas.length === 0}
                        loading={aplicando}
                    >
                        {aplicando
                            ? `Aplicando ${progreso.hecho}/${progreso.total}...`
                            : imagenesElegidas.length === 1 ? 'Aplicar a esta foto' : `Aplicar a ${imagenesElegidas.length} fotos`}
                    </Button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
                    Elegí un estilo de fondo — se prueba primero en una foto; si te convence, lo aplicás a las fotos que tildaste abajo (una sola, algunas, o todas).
                </div>

                {/* Gratis (de siempre) vs Premium (Gemini/Workers AI) — ver
                    comentario de `modo` más arriba. */}
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        type="button"
                        onClick={() => elegirModo('gratis')}
                        disabled={aplicando}
                        style={{
                            flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                            cursor: aplicando ? 'default' : 'pointer',
                            border: '1px solid ' + (modo === 'gratis' ? 'var(--color-primary)' : 'var(--color-border)'),
                            background: modo === 'gratis' ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                            color: modo === 'gratis' ? 'var(--color-primary)' : 'var(--color-text)',
                        }}
                    >
                        Gratis
                    </button>
                    <button
                        type="button"
                        onClick={() => elegirModo('premium')}
                        disabled={aplicando}
                        title="Genera el fondo con IA en un solo paso, sobre la foto completa — mejor para productos con volumen o telas complejas."
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '8px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                            cursor: aplicando ? 'default' : 'pointer',
                            border: '1px solid ' + (modo === 'premium' ? 'var(--color-primary)' : 'var(--color-border)'),
                            background: modo === 'premium' ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                            color: modo === 'premium' ? 'var(--color-primary)' : 'var(--color-text)',
                        }}
                    >
                        <Sparkles size={12} strokeWidth={2.2} />
                        Premium
                    </button>
                </div>

                {/* Tira de fotos: cada una es un checkbox — tocarla la
                    suma/saca de lo que se va a aplicar. Por default entran
                    todas. */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                            {imagenesElegidas.length} de {imagenes.length} foto{imagenes.length === 1 ? '' : 's'} elegida{imagenesElegidas.length === 1 ? '' : 's'}
                        </span>
                        <button
                            type="button"
                            onClick={() => setSeleccionadas(seleccionadas.size === imagenes.length ? new Set() : new Set(imagenes.map(i => i.key)))}
                            disabled={aplicando}
                            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: aplicando ? 'default' : 'pointer', fontWeight: 600 }}
                        >
                            {seleccionadas.size === imagenes.length ? 'Ninguna' : 'Todas'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                        {imagenes.map(img => {
                            const elegida = seleccionadas.has(img.key)
                            return (
                                <button
                                    key={img.key}
                                    type="button"
                                    onClick={() => toggleSeleccion(img.key)}
                                    disabled={aplicando}
                                    title={elegida ? 'Sacar de la selección' : 'Sumar a la selección'}
                                    style={{
                                        position: 'relative', width: 44, height: 44, padding: 0, flexShrink: 0,
                                        borderRadius: 6, overflow: 'hidden', cursor: aplicando ? 'default' : 'pointer',
                                        border: elegida ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    }}
                                >
                                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: elegida ? 1 : 0.4 }} />
                                    {elegida && (
                                        <span style={{
                                            position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
                                            background: 'var(--color-primary)', color: '#fff', display: 'grid', placeItems: 'center',
                                        }}>
                                            <Check size={10} strokeWidth={3} />
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
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
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        // "Sin fondo" (no compone nada, ver ImageStudioController):
                                        // checkerboard estándar para indicar transparencia. Los
                                        // estilos premium (Fase 2: texturas + "podio") también
                                        // llegan sin previewUrl pero no son transparentes — se
                                        // distinguen por key, ver comentario del import de arriba.
                                        ...(e.key === SIN_FONDO_KEY ? {
                                            backgroundImage:
                                                'linear-gradient(45deg, var(--color-border) 25%, transparent 25%), ' +
                                                'linear-gradient(-45deg, var(--color-border) 25%, transparent 25%), ' +
                                                'linear-gradient(45deg, transparent 75%, var(--color-border) 75%), ' +
                                                'linear-gradient(-45deg, transparent 75%, var(--color-border) 75%)',
                                            backgroundSize: '12px 12px',
                                            backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                                        } : !e.previewUrl ? { background: 'var(--color-primary-bg)' } : {}),
                                    }}>
                                        {e.previewUrl
                                            ? <img src={e.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            : e.key === SIN_FONDO_KEY
                                                ? <Scissors size={22} strokeWidth={1.6} color="var(--color-muted)" />
                                                : <Sparkles size={20} strokeWidth={1.8} color="var(--color-primary)" />}
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
                                <button
                                    type="button"
                                    onClick={() => setZoomAbierto(true)}
                                    title="Ver completo"
                                    style={{
                                        position: 'relative', width: 160, height: 160, padding: 0, flexShrink: 0,
                                        borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)',
                                        cursor: 'pointer', background: 'none',
                                    }}
                                >
                                    <img src={preview.url} alt="Preview con el nuevo fondo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    <span style={{
                                        position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, borderRadius: 8,
                                        background: 'rgba(15,23,42,0.65)', color: '#fff', display: 'grid', placeItems: 'center',
                                    }}>
                                        <Maximize2 size={14} strokeWidth={2.2} />
                                    </span>
                                </button>
                                <div style={{ fontSize: 12.5, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Sparkles size={14} fill="var(--color-primary)" color="var(--color-primary)" />
                                    Así queda — tocá la foto para verla completa. Si te gusta, aplicalo a las demás.
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>

        {/* Lightbox: imagen entera, SIN recortar (contain) — el punto de esto
            es justamente ver lo que el thumbnail recortado no deja ver.
            z-index 400, por encima del Modal (300, ver Modal.tsx). */}
        {zoomAbierto && preview && (
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Preview del fondo, tamaño completo"
                onClick={() => setZoomAbierto(false)}
                style={{
                    position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }}
            >
                <img
                    src={preview.url}
                    alt="Preview con el nuevo fondo, tamaño completo"
                    onClick={e => e.stopPropagation()}
                    style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10, display: 'block' }}
                />
                <button
                    type="button"
                    onClick={() => setZoomAbierto(false)}
                    aria-label="Cerrar"
                    style={{
                        position: 'absolute', top: 16, right: 16, width: 44, height: 44, borderRadius: '50%',
                        border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff',
                        display: 'grid', placeItems: 'center', cursor: 'pointer',
                    }}
                >
                    <X size={20} strokeWidth={2.2} />
                </button>
            </div>
        )}
        </Fragment>
    )
}
