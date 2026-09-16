// Mapea entre el estado local de Apariencia.tsx (nombres en español, calcado
// del diseño original) y el DTO real del backend (inglés, ver
// UpdateStorefrontConfigDto/StorefrontConfig en apps/api). `sliders`↔`heroSlides`
// y `headerLinks`↔`headerLinks` son passthrough directo (mismo shape); el resto
// es mapeo campo a campo, incluyendo la conversión de escala (ESCALA_A_FONT_SCALE).
// "Radio de cards" (radioCards/RADII/cardRadius) se eliminó del todo (2026-09):
// no tenía ningún efecto real en la tienda — se guardaba pero ninguna página
// del storefront lo leía. El campo `cardRadius` sigue existiendo en el DTO
// del backend (columna ya escrita en negocios existentes, sin usarse) pero
// de acá en más no se lee ni se manda más.

import { type Apariencia as Ap, type EscalaFuente, type ModoColor, type ImageStyle, type ImagePosition, type ImageOverlay, type BgPattern, type BgPatternScope } from './apariencia.mock'
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
        categoryLayout: ap.estiloCategorias,
        categoryIds: ap.categoriasIds,
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
        announcementScroll: ap.bannerDesplazable,
        showStatsBar: ap.mostrarStats,
        showParallaxBanner: ap.mostrarParallax,
        shippingText: ap.textoEnvio,
        whatsappText: ap.textoWhatsapp,
        statsBar: ap.stats,
        parallaxImageUrl: ap.parallaxImagen,
        parallaxTitle: ap.parallaxTitulo,
        parallaxSubtitle: ap.parallaxSubtitulo,
        parallaxCtaText: ap.parallaxCtaTexto,
        parallaxCtaLink: ap.parallaxCtaLink,
        showBrands: ap.mostrarMarcas,
        brandsTitle: ap.marcasTitulo,
        // El DTO pide `logoUrl` string (o ausente), no null: una marca sin
        // logo viaja sin la clave. Y las que quedaron sin nombre se filtran
        // acá — una fila vacía en el panel no tiene por qué llegar a la
        // tienda como un hueco en la tira.
        brands: ap.marcas
            .filter(m => m.name.trim() !== '')
            .map(m => ({ id: m.id, name: m.name.trim(), ...(m.logo ? { logoUrl: m.logo } : {}) })),
        showVideo: ap.mostrarVideo,
        videoTitle: ap.videoTitulo,
        videoSubtitle: ap.videoSubtitulo,
        videoUrl: ap.videoUrl,
        videoPosterUrl: ap.videoPoster,
        // Sin código no hay cupón: se manda null y la sección desaparece del
        // home. Así vaciar el campo en el panel ALCANZA para sacarla — si en
        // vez de eso se mandara el objeto con strings vacíos, el home
        // dibujaría el bloque oscuro con la caja punteada en blanco.
        homeTemplateData: {
            ...(ap.cupon.codigo.trim()
                ? { cupon: { titulo: ap.cupon.titulo.trim(), bajada: ap.cupon.bajada.trim(), codigo: ap.cupon.codigo.trim() } }
                : { cupon: null }),
            mostrarIconoLogo: ap.mostrarIconoLogo,
            // Solo lo que tenga algo escrito: un campo vacío no se guarda, así
            // el home vuelve a caer al texto con el que se diseñó la sección
            // (ver el helper `txt()` en homes.tsx) en vez de dibujar un hueco.
            secciones: limpiarSecciones(ap.seccionesPlantilla),
        },
    }
}

