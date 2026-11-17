// Las "plantillas por defecto" de Apariencia: combinaciones ya armadas de TODO
// lo que se puede elegir en esta pantalla, para no tener que personalizar
// control por control.
//
// No son las plantillas de Home del paquete Avanzado (esas son portadas con
// estructura propia, ver panel/avanzado/plantillas/). Una plantilla por
// defecto es un atajo: aplicarla escribe en el formulario los mismos campos
// que el dueño podría elegir uno por uno —paleta, modo claro u oscuro,
// tipografías y escala, header, estilo de la marca, diseño del hero, grilla,
// categorías, anuncio, WhatsApp y video— y queda sin publicar hasta que toque
// "Guardar cambios". Por eso la puede usar cualquier plan.
//
// Regla: cambia CÓMO se ve la tienda, nunca lo que dice ni lo que muestra. No
// toca textos, fotos, logo, enlaces del header ni los interruptores de "¿Qué
// ven tus clientes?". Si tocara algo de eso, probar una le borraría o le
// escondería al dueño contenido que ya cargó.
//
// Límites que vienen de los controles de siempre:
//   · el fondo solo puede ser uno de los tres de FondoTiendaBlock (blanco,
//     gris suave o el primario al 5%): son los únicos que se sabe que no
//     rompen contraste, y el selector no sabría mostrar otro;
//   · el estilo de categorías no puede ser uno que necesite foto (mosaico,
//     tarjetas): en una tienda sin fotos de categoría quedaría una sección rota
//     (ver CATEGORY_LAYOUTS);
//   · la marca no cambia de MODO (logo y nombre / solo logo / solo nombre):
//     eso depende de si el dueño subió un logo. Solo cambia el estilo dentro
//     del modo que ya tiene (ver MARCA_ESTILOS);
//   · del hero solo cambia el diseño de cada slide (velo sobre la foto,
//     patrón de fondo y su alcance), no el formato de la imagen ni su
//     posición: eso depende de cómo es cada foto.

import type { MarcaModo } from '@/components/storefront/marca'
import type {
    Apariencia, BgPattern, BgPatternScope, CategoryLayout, EscalaFuente, HeroSlide, ImageOverlay,
    LayoutGrid, LayoutHeader, ModoColor, VideoLayout, WhatsappLayout,
} from '../../mock/apariencia.mock'

type Fondo = 'blanco' | 'gris' | 'tinte'

export interface PlantillaPorDefecto {
    id: string
    nombre: string
    // Para qué tipo de tienda queda bien, en pocas palabras.
    para: string
    colorPrimario: string
    // En modo claro es el color del TEXTO de la tienda (ver previewBridge.ts):
    // tiene que ser oscuro siempre.
    colorSecundario: string
    colorAccent: string
    fondo: Fondo
    modoColor: ModoColor
    fuenteHeading: string
    fuenteBody: string
    escalaFuente: EscalaFuente
    layoutHeader: LayoutHeader
    // Un estilo por cada modo de marca (ver MARCA_ESTILOS en marca.tsx).
    marca: Record<MarcaModo, string>
    heroVelo: ImageOverlay
    heroPatron: BgPattern
    heroPatronAlcance: BgPatternScope
    layoutGrid: LayoutGrid
    estiloCategorias: Exclude<CategoryLayout, 'mosaico' | 'tarjetas'>
    bannerDesplazable: boolean
    estiloWhatsapp: WhatsappLayout
    videoLayout: VideoLayout
}

