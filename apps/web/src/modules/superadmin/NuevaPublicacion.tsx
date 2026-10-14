import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { platformApi } from '@/lib/platform/api'
import type { InstagramArchivoSubido, InstagramPublicacion } from '@/lib/api'
import { Field, ModalShell, btnGhost, btnGhostSm, btnPrimary, inputStyle } from './ui'
import { motivoDe } from './contenidoUi'

// Subir una publicación a la cuenta de Instagram de la empresa: fotos y/o videos (de 1 a 10, varios forman un
// carrusel), el texto y si sale ahora o a una hora. Usa los mismos servicios que Difusión en el panel de un negocio
// (publicaciones y medios), ya atados al negocio de la empresa. Es de superadmin: sale con el nombre de la empresa y
// queda a la vista de los seguidores. Un video tarda en procesarse en Instagram: la pantalla consulta cada pocos
// segundos hasta que queda publicado o falla.

const MAX_ELEMENTOS = 10
const MAX_TEXTO = 2200
const CADA_MS = 3_000
const INTENTOS = 60 // ~3 minutos
const ANTICIPACION_MIN_MS = 5 * 60_000

type Archivo = InstagramArchivoSubido & { nombre: string }

// Valor para <input type="datetime-local"> (hora local, sin segundos).
const aInputLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

