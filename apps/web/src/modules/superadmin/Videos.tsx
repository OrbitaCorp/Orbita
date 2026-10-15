import { useState } from 'react'
import { platformApi, type VideoComentario, type VideoDeCola, type VideoEstado, type VideoTipo } from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import { useFetch, Card, Chip, Loader, ErrorBox, Empty, ConfirmModal, ModalShell, dateTime, btnGhostSm, btnPrimary, inputStyle } from './ui'
import { URL_CONECTOR } from './ConectarClaude'
import { ListaDeTutoriales } from './ListaDeTutoriales'

// Marketing → Videos: la cola de videos que genera el equipo con su propio Claude (en su computadora, con el conector de
// Órbita). Hay dos pestañas que no se mezclan: Marketing (se usa afuera) y Tutoriales (internos, con la lista de lo que falta).
//
// Cualquiera del equipo puede COMENTAR cualquier video en todas sus fases y pedir que se MEJORE: «Mejorar con Claude» abre Claude
// con ese video (si la persona tiene el conector; si no, le explica cómo conectarlo) y Claude lee el video y sus comentarios por
// el conector. Aprobar o rechazar lo ofrece el servidor solo a quien corresponde (puedeAprobar / puedeRechazar): la pantalla no
// sabe ni muestra quién aprobó. Una vez aprobado un video de marketing se descarga o se pasa como BORRADOR a TikTok o Instagram.
// Nada se publica solo. Qué hace cada llamada: apps/api/src/marketing/videos/.

type Aviso = { variant: ToastVariant; title: string; description?: string }
type Filtro = 'PENDIENTE' | 'APROBADO' | 'TODOS'

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: 'PENDIENTE', texto: 'Para aprobar' },
  { id: 'APROBADO', texto: 'Aprobados' },
  { id: 'TODOS', texto: 'Todos' },
]
const ESTADO: Record<VideoEstado, { texto: string; tono: 'amber' | 'green' | 'gray' }> = {
  PENDIENTE: { texto: 'Para aprobar', tono: 'amber' },
  APROBADO: { texto: 'Aprobado', tono: 'green' },
  PUBLICADO: { texto: 'Pasado a borrador', tono: 'gray' },
}
const FORMATO = { REEL_9_16: 'Vertical 9:16', CUADRADO: 'Cuadrado', HORIZONTAL_16_9: 'Horizontal 16:9' } as const
const DESTINO = { tiktok: 'TikTok', instagram: 'Instagram' } as const

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
const diasPara = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : null)

/** Lo que se le pide a Claude para mejorar un video: él lee el video y los comentarios por el conector (videos_obtener). */
export function instruccionDeMejora(v: Pick<VideoDeCola, 'id' | 'titulo' | 'tipo'>): string {
  return [
    `Mejorá el video «${v.titulo}» (id ${v.id}) de la cola de Órbita, con el conector de Órbita.`,
    '1. Leelo con videos_obtener: el guion, el texto sugerido, los controles y los comentarios del equipo.',
    '2. Armá una versión mejorada que atienda esos comentarios y conserve lo que funciona. Si algo no queda claro, preguntame antes de producir.',
    `3. Si podés producir el video (Claude Code en la computadora; si no tenés las herramientas de videos, bajalas como indican las instrucciones del conector), producilo con la skill ${v.tipo === 'TUTORIAL' ? 'videos-multiagente' : 'videos-cola'}, subilo con videos_pedir_subida (tipo ${v.tipo}) y registralo con videos_registrar indicando mejora_de ${v.id}; el original no se toca. Si estás en el chat web y no podés renderizar, no inventes: escribí el guion y el texto sugerido mejorados y decime que los pegue en Claude Code, con el conector de Órbita.`,
    '4. Si registraste un video nuevo, llamá a videos_avisar al terminar. No publiques nada: lo revisa el equipo.',
  ].join('\n')
}