export const PLANTILLAS_POR_DEFECTO: PlantillaPorDefecto[] = [
    {
        // Lo mismo que trae una tienda nueva (AP_DEFAULTS): la forma de volver
        // al punto de partida después de probar otras.
        id: 'clasica', nombre: 'Clásica', para: 'La de siempre, sirve para todo',
        colorPrimario: '#3B82F6', colorSecundario: '#0F172A', colorAccent: '#8B5CF6', fondo: 'gris', modoColor: 'claro',
        fuenteHeading: 'Geist', fuenteBody: 'Geist', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'normal', nombre: 'negrita' },
        heroVelo: 'tint', heroPatron: 'none', heroPatronAlcance: 'image',
        layoutGrid: '4col', estiloCategorias: 'pills', bannerDesplazable: false, estiloWhatsapp: 'clasico', videoLayout: 'cine',
    },
    {
        id: 'boutique', nombre: 'Boutique', para: 'Ropa, accesorios y joyería',
        colorPrimario: '#1C1917', colorSecundario: '#1C1917', colorAccent: '#B45309', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'espaciado', logo: 'normal', nombre: 'espaciado' },
        heroVelo: 'bottom', heroPatron: 'none', heroPatronAlcance: 'image',
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'alternado',
    },
    {
        id: 'urbana', nombre: 'Urbana', para: 'Streetwear, zapatillas y skate',
        colorPrimario: '#E11D48', colorSecundario: '#0A0A0A', colorAccent: '#FACC15', fondo: 'blanco', modoColor: 'oscuro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'espaciado', logo: 'normal', nombre: 'mayusculas' },
        heroVelo: 'diagonal', heroPatron: 'stripes', heroPatronAlcance: 'full',
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'reels',
    },
    {
        id: 'belleza', nombre: 'Belleza', para: 'Peluquerías, uñas y maquillaje',
        colorPrimario: '#BE185D', colorSecundario: '#500724', colorAccent: '#D4A373', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'apilado', logo: 'redondo', nombre: 'italica' },
        heroVelo: 'blanco', heroPatron: 'halo', heroPatronAlcance: 'image',
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'reels',
    },
    {
        id: 'natural', nombre: 'Natural', para: 'Dietéticas, plantas y cosmética natural',
        colorPrimario: '#4D7C0F', colorSecundario: '#1A2E05', colorAccent: '#CA8A04', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'italica' },
        heroVelo: 'radial', heroPatron: 'waves', heroPatronAlcance: 'full',
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'bento', videoLayout: 'alternado',
    },
    {
        id: 'cafe', nombre: 'Café', para: 'Cafeterías, panaderías y pastelerías',
        colorPrimario: '#92400E', colorSecundario: '#292524', colorAccent: '#65A30D', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'italica' },
        heroVelo: 'tint', heroPatron: 'plus', heroPatronAlcance: 'full',
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'bento', videoLayout: 'alternado',
    },
    {
        id: 'almacen', nombre: 'Almacén', para: 'Comida, bebidas y productos regionales',
        colorPrimario: '#B91C1C', colorSecundario: '#451A03', colorAccent: '#CA8A04', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'lado', logo: 'normal', nombre: 'italica' },
        heroVelo: 'diagonal', heroPatron: 'dots', heroPatronAlcance: 'image',
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'bento', videoLayout: 'alternado',
    },
    {
        id: 'vibrante', nombre: 'Vibrante', para: 'Regalería, jugueterías y librerías',
        colorPrimario: '#DB2777', colorSecundario: '#1E1B4B', colorAccent: '#F59E0B', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Poppins', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'mayusculas' },
        heroVelo: 'marca', heroPatron: 'confetti', heroPatronAlcance: 'full',
        layoutGrid: '4col', estiloCategorias: 'pills', bannerDesplazable: true, estiloWhatsapp: 'clasico', videoLayout: 'reels',
    },
    {
        id: 'pastel', nombre: 'Pastel', para: 'Bebés, infancia y regalos',
        colorPrimario: '#7C3AED', colorSecundario: '#3B0764', colorAccent: '#F9A8D4', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Poppins', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'italica' },
        heroVelo: 'blanco', heroPatron: 'bubbles', heroPatronAlcance: 'full',
        layoutGrid: '4col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'clasico', videoLayout: 'reels',
    },
    {
        id: 'deportiva', nombre: 'Deportiva', para: 'Deportes, calzado y suplementos',
        colorPrimario: '#EA580C', colorSecundario: '#0C0A09', colorAccent: '#FACC15', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'lg',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'grande', nombre: 'mayusculas' },
        heroVelo: 'diagonal', heroPatron: 'stripes', heroPatronAlcance: 'full',
        layoutGrid: '4col', estiloCategorias: 'circulos', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'reels',
    },
    {
        id: 'oceano', nombre: 'Océano', para: 'Turismo, playa y artículos náuticos',
        colorPrimario: '#0E7490', colorSecundario: '#083344', colorAccent: '#F97316', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'normal', nombre: 'negrita' },
        heroVelo: 'bottom', heroPatron: 'waves', heroPatronAlcance: 'full',
        layoutGrid: '4col', estiloCategorias: 'circulos', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'alternado',
    },
    {
        id: 'ferreteria', nombre: 'Ferretería', para: 'Ferreterías, repuestos y mayoristas',
        colorPrimario: '#1E3A8A', colorSecundario: '#0F172A', colorAccent: '#F59E0B', fondo: 'gris', modoColor: 'claro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'lado', logo: 'grande', nombre: 'mayusculas' },
        heroVelo: 'diagonal', heroPatron: 'grid', heroPatronAlcance: 'image',
        // En lista: un catálogo largo se recorre mejor de a filas.
        layoutGrid: 'list', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'bento', videoLayout: 'lista',
    },
    {
        id: 'galeria', nombre: 'Galería', para: 'Muebles, decoración y diseño',
        colorPrimario: '#44403C', colorSecundario: '#1C1917', colorAccent: '#A16207', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'minimal', marca: { ambos: 'espaciado', logo: 'grande', nombre: 'espaciado' },
        heroVelo: 'none', heroPatron: 'arc', heroPatronAlcance: 'image',
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
    {
        id: 'sobria', nombre: 'Sobria', para: 'Minimalista, en blanco y negro',
        colorPrimario: '#0F172A', colorSecundario: '#0F172A', colorAccent: '#64748B', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Inter', fuenteBody: 'Inter', escalaFuente: 'sm',
        layoutHeader: 'minimal', marca: { ambos: 'espaciado', logo: 'normal', nombre: 'espaciado' },
        heroVelo: 'none', heroPatron: 'none', heroPatronAlcance: 'image',
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
    {
        id: 'tecno', nombre: 'Tecno', para: 'Electrónica, celulares y gamers',
        colorPrimario: '#0891B2', colorSecundario: '#0F172A', colorAccent: '#84CC16', fondo: 'gris', modoColor: 'oscuro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'minimal', marca: { ambos: 'lado', logo: 'normal', nombre: 'mayusculas' },
        heroVelo: 'bottom', heroPatron: 'grid', heroPatronAlcance: 'full',
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'lista',
    },
    {
        id: 'noche', nombre: 'Noche', para: 'Perfumería, vinos y regalos premium',
        colorPrimario: '#B8913A', colorSecundario: '#1C1917', colorAccent: '#E7E5E4', fondo: 'blanco', modoColor: 'oscuro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'espaciado', logo: 'redondo', nombre: 'espaciado' },
        heroVelo: 'radial', heroPatron: 'sparkle', heroPatronAlcance: 'image',
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
]

// El valor real del fondo, tal cual lo guarda FondoTiendaBlock.
export function fondoDe(p: PlantillaPorDefecto): string {
    if (p.fondo === 'blanco') return '#FFFFFF'
    if (p.fondo === 'gris') return '#F8FAFC'
    return p.colorPrimario + '0D'
}

// El diseño que la plantilla le pone a un slide del hero. Solo el velo, el
// patrón y su alcance; el color propio vuelve al degradé del tema, que ya sale
// de los colores de la plantilla. Título, foto, botón, formato y posición
// quedan como estaban.
function slideCon(s: HeroSlide, p: PlantillaPorDefecto): HeroSlide {
    return { ...s, imageOverlay: p.heroVelo, bgPattern: p.heroPatron, bgPatternScope: p.heroPatronAlcance, bgColor: '' }
}

// Los campos sueltos que escribe la plantilla (todo menos marca y slides, que
// dependen de lo que el dueño ya tiene).
function camposPlanos(p: PlantillaPorDefecto) {
    return {
        colorPrimario: p.colorPrimario,
        colorSecundario: p.colorSecundario,
        colorAccent: p.colorAccent,
        colorFondo: fondoDe(p),
        modoColor: p.modoColor,
        fuenteHeading: p.fuenteHeading,
        fuenteBody: p.fuenteBody,
        escalaFuente: p.escalaFuente,
        layoutHeader: p.layoutHeader,
        layoutGrid: p.layoutGrid,
        estiloCategorias: p.estiloCategorias,
        bannerDesplazable: p.bannerDesplazable,
        estiloWhatsapp: p.estiloWhatsapp,
        videoLayout: p.videoLayout,
    } satisfies Partial<Apariencia>
}

// El formulario con la plantilla aplicada — y SOLO con lo suyo cambiado (ver
// la regla de arriba). `maxNuevosIngresos` vuelve a automático: una cantidad
// elegida para 4 columnas deja filas incompletas en 3 (ver OPCIONES_MAX_NUEVOS).
export function aplicarPlantilla(ap: Apariencia, p: PlantillaPorDefecto): Apariencia {
    const cambiaGrilla = ap.layoutGrid !== p.layoutGrid
    return {
        ...ap,
        ...camposPlanos(p),
        marcaEstilo: p.marca[ap.marcaModo] ?? ap.marcaEstilo,
        sliders: ap.sliders.map(s => slideCon(s, p)),
        maxNuevosIngresos: cambiaGrilla ? null : ap.maxNuevosIngresos,
    }
}

// La plantilla por defecto que coincide en todo con lo que hay en el
// formulario, si alguna coincide (para marcarla "En uso"). Los colores se
// comparan sin mayúsculas: el selector de color puede guardarlos en minúscula.
export function plantillaEnUso(ap: Apariencia): string | null {
    const igual = (a: unknown, b: unknown) =>
        typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b
    for (const p of PLANTILLAS_POR_DEFECTO) {
        const c = camposPlanos(p)
        const planos = (Object.keys(c) as (keyof typeof c)[]).every(k => igual(ap[k], c[k]))
        const marca = ap.marcaEstilo === p.marca[ap.marcaModo]
        const hero = ap.sliders.every(s => s.imageOverlay === p.heroVelo && s.bgPattern === p.heroPatron && s.bgPatternScope === p.heroPatronAlcance && s.bgColor === '')
        if (planos && marca && hero) return p.id
    }
    return null
}
