// Adaptador: datos reales de la tienda → la forma `Plantilla` que entiende el
// render compartido de las plantillas de Home (panel/avanzado/plantillas).
//
// Por qué existe: el preview del panel y la portada de la tienda real dibujan
// el MISMO `Home()` (ver homes.tsx). Antes no era así — Inicio.tsx
// re-implementaba la plantilla con ternarios `homeTemplate === 'vidriera'`
// sueltos, y cada retoque en la plantilla había que copiarlo a mano al
// storefront: siempre se escapaba alguno y la tienda quedaba "parecida" pero
// nunca idéntica (orden de secciones distinto, categorías en carrusel en vez
// de grilla, sin cupón, banner de WhatsApp de otro color...).
//
// Con esto, lo único que cambia entre el preview y la tienda real son los
// datos: las fotos y los productos de verdad. Y una plantilla nueva anda en
// la tienda sin tocar Inicio.tsx.

import type { CSSProperties } from 'react'
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import type { ContenidoSecciones, ItemPie, Plantilla, Tema, Slide, Producto as ProductoPlantilla } from '@/modules/ventas/panel/avanzado/plantillas/tipos'
import type { Producto } from '@/lib/storefront/types'
import { thumbGradient, fmt, urlRedSocial } from '@/lib/storefront/utils'
import type { StorefrontConfigResponse, StorefrontStatsItem, StorefrontHeroSlide } from '@/lib/storefront/api'

// El bloque de contacto de la config (Instagram, horario...). Se usa para el
// pie: las redes que el negocio cargó de verdad, no tres globitos decorativos.
type Contacto = NonNullable<StorefrontConfigResponse['contact']>

type CatReal = { id: string; slug: string; nombre: string; hue: number; imageUrl: string | null }

/** La definición de la plantilla elegida, o null si el id no existe. */
export function definicionPlantilla(id: string | null | undefined): Plantilla | null {
  if (!id) return null
  return PLANTILLAS.find(p => p.id === id) ?? null
}

/**
 * ¿La plantilla activa pide header centrado (logo + buscador al medio, en
 * vez del layout estándar a la izquierda) en TODA la tienda, no solo el
 * home? Antes esto era `homeTemplate === 'vidriera'` copiado a mano en cada
 * página del storefront (Catálogo, Categoría, Producto, Carrito...) — y en
 * los hechos solo estaba en Inicio.tsx, así que la tienda quedaba "partida"
 * entre un home con el look de la plantilla y el resto de las páginas con
 * el header por defecto (bug real, reportado con captura: "si esta en otra
 * vista como por ejemplo la del catálogo, siga aplicando el header de la
 * plantilla"). Cada página del storefront debería llamar a esto (con
 * `config?.appearance?.homeTemplate`) en vez de comparar el id a mano —
 * una plantilla nueva que también lo quiera solo tiene que marcar
 * `headerCentrado: true` en su propia definición (datos.tsx), sin tocar
 * ninguna página.
 *
 * A propósito, SOLO el header — pedido explícito: "solamente quiero que
 * el header cambie... en las otras vistas". El modo "cartelera oscura"
 * del AnnouncementBar sigue atado a este mismo flag únicamente en el home
 * (Inicio.tsx, donde ya vivía desde antes) — el resto de las páginas del
 * storefront NO lo tocan, aunque tengan su propio AnnouncementBar.
 */
export function headerCentrado(homeTemplate: string | null | undefined): boolean {
  return definicionPlantilla(homeTemplate)?.headerCentrado ?? false
}

/**
 * ¿La plantilla activa pide el header con SU tipografía/color de nav (Escaparate:
 * mayúsculas tracked, "Ofertas" en el acento) en TODA la tienda? Mismo criterio
 * que `headerCentrado` de arriba — declarado en la plantilla, no hardcodeado
 * por id — pero esta NO cambia el layout del header, solo cómo se pinta.
 */
export function headerBold(homeTemplate: string | null | undefined): boolean {
  return definicionPlantilla(homeTemplate)?.headerBold ?? false
}

/**
 * El tema de la plantilla activa, para pasárselo a la `ProductCard` en TODAS
 * las páginas del storefront y no solo en la portada.
 *
 * Sin esto, la tarjeta caía a su rama por defecto fuera del home: en la ficha
 * de un producto, los íconos flotantes de "agregar" y "ver" salían blancos
 * sobre la tarjeta oscura de la plantilla (bug reportado con captura de
 * "También te puede gustar"). Devuelve `undefined` sin plantilla activa, que
 * es exactamente lo que la tarjeta espera para dibujarse como siempre.
 */