export function PanelVideos({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [tipo, setTipo] = useState<VideoTipo>('MARKETING')
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useFetch(() => platformApi.videosCola(), [tick])
  const [filtro, setFiltro] = useState<Filtro>('PENDIENTE')
  const [rechazando, setRechazando] = useState<VideoDeCola | null>(null)
  const [sinClaude, setSinClaude] = useState<VideoDeCola | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const recargar = () => setTick((n) => n + 1)
  // Todas las acciones siguen el mismo camino: marcar ocupado, avisar el resultado y recargar la cola.
  const accion = async (clave: string, hacer: () => Promise<unknown>, exito: Aviso | ((r: unknown) => Aviso)) => {
    setOcupado(clave)
    try {
      const r = await hacer()
      setAviso(typeof exito === 'function' ? exito(r) : exito)
      recargar()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo completar', description: e instanceof Error ? e.message : undefined })
    } finally {
      setOcupado(null)
    }
  }

  const delTipo = (data ?? []).filter((v) => v.tipo === tipo)
  const visibles = delTipo.filter((v) => (filtro === 'TODOS' ? true : filtro === 'APROBADO' ? v.estado !== 'PENDIENTE' : v.estado === 'PENDIENTE'))
  const pendientes = delTipo.filter((v) => v.estado === 'PENDIENTE').length
  const pendientesDelOtro = (data ?? []).filter((v) => v.tipo !== tipo && v.estado === 'PENDIENTE').length
  const tituloDe = (id: string | null) => (id ? (data ?? []).find((v) => v.id === id)?.titulo ?? null : null)

  const descargar = async (v: VideoDeCola) => {
    setOcupado(`d-${v.id}`)
    try {
      const { url } = await platformApi.videoDescarga(v.id)
      window.location.href = url
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo preparar la descarga', description: e instanceof Error ? e.message : undefined })
    } finally {
      setOcupado(null)
    }
  }

  // «Mejorar con Claude»: si la persona ya conectó Claude a Órbita, se abre Claude con el video; si no, se le explica cómo conectarlo.
  const mejorar = async (v: VideoDeCola) => {
    setOcupado(`m-${v.id}`)
    try {
      const { conectado } = await platformApi.mcpEstado()
      if (conectado) window.open(`https://claude.ai/new?q=${encodeURIComponent(instruccionDeMejora(v))}`, '_blank', 'noopener')
      else setSinClaude(v)
    } catch {
      setSinClaude(v) // sin poder saberlo, lo seguro es mostrar las dos salidas
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      <div role="tablist" aria-label="Tipo de video" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['MARKETING', 'Marketing'], ['TUTORIAL', 'Tutoriales']] as const).map(([id, texto]) => {
          const n = (data ?? []).filter((v) => v.tipo === id && v.estado === 'PENDIENTE').length
          return (
            <button
              key={id} type="button" role="tab" aria-selected={tipo === id} onClick={() => { setTipo(id); setFiltro('PENDIENTE') }}
              style={{ ...btnGhostSm, height: 38, padding: '0 18px', fontSize: 13.5, ...(tipo === id ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-bg)' } : {}) }}
            >{texto}{n > 0 ? ` (${n})` : ''}</button>
          )
        })}
      </div>

      {tipo === 'TUTORIAL' && <ListaDeTutoriales puedeEditar={puedeEditar} setAviso={setAviso} />}

      <Card
        title={tipo === 'MARKETING' ? 'Videos de marketing' : 'Videos de tutoriales'}
        subtitle={tipo === 'MARKETING'
          ? 'Videos que generó el equipo con su Claude. Miralos, dejá tu opinión y pedí mejoras; los aprobados se pueden pasar como borrador a TikTok o Instagram.'
          : 'Tutoriales internos del panel y la tienda. Miralos, dejá tu opinión y pedí mejoras. No se publican en redes.'}
        action={<button type="button" onClick={recargar} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}>Actualizar</button>}
      >
        <div role="tablist" aria-label="Estado de los videos" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {FILTROS.map((f) => (
            <button
              key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}
              style={{ ...btnGhostSm, height: 34, padding: '0 14px', ...(filtro === f.id ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-bg)' } : {}) }}
            >{f.texto}{f.id === 'PENDIENTE' && pendientes > 0 ? ` (${pendientes})` : ''}</button>
          ))}
        </div>

        {loading ? <Loader /> : error || !data ? (
          <ErrorBox msg="No se pudo leer la cola de videos." action={<button type="button" onClick={recargar} style={btnGhostSm}>Reintentar</button>} />
        ) : visibles.length === 0 ? (
          <Empty text={filtro === 'PENDIENTE'
            ? `No hay ${tipo === 'MARKETING' ? 'videos' : 'tutoriales'} para aprobar. Pedile a tu Claude, con el conector de Órbita, algo como «${tipo === 'MARKETING' ? 'generame 3 videos' : 'hacé el tutorial de Atender un pedido'}» y aparecen acá.${pendientesDelOtro > 0 ? ` Hay ${pendientesDelOtro} en la otra pestaña.` : ''}`
            : 'Todavía no hay videos en esta lista.'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {visibles.map((v) => (
              <TarjetaDeVideo
                key={v.id} v={v} puedeEditar={puedeEditar} ocupado={ocupado} tituloOriginal={tituloDe(v.mejoraDeId)} setAviso={setAviso} onCambio={recargar}
                onAprobar={() => accion(`a-${v.id}`, () => platformApi.videoAprobar(v.id), (r) => ((r as VideoDeCola).estado === 'PENDIENTE' ? { variant: 'success', title: 'Tu aprobación quedó registrada' } : { variant: 'success', title: 'Video aprobado' }))}
                onRechazar={() => setRechazando(v)}
                onDescargar={() => descargar(v)}
                onMejorar={() => mejorar(v)}
                onTiktok={() => accion(`t-${v.id}`, () => platformApi.videoATiktok(v.id), { variant: 'success', title: 'Enviado a los borradores de TikTok', description: 'Abrí TikTok para terminarlo y publicarlo.' })}
                onInstagram={() => accion(`i-${v.id}`, () => platformApi.videoAInstagram(v.id), { variant: 'success', title: 'Guardado como borrador en Instagram', description: 'Lo publicás o programás desde Instagram → Publicaciones.' })}
              />
            ))}
          </div>
        )}
      </Card>

      {rechazando && (
        <ConfirmModal
          title="Rechazar el video"
          body={`«${rechazando.titulo}» se borra del almacenamiento y de la cola, con sus comentarios. No se puede deshacer.`}
          confirmLabel="Rechazar y borrar"
          onCancel={() => setRechazando(null)}
          onConfirm={async () => {
            await platformApi.videoRechazar(rechazando.id)
            setRechazando(null)
            setAviso({ variant: 'success', title: 'Video rechazado y borrado' })
            recargar()
          }}
        />
      )}

      {sinClaude && <ConectarParaMejorar v={sinClaude} setAviso={setAviso} onCerrar={() => setSinClaude(null)} />}
    </>
  )
}

// Para mejorar un video hace falta tener Claude conectado a Órbita: así Claude entiende cuál es el video y qué se opinó de él.
function ConectarParaMejorar({ v, setAviso, onCerrar }: { v: VideoDeCola; setAviso: (a: Aviso) => void; onCerrar: () => void }) {
  const copiar = async (texto: string, que: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setAviso({ variant: 'success', title: `${que} copiado` })
    } catch {
      setAviso({ variant: 'error', title: 'No se pudo copiar', description: 'Seleccionalo y copialo a mano.' })
    }
  }
  const abrir = () => window.open(`https://claude.ai/new?q=${encodeURIComponent(instruccionDeMejora(v))}`, '_blank', 'noopener')
  return (
    <ModalShell title="Primero conectá Claude a Órbita" onClose={onCerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          Para mejorar «{v.titulo}», Claude tiene que poder leer el video y los comentarios del equipo, y eso lo hace por el conector de Órbita.
          Se conecta una sola vez por persona y sirve para todo Marketing.
        </p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>En Claude: Configuración → Conectores → «Agregar conector personalizado» (llamalo «Órbita») con esta dirección:</li>
        </ol>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 12.5, overflowWrap: 'anywhere' }}>{URL_CONECTOR}</code>
          <button type="button" onClick={() => copiar(URL_CONECTOR, 'La dirección')} className="ds-hover" style={btnGhostSm}>Copiar</button>
        </div>
        <p style={{ margin: 0 }}>Claude te va a mandar a una pantalla del panel para que lo autorices. Después volvé y tocá «Mejorar con Claude» otra vez.</p>
        <p style={{ margin: 0 }}>En el chat de Claude puede leer el video y proponer el guion mejorado; para <b>producir</b> el video nuevo hace falta Claude Code en tu computadora con este mismo conector (Claude baja solo las herramientas de videos la primera vez).</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button type="button" onClick={() => copiar(instruccionDeMejora(v), 'La instrucción')} className="ds-hover" style={btnGhostSm}>Copiar la instrucción</button>
          <button type="button" onClick={abrir} className="ds-hover" style={btnGhostSm}>Abrir Claude igual</button>
          <button type="button" onClick={onCerrar} style={{ ...btnPrimary, height: 34 }}>Listo</button>
        </div>
      </div>
    </ModalShell>
  )
}

