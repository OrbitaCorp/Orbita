// src/modules/ventas/cliente/inicio/Inicio.tsx — Vista 01 (v3 editorial)

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, X, Copy, Check } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar'
import { CountdownBanner } from '@/components/storefront/CountdownBanner'
import { ProductCard } from '@/components/storefront/ProductCard'
import type { Producto, TiendaConfig } from '@/lib/storefront/types'
import { openWpp } from '@/lib/storefront/utils'
import {
    getStorefrontConfig, getStorefrontProducts, getStorefrontCategories, getActiveGames, getActivePromoModal,
    toTiendaConfig, toCategoria, toProducto,
    type StorefrontConfigResponse, type StorefrontCategoryItem, type StorefrontHeroSlide, type StorefrontStatsItem, type ActiveGame, type ActivePromoModal,
} from '@/lib/storefront/api'
import { renderHeroBgPattern } from '@/components/storefront/heroPatterns'
import { Skeleton, SkeletonText, SkeletonProductGrid } from '@/design-system/components/Skeleton'
import JuegoInline, { TEMAS, yaGano, yaPerdio, estaDeclinado } from '@/modules/ventas/cliente/juegos/JuegoInline'
// El mapa real de íconos vive junto al editor del panel (Categorias.tsx) —
// ver catIcons.tsx para el porqué de compartirlo entre panel y storefront.
import { CatIcon } from '@/modules/ventas/panel/catalogo/catIcons'
// Render compartido con el preview del panel: la portada con plantilla la
// dibuja el MISMO componente que la galería de Avanzado → Plantillas, con
// datos reales en vez de los de muestra (ver plantillaReal.ts). Así una
// plantilla nueva no necesita tocar este archivo.
import { Home as PlantillaHome } from '@/modules/ventas/panel/avanzado/plantillas/homes'
import { cargarFuentes, CSS as PLANTILLA_CSS } from '@/modules/ventas/panel/avanzado/plantillas/piezas'
import { definicionPlantilla, plantillaReal, variablesDeTema } from './plantillaReal'
import { useStorefrontTheme } from '@/hooks/useStorefrontTheme'

// Fallback si el negocio nunca guardó su propia barra de stats (Apariencia →
// statsBar) — mismos valores decorativos que antes eran 100% hardcodeados.
const STATS_DEFAULT: StorefrontStatsItem[] = [
    { id: 'st1', value: '+1.200',  label: 'ventas realizadas' },
    { id: 'st2', value: '48 hs',   label: 'envío al país' },
    { id: 'st3', value: '30 días', label: 'cambios gratis' },
    { id: 'st4', value: '3 cuotas', label: 'sin interés' },
]

type CatVisual = { id: string; slug: string; nombre: string; count: number; hue: number; icon: string | null; color: string | null }

// Huella del conjunto de juegos activos en este momento (tipo + campaña de
// cada uno) — si cambia (se activó/desactivó otro juego, o se reactivó
// alguno de los que ya estaban), el modal vuelve a tener sentido mostrarse.
function estadoJuegos(games: ActiveGame[]): string {
    return games.map(g => `${g.type}:${g.campaignVersion}`).sort().join('|')
}

