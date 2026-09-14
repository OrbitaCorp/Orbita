// Envoltorio único del storefront: header + (opcional) banner de anuncio +
// la paleta/tipografía de la plantilla activa, aplicada como variables CSS
// heredadas a TODO lo de adentro (children incluidos).
//
// Por qué existe — pedido explícito con dos capturas comparando el header
// del home (Vidriera aplicada) contra el de /catalogo: "no entiendo por qué
// no aplicás como componente? Así no tenés que andar aplicando diferentes
// header a cada vista dependiendo de la plantilla". Antes de esto, cada una
// de las ~12 páginas del storefront (Catálogo, Categoría, Producto,
// Carrito, Perfil, cupones, pedido/*) copiaba a mano el mismo bloque:
//
//   <div style={{ minHeight:'100vh', background:'var(--color-bg)' }}>
//     <StorefrontHeader tienda={...} logoUrl={...} ... centrado={...} />
//     <AnnouncementBar ... />  {/* en las que la tenían */}
//     ...contenido de la página...
//   </div>
//
// Un primer arreglo (fix anterior) le sumó `centrado` a las 12 — eso
// emparejó el LAYOUT del header, pero dejó al descubierto un problema más
// de fondo: el "Ingresar" del catálogo seguía saliendo AZUL (el primario de
// Apariencia del negocio) en vez de OSCURO (el primario de la plantilla),
// porque `variablesDeTema()` solo se aplicaba en el div raíz de Inicio.tsx
// — ninguna otra página envolvía su contenido en esas variables. Con
// StorefrontChrome, ese envoltorio (header + anuncio + variables de tema)
// vive en un solo lugar: una plantilla nueva, o un cambio de paleta, se
// ven en TODAS las páginas sin tocar ninguna de ellas.
//
// Reemplaza al div raíz de cada página (no lo agrega adentro) — el uso es
// <StorefrontChrome tienda={tienda} config={config}>{...lo que antes iba
// dentro del div, footer/whatsapp incluidos...}</StorefrontChrome>.

import type { ReactNode } from 'react'
import { StorefrontHeader, navRealDe } from './StorefrontHeader'
import { AccionesPlantilla, BuscadorPlantilla } from './AccionesPlantilla'
import { useMovilPlantilla } from '@/hooks/useMovilPlantilla'
import { Home as PlantillaHome, LAYOUTS_CON_HEADER_PROPIO } from '@/modules/ventas/panel/avanzado/plantillas/homes'
import { AnnouncementBar } from './AnnouncementBar'
import { CountdownBanner } from './CountdownBanner'
import { useRouter } from 'next/router'
import { definicionPlantilla, variablesDeTema, headerCentrado, headerBold } from '@/modules/ventas/cliente/inicio/plantillaReal'
import type { TiendaConfig } from '@/lib/storefront/types'
import type { StorefrontConfigResponse } from '@/lib/storefront/api'

type Props = {
  tienda: TiendaConfig
  config: StorefrontConfigResponse | null
  // El banner de envíos/promo — Inicio.tsx, Catalogo.tsx y Categoria.tsx ya
  // lo mostraban; el resto de las páginas de cuenta/checkout deliberadamente
  // no (menos distracción en medio de una compra o de datos personales) —
  // default false preserva exactamente ese criterio, cada página que lo
  // quiera lo pide.
  anuncio?: boolean
  // Plantilla activa conocida ANTES de que `config` termine de cargar (ver
  // forceSSR.ts § __homeTemplate) — solo la usa el skeleton de Inicio.tsx,
  // mientras `config` todavía es null. Con `config` ya cargado, gana siempre
  // lo que diga `config.appearance.homeTemplate` (puede ser null de verdad,
  // no solo "todavía no llegó"): por eso no es un default de `homeTemplate`,
  // es un valor aparte que solo se usa cuando `config` es null. Sin esto, la
  // pantalla de carga de una tienda con plantilla activa mostraba el header
  // y los colores clásicos por un instante (bug real, reportado: "aparece
  // la plantilla original de apariencia" en la carga).
  homeTemplateSSR?: string | null
  // La página dibuja su propio header y este envoltorio no tiene que poner
  // ninguno. Hoy lo usa solo el home con una plantilla que declara
  // `headerPropio` (ver tipos.ts): ese navbar es parte del diseño de la
  // plantilla —cambia la forma, los íconos y hasta dónde va el buscador— y
  // la única manera de que salga idéntico a su vitrina es dejar que lo
  // dibuje ella, con las acciones reales enchufadas adentro.
  //
  // El resto de las páginas (catálogo, ficha, carrito) siguen con el header
  // de siempre, pintado con la paleta de la plantilla — mismo criterio que
  // ya regía para Vidriera y Escaparate.
  sinHeader?: boolean
  children: ReactNode
}

