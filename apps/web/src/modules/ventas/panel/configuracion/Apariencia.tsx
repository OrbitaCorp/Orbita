// src/modules/ventas/panel/configuracion/Apariencia.tsx — Vista 16
// Apariencia pública de la tienda: identidad de marca, paleta, tipografía,
// layout, visibilidad, textos y CSS custom — con vista previa en vivo.

import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { Palette, Type, LayoutGrid, Eye, Droplets, Sun, Moon, Monitor, ExternalLink, Plus, Check, ChevronDown, X, Trash2, Hash, ArrowUp, ArrowDown, LayoutTemplate, Ticket, Menu, AlignLeft, PanelBottom, BadgeCheck, Video, Image as ImageIcon, MessageCircle } from 'lucide-react'
// Para saber si la plantilla activa declara una sección de cupón — así esta
// pantalla no tiene una lista hardcodeada de qué plantilla tiene qué.
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import { seccionesDe } from '@/modules/ventas/panel/avanzado/plantillas/secciones'
import type { CampoSeccion } from '@/modules/ventas/panel/avanzado/plantillas/tipos'
import { Button } from '@/design-system/components/Button'
import { Card } from '@/design-system/components/Card'
import { Modal } from '@/design-system/components/Modal'
import { Skeleton } from '@/design-system/components/Skeleton'
import { ApiError, panelGetAppearance, panelGetBusiness, panelUpdateAppearance, panelUploadStorefrontImage, panelPresignStorefrontVideo, panelSetHomeTemplate, panelGetCategoriesFlat, panelGetProducts, type ApiCategory, type ApiProductListItem } from '@/lib/api'
import { ROOT_DOMAIN, adminPath, currentSlug } from '@/lib/tenant'
import { parseVideoEmbed } from '@/lib/storefront/utils'

import type { VistaConfig } from './components/ConfigTabs'
import { ImgUploader } from './components/apariencia/ImgUploader'
import { LogoPicker } from './components/apariencia/LogoPicker'
import { VideoUploader, esVideoArchivo } from './components/apariencia/VideoUploader'
import { StorePreview } from './components/apariencia/StorePreview'
// Las explicaciones "qué es / dónde se ve / en qué afecta" de cada tarjeta y
// de cada interruptor. Hacen falta sobre todo en mobile, donde la vista
// previa en vivo no se muestra (ver la media query de .ap-preview).
import { AyudaBoton, AyudaPanel, type Ayuda } from './components/apariencia/AyudaSeccion'
import { AYUDA_SECCIONES, AYUDA_OPCIONES } from './components/apariencia/ayudas'
import {
    AP_DEFAULTS, PRESET_COLORS, FONT_DESCRIPCIONES, GOOGLE_FONTS, BG_PATTERNS, BG_PATTERN_SCOPES, IMAGE_OVERLAYS,
    CATEGORY_LAYOUTS, CATEGORY_LAYOUT_MAX, VIDEO_LAYOUTS, WHATSAPP_LAYOUTS,
    loadFont, fontStack,
    type Apariencia as Ap, type ModoColor, type EscalaFuente, type LayoutHeader,
    type LayoutGrid as LayoutGridT, type CategoryLayout as CategoryLayoutT, type HeroSlide,
    type ImageStyle, type ImagePosition, type ImageOverlay, type BgPattern, type BgPatternScope,
    type VideoItem, type VideoLayout, type WhatsappLayout,
} from './mock/apariencia.mock'
import { apToUpdateDto, dtoToAp } from './mock/apariencia.mapper'

// Intercambia el elemento en `from` con el que está en `to` — usado para
// reordenar los sliders del hero con las flechas subir/bajar (ver SlideItem).
function moverElemento<T>(arr: T[], from: number, to: number): T[] {
    if (to < 0 || to >= arr.length) return arr
    const next = arr.slice()
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
}

// Nombre visible de cada plantilla de Home enganchada de verdad (ver
// panel/avanzado/plantillas/datos.tsx para el catálogo completo — acá solo
// va la que ya tiene lógica real detrás, hoy nada más que Vidriera).
const NOMBRE_PLANTILLA: Record<string, string> = { vidriera: 'Vidriera' }

// Umbral para el aviso "cargá tu catálogo" de más abajo — con menos que esto
// las grillas de productos/categorías de la vista previa se ven demasiado
// vacías o repetidas como para juzgar el diseño en serio, aunque ya no estén
// literalmente en cero.
const CATALOGO_PREVIEW_MIN = { productos: 10, categorias: 5 }

async function subirImagenApariencia(file: File): Promise<string> {
    const r = await panelUploadStorefrontImage(file, file.name)
    return r.url
}

// El archivo de la sección de video (VideoUploader) — alternativa a pegar
// un link. Sube directo a Cloudflare R2 desde el navegador (ver
// panelPresignStorefrontVideo en lib/api.ts), sin recodificar y sin pasar
// por este backend — por eso el tope real ya no son los 40 MB de
// panelUploadStorefrontVideo (que se mantiene solo por compatibilidad).
async function subirVideoApariencia(file: File, onProgress?: (pct: number) => void): Promise<string> {
    return panelPresignStorefrontVideo(file, onProgress)
}

// Variante para la imagen de un slide: además de subir, puede pedirle al
// backend que le quite el fondo antes de convertir a webp (ver
// BackgroundRemovalService en el backend — corre 100% local, sin APIs externas).
function subirImagenSlide(removeBg: boolean) {
    return async (file: File): Promise<string> => {
        const r = await panelUploadStorefrontImage(file, file.name, { removeBackground: removeBg })
        return r.url
    }
}

type IconT = ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>

// ─── Skeleton — misma forma exacta del layout real (mismo criterio que
// mensajes/Bandeja.tsx/Plantillas.tsx), con el shimmer del componente
// compartido design-system/Skeleton.tsx. No replica cada control de cada
// SecCard (serían decenas) sino la forma general: header + N secciones con
// unas pocas líneas cada una + el panel de preview a la derecha. ───────────
function SecCardSkeleton({ lineas }: { lineas: number }) {
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Skeleton width={30} height={30} radius={8} />
                <Skeleton width={140} height={15} radius={8} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: lineas }).map((_, i) => <Skeleton key={i} width="100%" height={38} radius={8} />)}
            </div>
        </div>
    )
}

