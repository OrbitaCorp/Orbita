// Los enlaces de la fila de navegación del header: qué se puede prender, qué
// está prendido y cuántos entran. Los usan la tarjeta "Header" del editor de
// plantilla y "Elementos del header" de "Diseño y layout".

import type { ApiCategory } from '@/lib/api'
import type { Apariencia as Ap, LayoutHeader } from '../../mock/apariencia.mock'
import type { SetAp } from './utils'

// Los enlaces de navegación que no dependen del catálogo del negocio. Mismos
// ids que ya entiende el storefront (ver PATH_POR_ID en StorefrontHeader).
const LINKS_FIJOS_HEADER = [
    { id: 'catalogo', label: 'Catálogo' },
    { id: 'ofertas', label: 'Ofertas' },
    { id: 'masVendidos', label: 'Más vendidos' },
]

// Cuántos enlaces caben en la fila de navegación sin apretarse, según el
// "Estilo de header". Completo y Estándar comparten la fila con logo, buscador
// y acciones (~650px libres a 1280px: 5 enlaces de ~100px); Centrado los pone
// en una fila propia, con todo el ancho; Minimal no muestra navegación. Los
// enlaces fijos también cuentan. Es un tope de la UI del panel (deshabilita
// los interruptores apagados al llegar), no un corte en la tienda: si algo
// se pasa igual, el nav scrollea horizontal como siempre.
const LIMITE_NAV_HEADER: Record<LayoutHeader, number> = { full: 5, standard: 5, centered: 8, minimal: 0 }

export function enlacesHeader(ap: Ap, categorias: ApiCategory[], set: SetAp) {
    // Lo que puede ir en la fila de nav: los tres enlaces fijos de siempre +
    // una entrada por categoría real. El `on` sale de lo ya guardado en
    // headerLinks; lo que nunca se tocó arranca apagado. Al togglear se
    // reescribe la lista COMPLETA, así queda normalizada y el storefront no
    // depende de que el negocio tenga entradas viejas o incompletas.
    const itemsHeader: { id: string; label: string; on: boolean; esCategoria: boolean }[] = [
        ...LINKS_FIJOS_HEADER.map(l => ({ ...l, esCategoria: false })),
        ...categorias.map(c => ({ id: `cat:${c.slug}`, label: c.name, esCategoria: true })),
    ].map(base => ({ ...base, on: ap.headerLinks.find(x => x.id === base.id)?.on ?? false }))

    // Guarda la lista completa normalizada, pero de las categorías solo las
    // ENCENDIDAS: el backend acota headerLinks a 30 entradas y un negocio con
    // muchas categorías las pasaría si se guardaran también las apagadas.
    // Lo apagado se reconstruye igual desde `categorias` (itemsHeader).
    function alternarLinkHeader(id: string, v: boolean) {
        set('headerLinks', itemsHeader
            .map(x => ({ id: x.id, label: x.label, on: x.id === id ? v : x.on }))
            .filter(x => !x.id.startsWith('cat:') || x.on))
    }
    const limiteNav = LIMITE_NAV_HEADER[ap.layoutHeader] ?? 5
    const linksActivos = itemsHeader.filter(x => x.on).length
    const enLimite = linksActivos >= limiteNav
    const categoriasHeader = itemsHeader.filter(x => x.esCategoria)

    return { itemsHeader, alternarLinkHeader, limiteNav, linksActivos, enLimite, categoriasHeader }
}

export type EnlacesHeader = ReturnType<typeof enlacesHeader>
