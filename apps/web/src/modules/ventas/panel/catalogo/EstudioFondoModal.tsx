// EstudioFondoModal.tsx — "Fondo con IA" (paquete Avanzado), paso 2 del
// wizard de producto ("Variantes e imágenes").
//
// Flujo: el vendedor elige un estilo del catálogo (GET /image-studio/
// background-styles, con thumbnail real de R2 — incluye "Sin fondo" como
// primera opción, con tratamiento visual propio, ver checkerboard abajo) →
// se genera un preview de CADA foto tildada (POST /image-studio/background,
// de a dos en paralelo) → si confirma, "Aplicar" usa esos mismos resultados
// (no vuelve a pedirlos) y solo reintenta las que hayan fallado.
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
import { Fragment, useEffect, useRef, useState } from 'react'
import { Sparkles, Check, AlertCircle, Scissors, Maximize2, X } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { ApiError, panelListBackgroundStyles, panelGenerateProductBackground, panelMejorarRecorte, type ApiBackgroundStyle } from '@/lib/api'

// Mismo valor que SIN_FONDO_KEY en apps/api/src/image-studio/background-styles.ts
// — no compone nada, es el único estilo que se muestra con el checkerboard de
// transparencia. Los estilos premium nuevos (Fase 2: texturas + "podio")
// también llegan con previewUrl null (no tienen thumbnail en R2) pero NO son
// "sin fondo" — se distinguen por key, no por previewUrl===null.
const SIN_FONDO_KEY = 'sin_fondo'

export type ImagenParaFondo =
    | { key: string; tipo: 'pendiente'; file: File; preview: string }
    | { key: string; tipo: 'guardada'; url: string; preview: string }