export function StorefrontChrome({ tienda, config, anuncio = false, homeTemplateSSR = null, sinHeader = false, children }: Props) {
  // El slug sale del router y no de un prop: Chrome lo envuelve TODO el
  // storefront y agregar un prop obligatorio obligaría a tocar cada página.
  // Sirve igual accediendo por subdominio — el middleware reescribe a
  // /tienda/[slug], así que `query.slug` está en los dos modos.
  const router = useRouter()
  const { slug } = router.query as { slug?: string }
  const base = `/tienda/${slug}`
  // De qué lado del breakpoint dibujar el navbar de la plantilla. Estaba fijo
  // en escritorio: un cliente entrando desde el teléfono al catálogo se comía
  // el header ancho, con el panel lateral de 232px incluido.
  const movil = useMovilPlantilla()
  const homeTemplate = config ? (config.appearance?.homeTemplate ?? null) : homeTemplateSSR
  const plantilla = definicionPlantilla(homeTemplate)
  // Los enlaces reales del header, para el nav propio de la plantilla.
  const navReal = navRealDe(config?.appearance?.headerLinks)
  // La paleta y la tipografía de la plantilla mandan SIEMPRE, en toda la
  // tienda y sin importar el modo oscuro del visitante (pedido explícito:
  // "los colores de las plantillas quedan fijos y deben aplicarse a todo el
  // storefront al igual que su tipografía").
  //
  // Antes se salteaban con el modo oscuro puesto, porque las primeras
  // plantillas solo definían su versión clara y el resultado era el fondo
  // negro de siempre con el primario clarito encima. Hoy cada plantilla
  // declara su tema completo —`oscuro: true` para las que ya son oscuras,
  // como Premium— así que ese recorte solo lograba que la ficha de producto
  // se viera con los colores de Órbita y no con los de la plantilla (bug
  // reportado con captura).
  const varsPlantilla = plantilla ? variablesDeTema(plantilla.tema) : undefined
  // "Estilo de header" de Apariencia (Configuración → Apariencia → Diseño y
  // layout) — hasta acá el valor se guardaba bien pero NUNCA se leía en
  // ningún lado: la tienda real siempre mostraba el mismo layout sea cual
  // sea la opción elegida (reportado con captura). Cuando hay una PLANTILLA
  // de Home activa (Avanzado → Plantillas), su propio tratamiento de header
  // manda sobre esto — es la identidad visual de esa plantilla paga, no una
  // preferencia general — igual criterio que ya usa `logoIcono` más abajo.
  const headerLayout = config?.appearance?.headerLayout
  const centrado = homeTemplate ? headerCentrado(homeTemplate) : headerLayout === 'centered'
  const bold = headerBold(homeTemplate)
  const navCentrada = !homeTemplate && headerLayout === 'standard'
  const sinNav = !homeTemplate && headerLayout === 'minimal'
  // El ícono de marca es opcional SOLO bajo una plantilla que lo declare
  // (`headerBold`, hoy Escaparate) — para cualquier otra página/plantilla
  // sigue mostrándose siempre, sin cambios. Guardado en homeTemplateData
  // (JSON por plantilla, ver home-template-data.dto.ts) porque es contenido
  // de ESA plantilla, no de Apariencia general.
  const logoIcono = bold ? (config?.appearance?.homeTemplateData?.mostrarIconoLogo ?? false) : true
  // ¿Esta página dibuja el header de la plantilla en vez del clásico? El home
  // no: ya viene adentro de su propio `Home()` (por eso `sinHeader`).
  const usaHeaderPropio = !sinHeader && !!plantilla && LAYOUTS_CON_HEADER_PROPIO.has(plantilla.layout)
  // Circuito y su panel lateral: el header no es una franja sino una columna,
  // así que el contenido de la página va a su derecha. En celular su bloque ya
  // dibuja una barra común arriba y se apila como el resto.
  const lateral = usaHeaderPropio && !!plantilla?.headerLateral && !movil

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', ...varsPlantilla }}>
      {/* Cartelera ARRIBA del header, no debajo — así la dibujan las dos
          maquetas (Vidriera y Escaparate, ver homes.tsx: `<Marquee>`/el div
          fijo van antes de `<HeaderCentrado>`/el navbar) y el propio preview
          de Apariencia (StorePreview.tsx: "Announcement bar" antes de
          "Header"). Quedó al revés acá siendo la única pieza de la tienda
          real que dibujaba primero el header — bug reportado con captura
          (Escaparate aplicada vs. la maqueta original). */}
      {anuncio && (
        <AnnouncementBar
          text={config?.appearance?.shippingText}
          visible={config?.appearance?.showAnnouncementBar ?? true}
          scroll={config?.appearance?.announcementScroll ?? false}
          dark={centrado}
        />
      )}
      {/* Cuenta regresiva "en todas las páginas" (paquete Avanzado). Va DEBAJO
          del AnnouncementBar y no en su lugar: son dos cosas distintas y el
          dueño puede tener las dos. Si el countdown está configurado como "solo
          en la portada", esto no dibuja nada — lo dibuja Inicio.tsx. */}
      {slug && <CountdownBanner slug={slug} lugar="ALL_PAGES" />}
      {/* El header de la plantilla, en TODAS las vistas — no solo la portada.
          Es el mismo JSX que dibuja su bloque en homes.tsx, así que el
          catálogo y la ficha de producto se ven con la misma marca, la misma
          tipografía y los mismos íconos que el home (antes la ficha salía con
          el header clásico de Órbita, reportado con captura). El home no lo
          dibuja acá: ya viene adentro de su propio `Home()` — por eso
          `sinHeader`. */}
      {usaHeaderPropio && plantilla ? (
        // Circuito: su header es una COLUMNA al costado, así que el contenido
        // de la página va a su derecha y no debajo. El resto se apila como
        // siempre. En celular su propio bloque ya dibuja una barra arriba.
        <div style={lateral ? { display: 'flex', alignItems: 'flex-start' } : undefined}>
        <PlantillaHome
          p={{
            ...plantilla,
            marca: tienda.nombre || plantilla.marca,
            tagline: config?.appearance?.tagline || plantilla.tagline,
            links: navReal.map(l => l.label),
            sec: config?.appearance?.homeTemplateData?.secciones ?? undefined,
          }}
          movil={movil}
          soloHeader
          acciones={{
            irAInicio: () => router.push(`${base}/`),
            irACatalogo: () => router.push(`${base}/catalogo`),
            irACategoria: (s) => router.push(`${base}/catalogo?cat=${encodeURIComponent(s)}`),
            irAProducto: (s) => router.push(`${base}/producto/${s}`),
            nav: navReal.map(l => ({ label: l.label, onClick: () => router.push(`${base}${l.path}`) })),
            renderAcciones: ({ movil: m }) => (
              <AccionesPlantilla t={plantilla.tema} movil={m} esVidriera={config?.business?.mode === 'SHOWCASE'} />
            ),
            renderBuscador: () => <BuscadorPlantilla t={plantilla.tema} />,
          }}
        />
        {lateral && <div style={{ flex: 1, minWidth: 0 }}>{children}</div>}
        </div>
      ) : !sinHeader && (
        <StorefrontHeader
          tienda={tienda}
          logoUrl={config?.appearance?.logoUrl}
          headerLinks={config?.appearance?.headerLinks}
          showSearch={config?.appearance?.showSearch ?? true}
          esVidriera={config?.business?.mode === 'SHOWCASE'}
          centrado={centrado}
          escaparate={bold}
          logoIcono={logoIcono}
          navCentrada={navCentrada}
          sinNav={sinNav}
        />
      )}
      {/* Con header lateral el contenido ya se dibujó adentro de la fila, a la
          derecha del panel — ver arriba. */}
      {!lateral && children}
    </div>
  )
}
