// src/modules/ventas/panel/configuracion/mock/apariencia.mock.ts
// Estado de apariencia pública de la tienda + helpers de fuentes.
// TODO: persistir contra el backend cuando esté listo.

export type ModoColor    = 'claro' | 'oscuro' | 'sistema'
export type EscalaFuente = 'sm' | 'md' | 'lg'
export type LayoutHeader = 'standard' | 'full' | 'minimal' | 'centered'
export type LayoutGrid   = '3col' | '4col' | 'list'
export type RadioCards   = 'none' | 'sm' | 'md' | 'lg'
export type ImageStyle    = 'full' | 'centered'
export type ImagePosition = 'left' | 'center' | 'right'
export type BgPattern     = 'none' | 'rings' | 'dots' | 'waves' | 'diagonal' | 'grid' | 'stripes' | 'confetti' | 'halo' | 'arc' | 'plus' | 'bubbles' | 'sparkle' | 'orbit'
// 'image' = el patrón se concentra alrededor de donde está la imagen (sigue
// su posición: izquierda/centro/derecha) — pensado para "enmarcar" la foto.
// 'full' = el patrón cubre el slide entero, parejo, sin importar dónde esté
// la imagen — un fondo de marca detrás de todo.
export type BgPatternScope = 'image' | 'full'

export interface HeroSlide {
    id:        string
    titulo:    string
    subtitulo: string
    img:       string | null
    cta:       string
    // A dónde lleva el botón del CTA — path interno ("/catalogo/camperas") o
    // URL externa. Vacío = fallback a "/catalogo".
    ctaLink:   string
    // 'full' = la imagen ocupa todo el slide (de siempre); 'centered' = imagen
    // a tamaño natural junto al texto, con fondo sólido + patrón decorativo —
    // pensado para fotos con el fondo ya quitado.
    imageStyle:    ImageStyle
    imagePosition: ImagePosition
    bgPattern:     BgPattern
    // Alcance del patrón — ver BgPatternScope. Opcional en la práctica
    // (slides guardados antes de que existiera este campo caen a 'image' en
    // el mapper), pero no-opcional acá porque todo slide nuevo lo trae.
    bgPatternScope: BgPatternScope
    // Color de fondo propio del slide en modo 'centered'. '' = usa el
    // degradé del tema (colorPrimario/colorSecundario) como hasta ahora.
    bgColor:       string
}

export const BG_PATTERNS: { id: BgPattern; label: string }[] = [
    { id: 'none',     label: 'Ninguno' },
    { id: 'rings',    label: 'Anillos' },
    { id: 'dots',     label: 'Puntos' },
    { id: 'grid',     label: 'Cuadrícula' },
    { id: 'stripes',  label: 'Rayas' },
    { id: 'waves',    label: 'Manchas' },
    { id: 'halo',     label: 'Halo' },
    { id: 'arc',      label: 'Arco' },
    { id: 'diagonal', label: 'Diagonal' },
    { id: 'confetti', label: 'Confeti' },
    { id: 'plus',     label: 'Cruces' },
    // Animados — se mueven en vez de quedar estáticos. Igual respetan el
    // alcance (image/full) y la posición de la imagen como el resto.
    { id: 'bubbles',  label: 'Burbujas' },
    { id: 'sparkle',  label: 'Destellos' },
    { id: 'orbit',    label: 'Órbita' },
]

export const BG_PATTERN_SCOPES: { id: BgPatternScope; label: string; help: string }[] = [
    { id: 'image', label: 'Detrás de la imagen', help: 'El patrón sigue a la foto, se concentra donde está, en cualquiera de las 3 posiciones.' },
    { id: 'full',  label: 'En todo el slide',    help: 'El patrón cubre el slide entero, parejo, sin importar dónde esté la foto.' },
]

export interface HeaderLink {
    id:    string
    label: string
    on:    boolean
}

// Ítem de la barra de estadísticas debajo del slider del hero (ej: "+1.200
// ventas realizadas") — texto libre, no calculado.
export interface StatItem {
    id:    string
    value: string
    label: string
}

