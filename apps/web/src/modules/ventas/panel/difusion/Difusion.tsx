import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Calendario } from './Calendario'
import { Comentarios } from './Comentarios'
import { Estadisticas } from './Estadisticas'
import { Mensajes } from './Mensajes'
import { Publicaciones } from './Publicaciones'
import { Sugeridas } from './Sugeridas'
import { Tablero } from './Tablero'
import { InstagramModal, Marca } from '../mensajes/components/InstagramModal'
import { useInstagramEstado } from '../mensajes/components/InstagramConexion'
import type { InstagramEstado } from '@/lib/api'
import { abreElModalSolo, pasosHechos } from './conexion'
import { esVisitanteDemo } from '@/lib/demo/modo'
import { SoloConTienda, VideoDeFuncion } from '@/modules/demo/SoloConTienda'

// Difusión: darle a conocer el negocio en redes. Hoy está la conexión con Instagram (la misma que
// se ve en Mensajes); publicar productos, responder comentarios y ver estadísticas se suman acá
// a medida que se construyan. Cada pantalla es una ?vista= (ver Sidebar.tsx).
//
// Sin conectar, la pantalla principal muestra el video de cómo funciona Difusión (el de la demo). El
// modal de Instagram se abre solo nada más que en el paso 3 (ya puede conectar, ver conexion.ts): en
// los pasos anteriores no hay nada que hacer en el momento y abrirlo molestaba en cada visita.

type Vista = 'instagram' | 'mensajes' | 'publicaciones' | 'sugeridas' | 'calendario' | 'comentarios' | 'estadisticas'
type Funcion = Exclude<Vista, 'instagram'>

// Lo que se puede hacer con Instagram conectado: la lista de la presentación (cada una abre su pantalla).
const FUNCIONES: Record<Funcion, { titulo: string; texto: string }> = {
  mensajes: { titulo: 'Mensajes', texto: 'Respondé los mensajes directos, con fotos, como en la app.' },
  publicaciones: { titulo: 'Publicaciones', texto: 'Subí un producto a tu Instagram sin salir de Órbita.' },
  sugeridas: { titulo: 'Sugeridas por Orbi', texto: 'Orbi arma tus próximas publicaciones; vos las revisás.' },
  calendario: { titulo: 'Calendario', texto: 'Lo publicado y lo programado de cada mes.' },
  comentarios: { titulo: 'Comentarios', texto: 'Respondé u ocultá los comentarios de tus publicaciones.' },
  estadisticas: { titulo: 'Estadísticas', texto: 'Cuánta gente vio lo que publicaste y qué funcionó mejor.' },
}

function esVista(v: unknown): v is Vista {
  return v === 'instagram' || v === 'mensajes' || v === 'publicaciones' || v === 'sugeridas' || v === 'calendario' || v === 'comentarios' || v === 'estadisticas'
}

