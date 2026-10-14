import { ExternalLink, RefreshCw } from 'lucide-react'
import { platformApi } from '@/lib/platform/api'
import { haceCuanto, numero, resumir } from '@/modules/ventas/panel/difusion/formato'
import { Card, Empty, Loader, btnGhostSm } from './ui'
import { Cifras, ErrorConReintento, Miniatura, Numero, grillaDeTarjetas, tarjeta, useCarga } from './contenidoUi'

// Los videos que ya están publicados en la cuenta de TikTok de la empresa y sus números (vistas, me gusta,
// comentarios, compartidos), más el total de la cuenta. TikTok pide un permiso por cada parte (`video.list` y
// `user.info.stats`): si la conexión no los tiene se explica qué activar en la app de TikTok y que hay que volver a
// conectar. Los comentarios de los videos NO se pueden leer ni contestar: TikTok no los da con esta API, solo la cantidad.

const PERMISO_DE: Record<string, string> = {
  'video.list': 'ver los videos de la cuenta',
  'user.info.stats': 'ver los seguidores y los totales de la cuenta',
}

const duracion = (seg: number) => (seg >= 60 ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')} min` : `${seg} s`)

export function TiktokContenido({ refrescar }: { refrescar: number }) {
  const { data, error, cargando, recargar } = useCarga(() => platformApi.tiktokContenido(), [refrescar], 'No se pudieron cargar los videos de la cuenta.')

  return (
    <Card
      title="Videos de la cuenta"
      subtitle="Lo que ya está publicado en TikTok, con sus números"
      action={<button type="button" onClick={recargar} className="ds-hover" style={{ ...btnGhostSm, height: 34 }}><RefreshCw size={13} />Actualizar</button>}
    >
      {cargando && !data ? <Loader />
        : error ? <ErrorConReintento msg={error} onReintentar={recargar} />
        : data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.faltan.length > 0 && (
              <div role="status" style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 12.5, lineHeight: 1.55 }}>
                A la conexión de TikTok le {data.faltan.length === 1 ? 'falta un permiso' : 'faltan permisos'}: {data.faltan.map((p) => `«${p}» (${PERMISO_DE[p] ?? p})`).join(' y ')}.
                Hay que activarlos en la app de TikTok (developers.tiktok.com), sumarlos a <code>TIKTOK_SCOPES</code> en la API y volver a conectar la cuenta.
              </div>
            )}

            {data.perfil && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                <Numero etiqueta="Seguidores" valor={numero(data.perfil.seguidores)} />
                <Numero etiqueta="Siguiendo" valor={numero(data.perfil.siguiendo)} />
                <Numero etiqueta="Me gusta recibidos" valor={numero(data.perfil.likes)} />
                <Numero etiqueta="Videos" valor={numero(data.perfil.videos)} />
              </div>
            )}

            {data.videos === null ? null
              : data.videos.length === 0 ? <Empty text="La cuenta todavía no tiene videos publicados." />
              : (
                <div style={grillaDeTarjetas}>
                  {data.videos.map((v) => (
                    <div key={v.id} style={tarjeta}>
                      <Miniatura url={v.portada} alto={230}>
                        <span style={{ position: 'absolute', bottom: 8, right: 8, height: 22, padding: '0 8px', borderRadius: 999, background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{duracion(v.duracionSeg)}</span>
                      </Miniatura>
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{resumir(v.titulo, 90) || 'Sin título'}</div>
                        <Cifras items={[
                          { etiqueta: 'vistas', valor: numero(v.vistas) },
                          { etiqueta: 'me gusta', valor: numero(v.likes) },
                          { etiqueta: 'comentarios', valor: numero(v.comentarios) },
                          { etiqueta: 'compartidos', valor: numero(v.compartidos) },
                        ]} />
                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--color-muted)', paddingTop: 4 }}>
                          <span>{haceCuanto(v.fecha)}</span>
                          {v.enlace && <a href={v.enlace} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>Ver<ExternalLink size={11} /></a>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              TikTok no deja leer ni contestar los comentarios de los videos desde acá: solo se ve cuántos tiene cada uno. Se atienden desde la app de TikTok.
            </div>
          </div>
        )}
    </Card>
  )
}
