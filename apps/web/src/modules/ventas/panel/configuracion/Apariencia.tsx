// src/modules/ventas/panel/configuracion/Apariencia.tsx — Vista 16
// Apariencia pública de la tienda: identidad de marca, paleta, tipografía,
// layout, visibilidad, textos y CSS custom — con vista previa en vivo.

import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Palette, Type, LayoutGrid, Eye, Droplets, Sun, Moon, Monitor, ExternalLink, Plus, Check, ChevronDown, X, Trash2 } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { ApiError, panelGetAppearance, panelUpdateAppearance, panelUploadStorefrontImage } from '@/lib/api'

import { ConfigTabs, type VistaConfig } from './components/ConfigTabs'
import { ImgUploader } from './components/apariencia/ImgUploader'
import { StorePreview } from './components/apariencia/StorePreview'
import {
    AP_DEFAULTS, PRESET_COLORS, RADII, FONT_DESCRIPCIONES, GOOGLE_FONTS,
    loadFont, fontStack,
    type Apariencia as Ap, type ModoColor, type EscalaFuente, type LayoutHeader,
    type LayoutGrid as LayoutGridT, type RadioCards, type HeroSlide,
} from './mock/apariencia.mock'
import { apToUpdateDto, dtoToAp } from './mock/apariencia.mapper'

async function subirImagenApariencia(file: File): Promise<string> {
    const r = await panelUploadStorefrontImage(file, file.name)
    return r.url
}

type IconT = ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>

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

    useEffect(() => {
        let cancelado = false
        panelGetAppearance()
            .then(dto => { if (!cancelado) setApRaw(dtoToAp(dto, AP_DEFAULTS)) })
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
    const hline = (c: ReactNode) => <svg width="60" height="34" viewBox="0 0 60 34">{c}</svg>

    if (cargando) {
        return (
            <div style={pageWrap}>
                <ConfigTabs activo="apariencia" ir={ir} />
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 24px' }}>Apariencia pública</h1>
                <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>Cargando apariencia…</div>
            </div>
        )
    }

    return (
        <div style={pageWrap}>
            <ConfigTabs activo="apariencia" ir={ir} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Apariencia pública</h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Construí la identidad visual de tu tienda. Los cambios se ven en vivo.</div>
                    {errorCarga && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errorCarga} — se muestran valores por defecto.</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: dirty ? 'var(--color-warning-bg)' : 'var(--color-surface-alt)', color: dirty ? 'var(--color-warning)' : 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dirty ? '#F59E0B' : 'var(--color-subtle)' }} />
                        {dirty ? 'Cambios sin guardar' : 'Publicado'}
                    </span>
                    <Button variant="outline" icon={<ExternalLink size={15} />} onClick={() => setFullPreview(true)}>Vista previa</Button>
                    <Button variant="primary" disabled={!dirty} loading={guardando} onClick={guardar}>Guardar cambios</Button>
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
                                />
                            ))}
                            <button
                                onClick={() => set('sliders', [...ap.sliders, { id: 's' + Date.now(), titulo: 'Nuevo slide', subtitulo: '', img: null, cta: 'Ver catálogo' }])}
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                            {([['mostrarResenas', 'Opiniones de clientes'], ['mostrarBadgeNuevo', 'Badge "Nuevo"'], ['mostrarBadgeOferta', 'Badge "Oferta" con %'], ['mostrarStockBajo', 'Indicador de stock bajo'], ['mostrarWhatsapp', 'WhatsApp flotante'], ['mostrarBuscador', 'Barra de búsqueda'], ['mostrarCategorias', 'Sección de categorías'], ['mostrarFooter', 'Footer completo']] as [keyof Ap, string][]).map(([k, l]) => (
                                <ToggleRow key={k} label={l} on={ap[k] as boolean} onChange={v => set(k, v as Ap[typeof k])} />
                            ))}
                        </div>
                    </SecCard>

                    <SecCard title="Textos de tu tienda" icon={Type}>
                        <div style={{ marginBottom: 14 }}><FieldLabel>Texto del botón principal</FieldLabel><Inp value={ap.textoCTA} onChange={v => set('textoCTA', v)} maxLength={30} /></div>
                        <div style={{ marginBottom: 14 }}><FieldLabel>Texto de información de envíos</FieldLabel><Inp value={ap.textoEnvio} onChange={v => set('textoEnvio', v)} /></div>
                        <div><FieldLabel>Texto del botón de WhatsApp</FieldLabel><Inp value={ap.textoWhatsapp} onChange={v => set('textoWhatsapp', v)} maxLength={30} /></div>
                    </SecCard>

                </div>

                {/* Preview sticky */}
                <div className="ap-preview">
                    <StorePreview ap={ap} />
                </div>
            </div>

            {/* Vista previa completa */}
            {fullPreview && (
                <div onClick={() => setFullPreview(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.70)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: '60px 40px 40px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><ExternalLink size={16} strokeWidth={1.6} /> Vista previa · rama.orbita.shop</span>
                            <button onClick={() => setFullPreview(false)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 12, background: 'var(--color-bg)' }}><StorePreview ap={ap} full /></div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SecCard({ title, icon: I, badge, children }: { title: string; icon: IconT; badge?: ReactNode; children: ReactNode }) {
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
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

function SlideItem({ slide, index, defaultOpen, onChange, onRemove }: {
    slide: HeroSlide; index: number; defaultOpen?: boolean
    onChange: (s: HeroSlide) => void; onRemove: () => void
}) {
    const [open, setOpen] = useState(!!defaultOpen)

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header colapsable */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-surface)', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
                <span style={{ width: 40, height: 28, borderRadius: 6, background: SLIDE_GRADS[index % SLIDE_GRADS.length], flexShrink: 0, ...(slide.img ? { backgroundImage: `url(${slide.img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Slide {index + 1}: {slide.titulo || 'Sin título'}</span>
                <ChevronDown size={14} style={{ color: 'var(--color-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }} />
                <button onClick={e => { e.stopPropagation(); onRemove() }} title="Eliminar slide"
                    style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Trash2 size={12} strokeWidth={1.8} />
                </button>
            </div>
            {/* Contenido */}
            {open && (
                <div style={{ padding: '14px' }}>
                    <FieldLabel help="Imagen de fondo del slide (1440×600px recomendado)">Imagen del slide</FieldLabel>
                    <ImgUploader value={slide.img} onChange={v => onChange({ ...slide, img: v })} onUpload={subirImagenApariencia} shape="square" size={80} formats="JPG, PNG · máx 4MB" />
                    <div style={{ marginTop: 12 }}><FieldLabel>Título</FieldLabel><Inp value={slide.titulo} onChange={v => onChange({ ...slide, titulo: v })} /></div>
                    <div style={{ marginTop: 10 }}><FieldLabel>Subtítulo</FieldLabel><Inp value={slide.subtitulo} onChange={v => onChange({ ...slide, subtitulo: v })} /></div>
                    <div style={{ marginTop: 10 }}><FieldLabel>Texto del botón CTA</FieldLabel><Inp value={slide.cta} onChange={v => onChange({ ...slide, cta: v })} maxLength={30} /></div>
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
