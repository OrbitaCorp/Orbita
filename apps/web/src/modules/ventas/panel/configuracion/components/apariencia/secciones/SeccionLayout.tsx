import { LayoutGrid } from 'lucide-react'
import type { ApiCategory } from '@/lib/api'
import {
    CATEGORY_LAYOUTS, CATEGORY_LAYOUT_MAX, OPCIONES_MAX_NUEVOS,
    type Apariencia as Ap, type LayoutHeader, type LayoutGrid as LayoutGridT, type CategoryLayout as CategoryLayoutT,
} from '../../../mock/apariencia.mock'
import { AYUDA_SECCIONES } from '../ayudas'
import { FieldLabel, SecCard, ToggleRow } from '../Controles'
import type { EnlacesHeader } from '../enlacesHeader'
import { SelectorCategorias } from '../SelectorCategorias'
import { VisualPick } from '../VisualPick'
import { hline, MINIATURA_CATEGORIA } from '../miniaturas'
import type { PropsSeccion } from '../utils'

/* "Estilo de header" y "Grilla de productos" se guardaban desde
    siempre pero hasta acá ninguna página de la tienda real los
    leía (reportado, con captura: elegir cualquier opción no
    cambiaba nada) — ver StorefrontChrome.tsx (headerLayout) y
    Catalogo.tsx/Categoria.tsx (gridLayout, vía
    lib/storefront/utils.ts). "Radio de cards" se sacó del todo
    (mismo reporte): no tenía ningún efecto real, y no valía la
    pena construírselo — ver el comentario en apariencia.mapper.ts. */