export function NuevaPublicacion({ onClose, onListo }: { onClose: () => void; onListo: (mensaje: string) => void }) {
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [progreso, setProgreso] = useState(0)
  const [texto, setTexto] = useState('')
  const [formato, setFormato] = useState<'cuadrado' | 'vertical'>('vertical')
  const [modo, setModo] = useState<'ahora' | 'programar'>('ahora')
  const [cuando, setCuando] = useState(() => aInputLocal(new Date(Date.now() + 60 * 60_000)))
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const entrada = useRef<HTMLInputElement>(null)

  const hayFotos = archivos.some((a) => a.tipo === 'image')
  const ocupado = enviando || !!subiendo

  async function elegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return
    setError('')
    const libres = MAX_ELEMENTOS - archivos.length
    const elegidos = Array.from(lista).slice(0, libres)
    if (lista.length > libres) setError(`Una publicación lleva hasta ${MAX_ELEMENTOS} elementos: se sumaron los primeros ${libres}.`)
    for (const f of elegidos) {
      const esVideo = f.type.startsWith('video/') || /\.(mp4|mov)$/i.test(f.name)
      setSubiendo(f.name)
      setProgreso(0)
      try {
        const subido = esVideo ? await platformApi.igSubirVideo(f, setProgreso) : await platformApi.igSubirFoto(f)
        setArchivos((a) => [...a, { ...subido, nombre: f.name }])
      } catch (e) {
        setError(motivoDe(e, `No se pudo subir ${f.name}.`))
        break
      }
    }
    setSubiendo(null)
    if (entrada.current) entrada.current.value = ''
  }

  async function esperarPublicada(p: InstagramPublicacion): Promise<InstagramPublicacion> {
    let actual = p
    for (let i = 0; i < INTENTOS && (actual.estado === 'PROCESSING' || actual.estado === 'PUBLISHING'); i++) {
      setEstado('Instagram está procesando el archivo…')
      await new Promise((r) => setTimeout(r, CADA_MS))
      actual = await platformApi.igContinuarPublicacion(actual.id)
    }
    return actual
  }

  async function enviar() {
    setError('')
    if (archivos.length === 0) return setError('Sumá al menos una foto o un video.')
    if (texto.length > MAX_TEXTO) return setError(`El texto pasa los ${MAX_TEXTO} caracteres que permite Instagram.`)
    let fecha: Date | null = null
    if (modo === 'programar') {
      fecha = new Date(cuando)
      if (Number.isNaN(fecha.getTime()) || fecha.getTime() < Date.now() + ANTICIPACION_MIN_MS) return setError('Elegí una hora que falte al menos 5 minutos.')
    }
    const input = { caption: texto.trim(), formato, items: archivos.map((a) => ({ origen: 'subida' as const, ref: a.ref, tipo: a.tipo })) }
    setEnviando(true)
    try {
      if (fecha) {
        await platformApi.igProgramar({ ...input, programarPara: fecha.toISOString() })
        return onListo(`Publicación programada para el ${fecha.toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`)
      }
      setEstado('Publicando…')
      const final = await esperarPublicada(await platformApi.igPublicar(input))
      if (final.estado === 'PUBLISHED') return onListo('Publicación subida a Instagram')
      if (final.estado === 'FAILED') throw new Error(final.error ?? 'Instagram no pudo publicarla.')
      // Sigue procesándose pasados los 3 minutos: queda en la lista y se completa sola.
      return onListo('Instagram todavía la está procesando: va a aparecer en la cuenta en unos minutos')
    } catch (e) {
      setError(motivoDe(e, e instanceof Error && e.message ? e.message : 'No se pudo publicar. Probá de nuevo.'))
      setEnviando(false)
      setEstado('')
    }
  }

  return (
    <ModalShell title="Nueva publicación" onClose={() => { if (!ocupado) onClose() }} cerrarAlClickAfuera={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label={`Fotos y videos (${archivos.length}/${MAX_ELEMENTOS})`} hint="Más de uno forma un carrusel. Los videos se publican como reel.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {archivos.map((a, i) => (
              <div key={a.ref} style={{ position: 'relative', width: 84, height: 84, borderRadius: 10, overflow: 'hidden', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
                {a.tipo === 'image'
                  ? <img src={a.url} alt={a.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <video src={a.url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                <button
                  type="button" aria-label={`Quitar ${a.nombre}`} disabled={ocupado}
                  onClick={() => setArchivos((x) => x.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(15,23,42,0.7)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                ><Trash2 size={13} /></button>
              </div>
            ))}
            {archivos.length < MAX_ELEMENTOS && (
              <button
                type="button" onClick={() => entrada.current?.click()} disabled={ocupado}
                style={{ width: 84, height: 84, borderRadius: 10, border: '1.5px dashed var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11.5, fontFamily: 'inherit' }}
              ><ImagePlus size={20} />Sumar</button>
            )}
          </div>
          <input ref={entrada} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" hidden onChange={(e) => void elegir(e.target.files)} />
          {subiendo && <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Subiendo {subiendo}{progreso > 0 && progreso < 100 ? ` · ${progreso}%` : '…'}</span>}
        </Field>

        {hayFotos && (
          <Field label="Formato de las fotos" hint="Instagram recorta las fotos a este lienzo.">
            <select value={formato} onChange={(e) => setFormato(e.target.value as 'cuadrado' | 'vertical')} style={inputStyle} disabled={ocupado}>
              <option value="vertical">Vertical (4:5)</option>
              <option value="cuadrado">Cuadrado (1:1)</option>
            </select>
          </Field>
        )}

        <Field label="Texto" hint={`${texto.length}/${MAX_TEXTO}`}>
          <textarea
            value={texto} onChange={(e) => setTexto(e.target.value)} disabled={ocupado} rows={5} maxLength={MAX_TEXTO}
            placeholder="Lo que se lee debajo de la foto: el texto y los #hashtags."
            style={{ ...inputStyle, height: 'auto', minHeight: 110, padding: '11px 13px', lineHeight: 1.5, resize: 'vertical', width: '100%' }}
          />
        </Field>

        <Field label="Cuándo sale">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['ahora', 'programar'] as const).map((m) => (
              <button
                key={m} type="button" aria-pressed={modo === m} disabled={ocupado} onClick={() => setModo(m)}
                style={{ ...btnGhostSm, height: 34, ...(modo === m ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-bg)' } : {}) }}
              >{m === 'ahora' ? 'Publicar ahora' : 'Programar'}</button>
            ))}
          </div>
          {modo === 'programar' && <input type="datetime-local" value={cuando} min={aInputLocal(new Date(Date.now() + ANTICIPACION_MIN_MS))} onChange={(e) => setCuando(e.target.value)} disabled={ocupado} style={{ ...inputStyle, marginTop: 8 }} />}
        </Field>

        <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Sale con el nombre de la empresa y los seguidores lo ven. Queda anotado quién lo publicó.
        </div>

        {estado && <div role="status" style={{ fontSize: 12.5, color: 'var(--color-body)' }}>{estado}</div>}
        {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)', lineHeight: 1.5 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} disabled={ocupado} style={btnGhost}>Cancelar</button>
          <button type="button" onClick={() => void enviar()} disabled={ocupado || archivos.length === 0} style={{ ...btnPrimary, opacity: ocupado || archivos.length === 0 ? 0.6 : 1 }}>
            {enviando ? (modo === 'programar' ? 'Programando…' : 'Publicando…') : modo === 'programar' ? 'Programar' : 'Publicar'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
