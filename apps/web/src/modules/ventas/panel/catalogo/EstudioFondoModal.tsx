// EstudioFondoModal.tsx — "Fondo con IA" (paquete Avanzado), en la pantalla de
// alta/edición de producto (ProductoNuevo.tsx).
//
// Flujo: el vendedor tilda las fotos, elige un estilo del catálogo (GET
// /image-studio/background-styles, con thumbnail real de R2 — incluye "Sin
// fondo" como primera opción, con tratamiento visual propio, ver checkerboard
// abajo) y toca "Aplicar a N fotos". El modal se cierra AL INSTANTE: no hay
// vista previa acá (el formulario ya muestra cómo queda el producto) ni se
// espera nada — generar un fondo tarda, así que cada foto se pide en segundo
// plano (POST /image-studio/background, de a dos en paralelo) y el que llama
// (ver `onAplicarEnSegundoPlano`) la marca como "Aplicando fondo…" en su
// miniatura y la reemplaza sola cuando llega el resultado.
//
// Los estilos se muestran como un slider de dos filas con flechas (no una
// grilla larga con scroll): con el modal abierto se ve todo sin bajar.
//
// Acepta tanto fotos PENDIENTES (recién elegidas en esta sesión, en memoria
// como File) como YA GUARDADAS (un producto en edición) — para estas
// últimas se manda `imageUrl` en vez de `file`, el backend la baja server-
// side (ver ImageStudioService.resolverImagenPorUrl, con chequeo de que sea
// de nuestro propio storage). Una guardada NUNCA se reemplaza in-place: el
// resultado se agrega como una foto pendiente NUEVA (el caller decide qué
// hacer según `origen.tipo`), porque la original ya guardada sigue siendo
// válida y el vendedor puede querer conservarla.
//
// "Sin fondo" (SIN_FONDO_KEY en el catálogo) no depende de Cloudflare en
// absoluto — corre el mismo recorte local (ONNX) que el toggle "Quitar
// fondo" de siempre — así que sigue disponible incluso si la cuota gratis
// de Neurons de Cloudflare se agotó para el resto de los estilos (ver
// CloudflareQuotaExhaustedException en el backend: ese error viene con un
// mensaje ya armado para mostrar tal cual, no hace falta traducirlo acá).
//
// Flujo unificado (ver ImageStudioService.generateBackground()): para
// cualquier estilo, primero intenta Workers AI (timeout de 7s) y si falla
// (error, NSFW, cuota o timeout) cae al modelo local — sin Gemini, sin
// distinción de "modo" gratis/premium. "Sin fondo" es siempre ONNX directo.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, Check, AlertCircle, Scissors, ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { ApiError, panelListBackgroundStyles, panelGenerateProductBackground, type ApiBackgroundStyle } from '@/lib/api'

// Mismo valor que SIN_FONDO_KEY en apps/api/src/image-studio/background-styles.ts
// — no compone nada, es el único estilo que se muestra con el checkerboard de
// transparencia.
const SIN_FONDO_KEY = 'sin_fondo'
const BLANCO_LISO_KEY = 'blanco_liso'
const NEGRO_LISO_KEY = 'negro_liso'

// Slider de estilos: siempre dos filas por página.
const FILAS_ESTILOS = 2
const ANCHO_MIN_ESTILO = 84
const GAP_ESTILOS = 8

export type ImagenParaFondo =
    | { key: string; tipo: 'pendiente'; file: File; preview: string }
    | { key: string; tipo: 'guardada'; url: string; preview: string }

export interface ResultadoFondo { file: File; url: string }

