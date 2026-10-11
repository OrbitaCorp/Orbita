import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Heart, MessageCircle, Sparkles } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { ApiError, getInstagramEstadisticas, pedirLecturaAOrbi, type InstagramEstado, type InstagramEstadisticas } from '@/lib/api'
import { Compuerta } from './Compuerta'
import { haceCuanto, numero, resumir, variacion } from './formato'
import { RendimientoDeLaCuenta } from './RendimientoDeLaCuenta'

// Difusión → Estadísticas: cuánta gente vio y reaccionó a lo que publica la cuenta en los últimos 7 o 28 días,
// y qué publicaciones funcionaron mejor. Instagram puede demorar hasta 48 horas en actualizar los números y no
// da algunos datos a cuentas con pocos seguidores: lo que falta se muestra como "—", no como un cero.

interface Props {
  estado: InstagramEstado | null
  /** Abre el modal de conexión de Instagram (si todavía no está conectado). */
  onAbrirConexion: () => void
}

export function Estadisticas({ estado, onAbrirConexion }: Props) {
  return (
    <Compuerta estado={estado} permiso="estadisticas" onAbrirConexion={onAbrirConexion}>
      {(usuario) => <Resumen usuario={usuario} />}
    </Compuerta>
  )
}

type Dias = 7 | 28

const KPIS: { clave: keyof InstagramEstadisticas['metricas']; titulo: string; ayuda: string }[] = [
  { clave: 'alcance', titulo: 'Alcance', ayuda: 'Cuentas distintas que vieron tu contenido.' },
  { clave: 'visualizaciones', titulo: 'Visualizaciones', ayuda: 'Veces que se vio tu contenido, incluso por la misma cuenta.' },
  { clave: 'interacciones', titulo: 'Interacciones', ayuda: 'Me gusta, comentarios, guardados y compartidos.' },
  { clave: 'cuentasInteractuaron', titulo: 'Cuentas que interactuaron', ayuda: 'Cuentas que reaccionaron a tu contenido.' },
  { clave: 'visitasAlPerfil', titulo: 'Visitas al perfil', ayuda: 'Veces que entraron a tu perfil.' },
]