export function SeccionLayout({ ap, set, actualizar, enlaces, categorias }: PropsSeccion & {
    actualizar: (fn: (p: Ap) => Ap) => void
    enlaces: EnlacesHeader
    categorias: ApiCategory[]
}) {
    const { itemsHeader, alternarLinkHeader, limiteNav, linksActivos, enLimite, categoriasHeader } = enlaces

    // Habilita los estilos de categoría basados en imagen. Mientras las
    // categorías no terminen de cargar queda en false: es el lado seguro —
    // una opción que aparece deshabilitada y se habilita sola molesta menos
    // que una elegible que dibuja una sección vacía.
    const hayFotosDeCategoria = categorias.some(c => !!c.imageUrl)

    return (
        <SecCard id="ap-sec-layout" title="Diseño y layout" icon={LayoutGrid} ayuda={AYUDA_SECCIONES.layout}>
            <FieldLabel>Estilo de header</FieldLabel>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, marginTop: -4 }}>Define qué elementos y navegación muestra el encabezado de tu tienda.</div>
            <div style={{ marginBottom: 18 }}>
                <VisualPick value={ap.layoutHeader} onChange={v => set('layoutHeader', v as LayoutHeader)} options={[
                    {
                        id: 'full', label: 'Completo',
                        svg: hline(<g>
                            <rect x="4" y="13" width="6" height="8" rx="1.5" fill="var(--color-primary)" />
                            <rect x="13" y="15" width="8" height="4" rx="1.5" fill="var(--color-muted)" />
                            <rect x="23" y="15" width="7" height="4" rx="1.5" fill="var(--color-muted)" />
                            <rect x="32" y="15" width="7" height="4" rx="1.5" fill="var(--color-muted)" />
                            <circle cx="48" cy="17" r="3.5" fill="var(--color-border)" />
                            <circle cx="55" cy="17" r="3.5" fill="var(--color-border)" />
                        </g>),
                    },
                    {
                        id: 'standard', label: 'Estándar',
                        svg: hline(<g>
                            <rect x="4" y="13" width="8" height="8" rx="1.5" fill="var(--color-primary)" />
                            <rect x="16" y="15" width="14" height="4" rx="1.5" fill="var(--color-muted)" />
                            <circle cx="46" cy="17" r="3.5" fill="var(--color-border)" />
                            <circle cx="54" cy="17" r="3.5" fill="var(--color-border)" />
                        </g>),
                    },
                    {
                        id: 'centered', label: 'Centrado',
                        svg: hline(<g>
                            <rect x="22" y="7" width="16" height="7" rx="1.5" fill="var(--color-primary)" />
                            <rect x="10" y="20" width="12" height="4" rx="1.5" fill="var(--color-muted)" />
                            <rect x="25" y="20" width="10" height="4" rx="1.5" fill="var(--color-muted)" />
                            <rect x="38" y="20" width="12" height="4" rx="1.5" fill="var(--color-muted)" />
                        </g>),
                    },
                    {
                        id: 'minimal', label: 'Minimal',
                        svg: hline(<g>
                            <rect x="4" y="13" width="8" height="8" rx="1.5" fill="var(--color-primary)" />
                            <rect x="46" y="13" width="10" height="8" rx="1.5" fill="var(--color-border)" />
                        </g>),
                    },
                ]} />
            </div>
            <FieldLabel help="Elegí qué enlaces de navegación se muestran en el header: los de siempre y las categorías de tu tienda. La cantidad máxima depende del estilo de header que elijas. En el estilo Minimal no se muestra navegación. En el celular, el menú de la hamburguesa siempre empieza con 'Inicio'.">Elementos del header</FieldLabel>
            {ap.layoutHeader === 'minimal' ? (
                <div style={{ marginBottom: 18, fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5, border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px' }}>
                    El estilo <strong style={{ color: 'var(--color-text)' }}>Minimal</strong> no muestra enlaces en el header. En el celular, el menú de la hamburguesa igual trae "Inicio" para volver a la portada. Elegí Completo, Estándar o Centrado para armar los enlaces.
                </div>
            ) : (
                <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, color: enLimite ? 'var(--color-warning-text, #B45309)' : 'var(--color-muted)', marginTop: -4, marginBottom: 8, lineHeight: 1.45 }}>
                        {linksActivos > limiteNav
                            ? `Tenés ${linksActivos} activos y este estilo aprovecha hasta ${limiteNav}: apagá algunos para que el header no se apriete.`
                            : enLimite
                                ? `${linksActivos} de ${limiteNav}: llegaste al máximo para este estilo de header. Apagá uno para sumar otro.`
                                : `${linksActivos} de ${limiteNav} posibles con este estilo de header.`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8, lineHeight: 1.45 }}>
                        En el celular, el menú de la hamburguesa siempre empieza con "Inicio", sin que tengas que prenderlo.
                    </div>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 12px' }}>
                        {itemsHeader.filter(x => !x.esCategoria).map((it, i, fijos) => (
                            <div key={it.id} style={{ borderBottom: i < fijos.length - 1 || categoriasHeader.length > 0 ? '1px solid var(--color-border)' : 'none' }}>
                                <ToggleRow
                                    label={it.label}
                                    on={it.on}
                                    disabled={!it.on && enLimite}
                                    onChange={v => alternarLinkHeader(it.id, v)}
                                />
                            </div>
                        ))}
                        {categoriasHeader.length > 0 && (
                            <>
                                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)', padding: '10px 4px 2px' }}>Categorías</div>
                                {/* Un negocio puede tener decenas: la lista scrollea
                                    sola en vez de estirar toda la tarjeta. */}
                                <div style={{ maxHeight: 232, overflowY: 'auto' }}>
                                    {categoriasHeader.map((it, i) => (
                                        <div key={it.id} style={{ borderBottom: i < categoriasHeader.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                            <ToggleRow
                                                label={it.label}
                                                on={it.on}
                                                disabled={!it.on && enLimite}
                                                onChange={v => alternarLinkHeader(it.id, v)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <FieldLabel>Grilla de productos</FieldLabel>
            <div style={{ marginBottom: 18 }}>
                <VisualPick
                    value={ap.layoutGrid}
                    onChange={v => {
                        const nuevoLayout = v as LayoutGridT
                        const opts = OPCIONES_MAX_NUEVOS[nuevoLayout] ?? OPCIONES_MAX_NUEVOS['4col']
                        const compatible = ap.maxNuevosIngresos && opts.some(o => o.valor === ap.maxNuevosIngresos)
                        actualizar(p => ({
                            ...p,
                            layoutGrid: nuevoLayout,
                            maxNuevosIngresos: compatible ? p.maxNuevosIngresos : opts[0].valor,
                        }))
                    }}
                    options={[
                        { id: '3col', label: '3 columnas', svg: hline(<g>{[8, 26, 44].map(x => <rect key={x} x={x} y="10" width="14" height="14" rx="2" fill="var(--color-border)" />)}</g>) },
                        { id: '4col', label: '4 columnas', svg: hline(<g>{[6, 20, 34, 48].map(x => <rect key={x} x={x} y="10" width="10" height="14" rx="2" fill="var(--color-border)" />)}</g>) },
                        { id: 'list', label: 'Lista', svg: hline(<g>{[8, 18, 28].map(y => <rect key={y} x="8" y={y} width="44" height="6" rx="1.5" fill="var(--color-border)" />)}</g>) },
                    ]}
                />
            </div>

            {/* Estilo de la sección "Comprá por categoría" del home
                (ver SeccionCategorias en Inicio.tsx). Mosaico y
                Tarjetas se ofrecen deshabilitados mientras ninguna
                categoría tenga foto: son estilos que SON la foto —
                a diferencia de los otros cuatro, acá la imagen NO
                es opcional, no hay color de relleno para las que
                no tengan (ver resolverCategorias() en Inicio.tsx). */}
            <FieldLabel help="Cómo se ve la fila de categorías en el home. El interruptor para mostrarla o no está en “¿Qué ven tus clientes?”.">Estilo de las categorías</FieldLabel>
            {!hayFotosDeCategoria && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, marginTop: -4 }}>
                    Mosaico y Tarjetas necesitan que la categoría tenga foto — sin eso no se pueden armar (no hay un color de relleno para reemplazarla). Cargá una en Catálogo → Categorías para desbloquearlos.
                </div>
            )}
            <div style={{ marginBottom: 18 }}>
                <VisualPick
                    value={ap.estiloCategorias}
                    onChange={v => set('estiloCategorias', v as CategoryLayoutT)}
                    options={CATEGORY_LAYOUTS.map(op => ({
                        id: op.id,
                        label: op.label,
                        ayuda: op.desc,
                        disabled: op.necesitaFoto && !hayFotosDeCategoria,
                        motivo: 'Necesita una categoría con foto cargada',
                        svg: MINIATURA_CATEGORIA[op.id],
                    }))}
                />
            </div>

            {/* Selector de categorías — solo índice/mosaico/tarjetas
                lo tienen: son los tres estilos donde mostrar TODAS
                las categorías puede no quedar bien (mosaico/tarjetas
                por el tope de 5/4; índice porque una lista muy larga
                deja de ser un "índice" prolijo). Pastillas/etiquetas/
                círculos siempre muestran todas, sin selector. */}
            {(ap.estiloCategorias === 'indice' || ap.estiloCategorias === 'mosaico' || ap.estiloCategorias === 'tarjetas') && (
                <SelectorCategorias
                    candidatas={ap.estiloCategorias === 'indice' ? categorias : categorias.filter(c => !!c.imageUrl)}
                    seleccionadas={ap.categoriasIds}
                    tope={CATEGORY_LAYOUT_MAX[ap.estiloCategorias]}
                    necesitaFoto={ap.estiloCategorias !== 'indice'}
                    onChange={ids => set('categoriasIds', ids)}
                />
            )}
        </SecCard>
    )
}