interface Props {
    isOpen: boolean
    onClose: () => void
    imagenes: ImagenParaFondo[]
    /** Se llama una vez por foto elegida, con la promesa de su resultado, y el
     *  modal se cierra sin esperarla. El que llama marca la foto como "en
     *  proceso", la reemplaza (o la agrega, si era una guardada) cuando la
     *  promesa resuelve y avisa si falla. */
    onAplicarEnSegundoPlano: (origen: ImagenParaFondo, resultado: Promise<ResultadoFondo>) => void
    onToast: (m: string) => void
    /** Plano o con volumen (Product.photoType) — se manda al backend pero
     *  generateBackground() no lo usa hoy (queda como dato, sin efecto). */
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

// Cuántas columnas entran en el ancho disponible (mínimo 84px por estilo): el
// slider las usa para saber cuántos estilos caben en una página de dos filas.
function useColumnas() {
    const [ancho, setAncho] = useState(0)
    const observador = useRef<ResizeObserver | null>(null)
    const ref = useCallback((el: HTMLDivElement | null) => {
        observador.current?.disconnect()
        observador.current = null
        if (!el) return
        setAncho(el.clientWidth)
        const ro = new ResizeObserver(() => setAncho(el.clientWidth))
        ro.observe(el)
        observador.current = ro
    }, [])
    const columnas = ancho > 0
        ? Math.max(3, Math.min(8, Math.floor((ancho + GAP_ESTILOS) / (ANCHO_MIN_ESTILO + GAP_ESTILOS))))
        : 7
    return { ref, columnas }
}

export function EstudioFondoModal({ isOpen, onClose, imagenes, onAplicarEnSegundoPlano, onToast, photoType }: Props) {
    const [estilos, setEstilos] = useState<ApiBackgroundStyle[] | null>(null)
    const [errorEstilos, setErrorEstilos] = useState<string | null>(null)
    const [estiloElegido, setEstiloElegido] = useState<string | null>(null)

    // Página del slider de estilos.
    const [pagina, setPagina] = useState(0)
    const { ref: gridRef, columnas } = useColumnas()
    const tamPagina = columnas * FILAS_ESTILOS
    const totalPaginas = estilos ? Math.max(1, Math.ceil(estilos.length / tamPagina)) : 1
    const paginaActual = Math.min(pagina, totalPaginas - 1)
    const estilosDePagina = estilos ? estilos.slice(paginaActual * tamPagina, (paginaActual + 1) * tamPagina) : []
    const irAPagina = (p: number) => setPagina(Math.max(0, Math.min(totalPaginas - 1, p)))
    const toqueX = useRef<number | null>(null)

    // Qué fotos de la tira de arriba se van a transformar — no forzar "todas o
    // ninguna", poder elegir una sola o un subconjunto. Por default entran
    // todas, y cada miniatura funciona como un checkbox.
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
                setEstiloElegido(actual => (actual && r.some(e => e.key === actual) ? actual : null))
            })
            .catch(e => { if (!cancelado) setErrorEstilos(e instanceof ApiError ? e.message : 'No se pudieron cargar los estilos') })
        return () => { cancelado = true }
    }, [isOpen, photoType])

    // Al cerrar, se resetea todo — cada apertura arranca de cero (no tiene
    // sentido recordar el estilo elegido la sesión pasada).
    useEffect(() => {
        if (!isOpen) {
            setEstiloElegido(null)
            setPagina(0)
        }
    }, [isOpen])

    // Pide el fondo de UNA foto y lo deja como archivo listo para usar.
    function pedirFondo(img: ImagenParaFondo, estilo: string): Promise<ResultadoFondo> {
        return panelGenerateProductBackground(origenParaApi(img), { estilo, photoType }).then(r => {
            const file = base64AFile(r.base64, r.mimeType, nombreDeImagen(img))
            return { file, url: URL.createObjectURL(file) }
        })
    }

    // Cierra el modal y deja los pedidos corriendo: de a dos en paralelo (una
    // por una era lento; todas juntas pisaría el cupo diario y la cola del
    // servidor). Si un pedido falla, los siguientes de su carril siguen.
    function aplicar() {
        if (!estiloElegido || imagenesElegidas.length === 0) return
        const carriles: Promise<unknown>[] = [Promise.resolve(), Promise.resolve()]
        imagenesElegidas.forEach((img, i) => {
            const c = i % carriles.length
            const pedido = carriles[c].then(() => pedirFondo(img, estiloElegido))
            carriles[c] = pedido.catch(() => undefined)
            onAplicarEnSegundoPlano(img, pedido)
        })
        onToast('Aplicando el fondo… podés seguir cargando el producto, la foto se actualiza sola.')
        onClose()
    }

    const puedeAplicar = !!estiloElegido && imagenesElegidas.length > 0

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Fondo con IA"
            maxWidth={760}
            footer={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', flex: '1 1 220px', minWidth: 0, lineHeight: 1.4 }}>
                        Se aplica en segundo plano: podés seguir cargando el producto.
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
                        <Button
                            variant="primary" size="sm"
                            icon={<Check size={14} strokeWidth={2.2} />}
                            onClick={aplicar}
                            disabled={!puedeAplicar}
                        >
                            {imagenesElegidas.length === 1 ? 'Aplicar a esta foto' : `Aplicar a ${imagenesElegidas.length} fotos`}
                        </Button>
                    </div>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
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
                                    title={elegida ? 'Sacar de la selección' : 'Sumar a la selección'}
                                    style={{
                                        position: 'relative', width: 44, height: 44, padding: 0, flexShrink: 0,
                                        borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
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
                    {imagenesElegidas.length === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--color-error)' }}>
                            <AlertCircle size={14} strokeWidth={2} />
                            Elegí al menos una foto para aplicar el fondo.
                        </div>
                    )}
                </div>

                {/* Selector de estilo: slider de dos filas con flechas. */}
                <div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-body)', marginBottom: 8 }}>
                        Elegí un fondo y aplicalo: lo ves en la vista previa del producto.
                    </div>
                    {errorEstilos && <div style={{ fontSize: 12.5, color: 'var(--color-error)' }}>{errorEstilos}</div>}
                    {!estilos && !errorEstilos && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: GAP_ESTILOS }}>
                            {Array.from({ length: 7 * FILAS_ESTILOS }).map((_, i) => <Skeleton key={i} width="100%" height={84} radius={8} delay={i * 30} />)}
                        </div>
                    )}
                    {estilos && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FlechaSlider dir="izq" disabled={paginaActual === 0} onClick={() => irAPagina(paginaActual - 1)} />
                                <div
                                    ref={gridRef}
                                    onTouchStart={e => { toqueX.current = e.touches[0].clientX }}
                                    onTouchEnd={e => {
                                        if (toqueX.current == null) return
                                        const dx = e.changedTouches[0].clientX - toqueX.current
                                        toqueX.current = null
                                        if (Math.abs(dx) > 40) irAPagina(paginaActual + (dx < 0 ? 1 : -1))
                                    }}
                                    style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, gap: GAP_ESTILOS, alignContent: 'start' }}
                                >
                                    {estilosDePagina.map(e => {
                                        const elegido = e.key === estiloElegido
                                        return (
                                            <button
                                                key={e.key}
                                                type="button"
                                                onClick={() => setEstiloElegido(e.key)}
                                                title={e.label}
                                                aria-pressed={elegido}
                                                style={{
                                                    position: 'relative', display: 'flex', flexDirection: 'column', gap: 4,
                                                    padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                                                    fontFamily: 'inherit', textAlign: 'left', minWidth: 0,
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
                                                    } : e.key === BLANCO_LISO_KEY ? {
                                                        background: '#ffffff',
                                                    } : e.key === NEGRO_LISO_KEY ? {
                                                        background: '#000000',
                                                    } : !e.previewUrl ? { background: 'var(--color-primary-bg)' } : {}),
                                                }}>
                                                    {e.previewUrl
                                                        ? <img src={e.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                        : e.key === SIN_FONDO_KEY
                                                            ? <Scissors size={22} strokeWidth={1.6} color="var(--color-muted)" />
                                                            : e.key === BLANCO_LISO_KEY
                                                                ? <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }} />
                                                                : e.key === NEGRO_LISO_KEY
                                                                    ? <div style={{ width: 28, height: 28, borderRadius: 6, background: '#000000', border: '1.5px solid #475569', boxShadow: '0 2px 5px rgba(0,0,0,0.25)' }} />
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
                                    {/* Relleno invisible: la última página (con menos estilos) queda de la
                                        misma altura que las demás y el modal no se mueve al pasar de página. */}
                                    {Array.from({ length: Math.max(0, tamPagina - estilosDePagina.length) }).map((_, i) => (
                                        <div key={`relleno-${i}`} aria-hidden style={{ visibility: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ width: '100%', aspectRatio: '1' }} />
                                            <span style={{ fontSize: 10.5, lineHeight: 1.3 }}>&nbsp;<br />&nbsp;</span>
                                        </div>
                                    ))}
                                </div>
                                <FlechaSlider dir="der" disabled={paginaActual >= totalPaginas - 1} onClick={() => irAPagina(paginaActual + 1)} />
                            </div>
                            {totalPaginas > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 }} role="group" aria-label="Páginas de fondos">
                                    {Array.from({ length: totalPaginas }).map((_, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => irAPagina(i)}
                                            aria-label={`Página ${i + 1} de ${totalPaginas}`}
                                            aria-current={i === paginaActual}
                                            style={{
                                                width: i === paginaActual ? 18 : 7, height: 7, borderRadius: 4, border: 'none', padding: 0, cursor: 'pointer',
                                                background: i === paginaActual ? 'var(--color-primary)' : 'var(--color-border-strong, var(--color-border))',
                                                transition: 'width 150ms ease, background 150ms ease',
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {estiloElegido === SIN_FONDO_KEY && (
                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
                            <span><strong>Consejo para recortes limpios:</strong> usá fondos lisos que contrasten con el color de la prenda (evitá alfombras de pelo o fondos del mismo tono).</span>
                            <span>Si fotografiás un conjunto de 2 piezas, dejalas con unos centímetros de separación.</span>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}

// Flecha del slider de estilos: círculo de 32px, apagada en el primer/último tramo.
function FlechaSlider({ dir, disabled, onClick }: { dir: 'izq' | 'der'; disabled: boolean; onClick: () => void }) {
    const Icono = dir === 'izq' ? ChevronLeft : ChevronRight
    return (
        <button
            type="button"
            className="ds-hover"
            onClick={onClick}
            disabled={disabled}
            aria-label={dir === 'izq' ? 'Fondos anteriores' : 'Más fondos'}
            style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', padding: 0,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
                cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, alignSelf: 'center',
            }}
        >
            <Icono size={16} strokeWidth={2} />
        </button>
    )
}
