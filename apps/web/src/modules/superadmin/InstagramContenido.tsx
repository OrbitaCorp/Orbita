import { useState } from 'react'
import { CalendarClock, ExternalLink, EyeOff, Eye, Play, RefreshCw } from 'lucide-react'
import { platformApi } from '@/lib/platform/api'
import type { IgPublicacionDeLaCuenta } from '@/lib/platform/api'
import type { InstagramPublicacion, InstagramPublicacionComentada } from '@/lib/api'
import { haceCuanto, numero, resumir, variacion } from '@/modules/ventas/panel/difusion/formato'
import { Card, Chip, Empty, Loader, btnGhostSm, btnPrimary, inputStyle } from './ui'
import { Cifras, ErrorConReintento, Miniatura, Numero, grillaDeTarjetas, motivoDe, tarjeta, useCarga } from './contenidoUi'
import { NuevaPublicacion } from './NuevaPublicacion'

// El contenido de la cuenta de Instagram de la empresa (@orbita.site) dentro de Marketing → Instagram: lo ya publicado
// con sus números, los comentarios y las estadísticas, y subir publicaciones nuevas. Lo sirve el mismo código que
// Difusión en el panel de un negocio, ya atado al negocio de la empresa (apps/api/src/marketing/instagram-contenido.*).
// Todo es de superadmin: publicar y contestar sale con el nombre de la empresa y lo ven los seguidores.

type Aviso = (a: { variant: 'success' | 'error'; title: string; description?: string }) => void

// ─── Publicaciones ──────────────────────────────────────────────────────────

const ETIQUETA_TIPO: Record<IgPublicacionDeLaCuenta['tipo'], string> = { foto: 'Foto', video: 'Video', carrusel: 'Carrusel' }

const ESTADO_DE_ORBITA: Record<InstagramPublicacion['estado'], { texto: string; tono: 'green' | 'amber' | 'gray' | 'red' | 'blue' }> = {
  DRAFT: { texto: 'Borrador', tono: 'gray' },
  SCHEDULED: { texto: 'Programada', tono: 'blue' },
  PROCESSING: { texto: 'Procesando', tono: 'amber' },
  PUBLISHING: { texto: 'Publicando', tono: 'amber' },
  PUBLISHED: { texto: 'Publicada', tono: 'green' },
  FAILED: { texto: 'Falló', tono: 'red' },
}

