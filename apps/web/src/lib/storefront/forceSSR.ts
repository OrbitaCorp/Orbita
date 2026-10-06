import type { GetServerSideProps } from 'next'
import { getStorefrontConfig, getStorefrontSeo, getStorefrontProduct, getStorefrontCategories, StorefrontApiError, type StorefrontSeo, type StorefrontProductDetail, type StorefrontCategoryItem } from './api'
import {
  origenDeTienda, parametrosRelevantes, seoNoIndexable, seoInicio, seoCatalogo, seoCategoria, seoProducto,
  type ContextoSeo, type SeoPagina, type TipoPagina,
} from './seo'
import { ROOT_DOMAIN } from '@/lib/tenant'
import { DEMO_SLUG } from '@/lib/demo/modo'
import { temaDePlantilla } from '@/modules/ventas/cliente/inicio/plantillaReal'
import type { Tema } from '@/modules/ventas/panel/avanzado/plantillas/tipos'
import { esNavegadorMovil } from '@/hooks/useMovilPlantilla'

// Marca/branding de la tienda que el loader necesita para pintarse bien.
// Viaja serializado en `pageProps` (vía __NEXT_DATA__), así que está
// disponible en el PRIMER render — tanto en el HTML del server como en la
// hidratación del cliente.
export type StoreMetaSSR = {
  nombre: string
  logo:   string | null
  color:  string | null
  // Favicon propio del negocio (Apariencia → faviconUrl) — antes se guardaba
  // pero _document.tsx nunca lo leía (es estático, compartido con el panel).
  // _app.tsx lo inyecta con next/head en vez, página por página.
  favicon: string | null
  // Tema real de la tienda (2026-08-26) — antes se guardaban en la DB pero
  // nunca llegaban más allá de la vista previa del panel (StorePreview.tsx).
  // _app.tsx los usa para inyectar CSS variables + Google Fonts reales en
  // TODA la tienda (ver el <style> condicional ahí).
  colorBackground: string | null
  colorSecondary:  string | null
  colorAccent:     string | null
  fontFamily:      string | null
  fontFamilyBody:  string | null
  // Escala de texto (Apariencia → Tipografía → Pequeño/Mediano/Grande) — se
  // guardaba desde siempre pero ningún componente del storefront la leía
  // (a diferencia de fontFamily, que sí — ver el comentario de _app.tsx):
  // el visitante veía siempre el mismo tamaño sin importar lo que el dueño
  // eligiera. 0.9/1.15 (o null = 1, sin elegir todavía).
  fontScale: number | null
  // Modo de color elegido por el DUEÑO (2026-08-26) — es el default para un
  // visitante que todavía nunca tocó el toggle de tema del header; una vez
  // que lo toca, esa elección queda en su navegador y manda por sobre esto
  // (ver el script pre-hidratación en _app.tsx). Nunca le pisa la elección
  // ya hecha a un visitante que vuelve.
  colorMode: 'light' | 'dark' | 'system' | null
}

// 'ok' es el default optimista: si la config no llegó a tiempo (backend
// frío) se sigue mostrando la tienda normal — nunca se le muestra a un
// cliente real "en pausa" solo porque el server tardó. El bloqueo real de
// verdad (checkout) lo hace el backend igual (assertBusinessOperativo),
// esto es solo la experiencia visual.
//
// 'not_found' es distinto de los demás: no es optimista. Solo se marca
// cuando el backend confirmó un 404 real (el slug no corresponde a ningún
// negocio) — un timeout/error de red NUNCA cae acá, sigue siendo 'ok' (ver
// el catch de abajo). Antes cualquier subdominio sin negocio caía en el
// storefront normal, mostrando un catálogo vacío/roto en vez de avisar que
// ahí no hay ninguna tienda.
export type StoreStatusSSR = 'ok' | 'paused' | 'inactive' | 'not_found'

