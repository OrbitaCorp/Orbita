// src/modules/ventas/panel/configuracion/Apariencia.tsx — Vista 16
// Apariencia pública de la tienda: identidad de marca, paleta, tipografía,
// layout, visibilidad, textos y CSS custom — con vista previa en vivo.

import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Palette, Type, LayoutGrid, Eye, Droplets, Sun, Moon, Monitor, ExternalLink, Plus, Check, ChevronDown, X, Trash2, Hash, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Skeleton } from '@/design-system/components/Skeleton'
import { ApiError, panelGetAppearance, panelGetBusiness, panelUpdateAppearance, panelUploadStorefrontImage } from '@/lib/api'
import { ROOT_DOMAIN } from '@/lib/tenant'

import type { VistaConfig } from './components/ConfigTabs'
import { ImgUploader } from './components/apariencia/ImgUploader'
import { StorePreview } from './components/apariencia/StorePreview'
import {
    AP_DEFAULTS, PRESET_COLORS, RADII, FONT_DESCRIPCIONES, GOOGLE_FONTS, BG_PATTERNS, BG_PATTERN_SCOPES,
    loadFont, fontStack,
    type Apariencia as Ap, type ModoColor, type EscalaFuente, type LayoutHeader,
    type LayoutGrid as LayoutGridT, type RadioCards, type HeroSlide,
    type ImageStyle, type ImagePosition, type BgPattern, type BgPatternScope,
} from './mock/apariencia.mock'
import { apToUpdateDto, dtoToAp } from './mock/apariencia.mapper'

// Intercambia el elemento en `from` con el que está en `to` — usado para
// reordenar los sliders del hero con las flechas subir/bajar (ver SlideItem).
function moverElemento<T>(arr: T[], from: number, to: number): T[] {
    if (to < 0 || to >= arr.length) return arr
    const next = arr.slice()
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
}

async function subirImagenApariencia(file: File): Promise<string> {
    const r = await panelUploadStorefrontImage(file, file.name)
    return r.url
}

// Variante para la imagen de un slide: además de subir, puede pedirle al
// backend que le quite el fondo antes de convertir a webp (ver
// BackgroundRemovalService en el backend — corre 100% local, sin APIs externas).
function subirImagenSlide(removeBg: boolean) {
    return async (file: File): Promise<string> => {
        const r = await panelUploadStorefrontImage(file, file.name, { removeBackground: removeBg })
        return r.url
    }
}

type IconT = ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>

// ─── Skeleton — misma forma exacta del layout real (mismo criterio que
// mensajes/Bandeja.tsx/Plantillas.tsx), con el shimmer del componente
// compartido design-system/Skeleton.tsx. No replica cada control de cada
// SecCard (serían decenas) sino la forma general: header + N secciones con
// unas pocas líneas cada una + el panel de preview a la derecha. ───────────
function SecCardSkeleton({ lineas }: { lineas: number }) {
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Skeleton width={30} height={30} radius={8} />
                <Skeleton width={140} height={15} radius={8} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: lineas }).map((_, i) => <Skeleton key={i} width="100%" height={38} radius={8} />)}
            </div>
        </div>
    )
}

