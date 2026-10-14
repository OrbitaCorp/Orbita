import { useState } from 'react'
import { platformApi, type VideoDeCola, type VideoEstado } from '@/lib/platform/api'
import type { ToastVariant } from '@/design-system/components/Toast'
import { useFetch, Card, Chip, Loader, ErrorBox, Empty, ConfirmModal, dateTime, btnGhostSm, btnPrimary } from './ui'

// Marketing → Videos: la cola de videos que genera el equipo con su propio Claude (en su computadora, con el conector
// de Órbita). Acá se miran, se aprueban o se rechazan (rechazar borra el archivo) y, una vez aprobados, se descargan o
// se pasan como BORRADOR a TikTok o a Instagram: la persona los termina ahí. Nada se publica solo.
// Lo aprobado queda como registro. Qué hace cada llamada: apps/api/src/marketing/videos/.

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

export function PanelVideos({ puedeEditar, setAviso }: { puedeEditar: boolean; setAviso: (a: Aviso) => void }) {
  const [tick, setTick] = useState(0)
  const { data, loading, error } = useFetch(() => platformApi.videosCola(), [tick])
  const [filtro, setFiltro] = useState<Filtro>('PENDIENTE')
  const [rechazando, setRechazando] = useState<VideoDeCola | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const recargar = () => setTick((n) => n + 1)
  // Todas las acciones siguen el mismo camino: marcar ocupado, avisar el resultado y recargar la cola.
  const accion = async (clave: string, hacer: () => Promise<unknown>, exito: Aviso) => {
    setOcupado(clave)
    try {
      await hacer()
      setAviso(exito)
      recargar()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo completar', description: e instanceof Error ? e.message : undefined })
    } finally {
      setOcupado(null)
    }
  }

  const visibles = (data ?? []).filter((v) => (filtro === 'TODOS' ? true : filtro === 'APROBADO' ? v.estado !== 'PENDIENTE' : v.estado === 'PENDIENTE'))
  const pendientes = (data ?? []).filter((v) => v.estado === 'PENDIENTE').length

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

  return (
    <>
      <Card
        title="Cola de videos"
        subtitle="Los videos que generó el equipo con su Claude. Aprobá los que sirven, rechazá el resto (se borran) y pasalos a TikTok o Instagram como borrador."
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
          <Empty text={filtro === 'PENDIENTE' ? 'No hay videos para aprobar. Pedile a tu Claude, con el conector de Órbita, algo como «generame 3 videos» y aparecen acá.' : 'Todavía no hay videos en esta lista.'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {visibles.map((v) => (
              <TarjetaDeVideo
                key={v.id} v={v} puedeEditar={puedeEditar} ocupado={ocupado}
                onAprobar={() => accion(`a-${v.id}`, () => platformApi.videoAprobar(v.id), { variant: 'success', title: 'Video aprobado' })}
                onRechazar={() => setRechazando(v)}
                onDescargar={() => descargar(v)}
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
          body={`«${rechazando.titulo}» se borra del almacenamiento y de la cola. No se puede deshacer.`}
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
    </>
  )
}

function TarjetaDeVideo({ v, puedeEditar, ocupado, onAprobar, onRechazar, onDescargar, onTiktok, onInstagram }: {
  v: VideoDeCola; puedeEditar: boolean; ocupado: string | null
  onAprobar: () => void; onRechazar: () => void; onDescargar: () => void; onTiktok: () => void; onInstagram: () => void
}) {
  const e = ESTADO[v.estado]
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
        style={{ width: vertical ? 200 : 320, maxWidth: '100%', aspectRatio: vertical ? '9 / 16' : v.formato === 'CUADRADO' ? '1 / 1' : '16 / 9', background: '#000', borderRadius: 10, flexShrink: 0 }}
      />
      <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{v.titulo}</span>
          <Chip text={e.texto} tone={e.tono} dot />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
          {FORMATO[v.formato]}{v.duracionSeg ? ` · ${v.duracionSeg} s` : ''} · {mb(v.bytes)} · generado el {dateTime(v.createdAt)}
          {vence !== null && <> · se borra solo {vence === 0 ? 'hoy' : `en ${vence} ${vence === 1 ? 'día' : 'días'}`} si nadie lo revisa</>}
        </div>

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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {!aprobado ? (
            <>
              {boton(`a-${v.id}`, 'Aprobar', 'Aprobando…', onAprobar, true)}
              {boton(`r-${v.id}`, 'Rechazar y borrar', 'Borrando…', onRechazar)}
              {boton(`d-${v.id}`, 'Descargar', 'Preparando…', onDescargar)}
            </>
          ) : (
            <>
              {boton(`d-${v.id}`, 'Descargar', 'Preparando…', onDescargar)}
              {boton(`t-${v.id}`, 'Pasar a borrador de TikTok', 'Enviando…', onTiktok)}
              {boton(`i-${v.id}`, 'Pasar a borrador de Instagram', 'Guardando…', onInstagram)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
