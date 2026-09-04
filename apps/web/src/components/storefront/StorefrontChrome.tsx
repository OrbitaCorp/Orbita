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
import { StorefrontHeader } from './StorefrontHeader'
import { AnnouncementBar } from './AnnouncementBar'
import { useStorefrontTheme } from '@/hooks/useStorefrontTheme'
import { definicionPlantilla, variablesDeTema, headerCentrado } from '@/modules/ventas/cliente/inicio/plantillaReal'
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
  children: ReactNode
}

export function StorefrontChrome({ tienda, config, anuncio = false, children }: Props) {
  const { isDark } = useStorefrontTheme()
  const homeTemplate = config?.appearance?.homeTemplate ?? null
  const plantilla = definicionPlantilla(homeTemplate)
  // Mismo criterio que ya usaba Inicio.tsx: el modo oscuro que eligió el
  // visitante manda sobre la paleta de la plantilla (que solo define su
  // versión clara) — sin esto, activar oscuro con una plantilla aplicada
  // dejaba el fondo negro de siempre con el primario clarito de la
  // plantilla encima, ilegible.
  const varsPlantilla = plantilla && !isDark ? variablesDeTema(plantilla.tema) : undefined
  const centrado = headerCentrado(homeTemplate)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', ...varsPlantilla }}>
      <StorefrontHeader
        tienda={tienda}
        logoUrl={config?.appearance?.logoUrl}
        headerLinks={config?.appearance?.headerLinks}
        showSearch={config?.appearance?.showSearch ?? true}
        esVidriera={config?.business?.mode === 'SHOWCASE'}
        centrado={centrado}
      />
      {anuncio && (
        <AnnouncementBar
          text={config?.appearance?.shippingText}
          visible={config?.appearance?.showAnnouncementBar ?? true}
          scroll={config?.appearance?.announcementScroll ?? false}
          dark={centrado}
        />
      )}
      {children}
    </div>
  )
}
