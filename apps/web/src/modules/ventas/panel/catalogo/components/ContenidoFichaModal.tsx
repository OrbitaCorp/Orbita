import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { ApiError, panelGetProductFull, panelPresignProductVideo, panelUpdateProductContent, type ApiProductContentBlock } from '@/lib/api'
import { parseVideoEmbed } from '@/lib/storefront/utils'
import { VideoUploader, esVideoArchivo } from '@/modules/ventas/panel/configuracion/components/apariencia/VideoUploader'

// Contenido de la ficha de UN producto: videos con texto al costado que la
// tienda muestra alternados debajo de Características y antes de las reseñas
// (ContenidoFicha en SeccionVideos.tsx). Pedido de Ale (19/09), con una
// tienda de referencia ("100% impermeable" + video, "Sin límite de
// capacidad" + video...).
//
// Se abre desde Productos → ⋮ → "Contenido de la ficha" y NO desde el wizard
// de alta a propósito: es opcional, y crear un producto no se tenía que
// alargar. Guarda con su propio endpoint (PUT /products/:id/content), así
// no pisa nada del resto del producto.

// Mismo tope que el DTO del backend (ArrayMaxSize(8)).
const MAX_BLOQUES = 8

type Bloque = { id: string; url: string; eyebrow: string; title: string; text: string; ctaText: string }

const vacio = (): Bloque => ({ id: 'cb' + Date.now(), url: '', eyebrow: '', title: '', text: '', ctaText: '' })
const desdeApi = (b: ApiProductContentBlock): Bloque => ({
  id: b.id, url: b.url, eyebrow: b.eyebrow ?? '', title: b.title ?? '', text: b.text ?? '', ctaText: b.ctaText ?? '',
})

async function subirVideo(file: File): Promise<string> {
  return panelPresignProductVideo(file)
}

