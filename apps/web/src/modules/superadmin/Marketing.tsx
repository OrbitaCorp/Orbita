import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { platformApi, type TiktokCreador, type TiktokPublicacion } from '@/lib/platform/api'
import { Toast, type ToastVariant } from '@/design-system/components/Toast'
import {
  useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, PageHeader, ConfirmModal, dateTime,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
} from './ui'

// Marketing: publicar los videos de Órbita en TikTok desde la cuenta de la empresa.
//
// La pantalla de publicar sigue las reglas de TikTok para la Content Posting API (es lo que revisan
// en la auditoría): se muestra con qué cuenta se publica, la visibilidad se elige a mano (sin valor
// por defecto) entre las que TikTok permite en ese momento, los comentarios, dúos y stitch arrancan
// apagados, el contenido comercial se declara, y antes de publicar se muestra la declaración de
// consentimiento. Qué hace cada llamada: apps/api/src/marketing/tiktok/tiktok.service.ts.

type Aviso = { variant: ToastVariant; title: string; description?: string }

const PRIVACIDAD: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Todos',
  MUTUAL_FOLLOW_FRIENDS: 'Amigos (se siguen entre sí)',
  FOLLOWER_OF_CREATOR: 'Seguidores',
  SELF_ONLY: 'Solo yo',
  BORRADOR: 'Borrador',
}
const ESTADO: Record<string, { texto: string; tono: 'green' | 'red' | 'amber' | 'gray' }> = {
  PROCESSING_UPLOAD: { texto: 'Subiendo', tono: 'amber' },
  PROCESSING_DOWNLOAD: { texto: 'Procesando', tono: 'amber' },
  SEND_TO_USER_INBOX: { texto: 'En borradores', tono: 'gray' },
  PUBLISH_COMPLETE: { texto: 'Publicado', tono: 'green' },
  FAILED: { texto: 'Falló', tono: 'red' },
}
const EN_PROCESO = new Set(['PROCESSING_UPLOAD', 'PROCESSING_DOWNLOAD'])
const URL_MUSICA = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en'
const URL_MARCA = 'https://www.tiktok.com/legal/page/global/bc-policy/en'

const textarea: React.CSSProperties = { ...inputStyle, height: 'auto', minHeight: 96, padding: '11px 13px', lineHeight: 1.5, resize: 'vertical', width: '100%' }