export default function Inicio() {
    const router = useRouter()
    // Solo para saber si el visitante puso la tienda en oscuro: con eso
    // decidimos si la paleta de la plantilla se aplica o le dejamos su
    // elección (ver varsPlantilla más abajo).
    const { isDark } = useStorefrontTheme()
    const { slug } = router.query as { slug: string }
    const base = `/tienda/${slug}`
    const go = (path: string) => router.push(`${base}${path}`)

    const [cargando, setCargando] = useState(true)
    const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
    const [categorias, setCategorias] = useState<StorefrontCategoryItem[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [destacados, setDestacados] = useState<Producto[]>([])
    const [juegosActivos, setJuegosActivos] = useState<ActiveGame[]>([])
    const [modalJuego, setModalJuego] = useState(false)
    // Cuál de los juegos elegibles se está mostrando adentro del modal — solo
    // hace falta elegir cuando hay más de uno (ver el picker más abajo); con
    // uno solo se entra derecho a jugarlo.
    const [juegoElegido, setJuegoElegido] = useState<string | null>(null)
    // Vuelta del login con Google (ver returnTo en JuegoInline.tsx) — cuando
    // está presente, el modal se abre directo en la fase de reclamo, sin
    // pasar por ninguna de las reglas de "primera vez"/elegibilidad de abajo.
    const [reclamo, setReclamo] = useState<{ sessionId: string; tipo: string } | null>(null)

    // "Modales de anuncios" (paquete Avanzado, RBT-675) — hermano más simple
    // del modal de juegos: un solo modal por negocio, sin sesión ni premio,
    // texto libre. Ver el comentario del efecto de abajo para la prioridad
    // frente al modal de juegos.
    const [promoActivo, setPromoActivo] = useState<ActivePromoModal | null>(null)
    const [modalPromo, setModalPromo] = useState(false)

    useEffect(() => {
        if (!slug) return
        let cancelado = false
        Promise.all([
            getStorefrontConfig(slug),
            getStorefrontCategories(slug),
            getStorefrontProducts(slug, { limit: 16 }),
            getStorefrontProducts(slug, { featured: true, limit: 8 }),
        ]).then(([cfg, cats, general, feat]) => {
            if (cancelado) return
            setConfig(cfg)
            setCategorias(cats)
            const badges = { showNew: cfg.appearance?.showNewBadge, showOffer: cfg.appearance?.showOfferBadge, showLowStock: cfg.appearance?.showLowStock }
            setProductos(general.data.map(p => toProducto(p, badges)))
            setDestacados(feat.data.map(p => toProducto(p, badges)))
        }).catch(() => { /* tienda no encontrada / backend caído: se muestra vacía, no rompe la página */ })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [slug])

    // Aparte del Promise.all de arriba a propósito: si este pedido falla o
    // tarda, la home no debe quedar esperándolo — sin ningún juego activo
    // (caso normal, la mayoría de los negocios) el modal de abajo
    // simplemente no se muestra.
    useEffect(() => {
        if (!slug) return
        let cancelado = false
        getActiveGames(slug).then(g => { if (!cancelado) setJuegosActivos(g) }).catch(() => {})
        return () => { cancelado = true }
    }, [slug])

    // Mismo criterio que el fetch de juegos de arriba: aparte del Promise.all
    // principal, si falla o tarda no bloquea la home — sin ningún modal de
    // anuncio configurado (caso normal) esto simplemente no hace nada.
    useEffect(() => {
        if (!slug) return
        let cancelado = false
        getActivePromoModal(slug).then(m => { if (!cancelado) setPromoActivo(m) }).catch(() => {})
        return () => { cancelado = true }
    }, [slug])

    // Vuelta del login con Google (googleLoginUrl + returnTo, ver
    // JuegoInline.tsx) — antes esto aterrizaba en una página propia
    // (/juegos/reclamar); ahora vuelve acá mismo, al home, y este efecto
    // reabre el modal directo en la fase de reclamo. Se limpian los query
    // params apenas se capturan (no hace falta conservarlos: JuegoInline ya
    // tiene el sessionId en el estado de React) para no dejar la URL con
    // parámetros que ya cumplieron su función.
    useEffect(() => {
        if (!router.isReady || !slug) return
        const { reclamarSesion, reclamarTipo, ...resto } = router.query
        if (typeof reclamarSesion !== 'string' || !reclamarSesion) return
        setReclamo({ sessionId: reclamarSesion, tipo: typeof reclamarTipo === 'string' ? reclamarTipo.toUpperCase() : 'HOOP' })
        router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, slug])

    // Juegos activos que este navegador todavía puede jugar — el único
    // criterio real de "¿hay algo nuevo para ofrecer?". Ganó, perdió y
    // declinó bloquean solo la campaña ACTUAL — una campaña nueva
    // (relanzamiento, siempre una decisión deliberada del dueño, nunca algo
    // que el visitante controle) los vuelve a hacer elegibles a los tres
    // por igual. Se recalcula en cada render (lecturas de localStorage, son
    // baratas) en vez de guardarse en estado — así un juego nuevo, o uno
    // que se reactive/relance, entra solo sin lógica extra.
    const elegibles = slug ? juegosActivos.filter(g => !yaGano(slug, g.type, g.campaignVersion) && !yaPerdio(slug, g.type, g.campaignVersion) && !estaDeclinado(slug, g.type, g.campaignVersion)) : []

    // Pedido explícito del dueño: única forma de enterarse del juego es este
    // modal (sin banner permanente) — aparece UNA sola vez por navegador,
    // apenas hay algo elegible para ofrecer. Se marca "ya visto" apenas se
    // decide mostrarlo (no recién al cerrarlo) para que sea de verdad una
    // sola vez. La clave incluye tipo+campaignVersion de cada juego
    // elegible (no solo el slug): si se suma un juego nuevo, o se reactiva
    // uno viejo (nueva campaña — ver schema.prisma), cuenta como un aviso
    // distinto y vuelve a mostrarse, aunque ya se haya visto/declinado/
    // jugado la combinación anterior.
    useEffect(() => {
        if (!slug || reclamo || elegibles.length === 0) return
        const key = `orbita-juego-modal:${slug}:${estadoJuegos(elegibles)}`
        try {
            if (localStorage.getItem(key)) return
            localStorage.setItem(key, '1')
            setModalJuego(true)
        } catch { /* sin localStorage (modo privado, etc.) — simplemente no se muestra */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, reclamo, estadoJuegos(elegibles)])

    // Al cerrar con la X se declina lo que el modal esté ofreciendo en ese
    // momento — el picker completo si todavía no se eligió uno (varios
    // juegos), o solo el que se estaba por jugar — por tipo + campaignVersion,
    // así JuegoInline.tsx puede chequear su propio tipo sin tener que
    // reconstruir el estado de los demás juegos que había en ese momento.
    // (Si el modal está en medio de un reclamo, cerrar no declina nada —
    // no tiene sentido "declinar" un premio ya ganado.)
    function cerrarModal() {
        setModalJuego(false)
        setJuegoElegido(null)
        setReclamo(null)
        if (!slug || reclamo) return
        const aDeclinar = juegoElegido ? elegibles.filter(g => g.type === juegoElegido) : elegibles
        try {
            for (const g of aDeclinar) localStorage.setItem(`orbita-juego-declinado:${slug}:${g.type}:${g.campaignVersion}`, '1')
        } catch { /* sin localStorage — no se puede recordar, pero tampoco rompe nada */ }
    }

    // Mismo criterio de "una sola vez por campaña" que el modal de juegos,
    // pero más simple (un solo modal, no una lista de "elegibles" por tipo).
    // Prioridad: si en esta misma carga ya hay un modal de juego para
    // mostrar (o una vuelta de reclamo en curso), el modal de promo no se
    // ofrece — se va a mostrar en una visita futura en la que el juego ya
    // no sea elegible. Sin cola ni orden configurable por ahora (ver plan).
    useEffect(() => {
        if (!slug || !promoActivo || reclamo || modalJuego || elegibles.length > 0) return
        const key = `orbita-promo-modal:${slug}:${promoActivo.campaignVersion}`
        try {
            if (localStorage.getItem(key)) return
            localStorage.setItem(key, '1')
            setModalPromo(true)
        } catch { /* sin localStorage — simplemente no se muestra */ }
    }, [slug, promoActivo, reclamo, modalJuego, elegibles.length])

    function cerrarModalPromo() {
        setModalPromo(false)
    }

    const tienda: TiendaConfig = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }
    // Plantilla de Home (paquete Avanzado, prueba de concepto — ver
    // businesses.service.ts#setHomeTemplate). Categorías, filas de
    // productos, WhatsApp y footer son iguales con cualquier plantilla —
    // header, anuncio, hero y barra de confianza sí cambian de look con
    // Vidriera (ver StorefrontHeader `centrado`, AnnouncementBar `dark`,
    // HeroCarousel `vidriera` y el grid de stats más abajo), para que la
    // tienda real se vea tal cual la plantilla, no solo "parecido".
    const homeTemplate = config?.appearance?.homeTemplate ?? null
    const heroSlides = config?.appearance?.heroSlides ?? []
    const stats = config?.appearance?.statsBar && config.appearance.statsBar.length > 0 ? config.appearance.statsBar : STATS_DEFAULT
    const catsVisual: CatVisual[] = categorias.map(c => ({ ...toCategoria(c), slug: c.slug }))

    // Mismo criterio de "estantes" que tenía el mock (slices de una misma
    // lista) pero ahora sobre productos reales, ya ordenados por más nuevo
    // primero (así "nuevos ingresos" es directamente la primera tanda).
    const nuevosIngresos = productos.slice(0, 4)
    const masVendidos     = productos.slice(4, 8)
    const lanzamientos    = productos.slice(8, 12)
    const masParaVos      = productos.slice(12, 16)

    // ── Plantilla de Home (paquete Avanzado) ────────────────────────────────
    // Sin plantilla elegida (`homeTemplate` null) todo lo de abajo queda igual
    // que siempre: el home clásico de Órbita. Ese es el camino de vuelta si el
    // dueño se arrepiente — no hay nada que deshacer, alcanza con volver a
    // null (ver businesses.service.ts#setHomeTemplate).
    const plantilla = definicionPlantilla(homeTemplate)

    // La plantilla dibuja con un único booleano `movil` (fue pensada para los
    // marcos Notebook/Celular del panel, no para CSS fluido), así que en la
    // tienda real hay que decirle de qué lado del breakpoint estamos. 768px es
    // el mismo corte que ya usan Sidebar/Shell/ConfigSidebar en este repo.
    const [movil, setMovil] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)')
        const leer = () => setMovil(mq.matches)
        leer()
        mq.addEventListener('change', leer)
        return () => mq.removeEventListener('change', leer)
    }, [])

    // Las plantillas traen tipografías que no están en Apariencia (varias
    // piden pesos 800/900) — `loadFont()` no las conoce, por eso su propio
    // cargador. Ver el porqué en la skill plantillas-home § Tipografías.
    useEffect(() => {
        if (plantilla) cargarFuentes()
    }, [plantilla])

    // La paleta y la tipografía de la plantilla, aplicadas a TODO el home
    // (header, cartel, hero, secciones, tarjetas, footer) como variables CSS
    // heredadas — ver variablesDeTema() en plantillaReal.ts para el porqué.
    //
    // Salvo que el visitante haya elegido modo oscuro: ahí gana su elección y
    // se queda con la paleta oscura de siempre, en vez de forzarle los colores
    // de la plantilla. Mismo criterio que ya usa _app.tsx con el color de
    // fondo de Apariencia ("solo en claro").
    const varsPlantilla = plantilla && !isDark ? variablesDeTema(plantilla.tema) : undefined

    if (cargando) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
                {/* .sf-w/.sf-g4 acá duplicadas del <style> del return real más
                    abajo (este branch es un return aparte, no lo comparte) —
                    sin esto el skeleton se quedaba con el padding/columnas de
                    desktop siempre, sin colapsar en mobile como el contenido
                    real que lo reemplaza un instante después (bug real,
                    reportado). Si cambian los breakpoints de allá, cambiar
                    acá también. */}
                <style>{`
                    .sf-w  { max-width:1280px; margin:0 auto; padding:0 32px }
                    .sf-g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px }
                    @media(max-width:1024px){ .sf-w { padding:0 24px } .sf-g4 { grid-template-columns:repeat(2,1fr); gap:12px } }
                    @media(max-width:640px){ .sf-w { padding:0 16px } .sf-g4 { gap:10px } }
                `}</style>
                <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} centrado={homeTemplate === 'vidriera'} />
                <div className="sf-w" style={{ paddingTop: 24, paddingBottom: 64 }} aria-hidden="true">
                    <Skeleton width="100%" height={360} radius={16} />
                    <div style={{ display: 'flex', gap: 10, margin: '28px 0 40px', overflow: 'hidden' }}>
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} width={96} height={96} radius={14} delay={i * 40} style={{ flexShrink: 0 }} />)}
                    </div>
                    {[1, 2].map(estante => (
                        <div key={estante} style={{ marginBottom: 40 }}>
                            <SkeletonText width={180} height={20} delay={estante * 60} style={{ marginBottom: 20, borderRadius: 6 }} />
                            <SkeletonProductGrid cantidad={4} className="sf-g4" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // OJO con volver a poner `overflowX: 'hidden'` acá: el header de
    // StorefrontHeader.tsx es `position: sticky` — un ancestro con
    // overflow-x fijado (sin overflow-y) hace que el navegador compute
    // overflow-y como `auto` (regla de CSS Overflow: si un eje no es
    // `visible` y el otro sí, el `visible` pasa a `auto`), convirtiendo este
    // div en su propio contenedor de scroll y rompiendo el sticky del
    // header — es justo lo que pasaba: en TODAS las demás páginas del
    // storefront (Catálogo, Producto, Carrito...) el header queda fijo al
    // hacer scroll, en la Home no, porque era la única con este overflowX.
    // Cada elemento que de verdad necesita recortar su propio contenido
    // (el marquee de categorías, el banner de WhatsApp, los slides del hero)
    // ya tiene su propio `overflow: hidden` local más abajo — no hacía
    // falta este de más a nivel página.
    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)', ...varsPlantilla }}>
            {/* Estilos propios de las plantillas (reveals, hover de fotos,
                marquee, botones). Es el MISMO string que usa el preview del
                panel — si se copiara y pegara acá volvería a desincronizarse,
                que es justo el problema que este refactor arregla. */}
            {plantilla && <style>{PLANTILLA_CSS}</style>}
            <style>{`
                @keyframes sfFadeIn   { from { opacity:0; transform:translateY(8px)  } to { opacity:1; transform:translateY(0) } }
                @keyframes sfDotPulse { 0%,100%{ opacity:1; transform:scale(1)  } 50%{ opacity:.4; transform:scale(.7) } }
                @keyframes sfFloat    { 0%,100%{ transform:translateY(0)   } 33%{ transform:translateY(-7px)  } 66%{ transform:translateY(-3px) } }
                @keyframes sfBadge    { 0%,100%{ transform:translateY(0)   } 50%{ transform:translateY(-8px) } }
                @keyframes sfMarquee  { from { transform:translateX(0) } to { transform:translateX(-50%) } }
                .sf-cat-scroll::-webkit-scrollbar { display:none }
                .sf-marquee-track { display:flex; gap:8px; width:max-content; animation:sfMarquee 28s linear infinite; }
                .sf-marquee-track:hover { animation-play-state:paused; }
                .sf-marquee-wrap { position:relative; overflow:hidden; mask-image:linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); -webkit-mask-image:linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); }

                /* Contenedor base */
                .sf-w  { max-width:1280px; margin:0 auto; padding:0 32px }
                /* Grillas de productos — 4 columnas en desktop. Se probó 3
                   (pedido: cards más grandes), pero acá cada estante
                   (nuevosIngresos/masVendidos/lanzamientos/masParaVos) corta
                   la lista en fetas de EXACTAMENTE 4 productos (ver los
                   .slice(n, n+4) más arriba) — con 3 columnas el 4to quedaba
                   solo, huérfano, en una fila propia (bug real, reportado
                   con captura). El catálogo y la categoría (Catalogo.tsx/
                   Categoria.tsx) sí bajaron a 3: ahí la lista no viene en
                   fetas de a 4, no hay ese problema, y son los que de verdad
                   se sentían chicos (el catálogo encima tiene el sidebar de
                   filtros achicando el ancho disponible, cosa que acá no
                   pasa). */
                .sf-g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px }
                /* Vidriera: "fotos pegadas entre sí ocupando todo el ancho" —
                   sin gap entre cards (ver skill plantillas-home, descripción
                   de Vidriera). Las cards en sí no pierden su radio propio acá
                   (ProductCard es compartido con catálogo/búsqueda, tocar su
                   estilo interno queda fuera de esta pasada) — esto sí ya
                   cierra la mayor parte de la diferencia visual. */
                .sf-g4-vidriera { gap:0 !important; }
                /* Hero de la plantilla Vidriera: título editorial enorme
                   (132px desktop / 62px mobile), tal cual el mock (Carrusel
                   en panel/avanzado/plantillas/piezas.tsx). */
                .sf-hero-title-vid { font-size: 132px; line-height: 0.88; font-weight: 800; letter-spacing: -0.045em; }
                @media(max-width:640px){ .sf-hero-title-vid { font-size: 62px; } }
                /* Grid hero */
                .sf-hero-grid { display:grid; grid-template-columns:1fr 400px; gap:40px; align-items:center; max-width:1280px; margin:0 auto; padding:0 48px }
                /* Ocupa bastante espacio en el primer momento — pedido
                   explícito del dueño, con una tienda de referencia (hero
                   grande, header más alto). El mínimo es "piso" para pantallas
                   bajas: en la mayoría el hero termina más alto todavía por el
                   propio contenido (título/imagen), esto solo evita que se vea
                   chico en desktop. */
                .sf-hero-inner { min-height:680px; padding-top:88px; padding-bottom:88px }
                /* Grid envíos / beneficios */
                .sf-2col { display:grid; grid-template-columns:1.1fr 1fr; gap:18px }

                /* ── Tablet (≤1024px) ── */
                @media(max-width:1024px){
                    .sf-w         { padding:0 24px }
                    .sf-g4        { grid-template-columns:repeat(2,1fr); gap:12px }
                    .sf-hero-grid { grid-template-columns:1fr; padding:0 32px }
                    .sf-hero-inner { min-height:520px; padding-top:64px; padding-bottom:64px }
                    .sf-hero-card { display:none }
                    .sf-2col      { grid-template-columns:1fr }
                    .sf-wpp-grid  { grid-template-columns:1fr !important; gap:24px !important; padding:32px 28px !important; }
                    .sf-wpp-chat  { display:none !important; }
                }
                /* ── Mobile (≤640px) ── */
                @media(max-width:640px){
                    .sf-w          { padding:0 16px }
                    .sf-g4         { gap:10px }
                    .sf-hero-grid  { padding:0 20px }
                    .sf-hero-inner { min-height:420px; padding-top:40px; padding-bottom:40px }
                    .sf-hero-arrow { display:none }
                    .sf-stats-row  { flex-wrap:wrap; gap:8px 0 }
                    .sf-stats-div  { display:none !important }
                    .sf-stats-item { padding:4px 16px !important }
                    .sf-wpp-grid   { padding:24px 20px !important; }
                }
            `}</style>

            <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} centrado={homeTemplate === 'vidriera'} />
            <AnnouncementBar text={config?.appearance?.shippingText} visible={config?.appearance?.showAnnouncementBar ?? true} scroll={config?.appearance?.announcementScroll ?? false} dark={homeTemplate === 'vidriera'} />

            {/* ══ HERO ══ */}
            {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} go={go} vidriera={homeTemplate === 'vidriera'} />}

            {/* ══ CUERPO ══
                Con plantilla elegida lo dibuja el render compartido con el
                preview del panel (mismo componente, datos reales): barra de
                confianza, destacados, categorías, más vendidos, cupón y
                WhatsApp, en el orden y con la forma que define la plantilla.
                Sin plantilla, el home clásico de Órbita de acá abajo. */}
            {plantilla ? (
                <PlantillaHome
                    p={plantillaReal({
                        base: plantilla,
                        productos,
                        destacados,
                        masVendidos,
                        categorias: catsVisual,
                        stats: (config?.appearance?.showStatsBar ?? true) ? stats : [],
                        cupon: config?.appearance?.homeTemplateData?.cupon ?? null,
                    })}
                    movil={movil}
                    soloCuerpo
                    acciones={{
                        irACatalogo: () => go('/catalogo'),
                        irACategoria: (s) => go(`/catalogo?cat=${encodeURIComponent(s)}`),
                        irAProducto: (s) => go(`/producto/${s}`),
                        abrirWhatsapp: tienda.wpp ? () => openWpp(tienda.wpp, config?.appearance?.whatsappText ?? undefined) : undefined,
                        // La tarjeta real, no la maqueta del panel: la
                        // plantilla pone la grilla (altos, a sangre) y acá
                        // adentro va el carrito/variantes/modo vidriera de
                        // verdad.
                        // `opts` viene de la plantilla (a sangre o no, y el
                        // alto de foto de esa fila): la tarjeta real se dibuja
                        // con el tema de la plantilla y con ESA forma, en vez
                        // de quedar siempre con el look por defecto de Órbita
                        // adentro de una grilla pensada para otra cosa.
                        renderProducto: (x, _i, opts) => {
                            const real = productos.find(pr => pr.id === x.slug) ?? destacados.find(pr => pr.id === x.slug)
                            return real ? (
                                <ProductCard
                                    producto={real}
                                    mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'}
                                    tema={plantilla.tema}
                                    sangre={opts.sangre}
                                    alto={opts.alto}
                                />
                            ) : null
                        },
                    }}
                />
            ) : (
            <>
            {/* ══ COUNTDOWN (paquete Avanzado) ══ — se muestra sola cuando
                hay un descuento vigente con "link compartible" activado en
                Descuentos; si no hay ninguno, CountdownBanner no renderiza
                nada. Solo en el home clásico: con una plantilla activa el
                cuerpo entero lo dibuja la plantilla (que todavía no tiene
                sección de countdown), igual que antes de este refactor. */}
            {slug && <CountdownBanner slug={slug} />}

            {/* ══ STATS BAR ══ */}
            {(config?.appearance?.showStatsBar ?? true) && stats.length > 0 && (
                    <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '12px 0' }}>
                        <div className="sf-w" style={{ display: 'flex', justifyContent: 'center' }}>
                            <div className="sf-stats-row" style={{ display: 'flex', alignItems: 'center' }}>
                                {stats.map((s, i, arr) => (
                                    <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                        <span className="sf-stats-item" style={{ padding: '0 24px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>{s.value}</span>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)' }}>{s.label}</span>
                                        </span>
                                        {i < arr.length - 1 && <span className="sf-stats-div" style={{ width: 1, height: 14, background: 'var(--color-border)', flexShrink: 0 }} />}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
            )}

            {/* ══ CATEGORÍAS ══ */}
            {catsVisual.length > 0 && (config?.appearance?.showCategoriesSection ?? true) && <CategoriaCarrusel cats={catsVisual} go={go} />}

            {/* ══ DESTACADOS ══ */}
            {destacados.length > 0 && (
                <section className="sf-w" style={{ paddingTop: 36, paddingBottom: 36 }}>
                    <SectionHead color="#EF4444" eyebrow="Destacados" titulo="Productos destacados" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {destacados.map(p => (
                            <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />
                        ))}
                    </div>
                </section>
            )}

            {/* ══ NUEVOS INGRESOS ══ */}
            {nuevosIngresos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 36 }}>
                    <SectionHead color="#10B981" eyebrow="Nuevos ingresos" titulo="Recién llegados" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {nuevosIngresos.map(p => (
                            <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />
                        ))}
                    </div>
                </section>
            )}

            {/* ══ MÁS VENDIDOS ══ */}
            {masVendidos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 36 }}>
                    <SectionHead color="#F59E0B" eyebrow="Top ventas" titulo="Más vendidos" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {masVendidos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
                    </div>
                </section>
            )}

            {/* ══ LANZAMIENTOS ══ */}
            {lanzamientos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 36 }}>
                    <SectionHead color="#7C3AED" eyebrow="Lanzamientos" titulo="Nuevos lanzamientos" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {lanzamientos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
                    </div>
                </section>
            )}

            {/* ══ MÁS PARA VOS ══ */}
            {masParaVos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 44 }}>
                    <SectionHead color="var(--color-primary)" eyebrow="Recomendados" titulo="Más para vos" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {masParaVos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
                    </div>
                </section>
            )}


            {/* ══ BANNER WHATSAPP ══ */}
            {config?.appearance?.showWhatsapp !== false && tienda.wpp && (
            <section className="sf-w" style={{ paddingBottom: 52 }}>
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, background: 'linear-gradient(135deg,#064E3B 0%,#065F46 50%,#047857 100%)', boxShadow: '0 20px 60px rgba(6,78,59,0.30)' }}>

                    {/* Decoración fondo */}
                    <div style={{ position: 'absolute', top: -80, right: 260, width: 320, height: 320, borderRadius: '50%', background: 'rgba(52,211,153,0.10)', filter: 'blur(80px)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -60, left: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', filter: 'blur(60px)', pointerEvents: 'none' }} />

                    <div className="sf-wpp-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', alignItems: 'center', gap: 48, padding: '40px 48px' }}>

                        {/* ── Columna izquierda ── */}
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 12px', borderRadius: 999, background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.35)', marginBottom: 16 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="#34D399"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.882l6.2-1.624A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.372l-.36-.213-3.681.965.982-3.594-.235-.369A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Atención por WhatsApp</span>
                            </div>
                            <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 10px', maxWidth: 420 }}>
                                Respondemos en menos<br />de una hora
                            </h2>
                            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 380 }}>
                                Consultá talles, disponibilidad o coordiná un envío. Te atendemos de lunes a sábado, sin bots.
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => openWpp(tienda.wpp, 'Hola! Quería hacer una consulta.')}
                                    style={{ height: 46, padding: '0 22px', borderRadius: 10, background: '#25D366', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(37,211,102,0.40)', transition: 'all 150ms', flexShrink: 0 }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#1DAA52'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.882l6.2-1.624A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.372l-.36-.213-3.681.965.982-3.594-.235-.369A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                                    Escribirnos ahora
                                </button>
                                <div style={{ display: 'flex', gap: 24 }}>
                                    {([['< 1hs', 'respuesta'], ['+1.200', 'consultas']] as [string,string][]).map(([n, l]) => (
                                        <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.02em' }}>{n}</span>
                                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{l}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Chat animado ── */}
                        <div className="sf-wpp-chat"><WppChat /></div>

                    </div>
                </div>
            </section>
            )}
            </>
            )}

            <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />

            {(reclamo || (modalJuego && elegibles.length > 0)) && (() => {
                // Resuelve QUÉ va adentro del modal en este render: la vuelta
                // de Google manda directo a reclamar; si no, o hay un solo
                // juego elegible (entra derecho) o ya se eligió uno del
                // picker — sin ninguna de las dos, se muestra el picker.
                const tipoMostrado = reclamo ? reclamo.tipo : (juegoElegido ?? (elegibles.length === 1 ? elegibles[0].type : null))
                const mostrarPicker = !reclamo && !tipoMostrado
                return (
                    <ModalJuego
                        titulo={reclamo ? 'Reclamá tu premio' : mostrarPicker ? '¡Jugá y ganá un descuento!' : (elegibles.find(g => g.type === tipoMostrado)?.name || TEMAS[tipoMostrado ?? '']?.titulo || 'Juego con premio')}
                        onVolver={!reclamo && juegoElegido ? () => setJuegoElegido(null) : undefined}
                        onCerrar={cerrarModal}
                    >
                        {mostrarPicker ? (
                            <PickerJuegos juegos={elegibles} onElegir={setJuegoElegido} />
                        ) : (
                            <JuegoInline slug={slug} tipo={tipoMostrado!} nombreTienda={tienda.nombre} sessionIdReclamo={reclamo?.sessionId} />
                        )}
                    </ModalJuego>
                )
            })()}

            {/* Modal de anuncios (paquete Avanzado, RBT-675) — mismo "marco"
                que el modal de juegos (backdrop + cierra solo con la X),
                sin URL propia. La condición de arriba ya evita que se
                muestre mientras el modal de juegos está en pantalla, este
                chequeo acá es defensivo, por si algo cambia el orden. */}
            {modalPromo && promoActivo && !modalJuego && !reclamo && (
                <ModalJuego titulo={promoActivo.title} onCerrar={cerrarModalPromo}>
                    <PromoModalContenido promo={promoActivo} go={go} />
                </ModalJuego>
            )}
        </div>
    )
}

