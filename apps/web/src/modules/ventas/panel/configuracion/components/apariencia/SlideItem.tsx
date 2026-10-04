// ─── SlideItem — componente de edición de un slide del hero ─────────────────

import { useState } from 'react'
import { ArrowUp, ArrowDown, ChevronDown, Trash2 } from 'lucide-react'
import {
    BG_PATTERNS, BG_PATTERN_SCOPES, IMAGE_OVERLAYS,
    type HeroSlide, type ImageStyle, type ImagePosition, type ImageOverlay, type BgPattern, type BgPatternScope,
} from '../../mock/apariencia.mock'
import { SlideBgColorPicker } from './ColorPickers'
import { Divider, FieldLabel, Inp } from './Controles'
import { ImgUploader } from './ImgUploader'
import { VisualPick } from './VisualPick'
import { hline, overlayPreview, patternPreview } from './miniaturas'
import { subirImagenSlide } from './utils'

const SLIDE_GRADS = [
    'linear-gradient(135deg,#0F172A,#1D4ED8)',
    'linear-gradient(135deg,#1E1B4B,#7C3AED)',
    'linear-gradient(135deg,#052E2B,#10B981)',
]

export function SlideItem({ slide, index, defaultOpen, onChange, onRemove, canMoveUp, canMoveDown, onMoveUp, onMoveDown, soloTexto, etiqueta = 'Slide', onToast }: {
    slide: HeroSlide; index: number; defaultOpen?: boolean
    onChange: (s: HeroSlide) => void; onRemove: () => void
    canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void
    onToast: (m: string) => void
    // Con una plantilla de Home activa (ver Apariencia.tsx soloContenido): el
    // estilo/posición/patrón/color de fondo del slide son decisiones de LA
    // PLANTILLA (su identidad visual fija, ver skill plantillas-home), no del
    // dueño — mostrarlos acá invitaría a romper el diseño que la plantilla
    // ya definió. Solo imagen + texto quedan editables.
    soloTexto?: boolean
    // "Imagen" en vez de "Slide" para una plantilla sin rotación (Escaparate,
    // ver heroNoRotativo en Apariencia.tsx) — son dos posiciones fijas, no
    // slides de un carrusel, y llamarlas "slide" ahí sugiere algo que el
    // diseño de esa plantilla no tiene.
    etiqueta?: string
}) {
    const [open, setOpen] = useState(!!defaultOpen)
    const [removeBg, setRemoveBg] = useState(false)
    const centrada = slide.imageStyle === 'centered'

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header colapsable */}
            <div className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-surface)', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
                <span style={{ width: 40, height: 28, borderRadius: 6, background: SLIDE_GRADS[index % SLIDE_GRADS.length], flexShrink: 0, ...(slide.img ? { backgroundImage: `url(${slide.img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etiqueta} {index + 1}: {slide.titulo || 'Sin título'}</span>
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
                <button onClick={e => { e.stopPropagation(); onRemove() }} title={`Eliminar ${etiqueta.toLowerCase()}`}
                    style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'color 150ms, background 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}>
                    <Trash2 size={12} strokeWidth={1.8} />
                </button>
            </div>
            {/* Contenido */}
            {open && (
                <div style={{ padding: '14px' }}>
                    <FieldLabel help={`Imagen de fondo de ${etiqueta === 'Imagen' ? 'esta posición' : 'este slide'} (1440×600px recomendado)`}>Imagen{etiqueta === 'Imagen' ? '' : ' del slide'}</FieldLabel>
                    <ImgUploader value={slide.img} onChange={v => onChange({ ...slide, img: v })} onUpload={subirImagenSlide(removeBg)} shape="square" size={80} formats="JPG, PNG o HEIC · máx 10MB" onToast={onToast} />
                    {/* Pedido explícito (24/09/2026): habilitado SOLO con "Imagen
                        centrada" — es el único estilo pensado para una foto sin
                        fondo (queda compuesta sobre el patrón decorativo). Con
                        "Imagen completa" no tiene sentido (la foto ocupa todo el
                        slide) y queda deshabilitado. El backend
                        (uploadStorefrontImage en businesses.service.ts) sigue
                        andando con el modelo local sin cambios — esto es solo un
                        límite de UI, no del "Fondo con IA"/mantenimiento de
                        producto (ver products.service.ts / image-studio.service.ts).

                        Con `soloTexto` (plantilla avanzada activa, ver el
                        comentario de esa prop más abajo) el checkbox entero se
                        saca, no alcanza con deshabilitarlo: el hero de una
                        plantilla avanzada SIEMPRE muestra la foto a pantalla
                        completa, nunca "centrada sobre un patrón" (ese estilo
                        ni existe ahí, ver homes.tsx/plantillaReal.ts), así que
                        quitar el fondo dejaría un recorte flotando sobre nada
                        en un slot pensado para una foto entera. Sin este gate,
                        un slide que quedó en 'centered' desde antes de activar
                        la plantilla (dato que este modo ya no deja cambiar)
                        mostraba `centrada` en true y el checkbox aparecía
                        habilitado, como si aplicara (reportado con captura). */}
                    {!soloTexto && (
                    <label
                        className="ds-hover"
                        title={centrada ? undefined : 'Solo aplica con el estilo "Imagen centrada"'}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12.5, color: centrada ? 'var(--color-body)' : 'var(--color-muted)', borderRadius: 6, cursor: centrada ? 'pointer' : 'not-allowed' }}
                    >
                        <input type="checkbox" checked={centrada && removeBg} disabled={!centrada} onChange={e => setRemoveBg(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
                        Quitar el fondo automáticamente al subir esta imagen{centrada ? '' : ' (solo con "Imagen centrada")'}
                    </label>
                    )}

                    {!soloTexto && (<>
                    <Divider />
                    <FieldLabel help="Elegí si la foto ocupa todo el slide, o queda centrada sobre un fondo de color con un patrón decorativo, ideal para fotos con el fondo ya quitado.">Estilo de imagen</FieldLabel>
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

                    {/* Solo tiene sentido con la foto ocupando todo el slide
                        — en 'centrada' no hay velo sobre la imagen, el fondo
                        lo maneja "Patrón de fondo" de más abajo. Pedido
                        explícito: antes el velo (tinte + puntos) era fijo,
                        siempre igual — ahora es una elección. */}
                    {!centrada && (
                        <div style={{ marginBottom: 18 }}>
                            <FieldLabel help="Qué se ve encima de la foto para que el texto resalte. 'Ninguno' deja la foto tal cual, sin nada encima.">Overlay de imagen</FieldLabel>
                            <VisualPick value={slide.imageOverlay ?? 'tint'} onChange={v => onChange({ ...slide, imageOverlay: v as ImageOverlay })} options={IMAGE_OVERLAYS.map(o => ({ id: o.id, label: o.label, svg: overlayPreview(o.id) }))} />
                        </div>
                    )}

                    {centrada && (
                        <>
                            <FieldLabel>Posición de la imagen</FieldLabel>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                                {([['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] as [ImagePosition, string][]).map(([id, l]) => {
                                    const a = slide.imagePosition === id
                                    return (
                                        <button key={id} onClick={() => onChange({ ...slide, imagePosition: id })} className="ds-hover" style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12.5, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
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
                                                <button key={sc.id} title={sc.help} onClick={() => onChange({ ...slide, bgPatternScope: sc.id as BgPatternScope })} className="ds-hover" style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: a ? 'var(--color-primary)' : 'var(--color-body)', fontSize: 12.5, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{sc.label}</button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <SlideBgColorPicker value={slide.bgColor} onChange={v => onChange({ ...slide, bgColor: v })} />
                        </>
                    )}
                    </>)}

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
