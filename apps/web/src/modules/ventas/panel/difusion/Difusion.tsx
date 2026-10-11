import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Comentarios } from './Comentarios'
import { Estadisticas } from './Estadisticas'
import { Mensajes } from './Mensajes'
import { Publicaciones } from './Publicaciones'
import { Tablero } from './Tablero'
import { InstagramModal, Marca } from '../mensajes/components/InstagramModal'
import { useInstagramEstado } from '../mensajes/components/InstagramConexion'
import type { InstagramEstado } from '@/lib/api'

// Difusión: darle a conocer el negocio en redes. Hoy está la conexión con Instagram (la misma que
// se ve en Mensajes); publicar productos, responder comentarios y ver estadísticas se suman acá
// a medida que se construyan. Cada pantalla es una ?vista= (ver Sidebar.tsx).
//
// Mientras la conexión no esté completa, el modal de Instagram se abre cada vez que se entra al
// módulo (en cualquier pantalla): es lo único que hay para hacer hasta que quede conectada.

type Vista = 'instagram' | 'mensajes' | 'publicaciones' | 'comentarios' | 'estadisticas'
type Funcion = Exclude<Vista, 'instagram'>

const FUNCIONES: Record<Funcion, { titulo: string; texto: string; ilustracion: ReactNode }> = {
  mensajes: {
    titulo: 'Mensajes',
    texto: 'Leé y respondé los mensajes directos de tu Instagram, con fotos, en una bandeja como la de la app.',
    ilustracion: <IlustracionMensajes />,
  },
  publicaciones: {
    titulo: 'Publicaciones',
    texto: 'Elegí un producto, mirá cómo queda la publicación y subila a tu Instagram sin salir de Órbita.',
    ilustracion: <IlustracionPublicacion />,
  },
  comentarios: {
    titulo: 'Comentarios',
    texto: 'Leé y respondé los comentarios de tus publicaciones, y ocultá los que no querés a la vista.',
    ilustracion: <IlustracionComentarios />,
  },
  estadisticas: {
    titulo: 'Estadísticas',
    texto: 'Mirá cuánta gente vio lo que publicaste y qué publicaciones funcionan mejor.',
    ilustracion: <IlustracionEstadisticas />,
  },
}

function esVista(v: unknown): v is Vista {
  return v === 'instagram' || v === 'mensajes' || v === 'publicaciones' || v === 'comentarios' || v === 'estadisticas'
}

// Cuántos de los 3 pasos de la conexión están hechos: 0 sin pedido, 1 pedido enviado (pendiente de
// confirmación), 2 habilitado para conectar, 3 conectado.
function pasosHechos(estado: InstagramEstado | null): number {
  if (!estado) return 0
  if (estado.connected) return 3
  if (estado.habilitado === false) return estado.solicitud ? 1 : 0
  return 2
}