export function ContenidoFichaModal({ productId, onClose, onGuardado }: { productId: string; onClose: () => void; onGuardado?: () => void }) {
  const [nombre, setNombre] = useState('')
  const [bloques, setBloques] = useState<Bloque[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    panelGetProductFull(productId)
      .then(p => {
        if (cancelado) return
        setNombre(p.name)
        const guardados = (p.contentBlocks ?? []).map(desdeApi)
        // Sin nada cargado arranca con un bloque vacío: abrir el editor ya
        // es la intención de agregar uno.
        setBloques(guardados.length > 0 ? guardados : [vacio()])
      })
      .catch(e => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar el producto') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [productId])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose, guardando])

  const upd = (i: number, cambio: Partial<Bloque>) => setBloques(bs => bs.map((b, j) => j === i ? { ...b, ...cambio } : b))
  const mover = (i: number, d: -1 | 1) => setBloques(bs => {
    const j = i + d
    if (j < 0 || j >= bs.length) return bs
    const c = [...bs]
    ;[c[i], c[j]] = [c[j], c[i]]
    return c
  })

  // Un bloque sin video no se guarda (no hay nada que mostrar); uno con un
  // link que no reconocemos frena el guardado, así no desaparece en silencio.
  const conLink = bloques.filter(b => b.url.trim() !== '')
  const invalidos = conLink.filter(b => !parseVideoEmbed(b.url))

  const guardar = async () => {
    if (invalidos.length > 0) { setError('Hay un video con un link que no reconocemos. Corregilo o quitalo para guardar.'); return }
    setGuardando(true); setError('')
    try {
      await panelUpdateProductContent(productId, conLink.map(b => ({
        id: b.id,
        url: b.url.trim(),
        ...(b.eyebrow.trim() ? { eyebrow: b.eyebrow.trim() } : {}),
        ...(b.title.trim() ? { title: b.title.trim() } : {}),
        ...(b.text.trim() ? { text: b.text.trim() } : {}),
        ...(b.ctaText.trim() ? { ctaText: b.ctaText.trim() } : {}),
      })))
      onGuardado?.()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el contenido')
    } finally {
      setGuardando(false)
    }
  }

  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
  const btnIcono: React.CSSProperties = { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }

  return createPortal(
    <div
      onClick={() => { if (!guardando) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Contenido de la ficha de ${nombre || 'el producto'}`}
        style={{
          width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
          background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 16, boxShadow: 'var(--shadow-card-hover)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Contenido de la ficha</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.45 }}>
              {nombre && <>{nombre} · </>}Videos con texto al costado, alternados, debajo de las características. Es opcional.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={guardando} aria-label="Cerrar" className="ds-hover" style={{ ...btnIcono, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </header>

        <div style={{ overflowY: 'auto', padding: '16px 22px 8px' }}>
          {cargando && <p style={{ fontSize: 13.5, color: 'var(--color-muted)' }}>Cargando…</p>}

          {!cargando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bloques.map((b, i) => {
                const primero = i === 0
                const ultimo = i === bloques.length - 1
                const linkMalo = b.url.trim() !== '' && !parseVideoEmbed(b.url)
                return (
                  <div key={b.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Bloque {i + 1}</span>
                      <button onClick={() => mover(i, -1)} disabled={primero} aria-label="Subir" title="Subir" className="ds-hover" style={{ ...btnIcono, opacity: primero ? 0.35 : 1, cursor: primero ? 'default' : 'pointer' }}><ArrowUp size={14} /></button>
                      <button onClick={() => mover(i, 1)} disabled={ultimo} aria-label="Bajar" title="Bajar" className="ds-hover" style={{ ...btnIcono, opacity: ultimo ? 0.35 : 1, cursor: ultimo ? 'default' : 'pointer' }}><ArrowDown size={14} /></button>
                      <button
                        onClick={() => setBloques(bs => bs.filter((_, j) => j !== i))}
                        aria-label={`Quitar bloque ${i + 1}`} title="Quitar"
                        style={btnIcono}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                      ><Trash2 size={14} /></button>
                    </div>

                    {/* Link pegado o archivo subido: mismo criterio que los
                        videos de Apariencia. Con un archivo ya subido el link
                        es el de R2 y el campo se oculta. */}
                    {!esVideoArchivo(b.url) && (
                      <div style={{ marginBottom: 10 }}>
                        <input value={b.url} onChange={e => upd(i, { url: e.target.value })} placeholder="Link de YouTube, Vimeo o .mp4" style={campo} className="ds-field" />
                        {linkMalo && (
                          <p style={{ fontSize: 11.5, color: 'var(--color-error)', margin: '5px 0 0' }}>
                            No reconocemos este link. Probá con uno de YouTube, de Vimeo, o que termine en .mp4
                          </p>
                        )}
                      </div>
                    )}
                    {(esVideoArchivo(b.url) || b.url.trim() === '') && (
                      <div style={{ marginBottom: 12 }}>
                        <VideoUploader value={b.url} onChange={x => upd(i, { url: x })} onUpload={subirVideo} maxMB={500} />
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 8 }}>
                      <input value={b.eyebrow} onChange={e => upd(i, { eyebrow: e.target.value })} maxLength={60} placeholder="Línea chica de arriba (opcional): Resistente al agua" style={campo} className="ds-field" />
                      <input value={b.title} onChange={e => upd(i, { title: e.target.value })} maxLength={120} placeholder="Título: 100% impermeable" style={campo} className="ds-field" />
                      <textarea
                        value={b.text}
                        onChange={e => upd(i, { text: e.target.value })}
                        maxLength={600}
                        rows={3}
                        placeholder="Texto: contá qué muestra el video y por qué importa."
                        className="ds-field"
                        style={{ ...campo, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' }}
                      />
                      <input value={b.ctaText} onChange={e => upd(i, { ctaText: e.target.value })} maxLength={40} placeholder="Botón (opcional): Quiero el mío — lleva a comprar" style={campo} className="ds-field" />
                    </div>
                  </div>
                )
              })}

              {bloques.length < MAX_BLOQUES && (
                <button
                  onClick={() => setBloques(bs => [...bs, vacio()])}
                  className="ds-hover"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, border: '1.5px dashed var(--color-border-strong)', background: 'transparent', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                  <Plus size={14} strokeWidth={2} /> Agregar bloque
                </button>
              )}
            </div>
          )}
        </div>

        <footer style={{ padding: '12px 22px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && (
            <div role="alert" style={{ padding: '10px 13px', borderRadius: 10, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={guardando} className="ds-hover" style={{ height: 40, padding: '0 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button type="button" onClick={() => void guardar()} disabled={guardando || cargando} style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: guardando ? 'default' : 'pointer', opacity: guardando || cargando ? 0.7 : 1, fontFamily: 'inherit' }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
