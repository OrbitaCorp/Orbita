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
export type BgPattern     = 'none' | 'rings' | 'dots' | 'waves' | 'diagonal'

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
    // Color de fondo propio del slide en modo 'centered'. '' = usa el
    // degradé del tema (colorPrimario/colorSecundario) como hasta ahora.
    bgColor:       string
}

export const BG_PATTERNS: { id: BgPattern; label: string }[] = [
    { id: 'none',     label: 'Ninguno' },
    { id: 'rings',    label: 'Anillos' },
    { id: 'dots',     label: 'Puntos' },
    { id: 'waves',    label: 'Manchas' },
    { id: 'diagonal', label: 'Diagonal' },
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
    // Barra de estadísticas decorativas debajo del slider del hero.
    mostrarStats: boolean
    stats: StatItem[]
    textoEnvio:    string
    textoWhatsapp: string
}

export const AP_DEFAULTS: Apariencia = {
    nombreTienda: 'Rama Indumentaria',
    tagline: 'Indumentaria contemporánea diseñada en Argentina.',
    logo: null, favicon: null,
    sliders: [
        { id: 's1', titulo: 'Camperas que\nabrigan con estilo',  subtitulo: 'Hasta 25% off en abrigos seleccionados.',         img: null, cta: 'Ver camperas',  ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgColor: '' },
        { id: 's2', titulo: 'Recién llegados,\nlistos para vos', subtitulo: 'Las últimas piezas de la temporada.',              img: null, cta: 'Ver novedades', ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgColor: '' },
        { id: 's3', titulo: 'Ofertas flash',                     subtitulo: 'Precios especiales por tiempo limitado.',          img: null, cta: 'Ver ofertas',   ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgColor: '' },
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
    mostrarBannerEnvio: true, mostrarStats: true,
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

export const GOOGLE_FONTS: Record<string, string> = {
    'Geist': 'Geist',
    'Inter': 'Inter',
    'Playfair Display': 'Playfair+Display:wght@400;600;800',
    'Poppins': 'Poppins:wght@400;600;700',
    'Montserrat': 'Montserrat:wght@400;600;800',
    'Lato': 'Lato:wght@400;700',
}

export const FONT_DESCRIPCIONES: Record<string, string> = {
    'Geist': 'Moderna, sin serifa',
    'Inter': 'Neutra, profesional',
    'Playfair Display': 'Elegante, con serifa',
    'Poppins': 'Amigable, redondeada',
    'Montserrat': 'Bold, impactante',
    'Lato': 'Ligera, legible',
}

// Inyecta el <link> de Google Fonts una sola vez por fuente.
export function loadFont(name: string) {
    if (name === 'Geist' || typeof document === 'undefined') return
    const id = 'gf-' + name.replace(/\W/g, '')
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[name]}&display=swap`
    document.head.appendChild(link)
}

export function fontStack(name: string): string {
    if (name === 'Geist') return '"Geist", Inter, sans-serif'
    if (name === 'Playfair Display') return '"Playfair Display", Georgia, serif'
    return `"${name}", "Geist", sans-serif`
}
