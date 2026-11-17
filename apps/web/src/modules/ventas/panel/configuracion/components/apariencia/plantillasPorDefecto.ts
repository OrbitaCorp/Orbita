// Las "plantillas por defecto" de Apariencia: combinaciones ya armadas de TODO
// lo que se puede elegir en esta pantalla, para no tener que personalizar
// control por control.
//
// No son las plantillas de Home del paquete Avanzado (esas son portadas con
// estructura propia, ver panel/avanzado/plantillas/). Una plantilla por
// defecto es un atajo: aplicarla escribe en el formulario los mismos campos
// que el dueño podría elegir uno por uno —paleta, modo claro u oscuro,
// tipografías y escala, header, estilo de la marca, diseño de cada slide del
// hero, grilla, categorías, anuncio, WhatsApp y video— y queda sin publicar
// hasta que toque "Guardar cambios". Por eso la puede usar cualquier plan.
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
//   · la imagen CENTRADA es para fotos sin fondo (PNG con transparencia): una
//     foto común queda como un rectángulo pegado sobre el color del slide. Por
//     eso una plantilla con hero centrado solo lo pone en los slides cuya foto
//     es transparente (o que no tienen foto); los que tienen una foto común
//     quedan a imagen completa, con el velo de la plantilla. Las fotos se
//     guardan como webp, así que no alcanza con la extensión: la
//     transparencia se mide en el navegador (ver transparencia.ts).
//   · con imagen centrada el texto del slide va siempre en blanco (ver
//     HeroCarousel en Inicio.tsx), así que el color de fondo del slide tiene
//     que ser oscuro.

import type { MarcaModo } from '@/components/storefront/marca'
import type {
    Apariencia, BgPattern, BgPatternScope, CategoryLayout, EscalaFuente, HeroSlide, ImageOverlay, ImagePosition,
    LayoutGrid, LayoutHeader, ModoColor, TextoHorizontal, TextoVertical, VideoLayout, WhatsappLayout,
} from '../../mock/apariencia.mock'

type Fondo = 'blanco' | 'gris' | 'tinte'

// El diseño de los slides del hero.
export interface HeroDePlantilla {
    // 'completa' = la foto ocupa todo el slide; 'centrada' = la foto (sin
    // fondo) al lado del texto, sobre un color con un patrón.
    formato: 'completa' | 'centrada'
    posicion: ImagePosition
    // Velo sobre la foto a imagen completa (también lo usan los slides de una
    // plantilla centrada que tienen una foto común).
    velo: ImageOverlay
    // Solo con imagen centrada.
    patron: BgPattern
    alcance: BgPatternScope
    // Color del slide con imagen centrada. Oscuro: el texto va en blanco.
    fondo: string
    // Dónde va el texto con la foto a imagen completa (también en los slides
    // de una plantilla centrada que tienen una foto común). Junto con el velo
    // es lo que hace que dos plantillas con la misma foto se vean distintas.
    textoH: TextoHorizontal
    textoV: TextoVertical
}

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
    hero: HeroDePlantilla
    layoutGrid: LayoutGrid
    estiloCategorias: Exclude<CategoryLayout, 'mosaico' | 'tarjetas'>
    bannerDesplazable: boolean
    estiloWhatsapp: WhatsappLayout
    videoLayout: VideoLayout
}

// Atajos para no repetir los campos que no usa cada formato.
// `texto` es [horizontal, vertical] del texto sobre la foto a imagen completa.
type Texto = [TextoHorizontal, TextoVertical]
const completa = (velo: ImageOverlay, [textoH, textoV]: Texto): HeroDePlantilla =>
    ({ formato: 'completa', posicion: 'right', velo, patron: 'none', alcance: 'image', fondo: '', textoH, textoV })
const centrada = (posicion: ImagePosition, patron: BgPattern, alcance: BgPatternScope, fondo: string, velo: ImageOverlay, [textoH, textoV]: Texto): HeroDePlantilla =>
    ({ formato: 'centrada', posicion, velo, patron, alcance, fondo, textoH, textoV })

