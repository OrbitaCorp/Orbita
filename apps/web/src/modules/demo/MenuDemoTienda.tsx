// Menú flotante de la tienda demo (solo en el home de demo.orbita.site): deja
// abrir a mano cada juego con premio y cada anuncio, como los vería alguien
// que entra a la tienda por primera vez. En la demo no se abren solos al
// entrar (ver Inicio.tsx): el que recorre la demo decide qué probar. Es el
// mismo componente que usan las tiendas reales (MenuPromociones), con
// anuncios de muestra y otros textos.
import type { ActiveGame, ActivePromoModal } from '@/lib/storefront/api'
import { MenuPromociones } from '@/components/storefront/MenuPromociones'
import { DEMO_SLUG_MODA } from '@/lib/demo/modo'

// Anuncios de muestra. La tienda real tiene UN modal de anuncio a la vez (el
// primero de esta lista es el que está cargado en el panel de la demo); acá
// se ofrecen varios para mostrar los usos típicos. Los códigos y promos que
// nombran existen de verdad en la demo (apps/api/prisma/demo/).
export const ANUNCIOS_DEMO: ActivePromoModal[] = [
    {
        title: '2x1 en accesorios para el celu',
        badge: '2x1',
        message: 'Llevá dos fundas, cargadores o soportes para auto y pagá uno. El descuento se aplica solo en el carrito.',
        code: null,
        ctaText: 'Ver accesorios',
        ctaLink: '/catalogo?cat=celulares-y-accesorios',
        campaignVersion: 1,
    },
    {
        title: '15 % off en compras grandes',
        badge: '15 % OFF',
        message: 'En compras desde $150.000, usá este código en el checkout.',
        code: 'NEBULA15',
        ctaText: 'Empezar a comprar',
        ctaLink: '/catalogo',
        campaignVersion: 1,
    },
    {
        title: '3x2 en iluminación',
        badge: '3x2',
        message: 'Lámparas, tiras LED y enchufes inteligentes: llevá tres y pagá dos.',
        code: null,
        ctaText: 'Ver hogar inteligente',
        ctaLink: '/catalogo?cat=hogar-inteligente',
        campaignVersion: 1,
    },
    {
        title: 'Envío gratis a todo el país',
        badge: 'Envío gratis',
        message: 'En compras desde $250.000 el envío corre por nuestra cuenta, con Correo Argentino, Andreani u OCA.',
        code: null,
        ctaText: 'Ver catálogo',
        ctaLink: '/catalogo',
        campaignVersion: 1,
    },
]

// Los de Nébula Moda (la tienda de ropa, DEMO_SLUG_MODA). Mismo criterio: el
// primero es el modal cargado (MODAL_MODA en apps/api/prisma/demo/moda/apariencia.ts) y
// todo lo que nombran existe en esa tienda.
export const ANUNCIOS_DEMO_MODA: ActivePromoModal[] = [
    {
        title: '2x1 en remeras básicas',
        badge: '2x1',
        message: 'Llevá dos remeras básicas y pagá una, en cualquier color y talle. El descuento se aplica solo en el carrito.',
        code: null,
        ctaText: 'Ver remeras',
        ctaLink: '/catalogo?cat=remeras-y-camisas',
        campaignVersion: 1,
    },
    {
        title: '15 % off en compras grandes',
        badge: '15 % OFF',
        message: 'En compras desde $150.000, usá este código en el checkout.',
        code: 'MODA15',
        ctaText: 'Empezar a comprar',
        ctaLink: '/catalogo',
        campaignVersion: 1,
    },
    {
        title: '3x2 en gorros y bufandas',
        badge: '3x2',
        message: 'Gorros, bufandas y cuellos tejidos: llevá tres y pagá dos.',
        code: null,
        ctaText: 'Ver accesorios',
        ctaLink: '/catalogo?cat=accesorios',
        campaignVersion: 1,
    },
    {
        title: 'Envío gratis a todo el país',
        badge: 'Envío gratis',
        message: 'En compras desde $250.000 el envío corre por nuestra cuenta, con Correo Argentino, Andreani u OCA.',
        code: null,
        ctaText: 'Ver catálogo',
        ctaLink: '/catalogo',
        campaignVersion: 1,
    },
]

interface Props {
    slug: string
    juegos: ActiveGame[]
    onJugar: (juego: ActiveGame) => void
    onAnuncio: (anuncio: ActivePromoModal) => void
}

export function MenuDemoTienda({ slug, juegos, onJugar, onAnuncio }: Props) {
    return (
        <MenuPromociones
            juegos={juegos}
            anuncios={slug === DEMO_SLUG_MODA ? ANUNCIOS_DEMO_MODA : ANUNCIOS_DEMO}
            onJugar={onJugar}
            onAnuncio={onAnuncio}
            etiqueta="Juegos y anuncios"
            titulo="Probalos como cliente"
            subtitulo="Se abren como los vería alguien que entra a la tienda por primera vez."
            seccionAnuncios="Anuncios"
        />
    )
}
