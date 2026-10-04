// Crédito de Órbita al pie de toda tienda: "Tienda creada con Órbita" (lleva al
// home de Órbita) y, debajo, un mensajito chico para quien quiera su propia
// tienda. Lo usan el pie normal (StorefrontFooter) y el de las plantillas de
// Home (piezas.tsx → Pie), cada uno con sus colores.
//
// Los enlaces salen a otra pestaña: el visitante está comprando y no tiene que
// perder la tienda. La URL depende del entorno (protocolo y puerto en
// desarrollo), que en el server no se conocen: arranca con la de producción y
// se corrige al montar, igual que la entrada a la demo (landing/v2/Demo.tsx).
import { useEffect, useState, type CSSProperties } from 'react'
import { ROOT_DOMAIN, apexUrl } from '@/lib/tenant'

type Props = {
  /** Color del texto normal y del que resalta ("Órbita"). */
  color: string
  /** Color del renglón chico de abajo. */
  colorSuave: string
  fontFamily?: string
  /** Sin enlaces (la vista previa de la plantilla en el panel: ahí no se navega). */
  sinEnlaces?: boolean
  style?: CSSProperties
}

export function CreditoOrbita({ color, colorSuave, fontFamily, sinEnlaces, style }: Props) {
  const [urls, setUrls] = useState({ inicio: `https://${ROOT_DOMAIN}/`, crear: `https://${ROOT_DOMAIN}/onboarding/rubro` })
  useEffect(() => setUrls({ inicio: apexUrl('/'), crear: apexUrl('/onboarding/rubro') }), [])

  const enlace = (href: string, hijos: React.ReactNode, extra?: CSSProperties) =>
    sinEnlaces
      ? <span style={extra}>{hijos}</span>
      : <a href={href} target="_blank" rel="noopener" className="ds-link" style={{ color: 'inherit', textDecoration: 'none', ...extra }}>{hijos}</a>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily, ...style }}>
      <div style={{ fontSize: 12, color: colorSuave }}>
        {enlace(urls.inicio, <>Tienda creada con <strong style={{ color }}>Órbita</strong></>)}
      </div>
      <div style={{ fontSize: 11, color: colorSuave, opacity: 0.85 }}>
        ¿Querés tu tienda? {enlace(urls.crear, 'Creala acá', { color, fontWeight: 600, textDecoration: sinEnlaces ? 'none' : 'underline', textUnderlineOffset: 2 })}
      </div>
    </div>
  )
}