export interface Apariencia {
    nombreTienda: string
    tagline:      string
    logo:         string | null
    favicon:      string | null
    sliders:      HeroSlide[]
    colorPrimario:   string
    colorSecundario: string
    colorAccent:     string
    colorFondo:      string
    modoColor:       ModoColor
    fuenteHeading: string
    fuenteBody:    string
    escalaFuente:  EscalaFuente
    layoutHeader: LayoutHeader
    headerLinks:  HeaderLink[]
    layoutGrid:   LayoutGrid
    radioCards:   RadioCards
    mostrarResenas:     boolean
    mostrarBadgeNuevo:  boolean
    mostrarBadgeOferta: boolean
    mostrarStockBajo:   boolean
    mostrarWhatsapp:    boolean
    mostrarBuscador:    boolean
    mostrarCategorias:  boolean
    mostrarFooter:      boolean
    mostrarRedesFooter: boolean
    // Banner angosto debajo del header (usa textoEnvio como contenido).
    mostrarBannerEnvio: boolean
    // Pedido explícito del dueño: el banner se desliza en loop (cartelera)
    // en vez de quedarse fijo centrado — con un ejemplo de otra tienda
    // (3X1 + ENVÍO GRATIS corriendo) como referencia.
    bannerDesplazable: boolean
    // Barra de estadísticas decorativas debajo del slider del hero.
    mostrarStats: boolean
    stats: StatItem[]
    textoEnvio:    string
    textoWhatsapp: string
}

// OJO con volver a poner texto de ejemplo en `nombreTienda`/`tagline`: estos
// dos son IDENTIDAD, no contenido de relleno. Estaban clavados en "Rama
// Indumentaria" (la tienda ficticia del mock) y, como Apariencia.tsx usa esto
// de fallback cuando el negocio todavía no guardó nada, al tocar "Guardar"
// quedaba persistido en `storefront_config.store_name` — o sea, toda tienda
// nueva terminaba llamándose "Rama Indumentaria" de verdad en la base, y eso
// era lo que veían sus clientes en el storefront. Vacío: Apariencia.tsx
// completa el nombre REAL del negocio (ver su useEffect de carga).
export const AP_DEFAULTS: Apariencia = {
    nombreTienda: '',
    tagline: '',
    logo: null, favicon: null,
    sliders: [
        { id: 's1', titulo: 'Camperas que\nabrigan con estilo',  subtitulo: 'Hasta 25% off en abrigos seleccionados.',         img: null, cta: 'Ver camperas',  ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgPatternScope: 'image', bgColor: '' },
        { id: 's2', titulo: 'Recién llegados,\nlistos para vos', subtitulo: 'Las últimas piezas de la temporada.',              img: null, cta: 'Ver novedades', ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgPatternScope: 'image', bgColor: '' },
        { id: 's3', titulo: 'Ofertas flash',                     subtitulo: 'Precios especiales por tiempo limitado.',          img: null, cta: 'Ver ofertas',   ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgPatternScope: 'image', bgColor: '' },
    ],
    colorPrimario: '#3B82F6', colorSecundario: '#0F172A', colorAccent: '#8B5CF6', colorFondo: '#F8FAFC', modoColor: 'claro',
    fuenteHeading: 'Geist', fuenteBody: 'Geist', escalaFuente: 'md',
    layoutHeader: 'full',
    // "Categorías" y "Novedades" se sacaron: no tenían una función real
    // distinta de "Catálogo" (las categorías ya se navegan con los chips del
    // catálogo, y no existe un concepto de "novedades" filtrable). "Ofertas"
    // y "Más vendidos" sí llevan a un filtro real del catálogo — ver
    // StorefrontHeader.tsx.
    headerLinks: [
        { id: 'catalogo',    label: 'Catálogo',     on: true  },
        { id: 'ofertas',     label: 'Ofertas',      on: true  },
        { id: 'masVendidos', label: 'Más vendidos', on: true  },
    ],
    layoutGrid: '4col', radioCards: 'md',
    mostrarResenas: true, mostrarBadgeNuevo: true, mostrarBadgeOferta: true, mostrarStockBajo: true,
    mostrarWhatsapp: true, mostrarBuscador: true, mostrarCategorias: true, mostrarFooter: true, mostrarRedesFooter: true,
    mostrarBannerEnvio: true, bannerDesplazable: false, mostrarStats: true,
    stats: [
        { id: 'st1', value: '+1.200',  label: 'ventas realizadas' },
        { id: 'st2', value: '48 hs',   label: 'envío al país' },
        { id: 'st3', value: '30 días', label: 'cambios gratis' },
        { id: 'st4', value: '3 cuotas', label: 'sin interés' },
    ],
    textoEnvio: 'Envíos coordinados por WhatsApp', textoWhatsapp: '💬 Escribinos',
}

export const PRESET_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#0F172A', '#6B7280']
export const RADII: Record<RadioCards, number> = { none: 0, sm: 6, md: 12, lg: 18 }

// ─── Google Fonts ─────────────────────────────────────────────────────────────
// Movido a src/lib/fonts.ts (2026-08-26) — lo necesita también el núcleo del
// storefront (_app.tsx, lib/storefront/forceSSR.ts) para aplicar la fuente
// elegida de verdad en la tienda real, no solo acá en el editor. Reexportado
// para no romper el resto de este módulo si algo más lo importa desde acá.
export { GOOGLE_FONTS, FONT_DESCRIPCIONES, loadFont, fontStack } from '@/lib/fonts'