export default function Difusion() {
  const router = useRouter()
  const vista: Vista = esVista(router.query.vista) ? router.query.vista : 'instagram'
  const { estado, visible, cargar } = useInstagramEstado()
  const [abierto, setAbierto] = useState(false)
  const [yaSeOfrecio, setYaSeOfrecio] = useState(false)
  const [resultadoIg, setResultadoIg] = useState<string | null>(null)

  // Al entrar a Difusión en el paso 3, el modal se abre solo. Si se cierra, no vuelve a abrirse hasta
  // volver a entrar al módulo o tocar el botón.
  // Demo pública: Difusión pide la cuenta de Instagram del negocio; se explica en vez de ofrecer conectar.
  const demo = esVisitanteDemo()
  useEffect(() => {
    if (demo) return
    if (visible && abreElModalSolo(estado) && !yaSeOfrecio) {
      setAbierto(true)
      setYaSeOfrecio(true)
    }
  }, [demo, visible, estado, yaSeOfrecio])

  // Al volver del login de Instagram la API manda ?ig=conectado | sin-suscripcion | error (se vuelve a
  // la pantalla desde la que se pidió la conexión): se abre el modal con el resultado, se refresca el
  // estado y se limpia la dirección para no repetirlo al recargar.
  const resultado = typeof router.query.ig === 'string' ? router.query.ig : null
  useEffect(() => {
    if (!resultado) return
    setYaSeOfrecio(true)
    cargar()
    // Si se volvió a Publicaciones, Comentarios o Estadísticas con los permisos ya concedidos, no hay nada que
    // mostrar en el modal: se sigue en la pantalla. Cualquier otro resultado (o desde el tablero) sí abre el modal.
    if (!(resultado === 'conectado' && vista !== 'instagram')) {
      setResultadoIg(resultado)
      setAbierto(true)
    }
    const { ig: _ig, ...resto } = router.query
    router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado])

  return (
    <div className="dif-pagina">
      <style>{CSS}</style>
      <h1 className="dif-titulo">Difusión</h1>
      <p className="dif-bajada">Mostrá tus productos en redes y respondé a quienes te escriben, desde un solo lugar.</p>

      {demo ? (
        <SoloConTienda funcion="difusion" />
      ) : !visible ? (
        <div className="dif-tarjeta dif-aviso">Instagram todavía no está disponible para tu negocio.</div>
      ) : (
        <>
          <EstadoInstagram estado={estado} onAbrir={() => setAbierto(true)} />
          {vista === 'instagram' && estado?.connected ? (
            <Tablero estado={estado} />
          ) : vista === 'instagram' ? (
            // Recién con el estado cargado: a quien ya conectó no le tiene que parpadear la presentación.
            estado && <Presentacion onAbrir={(f) => router.push({ query: { ...router.query, vista: f } })} />
          ) : vista === 'mensajes' ? (
            <Mensajes estado={estado} onAbrirConexion={() => setAbierto(true)} />
          ) : vista === 'publicaciones' ? (
            <Publicaciones estado={estado} onAbrirConexion={() => setAbierto(true)} />
          ) : vista === 'sugeridas' ? (
            <Sugeridas estado={estado} onAbrirConexion={() => setAbierto(true)} />
          ) : vista === 'calendario' ? (
            <Calendario estado={estado} onAbrirConexion={() => setAbierto(true)} />
          ) : vista === 'comentarios' ? (
            <Comentarios estado={estado} onAbrirConexion={() => setAbierto(true)} />
          ) : (
            <Estadisticas estado={estado} onAbrirConexion={() => setAbierto(true)} />
          )}
        </>
      )}

      {abierto && <InstagramModal estado={estado} resultado={resultadoIg} desde="difusion" onCerrar={() => setAbierto(false)} onCambio={cargar} />}
    </div>
  )
}

// ─── Estado de la conexión ─────────────────────────────────────────────────────

function EstadoInstagram({ estado, onAbrir }: { estado: InstagramEstado | null; onAbrir: () => void }) {
  const hechos = pasosHechos(estado)
  const conectado = estado?.connected === true
  const usuario = estado?.connected ? estado.username : estado?.habilitado === false ? estado.solicitud?.username : null

  const linea =
    estado === null ? 'Cargando…'
      : conectado ? `Conectado${usuario ? ` · @${usuario}` : ''}`
        : hechos === 1 ? `Pendiente de confirmación${usuario ? ` · @${usuario}` : ''}`
          : hechos === 2 ? 'Listo para conectar'
            : 'Sin conectar'
  const boton = conectado ? 'Administrar' : hechos === 1 ? 'Ver estado' : hechos === 2 ? 'Conectar' : 'Empezar'

  return (
    <section className="dif-tarjeta dif-estado" aria-label="Estado de Instagram">
      <Marca size={44} />
      <div className="dif-estado-texto">
        <p className="dif-estado-nombre">Instagram</p>
        <p className="dif-estado-linea">
          {conectado && <span className="dif-punto" aria-hidden />}
          {linea}
        </p>
        {!conectado && estado !== null && (
          <div className="dif-avance" role="img" aria-label={`Conexión: ${hechos} de 3 pasos`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`dif-tramo${i < hechos ? ' dif-tramo-hecho' : i === hechos ? ' dif-tramo-actual' : ''}`} />
            ))}
            <span className="dif-avance-texto">Paso {Math.min(hechos + 1, 3)} de 3</span>
          </div>
        )}
      </div>
      <Button size="md" variant={conectado ? 'secondary' : 'primary'} disabled={estado === null} onClick={onAbrir}>{boton}</Button>
    </section>
  )
}

