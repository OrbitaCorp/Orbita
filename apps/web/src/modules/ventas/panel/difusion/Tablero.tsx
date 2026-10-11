import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import {
  getInstagramComentarios, getInstagramEstadisticas, getInstagramIdeas, getInstagramNoLeidos, getInstagramPosts,
  type InstagramEstadisticas, type InstagramEstado, type InstagramIdea, type InstagramPublicacion,
} from '@/lib/api'
import { contarComentarios } from './filtroComentarios'
import { haceCuanto, numero, variacion } from './formato'

// Tablero de Difusión (la pantalla de Instagram con la cuenta conectada): lo de la semana, lo que está esperando
// una respuesta y qué conviene publicar. Cada bloque se carga por su cuenta: si uno falla (un permiso que falta,
// Instagram que no responde) ese bloque no se muestra y los demás siguen.

interface Props {
  estado: Extract<InstagramEstado, { connected: true }>
}

interface Datos {
  semana?: InstagramEstadisticas
  mensajesSinLeer?: number
  comentariosSinResponder?: number
  ideas?: InstagramIdea[]
  ultima?: InstagramPublicacion | null
}

export function Tablero({ estado }: Props) {
  const router = useRouter()
  const [datos, setDatos] = useState<Datos>({})
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let cancelado = false
    const poner = (parte: Datos) => { if (!cancelado) setDatos((d) => ({ ...d, ...parte })) }
    const tareas: Promise<unknown>[] = [
      getInstagramNoLeidos().then((r) => poner({ mensajesSinLeer: r.count })).catch(() => undefined),
      getInstagramIdeas().then((ideas) => poner({ ideas })).catch(() => undefined),
    ]
    if (estado.puedeVerEstadisticas) tareas.push(getInstagramEstadisticas(7).then((semana) => poner({ semana })).catch(() => undefined))
    if (estado.puedeComentar) {
      tareas.push(getInstagramComentarios().then((r) => poner({ comentariosSinResponder: contarComentarios(r.publicaciones)['sin-responder'] })).catch(() => undefined))
    }
    if (estado.puedePublicar) {
      tareas.push(getInstagramPosts().then((posts) => poner({ ultima: posts.find((p) => p.estado === 'PUBLISHED') ?? null })).catch(() => undefined))
    }
    Promise.all(tareas).finally(() => { if (!cancelado) setListo(true) })
    return () => { cancelado = true }
  }, [estado.puedeVerEstadisticas, estado.puedeComentar, estado.puedePublicar])

  const ir = (vista: string, extra: Record<string, string> = {}) => router.push({ query: { ...router.query, vista, ...extra } })

  const { semana, mensajesSinLeer, comentariosSinResponder, ideas, ultima } = datos
  const kpis: { titulo: string; valor: number | null; cambio: number | null }[] = semana ? [
    { titulo: 'Alcance', valor: semana.metricas.alcance, cambio: variacion(semana.metricas.alcance, semana.anterior?.alcance) },
    { titulo: 'Interacciones', valor: semana.metricas.interacciones, cambio: variacion(semana.metricas.interacciones, semana.anterior?.interacciones) },
    { titulo: 'Seguidores', valor: semana.cuenta.seguidores, cambio: null },
  ] : []

  const pendientes: { clave: string; titulo: string; texto: string; cuenta: number; vista: string }[] = []
  if (mensajesSinLeer !== undefined) {
    pendientes.push({ clave: 'mensajes', titulo: 'Mensajes sin leer', texto: mensajesSinLeer > 0 ? 'Personas esperando tu respuesta.' : 'Estás al día.', cuenta: mensajesSinLeer, vista: 'mensajes' })
  }
  if (comentariosSinResponder !== undefined) {
    pendientes.push({ clave: 'comentarios', titulo: 'Comentarios sin responder', texto: comentariosSinResponder > 0 ? 'En tus últimas publicaciones.' : 'Respondiste todos.', cuenta: comentariosSinResponder, vista: 'comentarios' })
  }

  const diasSinPublicar = ultima ? Math.floor((Date.now() - new Date(ultima.createdAt).getTime()) / 86_400_000) : null

  return (
    <div className="tab-raiz">
      <style>{CSS}</style>

      {kpis.length > 0 && (
        <section aria-label="Tu semana">
          <div className="tab-titulo-fila">
            <h2 className="tab-titulo">Tu semana</h2>
            <button type="button" className="tab-enlace" onClick={() => ir('estadisticas')}>Ver estadísticas <ArrowRight size={13} aria-hidden /></button>
          </div>
          <div className="tab-kpis">
            {kpis.map((k) => (
              <div key={k.titulo} className="tab-tarjeta tab-kpi">
                <p className="tab-kpi-etiqueta">{k.titulo}</p>
                <p className="tab-kpi-valor">{numero(k.valor)}</p>
                {k.cambio !== null && (
                  <p className={`tab-kpi-cambio ${k.cambio > 0 ? 'tab-sube' : k.cambio < 0 ? 'tab-baja' : ''}`}>
                    {k.cambio === 0 ? 'Igual que la semana pasada' : `${k.cambio > 0 ? '↑' : '↓'} ${Math.abs(k.cambio)} % vs. la semana pasada`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {pendientes.length > 0 && (
        <section aria-label="Para atender">
          <h2 className="tab-titulo">Para atender</h2>
          <div className="tab-pendientes">
            {pendientes.map((p) => (
              <button key={p.clave} type="button" className="tab-tarjeta tab-pendiente" onClick={() => ir(p.vista)}>
                <span className={`tab-cuenta${p.cuenta > 0 ? ' tab-cuenta-activa' : ''}`}>{p.cuenta}</span>
                <span className="tab-pendiente-texto">
                  <span className="tab-pendiente-titulo">{p.titulo}</span>
                  <span className="tab-pendiente-sub">{p.texto}</span>
                </span>
                <ArrowRight size={15} aria-hidden className="tab-flecha" />
              </button>
            ))}
          </div>
        </section>
      )}

      {estado.puedePublicar && (
        <section aria-label="Para publicar">
          <div className="tab-titulo-fila">
            <h2 className="tab-titulo">Para publicar</h2>
            <button type="button" className="tab-enlace" onClick={() => ir('publicaciones')}>Nueva publicación <ArrowRight size={13} aria-hidden /></button>
          </div>
          {diasSinPublicar !== null && diasSinPublicar >= 7 && (
            <p className="tab-aviso">Hace {diasSinPublicar} días que no publicás desde Órbita. Publicar seguido ayuda a que te vean más.</p>
          )}
          {ideas && ideas.length > 0 ? (
            <ul className="tab-ideas">
              {ideas.map((i) => (
                <li key={i.productId} className="tab-tarjeta tab-idea">
                  <span className="tab-idea-foto">{i.foto ? <img src={i.foto} alt="" /> : null}</span>
                  <span className="tab-idea-texto">
                    <span className="tab-pendiente-titulo">{i.nombre}</span>
                    <span className="tab-pendiente-sub">{i.motivo}{i.fotos > 1 ? ` · ${i.fotos} fotos` : ''}</span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => ir('publicaciones', { producto: i.productId, nombre: i.nombre })}>Publicar</Button>
                </li>
              ))}
            </ul>
          ) : listo ? (
            <p className="tab-vacio">
              {ideas ? 'Ya mostraste en Instagram todos tus productos publicados. Podés armar una publicación nueva con fotos o videos propios.' : 'Armá una publicación con fotos o videos de tu computadora, o con un producto de tu tienda.'}
            </p>
          ) : null}
          {ultima && <p className="tab-ultima">Última publicación desde Órbita: {haceCuanto(ultima.createdAt)}.</p>}
        </section>
      )}
    </div>
  )
}

const CSS = `
.tab-raiz { display: flex; flex-direction: column; gap: 26px; margin-top: 22px; }
.tab-titulo { margin: 0 0 12px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.tab-titulo-fila { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.tab-enlace { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; padding: 0; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; color: var(--color-primary); }
.tab-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }
.tab-enlace:focus-visible, .tab-pendiente:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.tab-tarjeta { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }

.tab-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.tab-kpi { padding: 16px 18px; }
.tab-kpi-etiqueta { margin: 0 0 6px; font-size: 12.5px; font-weight: 600; color: var(--color-muted); }
.tab-kpi-valor { margin: 0 0 4px; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: var(--color-text); font-variant-numeric: tabular-nums; }
.tab-kpi-cambio { margin: 0; font-size: 12px; font-weight: 600; color: var(--color-muted); }
.tab-sube { color: var(--color-success); }
.tab-baja { color: var(--color-error); }

.tab-pendientes { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.tab-pendiente { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 16px; font: inherit; text-align: left; cursor: pointer; transition: border-color 150ms; }
.tab-pendiente:hover { border-color: var(--color-muted); }
.tab-cuenta { min-width: 40px; height: 40px; padding: 0 10px; box-sizing: border-box; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-muted); background: var(--color-surface-alt); }
.tab-cuenta-activa { color: var(--color-on-primary); background: var(--color-primary); }
.tab-pendiente-texto, .tab-idea-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tab-pendiente-titulo { font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab-pendiente-sub { font-size: 12.5px; color: var(--color-muted); }
.tab-flecha { flex-shrink: 0; color: var(--color-muted); }

.tab-aviso { margin: 0 0 12px; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; color: var(--color-text); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.tab-ideas { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.tab-idea { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
.tab-idea-foto { width: 52px; height: 52px; flex-shrink: 0; overflow: hidden; border-radius: 10px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.tab-idea-foto img { width: 100%; height: 100%; object-fit: contain; }
.tab-vacio { margin: 0; padding: 20px; text-align: center; font-size: 13px; line-height: 1.55; color: var(--color-muted); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: 16px; }
.tab-ultima { margin: 12px 0 0; font-size: 12.5px; color: var(--color-muted); }

@media (max-width: 640px) { .tab-kpis { grid-template-columns: minmax(0, 1fr); } .tab-ideas { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .tab-pendiente { transition: none; } }
`
