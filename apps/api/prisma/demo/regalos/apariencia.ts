// ─── Apariencia de Nébula Regalos: plantilla Confeti ────────────────────────
//
// A diferencia de Nébula Tech y Nébula Moda (home clásico de Apariencia), esta
// tienda usa una plantilla del paquete Avanzado: Confeti (ver
// apps/web/src/modules/ventas/panel/avanzado/plantillas/datos.tsx). Así la
// demo muestra también las plantillas, que es lo que se vende como extra.
//
// El contrato es el mismo que guarda el panel (Avanzado → Plantillas de Home):
//   - `homeTemplate: 'confeti'` elige el diseño (colores, tipografía, bloques).
//   - El contenido sigue siendo el de Apariencia: sliders, anuncio, parallax,
//     marcas, video, estadísticas y los interruptores de cada estante.
//   - Los bloques propios de la receta (la franja apilada y el banner de
//     campaña) y los encabezados de las filas van en
//     `homeTemplateData.secciones[idSeccion][idCampo]` (ids de
//     esquemaDeReceta() en secciones.ts).
// Con la plantilla activa, la paleta y las fuentes de Apariencia no se usan
// (las fija la plantilla); se cargan igual con los colores de Confeti para
// que el panel de Apariencia no muestre otros.
//
// `pnpm seed:demo -- --tienda regalos --solo-apariencia` corre solo esto.
import type { PrismaClient } from '@prisma/client';
import { almacenamiento, idDemo } from '../sembrar';

// Los ids de esta tienda llevan el prefijo de NEBULA_REGALOS (ver tienda.ts).
const id = (clave: string) => idDemo(`regalos:${clave}`);

// El primer anuncio del menú de la tienda (ANUNCIOS_DEMO_REGALOS en
// MenuDemoTienda.tsx): es el modal que queda cargado en el panel.
export const MODAL_REGALOS = {
  title: '2x1 en tazas',
  message: 'Llevá dos tazas y pagá una, para vos y para regalar. El descuento se aplica solo en el carrito.',
  badge: '2x1',
  ctaText: 'Ver tazas',
  ctaLink: '/catalogo?cat=tazas-y-teteras',
};