// ─── Modal de "hay un juego con premio" (primera visita) ───────────────────────
// Convención visual del storefront (no es el Modal del panel): overlay fijo +
// card centrada — mismo patrón que VariantPickerModal.tsx, salvo que acá el
// backdrop NO cierra al click: pedido explícito del dueño, cerrar es una
// decisión que solo puede tomarse con la X (ver cerrarModal en Inicio()).
// Es solo el "marco" (backdrop + card + título + X) — el contenido (picker o
// el juego en sí, vía JuegoInline) lo decide quien lo usa. Sin esto no hay
// URL propia para el juego (pedido explícito del dueño 2026-08-27): todo el
// flujo — elegir, jugar y reclamar — pasa DENTRO de este mismo modal.
// El mismo marco se reusa para el modal de anuncios (RBT-675, ver
// PromoModalContenido más abajo) — el dueño ya adelantó que el criterio de
// UX ("sin URL propia, todo en un modal") aplica igual ahí.
function ModalJuego({ titulo, onVolver, onCerrar, children }: { titulo: string; onVolver?: () => void; onCerrar: () => void; children: React.ReactNode }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
            {/* Ancho pensado para que la escena del juego llegue a su escala
                máxima (ANCHO_DISENO × ESCALA_MAX = 600px) sin quedar
                apretada contra el padding. Sigue siendo responsive:
                width:100% + el padding:16 del overlay hacen que en un celular
                angosto ocupe todo el ancho disponible en vez de desbordar, y
                la escena de adentro se escala sola a lo que haya. */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 680, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: 'clamp(18px, 4.5vw, 32px)' }}>
                {/* Grid de 3 columnas con los dos extremos del mismo ancho — así el
                    título queda centrado de verdad contra el modal entero, no solo
                    contra el espacio que le queda libre entre los botones (con flex
                    simple, la X sin nada que la balancee del otro lado corría el
                    título hacia la izquierda). */}
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    {onVolver ? (
                        <button onClick={onVolver} aria-label="Volver" style={modalIconBtn}>
                            <ArrowLeft size={15} />
                        </button>
                    ) : <span />}
                    <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--color-text)', margin: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</h2>
                    <button onClick={onCerrar} aria-label="Cerrar" style={modalIconBtn}>
                        <X size={15} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

