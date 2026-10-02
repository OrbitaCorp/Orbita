import { Palette, Plus } from 'lucide-react'
import { MARCA_MODOS, MARCA_ESTILOS, marcaValida } from '@/components/storefront/marca'
import { AYUDA_SECCIONES } from '../ayudas'
import { Divider, FieldLabel, Inp, SecCard } from '../Controles'
import { ImgUploader } from '../ImgUploader'
import { SlideItem } from '../SlideItem'
import { VisualPick } from '../VisualPick'
import { miniMarca } from '../miniaturas'
import { moverElemento, subirImagenApariencia, type PropsSeccion } from '../utils'

// Hero — comparte la misma SecCard en los dos modos (por eso el título
// cambia según soloContenido): en Apariencia completa es también donde
// vive la identidad de marca (logo/favicon/nombre), editando una
// plantilla activa esos tres campos los define la plantilla y no se
// muestran, así que la tarjeta queda con los sliders nomás.
// Con un tope (Escaparate, heroMax=2): recortar a los primeros `heroMax`
// ítems — sin esto, un negocio que ya tenía 3+ slides cargados de antes
// (home clásico, u otra plantilla) los seguía viendo y pudiendo editar
// acá aunque el home real nunca dibuje el sobrante (ver homes.tsx, bloque
// 'escaparate': `p.slides.slice(0, 2)`) — confuso, y contradice el pedido
// explícito de que esta plantilla "permita solamente agregar/editar dos
// imágenes". Los datos de más no se borran (siguen ahí por si se vuelve
// a un home sin tope), solo se dejan de listar mientras el tope aplica.
export function SeccionHero({ ap, set, soloContenido, heroMax, heroNoRotativo, onToast }: PropsSeccion & {
    soloContenido: boolean
    heroMax: number | undefined
    heroNoRotativo: boolean
    onToast: (m: string) => void
}) {
    const slidersVisibles = heroMax ? ap.sliders.slice(0, heroMax) : ap.sliders
    return (
        <SecCard id="ap-sec-identidad" title={soloContenido ? 'Hero' : 'Identidad de marca'} icon={Palette} ayuda={AYUDA_SECCIONES[soloContenido ? 'hero' : 'identidad']}>
            {!soloContenido && (<>
                <FieldLabel help="Aparece en el header, en la pestaña del navegador (favicon), emails y comprobantes">Logo de la tienda</FieldLabel>
                <ImgUploader
                    value={ap.logo}
                    onChange={v => {
                        set('logo', v)
                        set('favicon', v)
                    }}
                    onUpload={subirImagenApariencia}
                    shape="circle"
                    size={96}
                    formats="PNG, JPG, SVG o HEIC · máx 10MB"
                    onToast={onToast}
                />
                <Divider />
                <div>
                    <FieldLabel help="Es opcional. Si lo dejás vacío se usa el nombre de tu negocio. Y si tu logo ya dice el nombre, podés mostrar solo el logo (acá abajo).">Nombre de la tienda <span style={{ color: 'var(--color-subtle)', fontWeight: 400 }}>· opcional</span></FieldLabel>
                    <Inp value={ap.nombreTienda} onChange={v => set('nombreTienda', v)} placeholder="Ej: Venus Style" />
                </div>
                <Divider />
                <FieldLabel help="Elegí qué se muestra arriba a la izquierda de tu tienda y con qué diseño.">Cómo se ve tu marca en el header</FieldLabel>
                <VisualPick
                    value={ap.marcaModo}
                    onChange={v => {
                        const m = marcaValida(v, ap.marcaEstilo)
                        set('marcaModo', m.modo)
                        set('marcaEstilo', m.estilo)
                    }}
                    options={MARCA_MODOS.map(m => ({ id: m.id, label: m.label, svg: miniMarca(m.id, marcaValida(m.id, null).estilo), ayuda: m.ayuda }))}
                />
                <div style={{ height: 14 }} />
                <VisualPick
                    value={marcaValida(ap.marcaModo, ap.marcaEstilo).estilo}
                    onChange={v => set('marcaEstilo', v)}
                    options={MARCA_ESTILOS[ap.marcaModo].map(e => ({ id: e.id, label: e.label, svg: miniMarca(ap.marcaModo, e.id), ayuda: e.ayuda }))}
                />
                {ap.marcaModo !== 'nombre' && !ap.logo && (
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '10px 0 0' }}>
                        {ap.marcaModo === 'logo'
                            ? 'Todavía no subiste un logo: mientras tanto se muestra el nombre en texto.'
                            : 'Sin logo subido se dibuja un ícono genérico. Subí el tuyo arriba, o elegí "Solo nombre".'}
                    </p>
                )}
                <Divider />
            </>)}
            {/* Escaparate (heroPropio, sin rotación — ver heroNoRotativo más
                arriba) muestra sus dos imágenes como posiciones fijas
                (izquierda/derecha), nunca como un carrusel: el diseño de esa
                maqueta no contempla slides rotando, así que ni el título ni
                la ayuda pueden hablar de "sliders"/"carrusel" (pedido
                explícito, con capturas de la maqueta original). */}
            <FieldLabel
                ayuda={AYUDA_SECCIONES[heroNoRotativo ? 'slidersFijos' : 'sliders']}
                help={heroNoRotativo
                    ? 'Las dos imágenes del hero de esta plantilla. No rotan: quedan fijas, una a cada lado.'
                    : 'Carrusel de la página de inicio. Cada slide puede tener imagen, título y llamada a la acción.'}
            >
                {heroNoRotativo ? 'Imágenes del hero' : 'Sliders del hero'}
            </FieldLabel>
            {heroMax && !heroNoRotativo && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
                    Esta plantilla usa como máximo {heroMax} slide{heroMax === 1 ? '' : 's'} —
                    solo {heroMax === 1 ? 'el primero se ve' : `los primeros ${heroMax} se ven`} en el home.
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
                {slidersVisibles.map((s, i) => (
                    <SlideItem
                        key={s.id}
                        slide={s}
                        index={i}
                        defaultOpen={i === 0}
                        soloTexto={soloContenido}
                        etiqueta={heroNoRotativo ? 'Imagen' : 'Slide'}
                        onChange={updated => set('sliders', ap.sliders.map((sl, j) => j === i ? updated : sl))}
                        onRemove={() => set('sliders', ap.sliders.filter((_, j) => j !== i))}
                        // El orden ES la posición (izquierda/derecha en
                        // Escaparate, o el orden del carrusel en el resto) —
                        // mover es solo intercambiar con el vecino. Sin
                        // drag-and-drop (no hay ninguna librería de DnD en el
                        // proyecto todavía): dos flechas alcanzan y no suman
                        // una dependencia nueva para esto.
                        canMoveUp={i > 0}
                        canMoveDown={i < slidersVisibles.length - 1}
                        onMoveUp={() => set('sliders', moverElemento(ap.sliders, i, i - 1))}
                        onMoveDown={() => set('sliders', moverElemento(ap.sliders, i, i + 1))}
                        onToast={onToast}
                    />
                ))}
                {(!heroMax || slidersVisibles.length < heroMax) && (
                    <button
                        onClick={() => set('sliders', [...ap.sliders, { id: 's' + Date.now(), titulo: 'Nuevo slide', subtitulo: '', img: null, cta: 'Ver catálogo', ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', imageOverlay: 'tint', bgPattern: 'none', bgPatternScope: 'image', bgColor: '' }])}
                        className="ds-hover"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        <Plus size={14} strokeWidth={2} /> {heroNoRotativo ? 'Agregar imagen' : 'Agregar slide'}
                    </button>
                )}
            </div>
        </SecCard>
    )
}
