import type { CSSProperties } from 'react'
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react'
import { parseVideoEmbed } from '@/lib/storefront/utils'
import type { VideoItem, VideoLayout } from '../../mock/apariencia.mock'
import { FieldLabel, Inp } from './Controles'
import { ImgUploader } from './ImgUploader'
import { VideoUploader, esVideoArchivo } from './VideoUploader'
import { subirImagenApariencia, subirVideoApariencia } from './utils'

// Editor de la lista de videos de la sección. Cada video es un bloque con su
// link (o archivo subido) y, abajo, el texto que lo acompaña. Mismo tope que
// el DTO del backend (ArrayMaxSize(12)).
const MAX_VIDEOS = 12
export function EditorVideos({ videos, layout, onChange, onToast }: { videos: VideoItem[]; layout: VideoLayout; onChange: (v: VideoItem[]) => void; onToast: (m: string) => void }) {
    const upd = (i: number, cambio: Partial<VideoItem>) => onChange(videos.map((x, j) => j === i ? { ...x, ...cambio } : x))
    const mover = (i: number, d: -1 | 1) => {
        const j = i + d
        if (j < 0 || j >= videos.length) return
        const copia = [...videos]
        ;[copia[i], copia[j]] = [copia[j], copia[i]]
        onChange(copia)
    }
    // 'reels' solo muestra el título debajo de cada video: no se piden
    // texto ni botón que no se van a ver.
    const usaTexto = layout !== 'reels'
    const btnIcono: CSSProperties = { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
    return (
        <>
            <FieldLabel help={layout === 'reels' ? 'Para este diseño quedan mejor los videos filmados con el celular parado (9:16), como reels o TikToks.' : 'El título y el texto acompañan a cada video. El botón es opcional.'}>
                Videos
            </FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                {videos.map((v, i) => {
                    const primero = i === 0
                    const ultimo = i === videos.length - 1
                    return (
                        <div key={v.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Video {i + 1}</span>
                                <button onClick={() => mover(i, -1)} disabled={primero} className="ds-hover" aria-label="Subir" title="Subir" style={{ ...btnIcono, opacity: primero ? 0.35 : 1, cursor: primero ? 'default' : 'pointer' }}><ArrowUp size={14} /></button>
                                <button onClick={() => mover(i, 1)} disabled={ultimo} className="ds-hover" aria-label="Bajar" title="Bajar" style={{ ...btnIcono, opacity: ultimo ? 0.35 : 1, cursor: ultimo ? 'default' : 'pointer' }}><ArrowDown size={14} /></button>
                                <button
                                    onClick={() => onChange(videos.filter((_, j) => j !== i))}
                                    aria-label={`Quitar video ${i + 1}`} title="Quitar"
                                    style={btnIcono}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                                ><Trash2 size={14} /></button>
                            </div>
                            {/* Con un archivo ya subido, el link es el de R2
                                (armado por el uploader): el campo se oculta
                                hasta que lo quite con la papelera del uploader.
                                Con un link pegado, el uploader no aparece. */}
                            {!esVideoArchivo(v.url) && (
                                <div style={{ marginBottom: 10 }}>
                                    <Inp value={v.url} onChange={x => upd(i, { url: x })} placeholder="Link de YouTube, Vimeo o .mp4" />
                                    {v.url.trim() !== '' && !parseVideoEmbed(v.url) && (
                                        <p style={{ fontSize: 11.5, color: 'var(--color-error)', margin: '5px 0 0' }}>
                                            No reconocemos este link. Probá con uno de YouTube, de Vimeo, o que termine en .mp4
                                        </p>
                                    )}
                                </div>
                            )}
                            {(esVideoArchivo(v.url) || v.url.trim() === '') && (
                                <div style={{ marginBottom: 12 }}>
                                    <VideoUploader value={v.url} onChange={x => upd(i, { url: x })} onUpload={subirVideoApariencia} maxMB={500} />
                                </div>
                            )}
                            {/* Portada opcional. En Verticales se pide parada
                                (9:16): con un video horizontal es lo que evita
                                que el cuadro se vea recortado. */}
                            <div style={{ marginBottom: 12 }}>
                                <FieldLabel help={layout === 'reels' ? 'Opcional. Una imagen parada (9:16) queda mejor en este diseño, sobre todo si el video es horizontal.' : 'Opcional. Se ve antes de darle play, en vez del primer cuadro del video.'}>Portada</FieldLabel>
                                <ImgUploader value={v.portada} onChange={x => upd(i, { portada: x })} onUpload={subirImagenApariencia} shape="square" size={64} formats="JPG, PNG o HEIC · máx 10MB" onToast={onToast} />
                            </div>
                            <div style={{ marginBottom: usaTexto ? 8 : 0 }}><Inp value={v.titulo} onChange={x => upd(i, { titulo: x })} maxLength={120} placeholder="Título (opcional)" /></div>
                            {usaTexto && (
                                <>
                                    <div style={{ marginBottom: 8 }}><Inp value={v.texto} onChange={x => upd(i, { texto: x })} maxLength={400} placeholder="Texto (opcional)" /></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
                                        <Inp value={v.ctaTexto} onChange={x => upd(i, { ctaTexto: x })} maxLength={40} placeholder="Botón: Ver más" />
                                        <Inp value={v.ctaLink} onChange={x => upd(i, { ctaLink: x })} maxLength={500} placeholder="Link: /catalogo" />
                                    </div>
                                </>
                            )}
                        </div>
                    )
                })}
            </div>
            {videos.length < MAX_VIDEOS && (
                <button
                    onClick={() => onChange([...videos, { id: 'vd' + Date.now(), url: '', titulo: '', texto: '', ctaTexto: '', ctaLink: '', portada: null }])}
                    className="ds-hover"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                    <Plus size={14} strokeWidth={2} /> Agregar video
                </button>
            )}
        </>
    )
}