function TarjetaDeVideo({ v, puedeEditar, ocupado, tituloOriginal, setAviso, onCambio, onAprobar, onRechazar, onDescargar, onMejorar, onTiktok, onInstagram }: {
  v: VideoDeCola; puedeEditar: boolean; ocupado: string | null; tituloOriginal: string | null; setAviso: (a: Aviso) => void; onCambio: () => void
  onAprobar: () => void; onRechazar: () => void; onDescargar: () => void; onMejorar: () => void; onTiktok: () => void; onInstagram: () => void
}) {
  // Un video propio que está pendiente y que esta persona NO puede aprobar es de alguien que no es socio (por ejemplo, marketing):
  // lo tiene que aprobar la dirección. (Los socios sí pueden aprobar el suyo.) No se dice quién ni cuántos: solo que lo aprueba la dirección.
  const esperaDireccion = v.estado === 'PENDIENTE' && !!v.esTuyo && !v.puedeAprobar && !v.yaAprobaste
  const e = esperaDireccion ? { texto: 'Esperando a la dirección', tono: 'amber' as const } : ESTADO[v.estado]
  const vence = v.estado === 'PENDIENTE' ? diasPara(v.expiraAt) : null
  const fallas = v.controles.filter((c) => !c.ok)
  const aprobado = v.estado !== 'PENDIENTE'
  const vertical = v.formato === 'REEL_9_16'
  const boton = (clave: string, texto: string, ocupadoTexto: string, onClick: () => void, primario = false) => (
    <button
      type="button" onClick={onClick} disabled={!puedeEditar || ocupado !== null} className={primario ? undefined : 'ds-hover'}
      style={{ ...(primario ? btnPrimary : btnGhostSm), height: 36, opacity: !puedeEditar || ocupado !== null ? 0.6 : 1 }}
    >{ocupado === clave ? ocupadoTexto : texto}</button>
  )

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: 16, border: '1px solid var(--color-border)', borderRadius: 14 }}>
      {/* El video se pide de a uno, recién al darle play (preload metadata): una cola larga no baja decenas de archivos. */}
      <video
        src={v.url} controls preload="metadata" playsInline
        style={{ width: vertical ? 200 : 320, maxWidth: '100%', aspectRatio: vertical ? '9 / 16' : v.formato === 'CUADRADO' ? '1 / 1' : '16 / 9', background: '#000', borderRadius: 10, flexShrink: 0, alignSelf: 'flex-start' }}
      />
      <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{v.titulo}</span>
          <Chip text={e.texto} tone={e.tono} dot />
          {v.mejoraDeId && <Chip text="Versión mejorada" tone="blue" title={tituloOriginal ? `Mejora de «${tituloOriginal}»` : 'Mejora de otro video de la cola'} />}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
          {FORMATO[v.formato]}{v.duracionSeg ? ` · ${v.duracionSeg} s` : ''} · {mb(v.bytes)} · generado el {dateTime(v.createdAt)}
          {vence !== null && <> · se borra solo {vence === 0 ? 'hoy' : `en ${vence} ${vence === 1 ? 'día' : 'días'}`} si nadie lo aprueba</>}
          {v.mejoraDeId && tituloOriginal && <> · mejora de «{tituloOriginal}»</>}
        </div>

        {esperaDireccion && (
          <div role="status" style={{ fontSize: 13, color: 'var(--chip-warning-fg)', background: 'var(--color-warning-bg)', padding: '10px 14px', borderRadius: 10, lineHeight: 1.55 }}>
            <b>Este video lo tiene que aprobar la dirección de Órbita</b> antes de usarse. Mientras tanto el equipo lo puede ver y dejarte comentarios, y cuando esté aprobado va a figurar como «Aprobado».
          </div>
        )}

        {v.controles.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Controles de calidad">
            {v.controles.map((c, i) => <Chip key={i} text={`${c.ok ? '✓' : '✗'} ${c.nombre}`} tone={c.ok ? 'green' : 'red'} title={c.detalle || undefined} />)}
          </div>
        )}
        {fallas.length > 0 && (
          <div role="status" style={{ fontSize: 12.5, color: 'var(--chip-warning-fg)', background: 'var(--color-warning-bg)', padding: '8px 12px', borderRadius: 10, lineHeight: 1.5 }}>
            Falló: {fallas.map((c) => `${c.nombre}${c.detalle ? ` (${c.detalle})` : ''}`).join(', ')}. Miralo con atención antes de aprobarlo.
          </div>
        )}

        {v.caption && (
          <details style={{ fontSize: 13, color: 'var(--color-body)' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--color-text)', fontWeight: 600 }}>Texto sugerido</summary>
            <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.55, overflowWrap: 'anywhere' }}>{v.caption}</p>
          </details>
        )}
        {v.guion && (
          <details style={{ fontSize: 13, color: 'var(--color-body)' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--color-text)', fontWeight: 600 }}>Guion</summary>
            <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.55, overflowWrap: 'anywhere' }}>{v.guion}</p>
          </details>
        )}

        {v.publicaciones.length > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {v.publicaciones.map((p) => `Borrador en ${DESTINO[p.destino]} (${dateTime(p.fecha)})`).join(' · ')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
          {v.puedeAprobar && boton(`a-${v.id}`, 'Aprobar', 'Aprobando…', onAprobar, true)}
          {v.yaAprobaste && <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Tu aprobación quedó registrada</span>}
          {v.puedeRechazar && boton(`r-${v.id}`, v.esTuyo ? 'Descartar mi video' : 'Rechazar y borrar', 'Borrando…', onRechazar)}
          {boton(`m-${v.id}`, 'Mejorar con Claude', 'Abriendo…', onMejorar)}
          {boton(`d-${v.id}`, 'Descargar', 'Preparando…', onDescargar)}
          {aprobado && v.tipo === 'MARKETING' && (
            <>
              {boton(`t-${v.id}`, 'Pasar a borrador de TikTok', 'Enviando…', onTiktok)}
              {boton(`i-${v.id}`, 'Pasar a borrador de Instagram', 'Guardando…', onInstagram)}
            </>
          )}
        </div>

        <Comentarios v={v} setAviso={setAviso} onCambio={onCambio} />
      </div>
    </div>
  )
}