// Cuánto se espera a la config del backend ANTES de renderizar la página. Si
// tarda más (cold start de Railway), se sigue sin ella y el cliente la pide
// por su cuenta — nunca se bloquea la respuesta del server por esto.
//
// OJO con bajarlo: estaba en 2500ms y la latencia REAL del backend en
// producción es de ~2.3s a 3.9s de forma constante (medido 2026-08-11 contra
// api.orbita.site: /storefront/:slug ≈ 3.2s, /categories ≈ 2.3s, /products
// ≈ 3.7s — no es cold start, es el piso). O sea: la carrera la perdía SIEMPRE,
// el HTML salía con `__storeMeta: null` en cada carga y el loader terminaba
// mostrando el fallback en vez del branding real. Esperar 2500ms para no
// traer nada era el peor de los dos mundos. Este número tiene que quedar por
// ENCIMA de la latencia real; si el backend se acelera, se puede bajar.
const SSR_CONFIG_TIMEOUT_MS = 6000

// Memoria corta de la config por tienda, en el server. Este getServerSideProps
// corre en CADA navegación dentro de la tienda (Next lo vuelve a pedir en cada
// transición del lado del cliente: ficha ↔ catálogo ↔ inicio), y esperaba la
// config completa del backend cada vez — un pedido de ~cientos de ms a
// segundos, en serie, antes de poder mostrar la página siguiente. La misma
// tienda navegada seguido reusa la de hace unos segundos. TTL corto: solo
// alimenta branding/estado de pausa, y las páginas piden su config fresca
// aparte; que pausar o cambiar la marca se note en ≤ 20s es un costo chico.
// Solo se guardan respuestas OK (un error o un 404 se vuelve a intentar).
const TTL_CONFIG_SSR_MS = 20_000
const configSSR = new Map<string, { hasta: number; cfg: Awaited<ReturnType<typeof getStorefrontConfig>> }>()
async function getConfigConMemoria(slug: string) {
  const previa = configSSR.get(slug)
  if (previa && previa.hasta > Date.now()) return previa.cfg
  const cfg = await getStorefrontConfig(slug)
  configSSR.set(slug, { hasta: Date.now() + TTL_CONFIG_SSR_MS, cfg })
  // No dejar crecer el mapa sin tope si hay muchas tiendas en la misma instancia.
  if (configSSR.size > 200) configSSR.delete(configSSR.keys().next().value as string)
  return cfg
}

// ─── SEO ───────────────────────────────────────────────────────────────────
//
// Cada página de la tienda sale con su <head> (título, descripción, canonical,
// robots, Open Graph, datos estructurados) en el PRIMER HTML, que es el que
// leen Google y los previews de WhatsApp/Instagram/Facebook: ninguno espera a
// que corra el JavaScript. Por defecto una página sale con noindex; solo las
// que declaran un tipo (inicio, catálogo, categoría, producto) se indexan.

const TTL_SEO_MS = 60_000
const TIMEOUT_SEO_MS = 3500

/** Memoria corta por clave: un rastreador o un link compartido pega varias veces seguidas. */
function conMemoria<T>(ttlMs: number, max = 300) {
  const guardado = new Map<string, { hasta: number; valor: T }>()
  return async (clave: string, pedir: () => Promise<T>): Promise<T> => {
    const previo = guardado.get(clave)
    if (previo && previo.hasta > Date.now()) return previo.valor
    const valor = await pedir()
    guardado.set(clave, { hasta: Date.now() + ttlMs, valor })
    if (guardado.size > max) guardado.delete(guardado.keys().next().value as string)
    return valor
  }
}
const seoConMemoria = conMemoria<StorefrontSeo>(TTL_SEO_MS)
const productoConMemoria = conMemoria<StorefrontProductDetail>(30_000)
const categoriasConMemoria = conMemoria<StorefrontCategoryItem[]>(TTL_SEO_MS)

