// ─── Apariencia de la tienda demo: marca y home ─────────────────────────────
//
// Separado del contenido (sembrar.ts) para poder iterar el diseño sin
// resembrar todo: `pnpm seed:demo --solo-apariencia` corre solo esto.
//
// Todo sale de Configuración → Apariencia (el home clásico), NO de las
// plantillas avanzadas: la demo muestra lo que cualquier tienda puede armar
// sola. Lo que se guarda acá es lo mismo que guardaría ese panel.
//
// Logo: diseño propio de la demo (media/marca/logo.svg, exportado a PNG) —
// una N con una chispa sobre el degradé "Nébula" de las pantallas de las fotos.
import type { PrismaClient } from '@prisma/client';
import { almacenamiento, idDemo } from './sembrar';

// Paleta sacada del logo: violeta de marca, azul noche y cian de acento.
const PRIMARIO = '#5B3DF5';
const NOCHE = '#1E1452';
const CIAN = '#22D3EE';

export async function sembrarApariencia(prisma: PrismaClient, businessId: string) {
  const negocio = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (!negocio.isDemo) throw new Error('sembrarApariencia solo corre sobre el negocio demo (isDemo).');
  const subir = almacenamiento(businessId);
  const img = (archivo: string) => subir.imagen(archivo, 'business-logos');

  console.log('Apariencia: logo, slider, parallax y videos…');
  const [logoUrl, faviconUrl, slide1, slide2, slide3, parallax] = await Promise.all([
    img('marca/logo-512.png'), img('marca/favicon-64.png'),
    img('home/slide-1.webp'), img('home/slide-2.webp'), img('home/slide-3.webp'),
    img('home/fondo-con-efecto-parallax.webp'),
  ]);
  const [videoDrone, posterDrone, videoGaming, posterGaming] = await Promise.all([
    subir.video('videos/home-video-principal.mp4'), subir.video('videos/home-video-principal.webp'),
    subir.video('videos/home-gaming.mp4'), subir.video('videos/home-gaming.webp'),
  ]);

  const slide = (s: Record<string, string>) => ({
    imageStyle: 'full', imagePosition: 'right', imageOverlay: 'diagonal', bgPattern: 'none', bgPatternScope: 'image', bgColor: '', ...s,
  });
  const heroSlides = [
    slide({
      id: 'setup', img: slide1, imageOverlay: 'diagonal',
      titulo: 'Tu setup,\nal siguiente nivel', subtitulo: 'Monitores, teclados y audio para trabajar y jugar con todo.',
      cta: 'Ver computación', ctaLink: '/catalogo/computacion',
    }),
    // La foto es vertical y de fondo claro: va entera al costado, sobre el
    // azul de la marca con destellos, en vez de recortarla a lo ancho.
    slide({
      id: 'audio', img: slide2, imageStyle: 'centered', imagePosition: 'right', bgColor: NOCHE, bgPattern: 'sparkle', bgPatternScope: 'full',
      titulo: 'Sonido que\nte envuelve', subtitulo: 'Auriculares Nébula Pulse: cancelación de ruido y 40 horas de batería.',
      cta: 'Ver audio', ctaLink: '/catalogo/audio',
    }),
    // La "Semana Gamer" es un descuento automático real sembrado (15 % en la
    // categoría): el slide promete lo que el carrito aplica.
    slide({
      id: 'gamer', img: slide3, imageOverlay: 'marca',
      titulo: 'Semana Gamer:\n15 % off', subtitulo: 'Joysticks, sillas, auriculares y todo para tu próxima partida.',
      cta: 'Ver gaming', ctaLink: '/catalogo/gaming',
    }),
  ];

  const categoria = (clave: string) => idDemo(`categoria:${clave}`);

  await prisma.storefrontConfig.update({
    where: { businessId },
    data: {
      storeName: 'Nébula Tech',
      tagline: 'Tecnología para tu día a día',
      logoUrl, faviconUrl,
      colorPrimary: PRIMARIO, colorSecondary: NOCHE, colorAccent: CIAN, colorBackground: '#F8FAFC', colorMode: 'light',
      fontFamily: 'Montserrat', fontFamilyBody: 'Inter', fontScale: 1,
      headerLayout: 'full', gridLayout: '4col',
      headerLinks: [
        { id: 'catalogo', label: 'Catálogo', on: true },
        { id: 'ofertas', label: 'Ofertas', on: true },
        { id: 'masVendidos', label: 'Más vendidos', on: true },
      ],
      showAnnouncementBar: true, announcementScroll: true,
      shippingText: 'Envío gratis desde $250.000   ·   10 % off pagando con transferencia   ·   Cambios dentro de los 30 días',
      heroSlides,
      showStatsBar: true,
      statsBar: [
        { id: 'st1', value: '+1.800', label: 'pedidos entregados' },
        { id: 'st2', value: '24 a 72 h', label: 'entrega en todo el país' },
        { id: 'st3', value: '10 % off', label: 'pagando con transferencia' },
        { id: 'st4', value: '12 meses', label: 'de garantía' },
      ],
      // Mosaico: la primera va grande. Hogar queda afuera (el mosaico admite 5).
      showCategoriesSection: true, categoryLayout: 'mosaico',
      categoryIds: ['gaming', 'audio', 'computacion', 'celulares', 'wearables'].map(categoria),
      showFeaturedSection: true, showNewArrivalsSection: true, showRecommendedSection: true, showBestSellersSection: true,
      showRating: true, showNewBadge: true, showOfferBadge: true, showLowStock: true, showSearch: true,
      showParallaxBanner: true,
      parallaxImageUrl: parallax,
      parallaxTitle: 'Tecnología elegida, no acumulada',
      parallaxSubtitle: 'Probamos cada producto antes de sumarlo al catálogo. Si no lo usaríamos, no lo vendemos.',
      parallaxCtaText: 'Ver catálogo', parallaxCtaLink: '/catalogo',
      showVideo: true, videoLayout: 'alternado',
      videoTitle: 'Miralos en acción', videoSubtitle: 'Antes de comprar, mirá cómo se ven de verdad.',
      videoUrl: videoDrone, videoPosterUrl: posterDrone,
      videos: [
        {
          id: 'drone', url: videoDrone, posterUrl: posterDrone,
          title: 'Nébula Sky 4K', text: 'Plegable, liviano y con video 4K estabilizado. Entra en la mochila y sale en cada viaje.',
          ctaText: 'Ver el drone', ctaLink: `/producto/${idDemo('producto:drone')}`,
        },
        {
          id: 'gaming', url: videoGaming, posterUrl: posterGaming,
          title: 'Luces, teclas, acción', text: 'Teclados mecánicos, mousepads con luces y todo lo que tu escritorio gamer necesita.',
          ctaText: 'Ver gaming', ctaLink: '/catalogo/gaming',
        },
      ],
      // Sin marcas: una tira de marcas inventadas o reales sería mentir.
      showBrands: false,
      // Sin número de WhatsApp (ver seed-demo.ts): el banner no se dibuja igual.
      showWhatsapp: false,
      showFooter: true, showSocialFooter: false,
      homeTemplate: null,
      homeTemplateData: { cupon: null, mostrarIconoLogo: false, secciones: {}, maxNuevosIngresos: 8 },
    },
  });
}