export function InstagramPublicaciones({ puedePublicar, permisoDePublicar, setAviso }: { puedePublicar: boolean; permisoDePublicar: boolean; setAviso: Aviso }) {
  const cuenta = useCarga(() => platformApi.igPublicacionesDeLaCuenta(), [], 'No se pudieron cargar las publicaciones de la cuenta.')
  const orbita = useCarga(() => platformApi.igPublicacionesDeOrbita(), [], 'No se pudieron cargar las publicaciones subidas desde Órbita.')
  const [nueva, setNueva] = useState(false)

  const recargar = () => { cuenta.recargar(); orbita.recargar() }
  // Lo que todavía no salió: los borradores y programadas se pueden descartar, las que Instagram sigue procesando se pueden empujar.
  const pendientes = (orbita.data ?? []).filter((p) => p.estado !== 'PUBLISHED')

  async function descartar(p: InstagramPublicacion) {
    try {
      await platformApi.igDescartarPublicacion(p.id)
      orbita.recargar()
      setAviso({ variant: 'success', title: 'Publicación descartada' })
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo descartar', description: motivoDe(e, 'Probá de nuevo.') })
    }
  }

  return (
    <>
      <Card
        title="En la cuenta"
        subtitle="Lo que ya está publicado en Instagram, de lo más nuevo a lo más viejo"
        action={(
          <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={recargar} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}><RefreshCw size={13} />Actualizar</button>
            {puedePublicar && permisoDePublicar && <button type="button" onClick={() => setNueva(true)} style={{ ...btnPrimary, height: 34, padding: '0 14px', fontSize: 13 }}>Nueva publicación</button>}
          </span>
        )}
      >
        {!permisoDePublicar && puedePublicar && (
          <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Para subir publicaciones hace falta el permiso de publicar: tocá «Renovar la conexión» y aceptá todos los permisos que pide Instagram.
          </div>
        )}
        {cuenta.cargando && !cuenta.data ? <Loader />
          : cuenta.error ? <ErrorConReintento msg={cuenta.error} onReintentar={cuenta.recargar} />
          : (cuenta.data ?? []).length === 0 ? <Empty text="La cuenta todavía no tiene publicaciones." />
          : (
            <div style={grillaDeTarjetas}>
              {(cuenta.data ?? []).map((p) => <TarjetaDeLaCuenta key={p.id} p={p} />)}
            </div>
          )}
      </Card>

      {(orbita.data?.length ?? 0) > 0 && (
        <Card title="Subidas desde Órbita" subtitle="Programadas, en proceso, borradores y las que salieron desde acá">
          {orbita.error ? <ErrorConReintento msg={orbita.error} onReintentar={orbita.recargar} /> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(orbita.data ?? []).map((p, i, todas) => {
                const e = ESTADO_DE_ORBITA[p.estado]
                const sinSalir = pendientes.some((x) => x.id === p.id)
                return (
                  <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: i === todas.length - 1 ? 'none' : '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-alt)' }}>
                      {p.miniatura && <img src={p.miniatura} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{resumir(p.caption, 110) || 'Sin texto'}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip text={e.texto} tone={e.tono} />
                        {p.programadaPara && p.estado === 'SCHEDULED' && <span><CalendarClock size={12} style={{ verticalAlign: '-2px' }} /> {new Date(p.programadaPara).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                        {p.estado === 'PUBLISHED' && <span>{haceCuanto(p.createdAt)}</span>}
                        {p.estado === 'FAILED' && p.error && <span style={{ color: 'var(--color-error)' }}>{p.error}</span>}
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', gap: 8 }}>
                      {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="ds-hover" style={{ ...btnGhostSm, textDecoration: 'none', height: 32 }}>Ver<ExternalLink size={12} /></a>}
                      {puedePublicar && sinSalir && (p.estado === 'DRAFT' || p.estado === 'SCHEDULED') && <button type="button" onClick={() => void descartar(p)} className="ds-hover" style={{ ...btnGhostSm, height: 32 }}>Descartar</button>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {nueva && (
        <NuevaPublicacion
          onClose={() => setNueva(false)}
          onListo={(mensaje) => { setNueva(false); setAviso({ variant: 'success', title: mensaje }); recargar() }}
        />
      )}
    </>
  )
}

function TarjetaDeLaCuenta({ p }: { p: IgPublicacionDeLaCuenta }) {
  return (
    <div style={tarjeta}>
      <Miniatura url={p.imagen} alto={190}>
        <span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 999, background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 11, fontWeight: 600 }}>
          {p.tipo === 'video' && <Play size={10} fill="#fff" />}{p.reel ? 'Reel' : ETIQUETA_TIPO[p.tipo]}
        </span>
      </Miniatura>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{resumir(p.texto, 90) || 'Sin texto'}</div>
        <Cifras items={[
          { etiqueta: 'me gusta', valor: numero(p.likes) },
          { etiqueta: 'comentarios', valor: numero(p.comentarios) },
          ...(p.vistas !== null ? [{ etiqueta: 'vistas', valor: numero(p.vistas) }] : []),
          ...(p.alcance !== null ? [{ etiqueta: 'alcance', valor: numero(p.alcance) }] : []),
          ...(p.guardados !== null ? [{ etiqueta: 'guardados', valor: numero(p.guardados) }] : []),
          ...(p.compartidos !== null ? [{ etiqueta: 'compartidos', valor: numero(p.compartidos) }] : []),
        ]} />
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--color-muted)', paddingTop: 4 }}>
          <span>{haceCuanto(p.fecha)}</span>
          {p.enlace && <a href={p.enlace} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>Ver<ExternalLink size={11} /></a>}
        </div>
      </div>
    </div>
  )
}

// ─── Comentarios ────────────────────────────────────────────────────────────

export function InstagramComentarios({ puedePublicar, setAviso }: { puedePublicar: boolean; setAviso: Aviso }) {
  const { data, error, cargando, recargar, setData } = useCarga(() => platformApi.igComentarios(), [], 'No se pudieron cargar los comentarios.')
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiarOculto = (id: string, oculto: boolean) =>
    setData((d) => d && { ...d, publicaciones: d.publicaciones.map((p) => ({ ...p, comentarios: p.comentarios.map((c) => (c.id === id ? { ...c, oculto } : c)) })) })

  async function ocultar(id: string, oculto: boolean) {
    try {
      await platformApi.igOcultarComentario(id, oculto)
      cambiarOculto(id, oculto)
    } catch (e) {
      setAviso({ variant: 'error', title: oculto ? 'No se pudo ocultar' : 'No se pudo mostrar', description: motivoDe(e, 'Probá de nuevo.') })
    }
  }

  async function responder(id: string) {
    const t = texto.trim()
    if (!t) return
    setEnviando(true)
    try {
      await platformApi.igResponderComentario(id, t)
      setRespondiendo(null)
      setTexto('')
      setAviso({ variant: 'success', title: 'Respuesta publicada' })
      recargar()
    } catch (e) {
      setAviso({ variant: 'error', title: 'No se pudo responder', description: motivoDe(e, 'Probá de nuevo.') })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card
      title="Comentarios"
      subtitle="De las últimas publicaciones que tienen alguno"
      action={<button type="button" onClick={recargar} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}><RefreshCw size={13} />Actualizar</button>}
    >
      {cargando && !data ? <Loader />
        : error ? <ErrorConReintento msg={error} onReintentar={recargar} />
        : (data?.publicaciones ?? []).length === 0 ? <Empty text="Todavía no hay comentarios en las últimas publicaciones." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(data?.publicaciones ?? []).map((p: InstagramPublicacionComentada) => (
              <div key={p.id}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-alt)' }}>
                    {p.imagen && <img src={p.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{resumir(p.texto, 80) || 'Publicación sin texto'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{p.totalComentarios} {p.totalComentarios === 1 ? 'comentario' : 'comentarios'} · {haceCuanto(p.fecha)}</div>
                  </div>
                  {p.enlace && <a href={p.enlace} target="_blank" rel="noreferrer" className="ds-hover" aria-label="Abrir en Instagram" style={{ ...btnGhostSm, textDecoration: 'none', height: 30 }}><ExternalLink size={12} /></a>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '2px solid var(--color-border)', marginLeft: 8, paddingLeft: 14 }}>
                  {p.comentarios.map((c) => (
                    <div key={c.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--color-border)', opacity: c.oculto ? 0.55 : 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>
                        <strong style={{ fontWeight: 600 }}>{c.usuario}</strong> {c.texto}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 3, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{haceCuanto(c.fecha)}</span>
                        {c.likes > 0 && <span>{c.likes} me gusta</span>}
                        {c.oculto && <Chip text="Oculto" tone="gray" />}
                        {puedePublicar && (
                          <>
                            <button type="button" onClick={() => { setRespondiendo(respondiendo === c.id ? null : c.id); setTexto('') }} className="ds-hover" style={{ ...btnGhostSm, height: 26, padding: '0 9px' }}>Responder</button>
                            <button type="button" onClick={() => void ocultar(c.id, !c.oculto)} className="ds-hover" style={{ ...btnGhostSm, height: 26, padding: '0 9px' }}>
                              {c.oculto ? <><Eye size={12} />Mostrar</> : <><EyeOff size={12} />Ocultar</>}
                            </button>
                          </>
                        )}
                      </div>
                      {c.respuestas.map((r) => (
                        <div key={r.id} style={{ marginTop: 6, marginLeft: 16, fontSize: 12.5, color: 'var(--color-body)', overflowWrap: 'anywhere' }}>
                          <strong style={{ fontWeight: 600 }}>{r.usuario}</strong> {r.texto}
                        </div>
                      ))}
                      {respondiendo === c.id && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2200} autoFocus disabled={enviando}
                            placeholder={`Responder a ${c.usuario}…`} aria-label={`Responder a ${c.usuario}`}
                            onKeyDown={(e) => { if (e.key === 'Enter') void responder(c.id) }}
                            style={{ ...inputStyle, flex: '1 1 220px', height: 36 }}
                          />
                          <button type="button" onClick={() => void responder(c.id)} disabled={enviando || !texto.trim()} style={{ ...btnPrimary, height: 36, padding: '0 14px', opacity: enviando || !texto.trim() ? 0.6 : 1 }}>
                            {enviando ? 'Enviando…' : 'Responder'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      {!puedePublicar && <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-muted)' }}>Responder y ocultar comentarios es solo de super administradores.</div>}
    </Card>
  )
}

// ─── Estadísticas ───────────────────────────────────────────────────────────

const METRICAS: { clave: 'alcance' | 'visualizaciones' | 'interacciones' | 'cuentasInteractuaron' | 'visitasAlPerfil'; etiqueta: string; ayuda: string }[] = [
  { clave: 'alcance', etiqueta: 'Alcance', ayuda: 'Cuentas distintas que vieron tu contenido.' },
  { clave: 'visualizaciones', etiqueta: 'Visualizaciones', ayuda: 'Veces que se vio tu contenido.' },
  { clave: 'interacciones', etiqueta: 'Interacciones', ayuda: 'Me gusta, comentarios, guardados y compartidos.' },
  { clave: 'cuentasInteractuaron', etiqueta: 'Cuentas que interactuaron', ayuda: 'Cuentas distintas que interactuaron con tu contenido.' },
  { clave: 'visitasAlPerfil', etiqueta: 'Visitas al perfil', ayuda: 'Veces que se visitó el perfil.' },
]

export function InstagramEstadisticas() {
  const [dias, setDias] = useState<7 | 28>(7)
  const { data, error, cargando, recargar } = useCarga(() => platformApi.igEstadisticas(dias), [dias], 'No se pudieron cargar las estadísticas.')
  const rendimiento = useCarga(() => platformApi.igRendimiento(), [], 'No se pudo calcular el rendimiento.')

  return (
    <>
      <Card
        title="Estadísticas de la cuenta"
        subtitle={data ? `${new Date(data.desde).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} al ${new Date(data.hasta).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : 'Los números de la cuenta'}
        action={(
          <span style={{ display: 'inline-flex', gap: 8 }}>
            {([7, 28] as const).map((d) => (
              <button
                key={d} type="button" aria-pressed={dias === d} onClick={() => setDias(d)}
                style={{ ...btnGhostSm, height: 34, ...(dias === d ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-bg)' } : {}) }}
              >{d} días</button>
            ))}
          </span>
        )}
      >
        {cargando && !data ? <Loader />
          : error ? <ErrorConReintento msg={error} onReintentar={recargar} />
          : data && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                <Numero etiqueta="Seguidores" valor={numero(data.cuenta.seguidores)} />
                <Numero etiqueta="Publicaciones" valor={numero(data.cuenta.publicaciones)} />
                {METRICAS.map((m) => (
                  <Numero key={m.clave} etiqueta={m.etiqueta} ayuda={m.ayuda} valor={numero(data.metricas[m.clave])} cambio={variacion(data.metricas[m.clave], data.anterior?.[m.clave])} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 12 }}>
                Un «—» es un número que Instagram todavía no tiene (los datos demoran, y las cuentas con pocos seguidores tienen menos).
              </div>
            </>
          )}
      </Card>

      {data && data.destacadas.length > 0 && (
        <Card title="Lo que mejor funcionó" subtitle={`Las publicaciones con más interacción de los últimos ${dias} días`}>
          <div style={grillaDeTarjetas}>
            {data.destacadas.map((d) => (
              <div key={d.id} style={tarjeta}>
                <Miniatura url={d.imagen} alto={150} />
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{resumir(d.texto, 80) || 'Sin texto'}</div>
                  <Cifras items={[{ etiqueta: 'me gusta', valor: numero(d.likes) }, { etiqueta: 'comentarios', valor: numero(d.comentarios) }]} />
                  {d.enlace && <a href={d.enlace} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontSize: 12, textDecoration: 'none' }}>Ver en Instagram</a>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Qué publicar y cuándo" subtitle="Según las últimas 50 publicaciones de la cuenta">
        {rendimiento.cargando && !rendimiento.data ? <Loader />
          : rendimiento.error ? <ErrorConReintento msg={rendimiento.error} onReintentar={rendimiento.recargar} />
          : rendimiento.data && !rendimiento.data.suficiente ? <Empty text="Todavía hay pocas publicaciones para sacar conclusiones." />
          : rendimiento.data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.5 }}>{rendimiento.data.proximoMomento}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {rendimiento.data.tipos.map((t) => (
                  <Numero key={t.tipo} etiqueta={`${t.tipo[0].toUpperCase()}${t.tipo.slice(1)} · ${t.publicaciones}`} valor={numero(t.promedio)} ayuda="Interacciones promedio por publicación" />
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Interacciones promedio (me gusta + comentarios) por tipo de publicación.</div>
            </div>
          )}
      </Card>
    </>
  )
}