function limpiarSecciones(secciones: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
    const salida: Record<string, Record<string, string>> = {}
    for (const [seccion, campos] of Object.entries(secciones ?? {})) {
        const conValor = Object.entries(campos ?? {}).filter(([, v]) => typeof v === 'string' && v.trim())
        if (conValor.length > 0) salida[seccion] = Object.fromEntries(conValor.map(([k, v]) => [k, v.trim()]))
    }
    return salida
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
                // 'tint' = comportamiento de siempre (tinte oscuro + puntos)
                // — así un slide guardado antes de que existiera este campo
                // no cambia de diseño solo por abrir Apariencia de nuevo.
                imageOverlay: (s.imageOverlay as ImageOverlay) ?? 'tint',
                bgPattern: (s.bgPattern as BgPattern) ?? 'none',
                bgPatternScope: (s.bgPatternScope as BgPatternScope) ?? 'image',
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
        mostrarResenas: dto.showReviews,
        mostrarBadgeNuevo: dto.showNewBadge,
        mostrarBadgeOferta: dto.showOfferBadge,
        mostrarStockBajo: dto.showLowStock,
        mostrarWhatsapp: dto.showWhatsapp,
        mostrarBuscador: dto.showSearch,
        mostrarCategorias: dto.showCategoriesSection,
        // null en la base (negocio que nunca tocó la opción) = 'pills', que es
        // exactamente lo que venía viendo — ver AP_DEFAULTS.
        estiloCategorias: (dto.categoryLayout as Ap['estiloCategorias']) ?? defaults.estiloCategorias,
        categoriasIds: dto.categoryIds ?? [],
        mostrarFooter: dto.showFooter,
        mostrarRedesFooter: dto.showSocialFooter,
        mostrarBannerEnvio: dto.showAnnouncementBar,
        bannerDesplazable: dto.announcementScroll,
        mostrarStats: dto.showStatsBar,
        mostrarParallax: dto.showParallaxBanner,
        stats: dto.statsBar && dto.statsBar.length > 0 ? dto.statsBar : defaults.stats,
        textoEnvio: dto.shippingText ?? defaults.textoEnvio,
        textoWhatsapp: dto.whatsappText ?? defaults.textoWhatsapp,
        parallaxImagen: dto.parallaxImageUrl,
        parallaxTitulo: dto.parallaxTitle ?? defaults.parallaxTitulo,
        parallaxSubtitulo: dto.parallaxSubtitle ?? defaults.parallaxSubtitulo,
        parallaxCtaTexto: dto.parallaxCtaText ?? defaults.parallaxCtaTexto,
        parallaxCtaLink: dto.parallaxCtaLink ?? defaults.parallaxCtaLink,
        // ?? y no `dto.showBrands` pelado (a diferencia de los toggles
        // viejos): entre el deploy del frontend en Vercel y el de la API a
        // mano en Cloud Run hay unos minutos donde la API todavía no manda
        // este campo. Sin el default, el toggle se dibujaría con `undefined`.
        mostrarMarcas: dto.showBrands ?? defaults.mostrarMarcas,
        marcasTitulo: dto.brandsTitle ?? defaults.marcasTitulo,
        // Sin ?? defaults acá (a diferencia de `stats`): el default es [], y
        // una tienda que borró todas sus marcas tiene que quedar en cero, no
        // recuperar nada. `logo` vuelve a null si no vino.
        marcas: (dto.brands ?? []).map(b => ({ id: b.id, name: b.name, logo: b.logoUrl || null })),
        // Mismo ?? que showBrands: campo nuevo, misma ventana de deploy.
        mostrarVideo: dto.showVideo ?? defaults.mostrarVideo,
        videoTitulo: dto.videoTitle ?? defaults.videoTitulo,
        videoSubtitulo: dto.videoSubtitle ?? defaults.videoSubtitulo,
        videoUrl: dto.videoUrl ?? defaults.videoUrl,
        videoPoster: dto.videoPosterUrl ?? defaults.videoPoster,
        cupon: dto.homeTemplateData?.cupon ?? defaults.cupon,
        mostrarIconoLogo: dto.homeTemplateData?.mostrarIconoLogo ?? defaults.mostrarIconoLogo,
        seccionesPlantilla: dto.homeTemplateData?.secciones ?? defaults.seccionesPlantilla,
    }
}