// ─── Selector de juego (solo cuando hay más de uno elegible a la vez) ──────────
function PickerJuegos({ juegos, onElegir }: { juegos: ActiveGame[]; onElegir: (tipo: string) => void }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 4px' }}>Elegí uno y jugá — cada juego se juega una sola vez.</p>
            {juegos.map(j => {
                const tema = TEMAS[j.type] ?? TEMAS.HOOP
                return (
                    <button
                        key={j.type}
                        onClick={() => onElegir(j.type)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12,
                            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
                        }}
                    >
                        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                            <tema.Icon size={17} strokeWidth={1.8} color="var(--color-primary)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>{j.name || tema.titulo}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tema.instrucciones}</div>
                        </div>
                        <ArrowRight size={15} strokeWidth={2} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                    </button>
                )
            })}
        </div>
    )
}

const modalIconBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent',
    color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
}

// ─── Contenido del modal de anuncios (RBT-675) ─────────────────────────────────
// Texto libre a propósito — no se ata a ningún Discount/Cupón real (el
// motor no tiene "2x1" implementado, ver discount-engine.ts en el backend).
// El botón "Copiar" es el mismo patrón (navigator.clipboard + 2s de aviso)
// que ya usa JuegoInline.tsx para el código del premio de un juego.
function PromoModalContenido({ promo, go }: { promo: ActivePromoModal; go: (path: string) => void }) {
    const [copiado, setCopiado] = useState(false)

    function copiarCodigo(codigo: string) {
        navigator.clipboard.writeText(codigo).catch(() => {})
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    // Mismo criterio que irACta() de HeroCarousel (path interno vs URL
    // completa) — acá adentro porque go() de este componente ya viene
    // atado al slug de ESTA tienda (Inicio.tsx), no hace falta duplicarlo.
    function irACta() {
        const link = promo.ctaLink?.trim()
        if (!link) { go('/catalogo'); return }
        if (/^https?:\/\//.test(link)) { window.location.href = link; return }
        go(link.startsWith('/') ? link : `/${link}`)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: '8px 4px 4px' }}>
            {promo.badge && (
                <span style={{
                    display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 13px', borderRadius: 999,
                    background: 'var(--color-primary)', color: '#fff', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em',
                }}>
                    {promo.badge}
                </span>
            )}
            {promo.message && (
                <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, maxWidth: 420 }}>{promo.message}</p>
            )}
            {promo.code && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 9px 9px 16px', borderRadius: 10, border: '1.5px dashed var(--color-border-strong)', background: 'var(--color-surface)' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', letterSpacing: '0.04em' }}>{promo.code}</span>
                    <button onClick={() => copiarCodigo(promo.code!)} style={{ height: 32, padding: '0 11px', borderRadius: 7, border: 'none', cursor: 'pointer', background: copiado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                    </button>
                </div>
            )}
            <button
                onClick={irACta}
                className="ds-hover"
                style={{ width: '100%', maxWidth: 260, height: 44, marginTop: 4, padding: '0 22px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
                {promo.ctaText?.trim() || 'Ver catálogo'} <ArrowRight size={15} />
            </button>
        </div>
    )
}

