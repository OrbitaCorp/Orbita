// A qué parte de la tienda corresponde cada cosa que se edita en Apariencia.
//
// La vista previa (StorePreview) lleva la mirada a esa parte cuando el dueño
// toca un campo o entra a una tarjeta — ver lib/storefront/previewFoco.ts, que
// es el lado de la tienda. Acá solo se decide el OBJETIVO; dónde está en la
// portada y cómo se marca lo resuelve la tienda.
//
// Dos caminos, los dos terminan en `pedirFoco`:
//   · por CAMPO: el que se acaba de cambiar (`set('logo', …)` → el header).
//     Es lo más preciso: "Identidad de marca" mezcla el logo (header) con los
//     sliders (hero), y cada uno lleva a lo suyo.
//   · por TARJETA: al entrar a una tarjeta, antes de tocar nada, se muestra su
//     parte principal. Una tarjeta con dos zonas las marca con `data-ap-foco`.

import type { ObjetivoPreview } from '@/lib/storefront/previewFoco'
import type { Apariencia as Ap } from '../../mock/apariencia.mock'

export type { ObjetivoPreview }

/** Lo que manda el índice de la izquierda al elegir una tarjeta (detail = su id). */
export const EVENTO_TARJETA = 'orbita:ap-tarjeta'

/** Un pedido de foco; `n` cambia en cada uno para poder repetir el mismo objetivo. */
export interface PedidoFoco { objetivo: ObjetivoPreview; n: number }

// Sin entrada = ese campo no se ve en la portada (p. ej. "Opiniones de
// clientes" vive en la ficha del producto, no en el inicio): no hay a dónde
// llevar la mirada y la previa se queda donde está.
export const FOCO_POR_CAMPO: Partial<Record<keyof Ap, ObjetivoPreview>> = {
    // Marca y header
    nombreTienda: 'header', logo: 'header', favicon: 'header', marcaModo: 'header', marcaEstilo: 'header',
    layoutHeader: 'header', headerLinks: 'header', mostrarBuscador: 'header', mostrarIconoLogo: 'header',
    // Hero
    sliders: 'hero',
    // Toda la tienda: se lleva a la parte más representativa, sin marco
    colorPrimario: 'inicio', colorSecundario: 'inicio', colorAccent: 'inicio', colorFondo: 'inicio', modoColor: 'inicio',
    fuenteHeading: 'inicio', fuenteBody: 'inicio', escalaFuente: 'inicio',
    // Filas de productos
    layoutGrid: 'estantes', maxNuevosIngresos: 'nuevos',
    mostrarBadgeNuevo: 'estantes', mostrarBadgeOferta: 'estantes', mostrarStockBajo: 'estantes',
    mostrarDestacados: 'destacados', mostrarNuevos: 'nuevos', mostrarRecomendados: 'recomendados', mostrarTopVentas: 'topventas',
    // Categorías
    mostrarCategorias: 'categorias', estiloCategorias: 'categorias', categoriasIds: 'categorias',
    // Anuncio y barra de estadísticas
    mostrarBannerEnvio: 'anuncio', textoEnvio: 'anuncio', bannerDesplazable: 'anuncio',
    mostrarStats: 'stats', stats: 'stats',
    // Parallax, marcas, video
    mostrarParallax: 'parallax', parallaxImagen: 'parallax', parallaxTitulo: 'parallax', parallaxSubtitulo: 'parallax', parallaxCtaTexto: 'parallax', parallaxCtaLink: 'parallax',
    mostrarMarcas: 'marcas', marcasTitulo: 'marcas', marcas: 'marcas',
    mostrarVideo: 'video', videoTitulo: 'video', videoSubtitulo: 'video', videoUrl: 'video', videoLayout: 'video', videos: 'video',
    // WhatsApp
    mostrarWhatsapp: 'whatsapp', estiloWhatsapp: 'whatsapp', textoWhatsapp: 'whatsapp',
    // Pie
    tagline: 'footer', mostrarFooter: 'footer', mostrarRedesFooter: 'footer',
}

// El objetivo principal de cada tarjeta (por el `id` de su SecCard). "¿Qué ven
// tus clientes?" no tiene uno: son interruptores de partes distintas, y cada
// uno lleva a lo suyo por campo.
export const FOCO_POR_TARJETA: Record<string, ObjetivoPreview> = {
    'ap-sec-identidad': 'header',
    'ap-sec-paleta': 'inicio',
    'ap-sec-tipografia': 'inicio',
    'ap-sec-layout': 'header',
    'ap-sec-parallax': 'parallax',
    'ap-sec-marcas': 'marcas',
    'ap-sec-video': 'video',
    'ap-sec-whatsapp': 'whatsapp',
    'ap-sec-textos': 'anuncio',
    'ap-sec-estadisticas': 'stats',
    'ap-sec-pie': 'footer',
}