export function temaDePlantilla(homeTemplate: string | null | undefined): Tema | undefined {
  return definicionPlantilla(homeTemplate)?.tema
}

/**
 * El tema de la plantilla, traducido a las variables CSS del storefront.
 *
 * Por qué hace falta: hasta acá la plantilla pintaba SUS secciones con
 * `tema.*` inline, pero todo lo demás del home —header, cartel, hero, footer,
 * badges, botones— seguía leyendo las variables de Apariencia. Con Vidriera no
 * se notaba (es clara y neutra, como la mayoría de las tiendas), pero una
 * plantilla oscura quedaba con el cuerpo oscuro y el header blanco. Aplicando
 * esto en el nodo que envuelve el home, la plantilla manda sobre TODO lo de
 * adentro sin tocar un solo componente: heredan las variables y listo.
 *
 * Se aplica en un div del home, no en `:root`: el resto del sitio (catálogo,
 * ficha, carrito, checkout) tiene que seguir con los colores del negocio —
 * la regla de la casa es que una plantilla cambia la PORTADA, nada más.
 *
 * `--color-body` y `--color-subtle` no tienen equivalente propio en el tema
 * (que solo distingue texto/apagado), así que se mapean al par más cercano en
 * vez de inventar tonos intermedios.
 */
export function variablesDeTema(tema: Tema): CSSProperties {
  return {
    '--color-bg': tema.bg,
    '--color-surface': tema.surf,
    '--color-surface-alt': tema.soft,
    '--color-border': tema.border,
    '--color-border-strong': tema.border,
    '--color-text': tema.text,
    '--color-body': tema.text,
    '--color-muted': tema.muted,
    '--color-subtle': tema.muted,
    '--color-primary': tema.primary,
    // Mismo criterio que _app.tsx para el hover del primario: oscurecerlo en
    // temas claros y aclararlo en los oscuros, en vez de pedirle a cada
    // plantilla un segundo color que hoy no define.
    '--color-primary-h': `color-mix(in srgb, ${tema.primary} ${tema.oscuro ? '75%, white' : '82%, black'})`,
    '--color-primary-bg': `color-mix(in srgb, ${tema.primary} 15%, transparent)`,
    '--color-on-primary': tema.onPrimary,
    '--color-accent': tema.accent,
    '--font-heading': tema.fh,
    '--font-body': tema.fb,
    fontFamily: tema.fb,
  } as CSSProperties
}

// Casi todas las plantillas dibujan el producto con la ProductCard de verdad
// (ver `renderProducto` en AccionesHome) — ahí `precio`/`antes`/`colores` de
// acá abajo no se usan, así que con `nombre`+`img`+`slug` alcanzaba.
//
// Pero una plantilla puede armar SU PROPIA tarjeta en vez de reusar
// ProductCard (Escaparate: su tira "Lo nuevo de la semana" no es la card de
// Vidriera repintada, es OTRO diseño — bordes, badges y swatches propios).
// Para esas, esto SÍ hace falta, formateado igual que el resto del
// storefront: `fmt()` para plata, transferencia si el negocio la tiene
// configurada, swatches de `variantOptions` (mismos que ProductCard, ver
// VariantesCard). Lo único que NO se rellena es `cuotas`: Órbita no calcula
// cuotas en ningún lado del storefront real todavía — inventarlo acá sería
// prometer un dato que la tienda no tiene (misma regla que newsletter/
// testimonios).
function aProductoPlantilla(p: Producto, transferPct?: number | null): ProductoPlantilla {
  const conTransferencia = transferPct && transferPct > 0 ? p.precio * (1 - transferPct / 100) : null
  return {
    nombre: p.nombre,
    // `img` cae al degradé por `hue` (mismo que el resto del storefront) y no
    // a string vacío: con '' el <img> pide la página entera de nuevo por red
    // y deja un recuadro roto.
    img: p.imgUrl ?? thumbGradient(p.hue),
    img2: p.imgUrl2 ?? undefined,
    slug: p.id,
    cat: p.cat || undefined,
    precio: fmt(p.precio),
    antes: p.precioAnt ? fmt(p.precioAnt) : undefined,
    transfer: conTransferencia ? `${fmt(conTransferencia)} con transferencia` : undefined,
    badge: p.badge ?? undefined,
    variantOptions: p.variantOptions,
  }
}