function Resumen({ usuario }: { usuario: string | null }) {
  const [dias, setDias] = useState<Dias>(7)
  const [datos, setDatos] = useState<InstagramEstadisticas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async (d: Dias) => {
    setCargando(true); setError(null)
    try {
      setDatos(await getInstagramEstadisticas(d))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las estadísticas. Probá de nuevo en un momento.')
    } finally {
      setCargando(false)
    }
  }, [])
  useEffect(() => { cargar(dias) }, [cargar, dias])

  // La lectura de Orbi es de un período: al cambiarlo se descarta.
  const [lectura, setLectura] = useState<{ cargando: boolean; error: string | null; datos: { resumen: string; sugerencias: string[] } | null }>({ cargando: false, error: null, datos: null })
  useEffect(() => { setLectura({ cargando: false, error: null, datos: null }) }, [dias])
  const leerConOrbi = async () => {
    setLectura((l) => ({ ...l, cargando: true, error: null }))
    try {
      setLectura({ cargando: false, error: null, datos: await pedirLecturaAOrbi(dias) })
    } catch (e) {
      setLectura((l) => ({ ...l, cargando: false, error: e instanceof ApiError ? e.message : 'No se pudo generar con Orbi. Probá de nuevo.' }))
    }
  }

  return (
    <div className="est-raiz">
      <style>{CSS}</style>

      <div className="est-cabecera">
        <p className="est-titulo">Resumen de {usuario ? `@${usuario}` : 'tu cuenta'}</p>
        <div className="est-periodo" role="group" aria-label="Período">
          {([7, 28] as const).map((d) => (
            <button key={d} type="button" className={`est-opcion${dias === d ? ' est-opcion-activa' : ''}`} aria-pressed={dias === d} onClick={() => setDias(d)}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="est-error" role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => cargar(dias)}>Reintentar</Button>
        </div>
      )}

      {datos === null && cargando && <div className="est-esqueleto" aria-hidden>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} />)}</div>}

      {datos && (
        <div className={cargando ? 'est-cargando' : undefined}>
          <section className="est-orbi" aria-label="Lectura de Orbi">
            {lectura.datos ? (
              <>
                <p className="est-orbi-titulo"><Sparkles size={14} aria-hidden /> Lo que dicen tus números</p>
                <p className="est-orbi-texto">{lectura.datos.resumen}</p>
                {lectura.datos.sugerencias.length > 0 && (
                  <ul className="est-orbi-lista">
                    {lectura.datos.sugerencias.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <div className="est-orbi-fila">
                <p className="est-orbi-texto" style={{ margin: 0 }}>¿No sabés qué significan estos números? Orbi te los explica y te sugiere qué probar.</p>
                <Button variant="secondary" size="sm" loading={lectura.cargando} onClick={leerConOrbi} icon={<Sparkles size={14} aria-hidden />}>
                  Explicámelo
                </Button>
              </div>
            )}
            {lectura.error && <p className="est-orbi-error" role="alert">{lectura.error}</p>}
          </section>

          <div className="est-grilla">
            {KPIS.map((k) => {
              const valor = datos.metricas[k.clave]
              const cambio = variacion(valor, datos.anterior?.[k.clave])
              return (
                <section key={k.clave} className="est-tarjeta">
                  <p className="est-etiqueta">{k.titulo}</p>
                  <p className="est-valor">{numero(valor)}</p>
                  {cambio !== null && (
                    <p className={`est-cambio ${cambio > 0 ? 'est-cambio-sube' : cambio < 0 ? 'est-cambio-baja' : ''}`}>
                      {cambio === 0 ? 'Igual que' : `${cambio > 0 ? '↑' : '↓'} ${Math.abs(cambio)} % vs.`} los {datos.dias} días anteriores
                    </p>
                  )}
                  <p className="est-ayuda">{valor === null ? 'Instagram todavía no tiene este dato.' : k.ayuda}</p>
                </section>
              )
            })}
            <section className="est-tarjeta">
              <p className="est-etiqueta">Seguidores</p>
              <p className="est-valor">{numero(datos.cuenta.seguidores)}</p>
              <p className="est-ayuda">
                Hoy · {numero(datos.cuenta.publicaciones)} publicaciones{datos.cuenta.siguiendo !== null ? ` · seguís a ${numero(datos.cuenta.siguiendo)}` : ''}.
              </p>
            </section>
          </div>

          <section className="est-destacadas">
            <h2 className="est-subtitulo">Lo que mejor funcionó en estos {datos.dias} días</h2>
            {datos.destacadas.length === 0 ? (
              <p className="est-vacio">Todavía no hay publicaciones en este período. Cuando publiques, vas a ver acá cuáles tienen más movimiento.</p>
            ) : (
              <ol className="est-lista">
                {datos.destacadas.map((p, i) => (
                  <li key={p.id} className="est-fila">
                    <span className="est-puesto" aria-hidden>{i + 1}</span>
                    <span className="est-miniatura">{p.imagen ? <img src={p.imagen} alt="" /> : null}</span>
                    <div className="est-fila-texto">
                      <p className="est-fila-titulo">{p.texto ? resumir(p.texto, 80) : 'Publicación sin texto'}</p>
                      <p className="est-fila-meta">
                        <span className="est-dato"><Heart size={12} aria-hidden /> {numero(p.likes)}</span>
                        <span className="est-dato"><MessageCircle size={12} aria-hidden /> {numero(p.comentarios)}</span>
                        <span>{haceCuanto(p.fecha)}</span>
                      </p>
                    </div>
                    {p.enlace && (
                      <a className="est-enlace" href={p.enlace} target="_blank" rel="noopener noreferrer">
                        Ver <ExternalLink size={13} aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <RendimientoDeLaCuenta />

          <p className="est-nota">
            Instagram puede demorar hasta 48 horas en actualizar estos números, y algunos datos no aparecen en cuentas con pocos seguidores.
          </p>
        </div>
      )}
    </div>
  )
}

const CSS = `
.est-raiz { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.est-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.est-titulo { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text); }
.est-periodo { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); }
.est-opcion { min-height: 30px; padding: 0 14px; border: none; border-radius: 8px; background: transparent; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; color: var(--color-muted); transition: background-color 150ms, color 150ms; }
.est-opcion:hover { color: var(--color-text); }
.est-opcion-activa, .est-opcion-activa:hover { background: var(--color-surface); color: var(--color-text); font-weight: 600; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12); }
.est-opcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.est-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-radius: 12px; font-size: 13px; color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error); }
.est-cargando { opacity: 0.55; transition: opacity 150ms; pointer-events: none; }

.est-grilla { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.est-tarjeta { padding: 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.est-etiqueta { margin: 0 0 8px; font-size: 12.5px; font-weight: 600; color: var(--color-muted); }
.est-valor { margin: 0 0 6px; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: var(--color-text); font-variant-numeric: tabular-nums; }
.est-cambio { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--color-muted); }
.est-cambio-sube { color: var(--color-success); }
.est-cambio-baja { color: var(--color-error); }
.est-orbi { margin-bottom: 14px; padding: 16px 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.est-orbi-fila { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.est-orbi-titulo { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--color-text); }
.est-orbi-texto { margin: 0 0 8px; font-size: 13.5px; line-height: 1.55; color: var(--color-text); }
.est-orbi-lista { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.5; color: var(--color-text); }
.est-orbi-error { margin: 8px 0 0; font-size: 12.5px; color: var(--color-error); }
.est-ayuda { margin: 0; font-size: 12px; line-height: 1.45; color: var(--color-muted); }

.est-destacadas { margin-top: 20px; }
.est-subtitulo { margin: 0 0 12px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.est-vacio { margin: 0; padding: 22px; text-align: center; font-size: 13px; line-height: 1.55; color: var(--color-muted); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: 16px; }
.est-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.est-fila { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; }
.est-puesto { width: 22px; flex-shrink: 0; text-align: center; font-size: 13px; font-weight: 700; color: var(--color-muted); }
.est-miniatura { width: 46px; height: 46px; flex-shrink: 0; overflow: hidden; border-radius: 10px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.est-miniatura img { width: 100%; height: 100%; object-fit: cover; }
.est-fila-texto { flex: 1; min-width: 0; }
.est-fila-titulo { margin: 0 0 3px; font-size: 13.5px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.est-fila-meta { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--color-muted); }
.est-dato { display: inline-flex; align-items: center; gap: 4px; }
.est-enlace { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-size: 13px; font-weight: 500; color: var(--color-primary); text-decoration: none; }
.est-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }
.est-enlace:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 4px; }
.est-nota { margin: 18px 0 0; font-size: 12px; line-height: 1.5; color: var(--color-muted); }

.est-esqueleto { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.est-esqueleto span { height: 108px; border-radius: 16px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }

@media (max-width: 520px) { .est-orbi-fila { flex-direction: column; align-items: stretch; } }
@media (max-width: 860px) { .est-grilla, .est-esqueleto { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .est-grilla, .est-esqueleto { grid-template-columns: minmax(0, 1fr); } .est-valor { font-size: 24px; } }
@media (prefers-reduced-motion: reduce) { .est-opcion, .est-cargando { transition: none; } }
`
