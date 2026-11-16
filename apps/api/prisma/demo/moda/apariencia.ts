// ─── Apariencia de Nébula Moda: marca y home ────────────────────────────────
//
// Mismo criterio que la de Nébula Tech (../apariencia.ts): todo sale de
// Configuración → Apariencia (el home clásico), no de las plantillas
// avanzadas. `pnpm seed:demo -- --tienda moda --solo-apariencia` corre solo
// esto, para iterar el diseño sin resembrar todo.
//
// Logo: la misma N con chispa de Nébula Tech (media/moda/marca/logo.svg),
// sobre un degradé tierra en vez del violeta.
import type { PrismaClient } from '@prisma/client';
import { almacenamiento, idDemo } from '../sembrar';

// Paleta: casi negro cálido para lo que se clickea, terracota de la marca y
// arena de acento. Fondo hueso, como el papel de una revista.
const PRIMARIO = '#1C1412';
const TERRACOTA = '#B4532A';
const ARENA = '#E7B98A';
// Los ids de esta tienda llevan el prefijo de NEBULA_MODA (ver tienda.ts).
const id = (clave: string) => `moda:${clave}`;

// El primer anuncio del menú de la tienda (ANUNCIOS_DEMO_MODA en
// MenuDemoTienda.tsx): es el modal que queda cargado en el panel.
export const MODAL_MODA = {
  title: '2x1 en remeras básicas',
  message: 'Llevá dos remeras básicas y pagá una, en cualquier color y talle. El descuento se aplica solo en el carrito.',
  badge: '2x1',
  ctaText: 'Ver remeras',
  ctaLink: '/catalogo?cat=remeras-y-camisas',
};