export default function Difusion() {
  const router = useRouter()
  const vista: Vista = esVista(router.query.vista) ? router.query.vista : 'instagram'
  const { estado, visible, cargar } = useInstagramEstado()
  const [abierto, setAbierto] = useState(false)
  const [yaSeOfrecio, setYaSeOfrecio] = useState(false)
  const [resultadoIg, setResultadoIg] = useState<string | null>(null)

  // Cada vez que se entra a Difusión sin la conexión completa, el modal se abre solo. Si se cierra,
  // no vuelve a abrirse hasta volver a entrar al módulo o tocar el botón.
  useEffect(() => {
    if (visible && estado && !estado.connected && !yaSeOfrecio) {
      setAbierto(true)
      setYaSeOfrecio(true)
    }
  }, [visible, estado, yaSeOfrecio])

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

      {!visible ? (
        <div className="dif-tarjeta dif-aviso">Instagram todavía no está disponible para tu negocio.</div>
      ) : (
        <>
          <EstadoInstagram estado={estado} onAbrir={() => setAbierto(true)} />
          {vista === 'instagram' && estado?.connected ? (
            <Tablero estado={estado} />
          ) : vista === 'instagram' ? (
            <div className="dif-grilla">
              {(Object.keys(FUNCIONES) as Funcion[]).map((f) => (
                <TarjetaFuncion key={f} funcion={f} onAbrir={() => router.push({ query: { ...router.query, vista: f } })} />
              ))}
            </div>
          ) : vista === 'mensajes' ? (
            <Mensajes estado={estado} onAbrirConexion={() => setAbierto(true)} />
          ) : vista === 'publicaciones' ? (
            <Publicaciones estado={estado} onAbrirConexion={() => setAbierto(true)} />
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

// ─── Funciones que vienen ──────────────────────────────────────────────────────

// La tarjeta entera es un botón que abre la pantalla de la función.
function TarjetaFuncion({ funcion, onAbrir }: { funcion: Funcion; onAbrir: () => void }) {
  const { titulo, texto, ilustracion } = FUNCIONES[funcion]
  return (
    <button type="button" className="dif-tarjeta dif-funcion dif-funcion-activa" onClick={onAbrir}>
      <div className="dif-ilustracion" aria-hidden>{ilustracion}</div>
      <h2 className="dif-funcion-titulo">{titulo}</h2>
      <p className="dif-funcion-texto">{texto}</p>
      <p className="dif-abrir">Abrir <ArrowRight size={14} strokeWidth={2} aria-hidden /></p>
    </button>
  )
}

// Ilustraciones: maquetas en gris de lo que va a ser cada pantalla. Sin color a propósito: nada de
// ahí se puede tocar, y el azul del panel queda reservado para lo que sí.
function IlustracionPublicacion() {
  return (
    <div className="dif-mock dif-mock-post">
      <div className="dif-mock-fila"><span className="dif-avatar" /><span className="dif-linea" style={{ width: '38%' }} /></div>
      <div className="dif-imagen"><span className="dif-sol" /><span className="dif-monte" /></div>
      <span className="dif-linea" style={{ width: '70%' }} />
      <span className="dif-linea" style={{ width: '45%' }} />
    </div>
  )
}

// Bandeja de mensajes: lista de conversaciones a la izquierda y un chat con una foto a la derecha.
function IlustracionMensajes() {
  return (
    <div className="dif-mock dif-mock-mensajes">
      <div className="dif-mock-lista">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`dif-mock-fila${i === 0 ? ' dif-mock-fila-activa' : ''}`}><span className="dif-avatar" /><span className="dif-linea" style={{ width: '60%' }} /></div>
        ))}
      </div>
      <div className="dif-mock-chat">
        <span className="dif-burbuja" style={{ width: '70%' }}><span className="dif-linea" style={{ width: '80%' }} /><span className="dif-linea" style={{ width: '45%' }} /></span>
        <span className="dif-mock-foto"><span className="dif-sol" /><span className="dif-monte" /></span>
        <span className="dif-burbuja dif-burbuja-propia" style={{ width: '55%', alignSelf: 'flex-end' }}><span className="dif-linea" style={{ width: '75%' }} /></span>
      </div>
    </div>
  )
}

// Comentarios: una publicación arriba y, abajo, los comentarios con su respuesta sangrada.
function IlustracionComentarios() {
  return (
    <div className="dif-mock dif-mock-comentarios">
      <div className="dif-mock-fila dif-mock-publicacion"><span className="dif-mock-miniatura" /><span className="dif-mock-textos"><span className="dif-linea" style={{ width: '70%' }} /><span className="dif-linea" style={{ width: '40%' }} /></span></div>
      <div className="dif-mock-fila"><span className="dif-avatar" /><span className="dif-mock-textos"><span className="dif-linea" style={{ width: '85%' }} /><span className="dif-linea" style={{ width: '50%' }} /></span><span className="dif-corazon" /></div>
      <div className="dif-mock-fila dif-mock-respuesta"><span className="dif-avatar dif-avatar-chico" /><span className="dif-mock-textos"><span className="dif-linea" style={{ width: '75%' }} /></span></div>
      <div className="dif-mock-fila"><span className="dif-avatar" /><span className="dif-mock-textos"><span className="dif-linea" style={{ width: '65%' }} /></span><span className="dif-corazon" /></div>
    </div>
  )
}

function IlustracionEstadisticas() {
  const barras = [34, 52, 41, 70, 58, 88]
  return (
    <div className="dif-mock dif-mock-barras">
      {barras.map((h, i) => <span key={i} className={`dif-barra${i === barras.length - 1 ? ' dif-barra-top' : ''}`} style={{ height: `${h}%` }} />)}
    </div>
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

.dif-grilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.dif-funcion { display: flex; flex-direction: column; padding: 14px 14px 18px; }
.dif-ilustracion { position: relative; aspect-ratio: 16 / 10; margin-bottom: 16px; overflow: hidden; border-radius: 12px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.dif-funcion-titulo { margin: 0 6px 6px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.dif-funcion-texto { margin: 0 6px 14px; font-size: 13px; line-height: 1.55; color: var(--color-muted); flex: 1; }
.dif-funcion-activa { font: inherit; text-align: left; cursor: pointer; width: 100%; transition: border-color 150ms, box-shadow 150ms; }
.dif-funcion-activa:hover { border-color: var(--color-muted); box-shadow: 0 6px 20px -10px rgba(15, 23, 42, 0.25); }
.dif-funcion-activa:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.dif-abrir { display: inline-flex; align-items: center; gap: 6px; margin: 0 6px; font-size: 13px; font-weight: 600; color: var(--color-primary); }

.dif-mock { position: absolute; inset: 0; display: flex; padding: 14px 16px; box-sizing: border-box; }
.dif-mock-fila { display: flex; align-items: center; gap: 8px; }
.dif-mock-der { justify-content: flex-end; }
.dif-avatar { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; background: var(--color-border); }
.dif-linea { display: block; height: 6px; border-radius: 6px; background: var(--color-border); }

.dif-mock-post { flex-direction: column; justify-content: center; gap: 7px; }
.dif-mock-post .dif-linea { margin-left: 2px; }
.dif-imagen { position: relative; height: 54%; overflow: hidden; border-radius: 8px; background: linear-gradient(135deg, var(--color-border), var(--color-surface)); }
.dif-sol { position: absolute; top: 16%; right: 14%; width: 15px; height: 15px; border-radius: 50%; background: var(--color-surface); }
.dif-monte { position: absolute; left: -12%; bottom: -34%; width: 124%; height: 62%; border-radius: 50%; background: var(--color-muted); opacity: 0.24; }

.dif-mock-comentarios { flex-direction: column; justify-content: center; gap: 8px; }
.dif-mock-comentarios .dif-mock-fila { width: 100%; }
.dif-mock-publicacion { padding-bottom: 8px; border-bottom: 1px solid var(--color-border); }
.dif-mock-miniatura { width: 26px; height: 26px; flex-shrink: 0; border-radius: 6px; background: linear-gradient(135deg, var(--color-border), var(--color-surface)); }
.dif-mock-textos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.dif-mock-respuesta { padding-left: 30px; }
.dif-avatar-chico { width: 16px; height: 16px; }
.dif-corazon { width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; background: var(--color-border); }

.dif-mock-mensajes { gap: 12px; padding: 12px; }
.dif-mock-lista { width: 34%; flex-shrink: 0; display: flex; flex-direction: column; gap: 6px; padding-right: 10px; border-right: 1px solid var(--color-border); }
.dif-mock-lista .dif-mock-fila { padding: 5px; border-radius: 8px; }
.dif-mock-lista .dif-avatar { width: 18px; height: 18px; }
.dif-mock-fila-activa { background: var(--color-surface); border: 1px solid var(--color-border); }
.dif-mock-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 7px; }
.dif-mock-foto { position: relative; width: 46%; height: 34%; overflow: hidden; border-radius: 10px; background: linear-gradient(135deg, var(--color-border), var(--color-surface)); }
.dif-burbuja { display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; border-radius: 10px 10px 10px 3px; background: var(--color-surface); border: 1px solid var(--color-border); }
.dif-burbuja-propia { border-radius: 10px 10px 3px 10px; background: var(--color-border); border-color: transparent; }
.dif-burbuja-propia .dif-linea { background: var(--color-surface); }

.dif-mock-barras { align-items: flex-end; justify-content: space-between; gap: 10px; padding: 16px 20px 14px; }
.dif-mock-barras::after { content: ''; position: absolute; left: 20px; right: 20px; bottom: 14px; height: 1px; background: var(--color-border); }
.dif-barra { flex: 1; border-radius: 5px 5px 0 0; background: var(--color-border); }
.dif-barra-top { background: var(--color-muted); opacity: 0.55; }

@media (max-width: 640px) {
  .dif-grilla { grid-template-columns: minmax(0, 1fr); }
  .dif-pagina { padding: 16px 14px 48px; }
  .dif-estado { flex-wrap: wrap; }
  .dif-estado-texto { flex-basis: calc(100% - 64px); }
  .dif-estado > button { width: 100%; height: 44px; }
}
`