function AparienciaSkeleton() {
    return (
        <div style={pageWrap}>
            <style>{`
                .ap-split-sk { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 28px; align-items: start; }
                @media (max-width: 1100px) { .ap-split-sk { grid-template-columns: 1fr; } }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                    <Skeleton width={220} height={30} radius={8} style={{ marginBottom: 8 }} />
                    <Skeleton width={320} height={13} radius={8} />
                </div>
                <Skeleton width={140} height={36} radius={8} />
            </div>
            <div className="ap-split-sk">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SecCardSkeleton lineas={5} />
                    <SecCardSkeleton lineas={4} />
                    <SecCardSkeleton lineas={3} />
                    <SecCardSkeleton lineas={4} />
                </div>
                <Skeleton width="100%" height={640} radius={16} />
            </div>
        </div>
    )
}

interface AparienciaProps {
    ir:      (v: VistaConfig) => void
    onToast: (m: string) => void
}

export default function Apariencia({ ir, onToast }: AparienciaProps) {
    const [ap, setApRaw] = useState<Ap>(AP_DEFAULTS)
    const [dirty, setDirty] = useState(false)
    const [fullPreview, setFullPreview] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

    const set = <K extends keyof Ap>(k: K, v: Ap[K]) => { setApRaw(p => ({ ...p, [k]: v })); setDirty(true) }

    // Subdominio real, para la vista previa — antes ahí decía siempre
    // "rama.orbita.shop" fijo, ni fuera el negocio de verdad.
    const [subdomain, setSubdomain] = useState('')

    // El nombre del NEGOCIO es el default del "nombre de la tienda" mientras
    // el dueño no haya guardado uno propio en Apariencia. Antes el default era
    // el del mock ("Rama Indumentaria") y, como se guarda tal cual al tocar
    // "Guardar", terminaba siendo el nombre real de la tienda en la base — y
    // eso era lo que veían sus clientes. Si el pedido del negocio falla, el
    // campo queda vacío (con su placeholder): nunca se inventa una marca.
    useEffect(() => {
        let cancelado = false
        Promise.all([
            panelGetAppearance(),
            panelGetBusiness().catch(() => null),
        ])
            .then(([dto, biz]) => {
                if (cancelado) return
                setApRaw(dtoToAp(dto, { ...AP_DEFAULTS, nombreTienda: biz?.name ?? AP_DEFAULTS.nombreTienda }))
                if (biz?.subdomain) setSubdomain(biz.subdomain)
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la apariencia') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    useEffect(() => { loadFont(ap.fuenteHeading); loadFont(ap.fuenteBody) }, [ap.fuenteHeading, ap.fuenteBody])

    async function guardar() {
        setGuardando(true)
        setErrorGuardado(null)
        try {
            const actualizado = await panelUpdateAppearance(apToUpdateDto(ap))
            setApRaw(dtoToAp(actualizado, AP_DEFAULTS))
            setDirty(false)
            onToast('Cambios guardados y publicados')
        } catch (e) {
            setErrorGuardado(e instanceof ApiError ? e.message : 'No se pudo guardar la apariencia')
        } finally {
            setGuardando(false)
        }
    }
    const fontOpts = Object.keys(GOOGLE_FONTS)

    if (cargando) {
        return <AparienciaSkeleton />
    }

    return (
        <div className="ap-page" style={pageWrap}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Apariencia pública</h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Construí la identidad visual de tu tienda. Los cambios se ven en vivo.</div>
                    {errorCarga && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errorCarga} — se muestran valores por defecto.</div>}
                </div>
                {/* flexWrap acá: en mobile la fila (badge + 2 botones) no
                    entra en una línea — antes se cortaba contra el borde de
                    la pantalla en vez de bajar de línea. */}
                <div className="ap-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: dirty ? 'var(--color-warning-bg)' : 'var(--color-surface-alt)', color: dirty ? 'var(--color-warning)' : 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dirty ? '#F59E0B' : 'var(--color-subtle)' }} />
                        {dirty ? 'Cambios sin guardar' : 'Publicado'}
                    </span>
                    <Button variant="outline" icon={<ExternalLink size={15} />} onClick={() => setFullPreview(true)}>Ver vista previa de diseño</Button>
                    {/* En mobile se saca — la barra flotante de "Tenés cambios
                        sin guardar" de más abajo ya cubre el guardado sin
                        tener que volver arriba, este quedaba de más y era
                        parte de lo que desbordaba la fila. */}
                    <span className="ap-save-header">
                        <Button variant="primary" disabled={!dirty} loading={guardando} onClick={guardar}>Guardar cambios</Button>
                    </span>
                    {errorGuardado && <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{errorGuardado}</div>}
                </div>
            </div>

            <style>{`
                .ap-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 28px; align-items: start; }
                .ap-preview { position: sticky; top: 24px; }
                @media (max-width: 1100px) {
                    .ap-split { grid-template-columns: 1fr; }
                    .ap-preview { position: static; }
                    .ap-preview > div { height: 70vh !important; }
                }
                /* Mobile: la vista previa en vivo no entra al lado (ni
                   siquiera apilada, a 70vh, deja lugar para el editor) — se
                   saca del todo. Sigue disponible con el botón "Vista
                   previa" de arriba (abre el modal a pantalla completa,
                   fullPreview), no se pierde la función, solo el inline. */
                @media (max-width: 768px) {
                    .ap-page { padding: 16px 14px 96px !important; }
                    .ap-preview { display: none !important; }
                    .ap-split { gap: 16px; }
                    .ap-save-header { display: none !important; }
                    .ap-sec-card { padding: 16px !important; }
                }
                /* "¿Qué ven tus clientes?": 2 columnas le queda bien a la
                   preview de escritorio, pero en mobile deja ~120px por
                   columna — labels como "Redes sociales en el footer" no
                   entran ahí sin romperse. A 1 columna. */
                @media (max-width: 640px) {
                    .ap-toggle-grid { grid-template-columns: 1fr !important; }
                }
                @keyframes apStickyBarIn {
                    from { opacity: 0; transform: translate(-50%, 10px); }
                    to   { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
            <div className="ap-split">
                {/* Controles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    <SecCard title="Identidad de marca" icon={Palette}>
                        <FieldLabel help="Aparece en el header, emails y comprobantes">Logo de la tienda</FieldLabel>
                        <ImgUploader value={ap.logo} onChange={v => set('logo', v)} onUpload={subirImagenApariencia} shape="circle" size={96} formats="PNG, JPG, SVG · máx 2MB" />
                        <Divider />
                        <FieldLabel help="Ícono de la pestaña del navegador">Favicon</FieldLabel>
                        <ImgUploader value={ap.favicon} onChange={v => set('favicon', v)} onUpload={subirImagenApariencia} shape="square" size={48} formats="ICO, PNG 32×32" />
                        <Divider />
                        <div style={{ marginBottom: 14 }}><FieldLabel>Nombre de la tienda</FieldLabel><Inp value={ap.nombreTienda} onChange={v => set('nombreTienda', v)} /></div>
                        <div><FieldLabel>Tagline</FieldLabel><Inp value={ap.tagline} onChange={v => set('tagline', v)} maxLength={80} suffix={<span style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>{ap.tagline.length}/80</span>} /></div>
                        <Divider />
                        <FieldLabel help="Carrusel de la página de inicio. Cada slide puede tener imagen, título y llamada a la acción.">Sliders del hero</FieldLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
                            {ap.sliders.map((s, i) => (
                                <SlideItem
                                    key={s.id}
                                    slide={s}
                                    index={i}
                                    defaultOpen={i === 0}
                                    onChange={updated => set('sliders', ap.sliders.map((sl, j) => j === i ? updated : sl))}
                                    onRemove={() => set('sliders', ap.sliders.filter((_, j) => j !== i))}
                                    // El orden del carrusel del hero ES el orden de este array — mover
                                    // un slide es solo intercambiarlo con su vecino. Sin drag-and-drop
                                    // (no hay ninguna librería de DnD en el proyecto todavía): dos
                                    // flechas alcanzan y no suman una dependencia nueva para esto.
                                    canMoveUp={i > 0}
                                    canMoveDown={i < ap.sliders.length - 1}
                                    onMoveUp={() => set('sliders', moverElemento(ap.sliders, i, i - 1))}
                                    onMoveDown={() => set('sliders', moverElemento(ap.sliders, i, i + 1))}
                                />
                            ))}
                            <button
                                onClick={() => set('sliders', [...ap.sliders, { id: 's' + Date.now(), titulo: 'Nuevo slide', subtitulo: '', img: null, cta: 'Ver catálogo', ctaLink: '/catalogo', imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgPatternScope: 'image', bgColor: '' }])}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                <Plus size={14} strokeWidth={2} /> Agregar slide
                            </button>
                        </div>
                    </SecCard>

                    <SecCard title="Paleta de colores" icon={Droplets}>
                        <FieldLabel>Modo de color de la tienda</FieldLabel>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                            {([['claro', 'Claro', Sun], ['oscuro', 'Oscuro', Moon], ['sistema', 'Sistema', Monitor]] as [ModoColor, string, IconT][]).map(([id, l, I]) => {
                                const a = ap.modoColor === id
                                return (
                                    <button key={id} onClick={() => set('modoColor', id)} style={{ padding: '14px 8px', borderRadius: 10, border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                        <I size={18} strokeWidth={1.6} style={{ color: a ? 'var(--color-primary)' : 'var(--color-muted)' }} />
                                        <span style={{ fontSize: 12, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)' }}>{l}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <ColorBlock label="Color primario" help="Botones, links y elementos de acción" value={ap.colorPrimario} onChange={v => set('colorPrimario', v)} />
                        <ColorBlock label="Color secundario" help="Textos y fondos oscuros" value={ap.colorSecundario} onChange={v => set('colorSecundario', v)} />
                        <ColorBlock label="Color de acento" help="Badges y highlights" value={ap.colorAccent} onChange={v => set('colorAccent', v)} />
                        <FieldLabel>Fondo de tienda</FieldLabel>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                            {([['#FFFFFF', 'Blanco puro'], ['#F8FAFC', 'Gris suave'], [ap.colorPrimario + '0D', 'Primario 5%'], ['custom', 'Personalizado']] as [string, string][]).map(([c, l]) => {
                                const a = ap.colorFondo === c
                                return (
                                    <button key={l} onClick={() => set('colorFondo', c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <span style={{ width: 18, height: 18, borderRadius: 4, background: c === 'custom' ? 'conic-gradient(#f00,#0f0,#00f,#f00)' : c, border: '1px solid var(--color-border)' }} />
                                        <span style={{ fontSize: 12, color: 'var(--color-body)' }}>{l}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </SecCard>

                    <SecCard title="Tipografía" icon={Type}>
                        <FieldLabel>Fuente para títulos</FieldLabel>
                        <FontSelect value={ap.fuenteHeading} onChange={v => set('fuenteHeading', v)} opts={fontOpts} />
                        <div style={{ marginTop: 12, marginBottom: 18, padding: '14px 16px', background: 'var(--color-surface-alt)', borderRadius: 8, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', fontFamily: fontStack(ap.fuenteHeading) }}>{ap.nombreTienda}</div>
                        <FieldLabel>Fuente para textos</FieldLabel>
                        <FontSelect value={ap.fuenteBody} onChange={v => set('fuenteBody', v)} opts={fontOpts} />
                        <Divider />
                        <FieldLabel>Escala de texto</FieldLabel>
                        <div style={{ display: 'flex', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3 }}>
                            {([['sm', 'Pequeño'], ['md', 'Mediano'], ['lg', 'Grande']] as [EscalaFuente, string][]).map(([id, l]) => {
                                const a = ap.escalaFuente === id
                                return <button key={id} onClick={() => set('escalaFuente', id)} style={{ flex: 1, height: 34, borderRadius: 5, border: 'none', background: a ? 'var(--color-bg)' : 'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: a ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{l}</button>
                            })}
                        </div>
                    </SecCard>

                    <SecCard title="Diseño y layout" icon={LayoutGrid}>
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
                        <FieldLabel help="Elegí qué enlaces de navegación se muestran en el header. En el estilo Minimal no se muestra navegación.">Elementos del header</FieldLabel>
                        <div style={{ marginBottom: 18, border: '1px solid var(--color-border)', borderRadius: 8, padding: '2px 12px' }}>
                            {ap.headerLinks.map((lnk, i) => (
                                <div key={lnk.id} style={{ borderBottom: i < ap.headerLinks.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <ToggleRow
                                        label={lnk.label}
                                        on={lnk.on}
                                        onChange={v => set('headerLinks', ap.headerLinks.map((x, j) => j === i ? { ...x, on: v } : x))}
                                    />
                                </div>
                            ))}
                        </div>
                        <FieldLabel>Grilla de productos</FieldLabel>
                        <div style={{ marginBottom: 18 }}>
                            <VisualPick value={ap.layoutGrid} onChange={v => set('layoutGrid', v as LayoutGridT)} options={[
                                { id: '3col', label: '3 columnas', svg: hline(<g>{[8, 26, 44].map(x => <rect key={x} x={x} y="10" width="14" height="14" rx="2" fill="var(--color-border)" />)}</g>) },
                                { id: '4col', label: '4 columnas', svg: hline(<g>{[6, 20, 34, 48].map(x => <rect key={x} x={x} y="10" width="10" height="14" rx="2" fill="var(--color-border)" />)}</g>) },
                                { id: 'list', label: 'Lista', svg: hline(<g>{[8, 18, 28].map(y => <rect key={y} x="8" y={y} width="44" height="6" rx="1.5" fill="var(--color-border)" />)}</g>) },
                            ]} />
                        </div>
                        <FieldLabel>Radio de cards</FieldLabel>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {([['none', 'Sin'], ['sm', 'Sm'], ['md', 'Md'], ['lg', 'Lg']] as [RadioCards, string][]).map(([id, l]) => {
                                const a = ap.radioCards === id
                                return (
                                    <button key={id} onClick={() => set('radioCards', id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8, border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <span style={{ width: 32, height: 24, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-strong)', borderRadius: Math.min(RADII[id], 12) }} />
                                        <span style={{ fontSize: 11, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)' }}>{l}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </SecCard>

                    <SecCard title="¿Qué ven tus clientes?" icon={Eye}>
                        <div className="ap-toggle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                            {([['mostrarResenas', 'Opiniones de clientes'], ['mostrarBadgeNuevo', 'Badge "Nuevo"'], ['mostrarBadgeOferta', 'Badge "Oferta" con %'], ['mostrarStockBajo', 'Indicador de stock bajo'], ['mostrarWhatsapp', 'WhatsApp flotante'], ['mostrarBuscador', 'Barra de búsqueda'], ['mostrarCategorias', 'Sección de categorías'], ['mostrarFooter', 'Footer completo'], ['mostrarRedesFooter', 'Redes sociales en el footer'], ['mostrarBannerEnvio', 'Banner debajo del header'], ['mostrarStats', 'Barra de estadísticas debajo del slider']] as [keyof Ap, string][]).map(([k, l]) => (
                                <ToggleRow key={k} label={l} on={ap[k] as boolean} onChange={v => set(k, v as Ap[typeof k])} />
                            ))}
                        </div>
                    </SecCard>

                    <SecCard title="Textos de tu tienda" icon={Type}>
                        <div style={{ marginBottom: 14 }}><FieldLabel help="Se muestra en el banner angosto debajo del header, si está activado en '¿Qué ven tus clientes?'.">Mensaje del banner debajo del header</FieldLabel><Inp value={ap.textoEnvio} onChange={v => set('textoEnvio', v)} /></div>
                        <div><FieldLabel>Texto del botón de WhatsApp</FieldLabel><Inp value={ap.textoWhatsapp} onChange={v => set('textoWhatsapp', v)} maxLength={30} /></div>
                    </SecCard>

                    <SecCard title="Barra de estadísticas" icon={Hash}>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 12px' }}>
                            Aparece debajo del slider del hero, si está activada en "¿Qué ven tus clientes?". Son valores decorativos que escribís vos, no se calculan solos.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                            {ap.stats.map((s, i) => (
                                <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <div style={{ width: 100 }}>
                                        <Inp value={s.value} onChange={v => set('stats', ap.stats.map((x, j) => j === i ? { ...x, value: v } : x))} maxLength={12} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <Inp value={s.label} onChange={v => set('stats', ap.stats.map((x, j) => j === i ? { ...x, label: v } : x))} maxLength={30} />
                                    </div>
                                    <button
                                        onClick={() => set('stats', ap.stats.filter((_, j) => j !== i))}
                                        title="Quitar"
                                        style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'color 150ms, background 150ms' }}
                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {ap.stats.length < 6 && (
                            <button
                                onClick={() => set('stats', [...ap.stats, { id: 'st' + Date.now(), value: '', label: '' }])}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                            >
                                <Plus size={14} strokeWidth={2} /> Agregar estadística
                            </button>
                        )}
                    </SecCard>

                </div>

                {/* Preview sticky */}
                <div className="ap-preview">
                    <StorePreview ap={ap} subdomain={subdomain} />
                </div>
            </div>

            {/* Vista previa completa */}
            {fullPreview && (
                <div onClick={() => setFullPreview(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.70)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: '60px 40px 40px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><ExternalLink size={16} strokeWidth={1.6} /> Vista previa{subdomain ? ` · ${subdomain}.${ROOT_DOMAIN}` : ''}</span>
                            <button onClick={() => setFullPreview(false)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 12, background: 'var(--color-bg)' }}><StorePreview ap={ap} subdomain={subdomain} full /></div>
                    </div>
                </div>
            )}

            {/* Barra flotante de guardado — el botón de arriba queda fuera de
                vista al bajar el scroll (la página es larga), así que con
                cambios sin guardar aparece esto acá abajo para no obligar a
                subir todo de nuevo. Sutil a propósito: solo aparece si hay
                algo sin guardar, no compite con el resto de la UI. */}
            {dirty && !fullPreview && (
                <div style={{
                    position: 'fixed', left: '50%', bottom: 20, zIndex: 80,
                    transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 999, padding: '8px 8px 8px 18px',
                    boxShadow: '0 10px 30px rgba(15,23,42,0.16)',
                    animation: 'apStickyBarIn 220ms ease',
                }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                        Tenés cambios sin guardar
                    </span>
                    {errorGuardado && (
                        <span style={{ fontSize: 12, color: 'var(--color-error)', whiteSpace: 'nowrap' }}>{errorGuardado}</span>
                    )}
                    <Button variant="primary" loading={guardando} onClick={guardar}>Guardar cambios</Button>
                </div>
            )}
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SecCard({ title, icon: I, badge, children }: { title: string; icon: IconT; badge?: ReactNode; children: ReactNode }) {
    return (
        <div className="ap-sec-card" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center' }}><I size={16} strokeWidth={1.6} /></div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: 0, flex: 1 }}>{title}</h3>
                {badge}
            </div>
            {children}
        </div>
    )
}

function FieldLabel({ children, help }: { children: ReactNode; help?: string }) {
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>{children}</div>
            {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
        </div>
    )
}

function Divider() {
    return <div style={{ height: 1, background: 'var(--color-border)', margin: '18px 0' }} />
}

function Inp({ value, onChange, maxLength, suffix, mono, prefix }: { value: string; onChange: (v: string) => void; maxLength?: number; suffix?: ReactNode; mono?: boolean; prefix?: ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', gap: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            {prefix}
            <input value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit', minWidth: 0 }} />
            {suffix}
        </div>
    )
}

function ColorBlock({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (v: string) => void }) {
    const [custom, setCustom] = useState(!PRESET_COLORS.includes(value))
    return (
        <div style={{ marginBottom: 20 }}>
            <FieldLabel help={help}>{label}</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => { onChange(c); setCustom(false) }} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: 'none', outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer' }} />
                ))}
                <button onClick={() => setCustom(true)} title="Personalizado" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${custom ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={14} strokeWidth={2} /></button>
            </div>
            {custom && (
                <div style={{ marginBottom: 10, maxWidth: 200 }}>
                    <Inp value={value} onChange={v => { if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v) }} mono prefix={<span style={{ width: 20, height: 20, borderRadius: 5, background: /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#ccc', flexShrink: 0 }} />} />
                </div>
            )}
            <button style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: value, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Botón de ejemplo</button>
        </div>
    )
}

function hline(c: ReactNode) {
    return <svg width="60" height="34" viewBox="0 0 60 34">{c}</svg>
}

function VisualPick({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string; svg: ReactNode }[] }) {
    return (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {options.map(o => {
                const a = value === o.id
                return (
                    <button key={o.id} onClick={() => onChange(o.id)} style={{ width: 120, borderRadius: 10, border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', padding: 8, fontFamily: 'inherit' }}>
                        <div style={{ height: 52, display: 'grid', placeItems: 'center' }}>{o.svg}</div>
                        <div style={{ fontSize: 12, fontWeight: a ? 600 : 500, color: a ? 'var(--color-primary)' : 'var(--color-body)', marginTop: 6 }}>{o.label}</div>
                    </button>
                )
            })}
        </div>
    )
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{label}</div>
            <button type="button" onClick={() => onChange(!on)} style={{ width: 40, height: 22, borderRadius: 11, border: on ? 'none' : '1px solid var(--color-border)', background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', position: 'relative', flexShrink: 0, cursor: 'pointer', padding: 0 }}>
                <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.18)', transition: 'left 200ms' }} />
            </button>
        </label>
    )
}

function FontSelect({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const c = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        window.addEventListener('mousedown', c)
        return () => window.removeEventListener('mousedown', c)
    }, [open])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(!open)} style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 1, fontFamily: fontStack(value) }}>{value}</span>
                {value === 'Geist' && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>★</span>}
                <ChevronDown size={14} strokeWidth={1.5} style={{ opacity: 0.6 }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, maxHeight: 280, overflowY: 'auto' }}>
                    {opts.map(f => {
                        loadFont(f)
                        return (
                            <button key={f} onClick={() => { onChange(f); setOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', background: value === f ? 'var(--color-surface-alt)' : 'transparent', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, color: 'var(--color-text)', fontFamily: fontStack(f) }}>{f}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{FONT_DESCRIPCIONES[f]}</div>
                                </div>
                                {value === f && <Check size={14} strokeWidth={2.4} style={{ color: 'var(--color-primary)' }} />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── SlideItem — componente de edición de un slide del hero ─────────────────

const SLIDE_GRADS = [
    'linear-gradient(135deg,#0F172A,#1D4ED8)',
    'linear-gradient(135deg,#1E1B4B,#7C3AED)',
    'linear-gradient(135deg,#052E2B,#10B981)',
]

function SlideItem({ slide, index, defaultOpen, onChange, onRemove, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: {
    slide: HeroSlide; index: number; defaultOpen?: boolean
    onChange: (s: HeroSlide) => void; onRemove: () => void
    canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void
}) {
    const [open, setOpen] = useState(!!defaultOpen)
    const [removeBg, setRemoveBg] = useState(false)
    const centrada = slide.imageStyle === 'centered'

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header colapsable */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-surface)', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
                <span style={{ width: 40, height: 28, borderRadius: 6, background: SLIDE_GRADS[index % SLIDE_GRADS.length], flexShrink: 0, ...(slide.img ? { backgroundImage: `url(${slide.img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Slide {index + 1}: {slide.titulo || 'Sin título'}</span>
                {/* Orden — mismas flechas que ordenan la lista, sin drag and
                    drop (no hay ninguna librería de DnD en el proyecto). */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={onMoveUp} disabled={!canMoveUp} title="Mover arriba"
                        style={{ width: 18, height: 13, borderRadius: 3, border: 'none', background: 'transparent', color: canMoveUp ? 'var(--color-muted)' : 'var(--color-subtle)', cursor: canMoveUp ? 'pointer' : 'not-allowed', display: 'grid', placeItems: 'center', opacity: canMoveUp ? 1 : 0.4 }}
                        onMouseEnter={e => { if (canMoveUp) e.currentTarget.style.color = 'var(--color-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = canMoveUp ? 'var(--color-muted)' : 'var(--color-subtle)' }}>
                        <ArrowUp size={11} strokeWidth={2} />
                    </button>
                    <button onClick={onMoveDown} disabled={!canMoveDown} title="Mover abajo"
                        style={{ width: 18, height: 13, borderRadius: 3, border: 'none', background: 'transparent', color: canMoveDown ? 'var(--color-muted)' : 'var(--color-subtle)', cursor: canMoveDown ? 'pointer' : 'not-allowed', display: 'grid', placeItems: 'center', opacity: canMoveDown ? 1 : 0.4 }}
                        onMouseEnter={e => { if (canMoveDown) e.currentTarget.style.color = 'var(--color-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = canMoveDown ? 'var(--color-muted)' : 'var(--color-subtle)' }}>
                        <ArrowDown size={11} strokeWidth={2} />
                    </button>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--color-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }} />
                <button onClick={e => { e.stopPropagation(); onRemove() }} title="Eliminar slide"
                    style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'color 150ms, background 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}>
                    <Trash2 size={12} strokeWidth={1.8} />
                </button>
            </div>
            {/* Contenido */}
            {open && (
                <div style={{ padding: '14px' }}>
                    <FieldLabel help="Imagen de fondo del slide (1440×600px recomendado)">Imagen del slide</FieldLabel>
                    <ImgUploader value={slide.img} onChange={v => onChange({ ...slide, img: v })} onUpload={subirImagenSlide(removeBg)} shape="square" size={80} formats="JPG, PNG · máx 4MB" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12.5, color: 'var(--color-body)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={removeBg} onChange={e => setRemoveBg(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
                        Quitar el fondo automáticamente al subir esta imagen
                    </label>

                    <Divider />
                    <FieldLabel help="Elegí si la foto ocupa todo el slide, o queda centrada sobre un fondo de color con un patrón decorativo — ideal para fotos con el fondo ya quitado.">Estilo de imagen</FieldLabel>
                    <div style={{ marginBottom: 14 }}>
                        <VisualPick value={slide.imageStyle} onChange={v => onChange({ ...slide, imageStyle: v as ImageStyle })} options={[
                            {
                                id: 'full', label: 'Imagen completa',
                                svg: hline(<g>
                                    <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-border-strong)" />
                                    <rect x="6" y="22" width="26" height="6" rx="1.5" fill="rgba(255,255,255,0.85)" />
                                </g>),
                            },
                            {
                                id: 'centered', label: 'Imagen centrada',
                                svg: hline(<g>
                                    <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" stroke="var(--color-border)" />
                                    <rect x="6" y="8" width="16" height="4" rx="1.5" fill="var(--color-muted)" />
                                    <rect x="6" y="15" width="22" height="4" rx="1.5" fill="var(--color-border)" />
                                    <circle cx="45" cy="17" r="10" fill="var(--color-primary)" opacity="0.7" />
                                </g>),
                            },
                        ]} />
                    </div>

                    {centrada && (
                        <>
                            <FieldLabel>Posición de la imagen</FieldLabel>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                                {([['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] as [ImagePosition, string][]).map(([id, l]) => {
                                    const a = slide.imagePosition === id
                                    return (
                                        <button key={id} onClick={() => onChange({ ...slide, imagePosition: id })} style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12.5, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                                    )
                                })}
                            </div>

                            <FieldLabel help="Figuras decorativas detrás de la imagen">Patrón de fondo</FieldLabel>
                            <div style={{ marginBottom: 18 }}>
                                <VisualPick value={slide.bgPattern} onChange={v => onChange({ ...slide, bgPattern: v as BgPattern })} options={BG_PATTERNS.map(p => ({ id: p.id, label: p.label, svg: patternPreview(p.id) }))} />
                            </div>

                            {slide.bgPattern !== 'none' && (
                                <div style={{ marginBottom: 18 }}>
                                    <FieldLabel help="Elegí si el patrón se concentra alrededor de la imagen (y la sigue si cambiás su posición) o si cubre el slide entero parejo.">Alcance del patrón</FieldLabel>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {BG_PATTERN_SCOPES.map(sc => {
                                            const a = (slide.bgPatternScope ?? 'image') === sc.id
                                            return (
                                                <button key={sc.id} title={sc.help} onClick={() => onChange({ ...slide, bgPatternScope: sc.id as BgPatternScope })} style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12.5, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{sc.label}</button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <SlideBgColorPicker value={slide.bgColor} onChange={v => onChange({ ...slide, bgColor: v })} />
                        </>
                    )}

                    <Divider />
                    <div><FieldLabel>Título</FieldLabel><Inp value={slide.titulo} onChange={v => onChange({ ...slide, titulo: v })} /></div>
                    <div style={{ marginTop: 10 }}><FieldLabel>Subtítulo</FieldLabel><Inp value={slide.subtitulo} onChange={v => onChange({ ...slide, subtitulo: v })} /></div>
                    <div style={{ marginTop: 10 }}><FieldLabel>Texto del botón CTA</FieldLabel><Inp value={slide.cta} onChange={v => onChange({ ...slide, cta: v })} maxLength={30} /></div>
                    <div style={{ marginTop: 10 }}>
                        <FieldLabel help="A dónde lleva al hacer click. Ej: /catalogo, /catalogo/camperas, o una URL completa">Link del botón</FieldLabel>
                        <Inp value={slide.ctaLink} onChange={v => onChange({ ...slide, ctaLink: v })} />
                    </div>
                </div>
            )}
        </div>
    )
}

// Mini-previews del patrón decorativo para el VisualPick de "Patrón de fondo".
function patternPreview(id: BgPattern): ReactNode {
    switch (id) {
        case 'rings':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7">
                <circle cx="42" cy="17" r="14" strokeWidth="1.5" />
                <circle cx="42" cy="17" r="9" strokeWidth="1.5" />
                <circle cx="42" cy="17" r="4" strokeWidth="1.5" />
            </g>)
        case 'dots':
            return hline(<g fill="var(--color-primary)" opacity="0.6">
                {[0, 1, 2, 3].flatMap(row => [0, 1, 2, 3, 4].map(col => (
                    <circle key={`${row}-${col}`} cx={8 + col * 11} cy={5 + row * 8} r="1.4" />
                )))}
            </g>)
        case 'waves':
            return hline(<g fill="var(--color-primary)" opacity="0.55">
                <ellipse cx="20" cy="24" rx="16" ry="9" />
                <ellipse cx="42" cy="12" rx="14" ry="8" />
            </g>)
        case 'diagonal':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <polygon points="35,2 58,2 58,32 20,32" fill="var(--color-primary)" opacity="0.55" />
            </g>)
        case 'grid':
            return hline(<g stroke="var(--color-primary)" opacity="0.55" strokeWidth="1">
                {[10, 20, 30, 40, 50].map(x => <line key={`v${x}`} x1={x} y1="2" x2={x} y2="32" />)}
                {[8, 16, 24].map(y => <line key={`h${y}`} x1="2" y1={y} x2="58" y2={y} />)}
            </g>)
        case 'stripes':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <g stroke="var(--color-primary)" strokeWidth="2" opacity="0.55">
                    <line x1="6" y1="32" x2="20" y2="2" /><line x1="18" y1="32" x2="32" y2="2" />
                    <line x1="30" y1="32" x2="44" y2="2" /><line x1="42" y1="32" x2="56" y2="2" />
                </g>
            </g>)
        case 'confetti':
            return hline(<g fill="var(--color-primary)" opacity="0.6">
                <circle cx="8" cy="8" r="2" /><rect x="20" y="20" width="4" height="4" transform="rotate(20 22 22)" />
                <circle cx="36" cy="10" r="2" /><rect x="46" y="22" width="4" height="4" transform="rotate(20 48 24)" />
                <circle cx="52" cy="6" r="2" /><rect x="12" y="26" width="4" height="4" transform="rotate(20 14 28)" />
            </g>)
        case 'halo':
            return hline(<g>
                <rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" />
                <circle cx="30" cy="17" r="15" fill="var(--color-primary)" opacity="0.35" />
                <circle cx="30" cy="17" r="7" fill="var(--color-primary)" opacity="0.4" />
            </g>)
        case 'arc':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7" strokeWidth="2">
                <path d="M6 30a24 24 0 0 1 48 0" />
                <path d="M15 30a15 15 0 0 1 30 0" />
            </g>)
        case 'plus':
            return hline(<g stroke="var(--color-primary)" opacity="0.6" strokeWidth="1.4">
                <path d="M10 5v8M6 9h8" /><path d="M46 8v8M42 12h8" /><path d="M28 20v8M24 24h8" />
            </g>)
        // Los 3 de acá abajo se mueven en la tienda real (burbujas flotando,
        // destellos titilando, anillos girando) — la miniatura del selector
        // se queda quieta, es solo una referencia visual del ícono.
        case 'bubbles':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.65" strokeWidth="1.3">
                <circle cx="12" cy="26" r="5" /><circle cx="26" cy="12" r="3.5" />
                <circle cx="40" cy="22" r="4.5" /><circle cx="52" cy="9" r="3" />
            </g>)
        case 'sparkle':
            return hline(<g fill="var(--color-primary)" opacity="0.65">
                <path d="M12 4l1.6 5L19 11l-5.4 2-1.6 5-1.6-5L5 11l5.4-2z" />
                <path d="M42 15l1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1z" />
                <path d="M28 22l1.3 4 4 1.3-4 1.3-1.3 4-1.3-4-4-1.3 4-1.3z" />
            </g>)
        case 'orbit':
            return hline(<g fill="none" stroke="var(--color-primary)" opacity="0.7">
                <circle cx="30" cy="17" r="14" strokeWidth="1.4" strokeDasharray="2 4" />
                <circle cx="30" cy="17" r="8" strokeWidth="1.4" strokeDasharray="2 3" />
                <circle cx="44" cy="17" r="2" fill="var(--color-primary)" stroke="none" />
            </g>)
        default:
            return hline(<rect x="2" y="2" width="56" height="30" rx="2" fill="var(--color-surface-alt)" stroke="var(--color-border)" />)
    }
}

// Color de fondo propio del slide — variante de ColorBlock con un chip extra
// para volver a "sin color" (cae al degradé de tema, comportamiento de siempre).
function SlideBgColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [custom, setCustom] = useState(value !== '' && !PRESET_COLORS.includes(value))
    return (
        <div style={{ marginBottom: 20 }}>
            <FieldLabel help="Si no elegís uno, se usa el degradé del tema como hasta ahora">Color de fondo del slide</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button onClick={() => { onChange(''); setCustom(false) }} title="Usar degradé del tema"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${value === '' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <X size={13} style={{ color: 'var(--color-muted)' }} />
                </button>
                {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => { onChange(c); setCustom(false) }} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: 'none', outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer' }} />
                ))}
                <button onClick={() => setCustom(true)} title="Personalizado" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface-alt)', border: `1.5px dashed ${custom ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={14} strokeWidth={2} /></button>
            </div>
            {custom && (
                <div style={{ maxWidth: 200 }}>
                    <Inp value={value} onChange={v => { if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v) }} mono prefix={<span style={{ width: 20, height: 20, borderRadius: 5, background: /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#ccc', flexShrink: 0 }} />} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