export async function sembrarAparienciaModa(prisma: PrismaClient, businessId: string) {
  const negocio = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (!negocio.isDemo) throw new Error('sembrarAparienciaModa solo corre sobre un negocio demo (isDemo).');
  const subir = almacenamiento(businessId);
  const img = (archivo: string) => subir.imagen(archivo, 'business-logos');

  console.log('Apariencia: logo, slider, parallax y videos…');
  const [logoUrl, faviconUrl, slide1, slide2, slide3, parallax] = await Promise.all([
    img('moda/marca/logo-512.png'), img('moda/marca/favicon-64.png'),
    img('moda/home/slide-1.webp'), img('moda/home/slide-2.webp'), img('moda/home/slide-3.webp'),
    img('moda/home/fondo-con-efecto-parallax.webp'),
  ]);
  const [videoLookbook, posterLookbook, videoCalzado, posterCalzado] = await Promise.all([
    subir.video('moda/videos/home-lookbook.mp4'), subir.video('moda/videos/home-lookbook.webp'),
    subir.video('moda/videos/home-calzado.mp4'), subir.video('moda/videos/home-calzado.webp'),
  ]);

  const slide = (s: Record<string, string>) => ({
    imageStyle: 'full', imagePosition: 'right', imageOverlay: 'diagonal', bgPattern: 'none', bgPatternScope: 'image', bgColor: '', ...s,
  });
  const heroSlides = [
    slide({
      id: 'temporada', img: slide1,
      titulo: 'Nueva temporada,\nmismos básicos', subtitulo: 'Vestidos, camisas y remeras para vestirte fácil todos los días.',
      cta: 'Ver la colección', ctaLink: '/catalogo',
    }),
    // Foto vertical: va entera al costado, sobre el tono de la marca, en vez
    // de recortarla a lo ancho (mismo criterio que el slide de audio de Tech).
    slide({
      id: 'calzado', img: slide2, imageStyle: 'centered', imagePosition: 'right', bgColor: PRIMARIO, bgPattern: 'none',
      titulo: 'Semana del calzado:\n15 % off', subtitulo: 'Borcegos, botas, zapatillas y sandalias, con el descuento aplicado en el carrito.',
      cta: 'Ver calzado', ctaLink: '/catalogo/calzado',
    }),
    slide({
      id: 'abrigos', img: slide3, imageOverlay: 'marca',
      titulo: 'Capas para\nel frío', subtitulo: 'Camperas de jean, sweaters y buzos que combinan entre sí.',
      cta: 'Ver abrigos', ctaLink: '/catalogo/buzos-y-camperas',
    }),
  ];

  await prisma.storefrontConfig.update({
    where: { businessId },
    data: {
      storeName: 'Nébula Moda',
      tagline: 'Ropa, calzado y accesorios',
      logoUrl, faviconUrl,
      colorPrimary: PRIMARIO, colorSecondary: TERRACOTA, colorAccent: ARENA, colorBackground: '#FAF8F5', colorMode: 'light',
      fontFamily: 'Playfair Display', fontFamilyBody: 'Inter', fontScale: 1,
      headerLayout: 'full', gridLayout: '4col',
      headerLinks: [
        { id: 'catalogo', label: 'Catálogo', on: true },
        { id: 'ofertas', label: 'Ofertas', on: true },
        { id: 'masVendidos', label: 'Más vendidos', on: true },
      ],
      showAnnouncementBar: true, announcementScroll: true,
      // Todo lo que promete existe en la demo (ver moda/tienda.ts).
      shippingText: [
        'Envío gratis desde $250.000',
        '10 % off pagando con transferencia',
        'Semana del calzado: 15 % off en toda la categoría',
        '2x1 en remeras básicas',
        'Cupón BIENVENIDA10: 10 % en tu primera compra',
        'Cambios de talle dentro de los 30 días',
      ].join('\n'),
      heroSlides,
      showStatsBar: true,
      statsBar: [
        { id: 'st1', value: '+2.400', label: 'pedidos entregados' },
        { id: 'st2', value: '24 a 72 h', label: 'entrega en todo el país' },
        { id: 'st3', value: '10 % off', label: 'pagando con transferencia' },
        { id: 'st4', value: '30 días', label: 'para cambiar de talle' },
      ],
      // Mosaico: la primera va grande. Accesorios queda afuera (el mosaico admite 5).
      showCategoriesSection: true, categoryLayout: 'mosaico',
      categoryIds: ['abrigos', 'calzado', 'vestidos', 'remeras', 'pantalones'].map((c) => idDemo(id(`categoria:${c}`))),
      showFeaturedSection: true, showNewArrivalsSection: true, showRecommendedSection: true, showBestSellersSection: true,
      showRating: true, showNewBadge: true, showOfferBadge: true, showLowStock: true, showSearch: true,
      showParallaxBanner: true,
      parallaxImageUrl: parallax,
      parallaxTitle: 'Menos prendas, mejor elegidas',
      parallaxSubtitle: 'Armamos cada temporada con básicos que duran y combinan entre sí. Si no lo usaríamos, no lo vendemos.',
      parallaxCtaText: 'Ver catálogo', parallaxCtaLink: '/catalogo',
      showVideo: true, videoLayout: 'alternado',
      videoTitle: 'Así se ven puestas', videoSubtitle: 'Antes de elegir el talle, mirá cómo quedan de verdad.',
      videoUrl: videoLookbook, videoPosterUrl: posterLookbook,
      videos: [
        {
          id: 'lookbook', url: videoLookbook, posterUrl: posterLookbook,
          title: 'Lookbook de temporada', text: 'Sweaters, jeans y camperas que se combinan entre sí: cuatro looks con prendas de la tienda.',
          ctaText: 'Ver la campera de jean', ctaLink: `/producto/${idDemo(id('producto:campera-jean'))}`,
        },
        {
          id: 'calzado', url: videoCalzado, posterUrl: posterCalzado,
          title: 'Pisá firme', text: 'Borcegos de cuero, zapatillas de lona y sandalias para todo el año.',
          ctaText: 'Ver calzado', ctaLink: '/catalogo/calzado',
        },
      ],
      // Marcas inventadas, solo con el nombre (la tira dibuja el texto si no
      // hay logo): nombres de telas y tejidos, que no son marcas conocidas.
      showBrands: true,
      brandsTitle: 'Las marcas que elegimos',
      brands: ['Trama', 'Urdimbre', 'Lienzo & Co', 'Telar Sur', 'Hilván', 'Pespunte', 'Ovillo', 'Bastilla'].map((name, i) => ({ id: `marca-${i + 1}`, name })),
      showWhatsapp: false,
      showFooter: true, showSocialFooter: false,
      homeTemplate: null,
      homeTemplateData: { cupon: null, mostrarIconoLogo: false, secciones: {}, maxNuevosIngresos: 8 },
    },
  });
}