// ─── Encabezado de sección ─────────────────────────────────────────────────────

function SectionHead({ color, eyebrow, titulo, onVer }: { color: string; eyebrow: string; titulo: string; onVer: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'sfDotPulse 2s infinite' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{eyebrow}</span>
                </div>
                <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '5px 0 0' }}>{titulo}</h2>
            </div>
            <button className="ds-link" onClick={onVer} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Ver todos →</button>
        </div>
    )
}

// ─── Hero carousel ─────────────────────────────────────────────────────────────
// Los slides reales (StorefrontConfig.heroSlides) solo traen {titulo,
// subtitulo, img, cta} — sin el eyebrow/producto-overlay/precio que tenía el
// mock, que no tienen dónde editarse en Apariencia. Con imagen sube esa foto
// de fondo; sin ella, un degradé estable por índice.
const HERO_GRADS = [
    'linear-gradient(120deg, #0F172A 0%, #1E3A5F 42%, #1D4ED8 100%)',
    'linear-gradient(120deg, #1E1B4B 0%, #4C1D95 45%, #7C3AED 100%)',
    'linear-gradient(120deg, #052E2B 0%, #0A6638 45%, #10B981 100%)',
]

function HeroCarousel({ slides, go, vidriera = false }: { slides: StorefrontHeroSlide[]; go: (p: string) => void; vidriera?: boolean }) {
    const [idx, setIdx] = useState(0)
    const [paused, setPaused] = useState(false)
    const n = slides.length

    useEffect(() => {
        if (paused || n <= 1) return
        const id = setInterval(() => setIdx(i => (i + 1) % n), 4000)
        return () => clearInterval(id)
    }, [paused, n])

    const goSlide = (i: number) => setIdx((i + n) % n)

    // El link del CTA es texto libre cargado en Apariencia: puede ser un path
    // interno ("/catalogo/camperas") o una URL completa. Vacío = /catalogo.
    function irACta(link: string | undefined) {
        if (!link) { go('/catalogo'); return }
        if (/^https?:\/\//.test(link)) { window.location.href = link; return }
        go(link.startsWith('/') ? link : `/${link}`)
    }

    return (
        <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', width: `${n * 100}%`, transform: `translateX(-${idx * (100 / n)}%)`, transition: 'transform 680ms cubic-bezier(0.4,0,0.2,1)' }}>
                {slides.map((s, i) => {
                    const centrada = s.imageStyle === 'centered'
                    // `big` = tipografía editorial de Vidriera (132px/62px,
                    // CTA subrayado sin botón) — solo se pide para la rama
                    // full-bleed de abajo, que es la única que usa el mock
                    // (Carrusel en piezas.tsx). Las variantes con imagen
                    // centrada/lateral no la piden: no fueron pensadas para
                    // un título tan grande al lado de una foto recortada.
                    function textoBloque(align: 'left' | 'center', big = false) {
                        return (
                            // Textos y CTA más grandes — acompañan al hero más
                            // alto (pedido explícito del dueño, con una tienda
                            // de referencia de hero grande).
                            <div style={{ ...(align === 'center' ? { textAlign: 'center' } : undefined), ...(big ? { maxWidth: 760 } : undefined) }}>
                                <h1
                                    className={big ? 'sf-hero-title-vid' : undefined}
                                    style={{
                                        fontSize: big ? undefined : 'clamp(36px, 4.6vw, 64px)',
                                        fontWeight: big ? undefined : 900,
                                        letterSpacing: big ? undefined : '-0.04em',
                                        lineHeight: big ? undefined : 1.02,
                                        color: '#fff', whiteSpace: 'pre-line', margin: 0,
                                        fontFamily: big ? 'var(--font-heading, inherit)' : undefined,
                                    }}
                                >{s.titulo}</h1>
                                {s.subtitulo && (
                                    <p style={{ fontSize: big ? 20 : 17, fontWeight: big ? 600 : 400, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6, marginTop: big ? 8 : 18, maxWidth: 460, ...(align === 'center' ? { marginLeft: 'auto', marginRight: 'auto' } : {}) }}>{s.subtitulo}</p>
                                )}
                                <div style={{ display: 'flex', gap: 10, marginTop: big ? 24 : 28, flexWrap: 'wrap', ...(align === 'center' ? { justifyContent: 'center' } : {}) }}>
                                    {big ? (
                                        // CTA de texto subrayado, sin botón — tal cual Carrusel
                                        // en panel/avanzado/plantillas/piezas.tsx.
                                        <span
                                            onClick={() => irACta(s.ctaLink)}
                                            style={{ cursor: 'pointer', fontSize: 15, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#fff', borderBottom: '2px solid #fff', paddingBottom: 4 }}
                                        >
                                            {s.cta || 'Ver catálogo'}
                                        </span>
                                    ) : (
                                        <button className="ds-hover" onClick={() => irACta(s.ctaLink)} style={{ height: 54, padding: '0 28px', borderRadius: 11, background: '#fff', color: '#0F172A', fontSize: 15.5, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 22px rgba(0,0,0,0.22)' }}>
                                            {s.cta || 'Ver catálogo'} <ArrowRight size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    if (centrada) {
                        const posCenter = s.imagePosition === 'center'
                        if (posCenter) {
                            // Posición "Centro" real: apilado, texto arriba e
                            // imagen abajo, todo centrado en el ancho del
                            // slide — antes quedaba metido en la misma
                            // columna angosta que "Derecha" (layout de 2
                            // columnas de siempre) y se veía igual.
                            return (
                                <div key={s.id} style={{ width: `${100 / n}%`, flexShrink: 0 }}>
                                    <div style={{ position: 'relative', overflow: 'hidden', background: s.bgColor || HERO_GRADS[i % HERO_GRADS.length] }}>
                                        {renderHeroBgPattern(s.bgPattern, { scope: s.bgPatternScope, anchor: s.imagePosition })}
                                        <div className="sf-hero-inner" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, maxWidth: 900, margin: '0 auto', padding: '0 48px' }}>
                                            {textoBloque('center')}
                                            {s.img && <img src={s.img} alt="" style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }} />}
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                        const imgPrimero = s.imagePosition === 'left'
                        const justify = s.imagePosition === 'left' ? 'flex-start' : 'flex-end'
                        return (
                            <div key={s.id} style={{ width: `${100 / n}%`, flexShrink: 0 }}>
                                <div style={{ position: 'relative', overflow: 'hidden', background: s.bgColor || HERO_GRADS[i % HERO_GRADS.length] }}>
                                    {renderHeroBgPattern(s.bgPattern, { scope: s.bgPatternScope, anchor: s.imagePosition })}
                                    <div className="sf-hero-inner" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap', maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
                                        <div style={{ flex: '1 1 380px', order: imgPrimero ? 2 : 1 }}>{textoBloque('left')}</div>
                                        {s.img && (
                                            <div style={{ flex: '1 1 320px', display: 'flex', justifyContent: justify, order: imgPrimero ? 1 : 2 }}>
                                                <img src={s.img} alt="" style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    // Velo diagonal: oscuro del lado del texto, transparente
                    // del otro — tal cual Carrusel en piezas.tsx. Vidriera lo
                    // usa siempre (su mock limpio no pasa por el campo de
                    // abajo, es una decisión fija de la plantilla, ver
                    // soloTexto en SlideItem de Apariencia.tsx); fuera de
                    // Vidriera es una de las opciones que elige el dueño
                    // (imageOverlay, Apariencia.tsx → "Overlay de imagen").
                    const veloDiagonal = 'linear-gradient(100deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.58) 34%, rgba(0,0,0,0.12) 62%)'
                    // 'tint' = comportamiento de siempre (tinte parejo +
                    // puntos) y el default para slides guardados antes de
                    // que existiera este campo — no les cambia el diseño.
                    const overlay = vidriera ? 'diagonal' : (s.imageOverlay ?? 'tint')
                    const overlayGradient =
                        overlay === 'none' ? null :
                        overlay === 'diagonal' ? veloDiagonal :
                        overlay === 'bottom' ? 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.30) 42%, rgba(0,0,0,0) 75%)' :
                        'linear-gradient(rgba(15,23,42,0.55),rgba(15,23,42,0.55))' // 'tint'
                    return (
                        <div key={s.id} style={{ width: `${100 / n}%`, flexShrink: 0 }}>
                            <div style={{
                                position: 'relative', overflow: 'hidden',
                                background: s.img
                                    ? (overlayGradient ? `${overlayGradient}, url(${s.img})` : `url(${s.img})`)
                                    : HERO_GRADS[i % HERO_GRADS.length],
                                backgroundSize: 'cover', backgroundPosition: 'center',
                            }}>
                                {/* Textura de puntos — solo con el overlay
                                    'tint' (comportamiento de siempre). Las
                                    demás opciones (diagonal, degradé, ninguno)
                                    son un velo limpio sin textura encima. */}
                                {overlay === 'tint' && (
                                    <div style={{ position: 'absolute', inset: 0, opacity: 0.40, backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(to right, transparent, black 60%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 60%)' }} />
                                )}

                                <div className="sf-hero-grid sf-hero-inner" style={{ gridTemplateColumns: '1fr' }}>
                                    {textoBloque('left', vidriera)}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Flechas — se esconden en mobile (.sf-hero-arrow, ver el media
                query ≤640px de Inicio.tsx). Van centradas verticalmente a
                media altura del hero SIEMPRE, sea cual sea el largo del
                texto del slide — en desktop el texto es angosto (maxWidth
                460/760) y nunca llega a tocarlas, pero en un celular el
                hero es mucho más bajo y el texto ocupa casi todo el ancho,
                así que termina pasando justo por arriba de la flecha (bug
                real, reportado con captura: "toda la línea de sol" y "Ver
                ofertas" quedaban debajo/pegados a las flechas). Ajustar la
                posición de las flechas no alcanza — el problema es que en
                cualquier punto medio de esa columna angosta SIEMPRE hay
                texto; sacarlas en mobile y dejar que el swipe + los dots de
                abajo cubran la navegación es el mismo criterio que ya usa
                el resto de este archivo para elementos que no entran en
                una pantalla chica (.sf-hero-card, .sf-wpp-chat). */}
            {n > 1 && <>
                <button className="ds-hover sf-hero-arrow" onClick={() => goSlide(idx - 1)} aria-label="Anterior" style={arrowStyle('left')}><ChevronLeft size={19} /></button>
                <button className="ds-hover sf-hero-arrow" onClick={() => goSlide(idx + 1)} aria-label="Siguiente" style={arrowStyle('right')}><ChevronRight size={19} /></button>

                {/* Dots */}
                <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', gap: 6 }}>
                    {slides.map((_, i) => (
                        <button key={i} className="ds-hover" onClick={() => goSlide(i)} aria-label={`Slide ${i + 1}`}
                            style={{ height: 7, width: i === idx ? 22 : 7, borderRadius: 999, border: 'none', cursor: 'pointer', background: i === idx ? '#fff' : 'rgba(255,255,255,0.42)', transition: 'width 280ms ease', padding: 0 }} />
                    ))}
                </div>
            </>}
        </div>
    )
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
    return {
        position: 'absolute', [side]: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 3,
        width: 38, height: 38, borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', backdropFilter: 'blur(8px)',
        color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
    }
}

// ─── Carrusel de categorías (marquee automático si > 4 items) ─────────────────

const CAT_MIN_MARQUEE = 4

function CatPill({ c, go }: { c: CatVisual; go: (p: string) => void }) {
    return (
        <button
            onClick={() => go(`/catalogo/${c.slug}`)}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, height: 50, padding: '0 14px 0 7px', cursor: 'pointer', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-bg)', transition: 'border-color 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        >
            {/* Ícono y color reales de la categoría (elegidos en el panel,
                Categorias.tsx) — antes acá siempre iba el mismo emoji fijo
                sin importar lo que el vendedor hubiera guardado (bug
                encontrado 2026-08-25). Mismo criterio visual que el panel:
                tinte del color al 13% de fondo (`${color}22`) + ícono en el
                color sólido. Sin `color` (dato viejo) cae al degradé por
                hue de siempre. */}
            <span style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                background: c.color ? `${c.color}22` : `radial-gradient(circle at 35% 30%, oklch(0.86 0.07 ${c.hue}), oklch(0.74 0.08 ${c.hue}))`,
                color: c.color ?? 'var(--color-muted)',
            }}>
                <CatIcon icono={c.icon ?? 'tag'} size={16} />
            </span>
            <span style={{ textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>{c.nombre}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-muted)', marginTop: 1, fontFamily: '"Geist Mono", monospace' }}>{c.count} productos</span>
            </span>
        </button>
    )
}

function CategoriaCarrusel({ cats, go }: { cats: CatVisual[]; go: (p: string) => void }) {
    const isMarquee = cats.length > CAT_MIN_MARQUEE

    // El truco del loop sin costuras es matemáticamente simple (duplicar el
    // contenido y animar de 0% a -50%: al llegar al final, la segunda copia
    // queda pixel a pixel donde arrancó la primera, así que el reinicio del
    // `infinite` de CSS es invisible) — pero con POCAS categorías y pantalla
    // ANCHA, 2 copias fijas no alcanzan: se llega a ver el set completo Y el
    // arranque de la repetición al mismo tiempo, y el ojo lee eso como "se
    // cortó y reinició" aunque el CSS nunca dé un salto real (bug reportado:
    // con 6 categorías en una pantalla grande, se notaba clarísimo).
    //
    // Se mide el ancho real del contenedor y de UN set de categorías, y se
    // repite ese set las veces que hagan falta para que el track completo
    // mida siempre al menos el DOBLE del contenedor visible — así queda
    // garantizado que en todo momento hay contenido de sobra afuera de los
    // dos lados, sea cual sea la cantidad de categorías o el ancho de
    // pantalla. La animación sigue siendo 0%→-50% sin tocar el CSS: en vez
    // de 2 copias de `cats`, son 2 mitades idénticas, cada una con
    // `repeticiones` copias adentro — el punto medio del track sigue siendo
    // exactamente donde arrancó, la métrica no cambia, solo lo que hay
    // adentro de cada mitad.
    const wrapRef = useRef<HTMLDivElement>(null)
    // Ojo acá: este ref mide el ancho de UN set de categorías — tiene que
    // apuntar a un elemento que SIEMPRE tenga exactamente una copia adentro,
    // separado del track visible (que sí crece con `repeticiones`). Si
    // midiera el track visible, la cuenta se retroalimentaría sola: al
    // recalcular en un resize, ya no mediría "un set" sino "un set ×
    // repeticiones anterior", y el resultado se iría de rango.
    const medidorRef = useRef<HTMLDivElement>(null)
    const [repeticiones, setRepeticiones] = useState(1)

    useEffect(() => {
        if (!isMarquee) return
        const medir = () => {
            const anchoVisible = wrapRef.current?.clientWidth ?? 0
            const anchoSet = medidorRef.current?.scrollWidth ?? 0
            if (!anchoVisible || !anchoSet) return
            setRepeticiones(Math.max(1, Math.ceil((anchoVisible * 2) / anchoSet)))
        }
        medir()
        window.addEventListener('resize', medir)
        return () => window.removeEventListener('resize', medir)
    }, [isMarquee, cats.length])

    return (
        <div style={{ paddingTop: 24, paddingBottom: 28 }}>
            <div className="sf-w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Comprá por categoría</h2>
                <button className="ds-link" onClick={() => go('/catalogo')} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>
            </div>

            {isMarquee ? (
                /* ── Marquee automático ── */
                <div className="sf-marquee-wrap" ref={wrapRef} style={{ paddingLeft: 0 }}>
                    {/* Medidor invisible: exactamente UN set, siempre — nunca
                        crece con `repeticiones`. Fuera de flujo (absolute +
                        visibility:hidden) para no ocupar espacio ni tapar nada,
                        pero conserva su ancho real para poder medirlo. */}
                    <div
                        ref={medidorRef}
                        aria-hidden
                        style={{ display: 'flex', gap: 8, position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}
                    >
                        {cats.map(c => <CatPill key={c.id} c={c} go={go} />)}
                    </div>

                    <div className="sf-marquee-track">
                        {/* Dos mitades idénticas (loop sin costura) — cada una
                            con `repeticiones` copias del set, calculadas arriba. */}
                        {[0, 1].map(mitad => (
                            <div key={mitad} style={{ display: 'flex', gap: 8 }}>
                                {Array.from({ length: repeticiones }).flatMap((_, r) =>
                                    cats.map(c => <CatPill key={`${c.id}-${mitad}-${r}`} c={c} go={go} />),
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* ── Scroll estático si ≤ 4 ── */
                <div className="sf-w">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {cats.map(c => <CatPill key={c.id} c={c} go={go} />)}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Chat WhatsApp animado ─────────────────────────────────────────────────────

const WPP_DOUBLE_CHECK = (
    <svg width="14" height="9" viewBox="0 0 16 10" fill="none">
        <path d="M1 5L4.5 8.5L11 2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5L8.5 8.5L15 2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
)

// phase: 0=vacío → 1=msg cliente → 2=typing tienda → 3=msg tienda → 4=msg cliente2 → reset
function WppChat() {
    const [phase, setPhase] = useState(0)

    useEffect(() => {
        const DELAYS: Record<number, number> = { 0: 500, 1: 1000, 2: 1800, 3: 1000, 4: 3000 }
        const next = phase < 4 ? phase + 1 : 0
        const t = setTimeout(() => setPhase(next), DELAYS[phase] ?? 1000)
        return () => clearTimeout(t)
    }, [phase])

    const show1   = phase >= 1
    const typing  = phase === 2
    const show2   = phase >= 3
    const show3   = phase >= 4

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <style>{`
                @keyframes wppBubble {
                    from { opacity: 0; transform: translateY(8px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes wppDot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30%           { transform: translateY(-4px); opacity: 1; }
                }
            `}</style>

            {/* Mensaje cliente */}
            {show1 && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '85%', animation: 'wppBubble 280ms ease both' }}>
                    <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>Hola! ¿Tienen la campera en talle M?</p>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:41</span>
                </div>
            )}

            {/* Typing indicator */}
            {typing && (
                <div style={{ alignSelf: 'flex-end', background: '#25D366', borderRadius: '14px 14px 3px 14px', padding: '10px 16px', animation: 'wppBubble 200ms ease both', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 0.18, 0.36].map((d, i) => (
                        <span key={i} style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: `wppDot 1s ${d}s ease-in-out infinite` }} />
                    ))}
                </div>
            )}

            {/* Respuesta tienda */}
            {show2 && (
                <div style={{ alignSelf: 'flex-end', background: '#25D366', borderRadius: '14px 14px 3px 14px', padding: '9px 13px', maxWidth: '92%', animation: 'wppBubble 280ms ease both' }}>
                    <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Sí! Tenemos en M y L. Te coordinamos el envío hoy mismo 🎉</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>09:42</span>
                        {WPP_DOUBLE_CHECK}
                    </div>
                </div>
            )}

            {/* Respuesta final cliente */}
            {show3 && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '70%', animation: 'wppBubble 280ms ease both' }}>
                    <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Perfecto, muchas gracias! 🙌</p>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:43</span>
                </div>
            )}
        </div>
    )
}

