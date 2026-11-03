import { Menu } from 'lucide-react'
import { AYUDA_SECCIONES } from '../ayudas'
import { Divider, SecCard, ToggleRow } from '../Controles'
import type { EnlacesHeader } from '../enlacesHeader'
import type { PropsSeccion } from '../utils'

// Header — solo tiene sentido editando la plantilla activa: en Apariencia
// completa los enlaces ya se editan dentro de "Diseño y layout".
//
// Además de los tres enlaces fijos de siempre, ofrece las CATEGORÍAS
// reales del negocio: varias plantillas (Vidriera entre ellas) dibujan la
// fila de nav con categorías, no con secciones genéricas, y sin esto no
// había forma de armarla. Se guardan en el mismo `headerLinks` de
// siempre, con el id prefijado `cat:<slug>` — el storefront lo resuelve a
// /catalogo?cat=slug (ver pathDeLink en StorefrontHeader).
export function SeccionHeaderPlantilla({ ap, set, conIconoOpcional, enlaces }: PropsSeccion & {
    conIconoOpcional: boolean
    enlaces: EnlacesHeader
}) {
    const { itemsHeader, alternarLinkHeader } = enlaces
    return (
        <SecCard id="ap-sec-header" title="Header" icon={Menu} ayuda={AYUDA_SECCIONES.header}>
            {conIconoOpcional && (
                <>
                    <ToggleRow
                        label="Mostrar el ícono de tu logo"
                        on={ap.mostrarIconoLogo}
                        onChange={v => set('mostrarIconoLogo', v)}
                    />
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '4px 0 14px' }}>
                        Apagado (el diseño original de esta plantilla): el header muestra solo el
                        nombre de tu tienda, en texto. Encendido: se agrega el logo que subiste
                        acá arriba.
                    </p>
                    <Divider />
                </>
            )}
            <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
                Qué se muestra en la fila de navegación, debajo del logo. Con 4 o 5 entra cómodo;
                más que eso empieza a apretarse. En el celular, el menú de la hamburguesa siempre
                empieza con "Inicio", sin que tengas que prenderlo.
            </p>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 12px' }}>
                {itemsHeader.map((it, i) => (
                    <div key={it.id} style={{ borderBottom: i < itemsHeader.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <ToggleRow
                            label={it.esCategoria ? `${it.label} · categoría` : it.label}
                            on={it.on}
                            onChange={v => alternarLinkHeader(it.id, v)}
                        />
                    </div>
                ))}
            </div>
        </SecCard>
    )
}
