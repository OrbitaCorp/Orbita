// Mapea entre el estado local de Apariencia.tsx (nombres en español, calcado
// del diseño original) y el DTO real del backend (inglés, ver
// UpdateStorefrontConfigDto/StorefrontConfig en apps/api). `sliders`↔`heroSlides`
// y `headerLinks`↔`headerLinks` son passthrough directo (mismo shape); el resto
// es mapeo campo a campo, incluyendo las conversiones de escala/radio que ya
// existían como constantes locales (RADII).

import { RADII, type Apariencia as Ap, type EscalaFuente, type ModoColor, type RadioCards, type ImageStyle, type ImagePosition, type BgPattern } from './apariencia.mock'
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
        // Vacíos NO se mandan (el DTO del backend es @IsOptional() @IsString(),
        // no acepta null): así la columna queda sin valor y el storefront cae
        // al nombre real del negocio, en vez de quedar con el título en blanco.
        ...(ap.nombreTienda.trim() ? { storeName: ap.nombreTienda.trim() } : {}),
        ...(ap.tagline.trim() ? { tagline: ap.tagline.trim() } : {}),
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
        showSocialFooter: ap.mostrarRedesFooter,
        showAnnouncementBar: ap.mostrarBannerEnvio,
        showStatsBar: ap.mostrarStats,
        shippingText: ap.textoEnvio,
        whatsappText: ap.textoWhatsapp,
        statsBar: ap.stats,
    }
}

export function dtoToAp(dto: ApiAppearanceConfig, defaults: Ap): Ap {
    return {
        nombreTienda: dto.storeName ?? defaults.nombreTienda,
        tagline: dto.tagline ?? defaults.tagline,
        logo: dto.logoUrl,
        favicon: dto.faviconUrl,
        // heroSlides/headerLinks pueden llegar null (negocio que nunca los
        // guardó) en vez de un array vacío — la columna es un Json? nullable.
        // ctaLink/imageStyle/imagePosition/bgPattern/bgColor son opcionales en
        // el DTO (se agregaron después) — slides viejos pueden no tenerlos.
        sliders: dto.heroSlides && dto.heroSlides.length > 0
            ? dto.heroSlides.map(s => ({
                ...s,
                ctaLink: s.ctaLink ?? '',
                imageStyle: (s.imageStyle as ImageStyle) ?? 'full',
                imagePosition: (s.imagePosition as ImagePosition) ?? 'right',
                bgPattern: (s.bgPattern as BgPattern) ?? 'none',
                bgColor: s.bgColor ?? '',
            }))
            : defaults.sliders,
        colorPrimario: dto.colorPrimary ?? defaults.colorPrimario,
        colorSecundario: dto.colorSecondary ?? defaults.colorSecundario,
        colorAccent: dto.colorAccent ?? defaults.colorAccent,
        colorFondo: dto.colorBackground ?? defaults.colorFondo,
        modoColor: COLOR_MODE_A_MODO[dto.colorMode] ?? defaults.modoColor,
        fuenteHeading: dto.fontFamily ?? defaults.fuenteHeading,
        fuenteBody: dto.fontFamilyBody ?? defaults.fuenteBody,
        escalaFuente: fontScaleAEscala(dto.fontScale),
        layoutHeader: (dto.headerLayout as Ap['layoutHeader']) ?? defaults.layoutHeader,
        // Se filtran 'categorias'/'novedades' de datos ya guardados por
        // negocios existentes antes de esta limpieza — no tenían función real
        // (ver nota en AP_DEFAULTS.headerLinks).
        headerLinks: dto.headerLinks && dto.headerLinks.length > 0
            ? dto.headerLinks.filter(l => l.id !== 'categorias' && l.id !== 'novedades')
            : defaults.headerLinks,
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
        mostrarRedesFooter: dto.showSocialFooter,
        mostrarBannerEnvio: dto.showAnnouncementBar,
        mostrarStats: dto.showStatsBar,
        stats: dto.statsBar && dto.statsBar.length > 0 ? dto.statsBar : defaults.stats,
        textoEnvio: dto.shippingText ?? defaults.textoEnvio,
        textoWhatsapp: dto.whatsappText ?? defaults.textoWhatsapp,
    }
}