export function TabMarketing({ puedePublicar }: { puedePublicar: boolean }) {
  const router = useRouter()
  const [tick, setTick] = useState(0)
  const { data: estado, error } = useFetch(() => platformApi.tiktokEstado(), [tick])
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [conectando, setConectando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)

  // TikTok vuelve a esta pantalla con el resultado de la conexión en la dirección.
  useEffect(() => {
    const r = router.query.tiktok
    if (r === 'conectado') setAviso({ variant: 'success', title: 'Cuenta de TikTok conectada' })
    else if (r === 'error') setAviso({ variant: 'error', title: 'No se pudo conectar TikTok', description: 'Probá de nuevo. Si sigue igual, revisá que la dirección de redirección de la app sea la correcta.' })
    if (r) void router.replace('/superadmin?seccion=marketing', undefined, { shallow: true })
  }, [router.query.tiktok]) // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async () => {
    setConectando(true)
    try {
      const { url } = await platformApi.tiktokConectar()
      window.location.href = url
    } catch {
      setAviso({ variant: 'error', title: 'No se pudo iniciar la conexión', description: 'Revisá que los secretos de la app de TikTok estén cargados.' })
      setConectando(false)
    }
  }

  if (error) return <ErrorBox msg="No se pudo cargar el estado de TikTok." />
  if (!estado) return <Loader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Marketing" subtitle="Publicá los videos de Órbita en la cuenta de TikTok de la empresa" />

      <Card title="TikTok" subtitle="La cuenta con la que se publican los videos de marketing">
        {!estado.configurado ? (
          <Empty text="TikTok todavía no está configurado en este entorno: faltan los datos de la app (client key, client secret y clave de cifrado)." />
        ) : !estado.conectado || !estado.cuenta ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, color: 'var(--color-muted)' }}>Todavía no hay una cuenta conectada.</span>
            {puedePublicar && (
              <button onClick={conectar} disabled={conectando} style={{ ...btnPrimary, opacity: conectando ? 0.6 : 1 }}>
                {conectando ? 'Redirigiendo…' : 'Conectar cuenta de TikTok'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {estado.cuenta.avatar && <img src={estado.cuenta.avatar} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{estado.cuenta.nombre ?? 'Cuenta de TikTok'}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                  Conectada el {dateTime(estado.cuenta.conectadaEl)} · permisos: {estado.cuenta.permisos.join(', ') || '—'}
                </div>
              </div>
            </div>
            {puedePublicar && <button onClick={() => setDesconectando(true)} className="ds-hover" style={btnGhostSm}>Desconectar</button>}
          </div>
        )}
      </Card>

      {estado.conectado && <Publicar puedePublicar={puedePublicar} onPublicado={() => setTick((n) => n + 1)} setAviso={setAviso} />}
      {estado.conectado && <Publicaciones refrescar={tick} />}

      {desconectando && (
        <ConfirmModal
          title="Desconectar la cuenta de TikTok"
          body="Se revoca el acceso de Órbita a la cuenta y se borra la conexión. Los videos ya publicados no se tocan. Para volver a publicar hay que conectarla de nuevo."
          confirmLabel="Desconectar"
          onCancel={() => setDesconectando(false)}
          onConfirm={async () => {
            await platformApi.tiktokDesconectar()
            setDesconectando(false)
            setTick((n) => n + 1)
            setAviso({ variant: 'success', title: 'Cuenta de TikTok desconectada' })
          }}
        />
      )}
      {aviso && <Toast variant={aviso.variant} title={aviso.title} description={aviso.description} onClose={() => setAviso(null)} />}
    </div>
  )
}

// ─── Publicar un video ──────────────────────────────────────────────────────────

function Interruptor({ marcado, onChange, texto, deshabilitado }: { marcado: boolean; onChange: (v: boolean) => void; texto: string; deshabilitado?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: deshabilitado ? 'var(--color-muted)' : 'var(--color-text)', cursor: deshabilitado ? 'not-allowed' : 'pointer' }}>
      <input type="checkbox" checked={marcado} disabled={deshabilitado} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
      {texto}
    </label>
  )
}