// Comentarios de cualquiera del equipo, en todas las fases del video. Se cargan al abrir la sección.
function Comentarios({ v, setAviso, onCambio }: { v: VideoDeCola; setAviso: (a: Aviso) => void; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState<VideoComentario[] | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cuenta, setCuenta] = useState(v.comentarios)

  const abrir = async () => {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (siguiente && lista === null) {
      try {
        const c = await platformApi.videoComentarios(v.id)
        setLista(c)
        setCuenta(c.length)
      } catch (e) {
        setAviso({ variant: 'error', title: 'No se pudieron leer los comentarios', description: e instanceof Error ? e.message : undefined })
        setAbierto(false)
      }
    }
  }

  const enviar = async () => {
    const t = texto.trim()
    if (!t) return
    setEnviando(true)
    try {
      const c = await platformApi.videoComentar(v.id, t)
      setLista((l) => [...(l ?? []), c])
      setCuenta((n) => n + 1)
      setTexto('')
      onCambio()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo comentar', description: e instanceof Error ? e.message : undefined })
    } finally {
      setEnviando(false)
    }
  }

  const borrar = async (c: VideoComentario) => {
    try {
      await platformApi.videoBorrarComentario(v.id, c.id)
      setLista((l) => (l ?? []).filter((x) => x.id !== c.id))
      setCuenta((n) => Math.max(0, n - 1))
      onCambio()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo borrar el comentario', description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 4 }}>
      <button type="button" onClick={abrir} aria-expanded={abierto} className="ds-hover" style={{ ...btnGhostSm, height: 32 }}>
        {abierto ? 'Ocultar comentarios' : `Comentarios${cuenta > 0 ? ` (${cuenta})` : ''}`}
      </button>
      {abierto && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista === null ? <Loader /> : lista.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>Todavía nadie opinó. Podés dejar tu opinión o una idea para mejorarlo.</p>
          ) : lista.map((c) => (
            <div key={c.id} style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-body)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--color-text)' }}>{c.autor}</strong>
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{dateTime(c.fecha)}</span>
                {c.esTuyo && <button type="button" onClick={() => borrar(c)} className="ds-hover" aria-label="Borrar mi comentario" style={{ ...btnGhostSm, height: 24, padding: '0 8px', fontSize: 11.5 }}>Borrar</button>}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.texto}</div>
            </div>
          ))}
          <textarea
            value={texto} onChange={(ev) => setTexto(ev.target.value)} maxLength={1000} aria-label="Tu comentario"
            placeholder="Tu opinión o qué mejorarías (por ejemplo: «el gancho es lento», «falta el logo al final»)"
            style={{ ...inputStyle, height: 'auto', minHeight: 70, padding: '10px 13px', lineHeight: 1.5, resize: 'vertical', width: '100%' }}
          />
          <div>
            <button type="button" onClick={enviar} disabled={enviando || !texto.trim()} style={{ ...btnPrimary, height: 34, opacity: enviando || !texto.trim() ? 0.6 : 1 }}>
              {enviando ? 'Enviando…' : 'Comentar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