type EstadoPreview =
    | { estado: 'cargando' }
    | { estado: 'listo'; file: File; url: string; recorteDificil: boolean; mejorando?: boolean }
    | { estado: 'error'; mensaje: string }

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

    // Previews: una por cada foto tildada, apenas se elige un estilo — así el
    // vendedor ve el resultado de TODAS antes de aplicarlo. Cada una tiene su
    // propio estado (cargando / lista / error) porque pueden fallar por separado
    // (red, filtro de contenido). `corridaRef` invalida las respuestas de una
    // corrida vieja cuando se cambia de estilo a mitad de camino.
    // "Sin fondo" con el recorte local dudoso (producto y fondo parecidos, ver
    // BackgroundRemovalService.removeBackgroundConAnalisis) deja `recorteDificil`
    // en la preview: el vendedor decide si gasta una generación IA para mejorarlo
    // (Gemini/Workers pone fondo blanco y se recorta de nuevo, ver
    // ImageStudioService.mejorarRecorte).
    const [previews, setPreviews] = useState<Record<string, EstadoPreview>>({})
    const corridaRef = useRef(0)

    const [aplicando, setAplicando] = useState(false)
    const [progreso, setProgreso] = useState({ hecho: 0, total: 0 })

    // El thumbnail del preview es chico (120px) y recortado (object-fit:
    // cover) — no alcanza para juzgar si el fondo generado realmente queda
    // bien antes de aplicarlo a las demás fotos. Pedido real: poder verlo
    // completo. Un lightbox propio (sin librería nueva) que muestra la
    // imagen entera, sin recortar (contain).
    const [zoomKey, setZoomKey] = useState<string | null>(null)

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
        const agregando = !seleccionadas.has(key)
        setSeleccionadas(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
        // Con un estilo ya elegido, una foto que se suma recién ahora se prueba
        // sola (las demás ya tienen su preview).
        if (agregando && estiloElegido && !previews[key]) {
            const img = imagenes.find(i => i.key === key)
            if (img) void generarUna(img, estiloElegido, corridaRef.current)
        }
    }

    const imagenesElegidas = imagenes.filter(i => seleccionadas.has(i.key))
    const hayCargando = imagenesElegidas.some(i => previews[i.key]?.estado === 'cargando')
    const listasCount = imagenesElegidas.filter(i => previews[i.key]?.estado === 'listo').length
    const previewZoom = zoomKey ? previews[zoomKey] : undefined

    useEffect(() => {
        if (!zoomKey) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomKey(null) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [zoomKey])

    // Carga el catálogo curado unificado:
    useEffect(() => {
        if (!isOpen) return
        let cancelado = false
        setEstilos(null)
        setErrorEstilos(null)
        panelListBackgroundStyles({ photoType })
            .then(r => {
                if (cancelado) return
                setEstilos(r)
                if (estiloElegido && !r.some(e => e.key === estiloElegido)) {
                    setEstiloElegido(null)
                    limpiarPreviews()
                }
            })
            .catch(e => { if (!cancelado) setErrorEstilos(e instanceof ApiError ? e.message : 'No se pudieron cargar los estilos') })
        return () => { cancelado = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, photoType])

    // Al cerrar, se resetea todo — cada apertura arranca de cero (no tiene
    // sentido recordar el estilo elegido la sesión pasada: el objetivo de
    // "Fondo con IA" es probar varios hasta encontrar el que gusta).
    useEffect(() => {
        if (!isOpen) {
            setEstiloElegido(null)
            limpiarPreviews()
            setAplicando(false)
            setProgreso({ hecho: 0, total: 0 })
            setZoomKey(null)
        }
    }, [isOpen])

    function limpiarPreviews() {
        corridaRef.current++
        setPreviews({})
    }

    // Genera la preview de UNA foto. Si mientras esperaba se cambió de estilo
    // (`corrida` ya no es la vigente), el resultado se descarta.
    async function generarUna(img: ImagenParaFondo, estilo: string, corrida: number) {
        setPreviews(p => ({ ...p, [img.key]: { estado: 'cargando' } }))
        try {
            const r = await panelGenerateProductBackground(origenParaApi(img), { estilo, photoType })
            if (corrida !== corridaRef.current) return
            const file = base64AFile(r.base64, r.mimeType, nombreDeImagen(img))
            setPreviews(p => ({ ...p, [img.key]: { estado: 'listo', file, url: URL.createObjectURL(file), recorteDificil: !!r.recorteDificil } }))
        } catch (e) {
            if (corrida !== corridaRef.current) return
            setPreviews(p => ({ ...p, [img.key]: { estado: 'error', mensaje: e instanceof ApiError ? e.message : 'No se pudo generar el preview. Probá de nuevo.' } }))
        }
    }

    // Todas las tildadas, de a dos en paralelo (una por una era lento; todas
    // juntas pisaría el cupo diario y la cola del servidor).
    async function generarTodas(estilo: string) {
        const corrida = ++corridaRef.current
        const lista = imagenesElegidas
        setPreviews(Object.fromEntries(lista.map(i => [i.key, { estado: 'cargando' } as EstadoPreview])))
        const cola = [...lista]
        await Promise.all(Array.from({ length: Math.min(2, cola.length) }, async () => {
            while (cola.length > 0) {
                const img = cola.shift()!
                await generarUna(img, estilo, corrida)
            }
        }))
    }

    async function mejorarRecorteConIA(img: ImagenParaFondo) {
        const actual = previews[img.key]
        if (actual?.estado !== 'listo') return
        setPreviews(p => ({ ...p, [img.key]: { ...actual, mejorando: true } }))
        try {
            const r = await panelMejorarRecorte(origenParaApi(img))
            const file = base64AFile(r.base64, r.mimeType, nombreDeImagen(img))
            setPreviews(p => ({ ...p, [img.key]: { estado: 'listo', file, url: URL.createObjectURL(file), recorteDificil: false } }))
        } catch (e) {
            setPreviews(p => ({ ...p, [img.key]: { ...actual, mejorando: false } }))
            onToast(e instanceof ApiError ? e.message : 'No se pudo mejorar el recorte. Probá de nuevo.')
        }
    }

    function elegirEstilo(key: string) {
        setEstiloElegido(key)
        void generarTodas(key)
    }

    async function aplicarASeleccionadas() {
        if (!estiloElegido || imagenesElegidas.length === 0) return
        setAplicando(true)
        setProgreso({ hecho: 0, total: imagenesElegidas.length })
        try {
            for (const img of imagenesElegidas) {
                const p = previews[img.key]
                if (p?.estado === 'listo') {
                    // Ya está resuelta (es su preview) — no se vuelve a pedir.
                    onAplicar(img, p.file, p.url)
                } else {
                    // Falló al probarla: se reintenta una vez acá.
                    try {
                        const r = await panelGenerateProductBackground(origenParaApi(img), { estilo: estiloElegido, photoType })
                        const file = base64AFile(r.base64, r.mimeType, nombreDeImagen(img))
                        onAplicar(img, file, URL.createObjectURL(file))
                    } catch {
                        // Una foto puntual puede fallar (red, filtro de contenido) sin
                        // frenar el resto — mejor aplicar 3 de 4 que ninguna.
                        onToast(`No se pudo generar el fondo para "${nombreDeImagen(img)}"`)
                    }
                }
                setProgreso(pr => ({ ...pr, hecho: pr.hecho + 1 }))
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
                        disabled={!estiloElegido || hayCargando || listasCount === 0 || imagenesElegidas.length === 0}
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
                    Elegí un estilo de fondo — se prueba en las fotos que tildaste arriba (una sola, algunas, o todas) y ves cómo queda cada una antes de aplicarlo. Podés elegir fondos de estudio, maderas, mármol o los nuevos podios 3D para calzado y accesorios.
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

                {/* Previews del resultado: una por cada foto tildada */}
                {estiloElegido && (
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {imagenesElegidas.length === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-error)' }}>
                                <AlertCircle size={15} strokeWidth={2} />
                                Elegí al menos una foto arriba para probar este estilo.
                            </div>
                        )}
                        {imagenesElegidas.length > 0 && (
                            <div style={{ fontSize: 12.5, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Sparkles size={14} fill="var(--color-primary)" color="var(--color-primary)" />
                                Así queda — tocá una foto para verla completa. Si te gusta, aplicalo.
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                            {imagenesElegidas.map(img => {
                                const p = previews[img.key]
                                return (
                                    <div key={img.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                                            {(!p || p.estado === 'cargando') && (
                                                <div style={{ position: 'absolute', inset: 0 }}>
                                                    <Skeleton width="100%" height="100%" radius={0} />
                                                </div>
                                            )}
                                            {p?.estado === 'listo' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setZoomKey(img.key)}
                                                    title="Ver completo"
                                                    style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                                                >
                                                    <img src={p.url} alt="Preview con el nuevo fondo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: p.mejorando ? 0.5 : 1 }} />
                                                    <span style={{
                                                        position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, borderRadius: 8,
                                                        background: 'rgba(15,23,42,0.65)', color: '#fff', display: 'grid', placeItems: 'center',
                                                    }}>
                                                        <Maximize2 size={14} strokeWidth={2.2} />
                                                    </span>
                                                </button>
                                            )}
                                            {p?.estado === 'error' && (
                                                <div style={{ position: 'absolute', inset: 0, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center' }}>
                                                    <AlertCircle size={18} strokeWidth={2} color="var(--color-error)" />
                                                    <div style={{ fontSize: 11.5, color: 'var(--color-error)', lineHeight: 1.4 }}>{p.mensaje}</div>
                                                    <Button variant="secondary" size="sm" onClick={() => void generarUna(img, estiloElegido, corridaRef.current)} disabled={aplicando}>
                                                        Reintentar
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {p?.estado === 'listo' && estiloElegido === SIN_FONDO_KEY && p.recorteDificil && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.4 }}>
                                                <span>Recorte difícil: la prenda y el fondo tienen colores muy parecidos o mucha textura. Para mejores resultados, usá un fondo liso que contraste con la prenda.</span>
                                                <Button variant="secondary" size="sm" onClick={() => void mejorarRecorteConIA(img)} loading={!!p.mejorando} disabled={aplicando}>
                                                    Mejorar con IA (usa 1 generación)
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {estiloElegido === SIN_FONDO_KEY && (
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span>💡 <strong>Consejo para recortes limpios:</strong> usá fondos lisos que contrasten con el color de la prenda (evitá alfombras de pelo o fondos del mismo tono).</span>
                                <span>Si fotografiás un conjunto de 2 piezas, dejalas con unos centímetros de separación.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>

        {/* Lightbox: imagen entera, SIN recortar (contain) — el punto de esto
            es justamente ver lo que el thumbnail recortado no deja ver.
            z-index 400, por encima del Modal (300, ver Modal.tsx). */}
        {previewZoom?.estado === 'listo' && (
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Preview del fondo, tamaño completo"
                onClick={() => setZoomKey(null)}
                style={{
                    position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }}
            >
                {/* Modal mediano (no pantalla completa): la imagen se ve entera
                    (contain), pero acotada a ~520px de ancho y ~60% del alto. */}
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: 'relative', width: 'min(560px, 100%)', maxHeight: '80vh',
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14,
                        padding: 16, boxShadow: '0 20px 50px rgba(15,23,42,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <img
                        src={previewZoom.url}
                        alt="Preview con el nuevo fondo, tamaño completo"
                        style={{ maxWidth: '100%', maxHeight: 'calc(80vh - 32px)', objectFit: 'contain', borderRadius: 8, display: 'block' }}
                    />
                    <button
                        type="button"
                        onClick={() => setZoomKey(null)}
                        aria-label="Cerrar"
                        style={{
                            position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%',
                            border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
                            display: 'grid', placeItems: 'center', cursor: 'pointer',
                        }}
                    >
                        <X size={16} strokeWidth={2.2} />
                    </button>
                </div>
            </div>
        )}
        </Fragment>
    )
}