// Igual que `aProductoPlantilla`: adapta el slide de Apariencia (Editor de
// hero, el mismo que ya usa Vidriera) a la forma que entiende `Home()`. Solo
// lo llaman las plantillas con `heroPropio` — el resto sigue con su Carrusel
// mock en el panel y el HeroCarousel real en Inicio.tsx, que lee
// `StorefrontHeroSlide` directo y no pasa por acá.
//
// Sin `kicker`: Apariencia no tiene ese campo (el mock lo inventa para la
// vitrina) — mismo recorte que ya vive en el hero real de Vidriera, que
// tampoco lo dibuja (ver HeroCarousel en Inicio.tsx). El bloque de la
// plantilla en homes.tsx tiene que tratarlo como opcional.
// Degradé de respaldo si el slide no tiene foto cargada — mismo criterio que
// `Foto` en piezas.tsx (nunca un string vacío, que le pide la página entera de
// nuevo por red y deja un recuadro roto). Sin `hue` acá (no es un producto),
// así que es un gris neutro fijo en vez del degradé por `hue` del resto.
const SIN_FOTO_HERO = 'linear-gradient(135deg, #E7E5E4, #D6D3D1)'

function aSlidePlantilla(s: StorefrontHeroSlide): Slide {
  return { img: s.img ?? SIN_FOTO_HERO, titulo: s.titulo, bajada: s.subtitulo, cta: s.cta, link: s.ctaLink }
}

/**
 * Arma la `Plantilla` con la que la tienda real dibuja su portada.
 *
 * `base` es la plantilla elegida: de ahí sale TODO lo visual (tema, tipografía,
 * radios, sombras). Lo que se reemplaza es solo el contenido.
 */
export function plantillaReal({
  base, productos, destacados, masVendidos, categorias, stats, cupon, heroSlides, transferPct,
  marca, tagline, secciones, baseUrl, contacto, mostrarPie = true,
}: {
  base: Plantilla
  // La raíz de la tienda (`/tienda/<slug>`) y el contacto del negocio: los
  // necesita el pie para armar enlaces que naveguen de verdad.
  baseUrl: string
  contacto?: Contacto | null
  // El toggle "Mostrar footer" de Apariencia.
  mostrarPie?: boolean
  // El nombre real del negocio y su bajada. Hacen falta desde que las
  // plantillas dibujan su PROPIO header y su propio pie (ver `headerPropio`
  // en tipos.ts): esos bloques escriben `p.marca`, que en la vitrina es la
  // marca inventada de la muestra ("Ritmo", "Distrito", "Solano"…). Sin esto,
  // una tienda con Atleta aplicada se anunciaba como "RITMO" en su propio
  // navbar — bug real, visto en la primera prueba.
  marca?: string
  tagline?: string
  // Lo que el dueño editó de las secciones propias de ESTA plantilla
  // (homeTemplateData.secciones — ver secciones.ts). Cada campo vacío cae al
  // texto de muestra adentro del bloque, así que una tienda que no tocó nada
  // se ve idéntica a la vitrina.
  secciones?: ContenidoSecciones
  productos: Producto[]
  destacados: Producto[]
  masVendidos: Producto[]
  categorias: CatReal[]
  stats: StorefrontStatsItem[]
  cupon?: { titulo: string; bajada: string; codigo: string } | null
  // Los slides editados en Apariencia (mismo editor que ya usa Vidriera).
  // Solo se usan si `base.heroPropio` — el resto dibuja su hero con
  // HeroCarousel directo en Inicio.tsx (no pasa por `Home()`), así que pasar
  // esto para esas plantillas no haría nada: se ignora a propósito.
  heroSlides?: StorefrontHeroSlide[]
  // Mismo dato que ya recibe ProductCard (config.payment.transferDiscountPercent,
  // solo si acceptsTransfer) — hace falta acá para las plantillas que arman su
  // propia tarjeta con `aProductoPlantilla` en vez de la ProductCard real.
  transferPct?: number | null
}): Plantilla {
  // La plantilla muestra las categorías como tiles fotográficos — de dónde
  // sale esa foto, en orden de prioridad:
  //   1. La imagen propia de la categoría (Categorias.tsx → campo "Imagen",
  //      RBT-604): es la que el dueño eligió a propósito PARA esto, así que
  //      manda sobre cualquier otra cosa si está cargada.
  //   2. Sin imagen propia, la foto del primer producto de esa categoría —
  //      sigue siendo una foto real de lo que hay adentro, que es lo que el
  //      tile promete.
  //   3. Sin ninguna de las dos, el MISMO degradé por `hue` que el resto del
  //      storefront usa para lo que no tiene foto — no se descarta la
  //      categoría. Descartarla dejaba a una tienda recién armada (sin fotos
  //      cargadas) sin la sección entera, y ahí deja de ser una réplica de
  //      la plantilla.
  const fotoDeCategoria = (c: CatReal): string | null =>
    c.imageUrl ?? productos.find(p => p.cat === c.nombre && p.imgUrl)?.imgUrl ?? null

  const cats = categorias
    .slice(0, 4) // la grilla de la plantilla es de 4
    .map(c => [c.nombre, fotoDeCategoria(c) ?? thumbGradient(c.hue), c.slug] as [string, string, string])

  return {
    ...base,
    // La identidad es del NEGOCIO, no de la muestra — ver `marca` arriba.
    ...(marca?.trim() ? { marca: marca.trim() } : {}),
    ...(tagline?.trim() ? { tagline: tagline.trim() } : {}),
    sec: secciones,
    // Barra de confianza: los stats reales del negocio (Apariencia → statsBar),
    // con el mismo par [fuerte, apagado] que usa la plantilla.
    confianza: stats.map(s => [s.value, s.label] as [string, string]),
    categorias: cats,
    // Sin código no hay cupón. El panel ya manda null al vaciarlo, pero un
    // negocio que lo guardó antes de esa validación podría traer strings
    // vacíos — y ahí el home dibujaría el bloque oscuro con la caja punteada
    // en blanco, que se ve peor que no tener cupón.
    cupon: cupon?.codigo?.trim() ? cupon : undefined,
    productos: destacados.map(p => aProductoPlantilla(p, transferPct)),
    catalogo: productos.map(p => aProductoPlantilla(p, transferPct)),
    productosSecundarios: masVendidos.map(p => aProductoPlantilla(p, transferPct)),
    // Sin slides editados, se queda con los de muestra de `base` (mismo
    // criterio que categorías/cupón: no dejar la sección vacía si el negocio
    // todavía no cargó nada).
    ...(base.heroPropio && heroSlides && heroSlides.length > 0
      ? { slides: heroSlides.map(aSlidePlantilla) }
      : {}),
    // El pie: el DISEÑO sigue siendo el de la plantilla (lo pone su `tema`),
    // pero el contenido pasa a ser el real. Antes quedaba el de la maqueta:
    // categorías que la tienda no tiene, enlaces que no navegaban a ningún
    // lado (eran `<div>`, no `<a>`) y cierres inventados como
    // "CUIT 30-71234567-8" o "Local en Av. Rivadavia 4820" — mostrados en
    // tiendas de verdad. Las columnas son las MISMAS que el pie normal de
    // Órbita (StorefrontFooter), para que la tienda diga lo mismo esté la
    // plantilla que esté.
    pie: pieReal({ base: baseUrl, cats, contacto }),
    ocultarPie: !mostrarPie,
  }
}

