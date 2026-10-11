import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, CalendarClock, Check, Layers, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import {
  ApiError, getInstagramRendimiento, getInstagramSugeridas, guardarBorradorInstagram, programarPublicacionInstagram,
  type InstagramEstado, type InstagramRendimiento, type InstagramSugerida,
} from '@/lib/api'
import { Compuerta } from './Compuerta'
import { aInputLocal, cuando as formatoCuando, deInputLocal, nombreDelDia, ventanaHoraria } from './fechaLocal'
import { CLAVE_SUGERIDA } from './claves'

// Difusión → Sugeridas por Orbi: publicaciones ya armadas (producto, fotos, texto, hashtags y hora) a partir de lo
// que dicen los números: qué productos se venden y todavía no se mostraron, qué formato le funciona mejor a la
// cuenta y en qué momento reaccionan más sus seguidores. La persona las revisa y decide: programarlas tal cual,
// editarlas en el compositor o guardarlas como borrador. Orbi no publica nada solo.

interface Props {
  estado: InstagramEstado | null
  onAbrirConexion: () => void
}

export function Sugeridas({ estado, onAbrirConexion }: Props) {
  return (
    <Compuerta estado={estado} permiso="publicar" onAbrirConexion={onAbrirConexion}>
      {() => <Pantalla />}
    </Compuerta>
  )
}

const MARGEN_MIN = 6

type Resultado = { tipo: 'programada'; cuando: string } | { tipo: 'borrador' }

