// Mapea entre el estado local de Apariencia.tsx (nombres en español, calcado
// del diseño original) y el DTO real del backend (inglés, ver
// UpdateStorefrontConfigDto/StorefrontConfig en apps/api). `sliders`↔`heroSlides`
// y `headerLinks`↔`headerLinks` son passthrough directo (mismo shape); el resto
// es mapeo campo a campo, incluyendo las conversiones de escala/radio que ya
// existían como constantes locales (RADII).

import { RADII, type Apariencia as Ap, type EscalaFuente, type ModoColor, type RadioCards } from './apariencia.mock'
import type { ApiAppearanceConfig, UpdateAppearanceInput } from '@/lib/api'

const ESCALA_A_FONT_SCALE: Record<EscalaFuente, number> = { sm: 0.9, md: 1.0, lg: 1.15 }

function fontScaleAEscala(v: string | number | null): EscalaFuente {
    const n = v === null ? 1 : Number(v)
    let mejor: EscalaFuente = 'md'
    let dist = Infinity
    for (const [k, val] of Object.entries(ESCALA_A_FONT_SCALE) as [EscalaFuente, number][]) {
        const d = Math.abs(val - n)
        if (d < dist) { dist = d; mejor = k }
    }
    return mejor
}

function cardRadiusARadio(v: number | null): RadioCards {
    if (v === null) return 'md'
    let mejor: RadioCards = 'md'
    let dist = Infinity
    for (const [k, val] of Object.entries(RADII) as [RadioCards, number][]) {
        const d = Math.abs(val - v)
        if (d < dist) { dist = d; mejor = k }
    }
    return mejor
}

const MODO_A_COLOR_MODE: Record<ModoColor, 'light' | 'dark' | 'system'> = { claro: 'light', oscuro: 'dark', sistema: 'system' }
const COLOR_MODE_A_MODO: Record<'light' | 'dark' | 'system', ModoColor> = { light: 'claro', dark: 'oscuro', system: 'sistema' }

export function apToUpdateDto(ap: Ap): UpdateAppearanceInput {
    return {
        storeName: ap.nombreTienda,
        tagline: ap.tagline,
        logoUrl: ap.logo,
        faviconUrl: ap.favicon,
        colorPrimary: ap.colorPrimario,
        colorSecondary: ap.colorSecundario,
        colorAccent: ap.colorAccent,
        colorBackground: ap.colorFondo,
        colorMode: MODO_A_COLOR_MODE[ap.modoColor],
        fontFamily: ap.fuenteHeading,
        fontFamilyBody: ap.fuenteBody,
        fontScale: ESCALA_A_FONT_SCALE[ap.escalaFuente],
        headerLayout: ap.layoutHeader,
        gridLayout: ap.layoutGrid,
        cardRadius: RADII[ap.radioCards],
        heroSlides: ap.sliders,
        headerLinks: ap.headerLinks,
        showReviews: ap.mostrarResenas,
        showNewBadge: ap.mostrarBadgeNuevo,
        showOfferBadge: ap.mostrarBadgeOferta,
        showLowStock: ap.mostrarStockBajo,
        showWhatsapp: ap.mostrarWhatsapp,
        showSearch: ap.mostrarBuscador,
        showCategoriesSection: ap.mostrarCategorias,
        showFooter: ap.mostrarFooter,
        ctaText: ap.textoCTA,
        shippingText: ap.textoEnvio,
        whatsappText: ap.textoWhatsapp,
    }
}

export function dtoToAp(dto: ApiAppearanceConfig, defaults: Ap): Ap {
    return {
        nombreTienda: dto.storeName ?? defaults.nombreTienda,
        tagline: dto.tagline ?? defaults.tagline,
        logo: dto.logoUrl,
        favicon: dto.faviconUrl,
        sliders: dto.heroSlides.length > 0 ? dto.heroSlides : defaults.sliders,
        colorPrimario: dto.colorPrimary ?? defaults.colorPrimario,
        colorSecundario: dto.colorSecondary ?? defaults.colorSecundario,
        colorAccent: dto.colorAccent ?? defaults.colorAccent,
        colorFondo: dto.colorBackground ?? defaults.colorFondo,
        modoColor: COLOR_MODE_A_MODO[dto.colorMode] ?? defaults.modoColor,
        fuenteHeading: dto.fontFamily ?? defaults.fuenteHeading,
        fuenteBody: dto.fontFamilyBody ?? defaults.fuenteBody,
        escalaFuente: fontScaleAEscala(dto.fontScale),
        layoutHeader: (dto.headerLayout as Ap['layoutHeader']) ?? defaults.layoutHeader,
        headerLinks: dto.headerLinks.length > 0 ? dto.headerLinks : defaults.headerLinks,
        layoutGrid: (dto.gridLayout as Ap['layoutGrid']) ?? defaults.layoutGrid,
        radioCards: cardRadiusARadio(dto.cardRadius),
        mostrarResenas: dto.showReviews,
        mostrarBadgeNuevo: dto.showNewBadge,
        mostrarBadgeOferta: dto.showOfferBadge,
        mostrarStockBajo: dto.showLowStock,
        mostrarWhatsapp: dto.showWhatsapp,
        mostrarBuscador: dto.showSearch,
        mostrarCategorias: dto.showCategoriesSection,
        mostrarFooter: dto.showFooter,
        textoCTA: dto.ctaText ?? defaults.textoCTA,
        textoEnvio: dto.shippingText ?? defaults.textoEnvio,
        textoWhatsapp: dto.whatsappText ?? defaults.textoWhatsapp,
    }
}