// Las columnas del pie con datos reales. `Categorías` solo aparece si la
// tienda cargó alguna: una columna vacía se ve peor que no tenerla.
function pieReal({ base, cats, contacto }: {
  base: string
  cats: [string, string, string?][]
  contacto?: Contacto | null
}): NonNullable<Plantilla['pie']> {
  const columnas: [string, ItemPie[]][] = []

  if (cats.length > 0) {
    columnas.push(['Categorías', cats.slice(0, 5).map(([nombre, , slug]) => ({
      label: nombre,
      href: slug ? `${base}/categoria/${slug}` : `${base}/catalogo`,
    }))])
  }

  columnas.push(['Tienda', [
    { label: 'Inicio', href: `${base}/` },
    { label: 'Catálogo', href: `${base}/catalogo` },
    { label: 'Mis pedidos', href: `${base}/pedido` },
  ]])

  columnas.push(['Mi cuenta', [
    { label: 'Ingresar', href: `${base}/login` },
    { label: 'Crear cuenta', href: `${base}/registro` },
  ]])

  // Solo lo que el negocio realmente cargó — si no hay Instagram, no se
  // inventa un globito que no lleva a nada.
  const redes = [
    contacto?.instagram ? { label: 'Instagram', href: urlRedSocial(contacto.instagram, 'instagram') } : null,
    contacto?.facebook ? { label: 'Facebook', href: urlRedSocial(contacto.facebook, 'facebook') } : null,
    contacto?.tiktok ? { label: 'TikTok', href: urlRedSocial(contacto.tiktok, 'tiktok') } : null,
  ].filter((r): r is { label: string; href: string } => r !== null)

  return {
    columnas,
    // El cierre ya no inventa domicilio ni CUIT: solo el horario si el dueño
    // lo cargó en Contacto. Sin dato, no se escribe nada.
    cierre: contacto?.scheduleText?.trim() || '',
    redes,
    legales: [
      { label: 'Términos y condiciones', href: `${base}/legales/terminos` },
      { label: 'Política de privacidad', href: `${base}/legales/privacidad` },
    ],
  }
}