function AparienciaSkeleton() {
    return (
        <div style={pageWrap}>
            <style>{`
                .ap-split-sk { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 28px; align-items: start; }
                @media (max-width: 1100px) { .ap-split-sk { grid-template-columns: minmax(0,1fr); } }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                    <Skeleton width={220} height={30} radius={8} style={{ marginBottom: 8 }} />
                    <Skeleton width={320} height={13} radius={8} />
                </div>
                <Skeleton width={140} height={36} radius={8} />
            </div>
            <div className="ap-split-sk">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SecCardSkeleton lineas={5} />
                    <SecCardSkeleton lineas={4} />
                    <SecCardSkeleton lineas={3} />
                    <SecCardSkeleton lineas={4} />
                </div>
                <Skeleton width="100%" height={640} radius={16} />
            </div>
        </div>
    )
}

interface AparienciaProps {
    ir:      (v: VistaConfig) => void
    onToast: (m: string) => void
    // Modo restringido: usado por PlantillasConfig.tsx para editar SOLO
    // anuncio/hero/confianza mientras una plantilla de Home está activa —
    // los mismos heroSlides/statsBar/shippingText de siempre (no hay un JSON
    // aparte por plantilla), pero sin exponer marca/colores/tipografía/layout
    // (esos los gestiona la plantilla, no el dueño, mientras esté puesta) ni
    // el gate de "Apariencia bloqueada" (este ES el lugar habilitado para
    // editar ese contenido con la plantilla activa).
    soloContenido?: boolean
}

// Los enlaces de navegación que no dependen del catálogo del negocio. Mismos
// ids que ya entiende el storefront (ver PATH_POR_ID en StorefrontHeader).
const LINKS_FIJOS_HEADER = [
    { id: 'catalogo', label: 'Catálogo' },
    { id: 'ofertas', label: 'Ofertas' },
    { id: 'masVendidos', label: 'Más vendidos' },
]

// Editando una plantilla activa (soloContenido): antes esto era una grilla de
// dos columnas desparejas —Hero solo a la izquierda, Header + cinco tarjetas
// más apiladas a la derecha— así que apenas el Hero se quedaba sin contenido
// la columna izquierda quedaba en blanco mientras la derecha seguía sola
// varias pantallas más (pedido explícito del dueño, con capturas: "se feo
// todo asi en dos columnas, requiere mucho scroll igual"). Con pestañas cada
// vista muestra solo lo suyo, en una columna prolija — mismo patrón
// `role="tablist"` que ya usa JuegosConfig.tsx/ClienteDetalle.tsx.
type TabPlantilla = 'hero' | 'header' | 'secciones' | 'contenido' | 'pie'
// "Secciones" solo aparece si la plantilla activa declaró las suyas (ver
// plantillas/secciones.ts): son las que ninguna otra plantilla tiene, así que
// la pestaña no existe para las que todavía no las declararon.
const TABS_PLANTILLA: [TabPlantilla, string][] = [
    ['hero', 'Hero'],
    ['header', 'Header'],
    ['secciones', 'Secciones'],
    ['contenido', 'Contenido'],
    ['pie', 'Pie de página'],
]

export default function Apariencia({ ir, onToast, soloContenido = false }: AparienciaProps) {
    const router = useRouter()
    const [ap, setApRaw] = useState<Ap>(AP_DEFAULTS)
    const [dirty, setDirty] = useState(false)
    // Lo que la tienda muestra HOY (lo último cargado o guardado). La vista
    // previa lo usa para el "Publicado / Con tus cambios", y "Descartar"
    // vuelve el formulario a esto sin tocar el backend.
    const [publicado, setPublicado] = useState<Ap | null>(null)
    const [fullPreview, setFullPreview] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    // Categorías reales del negocio — solo hacen falta editando una plantilla
    // (la tarjeta "Header" de más abajo las ofrece como enlaces). En Apariencia
    // completa no se piden: ahí el header se edita con la lista fija de
    // siempre, dentro de "Diseño y layout".
    const [categorias, setCategorias] = useState<ApiCategory[]>([])
    // El catálogo, para los campos `seleccion` de las secciones de plantilla
    // (ver TipoCampo en plantillas/tipos.ts): "Armá tu setup" de Nocturno deja
    // elegir una categoría O un producto concreto, así que hacen falta los dos.
    const [productos, setProductos] = useState<ApiProductListItem[]>([])
    // Aviso "cargá tu catálogo antes de diseñar" — se puede cerrar y no
    // vuelve a aparecer en esta visita (se resetea solo al recargar la
    // pantalla, no queda guardado entre sesiones: si sigue sin catálogo la
    // próxima vez que entre, tiene sentido que lo vea de nuevo).
    const [avisoCatalogoCerrado, setAvisoCatalogoCerrado] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

    // Plantilla de Home activa (Avanzado → Plantillas) — mientras no sea null,
    // esta pantalla se bloquea: edita los MISMOS heroSlides/statsBar/
    // shippingText que Apariencia, así que las dos a la vez sería un
    // quilombo (pedido explícito del dueño). Se edita desde PlantillasConfig
    // en su lugar mientras la plantilla esté puesta.
    const [homeTemplate, setHomeTemplateLocal] = useState<string | null>(null)
    // Tope de slides del hero de la plantilla activa (ver heroMaxSlides en
    // tipos.ts) — undefined = sin tope. Sin sentido fuera de soloContenido,
    // que es donde homeTemplate representa una plantilla realmente puesta.
    const heroMax = soloContenido ? PLANTILLAS.find(x => x.id === homeTemplate)?.heroMaxSlides : undefined
    // Escaparate (heroPropio): sus "campañas" son posiciones FIJAS del hero
    // (izquierda/derecha), no un carrusel que rota — a diferencia de Vidriera
    // (heroGrande), que sí usa el HeroCarousel genérico con N slides. Sirve
    // para no llamarlo "slider"/"carrusel" en la UI de una plantilla cuyo
    // diseño no contempla eso (pedido explícito, con capturas de la maqueta
    // original: dos imágenes fijas, nunca rotando).
    const heroNoRotativo = soloContenido && !!PLANTILLAS.find(x => x.id === homeTemplate)?.heroPropio
    // Escaparate (o cualquier plantilla que declare headerBold): el toggle
    // de "ícono de marca" solo tiene sentido ahí — las demás siempre
    // muestran el ícono, sin leer este campo (ver StorefrontChrome.tsx).
    const conIconoOpcional = soloContenido && !!PLANTILLAS.find(x => x.id === homeTemplate)?.headerBold
    // Las secciones propias de la plantilla activa, en el orden en que se ven
    // en la portada (lo define cada plantilla en secciones.ts).
    const seccionesPlantilla = soloContenido ? seccionesDe(homeTemplate) : []
    const [modalVolver, setModalVolver] = useState(false)
    const [volviendo, setVolviendo] = useState(false)
    // Pestaña activa del editor de plantilla (ver TABS_PLANTILLA) — sin uso
    // fuera de soloContenido.
    const [tabPlantilla, setTabPlantilla] = useState<TabPlantilla>('hero')

    const set = <K extends keyof Ap>(k: K, v: Ap[K]) => { setApRaw(p => ({ ...p, [k]: v })); setDirty(true) }

    // Subdominio real, para la vista previa — antes ahí decía siempre
    // "rama.orbita.shop" fijo, ni fuera el negocio de verdad.
    const [subdomain, setSubdomain] = useState('')

    // El nombre del NEGOCIO es el default del "nombre de la tienda" mientras
    // el dueño no haya guardado uno propio en Apariencia. Antes el default era
    // el del mock ("Rama Indumentaria") y, como se guarda tal cual al tocar
    // "Guardar", terminaba siendo el nombre real de la tienda en la base — y
    // eso era lo que veían sus clientes. Si el pedido del negocio falla, el
    // campo queda vacío (con su placeholder): nunca se inventa una marca.
    useEffect(() => {
        let cancelado = false
        Promise.all([
            panelGetAppearance(),
            panelGetBusiness().catch(() => null),
        ])
            .then(([dto, biz]) => {
                if (cancelado) return
                const cargado = dtoToAp(dto, { ...AP_DEFAULTS, nombreTienda: biz?.name ?? AP_DEFAULTS.nombreTienda })
                setApRaw(cargado)
                setPublicado(cargado)
                setHomeTemplateLocal(dto.homeTemplate)
                if (biz?.subdomain) setSubdomain(biz.subdomain)
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la apariencia') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    // Aparte del Promise.all de arriba: si el negocio no tiene categorías, o
    // el pedido falla, la pantalla igual carga — la tarjeta "Header" queda
    // con los enlaces fijos y sin categorías, en vez de trabar todo.
    // Ya no está gateado a `soloContenido`: además de los enlaces del header,
    // ahora se usa para saber si alguna categoría tiene FOTO cargada, que es
    // lo que habilita los estilos de categoría basados en imagen (ver
    // "Estilo de las categorías" más abajo).
    useEffect(() => {
        let cancelado = false
        panelGetCategoriesFlat()
            .then(cats => { if (!cancelado) setCategorias(cats.filter(c => c.isActive)) })
            .catch(() => { /* sin categorías: la tarjeta muestra solo los enlaces fijos */ })
        // 100 es el TOPE de la API (`@Max(100)` en find-products-query.dto.ts),
        // no una elección: pedir más devuelve 400 y el catch de abajo se lo
        // come en silencio, así que el desplegable quedaba sin productos y
        // ofrecía solo categorías. Si el negocio tiene más de 100, el selector
        // muestra los primeros 100.
        panelGetProducts({ limit: 100 })
            // Sin los borradores: la tienda no los publica, así que elegir uno
            // no mostraría nada (la portada no lo encontraría y llenaría ese
            // lugar con otro, sin avisar). OUT_OF_STOCK sí queda: está
            // publicado, se ve, y puede volver a tener stock.
            .then(r => { if (!cancelado) setProductos(r.data.filter(x => x.status !== 'DRAFT')) })
            .catch(() => { /* sin catálogo: el selector ofrece solo categorías */ })
        return () => { cancelado = true }
    }, [])

    useEffect(() => { loadFont(ap.fuenteHeading); loadFont(ap.fuenteBody) }, [ap.fuenteHeading, ap.fuenteBody])

    async function guardar() {
        setGuardando(true)
        setErrorGuardado(null)
        try {
            const actualizado = await panelUpdateAppearance(apToUpdateDto(ap))
            const guardado = dtoToAp(actualizado, AP_DEFAULTS)
            setApRaw(guardado)
            setPublicado(guardado)
            setDirty(false)
            onToast('Cambios guardados y publicados')
        } catch (e) {
            setErrorGuardado(e instanceof ApiError ? e.message : 'No se pudo guardar la apariencia')
        } finally {
            setGuardando(false)
        }
    }
    function descartar() {
        if (!publicado) return
        setApRaw(publicado)
        setDirty(false)
        setErrorGuardado(null)
    }
    const fontOpts = Object.keys(GOOGLE_FONTS)

    // Lo que puede ir en la fila de nav: los tres enlaces fijos de siempre +
    // una entrada por categoría real. El `on` sale de lo ya guardado en
    // headerLinks; lo que nunca se tocó arranca apagado. Al togglear se
    // reescribe la lista COMPLETA, así queda normalizada y el storefront no
    // depende de que el negocio tenga entradas viejas o incompletas.
    const itemsHeader: { id: string; label: string; on: boolean; esCategoria: boolean }[] = [
        ...LINKS_FIJOS_HEADER.map(l => ({ ...l, esCategoria: false })),
        ...categorias.map(c => ({ id: `cat:${c.slug}`, label: c.name, esCategoria: true })),
    ].map(base => ({ ...base, on: ap.headerLinks.find(x => x.id === base.id)?.on ?? false }))

    // Habilita los estilos de categoría basados en imagen. Mientras las
    // categorías no terminen de cargar queda en false: es el lado seguro —
    // una opción que aparece deshabilitada y se habilita sola molesta menos
    // que una elegible que dibuja una sección vacía.
    const hayFotosDeCategoria = categorias.some(c => !!c.imageUrl)

    // Editando una plantilla, solo se ofrece lo que ESA plantilla dibuja de
    // verdad. El anuncio de Apariencia no se ve en las que traen su propio
    // cintillo o cartel corriendo (`headerPropio` — ver StorefrontChrome, que
    // apaga el banner ahí), y la barra de estadísticas no se ve en las que
    // tienen su propia franja (`usaStats: false`: las tres promesas de
    // Premium, los números de Nocturno, los sellos de Glow). Ofrecerlos igual
    // era prometer un interruptor que no mueve nada (reportado con captura
    // sobre Premium).
    const plantillaActiva = soloContenido ? PLANTILLAS.find(x => x.id === homeTemplate) : undefined
    const usaAnuncio = soloContenido ? !plantillaActiva?.headerPropio : true
    const usaStats = soloContenido ? plantillaActiva?.usaStats !== false : true

    const ESTANTES: [keyof Ap, string][] = [
        ['mostrarDestacados', 'Destacados'],
        ['mostrarNuevos', 'Nuevos ingresos'],
        ['mostrarRecomendados', 'Recomendados'],
        ['mostrarTopVentas', 'Top ventas'],
    ]

    const toggles: [keyof Ap, string][] = soloContenido
        ? ([
            ...(usaAnuncio ? [['mostrarBannerEnvio', 'Anuncio arriba del header'] as [keyof Ap, string]] : []),
            ...(usaStats ? [['mostrarStats', 'Barra de confianza debajo del hero'] as [keyof Ap, string]] : []),
        ])
        // `mostrarFooter`/`mostrarRedesFooter` viven en la nueva sección
        // "Pie de página" (tienen su propia tarjeta ahí, con la descripción
        // debajo del logo), no acá mezclados con el resto de la visibilidad.
        : [['mostrarResenas', 'Opiniones de clientes'], ['mostrarBadgeNuevo', 'Badge "Nuevo"'], ['mostrarBadgeOferta', 'Badge "Oferta" con %'], ['mostrarStockBajo', 'Indicador de stock bajo'], ['mostrarWhatsapp', 'WhatsApp flotante'], ['mostrarBuscador', 'Barra de búsqueda'], ['mostrarCategorias', 'Sección de categorías'], ['mostrarBannerEnvio', 'Banner debajo del header'], ['mostrarStats', 'Barra de estadísticas debajo del slider']]

    // Tarjetas que se ven IGUAL con o sin plantilla activa (a diferencia de
    // Identidad/Paleta/Tipografía/Diseño, que solo tiene sentido tocar sin
    // plantilla — eso lo dibuja ella). Piezas sueltas (no un solo bloque):
    // en Apariencia completa fluyen todas juntas en la columna de controles
    // (ver `tarjetasSecundarias` más abajo); editando una plantilla activa
    // cada una vive en la pestaña que le corresponde (ver TABS_PLANTILLA),
    // para no volver a apilarlas todas de una en una sola columna larga.
    const secVisibilidad = (
        <SecCard id="ap-sec-visibilidad" title={soloContenido ? 'Visibilidad' : '¿Qué ven tus clientes?'} icon={Eye} ayuda={AYUDA_SECCIONES[soloContenido ? 'visibilidadPlantilla' : 'visibilidad']}>
            <div className="ap-toggle-grid" style={{ display: 'grid', gridTemplateColumns: soloContenido ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
                {toggles.map(([k, l]) => (
                    <ToggleRow key={k} label={l} on={ap[k] as boolean} onChange={v => set(k, v as Ap[typeof k])} ayuda={AYUDA_OPCIONES[k]} />
                ))}
            </div>
            {/* Los estantes de productos del home clásico (Ale, 19/09): cada
                uno muestra lo que dice su nombre, y cada uno se puede apagar.
                Con plantilla activa no aplican — las filas de productos las
                define la plantilla (pestaña Secciones). */}
            {!soloContenido && (
                <>
                    <Divider />
                    <FieldLabel help="Las filas de productos del inicio. Cada una se arma sola con datos reales; si no hay productos para mostrar, no aparece.">Filas de productos en el inicio</FieldLabel>
                    <div className="ap-toggle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                        {ESTANTES.map(([k, l]) => (
                            <ToggleRow key={k} label={l} on={ap[k] as boolean} onChange={v => set(k, v as Ap[typeof k])} ayuda={AYUDA_OPCIONES[k]} />
                        ))}
                    </div>
                </>
            )}
        </SecCard>
    )

    const secTextos = (
        <SecCard id="ap-sec-textos" title="Textos de tu tienda" icon={AlignLeft} ayuda={AYUDA_SECCIONES.textos}>
            <div style={{ marginBottom: 6 }}><FieldLabel help="Se muestra en el banner angosto debajo del header, si está activado en '¿Qué ven tus clientes?'.">Mensaje del banner debajo del header</FieldLabel><Inp value={ap.textoEnvio} onChange={v => set('textoEnvio', v)} /></div>
            {/* Pedido explícito del dueño: que el banner se pueda
                mostrar como cartelera (se desliza en loop) en vez
                de quedarse fijo centrado — mandó de referencia
                una tienda con "3X1 + ENVÍO GRATIS" corriendo.
                Deshabilitado (no oculto) si el banner está
                apagado: así se ve que existe la opción, sin
                confundir con "¿por qué no aparece?". */}
            <div style={{ marginBottom: soloContenido ? 0 : 14, opacity: ap.mostrarBannerEnvio ? 1 : 0.5, pointerEvents: ap.mostrarBannerEnvio ? 'auto' : 'none' }}>
                <ToggleRow label="Mostrar como cartelera (se desliza)" on={ap.bannerDesplazable} onChange={v => set('bannerDesplazable', v)} ayuda={AYUDA_OPCIONES.bannerDesplazable} />
            </div>
            {/* Decía "Texto del botón de WhatsApp", y no es eso: el botón
                flotante es solo el ícono verde, sin texto (ver
                FloatingWhatsapp.tsx). Esto es el mensaje que queda YA ESCRITO
                en el chat cuando el cliente lo toca — vacío, WhatsApp abre
                con "Hola! Quería hacer una consulta.". */}
            {!soloContenido && <div><FieldLabel help="El mensaje que aparece ya escrito en el chat cuando tu cliente toca el botón de WhatsApp. Él lo puede borrar o cambiar antes de enviarlo.">Mensaje del botón de WhatsApp</FieldLabel><Inp value={ap.textoWhatsapp} onChange={v => set('textoWhatsapp', v)} maxLength={30} /></div>}
        </SecCard>
    )

    const secEstadisticas = (
        <SecCard id="ap-sec-estadisticas" title="Barra de estadísticas" icon={Hash} ayuda={AYUDA_SECCIONES.estadisticas}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
                Aparece debajo del slider del hero, si está activada en "¿Qué ven tus clientes?". Son valores decorativos que escribís vos, no se calculan solos.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {ap.stats.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div className="ap-stat-val" style={{ width: 100, flexShrink: 0 }}>
                            <Inp value={s.value} onChange={v => set('stats', ap.stats.map((x, j) => j === i ? { ...x, value: v } : x))} maxLength={12} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Inp value={s.label} onChange={v => set('stats', ap.stats.map((x, j) => j === i ? { ...x, label: v } : x))} maxLength={30} />
                        </div>
                        <button
                            onClick={() => set('stats', ap.stats.filter((_, j) => j !== i))}
                            title="Quitar"
                            style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'color 150ms, background 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
            {ap.stats.length < 6 && (
                <button
                    onClick={() => set('stats', [...ap.stats, { id: 'st' + Date.now(), value: '', label: '' }])}
                    className="ds-hover"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                    <Plus size={14} strokeWidth={2} /> Agregar estadística
                </button>
            )}
        </SecCard>
    )

    // Pie de página — la descripción vive en el MISMO campo que antes era
    // "Tagline" de Identidad de marca (ap.tagline): es lo único que la usa en
    // todo el storefront (ver StorefrontFooter, el párrafo debajo del logo).
    // Estaba mal ubicada — nada en esa pantalla decía que era justo eso lo
    // que se veía ahí abajo — así que se mudó acá, con el nombre y el
    // ayuda-texto que sí lo dicen, junto a los dos toggles de footer que
    // antes estaban sueltos dentro de "¿Qué ven tus clientes?". Sin gate de
    // soloContenido: el pie de página es el MISMO en cualquier plantilla
    // (Inicio.tsx lo dibuja aparte del home, no lo arma la plantilla) — a
    // diferencia de Identidad/Paleta/Tipografía/Diseño, acá sí tiene sentido
    // seguir editando aunque haya una plantilla activa.
    const secPie = (
        <SecCard id="ap-sec-pie" title="Pie de página" icon={PanelBottom} ayuda={AYUDA_SECCIONES.pie}>
            <div style={{ marginBottom: 14 }}>
                <FieldLabel help="Aparece debajo de tu logo, en el pie de página de la tienda.">Descripción</FieldLabel>
                <Inp value={ap.tagline} onChange={v => set('tagline', v)} maxLength={160} suffix={<span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{ap.tagline.length}/160</span>} />
            </div>
            <ToggleRow label="Mostrar el pie de página" on={ap.mostrarFooter} onChange={v => set('mostrarFooter', v)} ayuda={AYUDA_OPCIONES.mostrarFooter} />
            <ToggleRow label="Redes sociales en el pie de página" on={ap.mostrarRedesFooter} onChange={v => set('mostrarRedesFooter', v)} ayuda={AYUDA_OPCIONES.mostrarRedesFooter} />
        </SecCard>
    )

    // Cupón — es contenido de la PLANTILLA, no de la tienda: solo aparece
    // editando la plantilla activa (soloContenido) y solo si esa plantilla
    // declara una sección de cupón en sus datos. Una plantilla futura que no
    // la tenga no muestra esta tarjeta, y una que sí la tenga la muestra
    // sola — sin tocar este archivo.
    const secCupon = soloContenido && PLANTILLAS.find(x => x.id === homeTemplate)?.cupon ? (
        <SecCard id="ap-sec-cupon" title="Cupón" icon={Ticket} ayuda={AYUDA_SECCIONES.cupon}>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
                El bloque oscuro con el código, cerca del final del home. Dejá el código vacío para no mostrarlo.
            </p>
            <div style={{ marginBottom: 10 }}>
                <FieldLabel>Título</FieldLabel>
                <Inp value={ap.cupon.titulo} onChange={v => set('cupon', { ...ap.cupon, titulo: v })} maxLength={60} />
            </div>
            <div style={{ marginBottom: 10 }}>
                <FieldLabel help="La línea chica debajo del título — sirve para aclarar condiciones.">Aclaración</FieldLabel>
                <Inp value={ap.cupon.bajada} onChange={v => set('cupon', { ...ap.cupon, bajada: v })} maxLength={140} />
            </div>
            <div>
                <FieldLabel help="El código que tus clientes escriben al pagar. Tiene que existir en Cupones para que funcione de verdad.">Código</FieldLabel>
                <Inp value={ap.cupon.codigo} onChange={v => set('cupon', { ...ap.cupon, codigo: v })} maxLength={24} />
            </div>
        </SecCard>
    ) : null

    // Usada tal cual solo en Apariencia completa (ver el único lugar que la
    // usa, más abajo en el return) — editando una plantilla, las mismas
    // piezas de arriba se reparten entre pestañas en vez de venir juntas.
    const tarjetasSecundarias = (
        <>
            <div>{secVisibilidad}{secTextos}</div>
            {secEstadisticas}
            {secPie}
            {secCupon}
        </>
    )

    // Hero — comparte la misma SecCard en los dos modos (por eso el título
    // cambia según soloContenido): en Apariencia completa es también donde
    // vive la identidad de marca (logo/favicon/nombre), editando una
    // plantilla activa esos tres campos los define la plantilla y no se
    // muestran, así que la tarjeta queda con los sliders nomás.
    // Con un tope (Escaparate, heroMax=2): recortar a los primeros `heroMax`
    // ítems — sin esto, un negocio que ya tenía 3+ slides cargados de antes
    // (home clásico, u otra plantilla) los seguía viendo y pudiendo editar
    // acá aunque el home real nunca dibuje el sobrante (ver homes.tsx, bloque
    // 'escaparate': `p.slides.slice(0, 2)`) — confuso, y contradice el pedido
    // explícito de que esta plantilla "permita solamente agregar/editar dos
    // imágenes". Los datos de más no se borran (siguen ahí por si se vuelve
    // a un home sin tope), solo se dejan de listar mientras el tope aplica.
    const slidersVisibles = heroMax ? ap.sliders.slice(0, heroMax) : ap.sliders
    const heroCard = (
        <SecCard id="ap-sec-identidad" title={soloContenido ? 'Hero' : 'Identidad de marca'} icon={Palette} ayuda={AYUDA_SECCIONES[soloContenido ? 'hero' : 'identidad']}>
            {!soloContenido && (<>
                <FieldLabel help="Aparece en el header, emails y comprobantes">Logo de la tienda</FieldLabel>
                <ImgUploader value={ap.logo} onChange={v => set('logo', v)} onUpload={subirImagenApariencia} shape="circle" size={96} formats="PNG, JPG, SVG o HEIC · máx 10MB" onToast={onToast} />
                <Divider />
                <FieldLabel help="Ícono de la pestaña del navegador">Favicon</FieldLabel>
                <ImgUploader value={ap.favicon} onChange={v => set('favicon', v)} onUpload={subirImagenApariencia} shape="square" size={48} formats="ICO, PNG 32×32" onToast={onToast} />
                <Divider />
                <div><FieldLabel>Nombre de la tienda</FieldLabel><Inp value={ap.nombreTienda} onChange={v => set('nombreTienda', v)} /></div>
                <Divider />
            </>)}
            {/* Escaparate (heroPropio, sin rotación — ver heroNoRotativo más
                arriba) muestra sus dos imágenes como posiciones fijas
                (izquierda/derecha), nunca como un carrusel: el diseño de esa
                maqueta no contempla slides rotando, así que ni el título ni
                la ayuda pueden hablar de "sliders"/"carrusel" (pedido
                explícito, con capturas de la maqueta original). */}
            <FieldLabel
                ayuda={AYUDA_SECCIONES[heroNoRotativo ? 'slidersFijos' : 'sliders']}
                help={heroNoRotativo
                    ? 'Las dos imágenes del hero de esta plantilla. No rotan: quedan fijas, una a cada lado.'
                    : 'Carrusel de la página de inicio. Cada slide puede tener imagen, título y llamada a la acción.'}
            >
                {heroNoRotativo ? 'Imágenes del hero' : 'Sliders del hero'}
            </FieldLabel>
            {heroMax && !heroNoRotativo && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
                    Esta plantilla usa como máximo {heroMax} slide{heroMax === 1 ? '' : 's'} —
                    solo {heroMax === 1 ? 'el primero se ve' : `los primeros ${heroMax} se ven`} en el home.
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
                {slidersVisibles.map((s, i) => (
                    <SlideItem
                        key={s.id}
                        slide={s}
                        index={i}
                        defaultOpen={i === 0}
                        soloTexto={soloContenido}
                        etiqueta={heroNoRotativo ? 'Imagen' : 'Slide'}
                        onChange={updated => set('sliders', ap.sliders.map((sl, j) => j === i ? updated : sl))}
                        onRemove={() => set('sliders', ap.sliders.filter((_, j) => j !== i))}
                        // El orden ES la posición (izquierda/derecha en
                        // Escaparate, o el orden del carrusel en el resto) —
                        // mover es solo intercambiar con el vecino. Sin
                        // drag-and-drop (no hay ninguna librería de DnD en el
                        // proyecto todavía): dos flechas alcanzan y no suman
                        // una dependencia nueva para esto.
                        canMoveUp={i > 0}
                        canMoveDown={i < slidersVisibles.length - 1}
                        onMoveUp={() => set('sliders', moverElemento(ap.sliders, i, i - 1))}
                        onMoveDown={() => set('sliders', moverElemento(ap.sliders, i, i + 1))}
                        onToast={onToast}
                    />
                ))}
                {(!heroMax || slidersVisibles.length < heroMax) && (
                    <button
                        onClick={() => set('sliders', [...ap.sliders, { id: 's' + Date.now(), titulo: 'Nuevo slide', subtitulo: '', img: null, cta: 'Ver catálogo', ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', imageOverlay: 'tint', bgPattern: 'none', bgPatternScope: 'image', bgColor: '' }])}
                        className="ds-hover"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        <Plus size={14} strokeWidth={2} /> {heroNoRotativo ? 'Agregar imagen' : 'Agregar slide'}
                    </button>
                )}
            </div>
        </SecCard>
    )

    // Secciones propias de la plantilla activa. El formulario no está escrito
    // a mano: lo dibuja el esquema que declara cada plantilla (secciones.ts),
    // porque no hay dos que tengan las mismas secciones ni en el mismo orden.
    // Lo que se escribe acá se guarda en homeTemplateData.secciones y lo lee
    // el bloque de esa plantilla en homes.tsx (helper `txt()`), que cae al
    // texto de la maqueta cuando el campo está vacío.
    // Los campos arrancan con el contenido real con el que se diseñó la
    // sección (`porDefecto` en secciones.ts), no vacíos: así el dueño ve qué
    // está por cambiar, y para retocar una palabra no tiene que reescribir
    // toda la frase (pedido explícito, con capturas del editor de Premium en
    // blanco mientras la tienda mostraba texto). Vaciar un campo lo saca del
    // guardado y la portada vuelve a ese mismo texto — ver limpiarSecciones().
    // ...con UNA excepción: los campos marcados como `afirmacion` (un
    // descuento, un envío gratis, una cantidad — ver tipos.ts). Esos NO se
    // precargan: si vinieran con el ejemplo puesto, guardar sin tocarlos
    // alcanzaría para prometerle al comprador algo que el negocio nunca dijo.
    // El ejemplo se sigue viendo, pero como placeholder: se lee, no se guarda.
    const valorSeccion = (seccion: string, campo: CampoSeccion) => {
        const guardado = ap.seccionesPlantilla?.[seccion]?.[campo.id]
        if (guardado !== undefined) return guardado
        if (campo.afirmacion) return ''
        // La versión neutra cuando existe: el editor edita la TIENDA, no la
        // vitrina, así que tiene que mostrar el mismo texto que el cliente ve.
        return campo.porDefectoReal ?? campo.porDefecto ?? ''
    }
    const pistaSeccion = (campo: CampoSeccion) =>
        campo.afirmacion ? (campo.porDefecto ? `Ej: ${campo.porDefecto}` : '') : undefined
    const setSeccion = (seccion: string, campo: string, valor: string) => {
        const actual = ap.seccionesPlantilla ?? {}
        set('seccionesPlantilla', {
            ...actual,
            [seccion]: { ...(actual[seccion] ?? {}), [campo]: valor },
        })
    }

    // Las pestañas que esta plantilla en particular tiene algo que mostrar:
    // "Secciones" solo si declaró las suyas, "Contenido" solo si le queda
    // algún interruptor que de verdad mueva algo en su portada.
    const tabsVisibles = TABS_PLANTILLA.filter(([k]) => {
        if (k === 'secciones') return seccionesPlantilla.length > 0
        if (k === 'contenido') return usaAnuncio || usaStats
        return true
    })
    // Si la pestaña elegida no está entre las visibles (cambió la plantilla
    // activa, o esta no la tiene), se cae a la primera en vez de dejar el
    // formulario en blanco.
    const tabActiva: TabPlantilla = tabsVisibles.some(([k]) => k === tabPlantilla)
        ? tabPlantilla
        : (tabsVisibles[0]?.[0] ?? 'hero')

    const seccionesCards = seccionesPlantilla.map(sec => (
        <SecCard key={sec.id} id={`ap-sec-${sec.id}`} title={sec.nombre} icon={LayoutGrid}>
            {sec.nota && (
                <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>{sec.nota}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sec.campos.map(campo => campo.tipo === 'switch' ? (
                    // El interruptor trae su propio label (ToggleRow), así que
                    // no se le pone FieldLabel encima como al resto.
                    <div key={campo.id}>
                        <ToggleRow
                            label={campo.label}
                            on={valorSeccion(sec.id, campo) === 'si'}
                            onChange={v => setSeccion(sec.id, campo.id, v ? 'si' : '')}
                        />
                        {campo.help && (
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: -4, lineHeight: 1.45 }}>{campo.help}</div>
                        )}
                    </div>
                ) : (
                    <div key={campo.id}>
                        <FieldLabel help={campo.help}>{campo.label}</FieldLabel>
                        {campo.tipo === 'imagen' ? (
                            <ImgUploader
                                value={valorSeccion(sec.id, campo) || null}
                                onChange={v => setSeccion(sec.id, campo.id, v ?? '')}
                                onUpload={subirImagenApariencia}
                                shape="square"
                                size={80}
                                formats="JPG, PNG o HEIC · máx 10MB"
                                onToast={onToast}
                            />
                        ) : campo.tipo === 'parrafo' ? (
                            <textarea
                                value={valorSeccion(sec.id, campo)}
                                onChange={e => setSeccion(sec.id, campo.id, e.target.value)}
                                maxLength={campo.max}
                                placeholder={pistaSeccion(campo)}
                                rows={3}
                                style={{
                                    width: '100%', borderRadius: 8, border: '1px solid var(--color-border)',
                                    background: 'var(--color-bg)', color: 'var(--color-text)',
                                    padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit',
                                    lineHeight: 1.55, resize: 'vertical',
                                }}
                            />
                        ) : campo.tipo === 'seleccion' ? (
                            /* Elegir del catálogo real. Sin elegir nada la
                               sección no se dibuja en la portada — es a
                               propósito: antes se rellenaba sola con las
                               primeras categorías, que no significaba nada. */
                            <select
                                className="ds-field"
                                value={valorSeccion(sec.id, campo)}
                                onChange={e => setSeccion(sec.id, campo.id, e.target.value)}
                                style={{
                                    width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
                                    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                    color: 'var(--color-text)', fontSize: 14, fontFamily: 'inherit',
                                }}
                            >
                                <option value="">— Sin elegir —</option>
                                {categorias.length > 0 && (
                                    <optgroup label="Categorías">
                                        {categorias.map(c => <option key={c.id} value={`cat:${c.slug}`}>{c.name}</option>)}
                                    </optgroup>
                                )}
                                {productos.length > 0 && (
                                    <optgroup label="Productos">
                                        {productos.map(pr => <option key={pr.id} value={`prod:${pr.id}`}>{pr.name}</option>)}
                                    </optgroup>
                                )}
                            </select>
                        ) : (
                            <Inp value={valorSeccion(sec.id, campo)} onChange={v => setSeccion(sec.id, campo.id, v)} maxLength={campo.max} placeholder={pistaSeccion(campo)} />
                        )}
                    </div>
                ))}
            </div>
        </SecCard>
    ))

    // Header — solo tiene sentido editando la plantilla activa: en Apariencia
    // completa los enlaces ya se editan dentro de "Diseño y layout".
    //
    // Además de los tres enlaces fijos de siempre, ofrece las CATEGORÍAS
    // reales del negocio: varias plantillas (Vidriera entre ellas) dibujan la
    // fila de nav con categorías, no con secciones genéricas, y sin esto no
    // había forma de armarla. Se guardan en el mismo `headerLinks` de
    // siempre, con el id prefijado `cat:<slug>` — el storefront lo resuelve a
    // /catalogo?cat=slug (ver pathDeLink en StorefrontHeader).
    const headerCard = (
        <SecCard id="ap-sec-header" title="Header" icon={Menu} ayuda={AYUDA_SECCIONES.header}>
            {conIconoOpcional && (
                <>
                    <ToggleRow
                        label="Mostrar el ícono de tu logo"
                        on={ap.mostrarIconoLogo}
                        onChange={v => set('mostrarIconoLogo', v)}
                    />
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '4px 0 14px' }}>
                        Apagado (el diseño original de esta plantilla): el header muestra solo el
                        nombre de tu tienda, en texto. Encendido: se agrega el logo que subiste
                        acá arriba.
                    </p>
                    <Divider />
                </>
            )}
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
                Qué se muestra en la fila de navegación, debajo del logo. Con 4 o 5 entra cómodo;
                más que eso empieza a apretarse.
            </p>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 12px' }}>
                {itemsHeader.map((it, i) => (
                    <div key={it.id} style={{ borderBottom: i < itemsHeader.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <ToggleRow
                            label={it.esCategoria ? `${it.label} · categoría` : it.label}
                            on={it.on}
                            onChange={v => set('headerLinks', itemsHeader.map(x => ({
                                id: x.id, label: x.label, on: x.id === it.id ? v : x.on,
                            })))}
                        />
                    </div>
                ))}
            </div>
        </SecCard>
    )

    async function volverAApariencia() {
        setModalVolver(false)
        setVolviendo(true)
        try {
            await panelSetHomeTemplate(null)
            setHomeTemplateLocal(null)
            onToast('Volviste a la apariencia clásica')
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo desactivar la plantilla')
        } finally {
            setVolviendo(false)
        }
    }

    if (cargando) {
        return <AparienciaSkeleton />
    }

    if (homeTemplate && !soloContenido) {
        return (
            <div style={pageWrap}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>Apariencia pública</h1>
                <Card style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                            <LayoutTemplate size={19} strokeWidth={1.8} color="var(--color-primary)" />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                            Estás usando la plantilla {NOMBRE_PLANTILLA[homeTemplate] ?? homeTemplate}
                        </div>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 16 }}>
                        Mientras la plantilla esté activa, el home de tu tienda lo dibuja ella — esta pantalla
                        queda bloqueada para no editar algo que no se va a ver. El anuncio, el hero y la barra de
                        confianza se editan desde <strong>Avanzado → Plantillas</strong>, ahí mismo donde la activaste.
                    </div>
                    <div>
                        <Button variant="secondary" loading={volviendo} onClick={() => setModalVolver(true)}>
                            Volver a la apariencia clásica
                        </Button>
                    </div>
                </Card>

                <Modal
                    isOpen={modalVolver}
                    onClose={() => setModalVolver(false)}
                    title="¿Volver a la apariencia clásica?"
                    footer={<>
                        <Button variant="secondary" onClick={() => setModalVolver(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={volverAApariencia}>Sí, volver</Button>
                    </>}
                >
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                        Tu tienda deja de usar la plantilla {NOMBRE_PLANTILLA[homeTemplate] ?? homeTemplate} y vuelve al
                        home de siempre. Podés volver a activarla cuando quieras desde Avanzado → Plantillas — no se
                        pierde nada de lo que cargaste ahí.
                    </div>
                </Modal>
            </div>
        )
    }

    return (
        // Editando una plantilla (soloContenido) es un FORMULARIO de una sola
        // columna con tabs — no un editor con vista previa al lado — así que
        // usa el ancho angosto de "panel-page--form" (880px, ver globals.css),
        // no los 1760px de "panel-page--editor" que dejaban el formulario
        // apretado contra el borde izquierdo con medio kilómetro de aire a la
        // derecha (bug real, reportado: "se ve feo, requiere mucho scroll").
        <div className={`ap-page panel-page ${soloContenido ? 'panel-page--form' : 'panel-page--editor'}`}>
            {/* Header — en modo soloContenido, PlantillasConfig ya puso su
                propio título arriba; acá solo hace falta el estado de
                guardado + el botón, no duplicar el encabezado grande. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: soloContenido ? 'flex-end' : 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: soloContenido ? 16 : 24 }}>
                {!soloContenido && (
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Apariencia pública</h1>
                        <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Construí la identidad visual de tu tienda. Los cambios se ven en vivo.</div>
                        {errorCarga && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errorCarga} — se muestran valores por defecto.</div>}
                        {/* La vista previa de acá abajo es la tienda real embebida
                            (ver StorePreview.tsx) — con poco catálogo las
                            secciones que muestran productos/categorías (grillas,
                            destacados) se ven vacías o repetidas y el dueño no
                            puede juzgar cómo le queda el diseño. El umbral
                            (CATALOGO_PREVIEW_MIN) no es "cero": un par de
                            productos sueltos tampoco alcanza para una vista
                            previa representativa. Se avisa una sola vez, no en
                            cada carga: molesta menos que repetirlo siempre que
                            entra acá antes de completar su catálogo. */}
                        {!cargando && !avisoCatalogoCerrado && (categorias.length < CATALOGO_PREVIEW_MIN.categorias || productos.length < CATALOGO_PREVIEW_MIN.productos) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12.5, color: 'var(--color-body)' }}>
                                <span style={{ flex: 1 }}>
                                    Para ver cómo queda tu diseño de verdad, cargá al menos {CATALOGO_PREVIEW_MIN.productos} productos y {CATALOGO_PREVIEW_MIN.categorias} categorías antes de personalizarlo — con poco catálogo, la vista previa no refleja cómo se va a ver.
                                </span>
                                <button
                                    className="ds-link"
                                    onClick={() => {
                                        const negocioId = currentSlug() ?? 'rama-tienda'
                                        void router.push(adminPath(negocioId, 'ventas', 'catalogo'))
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}
                                >
                                    Ir a Productos →
                                </button>
                                <button
                                    onClick={() => setAvisoCatalogoCerrado(true)}
                                    title="Cerrar aviso"
                                    style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {/* flexWrap acá: en mobile la fila (badge + 2 botones) no
                    entra en una línea — antes se cortaba contra el borde de
                    la pantalla en vez de bajar de línea. */}
                <div className="ap-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: dirty ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', color: dirty ? 'var(--color-warning)' : 'var(--color-success)', border: '1px solid var(--color-border)' }}>
                        {dirty
                            ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />
                            : <Check size={12} strokeWidth={3} />}
                        {dirty ? 'Cambios sin guardar' : 'Publicado'}
                    </span>
                    {!soloContenido && <Button variant="outline" icon={<ExternalLink size={15} />} onClick={() => setFullPreview(true)}>Ver vista previa de diseño</Button>}
                    {/* En mobile se saca — la barra flotante de "Tenés cambios
                        sin guardar" de más abajo ya cubre el guardado sin
                        tener que volver arriba, este quedaba de más y era
                        parte de lo que desbordaba la fila. */}
                    <span className="ap-save-header">
                        <Button variant="primary" disabled={!dirty} loading={guardando} onClick={guardar}>Guardar cambios</Button>
                    </span>
                    {errorGuardado && <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{errorGuardado}</div>}
                </div>
            </div>

            <style>{`
                .ap-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 28px; align-items: start; }
                .ap-preview { position: sticky; top: 24px; }
                @media (max-width: 1100px) {
                    .ap-split { grid-template-columns: minmax(0,1fr); }
                    .ap-preview { position: static; }
                    .ap-preview > div { height: 70vh !important; }
                }
                /* Editando la plantilla activa (soloContenido) no usa
                   .ap-split — es un formulario de una sola columna con
                   pestañas (ver TABS_PLANTILLA), sin vista previa al lado. */
                .ap-tabs-plantilla { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--color-border); overflow-x: auto; }
                .ap-tab-plantilla { padding: 12px 4px; min-height: 44px; margin-right: 20px; border: none; background: transparent; cursor: pointer; font-family: inherit; font-size: 13.5px; margin-bottom: -1px; white-space: nowrap; border-bottom: 2px solid transparent; transition: color 150ms, border-color 150ms; }
                /* Mobile: la vista previa en vivo no entra al lado (ni
                   siquiera apilada, a 70vh, deja lugar para el editor) — se
                   saca del todo. Sigue disponible con el botón "Vista
                   previa" de arriba (abre el modal a pantalla completa,
                   fullPreview), no se pierde la función, solo el inline. */
                @media (max-width: 768px) {
                    .ap-page { padding: 16px 14px 96px !important; }
                    .ap-preview { display: none !important; }
                    .ap-split { gap: 16px; }
                    .ap-save-header { display: none !important; }
                    .ap-sec-card { padding: 16px !important; }
                    /* El valor de la estadistica son 2-3 caracteres ("+500"):
                       100px de ancho fijo le robaban lugar a la etiqueta. */
                    .ap-stat-val { width: 76px !important; }
                }
                /* "¿Qué ven tus clientes?": 2 columnas le queda bien a la
                   preview de escritorio, pero en mobile deja ~120px por
                   columna — labels como "Redes sociales en el footer" no
                   entran ahí sin romperse. A 1 columna. */
                @media (max-width: 640px) {
                    .ap-toggle-grid { grid-template-columns: minmax(0,1fr) !important; }
                }
                @keyframes apStickyBarIn {
                    from { opacity: 0; transform: translate(-50%, 10px); }
                    to   { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
            {soloContenido ? (
                // Editando una plantilla activa: un formulario de una sola
                // columna con pestañas — antes esto era la mitad izquierda
                // de una grilla de dos columnas desparejas (ver el porqué del
                // cambio en el comentario de TABS_PLANTILLA, arriba).
                <div>
                    <div className="ap-tabs-plantilla" role="tablist" aria-label="Secciones de la plantilla">
                        {tabsVisibles.map(([k, l]) => {
                            const a = tabActiva === k
                            return (
                                <button
                                    key={k}
                                    className="ap-tab-plantilla"
                                    onClick={() => setTabPlantilla(k)}
                                    role="tab"
                                    aria-selected={a}
                                    style={{
                                        color: a ? 'var(--color-primary)' : 'var(--color-muted)',
                                        fontWeight: a ? 600 : 500,
                                        borderBottomColor: a ? 'var(--color-primary)' : 'transparent',
                                    }}
                                >
                                    {l}
                                </button>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {tabActiva === 'hero' && heroCard}
                        {tabActiva === 'header' && headerCard}
                        {tabActiva === 'secciones' && seccionesCards}
                        {tabActiva === 'contenido' && <>
                            {toggles.length > 0 && secVisibilidad}
                            {usaAnuncio && secTextos}
                            {usaStats && secEstadisticas}
                        </>}
                        {tabActiva === 'pie' && <>{secPie}{secCupon}</>}
                    </div>
                </div>
            ) : (
            <div className="ap-split">
                {/* Controles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {heroCard}

                    <SecCard id="ap-sec-paleta" title="Paleta de colores" icon={Droplets} ayuda={AYUDA_SECCIONES.paleta}>
                        <FieldLabel>Modo de color de la tienda</FieldLabel>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                            {([['claro', 'Claro', Sun], ['oscuro', 'Oscuro', Moon], ['sistema', 'Sistema', Monitor]] as [ModoColor, string, IconT][]).map(([id, l, I]) => {
                                const a = ap.modoColor === id
                                return (
                                    <button key={id} onClick={() => set('modoColor', id)} className="ds-hover" style={{ padding: '14px 8px', borderRadius: 10, border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                        <I size={18} strokeWidth={1.6} style={{ color: a ? 'var(--color-primary)' : 'var(--color-muted)' }} />
                                        <span style={{ fontSize: 12, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)' }}>{l}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <ColorBlock label="Color primario" help="Botones, links y elementos de acción" value={ap.colorPrimario} onChange={v => set('colorPrimario', v)} />
                        <ColorBlock label="Color secundario" help="Textos y fondos oscuros" value={ap.colorSecundario} onChange={v => set('colorSecundario', v)} />
                        <ColorBlock label="Color de acento" help="Badges y highlights" value={ap.colorAccent} onChange={v => set('colorAccent', v)} />
                        <FondoTiendaBlock value={ap.colorFondo} colorPrimario={ap.colorPrimario} onChange={v => set('colorFondo', v)} />
                    </SecCard>

                    <SecCard id="ap-sec-tipografia" title="Tipografía" icon={Type} ayuda={AYUDA_SECCIONES.tipografia}>
                        <FieldLabel>Fuente para títulos</FieldLabel>
                        <FontSelect value={ap.fuenteHeading} onChange={v => set('fuenteHeading', v)} opts={fontOpts} />
                        <div style={{ marginTop: 12, marginBottom: 18, padding: '14px 16px', background: 'var(--color-surface-alt)', borderRadius: 8, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', fontFamily: fontStack(ap.fuenteHeading) }}>{ap.nombreTienda}</div>
                        <FieldLabel>Fuente para textos</FieldLabel>
                        <FontSelect value={ap.fuenteBody} onChange={v => set('fuenteBody', v)} opts={fontOpts} />
                        <Divider />
                        <FieldLabel>Escala de texto</FieldLabel>
                        <div style={{ display: 'flex', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3 }}>
                            {([['sm', 'Pequeño'], ['md', 'Mediano'], ['lg', 'Grande']] as [EscalaFuente, string][]).map(([id, l]) => {
                                const a = ap.escalaFuente === id
                                return <button key={id} onClick={() => set('escalaFuente', id)} className="ds-hover" style={{ flex: 1, height: 34, borderRadius: 5, border: 'none', background: a ? 'var(--color-bg)' : 'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: a ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{l}</button>
                            })}
                        </div>
                    </SecCard>

                    {/* "Estilo de header" y "Grilla de productos" se guardaban desde
                        siempre pero hasta acá ninguna página de la tienda real los
                        leía (reportado, con captura: elegir cualquier opción no
                        cambiaba nada) — ver StorefrontChrome.tsx (headerLayout) y
                        Catalogo.tsx/Categoria.tsx (gridLayout, vía
                        lib/storefront/utils.ts). "Radio de cards" se sacó del todo
                        (mismo reporte): no tenía ningún efecto real, y no valía la
                        pena construírselo — ver el comentario en apariencia.mapper.ts. */}
                    <SecCard id="ap-sec-layout" title="Diseño y layout" icon={LayoutGrid} ayuda={AYUDA_SECCIONES.layout}>
                        <FieldLabel>Estilo de header</FieldLabel>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, marginTop: -4 }}>Define qué elementos y navegación muestra el encabezado de tu tienda.</div>
                        <div style={{ marginBottom: 18 }}>
                            <VisualPick value={ap.layoutHeader} onChange={v => set('layoutHeader', v as LayoutHeader)} options={[
                                {
                                    id: 'full', label: 'Completo',
                                    svg: hline(<g>
                                        <rect x="4" y="13" width="6" height="8" rx="1.5" fill="var(--color-primary)" />
                                        <rect x="13" y="15" width="8" height="4" rx="1.5" fill="var(--color-muted)" />
                                        <rect x="23" y="15" width="7" height="4" rx="1.5" fill="var(--color-muted)" />
                                        <rect x="32" y="15" width="7" height="4" rx="1.5" fill="var(--color-muted)" />
                                        <circle cx="48" cy="17" r="3.5" fill="var(--color-border)" />
                                        <circle cx="55" cy="17" r="3.5" fill="var(--color-border)" />
                                    </g>),
                                },
                                {
                                    id: 'standard', label: 'Estándar',
                                    svg: hline(<g>
                                        <rect x="4" y="13" width="8" height="8" rx="1.5" fill="var(--color-primary)" />
                                        <rect x="16" y="15" width="14" height="4" rx="1.5" fill="var(--color-muted)" />
                                        <circle cx="46" cy="17" r="3.5" fill="var(--color-border)" />
                                        <circle cx="54" cy="17" r="3.5" fill="var(--color-border)" />
                                    </g>),
                                },
                                {
                                    id: 'centered', label: 'Centrado',
                                    svg: hline(<g>
                                        <rect x="22" y="7" width="16" height="7" rx="1.5" fill="var(--color-primary)" />
                                        <rect x="10" y="20" width="12" height="4" rx="1.5" fill="var(--color-muted)" />
                                        <rect x="25" y="20" width="10" height="4" rx="1.5" fill="var(--color-muted)" />
                                        <rect x="38" y="20" width="12" height="4" rx="1.5" fill="var(--color-muted)" />
                                    </g>),
                                },
                                {
                                    id: 'minimal', label: 'Minimal',
                                    svg: hline(<g>
                                        <rect x="4" y="13" width="8" height="8" rx="1.5" fill="var(--color-primary)" />
                                        <rect x="46" y="13" width="10" height="8" rx="1.5" fill="var(--color-border)" />
                                    </g>),
                                },
                            ]} />
                        </div>
                        <FieldLabel help="Elegí qué enlaces de navegación se muestran en el header. En el estilo Minimal no se muestra navegación.">Elementos del header</FieldLabel>
                        <div style={{ marginBottom: 18, border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 12px' }}>
                            {ap.headerLinks.map((lnk, i) => (
                                <div key={lnk.id} style={{ borderBottom: i < ap.headerLinks.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <ToggleRow
                                        label={lnk.label}
                                        on={lnk.on}
                                        onChange={v => set('headerLinks', ap.headerLinks.map((x, j) => j === i ? { ...x, on: v } : x))}
                                    />
                                </div>
                            ))}
                        </div>
                        <FieldLabel>Grilla de productos</FieldLabel>
                        <div style={{ marginBottom: 18 }}>
                            <VisualPick value={ap.layoutGrid} onChange={v => set('layoutGrid', v as LayoutGridT)} options={[
                                { id: '3col', label: '3 columnas', svg: hline(<g>{[8, 26, 44].map(x => <rect key={x} x={x} y="10" width="14" height="14" rx="2" fill="var(--color-border)" />)}</g>) },
                                { id: '4col', label: '4 columnas', svg: hline(<g>{[6, 20, 34, 48].map(x => <rect key={x} x={x} y="10" width="10" height="14" rx="2" fill="var(--color-border)" />)}</g>) },
                                { id: 'list', label: 'Lista', svg: hline(<g>{[8, 18, 28].map(y => <rect key={y} x="8" y={y} width="44" height="6" rx="1.5" fill="var(--color-border)" />)}</g>) },
                            ]} />
                        </div>

                        {/* Estilo de la sección "Comprá por categoría" del home
                            (ver SeccionCategorias en Inicio.tsx). Mosaico y
                            Tarjetas se ofrecen deshabilitados mientras ninguna
                            categoría tenga foto: son estilos que SON la foto —
                            a diferencia de los otros cuatro, acá la imagen NO
                            es opcional, no hay color de relleno para las que
                            no tengan (ver resolverCategorias() en Inicio.tsx). */}
                        <FieldLabel help="Cómo se ve la fila de categorías en el home. El interruptor para mostrarla o no está en “¿Qué ven tus clientes?”.">Estilo de las categorías</FieldLabel>
                        {!hayFotosDeCategoria && (
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, marginTop: -4 }}>
                                Mosaico y Tarjetas necesitan que la categoría tenga foto — sin eso no se pueden armar (no hay un color de relleno para reemplazarla). Cargá una en Catálogo → Categorías para desbloquearlos.
                            </div>
                        )}
                        <div style={{ marginBottom: 18 }}>
                            <VisualPick
                                value={ap.estiloCategorias}
                                onChange={v => set('estiloCategorias', v as CategoryLayoutT)}
                                options={CATEGORY_LAYOUTS.map(op => ({
                                    id: op.id,
                                    label: op.label,
                                    ayuda: op.desc,
                                    disabled: op.necesitaFoto && !hayFotosDeCategoria,
                                    motivo: 'Necesita una categoría con foto cargada',
                                    svg: MINIATURA_CATEGORIA[op.id],
                                }))}
                            />
                        </div>

                        {/* Selector de categorías — solo índice/mosaico/tarjetas
                            lo tienen: son los tres estilos donde mostrar TODAS
                            las categorías puede no quedar bien (mosaico/tarjetas
                            por el tope de 5/4; índice porque una lista muy larga
                            deja de ser un "índice" prolijo). Pastillas/etiquetas/
                            círculos siempre muestran todas, sin selector. */}
                        {(ap.estiloCategorias === 'indice' || ap.estiloCategorias === 'mosaico' || ap.estiloCategorias === 'tarjetas') && (
                            <SelectorCategorias
                                candidatas={ap.estiloCategorias === 'indice' ? categorias : categorias.filter(c => !!c.imageUrl)}
                                seleccionadas={ap.categoriasIds}
                                tope={CATEGORY_LAYOUT_MAX[ap.estiloCategorias]}
                                necesitaFoto={ap.estiloCategorias !== 'indice'}
                                onChange={ids => set('categoriasIds', ids)}
                            />
                        )}
                    </SecCard>

                    {/* Banner con imagen de fondo fija (efecto parallax) en medio
                        del home clásico — pedido explícito del dueño, con una
                        tienda de referencia. Autocontenida (imagen + textos +
                        su propio on/off) en vez de repartir el toggle en
                        "¿Qué ven tus clientes?" y el contenido acá: mismo
                        criterio que el Hero, es un bloque rico que no tiene
                        sentido a medias. No aplica con una plantilla de Home
                        activa (por eso vive acá, no en `tarjetasSecundarias`):
                        mismo motivo que Paleta/Tipografía/Diseño, la portada
                        de la plantilla es asunto suyo. */}
                    <SecCard id="ap-sec-parallax" title="Banner con efecto parallax" icon={ImageIcon} ayuda={AYUDA_SECCIONES.parallax}>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                            Una imagen grande a todo el ancho, en medio del home, que queda fija mientras el resto de la
                            página se desplaza. Necesita una imagen cargada para mostrarse.
                        </p>
                        <div style={{ marginBottom: 14 }}>
                            <ToggleRow label="Mostrar este banner en el home" on={ap.mostrarParallax} onChange={v => set('mostrarParallax', v)} />
                        </div>
                        <Divider />
                        <FieldLabel help="Foto ancha y de buena resolución — se recomienda al menos 1600×900px.">Imagen de fondo</FieldLabel>
                        <ImgUploader value={ap.parallaxImagen} onChange={v => set('parallaxImagen', v)} onUpload={subirImagenApariencia} shape="square" size={80} formats="JPG, PNG o HEIC · máx 10MB" onToast={onToast} />
                        <Divider />
                        <div style={{ marginBottom: 10 }}><FieldLabel>Título</FieldLabel><Inp value={ap.parallaxTitulo} onChange={v => set('parallaxTitulo', v)} /></div>
                        <div style={{ marginBottom: 10 }}><FieldLabel>Subtítulo</FieldLabel><Inp value={ap.parallaxSubtitulo} onChange={v => set('parallaxSubtitulo', v)} /></div>
                        <div style={{ marginBottom: 10 }}><FieldLabel>Texto del botón</FieldLabel><Inp value={ap.parallaxCtaTexto} onChange={v => set('parallaxCtaTexto', v)} maxLength={30} /></div>
                        <div>
                            <FieldLabel help="A dónde lleva al hacer click. Ej: /catalogo, /catalogo/camperas, o una URL completa">Link del botón</FieldLabel>
                            <Inp value={ap.parallaxCtaLink} onChange={v => set('parallaxCtaLink', v)} />
                        </div>
                    </SecCard>

                    {/* Tira de marcas con las que trabaja el negocio — pedido
                        explícito del dueño, con una tienda de referencia (una
                        relojería: EUROTIME / QYQ / G-SHOCK / CASIO en gris,
                        y la de abajo del mouse a color). Va acá y no en
                        `tarjetasSecundarias` por el mismo motivo que el
                        parallax: es una sección del home CLÁSICO, y con una
                        plantilla activa la portada es asunto de la plantilla.
                        El logo es opcional a propósito (ver LogoPicker y
                        brand-item.dto.ts): sin logo, la tira dibuja el nombre
                        en tipografía, que es justo como se ve la referencia. */}
                    <SecCard id="ap-sec-marcas" title="Marcas con las que trabajás" icon={BadgeCheck} ayuda={AYUDA_SECCIONES.marcas}>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                            Una tira que se desliza sola en el home, con las marcas que vendés. Se ven en gris y toman
                            color cuando el visitante les pasa el mouse por encima. Necesita al menos una marca cargada
                            para mostrarse.
                        </p>
                        <div style={{ marginBottom: 14 }}>
                            <ToggleRow label="Mostrar esta sección en el home" on={ap.mostrarMarcas} onChange={v => set('mostrarMarcas', v)} />
                        </div>
                        <Divider />
                        <FieldLabel help="El texto chiquito que va arriba de los logos.">Título de la sección</FieldLabel>
                        <Inp value={ap.marcasTitulo} onChange={v => set('marcasTitulo', v)} maxLength={80} placeholder="Trabajamos con las mejores marcas" />
                        <Divider />
                        <FieldLabel help="El logo es opcional: sin logo se muestra el nombre escrito. El nombre siempre hace falta — es lo que leen los lectores de pantalla.">
                            Marcas
                        </FieldLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                            {ap.marcas.map((m, i) => (
                                <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <LogoPicker
                                        value={m.logo}
                                        nombre={m.name}
                                        onChange={v => set('marcas', ap.marcas.map((x, j) => j === i ? { ...x, logo: v } : x))}
                                        onUpload={subirImagenApariencia}
                                        onToast={onToast}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Inp
                                            value={m.name}
                                            onChange={v => set('marcas', ap.marcas.map((x, j) => j === i ? { ...x, name: v } : x))}
                                            maxLength={60}
                                            placeholder="Nombre de la marca"
                                        />
                                    </div>
                                    <button
                                        onClick={() => set('marcas', ap.marcas.filter((_, j) => j !== i))}
                                        title="Quitar"
                                        aria-label={`Quitar ${m.name.trim() || 'esta marca'}`}
                                        style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'color 150ms, background 150ms' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {/* Mismo tope que el DTO del backend (ArrayMaxSize(20)):
                            si acá se pudieran cargar más, el guardado fallaría
                            entero con un error de validación poco claro. */}
                        {ap.marcas.length < 20 && (
                            <button
                                onClick={() => set('marcas', [...ap.marcas, { id: 'mk' + Date.now(), name: '', logo: null }])}
                                className="ds-hover"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                            >
                                <Plus size={14} strokeWidth={2} /> Agregar marca
                            </button>
                        )}
                    </SecCard>

                    {/* Video en el home — pedido explícito del dueño: "después
                        del efecto parallax, antes del pie". Un LINK, no una
                        subida: Órbita no aloja video propio (ver
                        parseVideoEmbed, lib/storefront/utils.ts, para el
                        porqué y qué formas de link acepta). Mismo criterio
                        autocontenido que parallax/marcas: on/off propio, y
                        vive acá (no en `tarjetasSecundarias`) porque es del
                        home CLÁSICO — con una plantilla activa, la portada es
                        asunto de la plantilla. */}
                    <SecCard id="ap-sec-video" title="Video en tu tienda" icon={Video} ayuda={AYUDA_SECCIONES.video}>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                            Uno o varios videos en el home, después del banner parallax. Cada uno puede ser un link de
                            YouTube o de Vimeo, o un archivo de video que subas. Necesita al menos un video válido para mostrarse.
                        </p>
                        <div style={{ marginBottom: 14 }}>
                            <ToggleRow label="Mostrar esta sección en el home" on={ap.mostrarVideo} onChange={v => set('mostrarVideo', v)} />
                        </div>
                        <Divider />
                        <div style={{ marginBottom: 10 }}><FieldLabel help="Va arriba de los videos. Opcional.">Título de la sección</FieldLabel><Inp value={ap.videoTitulo} onChange={v => set('videoTitulo', v)} maxLength={120} placeholder="Mirá cómo funciona" /></div>
                        <div><FieldLabel>Bajada</FieldLabel><Inp value={ap.videoSubtitulo} onChange={v => set('videoSubtitulo', v)} maxLength={300} /></div>
                        <Divider />
                        <FieldLabel help="Cómo se acomodan los videos en el home.">Diseño</FieldLabel>
                        <div style={{ marginBottom: 4 }}>
                            <VisualPick
                                value={ap.videoLayout}
                                onChange={v => set('videoLayout', v as VideoLayout)}
                                options={VIDEO_LAYOUTS.map(op => ({ id: op.id, label: op.label, ayuda: op.desc, svg: MINIATURA_VIDEO[op.id] }))}
                            />
                        </div>
                        <Divider />
                        <EditorVideos videos={ap.videos} layout={ap.videoLayout} onChange={v => set('videos', v)} onToast={onToast} />
                    </SecCard>

                    {/* Banner de WhatsApp — antes un solo diseño fijo (pedido
                        explícito: variedad). El toggle sigue siendo
                        "WhatsApp flotante" de "¿Qué ven tus clientes?"; acá
                        solo se elige CÓMO se ve, por eso el picker se apaga
                        (no se oculta) cuando ese interruptor está apagado. */}
                    <SecCard id="ap-sec-whatsapp" title="Banner de WhatsApp" icon={MessageCircle} ayuda={AYUDA_SECCIONES.whatsapp}>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px' }}>
                            La invitación a escribir por WhatsApp, justo antes del pie. Se muestra con &quot;WhatsApp
                            flotante&quot; prendido (en &quot;¿Qué ven tus clientes?&quot;) y un número real cargado en
                            Configuración → Contacto.
                        </p>
                        <div style={{ opacity: ap.mostrarWhatsapp ? 1 : 0.5, pointerEvents: ap.mostrarWhatsapp ? 'auto' : 'none' }}>
                            <FieldLabel help="Cómo se ve la invitación a escribir por WhatsApp.">Diseño</FieldLabel>
                            <VisualPick
                                value={ap.estiloWhatsapp}
                                onChange={v => set('estiloWhatsapp', v as WhatsappLayout)}
                                options={WHATSAPP_LAYOUTS.map(op => ({ id: op.id, label: op.label, ayuda: op.desc, svg: MINIATURA_WHATSAPP[op.id] }))}
                            />
                        </div>
                    </SecCard>

                    {tarjetasSecundarias}

                </div>

                <div className="ap-preview">
                    <StorePreview ap={ap} publicado={dirty ? publicado : null} subdomain={subdomain} />
                </div>
            </div>
            )}

            {/* Vista previa completa */}
            {fullPreview && !soloContenido && (
                <div onClick={() => setFullPreview(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.70)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: '60px 40px 40px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><ExternalLink size={16} strokeWidth={1.6} /> Vista previa{subdomain ? ` · ${subdomain}.${ROOT_DOMAIN}` : ''}</span>
                            <button onClick={() => setFullPreview(false)} className="ds-hover" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 12, background: 'var(--color-bg)' }}><StorePreview ap={ap} publicado={dirty ? publicado : null} subdomain={subdomain} full /></div>
                    </div>
                </div>
            )}

            {/* Barra flotante de guardado — el botón de arriba queda fuera de
                vista al bajar el scroll (la página es larga), así que con
                cambios sin guardar aparece esto acá abajo para no obligar a
                subir todo de nuevo. Sutil a propósito: solo aparece si hay
                algo sin guardar, no compite con el resto de la UI. */}
            {dirty && !fullPreview && (
                <div style={{
                    position: 'fixed', left: '50%', bottom: 20, zIndex: 80,
                    transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 999, padding: '8px 8px 8px 18px',
                    boxShadow: '0 10px 30px rgba(15,23,42,0.16)',
                    animation: 'apStickyBarIn 220ms ease',
                }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                        Tenés cambios sin guardar
                    </span>
                    {errorGuardado && (
                        <span style={{ fontSize: 12, color: 'var(--color-error)', whiteSpace: 'nowrap' }}>{errorGuardado}</span>
                    )}
                    {publicado && <Button variant="ghost" disabled={guardando} onClick={descartar}>Descartar</Button>}
                    <Button variant="primary" loading={guardando} onClick={guardar}>Guardar cambios</Button>
                </div>
            )}
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SecCard({ id, title, icon: I, badge, ayuda, children }: { id?: string; title: string; icon: IconT; badge?: ReactNode; ayuda?: Ayuda; children: ReactNode }) {
    // La explicación de la sección, cerrada por default: el ícono de
    // exclamación al lado del título la abre (ver AyudaSeccion.tsx).
    const [ayudaAbierta, setAyudaAbierta] = useState(false)
    const panelAyudaId = useId()
    return (
        // `id` + `scrollMarginTop`: ancla para el índice de secciones del
        // ConfigSidebar (ver GRUPOS_APARIENCIA ahí) — sin el margen, el
        // scroll-into-view deja el título de la tarjeta pegado contra el
        // borde de arriba de la ventana.
        <div id={id} className="ap-sec-card" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><I size={16} strokeWidth={1.6} /></div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: 0, flex: 1 }}>{title}</h3>
                {ayuda && <AyudaBoton nombre={title} abierta={ayudaAbierta} onToggle={() => setAyudaAbierta(a => !a)} panelId={panelAyudaId} />}
                {badge}
            </div>
            {ayuda && <AyudaPanel ayuda={ayuda} id={panelAyudaId} abierta={ayudaAbierta} style={{ marginBottom: 18 }} />}
            {children}
        </div>
    )
}

// El rótulo de un campo. `help` es la línea de siempre, corta y siempre a la
// vista; `ayuda` es el ícono de exclamación con la explicación larga, para los
// campos que son una sección entera aunque no tengan su propia tarjeta (los
// sliders del hero, sin ir más lejos: es el bloque más grande de la pantalla
// y vive adentro de "Identidad de marca").
function FieldLabel({ children, help, ayuda }: { children: ReactNode; help?: string; ayuda?: Ayuda }) {
    const [ayudaAbierta, setAyudaAbierta] = useState(false)
    const panelAyudaId = useId()
    // Sin `ayuda` queda EXACTAMENTE como estaba: un div y nada más. Son
    // decenas de rótulos en esta pantalla, no tiene sentido envolverlos a
    // todos en un flex por un ícono que no está.
    if (!ayuda) {
        return (
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>{children}</div>
                {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
            </div>
        )
    }
    return (
        <div style={{ marginBottom: 8 }}>
            {/* -6px a la izquierda: el ícono tiene su propio relleno de 30px
                (40 en mobile), así que sin esto el texto del rótulo queda
                despegado del margen de la tarjeta respecto de los demás. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: -6 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>{children}</div>
                <AyudaBoton nombre={typeof children === 'string' ? children : 'esta sección'} abierta={ayudaAbierta} onToggle={() => setAyudaAbierta(a => !a)} panelId={panelAyudaId} />
            </div>
            {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
            <AyudaPanel ayuda={ayuda} id={panelAyudaId} abierta={ayudaAbierta} style={{ marginTop: 8 }} />
        </div>
    )
}

function Divider() {
    return <div style={{ height: 1, background: 'var(--color-border)', margin: '18px 0' }} />
}

function Inp({ value, onChange, maxLength, suffix, mono, prefix, placeholder }: { value: string; onChange: (v: string) => void; maxLength?: number; suffix?: ReactNode; mono?: boolean; prefix?: ReactNode; placeholder?: string }) {
    return (
        <div className="ds-field" style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', gap: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            {prefix}
            <input value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit', minWidth: 0 }} />
            {suffix}
        </div>
    )
}

// Swatch de los pickers "Personalizado" de acá abajo — un <input
// type="color"> real, no un <span> decorativo: pedido explícito, "no tiene
// que ingresar hexadecimal, es más fácil que con una paleta de colores
// elija". El navegador ya trae su propio selector visual (paleta/rueda de
// color del sistema) con solo hacerle click — no hay que armar uno de
// cero. El campo de hex de al lado (<Inp>) se mantiene: sigue sirviendo
// para pegar un color de marca exacto, que un picker visual no siempre
// permite escribir a mano con precisión.
function ColorSwatchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="color"
            title="Elegir de la paleta"
            value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000'}
            onChange={e => onChange(e.target.value.toUpperCase())}
            style={{ width: 20, height: 20, flexShrink: 0 }}
        />
    )
}

function ColorBlock({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (v: string) => void }) {
    const [custom, setCustom] = useState(!PRESET_COLORS.includes(value))
    return (
        <div style={{ marginBottom: 20 }}>
            <FieldLabel help={help}>{label}</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => { onChange(c); setCustom(false) }} className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: c, border: 'none', outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer' }} />
                ))}
                <button onClick={() => setCustom(true)} title="Personalizado" className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${custom ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={14} strokeWidth={2} /></button>
            </div>
            {custom && (
                <div style={{ marginBottom: 10, maxWidth: 200 }}>
                    <Inp value={value} onChange={v => { if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v) }} mono prefix={<ColorSwatchInput value={value} onChange={onChange} />} />
                </div>
            )}
            <button style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: value, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Botón de ejemplo</button>
        </div>
    )
}

// Fondo de tienda — 3 presets fijos, sin "Personalizado". Hubo una vuelta
// (bug real, reportado: guardaba literalmente el string 'custom' en vez de
// un color, ver historial) donde se le sumó un picker de color libre igual
// al de ColorBlock/SlideBgColorPicker — pedido explícito después de verlo:
// sacarlo del todo. El fondo de página se queda acotado a estas 3 opciones
// a propósito (a diferencia de primario/secundario/acento, que sí son
// libres): son las únicas que se sabe de antemano que no rompen contraste
// con el resto de la paleta.
function FondoTiendaBlock({ value, colorPrimario, onChange }: { value: string; colorPrimario: string; onChange: (v: string) => void }) {
    const presets: [string, string][] = [['#FFFFFF', 'Blanco puro'], ['#F8FAFC', 'Gris suave'], [colorPrimario + '0D', 'Primario 5%']]
    return (
        <>
            <FieldLabel>Fondo de tienda</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {presets.map(([c, l]) => {
                    const a = value === c
                    return (
                        <button key={l} onClick={() => onChange(c)} className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            <span style={{ width: 18, height: 18, borderRadius: 4, background: c, border: '1px solid var(--color-border)', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--color-body)' }}>{l}</span>
                        </button>
                    )
                })}
            </div>
        </>
    )
}

function hline(c: ReactNode) {
    return <svg width="60" height="34" viewBox="0 0 60 34">{c}</svg>
}

// Miniaturas de los 6 estilos de la sección de categorías. Cada una tiene que
// leerse como el LAYOUT que representa de un vistazo, sin texto: el círculo
// del medallón, el filete del índice, el bloque grande del mosaico. Los
// rellenos van con los tokens del tema para que funcionen en claro y oscuro.
const MINIATURA_CATEGORIA: Record<CategoryLayoutT, ReactNode> = {
    // Pastillas: cápsulas con un punto (el ícono) adentro.
    pills: hline(<g>
        {[2, 22, 42].map(x => <g key={x}>
            <rect x={x} y="12" width="17" height="11" rx="5.5" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
            <circle cx={x + 5.5} cy="17.5" r="2.6" fill="var(--color-primary)" />
            <rect x={x + 10} y="15.5" width="5" height="2" rx="1" fill="var(--color-muted)" />
        </g>)}
    </g>),
    // Índice: dos columnas de renglones grandes con filete debajo.
    indice: hline(<g>
        {[9, 19, 29].map(y => <g key={y}>
            <rect x="4" y={y - 4} width="17" height="3.5" rx="1.5" fill="var(--color-text)" />
            <rect x="4" y={y} width="24" height="1" fill="var(--color-border)" />
            <rect x="33" y={y - 4} width="14" height="3.5" rx="1.5" fill="var(--color-text)" />
            <rect x="33" y={y} width="24" height="1" fill="var(--color-border)" />
        </g>)}
    </g>),
    // Etiquetas: cápsulas chicas, sin ícono, en una línea.
    chips: hline(<g>
        {[3, 19, 32, 47].map((x, i) => (
            <rect key={x} x={x} y="14" width={i === 1 ? 11 : 13} height="7" rx="3.5" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
        ))}
    </g>),
    // Mosaico: un bloque grande a la izquierda y cuatro chicos a la derecha.
    mosaico: hline(<g>
        <rect x="4" y="6" width="24" height="22" rx="3" fill="var(--color-primary)" opacity="0.75" />
        {[[30, 6], [44, 6], [30, 18], [44, 18]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="12" height="10" rx="2.5" fill="var(--color-border)" />
        ))}
    </g>),
    // Tarjetas: cuatro cuadrados iguales con un renglón de texto debajo.
    tarjetas: hline(<g>
        {[4, 18, 32, 46].map(x => <g key={x}>
            <rect x={x} y="6" width="11" height="11" rx="2.5" fill="var(--color-border)" />
            <rect x={x} y="20" width="8" height="2.5" rx="1.25" fill="var(--color-muted)" />
        </g>)}
    </g>),
    // Círculos: medallones redondos con el nombre debajo.
    circulos: hline(<g>
        {[9, 24, 39, 54].map(cx => <g key={cx}>
            <circle cx={cx} cy="13" r="6" fill="var(--color-primary)" opacity="0.7" />
            <rect x={cx - 4.5} y="23" width="9" height="2.5" rx="1.25" fill="var(--color-muted)" />
        </g>)}
    </g>),
}

// Miniaturas de los 4 diseños de la sección de video — mismo criterio que
// las de categorías: que se lea el layout sin texto. El triangulito es el
// play; el bloque primario, el video.
function miniVideo(x: number, y: number, w: number, h: number, key?: string) {
    const cx = x + w / 2, cy = y + h / 2, t = Math.min(w, h) * 0.18
    return <g key={key}>
        <rect x={x} y={y} width={w} height={h} rx="2.5" fill="var(--color-primary)" opacity="0.75" />
        <path d={`M${cx - t * 0.6} ${cy - t} L${cx + t} ${cy} L${cx - t * 0.6} ${cy + t} Z`} fill="var(--color-bg)" />
    </g>
}
const MINIATURA_VIDEO: Record<VideoLayout, ReactNode> = {
    // Grande: un video a lo ancho y el título debajo.
    cine: hline(<g>
        {miniVideo(8, 3, 44, 22)}
        <rect x="8" y="28" width="20" height="2.5" rx="1.25" fill="var(--color-muted)" />
    </g>),
    // Alternado: dos filas, el video cambia de lado.
    alternado: hline(<g>
        {miniVideo(4, 2, 24, 14, 'a')}
        <rect x="32" y="6" width="18" height="2.5" rx="1.25" fill="var(--color-text)" />
        <rect x="32" y="10.5" width="22" height="2" rx="1" fill="var(--color-border)" />
        <rect x="6" y="22" width="18" height="2.5" rx="1.25" fill="var(--color-text)" />
        <rect x="6" y="26.5" width="22" height="2" rx="1" fill="var(--color-border)" />
        {miniVideo(32, 18, 24, 14, 'b')}
    </g>),
    // Verticales: cuatro rectángulos parados.
    reels: hline(<g>
        {[5, 19, 33, 47].map(x => miniVideo(x, 3, 11, 25, String(x)))}
    </g>),
    // Con lista: uno grande a la izquierda y renglones a la derecha.
    lista: hline(<g>
        {miniVideo(3, 5, 34, 20)}
        {[6, 13, 20].map(y => <g key={y}>
            <rect x="40" y={y} width="7" height="5" rx="1" fill="var(--color-border)" />
            <rect x="49" y={y + 1.5} width="9" height="2" rx="1" fill="var(--color-muted)" />
        </g>)}
    </g>),
}

// Miniaturas de los 4 diseños del banner de WhatsApp — mismo criterio que
// las de video: se lee el LAYOUT (tarjeta grande + chat, línea sobria,
// franja, dos tarjetas), no el contenido real.
const MINIATURA_WHATSAPP: Record<WhatsappLayout, ReactNode> = {
    // Clásico: bloque grande a la izquierda (tarjeta) y dos burbujas de
    // chat a la derecha.
    clasico: hline(<g>
        <rect x="2" y="3" width="35" height="28" rx="3" fill="var(--color-primary)" opacity="0.8" />
        <rect x="7" y="9" width="22" height="3" rx="1.5" fill="var(--color-bg)" />
        <rect x="7" y="15.5" width="16" height="2" rx="1" fill="var(--color-bg)" opacity="0.6" />
        <rect x="7" y="22" width="14" height="6" rx="3" fill="var(--color-bg)" />
        <rect x="41" y="6" width="14" height="7" rx="3.5" fill="var(--color-border)" />
        <rect x="45" y="18" width="13" height="7" rx="3.5" fill="var(--color-primary)" opacity="0.5" />
    </g>),
    // Sobrio: un círculo (ícono), dos renglones de texto y un botón chico,
    // todo en una fila con aire alrededor.
    minimal: hline(<g>
        <circle cx="9" cy="17" r="6" fill="var(--color-primary)" opacity="0.75" />
        <rect x="21" y="12.5" width="20" height="3" rx="1.5" fill="var(--color-text)" />
        <rect x="21" y="19" width="14" height="2" rx="1" fill="var(--color-border)" />
        <rect x="46" y="13" width="11" height="7" rx="3.5" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
    </g>),
    // Franja: una barra angosta a todo el ancho, con ícono y botón adentro.
    franja: hline(<g>
        <rect x="2" y="13" width="56" height="10" rx="5" fill="var(--color-primary)" opacity="0.75" />
        <circle cx="10" cy="18" r="3" fill="var(--color-bg)" />
        <rect x="17" y="16.5" width="20" height="3" rx="1.5" fill="var(--color-bg)" opacity="0.85" />
        <rect x="46" y="15.5" width="9" height="5" rx="2.5" fill="var(--color-bg)" />
    </g>),
    // Dos tarjetas: un bloque sólido (la consulta) y uno con borde (el
    // horario), del mismo tamaño, lado a lado.
    bento: hline(<g>
        <rect x="2" y="4" width="27" height="26" rx="3" fill="var(--color-primary)" opacity="0.8" />
        <rect x="7" y="11" width="16" height="3" rx="1.5" fill="var(--color-bg)" />
        <rect x="7" y="21" width="11" height="5" rx="2.5" fill="var(--color-bg)" />
        <rect x="32" y="4" width="26" height="26" rx="3" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="37" y="12" width="16" height="2.5" rx="1.25" fill="var(--color-muted)" />
        <rect x="37" y="18" width="12" height="2.5" rx="1.25" fill="var(--color-border)" />
    </g>),
}

// Editor de la lista de videos de la sección. Cada video es un bloque con su
// link (o archivo subido) y, abajo, el texto que lo acompaña. Mismo tope que
// el DTO del backend (ArrayMaxSize(12)).
const MAX_VIDEOS = 12
function EditorVideos({ videos, layout, onChange, onToast }: { videos: VideoItem[]; layout: VideoLayout; onChange: (v: VideoItem[]) => void; onToast: (m: string) => void }) {
    const upd = (i: number, cambio: Partial<VideoItem>) => onChange(videos.map((x, j) => j === i ? { ...x, ...cambio } : x))
    const mover = (i: number, d: -1 | 1) => {
        const j = i + d
        if (j < 0 || j >= videos.length) return
        const copia = [...videos]
        ;[copia[i], copia[j]] = [copia[j], copia[i]]
        onChange(copia)
    }
    // 'reels' solo muestra el título debajo de cada video: no se piden
    // texto ni botón que no se van a ver.
    const usaTexto = layout !== 'reels'
    const btnIcono: CSSProperties = { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
    return (
        <>
            <FieldLabel help={layout === 'reels' ? 'Para este diseño quedan mejor los videos filmados con el celular parado (9:16), como reels o TikToks.' : 'El título y el texto acompañan a cada video. El botón es opcional.'}>
                Videos
            </FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                {videos.map((v, i) => {
                    const primero = i === 0
                    const ultimo = i === videos.length - 1
                    return (
                        <div key={v.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Video {i + 1}</span>
                                <button onClick={() => mover(i, -1)} disabled={primero} className="ds-hover" aria-label="Subir" title="Subir" style={{ ...btnIcono, opacity: primero ? 0.35 : 1, cursor: primero ? 'default' : 'pointer' }}><ArrowUp size={14} /></button>
                                <button onClick={() => mover(i, 1)} disabled={ultimo} className="ds-hover" aria-label="Bajar" title="Bajar" style={{ ...btnIcono, opacity: ultimo ? 0.35 : 1, cursor: ultimo ? 'default' : 'pointer' }}><ArrowDown size={14} /></button>
                                <button
                                    onClick={() => onChange(videos.filter((_, j) => j !== i))}
                                    aria-label={`Quitar video ${i + 1}`} title="Quitar"
                                    style={btnIcono}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                                ><Trash2 size={14} /></button>
                            </div>
                            {/* Con un archivo ya subido, el link es el de R2
                                (armado por el uploader): el campo se oculta
                                hasta que lo quite con la papelera del uploader.
                                Con un link pegado, el uploader no aparece. */}
                            {!esVideoArchivo(v.url) && (
                                <div style={{ marginBottom: 10 }}>
                                    <Inp value={v.url} onChange={x => upd(i, { url: x })} placeholder="Link de YouTube, Vimeo o .mp4" />
                                    {v.url.trim() !== '' && !parseVideoEmbed(v.url) && (
                                        <p style={{ fontSize: 11.5, color: 'var(--color-error)', margin: '5px 0 0' }}>
                                            No reconocemos este link. Probá con uno de YouTube, de Vimeo, o que termine en .mp4
                                        </p>
                                    )}
                                </div>
                            )}
                            {(esVideoArchivo(v.url) || v.url.trim() === '') && (
                                <div style={{ marginBottom: 12 }}>
                                    <VideoUploader value={v.url} onChange={x => upd(i, { url: x })} onUpload={subirVideoApariencia} maxMB={500} />
                                </div>
                            )}
                            {/* Portada opcional. En Verticales se pide parada
                                (9:16): con un video horizontal es lo que evita
                                que el cuadro se vea recortado. */}
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel help={layout === 'reels' ? 'Opcional. Una imagen parada (9:16) queda mejor en este diseño, sobre todo si el video es horizontal.' : 'Opcional. Se ve antes de darle play, en vez del primer cuadro del video.'}>Portada</FieldLabel>
                                <ImgUploader value={v.portada} onChange={x => upd(i, { portada: x })} onUpload={subirImagenApariencia} shape="square" size={64} formats="JPG, PNG o HEIC · máx 10MB" onToast={onToast} />
                            </div>
                            <div style={{ marginBottom: usaTexto ? 8 : 0 }}><Inp value={v.titulo} onChange={x => upd(i, { titulo: x })} maxLength={120} placeholder="Título (opcional)" /></div>
                            {usaTexto && (
                                <>
                                    <div style={{ marginBottom: 8 }}><Inp value={v.texto} onChange={x => upd(i, { texto: x })} maxLength={400} placeholder="Texto (opcional)" /></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
                                        <Inp value={v.ctaTexto} onChange={x => upd(i, { ctaTexto: x })} maxLength={40} placeholder="Botón: Ver más" />
                                        <Inp value={v.ctaLink} onChange={x => upd(i, { ctaLink: x })} maxLength={500} placeholder="Link: /catalogo" />
                                    </div>
                                </>
                            )}
                        </div>
                    )
                })}
            </div>
            {videos.length < MAX_VIDEOS && (
                <button
                    onClick={() => onChange([...videos, { id: 'vd' + Date.now(), url: '', titulo: '', texto: '', ctaTexto: '', ctaLink: '', portada: null }])}
                    className="ds-hover"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                    <Plus size={14} strokeWidth={2} /> Agregar video
                </button>
            )}
        </>
    )
}

// `disabled` + `motivo`: para opciones que dependen de un dato que la tienda
// todavía no tiene (hoy, los estilos de categoría que necesitan foto). Se
// muestran igual — que el dueño vea que existen y qué le falta para usarlas —
// pero no se pueden elegir. `ayuda` es la descripción corta bajo el label;
// deshabilitada, esa línea se reemplaza por `motivo` (y queda también como
// tooltip) para que el porqué se vea sin depender del hover.
function VisualPick({ value, onChange, options }: {
    value: string
    onChange: (v: string) => void
    options: { id: string; label: string; svg: ReactNode; ayuda?: string; disabled?: boolean; motivo?: string }[]
}) {
    return (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {options.map(o => {
                const a = value === o.id
                const off = !!o.disabled
                return (
                    <button
                        key={o.id}
                        onClick={() => { if (!off) onChange(o.id) }}
                        disabled={off}
                        title={off ? o.motivo : undefined}
                        className={off ? undefined : 'ds-hover'}
                        style={{
                            width: 120, borderRadius: 10,
                            border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                            cursor: off ? 'not-allowed' : 'pointer', padding: 8, fontFamily: 'inherit',
                            opacity: off ? 0.45 : 1, textAlign: 'center',
                        }}
                    >
                        <div style={{ height: 52, display: 'grid', placeItems: 'center' }}>{o.svg}</div>
                        <div style={{ fontSize: 12, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)', marginTop: 6 }}>{o.label}</div>
                        {(off && o.motivo ? o.motivo : o.ayuda) && (
                            <div style={{ fontSize: 10.5, color: 'var(--color-subtle)', marginTop: 3, lineHeight: 1.3 }}>{off && o.motivo ? o.motivo : o.ayuda}</div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}

// Picker de categorías para índice/mosaico/tarjetas (ver CATEGORY_LAYOUT_MAX
// y resolverCategorias() en Inicio.tsx). `candidatas` ya viene filtrada por
// el caller a las que el estilo puede mostrar (todas para índice, solo con
// foto para mosaico/tarjetas) — acá solo se listan, se marcan, y se aplica
// el tope. [] seleccionadas = automático, no una lista vacía de verdad: el
// storefront resuelve solo qué mostrar (ver el mensaje del contador).
function SelectorCategorias({ candidatas, seleccionadas, tope, necesitaFoto, onChange }: {
    candidatas: ApiCategory[]
    seleccionadas: string[]
    tope?: number
    necesitaFoto: boolean
    onChange: (ids: string[]) => void
}) {
    const enTope = tope !== undefined && seleccionadas.length >= tope

    function toggle(id: string) {
        if (seleccionadas.includes(id)) { onChange(seleccionadas.filter(x => x !== id)); return }
        if (enTope) return
        onChange([...seleccionadas, id])
    }

    return (
        <div style={{ marginBottom: 18 }}>
            <FieldLabel help={necesitaFoto ? 'Solo se pueden elegir categorías con foto cargada — es lo que se ve en este estilo.' : 'Sin elegir ninguna, se muestran todas las categorías activas.'}>
                Qué categorías mostrar{tope !== undefined && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> · hasta {tope}</span>}
            </FieldLabel>

            {candidatas.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    {necesitaFoto
                        ? 'Ninguna categoría tiene foto todavía — cargá alguna en Catálogo → Categorías.'
                        : 'Todavía no tenés categorías activas.'}
                </div>
            ) : (
                <>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 12px', marginBottom: 8, maxHeight: 260, overflowY: 'auto' }}>
                        {candidatas.map((c, i) => {
                            const marcada = seleccionadas.includes(c.id)
                            const bloqueada = !marcada && enTope
                            return (
                                <div key={c.id} style={{ borderBottom: i < candidatas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <label className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', cursor: bloqueada ? 'not-allowed' : 'pointer', opacity: bloqueada ? 0.45 : 1 }}>
                                        <input type="checkbox" checked={marcada} disabled={bloqueada} onChange={() => toggle(c.id)} style={{ width: 16, height: 16, flexShrink: 0, cursor: bloqueada ? 'not-allowed' : 'pointer' }} />
                                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                    </label>
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--color-muted)' }}>
                        <span>
                            {seleccionadas.length === 0
                                ? `Sin elegir ninguna: se muestran ${tope ? `las primeras ${tope}` : 'todas'}${necesitaFoto ? ' con foto' : ''} automáticamente.`
                                : `${seleccionadas.length}${tope ? ` de ${tope}` : ''} seleccionadas`}
                        </span>
                        {seleccionadas.length > 0 && (
                            <button type="button" onClick={() => onChange([])} className="ds-link" style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                                Volver a automático
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

// Fila de interruptor, con su explicación opcional debajo (`ayuda`).
//
// La fila entera es UN <button role="switch"> y ya no un <label> con un
// botón adentro. El cambio lo forzó el ícono de ayuda: un <button> es un
// elemento "labelable", así que el <label> le reenviaba el click al primero
// que encontraba adentro — tocar la explicación prendía o apagaba la opción,
// o al revés. Como botón único, cada cosa hace lo suyo (el ícono queda
// afuera del botón), y de paso el interruptor anuncia bien su estado
// (role/aria-checked) a un lector de pantalla, que antes veía un <button>
// pelado sin decir si estaba prendido.
function ToggleRow({ label, on, onChange, ayuda }: { label: string; on: boolean; onChange: (v: boolean) => void; ayuda?: Ayuda }) {
    const [ayudaAbierta, setAyudaAbierta] = useState(false)
    const panelAyudaId = useId()
    const fila = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                onClick={() => onChange(!on)}
                className="ds-hover"
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            >
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{label}</span>
                <span aria-hidden style={{ display: 'block', width: 40, height: 22, borderRadius: 11, border: on ? 'none' : '1px solid var(--color-border)', background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.18)', transition: 'left 200ms' }} />
                </span>
            </button>
            {ayuda && <AyudaBoton nombre={label} abierta={ayudaAbierta} onToggle={() => setAyudaAbierta(a => !a)} panelId={panelAyudaId} />}
        </div>
    )
    if (!ayuda) return fila
    return (
        <div>
            {fila}
            <AyudaPanel ayuda={ayuda} id={panelAyudaId} abierta={ayudaAbierta} style={{ margin: '2px 4px 12px' }} />
        </div>
    )
}

function FontSelect({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const c = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        window.addEventListener('mousedown', c)
        return () => window.removeEventListener('mousedown', c)
    }, [open])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(!open)} className="ds-hover" style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 1, fontFamily: fontStack(value) }}>{value}</span>
                {value === 'Geist' && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>★</span>}
                <ChevronDown size={14} strokeWidth={1.5} style={{ opacity: 0.6 }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, maxHeight: 280, overflowY: 'auto' }}>
                    {opts.map(f => {
                        loadFont(f)
                        return (
                            <button key={f} onClick={() => { onChange(f); setOpen(false) }} className="ds-hover" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', background: value === f ? 'var(--color-surface-alt)' : 'transparent', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, color: 'var(--color-text)', fontFamily: fontStack(f) }}>{f}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{FONT_DESCRIPCIONES[f]}</div>
                                </div>
                                {value === f && <Check size={14} strokeWidth={2.4} style={{ color: 'var(--color-primary)' }} />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── SlideItem — componente de edición de un slide del hero ─────────────────

const SLIDE_GRADS = [
    'linear-gradient(135deg,#0F172A,#1D4ED8)',
    'linear-gradient(135deg,#1E1B4B,#7C3AED)',
    'linear-gradient(135deg,#052E2B,#10B981)',
]

function SlideItem({ slide, index, defaultOpen, onChange, onRemove, canMoveUp, canMoveDown, onMoveUp, onMoveDown, soloTexto, etiqueta = 'Slide', onToast }: {
    slide: HeroSlide; index: number; defaultOpen?: boolean
    onChange: (s: HeroSlide) => void; onRemove: () => void
    canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void
    onToast: (m: string) => void
    // Con una plantilla de Home activa (ver Apariencia.tsx soloContenido): el
    // estilo/posición/patrón/color de fondo del slide son decisiones de LA
    // PLANTILLA (su identidad visual fija, ver skill plantillas-home), no del
    // dueño — mostrarlos acá invitaría a romper el diseño que la plantilla
    // ya definió. Solo imagen + texto quedan editables.
    soloTexto?: boolean
    // "Imagen" en vez de "Slide" para una plantilla sin rotación (Escaparate,
    // ver heroNoRotativo en Apariencia.tsx) — son dos posiciones fijas, no
    // slides de un carrusel, y llamarlas "slide" ahí sugiere algo que el
    // diseño de esa plantilla no tiene.
    etiqueta?: string
}) {
    const [open, setOpen] = useState(!!defaultOpen)
    const [removeBg, setRemoveBg] = useState(false)
    const centrada = slide.imageStyle === 'centered'

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header colapsable */}
            <div className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-surface)', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
                <span style={{ width: 40, height: 28, borderRadius: 6, background: SLIDE_GRADS[index % SLIDE_GRADS.length], flexShrink: 0, ...(slide.img ? { backgroundImage: `url(${slide.img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etiqueta} {index + 1}: {slide.titulo || 'Sin título'}</span>
                {/* Orden — mismas flechas que ordenan la lista, sin drag and
                    drop (no hay ninguna librería de DnD en el proyecto). */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={onMoveUp} disabled={!canMoveUp} title="Mover arriba"
                        style={{ width: 18, height: 13, borderRadius: 3, border: 'none', background: 'transparent', color: canMoveUp ? 'var(--color-muted)' : 'var(--color-subtle)', cursor: canMoveUp ? 'pointer' : 'not-allowed', display: 'grid', placeItems: 'center', opacity: canMoveUp ? 1 : 0.4 }}
                        onMouseEnter={e => { if (canMoveUp) e.currentTarget.style.color = 'var(--color-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = canMoveUp ? 'var(--color-muted)' : 'var(--color-subtle)' }}>
                        <ArrowUp size={11} strokeWidth={2} />
                    </button>
                    <button onClick={onMoveDown} disabled={!canMoveDown} title="Mover abajo"
                        style={{ width: 18, height: 13, borderRadius: 3, border: 'none', background: 'transparent', color: canMoveDown ? 'var(--color-muted)' : 'var(--color-subtle)', cursor: canMoveDown ? 'pointer' : 'not-allowed', display: 'grid', placeItems: 'center', opacity: canMoveDown ? 1 : 0.4 }}
                        onMouseEnter={e => { if (canMoveDown) e.currentTarget.style.color = 'var(--color-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = canMoveDown ? 'var(--color-muted)' : 'var(--color-subtle)' }}>
                        <ArrowDown size={11} strokeWidth={2} />
                    </button>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--color-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }} />
                <button onClick={e => { e.stopPropagation(); onRemove() }} title={`Eliminar ${etiqueta.toLowerCase()}`}
                    style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'color 150ms, background 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}>
                    <Trash2 size={12} strokeWidth={1.8} />
                </button>
            </div>
            {/* Contenido */}
            {open && (
                <div style={{ padding: '14px' }}>
                    <FieldLabel help={`Imagen de fondo de ${etiqueta === 'Imagen' ? 'esta posición' : 'este slide'} (1440×600px recomendado)`}>Imagen{etiqueta === 'Imagen' ? '' : ' del slide'}</FieldLabel>
                    <ImgUploader value={slide.img} onChange={v => onChange({ ...slide, img: v })} onUpload={subirImagenSlide(removeBg)} shape="square" size={80} formats="JPG, PNG o HEIC · máx 10MB" onToast={onToast} />
                    {/* Pedido explícito (24/09/2026): habilitado SOLO con "Imagen
                        centrada" — es el único estilo pensado para una foto sin
                        fondo (queda compuesta sobre el patrón decorativo). Con
                        "Imagen completa" no tiene sentido (la foto ocupa todo el
                        slide) y queda deshabilitado. El backend
                        (uploadStorefrontImage en businesses.service.ts) sigue
                        andando con el modelo local sin cambios — esto es solo un
                        límite de UI, no del "Fondo con IA"/mantenimiento de
                        producto (ver products.service.ts / image-studio.service.ts).

                        Con `soloTexto` (plantilla avanzada activa, ver el
                        comentario de esa prop más abajo) el checkbox entero se
                        saca, no alcanza con deshabilitarlo: el hero de una
                        plantilla avanzada SIEMPRE muestra la foto a pantalla
                        completa, nunca "centrada sobre un patrón" (ese estilo
                        ni existe ahí, ver homes.tsx/plantillaReal.ts), así que
                        quitar el fondo dejaría un recorte flotando sobre nada
                        en un slot pensado para una foto entera. Sin este gate,
                        un slide que quedó en 'centered' desde antes de activar
                        la plantilla (dato que este modo ya no deja cambiar)
                        mostraba `centrada` en true y el checkbox aparecía
                        habilitado, como si aplicara (reportado con captura). */}
                    {!soloTexto && (
                    <label
                        className="ds-hover"
                        title={centrada ? undefined : 'Solo aplica con el estilo "Imagen centrada"'}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12.5, color: centrada ? 'var(--color-body)' : 'var(--color-muted)', borderRadius: 6, cursor: centrada ? 'pointer' : 'not-allowed' }}
                    >
                        <input type="checkbox" checked={centrada && removeBg} disabled={!centrada} onChange={e => setRemoveBg(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
                        Quitar el fondo automáticamente al subir esta imagen{centrada ? '' : ' (solo con "Imagen centrada")'}
                    </label>
                    )}

                    {!soloTexto && (<>
                    <Divider />
                    <FieldLabel help="Elegí si la foto ocupa todo el slide, o queda centrada sobre un fondo de color con un patrón decorativo, ideal para fotos con el fondo ya quitado.">Estilo de imagen</FieldLabel>
                    <div style={{ marginBottom: 14 }}>
                        <VisualPick value={slide.imageStyle} onChange={v => onChange({ ...slide, imageStyle: v as ImageStyle })} options={[
                            {
                                id: 'full', label: 'Imagen completa',
                                svg: hline(<g>
                                    <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-border-strong)" />
                                    <rect x="6" y="22" width="26" height="6" rx="1.5" fill="rgba(255,255,255,0.85)" />
                                </g>),
                            },
                            {
                                id: 'centered', label: 'Imagen centrada',
                                svg: hline(<g>
                                    <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" stroke="var(--color-border)" />
                                    <rect x="6" y="8" width="16" height="4" rx="1.5" fill="var(--color-muted)" />
                                    <rect x="6" y="15" width="22" height="4" rx="1.5" fill="var(--color-border)" />
                                    <circle cx="45" cy="17" r="10" fill="var(--color-primary)" opacity="0.7" />
                                </g>),
                            },
                        ]} />
                    </div>

                    {/* Solo tiene sentido con la foto ocupando todo el slide
                        — en 'centrada' no hay velo sobre la imagen, el fondo
                        lo maneja "Patrón de fondo" de más abajo. Pedido
                        explícito: antes el velo (tinte + puntos) era fijo,
                        siempre igual — ahora es una elección. */}
                    {!centrada && (
                        <div style={{ marginBottom: 18 }}>
                            <FieldLabel help="Qué se ve encima de la foto para que el texto resalte. 'Ninguno' deja la foto tal cual, sin nada encima.">Overlay de imagen</FieldLabel>
                            <VisualPick value={slide.imageOverlay ?? 'tint'} onChange={v => onChange({ ...slide, imageOverlay: v as ImageOverlay })} options={IMAGE_OVERLAYS.map(o => ({ id: o.id, label: o.label, svg: overlayPreview(o.id) }))} />
                        </div>
                    )}

                    {centrada && (
                        <>
                            <FieldLabel>Posición de la imagen</FieldLabel>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                                {([['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] as [ImagePosition, string][]).map(([id, l]) => {
                                    const a = slide.imagePosition === id
                                    return (
                                        <button key={id} onClick={() => onChange({ ...slide, imagePosition: id })} className="ds-hover" style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12.5, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                                    )
                                })}
                            </div>

                            <FieldLabel help="Figuras decorativas detrás de la imagen">Patrón de fondo</FieldLabel>
                            <div style={{ marginBottom: 18 }}>
                                <VisualPick value={slide.bgPattern} onChange={v => onChange({ ...slide, bgPattern: v as BgPattern })} options={BG_PATTERNS.map(p => ({ id: p.id, label: p.label, svg: patternPreview(p.id) }))} />
                            </div>

                            {slide.bgPattern !== 'none' && (
                                <div style={{ marginBottom: 18 }}>
                                    <FieldLabel help="Elegí si el patrón se concentra alrededor de la imagen (y la sigue si cambiás su posición) o si cubre el slide entero parejo.">Alcance del patrón</FieldLabel>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {BG_PATTERN_SCOPES.map(sc => {
                                            const a = (slide.bgPatternScope ?? 'image') === sc.id
                                            return (
                                                <button key={sc.id} title={sc.help} onClick={() => onChange({ ...slide, bgPatternScope: sc.id as BgPatternScope })} className="ds-hover" style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12.5, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{sc.label}</button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <SlideBgColorPicker value={slide.bgColor} onChange={v => onChange({ ...slide, bgColor: v })} />
                        </>
                    )}
                    </>)}

                    <Divider />
                    <div><FieldLabel>Título</FieldLabel><Inp value={slide.titulo} onChange={v => onChange({ ...slide, titulo: v })} /></div>
                    <div style={{ marginTop: 10 }}><FieldLabel>Subtítulo</FieldLabel><Inp value={slide.subtitulo} onChange={v => onChange({ ...slide, subtitulo: v })} /></div>
                    <div style={{ marginTop: 10 }}><FieldLabel>Texto del botón CTA</FieldLabel><Inp value={slide.cta} onChange={v => onChange({ ...slide, cta: v })} maxLength={30} /></div>
                    <div style={{ marginTop: 10 }}>
                        <FieldLabel help="A dónde lleva al hacer click. Ej: /catalogo, /catalogo/camperas, o una URL completa">Link del botón</FieldLabel>
                        <Inp value={slide.ctaLink} onChange={v => onChange({ ...slide, ctaLink: v })} />
                    </div>
                </div>
            )}
        </div>
    )
}

// Mini-previews del velo de imagen para el VisualPick de "Overlay de imagen"
// (modo 'Imagen completa') — rectángulo grisáceo simula la foto, encima la
// forma de cada opción. Mismo criterio visual que patternPreview() de abajo.
function overlayPreview(id: ImageOverlay): ReactNode {
    const foto = <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-border-strong)" />
    switch (id) {
        case 'none':
            return hline(foto)
        case 'diagonal':
            // Mismo velo diagonal que dibuja Inicio.tsx sobre la foto real
            // (oscuro del lado del texto, transparente del otro) — acá en
            // dos franjas de opacidad decreciente en vez de un gradiente SVG
            // real, para no depender de un <linearGradient> con id propio
            // (choca si el mismo preview se repite en más de un slide abierto).
            return hline(<g>
                {foto}
                <polygon points="2,2 34,2 18,32 2,32" fill="#0F172A" opacity="0.6" />
                <polygon points="34,2 46,2 30,32 18,32" fill="#0F172A" opacity="0.3" />
            </g>)
        case 'bottom':
            return hline(<g>
                {foto}
                <rect x="2" y="24" width="56" height="8" fill="#0F172A" opacity="0.6" />
                <rect x="2" y="18" width="56" height="6" fill="#0F172A" opacity="0.3" />
            </g>)
        case 'top':
            return hline(<g>
                {foto}
                <rect x="2" y="2" width="56" height="8" fill="#0F172A" opacity="0.6" />
                <rect x="2" y="10" width="56" height="6" fill="#0F172A" opacity="0.3" />
            </g>)
        case 'radial':
            // Viñeta: oscuro concentrado del lado del texto (izquierda,
            // donde vive textoBloque('left') en Inicio.tsx), desvaneciendo
            // hacia la derecha — más suave/redondeado que 'diagonal'.
            return hline(<g>
                {foto}
                <ellipse cx="16" cy="17" rx="24" ry="20" fill="#0F172A" opacity="0.55" />
                <ellipse cx="12" cy="17" rx="14" ry="14" fill="#0F172A" opacity="0.35" />
            </g>)
        case 'marca':
            // Igual que 'diagonal' pero con el color primario del negocio en
            // vez de negro — el único overlay a color, pensado para tiendas
            // que quieren que el hero se sienta más "de marca".
            return hline(<g>
                {foto}
                <polygon points="2,2 34,2 18,32 2,32" fill="var(--color-primary)" opacity="0.7" />
                <polygon points="34,2 46,2 30,32 18,32" fill="var(--color-primary)" opacity="0.35" />
            </g>)
        case 'blanco':
            // Único overlay CLARO — velo blanco en vez de negro, con el
            // título en texto oscuro (ver textoOscuro en Inicio.tsx). El
            // rectángulo de "foto" queda más oscuro acá a propósito para
            // que el velo blanco se note en la miniatura.
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="#64748B" />
                <polygon points="2,2 34,2 18,32 2,32" fill="#fff" opacity="0.88" />
                <polygon points="34,2 46,2 30,32 18,32" fill="#fff" opacity="0.4" />
            </g>)
        // 'tint' — comportamiento de siempre: tinte oscuro parejo + textura
        // de puntos, el default para no cambiarle el diseño a nadie.
        default:
            return hline(<g>
                {foto}
                <rect x="2" y="2" width="56" height="30" rx="2" fill="#0F172A" opacity="0.5" />
                <g fill="#fff" opacity="0.5">
                    {[0, 1, 2].flatMap(row => [0, 1, 2, 3, 4, 5, 6].map(col => (
                        <circle key={`${row}-${col}`} cx={5 + col * 8} cy={7 + row * 9} r="0.9" />
                    )))}
                </g>
            </g>)
    }
}

// Mini-previews del patrón decorativo para el VisualPick de "Patrón de fondo".
function patternPreview(id: BgPattern): ReactNode {
    switch (id) {
        case 'rings':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7">
                <circle cx="42" cy="17" r="14" strokeWidth="1.5" />
                <circle cx="42" cy="17" r="9" strokeWidth="1.5" />
                <circle cx="42" cy="17" r="4" strokeWidth="1.5" />
            </g>)
        case 'dots':
            return hline(<g fill="var(--color-primary)" opacity="0.6">
                {[0, 1, 2, 3].flatMap(row => [0, 1, 2, 3, 4].map(col => (
                    <circle key={`${row}-${col}`} cx={8 + col * 11} cy={5 + row * 8} r="1.4" />
                )))}
            </g>)
        case 'waves':
            return hline(<g fill="var(--color-primary)" opacity="0.55">
                <ellipse cx="20" cy="24" rx="16" ry="9" />
                <ellipse cx="42" cy="12" rx="14" ry="8" />
            </g>)
        case 'diagonal':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <polygon points="35,2 58,2 58,32 20,32" fill="var(--color-primary)" opacity="0.55" />
            </g>)
        case 'grid':
            return hline(<g stroke="var(--color-primary)" opacity="0.55" strokeWidth="1">
                {[10, 20, 30, 40, 50].map(x => <line key={`v${x}`} x1={x} y1="2" x2={x} y2="32" />)}
                {[8, 16, 24].map(y => <line key={`h${y}`} x1="2" y1={y} x2="58" y2={y} />)}
            </g>)
        case 'stripes':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <g stroke="var(--color-primary)" strokeWidth="2" opacity="0.55">
                    <line x1="6" y1="32" x2="20" y2="2" /><line x1="18" y1="32" x2="32" y2="2" />
                    <line x1="30" y1="32" x2="44" y2="2" /><line x1="42" y1="32" x2="56" y2="2" />
                </g>
            </g>)
        case 'confetti':
            return hline(<g fill="var(--color-primary)" opacity="0.6">
                <circle cx="8" cy="8" r="2" /><rect x="20" y="20" width="4" height="4" transform="rotate(20 22 22)" />
                <circle cx="36" cy="10" r="2" /><rect x="46" y="22" width="4" height="4" transform="rotate(20 48 24)" />
                <circle cx="52" cy="6" r="2" /><rect x="12" y="26" width="4" height="4" transform="rotate(20 14 28)" />
            </g>)
        case 'halo':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <circle cx="30" cy="17" r="15" fill="var(--color-primary)" opacity="0.35" />
                <circle cx="30" cy="17" r="7" fill="var(--color-primary)" opacity="0.4" />
            </g>)
        case 'arc':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7" strokeWidth="2">
                <path d="M6 30a24 24 0 0 1 48 0" />
                <path d="M15 30a15 15 0 0 1 30 0" />
            </g>)
        case 'plus':
            return hline(<g stroke="var(--color-primary)" opacity="0.6" strokeWidth="1.4">
                <path d="M10 5v8M6 9h8" /><path d="M46 8v8M42 12h8" /><path d="M28 20v8M24 24h8" />
            </g>)
        // Los 3 de acá abajo se mueven en la tienda real (burbujas flotando,
        // destellos titilando, anillos girando) — la miniatura del selector
        // se queda quieta, es solo una referencia visual del ícono.
        case 'bubbles':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.65" strokeWidth="1.3">
                <circle cx="12" cy="26" r="5" /><circle cx="26" cy="12" r="3.5" />
                <circle cx="40" cy="22" r="4.5" /><circle cx="52" cy="9" r="3" />
            </g>)
        case 'sparkle':
            return hline(<g fill="var(--color-primary)" opacity="0.65">
                <path d="M12 4l1.6 5L19 11l-5.4 2-1.6 5-1.6-5L5 11l5.4-2z" />
                <path d="M42 15l1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1z" />
                <path d="M28 22l1.3 4 4 1.3-4 1.3-1.3 4-1.3-4-4-1.3 4-1.3z" />
            </g>)
        case 'orbit':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7">
                <circle cx="30" cy="17" r="14" strokeWidth="1.4" strokeDasharray="2 4" />
                <circle cx="30" cy="17" r="8" strokeWidth="1.4" strokeDasharray="2 3" />
                <circle cx="44" cy="17" r="2" fill="var(--color-primary)" stroke="none" />
            </g>)
        default:
            return hline(<rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" stroke="var(--color-border)" />)
    }
}

// Color de fondo propio del slide — variante de ColorBlock con un chip extra
// para volver a "sin color" (cae al degradé de tema, comportamiento de siempre).
function SlideBgColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [custom, setCustom] = useState(value !== '' && !PRESET_COLORS.includes(value))
    return (
        <div style={{ marginBottom: 20 }}>
            <FieldLabel help="Si no elegís uno, se usa el degradé del tema como hasta ahora">Color de fondo del slide</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button onClick={() => { onChange(''); setCustom(false) }} title="Usar degradé del tema"
                    className="ds-hover"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${value === '' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <X size={13} style={{ color: 'var(--color-muted)' }} />
                </button>
                {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => { onChange(c); setCustom(false) }} className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: c, border: 'none', outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer' }} />
                ))}
                <button onClick={() => setCustom(true)} title="Personalizado" className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${custom ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={14} strokeWidth={2} /></button>
            </div>
            {custom && (
                <div style={{ maxWidth: 200 }}>
                    <Inp value={value} onChange={v => { if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v) }} mono prefix={<ColorSwatchInput value={value} onChange={onChange} />} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
