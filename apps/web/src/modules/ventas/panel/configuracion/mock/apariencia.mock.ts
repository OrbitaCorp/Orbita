// src/modules/ventas/panel/configuracion/mock/apariencia.mock.ts
// Estado de apariencia pública de la tienda + helpers de fuentes.
// TODO: persistir contra el backend cuando esté listo.

export type ModoColor    = 'claro' | 'oscuro' | 'sistema'
export type EscalaFuente = 'sm' | 'md' | 'lg'
export type LayoutHeader = 'standard' | 'full' | 'minimal' | 'centered'
export type LayoutGrid   = '3col' | '4col' | 'list'
export type RadioCards   = 'none' | 'sm' | 'md' | 'lg'

export interface HeroSlide {
    id:        string
    titulo:    string
    subtitulo: string
    img:       string | null
    cta:       string
    // A dónde lleva el botón del CTA — path interno ("/catalogo/camperas") o
    // URL externa. Vacío = fallback a "/catalogo".
    ctaLink:   string
}

export interface HeaderLink {
    id:    string
    label: string
    on:    boolean
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
    textoCTA:      string
    textoEnvio:    string
    textoWhatsapp: string
}

export const AP_DEFAULTS: Apariencia = {
    nombreTienda: 'Rama Indumentaria',
    tagline: 'Indumentaria contemporánea diseñada en Argentina.',
    logo: null, favicon: null,
    sliders: [
        { id: 's1', titulo: 'Camperas que\nabrigan con estilo',  subtitulo: 'Hasta 25% off en abrigos seleccionados.',         img: null, cta: 'Ver camperas',  ctaLink: '/catalogo' },
        { id: 's2', titulo: 'Recién llegados,\nlistos para vos', subtitulo: 'Las últimas piezas de la temporada.',              img: null, cta: 'Ver novedades', ctaLink: '/catalogo' },
        { id: 's3', titulo: 'Ofertas flash',                     subtitulo: 'Precios especiales por tiempo limitado.',          img: null, cta: 'Ver ofertas',   ctaLink: '/catalogo' },
    ],
    colorPrimario: '#3B82F6', colorSecundario: '#0F172A', colorAccent: '#8B5CF6', colorFondo: '#F8FAFC', modoColor: 'claro',
    fuenteHeading: 'Geist', fuenteBody: 'Geist', escalaFuente: 'md',
    layoutHeader: 'full',
    headerLinks: [
        { id: 'catalogo',    label: 'Catálogo',     on: true  },
        { id: 'categorias',  label: 'Categorías',   on: false },
        { id: 'ofertas',     label: 'Ofertas',      on: true  },
        { id: 'novedades',   label: 'Novedades',    on: true  },
        { id: 'masVendidos', label: 'Más vendidos', on: true  },
    ],
    layoutGrid: '4col', radioCards: 'md',
    mostrarResenas: true, mostrarBadgeNuevo: true, mostrarBadgeOferta: true, mostrarStockBajo: true,
    mostrarWhatsapp: true, mostrarBuscador: true, mostrarCategorias: true, mostrarFooter: true,
    textoCTA: 'Agregar al carrito', textoEnvio: 'Envíos coordinados por WhatsApp', textoWhatsapp: '💬 Escribinos',
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