function Publicar({ puedePublicar, onPublicado, setAviso }: { puedePublicar: boolean; onPublicado: () => void; setAviso: (a: Aviso) => void }) {
  const { data: creador, error } = useFetch<TiktokCreador>(() => platformApi.tiktokCreador(), [])
  const [videoUrl, setVideoUrl] = useState('')
  const [title, setTitle] = useState('')
  // Sin valor por defecto: TikTok pide que la visibilidad la elija una persona.
  const [privacidad, setPrivacidad] = useState('')
  const [comentarios, setComentarios] = useState(false)
  const [duetos, setDuetos] = useState(false)
  const [stitch, setStitch] = useState(false)
  const [declara, setDeclara] = useState(false)
  const [tuMarca, setTuMarca] = useState(false)
  const [deMarca, setDeMarca] = useState(false)
  const [ia, setIa] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Directo: se publica desde acá. Borrador: el video llega a los borradores de TikTok y una persona lo termina en la app.
  const [modo, setModo] = useState<'directo' | 'borrador'>('directo')

  if (error) return <Card title="Publicar un video"><ErrorBox msg="No se pudo consultar a TikTok qué se puede hacer con la cuenta. Puede que haya que volver a conectarla." /></Card>
  if (!creador) return <Card title="Publicar un video"><Loader /></Card>

  const sinTipoDeMarca = declara && !tuMarca && !deMarca
  // Un video de marca no puede ser privado: TikTok lo rechaza.
  const marcaYPrivado = declara && (tuMarca || deMarca) && privacidad === 'SELF_ONLY'
  const urlValida = videoUrl.startsWith('https://')
  const listo = modo === 'borrador'
    ? puedePublicar && !enviando && urlValida
    : puedePublicar && !enviando && urlValida && title.trim().length > 0 && !!privacidad && !sinTipoDeMarca && !marcaYPrivado

  const publicar = async () => {
    setEnviando(true)
    try {
      if (modo === 'borrador') {
        await platformApi.tiktokBorrador(videoUrl.trim())
        setAviso({ variant: 'success', title: 'Video enviado a los borradores de TikTok', description: 'Abrí TikTok con la cuenta de la empresa, buscá la notificación o los borradores y terminá de publicarlo desde ahí.' })
        setVideoUrl('')
        onPublicado()
        return
      }
      await platformApi.tiktokPublicar({
        title: title.trim(), videoUrl: videoUrl.trim(), privacyLevel: privacidad,
        disableComment: !comentarios, disableDuet: !duetos, disableStitch: !stitch,
        brandOrganic: declara && tuMarca, brandContent: declara && deMarca, isAigc: ia,
      })
      setAviso({ variant: 'success', title: 'Video enviado a TikTok', description: 'Se está procesando. El estado se actualiza abajo.' })
      setVideoUrl(''); setTitle(''); setPrivacidad(''); setComentarios(false); setDuetos(false); setStitch(false)
      setDeclara(false); setTuMarca(false); setDeMarca(false); setIa(false)
      onPublicado()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo publicar', description: e instanceof Error ? e.message : undefined })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card title="Publicar un video" subtitle="Se baja de la dirección que pongas y se sube a TikTok">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
          {creador.avatar && <img src={creador.avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
          <span style={{ color: 'var(--color-muted)' }}>Publicás como</span>
          <strong style={{ color: 'var(--color-text)' }}>{creador.nombre || creador.usuario}</strong>
          {creador.usuario && <span style={{ color: 'var(--color-muted)' }}>@{creador.usuario}</span>}
        </div>

        <div role="group" aria-label="Cómo enviarlo" style={{ display: 'inline-flex', background: 'var(--color-surface-alt)', borderRadius: 10, padding: 3, alignSelf: 'flex-start' }}>
          {([['directo', 'Publicar directo'], ['borrador', 'Enviar a borradores']] as const).map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setModo(id)} aria-pressed={modo === id} className="ds-hover"
              style={{ height: 30, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: modo === id ? 600 : 500, background: modo === id ? 'var(--color-bg)' : 'transparent', color: modo === id ? 'var(--color-text)' : 'var(--color-muted)' }}>
              {texto}
            </button>
          ))}
        </div>
        {modo === 'borrador' && (
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            El video llega a los borradores de la cuenta. El título, la visibilidad y el resto los completa una persona en la app de TikTok antes de publicarlo.
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          Dirección del video (https)
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…/video.mp4" style={inputStyle} />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)' }}>Un MP4 público. Duración máxima de la cuenta: {Math.round(creador.duracionMaximaSeg / 60)} min.</span>
        </label>

        {modo === 'directo' && (<>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          Título
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} maxLength={2200} placeholder="Descripción y #hashtags" style={textarea} />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', textAlign: 'right' }}>{title.length} / 2200</span>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          Quién puede ver este video
          <select value={privacidad} onChange={(e) => setPrivacidad(e.target.value)} style={inputStyle}>
            <option value="">Elegí una opción…</option>
            {creador.privacidades.map((p) => <option key={p} value={p}>{PRIVACIDAD[p] ?? p}</option>)}
          </select>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)' }}>
            Mientras la app de TikTok no pase su auditoría, solo se puede publicar con la opción &quot;Solo yo&quot;.
          </span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Permitir que los demás</div>
          <Interruptor marcado={comentarios} onChange={setComentarios} texto="Comenten" deshabilitado={creador.comentariosDeshabilitados} />
          <Interruptor marcado={duetos} onChange={setDuetos} texto="Hagan un dúo" deshabilitado={creador.duetosDeshabilitados} />
          <Interruptor marcado={stitch} onChange={setStitch} texto="Hagan un stitch" deshabilitado={creador.stitchDeshabilitado} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Interruptor marcado={declara} onChange={(v) => { setDeclara(v); if (!v) { setTuMarca(false); setDeMarca(false) } }} texto="Divulgar contenido comercial: este video promociona un negocio" />
          {declara && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingLeft: 26 }}>
              <Interruptor marcado={tuMarca} onChange={setTuMarca} texto="Tu marca: promocionás tu propio negocio (es el caso de los videos de Órbita)" />
              <Interruptor marcado={deMarca} onChange={setDeMarca} texto="Contenido de marca: es una promoción pagada por un tercero" />
              {sinTipoDeMarca && <span style={{ fontSize: 12.5, color: 'var(--color-error)' }}>Elegí al menos una de las dos opciones.</span>}
              {marcaYPrivado && <span style={{ fontSize: 12.5, color: 'var(--color-error)' }}>Un video de marca no puede ser privado: TikTok lo rechaza.</span>}
              <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Se va a marcar el video como &quot;{deMarca ? 'Asociación pagada' : 'Promocional'}&quot;.</span>
            </div>
          )}
        </div>

        <Interruptor marcado={ia} onChange={setIa} texto="Este video fue generado o editado con IA" />

        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Al publicar aceptás la <a href={URL_MUSICA} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>Confirmación de uso de música de TikTok</a>
          {declara && deMarca && <> y la <a href={URL_MARCA} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>Política de contenido de marca</a></>}.
          {' '}El video puede tardar unos minutos en aparecer en la cuenta después de enviarlo.
        </div>

        </>)}

        <div>
          <button onClick={publicar} disabled={!listo} style={{ ...btnPrimary, opacity: listo ? 1 : 0.5, cursor: listo ? 'pointer' : 'not-allowed' }}>
            {enviando ? 'Enviando a TikTok…' : modo === 'borrador' ? 'Enviar a borradores' : 'Publicar en TikTok'}
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── Historial ──────────────────────────────────────────────────────────────────