function Pantalla() {
  const router = useRouter()
  const [sugeridas, setSugeridas] = useState<InstagramSugerida[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [rendimiento, setRendimiento] = useState<InstagramRendimiento | null>(null)
  const [hechas, setHechas] = useState<Record<string, Resultado>>({})
  const [programando, setProgramando] = useState<InstagramSugerida | null>(null)
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  const cargar = useCallback(async (refrescar: boolean) => {
    setCargando(true); setError(null)
    try {
      const r = await getInstagramSugeridas(refrescar)
      if (montado.current) { setSugeridas(r); setHechas({}) }
    } catch (e) {
      if (montado.current) setError(e instanceof ApiError ? e.message : 'No se pudieron armar las sugerencias. Probá de nuevo en un momento.')
    } finally {
      if (montado.current) setCargando(false)
    }
  }, [])
  useEffect(() => { void cargar(false) }, [cargar])
  // Las métricas son un extra: sin el permiso de estadísticas, la pantalla funciona igual sin esta franja.
  useEffect(() => { getInstagramRendimiento().then((r) => { if (montado.current) setRendimiento(r) }).catch(() => undefined) }, [])

  const revisar = (s: InstagramSugerida) => {
    try {
      window.sessionStorage.setItem(CLAVE_SUGERIDA, JSON.stringify(s))
    } catch {
      /* sin almacenamiento: se abre el compositor y se arma a mano */
    }
    void router.push({ query: { ...router.query, vista: 'publicaciones', sugerida: '1' } })
  }

  const cuerpoDe = (s: InstagramSugerida) => ({
    productId: s.productId,
    caption: s.texto,
    formato: 'cuadrado' as const,
    items: s.fotos.map((url) => ({ origen: 'producto' as const, ref: url, tipo: 'image' as const })),
  })

  const [guardandoBorrador, setGuardandoBorrador] = useState<string | null>(null)
  const guardarBorrador = async (s: InstagramSugerida) => {
    setGuardandoBorrador(s.productId); setError(null)
    try {
      await guardarBorradorInstagram(cuerpoDe(s))
      if (montado.current) setHechas((h) => ({ ...h, [s.productId]: { tipo: 'borrador' } }))
    } catch (e) {
      if (montado.current) setError(e instanceof ApiError ? e.message : 'No se pudo guardar el borrador.')
    } finally {
      if (montado.current) setGuardandoBorrador(null)
    }
  }

  const verProgramadas = () => { void router.push({ query: { ...router.query, vista: 'publicaciones' } }) }

  return (
    <div className="sug-raiz-p">
      <style>{CSS}</style>

      <div className="sugp-cabecera">
        <p className="sugp-bajada">
          <Sparkles size={14} aria-hidden /> Orbi mira tus ventas, tu catálogo y cómo le fue a tus publicaciones, y arma las próximas por vos.
          Vos las revisás y decidís: nada se publica solo.
        </p>
        <Button variant="secondary" size="sm" onClick={() => cargar(true)} disabled={cargando} icon={<RefreshCw size={14} className={cargando ? 'sugp-girar' : undefined} />}>
          Otras ideas
        </Button>
      </div>

      {rendimiento && <QueMira rendimiento={rendimiento} />}

      {error && <p className="sugp-error" role="alert">{error}</p>}

      {cargando && sugeridas === null && (
        <div className="sugp-esqueleto" aria-busy="true" aria-label="Orbi está armando las publicaciones">
          {[0, 1, 2].map((i) => <span key={i} />)}
        </div>
      )}
      {cargando && sugeridas === null && <p className="sugp-suave sugp-centro">Orbi está armando tus publicaciones… puede tardar unos segundos.</p>}

      {sugeridas?.length === 0 && !error && (
        <section className="sugp-vacio">
          <Sparkles size={26} strokeWidth={1.5} aria-hidden />
          <p className="sugp-vacio-titulo">Todavía no hay nada para sugerir</p>
          <p className="sugp-suave">
            Orbi arma las publicaciones con productos publicados de tu tienda, con foto, que todavía no mostraste en Instagram desde Órbita.
            Si ya mostraste todo tu catálogo, buenísimo: cuando sumes productos nuevos, aparecen acá.
          </p>
        </section>
      )}

      {sugeridas && sugeridas.length > 0 && (
        <ul className={`sugp-lista${cargando ? ' sugp-cargando' : ''}`}>
          {sugeridas.map((s) => {
            const hecha = hechas[s.productId]
            return (
              <li key={s.productId} className="sugp-tarjeta">
                <div className="sugp-fotos" aria-hidden>
                  <span className={`sugp-foto-principal${s.tipo === 'carrusel' ? ' sugp-apilada' : ''}`}><img src={s.fotos[0]} alt="" /></span>
                  {s.tipo === 'carrusel' && <span className="sugp-etiqueta-carrusel"><Layers size={12} /> {s.fotos.length} fotos</span>}
                </div>
                {s.tipo === 'carrusel' && (
                  <div className="sugp-tira" aria-hidden>
                    {s.fotos.slice(1, 5).map((f) => <span key={f}><img src={f} alt="" /></span>)}
                  </div>
                )}

                <div className="sugp-cuerpo">
                  <p className="sugp-nombre">{s.nombre}</p>
                  <p className="sugp-tipo">{s.tipo === 'carrusel' ? `Carrusel de ${s.fotos.length} fotos` : 'Una foto'}</p>

                  <ul className="sugp-motivos">
                    {s.motivos.map((m) => <li key={m}>{m}</li>)}
                  </ul>

                  <div className="sugp-texto">
                    <p>{s.texto}</p>
                  </div>

                  <p className="sugp-cuando"><CalendarClock size={14} aria-hidden /> Conviene publicarla el <strong>{formatoCuando(s.cuando)}</strong></p>

                  {hecha ? (
                    <div className="sugp-hecha" role="status">
                      <Check size={15} strokeWidth={3} aria-hidden />
                      {hecha.tipo === 'programada' ? <>Programada para el {formatoCuando(hecha.cuando)}.</> : <>Guardada en tus borradores.</>}
                      <button type="button" className="sugp-enlace" onClick={verProgramadas}>Ver <ArrowRight size={12} aria-hidden /></button>
                    </div>
                  ) : (
                    <div className="sugp-acciones">
                      <Button size="md" onClick={() => setProgramando(s)} icon={<CalendarClock size={15} aria-hidden />}>Programar</Button>
                      <Button size="md" variant="secondary" onClick={() => revisar(s)}>Revisar y editar</Button>
                      <Button size="md" variant="ghost" loading={guardandoBorrador === s.productId} onClick={() => guardarBorrador(s)}>Guardar borrador</Button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {programando && (
        <ModalDeProgramacion
          sugerida={programando}
          cuerpo={cuerpoDe(programando)}
          onCerrar={() => setProgramando(null)}
          onProgramada={(cuando) => {
            setHechas((h) => ({ ...h, [programando.productId]: { tipo: 'programada', cuando } }))
            setProgramando(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Lo que Orbi miró ──────────────────────────────────────────────────────────

function QueMira({ rendimiento: r }: { rendimiento: InstagramRendimiento }) {
  const mejorTipo = r.tipos[0]
  const nombresDeTipo = { foto: 'Las fotos', carrusel: 'Los carruseles', reel: 'Los reels', video: 'Los videos' } as const
  return (
    <section className="sugp-mira" aria-label="Lo que Orbi miró de tu cuenta">
      <p className="sugp-mira-titulo">Lo que Orbi aprendió de tu cuenta</p>
      {!r.suficiente ? (
        <p className="sugp-suave" style={{ margin: 0 }}>
          Orbi analizó {r.muestra} {r.muestra === 1 ? 'publicación' : 'publicaciones'}: todavía son pocas para saber qué te funciona mejor.
          Mientras tanto arma las sugerencias con tus ventas y tu catálogo. Con 8 o más publicaciones, empieza a mirar formatos, días y horarios.
        </p>
      ) : (
        <div className="sugp-mira-datos">
          {mejorTipo && (
            <div>
              <p className="sugp-mira-etiqueta">Formato que mejor funciona</p>
              <p className="sugp-mira-valor">{nombresDeTipo[mejorTipo.tipo]}</p>
              <p className="sugp-mira-sub">{mejorTipo.promedio} interacciones en promedio</p>
            </div>
          )}
          {r.mejoresDias.length > 0 && (
            <div>
              <p className="sugp-mira-etiqueta">Mejores días</p>
              <p className="sugp-mira-valor">{r.mejoresDias.slice(0, 2).map((d) => nombreDelDia(d.clave)).join(' y ')}</p>
              <p className="sugp-mira-sub">cuando más reaccionan</p>
            </div>
          )}
          {r.mejoresHoras.length > 0 && (
            <div>
              <p className="sugp-mira-etiqueta">Mejor horario</p>
              <p className="sugp-mira-valor">{ventanaHoraria(r.mejoresHoras[0].clave)}</p>
              <p className="sugp-mira-sub">hora de Argentina</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Programar tal cual ────────────────────────────────────────────────────────

interface ModalProps {
  sugerida: InstagramSugerida
  cuerpo: { productId: string; caption: string; formato: 'cuadrado'; items: { origen: 'producto'; ref: string; tipo: 'image' }[] }
  onCerrar: () => void
  onProgramada: (cuando: string) => void
}

function ModalDeProgramacion({ sugerida, cuerpo, onCerrar, onProgramada }: ModalProps) {
  const sugerido = new Date(sugerida.cuando)
  const minimo = Date.now() + MARGEN_MIN * 60_000
  const [valor, setValor] = useState(aInputLocal(sugerido.getTime() > minimo ? sugerido : new Date(minimo + 60 * 60_000)))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fecha = deInputLocal(valor)
  const invalida = !fecha || fecha.getTime() < Date.now() + MARGEN_MIN * 60_000

  const confirmar = async () => {
    if (!fecha || invalida) return
    setGuardando(true); setError(null)
    try {
      await programarPublicacionInstagram({ ...cuerpo, programarPara: fecha.toISOString() })
      onProgramada(fecha.toISOString())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo programar. Probá de nuevo en un momento.')
      setGuardando(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => { if (!guardando) onCerrar() }}
      dismissable={!guardando}
      title="Programar publicación"
      maxWidth={440}
      footer={(
        <>
          <Button variant="secondary" disabled={guardando} onClick={onCerrar}>Cancelar</Button>
          <Button loading={guardando} disabled={invalida} onClick={confirmar}>Programar</Button>
        </>
      )}
    >
      <p className="sugp-suave" style={{ margin: '0 0 12px' }}>
        <strong>{sugerida.nombre}</strong>: {sugerida.tipo === 'carrusel' ? `carrusel de ${sugerida.fotos.length} fotos` : 'una foto'}, con el texto que armó Orbi. Sale sola a la hora que elijas.
      </p>
      <label className="sugp-modal-etiqueta" htmlFor="sugp-fecha">Día y hora</label>
      <input
        id="sugp-fecha"
        className="sugp-fecha"
        type="datetime-local"
        value={valor}
        min={aInputLocal(new Date(minimo))}
        onChange={(e) => setValor(e.target.value)}
      />
      {invalida && valor !== '' && <p className="sugp-error" role="alert" style={{ margin: '8px 0 0' }}>Elegí una hora que falte al menos {MARGEN_MIN} minutos.</p>}
      {error && <p className="sugp-error" role="alert" style={{ margin: '8px 0 0' }}>{error}</p>}
      <p className="sugp-suave" style={{ margin: '12px 0 0' }}>Si querés cambiar el texto o las fotos, usá "Revisar y editar".</p>
    </Modal>
  )
}

const CSS = `
.sug-raiz-p { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.sugp-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.sugp-bajada { display: flex; align-items: flex-start; gap: 8px; margin: 0; max-width: 62ch; font-size: 13.5px; line-height: 1.55; color: var(--color-muted); }
.sugp-bajada svg { flex-shrink: 0; margin-top: 3px; color: var(--color-text); }
.sugp-suave { margin: 0; font-size: 13px; line-height: 1.55; color: var(--color-muted); }
.sugp-centro { text-align: center; }
.sugp-error { margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--color-error); }
.sugp-girar { animation: sugp-giro 0.9s linear infinite; }
@keyframes sugp-giro { to { transform: rotate(360deg); } }

.sugp-mira { padding: 16px 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.sugp-mira-titulo { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: var(--color-text); }
.sugp-mira-datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; }
.sugp-mira-etiqueta { margin: 0 0 4px; font-size: 12px; color: var(--color-muted); }
.sugp-mira-valor { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); text-transform: capitalize; }
.sugp-mira-sub { margin: 2px 0 0; font-size: 12px; color: var(--color-muted); }

.sugp-esqueleto { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.sugp-esqueleto span { height: 420px; border-radius: 16px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.sugp-vacio { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 24px; text-align: center; color: var(--color-muted); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: 16px; }
.sugp-vacio .sugp-suave { max-width: 52ch; }
.sugp-vacio-titulo { margin: 4px 0 0; font-size: 15px; font-weight: 600; color: var(--color-text); }

.sugp-lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: start; transition: opacity 150ms; }
.sugp-cargando { opacity: 0.5; pointer-events: none; }
.sugp-tarjeta { display: flex; flex-direction: column; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-card); }
.sugp-fotos { position: relative; aspect-ratio: 4 / 3; background: var(--color-surface-alt); display: flex; align-items: center; justify-content: center; padding: 14px; }
.sugp-foto-principal { position: relative; width: 62%; max-height: 100%; aspect-ratio: 1; overflow: hidden; border-radius: 12px; background: #fff; border: 1px solid var(--color-border); box-shadow: 0 6px 18px -10px rgba(15,23,42,0.4); }
.sugp-foto-principal img { width: 100%; height: 100%; object-fit: contain; display: block; }
.sugp-apilada { box-shadow: 10px -8px 0 -2px var(--color-surface), 10px -8px 0 -1px var(--color-border), 20px -16px 0 -4px var(--color-surface), 20px -16px 0 -3px var(--color-border); }
.sugp-etiqueta-carrusel { position: absolute; right: 12px; top: 12px; display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(0,0,0,0.6); }
.sugp-tira { display: flex; gap: 6px; padding: 8px 14px 0; }
.sugp-tira span { width: 44px; height: 44px; overflow: hidden; border-radius: 8px; border: 1px solid var(--color-border); background: #fff; display: inline-flex; }
.sugp-tira img { width: 100%; height: 100%; object-fit: contain; }

.sugp-cuerpo { padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 10px; }
.sugp-nombre { margin: 0; font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text); }
.sugp-tipo { margin: -6px 0 0; font-size: 12.5px; color: var(--color-muted); }
.sugp-motivos { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
.sugp-texto { padding: 10px 12px; border-radius: 12px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.sugp-texto p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--color-text); white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.sugp-cuando { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; color: var(--color-muted); }
.sugp-cuando strong { color: var(--color-text); font-weight: 600; }
.sugp-acciones { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
.sugp-hecha { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 13px; font-weight: 500; color: var(--color-text); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
.sugp-hecha svg { color: var(--color-success); }
.sugp-enlace { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; border: none; background: transparent; padding: 0; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; color: var(--color-primary); }
.sugp-enlace:hover { text-decoration: underline; text-underline-offset: 3px; }

.sugp-modal-etiqueta { display: block; margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--color-text); }
.sugp-fecha { width: 100%; height: 42px; padding: 0 12px; box-sizing: border-box; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); font: inherit; font-size: 16px; color: var(--color-text); outline: none; }
.sugp-fecha:focus { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-bg); }

@media (max-width: 520px) { .sugp-lista, .sugp-esqueleto { grid-template-columns: minmax(0, 1fr); } .sugp-acciones button { flex: 1 1 100%; } }
@media (prefers-reduced-motion: reduce) { .sugp-girar { animation: none; } .sugp-lista { transition: none; } }
`