export async function sembrarAparienciaRegalos(prisma: PrismaClient, businessId: string) {
  const negocio = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (!negocio.isDemo) throw new Error('sembrarAparienciaRegalos solo corre sobre un negocio demo (isDemo).');
  const subir = almacenamiento(businessId);
  const img = (archivo: string) => subir.imagen(archivo, 'business-logos');

  console.log('Apariencia (plantilla Confeti): logo, slider, campaña y videos…');
  const [logoUrl, faviconUrl, slide1, slide2, slide3, parallax, campana] = await Promise.all([
    img('regalos/marca/logo-512.png'), img('regalos/marca/favicon-64.png'),
    img('regalos/home/slide-1.webp'), img('regalos/home/slide-2.webp'), img('regalos/home/slide-3.webp'),
    img('regalos/home/fondo-con-efecto-parallax.webp'), img('regalos/home/campana.webp'),
  ]);
  const [videoRegalos, posterRegalos, videoVelas, posterVelas] = await Promise.all([
    subir.video('regalos/videos/home-regalos.mp4'), subir.video('regalos/videos/home-regalos.webp'),
    subir.video('regalos/videos/home-velas.mp4'), subir.video('regalos/videos/home-velas.webp'),
  ]);

  // El hero partido de Confeti dibuja foto, título, bajada y botón de cada slide.
  const slide = (s: Record<string, string>) => ({
    imageStyle: 'full', imagePosition: 'right', imageOverlay: 'diagonal', bgPattern: 'none', bgPatternScope: 'image', bgColor: '', ...s,
  });
  const heroSlides = [
    slide({
      id: 'regalos', img: slide1,
      titulo: 'Regalos elegidos\ncon tiempo', subtitulo: 'Tazas, velas, papelería y dulces para quedar bien siempre. Te lo mandamos envuelto.',
      cta: 'Ver el catálogo', ctaLink: '/catalogo',
    }),
    slide({
      id: 'cumple', img: slide2,
      titulo: 'Todo para\nel cumpleaños', subtitulo: 'Globos, velitas, peluches y una caja de bombones para cerrar la sorpresa.',
      cta: 'Ver peluches', ctaLink: '/catalogo/peluches-y-juguetes',
    }),
    slide({
      id: 'velas', img: slide3,
      titulo: '3x2 en velas', subtitulo: 'Velas de soja hechas a mano: llevá tres y pagá dos.',
      cta: 'Ver velas', ctaLink: '/catalogo/velas-y-aromas',
    }),
  ];

  await prisma.storefrontConfig.update({
    where: { businessId },
    data: {
      storeName: 'Nébula Regalos',
      tagline: 'Cosas lindas para regalar',
      logoUrl, faviconUrl,
      colorPrimary: '#6C3BE4', colorSecondary: '#241B3A', colorAccent: '#F2603D', colorBackground: '#FFFDF8', colorMode: 'light',
      fontFamily: 'Montserrat', fontFamilyBody: 'Inter', fontScale: 1,
      headerLayout: 'full', gridLayout: '4col',
      headerLinks: [
        { id: 'catalogo', label: 'Catálogo', on: true },
        { id: 'ofertas', label: 'Ofertas', on: true },
        { id: 'masVendidos', label: 'Más vendidos', on: true },
      ],
      showAnnouncementBar: true, announcementScroll: true,
      // Todo lo que promete existe en la demo (ver regalos/tienda.ts).
      shippingText: [
        'Envío gratis desde $250.000',
        'Paquete de regalo sin cargo',
        '2x1 en tazas · 3x2 en velas',
        'Cupón BIENVENIDA10: 10 % en tu primera compra',
        '10 % off pagando con transferencia',
      ].join('\n'),
      heroSlides,
      showStatsBar: true,
      statsBar: [
        { id: 'st1', value: '+3.100', label: 'regalos entregados' },
        { id: 'st2', value: 'Sin cargo', label: 'paquete de regalo' },
        { id: 'st3', value: '24 a 72 h', label: 'entrega en todo el país' },
        { id: 'st4', value: '10 % off', label: 'pagando con transferencia' },
      ],
      showCategoriesSection: true, categoryLayout: 'mosaico',
      categoryIds: ['tazas', 'velas', 'peluches', 'papeleria', 'deco', 'dulces'].map((c) => id(`categoria:${c}`)),
      showFeaturedSection: true, showNewArrivalsSection: true, showRecommendedSection: true, showBestSellersSection: true,
      showRating: true, showNewBadge: true, showOfferBadge: true, showLowStock: true, showSearch: true,
      showParallaxBanner: true,
      parallaxImageUrl: parallax,
      parallaxTitle: 'Un regalo dice más que mil mensajes',
      parallaxSubtitle: 'Te lo mandamos envuelto y con una tarjeta escrita a mano, sin cargo.',
      parallaxCtaText: 'Elegir un regalo', parallaxCtaLink: '/catalogo',
      showVideo: true, videoLayout: 'alternado',
      videoTitle: 'Así llegan', videoSubtitle: 'Cada pedido sale envuelto y con su tarjeta.',
      videoUrl: videoRegalos, videoPosterUrl: posterRegalos,
      videos: [
        {
          id: 'regalos', url: videoRegalos, posterUrl: posterRegalos,
          title: 'Listos para regalar', text: 'Elegís, escribís la dedicatoria y nosotros lo envolvemos. Llega a la puerta de quien quieras.',
          ctaText: 'Ver el catálogo', ctaLink: '/catalogo',
        },
        {
          id: 'velas', url: videoVelas, posterUrl: posterVelas,
          title: 'Velas hechas a mano', text: 'Cera de soja, mecha de algodón y cuatro aromas. 3x2 en toda la línea.',
          ctaText: 'Ver la vela de soja', ctaLink: `/producto/${id('producto:vela-soja')}`,
        },
      ],
      // Marcas inventadas, solo con el nombre: talleres y estudios que no son
      // marcas conocidas.
      showBrands: true,
      brandsTitle: 'Talleres con los que trabajamos',
      brands: ['Barro Sur', 'Pabilo', 'Papel Pluma', 'Algodón de Azúcar', 'Taller Ombú', 'Cacao Norte'].map((name, i) => ({ id: `marca-${i + 1}`, name })),
      showWhatsapp: false,
      showFooter: true, showSocialFooter: false,
      homeTemplate: 'confeti',
      homeTemplateData: {
        cupon: null,
        mostrarIconoLogo: false,
        maxNuevosIngresos: 8,
        secciones: {
          categorias: { volanta: 'Por categoría', titulo: '¿Para quién es el regalo?' },
          destacados: { volanta: 'Elegidos', titulo: 'Los que más regalamos' },
          nuevos: { volanta: 'Recién llegados', titulo: 'Lo nuevo de la semana' },
          franja: {
            titulo: 'Paquete de regalo sin cargo',
            bajada: 'Envolvemos cada pedido y le sumamos una tarjeta escrita a mano con tu dedicatoria.',
            cta: 'Elegir un regalo',
          },
          campana: {
            foto: campana,
            volanta: 'Cumpleaños',
            titulo: 'La sorpresa, resuelta',
            texto: 'Globos, velitas, un peluche y algo dulce: armá el regalo completo en un solo pedido.',
            cta: 'Ver el catálogo',
          },
        },
      },
    },
  });
}