// ─── Presentación (sin conectar) ───────────────────────────────────────────────

// Un solo bloque: a la izquierda el video de cómo funciona Difusión (el de la demo), a la derecha
// lo que se puede hacer, como lista corta. Cada fila abre su pantalla, que explica cómo conectar.
function Presentacion({ onAbrir }: { onAbrir: (f: Funcion) => void }) {
  return (
    <section className="dif-tarjeta dif-presentacion" aria-labelledby="dif-que-podes">
      <div className="dif-presentacion-video"><VideoDeFuncion funcion="difusion" /></div>
      <div className="dif-presentacion-lista">
        <h2 id="dif-que-podes" className="dif-presentacion-titulo">Qué vas a poder hacer</h2>
        <ul className="dif-funciones">
          {(Object.keys(FUNCIONES) as Funcion[]).map((f) => (
            <li key={f}>
              <button type="button" className="dif-funcion" onClick={() => onAbrir(f)}>
                <span className="dif-funcion-textos">
                  <span className="dif-funcion-titulo">{FUNCIONES[f].titulo}</span>
                  <span className="dif-funcion-texto">{FUNCIONES[f].texto}</span>
                </span>
                <ChevronRight size={16} strokeWidth={2} className="dif-funcion-flecha" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const CSS = `
.dif-pagina { padding: 32px 32px 64px; max-width: 980px; margin: 0 auto; }
.dif-titulo { margin: 0 0 6px; text-align: center; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
.dif-bajada { margin: 0 auto 26px; max-width: 560px; text-align: center; font-size: 13.5px; line-height: 1.5; color: var(--color-muted); }
.dif-tarjeta { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.dif-aviso { padding: 20px; font-size: 13px; color: var(--color-muted); }

.dif-estado { display: flex; align-items: center; gap: 16px; padding: 18px 20px; }
.dif-estado-texto { flex: 1; min-width: 0; }
.dif-estado-nombre { margin: 0; font-size: 15px; font-weight: 600; color: var(--color-text); }
.dif-estado-linea { display: flex; align-items: center; gap: 7px; margin: 2px 0 0; font-size: 13px; color: var(--color-muted); }
.dif-punto { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--color-success); box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.16); }
.dif-avance { display: flex; align-items: center; gap: 5px; margin-top: 10px; }
.dif-tramo { width: 34px; height: 5px; border-radius: 5px; background: var(--color-border); }
.dif-tramo-hecho { background: var(--color-success); }
.dif-tramo-actual { background: var(--color-primary); }
.dif-avance-texto { margin-left: 6px; font-size: 12px; color: var(--color-muted); }

.dif-presentacion { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 24px; align-items: center; margin-top: 16px; padding: 18px; }
.dif-presentacion-video .sct-video { margin-top: 0; box-shadow: none; border: 1px solid var(--color-border); }
.dif-presentacion-titulo { margin: 0 0 8px; padding: 0 10px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.dif-funciones { list-style: none; margin: 0; padding: 0; }
.dif-funciones li + li { border-top: 1px solid var(--color-border); }
.dif-funcion { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 9px 10px; border: 0; border-radius: 10px; background: none; font: inherit; text-align: left; cursor: pointer; transition: background-color 150ms; }
.dif-funcion:hover { background: var(--color-surface-alt); }
.dif-funcion:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.dif-funcion-textos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dif-funcion-titulo { font-size: 13.5px; font-weight: 600; color: var(--color-text); }
.dif-funcion-texto { font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
.dif-funcion-flecha { flex-shrink: 0; color: var(--color-muted); transition: color 150ms, transform 150ms; }
.dif-funcion:hover .dif-funcion-flecha { color: var(--color-primary); transform: translateX(2px); }

@media (max-width: 900px) {
  .dif-presentacion { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .dif-funcion, .dif-funcion-flecha { transition: none; }
}

@media (max-width: 640px) {
  .dif-presentacion { padding: 12px; }
  .dif-pagina { padding: 16px 14px 48px; }
  .dif-estado { flex-wrap: wrap; }
  .dif-estado-texto { flex-basis: calc(100% - 64px); }
  .dif-estado > button { width: 100%; height: 44px; }
}
`