/** El resultado, o null si tardó más de `ms` o falló. Nada de esto puede colgar ni romper la tienda. */
async function conTimeout<T>(pedido: Promise<T>, ms = TIMEOUT_SEO_MS): Promise<T | null> {
  return Promise.race([pedido.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

const noEncontrado = (e: unknown) => e instanceof StorefrontApiError && (e.status === 404 || e.status === 400)

// El título de pestaña de las páginas que no se indexan.
const TITULOS_DE_RUTA: [RegExp, string][] = [
  [/\/carrito(\/|$)/, 'Carrito'], [/\/checkout(\/|$)/, 'Finalizar compra'], [/\/login(\/|$)/, 'Ingresar'],
  [/\/registro(\/|$)/, 'Crear cuenta'], [/\/forgot-password(\/|$)/, 'Recuperar contraseña'], [/\/perfil(\/|$)/, 'Mi cuenta'],
  [/\/pedido(\/|$)/, 'Mi pedido'], [/\/legales(\/|$)/, 'Información legal'], [/\/descuentos(\/|$)/, 'Descuento'], [/\/oferta(\/|$)/, 'Oferta'],
]
const tituloDeRuta = (url: string | undefined) => TITULOS_DE_RUTA.find(([re]) => re.test((url ?? '').split('?')[0]))?.[1]

type DatosSeo = {
  tipo: TipoPagina | null
  slug: string
  nombre: string
  cfg: Awaited<ReturnType<typeof getStorefrontConfig>> | null
  estado: StoreStatusSSR
  /** Navegación dentro de la tienda (/_next/data/…): no es lo que lee un rastreador. */
  esNavegacion: boolean
}

async function armarSeo(ctx: Parameters<GetServerSideProps>[0], d: DatosSeo): Promise<SeoPagina> {
  const { tipo, slug, nombre, cfg, estado, esNavegacion } = d
  const titulo = tituloDeRuta(ctx.resolvedUrl ?? ctx.req.url)

  if (estado === 'not_found') {
    ctx.res.statusCode = 404
    return seoNoIndexable(nombre, 'Tienda no encontrada')
  }
  // Sin tipo (carrito, checkout, perfil…), tienda pausada o sin config: no se indexa.
  if (!tipo || estado !== 'ok' || !cfg) return seoNoIndexable(nombre, titulo)

  // Al navegar dentro de la tienda el HTML no lo lee nadie más que la persona:
  // alcanza con un título, sin esperar a los pedidos de SEO. (Si no, cada click
  // del cliente se demoraría lo que tarda la API.)
  if (esNavegacion) return seoNoIndexable(nombre, tipo === 'catalogo' ? 'Catálogo' : undefined, 'noindex, follow')

  // ¿Corresponde mostrarla en Google, y con qué dominio? Si la API no contesta
  // (o es una versión anterior sin este dato), se decide con lo que ya se sabe.
  const seoApi = await conTimeout(seoConMemoria(slug, () => getStorefrontSeo(slug)))
  const indexable = seoApi ? seoApi.indexable : cfg.business.isActive && !cfg.business.isPaused && slug !== DEMO_SLUG
  const contexto: ContextoSeo = {
    slug,
    nombre,
    tagline: cfg.appearance?.tagline ?? null,
    logo: cfg.appearance?.logoUrl ?? null,
    origen: origenDeTienda(slug, seoApi?.primaryDomain, ROOT_DOMAIN),
    indexable,
    instagram: cfg.contact?.instagram ?? null,
    facebook: cfg.contact?.facebook ?? null,
    tiktok: cfg.contact?.tiktok ?? null,
  }

  if (tipo === 'inicio') return seoInicio(contexto)
  if (tipo === 'catalogo') return seoCatalogo(contexto, parametrosRelevantes(ctx.query))

  if (tipo === 'categoria') {
    const categoria = typeof ctx.params?.categoria === 'string' ? ctx.params.categoria : ''
    const categorias = await conTimeout(categoriasConMemoria(slug, () => getStorefrontCategories(slug)))
    const cat = categorias?.find((c) => c.slug === categoria)
    if (categorias && !cat) {
      ctx.res.statusCode = 404
      return seoNoIndexable(nombre, 'Categoría no encontrada', 'noindex, follow')
    }
    // Sin poder confirmar la categoría (la API tardó) no se indexa: un título genérico no sirve.
    return cat ? seoCategoria(contexto, { slug: cat.slug, nombre: cat.name }) : seoNoIndexable(nombre, 'Catálogo', 'noindex, follow')
  }

  // producto
  const id = typeof ctx.params?.id === 'string' ? ctx.params.id : ''
  try {
    const producto = await Promise.race([
      productoConMemoria(`${slug}/${id}`, () => getStorefrontProduct(slug, id)),
      new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_SEO_MS)),
    ])
    // Tardó de más: se sirve igual, sin indexar (un título genérico no sirve).
    return producto ? seoProducto(contexto, producto) : seoNoIndexable(nombre, undefined, 'noindex, follow')
  } catch (e) {
    // Un producto borrado o inexistente es un 404 de verdad: antes la página
    // respondía 200 con un "no encontrado" armado en el navegador, y Google lo
    // toma por una página rota que sí existe (un "soft 404").
    if (noEncontrado(e)) {
      ctx.res.statusCode = 404
      return seoNoIndexable(nombre, 'Producto no encontrado', 'noindex, follow')
    }
    return seoNoIndexable(nombre, undefined, 'noindex, follow')
  }
}

// Fuerza SSR en las páginas del storefront en vez de dejar que Next.js las
// optimice automáticamente como estáticas (comportamiento default de un
// page sin getServerSideProps/getStaticProps), y de paso resuelve el
// branding de la tienda del lado del server.
//
// Por qué SSR: la combinación "página dinámica auto-estática" + el rewrite de
// subdominios de middleware.ts (NextResponse.rewrite, transparente para el
// browser — la URL real sigue siendo `jaja.orbita.site/`, nunca
// `/tienda/jaja`) dejaba a `router.isReady` sin resolver. Con SSR el server ya
// resuelve `params`/`query` a partir del path reescrito ANTES de renderizar.
//
// `__storefront: true` viaja en `pageProps` para que _app.tsx sepa que es una
// página de tienda sin mirar `router.pathname` (que en el primer render del
// cliente puede no coincidir con el del server para una ruta dinámica → React
// lo marca como hydration mismatch y la página queda trabada en el loader).
//
// `__storeMeta` resuelve el otro bug visible (2026-08-07): el loader mostraba
// la inicial "R" del MOCK (`TIENDA.nombre` es literalmente "Rama
// Indumentaria") en vez del logo real, porque el logo solo llegaba después de
// un fetch del lado del cliente. Trayéndolo acá, el HTML que sale del server
// ya viene con el logo/nombre/color correctos: se ven desde el primer byte,
// sin depender de que el JS haya corrido.
export function crearGetServerSideProps(tipo: TipoPagina | null = null): GetServerSideProps {
  return async (ctx) => {
  const slug = typeof ctx.params?.slug === 'string' ? ctx.params.slug : null

  let storeMeta: StoreMetaSSR | null = null
  let storeStatus: StoreStatusSSR = 'ok'
  // Plantilla de Home activa (Avanzado → Plantillas), conocida desde el
  // server — la usa SOLO Inicio.tsx (vía StorefrontChrome `homeTemplateSSR`)
  // para que su propio skeleton de carga ya sepa qué header/tema dibujar, en
  // vez de asumir "sin plantilla" hasta que el fetch del cliente responda.
  // El resto de las páginas del storefront reciben este mismo prop (todas
  // comparten este getServerSideProps) pero no lo usan — una plantilla
  // solo cambia el home, nunca el resto de la tienda.
  let homeTemplate: string | null = null
  let cfgOk: Awaited<ReturnType<typeof getStorefrontConfig>> | null = null
  if (slug) {
    try {
      // Carrera contra un timeout: si el backend está frío, la tienda igual
      // responde (el cliente completa el branding después).
      const cfg = await Promise.race([
        getConfigConMemoria(slug),
        new Promise<null>(resolve => setTimeout(() => resolve(null), SSR_CONFIG_TIMEOUT_MS)),
      ])
      if (cfg) {
        cfgOk = cfg
        homeTemplate = cfg.appearance?.homeTemplate ?? null
        storeMeta = {
          nombre: cfg.appearance?.storeName ?? cfg.business.name,
          logo:   cfg.appearance?.logoUrl ?? null,
          color:  cfg.appearance?.colorPrimary ?? null,
          // Favicon de la tienda: el que cargó el dueño; si no cargó ninguno
          // pero sí tiene logo, el logo. Sin nada, queda el de Órbita que
          // pone _document.tsx (pedido de Ale: el de Órbita es para la
          // landing y el panel, la tienda va con la marca del negocio).
          favicon: cfg.appearance?.faviconUrl ?? cfg.appearance?.logoUrl ?? null,
          colorBackground: cfg.appearance?.colorBackground ?? null,
          colorSecondary:  cfg.appearance?.colorSecondary ?? null,
          colorAccent:     cfg.appearance?.colorAccent ?? null,
          fontFamily:      cfg.appearance?.fontFamily ?? null,
          fontFamilyBody:  cfg.appearance?.fontFamilyBody ?? null,
          colorMode:       cfg.appearance?.colorMode ?? null,
          fontScale:       cfg.appearance?.fontScale != null ? Number(cfg.appearance.fontScale) : null,
        }
        // Una tienda pausada o nunca publicada no debería mostrar catálogo ni
        // dejar comprar — "Pausar tienda" en Configuración promete
        // explícitamente "deja de estar visible para tus clientes". Antes
        // esto no se chequeaba en ningún lado del storefront: pausar no
        // ocultaba nada. _app.tsx usa esto para pintar TiendaPausada en vez
        // de la página real, para TODAS las rutas de /tienda/[slug]/**.
        if (cfg.business.isPaused) storeStatus = 'paused'
        else if (!cfg.business.isActive) storeStatus = 'inactive'
      }
    } catch (err) {
      // 404 real del backend (el slug no existe como negocio) — distinto de
      // un error de red/backend caído, que sigue sin branding optimistamente
      // y el cliente reintenta. Nunca rompe el render de la página.
      if (err instanceof StorefrontApiError && err.status === 404) storeStatus = 'not_found'
    }
  }

  // La paleta de esa plantilla, resuelta acá y no en _app.tsx a propósito:
  // `temaDePlantilla()` cuelga de `plantillas/datos.tsx` (78 KB), y _app.tsx
  // lo cargan TODAS las páginas — la landing y el panel se comerían ese peso
  // para nada. Del lado del server no cuesta nada, y el `Tema` es un objeto
  // plano de strings, serializable tal cual. Lo consume el PageLoader, que se
  // dibuja afuera de StorefrontChrome y si no arrancaría con la paleta de
  // Apariencia hasta que hidrate (ver el comentario de `tema` en PageLoader).
  const temaPlantilla: Tema | null = temaDePlantilla(homeTemplate) ?? null

  // OJO: `null` y no `undefined` — Next exige props serializables a JSON.
  // De qué lado del corte dibujar el primer HTML de una plantilla (ver
  // useMovilPlantilla): las plantillas no usan CSS fluido, eligen con un
  // booleano, y sin esta pista el teléfono recibía la portada de escritorio.
  const movil = esNavegadorMovil(ctx.req.headers['user-agent'])

  const esNavegacion = typeof ctx.req.headers['x-nextjs-data'] === 'string' || (ctx.req.url ?? '').startsWith('/_next/data/')
  const seo = await armarSeo(ctx, {
    tipo, slug: slug ?? '', nombre: storeMeta?.nombre ?? slug ?? 'Tienda', cfg: cfgOk, estado: storeStatus, esNavegacion,
  })

  return { props: { __storefront: true, __storeMeta: storeMeta, __storeStatus: storeStatus, __homeTemplate: homeTemplate, __temaPlantilla: temaPlantilla, __movil: movil, __seo: seo } }
  }
}

// Sin tipo: la página no se indexa (carrito, checkout, perfil, login, legales…).
// Es el valor por defecto a propósito: una página nueva de la tienda no aparece
// en Google hasta que alguien decida que tiene que aparecer.
export const getServerSideProps = crearGetServerSideProps()
export const getServerSidePropsInicio = crearGetServerSideProps('inicio')
export const getServerSidePropsCatalogo = crearGetServerSideProps('catalogo')
export const getServerSidePropsCategoria = crearGetServerSideProps('categoria')
export const getServerSidePropsProducto = crearGetServerSideProps('producto')
