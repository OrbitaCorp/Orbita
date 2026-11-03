import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { CalendarClock, ExternalLink, Heart, MessageCircle } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { ApiError, getInstagramRendimiento, type InstagramRendimiento } from '@/lib/api'
import { cuando, nombreDelDia, ventanaHoraria } from './fechaLocal'
import { haceCuanto, numero, resumir } from './formato'

// Difusión → Estadísticas, parte de "qué hacer con esto": cuándo publicar, qué formato le funciona mejor a la cuenta
// y cómo le fue a cada una de las últimas publicaciones. Sale de las últimas 50 publicaciones (me gusta y
// comentarios, que es lo que Instagram da); con menos de 8 dice que la muestra es chica en vez de afirmar nada.

const NOMBRES_DE_TIPO = { foto: 'Fotos', carrusel: 'Carruseles', reel: 'Reels', video: 'Videos' } as const
const NOMBRE_SINGULAR = { foto: 'Foto', carrusel: 'Carrusel', reel: 'Reel', video: 'Video' } as const

export function RendimientoDeLaCuenta() {
  const router = useRouter()
  const [datos, setDatos] = useState<InstagramRendimiento | null>(null)
  const [error, setError] = useState<string | null>(null)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  useEffect(() => {
    getInstagramRendimiento()
      .then((r) => { if (montado.current) setDatos(r) })
      .catch((e) => { if (montado.current) setError(e instanceof ApiError ? e.message : 'No se pudo analizar tu cuenta.') })
  }, [])

  if (error) return <p className="rc-error" role="alert"><style>{CSS}</style>{error}</p>
  if (!datos) return <div className="rc-esqueleto" aria-busy="true"><style>{CSS}</style><span /><span /></div>

  const maximo = Math.max(1, ...datos.tipos.map((t) => t.promedio))
  const programar = () => { void router.push({ query: { ...router.query, vista: 'publicaciones', cuando: datos.proximoMomento } }) }

  return (
    <section className="rc-raiz" aria-label="Qué te funciona mejor">
      <style>{CSS}</style>
      <h2 className="rc-titulo">Qué te funciona mejor</h2>

      {!datos.suficiente && (
        <p className="rc-aviso">
          Orbi miró {datos.muestra} {datos.muestra === 1 ? 'publicación' : 'publicaciones'} de tu cuenta: todavía son pocas para sacar conclusiones.
          Con 8 o más, acá aparecen tus mejores días, horarios y formatos.
        </p>
      )}

      <div className="rc-grilla">
        <article className="rc-tarjeta">
          <h3 className="rc-subtitulo">Mejores momentos para publicar</h3>
          {datos.suficiente && datos.mejoresDias.length + datos.mejoresHoras.length > 0 ? (
            <>
              {datos.mejoresDias.length > 0 && (
                <>
                  <p className="rc-etiqueta">Días</p>
                  <ul className="rc-chips">
                    {datos.mejoresDias.map((d) => (
                      <li key={d.clave} className="rc-chip"><strong>{nombreDelDia(d.clave)}</strong> <span>{d.promedio} en promedio · {d.publicaciones} publicaciones</span></li>
                    ))}
                  </ul>
                </>
              )}
              {datos.mejoresHoras.length > 0 && (
                <>
                  <p className="rc-etiqueta">Horarios (hora de Argentina)</p>
                  <ul className="rc-chips">
                    {datos.mejoresHoras.map((h) => (
                      <li key={h.clave} className="rc-chip"><strong>{ventanaHoraria(h.clave)}</strong> <span>{h.promedio} en promedio · {h.publicaciones} publicaciones</span></li>
                    ))}
                  </ul>
                </>
              )}
              <p className="rc-nota">"En promedio" son me gusta más comentarios por publicación. Un día u horario con una sola publicación no se cuenta: puede ser casualidad.</p>
            </>
          ) : (
            <p className="rc-nota" style={{ margin: 0 }}>Todavía no hay suficientes publicaciones por día y horario para marcar uno como el mejor.</p>
          )}
          <div className="rc-accion">
            <Button size="sm" variant="secondary" onClick={programar} icon={<CalendarClock size={14} aria-hidden />}>
              Programar para {cuando(datos.proximoMomento)}
            </Button>
          </div>
        </article>

        <article className="rc-tarjeta">
          <h3 className="rc-subtitulo">Qué formato funciona mejor</h3>
          {datos.tipos.length === 0 ? (
            <p className="rc-nota" style={{ margin: 0 }}>Todavía no hay publicaciones para comparar.</p>
          ) : (
            <ul className="rc-barras">
              {datos.tipos.map((t) => (
                <li key={t.tipo}>
                  <div className="rc-barra-fila">
                    <span className="rc-barra-nombre">{NOMBRES_DE_TIPO[t.tipo]}</span>
                    <span className="rc-barra-valor">{t.promedio} <span>· {t.publicaciones} {t.publicaciones === 1 ? 'publicación' : 'publicaciones'}</span></span>
                  </div>
                  <span className="rc-barra" role="img" aria-label={`${NOMBRES_DE_TIPO[t.tipo]}: ${t.promedio} interacciones en promedio`}><span style={{ width: `${Math.max(4, (t.promedio / maximo) * 100)}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
          <p className="rc-nota">Interacciones (me gusta + comentarios) en promedio por publicación.</p>
        </article>
      </div>

      {datos.publicaciones.length > 0 && (
        <article className="rc-tarjeta" style={{ marginTop: 14 }}>
          <h3 className="rc-subtitulo">Tus últimas publicaciones, una al lado de la otra</h3>
          <ol className="rc-lista">
            {datos.publicaciones.slice(0, 10).map((p) => (
              <li key={p.id} className="rc-fila">
                <span className="rc-miniatura">{p.imagen ? <img src={p.imagen} alt="" /> : null}</span>
                <div className="rc-fila-texto">
                  <p className="rc-fila-titulo">{p.texto ? resumir(p.texto, 70) : 'Publicación sin texto'}</p>
                  <p className="rc-fila-meta">
                    <span className="rc-tipo">{NOMBRE_SINGULAR[p.tipo]}</span>
                    <span className="rc-dato"><Heart size={12} aria-hidden /> {numero(p.likes)}</span>
                    <span className="rc-dato"><MessageCircle size={12} aria-hidden /> {numero(p.comentarios)}</span>
                    <span>{haceCuanto(p.fecha)}</span>
                  </p>
                </div>
                <span className="rc-total" title="Me gusta + comentarios">{numero(p.interacciones)}</span>
                {p.enlace && <a className="rc-enlace" href={p.enlace} target="_blank" rel="noopener noreferrer" aria-label="Ver en Instagram"><ExternalLink size={14} aria-hidden /></a>}
              </li>
            ))}
          </ol>
        </article>
      )}
    </section>
  )
}

const CSS = `
.rc-raiz { margin-top: 24px; }
.rc-titulo { margin: 0 0 12px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.rc-aviso { margin: 0 0 12px; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; color: var(--color-muted); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.rc-error { margin: 18px 0 0; font-size: 12.5px; color: var(--color-error); }
.rc-esqueleto { margin-top: 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.rc-esqueleto span { height: 160px; border-radius: 16px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.rc-grilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.rc-tarjeta { padding: 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.rc-subtitulo { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--color-text); }
.rc-etiqueta { margin: 10px 0 6px; font-size: 12px; font-weight: 600; color: var(--color-muted); }
.rc-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rc-chip { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border-radius: 10px; background: var(--color-surface-alt); border: 1px solid var(--color-border); font-size: 13px; color: var(--color-text); }
.rc-chip strong { text-transform: capitalize; font-weight: 600; }
.rc-chip span { font-size: 12px; color: var(--color-muted); }
.rc-nota { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--color-muted); }
.rc-accion { margin-top: 14px; }

.rc-barras { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.rc-barra-fila { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.rc-barra-nombre { font-size: 13px; font-weight: 600; color: var(--color-text); }
.rc-barra-valor { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-text); }
.rc-barra-valor span { font-weight: 400; font-size: 12px; color: var(--color-muted); }
.rc-barra { display: block; height: 8px; border-radius: 4px; overflow: hidden; background: var(--color-surface-alt); }
.rc-barra span { display: block; height: 100%; border-radius: 4px; background: var(--color-text); transition: width 300ms; }

.rc-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rc-fila { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
.rc-fila:last-child { border-bottom: none; }
.rc-miniatura { width: 42px; height: 42px; flex-shrink: 0; overflow: hidden; border-radius: 9px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.rc-miniatura img { width: 100%; height: 100%; object-fit: cover; }
.rc-fila-texto { flex: 1; min-width: 0; }
.rc-fila-titulo { margin: 0 0 3px; font-size: 13px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-fila-meta { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--color-muted); }
.rc-tipo { padding: 1px 8px; border-radius: 9px; font-weight: 600; color: var(--color-text); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.rc-dato { display: inline-flex; align-items: center; gap: 3px; }
.rc-total { min-width: 36px; text-align: right; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text); }
.rc-enlace { display: inline-flex; color: var(--color-muted); }
.rc-enlace:hover { color: var(--color-primary); }

@media (max-width: 760px) { .rc-grilla, .rc-esqueleto { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .rc-barra span { transition: none; } }
`