export const PLANTILLAS_POR_DEFECTO: PlantillaPorDefecto[] = [
    {
        // Lo mismo que trae una tienda nueva (AP_DEFAULTS): la forma de volver
        // al punto de partida después de probar otras.
        id: 'clasica', nombre: 'Clásica', para: 'La de siempre, sirve para todo',
        colorPrimario: '#3B82F6', colorSecundario: '#0F172A', colorAccent: '#8B5CF6', fondo: 'gris', modoColor: 'claro',
        fuenteHeading: 'Geist', fuenteBody: 'Geist', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'normal', nombre: 'negrita' },
        hero: completa('tint', ['left', 'center']),
        layoutGrid: '4col', estiloCategorias: 'pills', bannerDesplazable: false, estiloWhatsapp: 'clasico', videoLayout: 'cine',
    },
    {
        id: 'boutique', nombre: 'Boutique', para: 'Ropa, accesorios y bijouterie',
        colorPrimario: '#1C1917', colorSecundario: '#1C1917', colorAccent: '#B45309', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'espaciado', logo: 'normal', nombre: 'espaciado' },
        hero: completa('bottom', ['center', 'bottom']),
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'alternado',
    },
    {
        id: 'urbana', nombre: 'Urbana', para: 'Streetwear, zapatillas y skate',
        colorPrimario: '#E11D48', colorSecundario: '#0A0A0A', colorAccent: '#FACC15', fondo: 'blanco', modoColor: 'oscuro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'espaciado', logo: 'normal', nombre: 'mayusculas' },
        hero: centrada('right', 'stripes', 'full', '#18181B', 'diagonal', ['left', 'bottom']),
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'reels',
    },
    {
        id: 'sastre', nombre: 'Sastre', para: 'Moda masculina, sastrería y calzado',
        colorPrimario: '#1E293B', colorSecundario: '#0F172A', colorAccent: '#B45309', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'minimal', marca: { ambos: 'espaciado', logo: 'normal', nombre: 'espaciado' },
        hero: completa('diagonal', ['right', 'center']),
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
    {
        id: 'belleza', nombre: 'Belleza', para: 'Peluquerías, uñas y maquillaje',
        colorPrimario: '#BE185D', colorSecundario: '#500724', colorAccent: '#D4A373', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'apilado', logo: 'redondo', nombre: 'italica' },
        hero: centrada('right', 'halo', 'image', '#831843', 'blanco', ['right', 'center']),
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'reels',
    },
    {
        id: 'joyas', nombre: 'Joyas', para: 'Joyería, relojería y regalos finos',
        colorPrimario: '#78350F', colorSecundario: '#1C1917', colorAccent: '#D4AF37', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'espaciado', logo: 'redondo', nombre: 'espaciado' },
        hero: centrada('center', 'halo', 'full', '#1C1917', 'radial', ['center', 'center']),
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
    {
        id: 'natural', nombre: 'Natural', para: 'Dietéticas y cosmética natural',
        colorPrimario: '#4D7C0F', colorSecundario: '#1A2E05', colorAccent: '#CA8A04', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'italica' },
        hero: centrada('left', 'waves', 'full', '#1A2E05', 'radial', ['left', 'top']),
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'bento', videoLayout: 'alternado',
    },
    {
        id: 'floreria', nombre: 'Florería', para: 'Florerías, viveros y regalos',
        colorPrimario: '#BE123C', colorSecundario: '#4C0519', colorAccent: '#65A30D', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'apilado', logo: 'redondo', nombre: 'italica' },
        hero: centrada('center', 'bubbles', 'full', '#881337', 'blanco', ['center', 'bottom']),
        layoutGrid: '3col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'reels',
    },
    {
        id: 'cafe', nombre: 'Café', para: 'Cafeterías, panaderías y pastelerías',
        colorPrimario: '#92400E', colorSecundario: '#292524', colorAccent: '#65A30D', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'italica' },
        hero: completa('tint', ['center', 'center']),
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'bento', videoLayout: 'alternado',
    },
    {
        id: 'almacen', nombre: 'Almacén', para: 'Comida, bebidas y productos regionales',
        colorPrimario: '#B91C1C', colorSecundario: '#451A03', colorAccent: '#CA8A04', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Playfair Display', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'lado', logo: 'normal', nombre: 'italica' },
        hero: centrada('right', 'dots', 'image', '#7F1D1D', 'diagonal', ['left', 'bottom']),
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'bento', videoLayout: 'alternado',
    },
    {
        id: 'artesanal', nombre: 'Artesanal', para: 'Productos hechos a mano y de autor',
        colorPrimario: '#9A3412', colorSecundario: '#431407', colorAccent: '#0F766E', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'italica' },
        hero: completa('radial', ['left', 'bottom']),
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'bento', videoLayout: 'alternado',
    },
    {
        id: 'vibrante', nombre: 'Vibrante', para: 'Regalería, jugueterías y librerías',
        colorPrimario: '#DB2777', colorSecundario: '#1E1B4B', colorAccent: '#F59E0B', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Poppins', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'mayusculas' },
        hero: centrada('right', 'confetti', 'full', '#1E1B4B', 'marca', ['left', 'center']),
        layoutGrid: '4col', estiloCategorias: 'pills', bannerDesplazable: true, estiloWhatsapp: 'clasico', videoLayout: 'reels',
    },
    {
        id: 'pastel', nombre: 'Pastel', para: 'Bebés, infancia y regalos',
        colorPrimario: '#7C3AED', colorSecundario: '#3B0764', colorAccent: '#F9A8D4', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Poppins', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'italica' },
        hero: centrada('center', 'bubbles', 'full', '#5B21B6', 'blanco', ['center', 'top']),
        layoutGrid: '4col', estiloCategorias: 'circulos', bannerDesplazable: false, estiloWhatsapp: 'clasico', videoLayout: 'reels',
    },
    {
        id: 'mascotas', nombre: 'Mascotas', para: 'Pet shops y veterinarias',
        colorPrimario: '#0D9488', colorSecundario: '#134E4A', colorAccent: '#F59E0B', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Poppins', fuenteBody: 'Poppins', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'redondo', logo: 'redondo', nombre: 'negrita' },
        hero: centrada('left', 'plus', 'full', '#115E59', 'tint', ['right', 'center']),
        layoutGrid: '4col', estiloCategorias: 'circulos', bannerDesplazable: true, estiloWhatsapp: 'clasico', videoLayout: 'reels',
    },
    {
        id: 'deportiva', nombre: 'Deportiva', para: 'Deportes, calzado y suplementos',
        colorPrimario: '#EA580C', colorSecundario: '#0C0A09', colorAccent: '#FACC15', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'lg',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'grande', nombre: 'mayusculas' },
        hero: completa('diagonal', ['left', 'bottom']),
        layoutGrid: '4col', estiloCategorias: 'circulos', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'reels',
    },
    {
        id: 'oceano', nombre: 'Océano', para: 'Turismo, playa y artículos náuticos',
        colorPrimario: '#0E7490', colorSecundario: '#083344', colorAccent: '#F97316', fondo: 'tinte', modoColor: 'claro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'normal', nombre: 'negrita' },
        hero: completa('bottom', ['center', 'bottom']),
        layoutGrid: '4col', estiloCategorias: 'circulos', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'alternado',
    },
    {
        id: 'salud', nombre: 'Salud', para: 'Farmacias, ortopedias y ópticas',
        colorPrimario: '#0284C7', colorSecundario: '#0C4A6E', colorAccent: '#10B981', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Inter', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'lado', logo: 'normal', nombre: 'negrita' },
        hero: centrada('right', 'rings', 'image', '#0C4A6E', 'bottom', ['left', 'bottom']),
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'bento', videoLayout: 'lista',
    },
    {
        id: 'hogar', nombre: 'Hogar', para: 'Electrodomésticos y bazar',
        colorPrimario: '#4F46E5', colorSecundario: '#1E1B4B', colorAccent: '#F97316', fondo: 'gris', modoColor: 'claro',
        fuenteHeading: 'Poppins', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'normal', nombre: 'negrita' },
        hero: centrada('right', 'grid', 'full', '#312E81', 'tint', ['right', 'center']),
        layoutGrid: '4col', estiloCategorias: 'pills', bannerDesplazable: true, estiloWhatsapp: 'clasico', videoLayout: 'lista',
    },
    {
        id: 'ferreteria', nombre: 'Ferretería', para: 'Ferreterías, repuestos y mayoristas',
        colorPrimario: '#1E3A8A', colorSecundario: '#0F172A', colorAccent: '#F59E0B', fondo: 'gris', modoColor: 'claro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'standard', marca: { ambos: 'lado', logo: 'grande', nombre: 'mayusculas' },
        hero: centrada('right', 'diagonal', 'full', '#1E3A8A', 'diagonal', ['left', 'center']),
        // En lista: un catálogo largo se recorre mejor de a filas.
        layoutGrid: 'list', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'bento', videoLayout: 'lista',
    },
    {
        id: 'galeria', nombre: 'Galería', para: 'Muebles, decoración y diseño',
        colorPrimario: '#44403C', colorSecundario: '#1C1917', colorAccent: '#A16207', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'minimal', marca: { ambos: 'espaciado', logo: 'grande', nombre: 'espaciado' },
        hero: centrada('left', 'arc', 'image', '#292524', 'bottom', ['right', 'bottom']),
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
    {
        id: 'sobria', nombre: 'Sobria', para: 'Minimalista, en blanco y negro',
        colorPrimario: '#0F172A', colorSecundario: '#0F172A', colorAccent: '#64748B', fondo: 'blanco', modoColor: 'claro',
        fuenteHeading: 'Inter', fuenteBody: 'Inter', escalaFuente: 'sm',
        layoutHeader: 'minimal', marca: { ambos: 'espaciado', logo: 'normal', nombre: 'espaciado' },
        hero: completa('top', ['left', 'top']),
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
    {
        id: 'tecno', nombre: 'Tecno', para: 'Electrónica y celulares',
        colorPrimario: '#0891B2', colorSecundario: '#0F172A', colorAccent: '#84CC16', fondo: 'gris', modoColor: 'oscuro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'minimal', marca: { ambos: 'lado', logo: 'normal', nombre: 'mayusculas' },
        hero: centrada('right', 'orbit', 'full', '#0F172A', 'bottom', ['center', 'bottom']),
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'lista',
    },
    {
        id: 'gamer', nombre: 'Gamer', para: 'Gaming, consolas y accesorios',
        colorPrimario: '#A21CAF', colorSecundario: '#0A0A0A', colorAccent: '#22D3EE', fondo: 'gris', modoColor: 'oscuro',
        fuenteHeading: 'Montserrat', fuenteBody: 'Inter', escalaFuente: 'md',
        layoutHeader: 'full', marca: { ambos: 'lado', logo: 'normal', nombre: 'mayusculas' },
        hero: centrada('right', 'sparkle', 'full', '#0A0A0A', 'diagonal', ['right', 'center']),
        layoutGrid: '4col', estiloCategorias: 'chips', bannerDesplazable: true, estiloWhatsapp: 'franja', videoLayout: 'reels',
    },
    {
        id: 'noche', nombre: 'Noche', para: 'Perfumería, vinos y regalos premium',
        colorPrimario: '#B8913A', colorSecundario: '#1C1917', colorAccent: '#E7E5E4', fondo: 'blanco', modoColor: 'oscuro',
        fuenteHeading: 'Cormorant Garamond', fuenteBody: 'Lato', escalaFuente: 'md',
        layoutHeader: 'centered', marca: { ambos: 'espaciado', logo: 'redondo', nombre: 'espaciado' },
        hero: completa('radial', ['center', 'center']),
        layoutGrid: '3col', estiloCategorias: 'indice', bannerDesplazable: false, estiloWhatsapp: 'minimal', videoLayout: 'cine',
    },
]

// El valor real del fondo, tal cual lo guarda FondoTiendaBlock.
export function fondoDe(p: PlantillaPorDefecto): string {
    if (p.fondo === 'blanco') return '#FFFFFF'
    if (p.fondo === 'gris') return '#F8FAFC'
    return p.colorPrimario + '0D'
}

// ¿Este slide puede ir con imagen centrada? Solo con una foto sin fondo (o sin
// foto: queda el texto sobre el color). `transparentes` son las fotos que el
// navegador ya midió (ver transparencia.ts).
export function admiteCentrada(s: HeroSlide, transparentes: ReadonlySet<string>): boolean {
    return !s.img || transparentes.has(s.img)
}

// El diseño que la plantilla le pone a un slide. Título, subtítulo, foto y
// botón quedan como estaban.
function slideCon(s: HeroSlide, h: HeroDePlantilla, transparentes: ReadonlySet<string>): HeroSlide {
    if (h.formato === 'centrada' && admiteCentrada(s, transparentes)) {
        return { ...s, imageStyle: 'centered', imagePosition: h.posicion, imageOverlay: h.velo, bgPattern: h.patron, bgPatternScope: h.alcance, bgColor: h.fondo, textAlign: h.textoH, textVertical: h.textoV }
    }
    return { ...s, imageStyle: 'full', imagePosition: h.posicion, imageOverlay: h.velo, bgPattern: 'none', bgPatternScope: 'image', bgColor: '', textAlign: h.textoH, textVertical: h.textoV }
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
// la regla de arriba). `maxNuevosIngresos` vuelve a automático si cambia la
// grilla: una cantidad elegida para 4 columnas deja filas incompletas en 3
// (ver OPCIONES_MAX_NUEVOS).
export function aplicarPlantilla(ap: Apariencia, p: PlantillaPorDefecto, transparentes: ReadonlySet<string> = new Set()): Apariencia {
    const cambiaGrilla = ap.layoutGrid !== p.layoutGrid
    return {
        ...ap,
        ...camposPlanos(p),
        marcaEstilo: p.marca[ap.marcaModo] ?? ap.marcaEstilo,
        sliders: ap.sliders.map(s => slideCon(s, p.hero, transparentes)),
        maxNuevosIngresos: cambiaGrilla ? null : ap.maxNuevosIngresos,
    }
}

const CAMPOS_DE_SLIDE = ['imageStyle', 'imagePosition', 'imageOverlay', 'bgPattern', 'bgPatternScope', 'bgColor', 'textAlign', 'textVertical'] as const

// La plantilla por defecto que coincide en todo con lo que hay en el
// formulario, si alguna coincide (para marcarla "En uso"). Los colores se
// comparan sin mayúsculas: el selector de color puede guardarlos en minúscula.
export function plantillaEnUso(ap: Apariencia, transparentes: ReadonlySet<string> = new Set()): string | null {
    const igual = (a: unknown, b: unknown) =>
        typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b
    for (const p of PLANTILLAS_POR_DEFECTO) {
        const c = camposPlanos(p)
        if (!(Object.keys(c) as (keyof typeof c)[]).every(k => igual(ap[k], c[k]))) continue
        if (ap.marcaEstilo !== p.marca[ap.marcaModo]) continue
        const esperado = ap.sliders.map(s => slideCon(s, p.hero, transparentes))
        if (esperado.every((e, i) => CAMPOS_DE_SLIDE.every(k => igual(e[k], ap.sliders[i][k])))) return p.id
    }
    return null
}