function Publicaciones({ refrescar }: { refrescar: number }) {
  const [tick, setTick] = useState(0)
  const { data: posts, error } = useFetch<TiktokPublicacion[]>(() => platformApi.tiktokPublicaciones(), [refrescar, tick])
  const [actualizando, setActualizando] = useState<string | null>(null)

  // Mientras TikTok procesa un video, se le pregunta cada tanto cómo va.
  const pendientes = (posts ?? []).filter((p) => EN_PROCESO.has(p.status)).map((p) => p.publishId)
  useEffect(() => {
    if (pendientes.length === 0) return
    const id = setInterval(async () => {
      await Promise.all(pendientes.slice(0, 5).map((pid) => platformApi.tiktokEstadoPublicacion(pid).catch(() => null)))
      setTick((n) => n + 1)
    }, 6000)
    return () => clearInterval(id)
  }, [pendientes.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const actualizar = async (publishId: string) => {
    setActualizando(publishId)
    try { await platformApi.tiktokEstadoPublicacion(publishId) } catch { /* el estado anterior se queda */ }
    setActualizando(null)
    setTick((n) => n + 1)
  }

  return (
    <Card title="Videos enviados" subtitle="Lo último que se mandó a TikTok desde Órbita" noPad>
      {error ? <ErrorBox msg="No se pudo cargar el historial." /> : !posts ? <Loader /> : posts.length === 0 ? <Empty text="Todavía no se envió ningún video." /> : (
        <Table
          head={['Fecha', 'Título', 'Visibilidad', 'Estado', '']}
          alignRight={[4]}
          rows={posts.map((p) => {
            const e = ESTADO[p.status] ?? { texto: p.status, tono: 'gray' as const }
            return {
              key: p.id,
              cells: [
                dateTime(p.createdAt),
                <span key="t" style={{ display: 'block', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>{p.title}</span>,
                PRIVACIDAD[p.privacyLevel] ?? p.privacyLevel,
                <span key="e" style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
                  <Chip text={e.texto} tone={e.tono} dot />
                  {p.failReason && <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{p.failReason}</span>}
                </span>,
                <button key="a" onClick={() => actualizar(p.publishId)} disabled={actualizando === p.publishId} className="ds-hover" style={btnGhost}>
                  {actualizando === p.publishId ? 'Consultando…' : 'Actualizar'}
                </button>,
              ],
            }
          })}
        />
      )}
    </Card>
  )
}
