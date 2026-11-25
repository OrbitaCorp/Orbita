// Reservar un lugar en una clase, en el sitio de un negocio real: clase → tus
// datos → listo. Sin registrarse: con nombre y celular alcanza.
//
// Esta pantalla dibuja; lo que sigue a cada toque está en datos/origen/sitio.ts
// (continuarReserva y enviarReserva), sin React y con sus tests. Qué pasa
// contra la API:
// - Al elegir la clase y tocar "Continuar", el lugar queda tomado (retenido)
//   unos minutos, mientras la persona carga sus datos: no se lo llevan en el
//   medio. Nunca se toma solo al abrir la página: hace falta ese toque.
// - "Confirmar reserva" lo deja firme. Si el tiempo se venció, se dice y se
//   puede volver a tomar.
// - Un doble toque o un reintento después de un corte no toman dos lugares:
//   el pedido viaja con la misma clave mientras se pida lo mismo.
// - Con la clase completa, si el negocio tiene lista de espera, la persona se
//   anota ahí (sin tomar nada); si se libera un lugar, pasa sola.
//
// Cómo se paga no se elige acá: el lugar nace sin definir y el negocio lo dice
// desde su panel (con el plan, aparte o como clase de prueba).
//
// Se puede entrar con la clase elegida desde la portada (?clase=&fecha=).
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarPlus, Check, ChevronLeft, Clock, Hourglass, Users } from 'lucide-react'
import { DIAS_CORTOS, diaSemana, fechaLarga, hhmm, type ISO } from '@/lib/reservas/fechas'
import { descargarICS, generarICS } from '@/lib/reservas/ics'
import { claveDeIntento } from '@/lib/reservasApi/cliente'
import { Area } from '@/design-system/reservas/piezas'
import type { NegocioGym } from '../datos'
import {
  Intento, RESERVA_INICIAL, continuarReserva, enviarReserva, erroresDeContacto, estaGuardado,
  type ApiDelSitio, type CargaSitio, type DatosDeContacto, type DepsDeReserva, type EstadoDeReserva, type ReglasDelSitio, type ReservaTerminada,
} from '../datos/origen/sitio'
import { relojArgentina, useReloj } from '../datos/reloj'
import { Bloque, CampoR, CSS_RESERVA } from './Reserva'
import Sitio, { BarraCupo } from './Sitio'
import { useSitio } from './rutas'

interface P {
  carga: CargaSitio
  api: ApiDelSitio
  /** Lo que vino en la URL: ?clase= y ?fecha= entran como elección inicial. */
  query: Record<string, unknown>
  /** El instante de ahora (ms), del reloj del sitio: para saber si un lugar tomado sigue guardado. */
  ahoraMs: number
  /** Los lugares cambiaron (se reservó, una clase se completó): hay que volver a pedirlos. */
  onCambio: () => void
  /** Solo para los tests: en qué punto del flujo arranca la pantalla (por defecto, eligiendo la clase). */
  inicial?: EstadoDeReserva
}

const q1 = (v: unknown) => (typeof v === 'string' ? v : '')
const PASOS = ['Clase', 'Tus datos'] as const
/** La hora de Argentina de un instante: "10:52". */
const horaDe = (instante: string) => hhmm(relojArgentina(new Date(instante)).ahora)
const suave = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

export default function ReservaReal({ carga, api, query, ahoraMs, onCambio, inicial = RESERVA_INICIAL }: P) {
  // Nombre de cada grupo de radios y prefijo de los ids que los nombran y describen.
  const prefijo = useId()
  const { negocio, dias, reglas } = carga
  const { hoy } = useReloj()
  // La fecha y la clase de la URL valen si están entre lo que se puede reservar; si no, el primer día.
  const [fecha, setFecha] = useState<ISO>(() => (dias.some(d => d.fecha === q1(query.fecha)) ? q1(query.fecha) : dias[0]?.fecha ?? hoy))
  const [claseId, setClaseId] = useState<string | null>(() => {
    const c = dias.find(x => x.fecha === q1(query.fecha))?.clases.find(x => x.id === q1(query.clase))
    // Una clase completa solo queda elegida si hay lista de espera a la que anotarse.
    return c && (c.libres > 0 || reglas.listaDeEspera) ? c.id : null
  })
  // El paso, el lugar tomado, lo que se está mandando y cómo terminó: lo mueven continuarReserva y enviarReserva.
  const [estado, setEstado] = useState<EstadoDeReserva>(inicial)
  const { paso, camino, lugar, enviando, aviso, terminada } = estado
  const [datos, setDatos] = useState<DatosDeContacto>({ nombre: '', telefono: '', email: '', notas: '' })
  const [revisar, setRevisar] = useState(false)
  // La clave del intento vive lo que vive la pantalla: la misma mientras se pida la misma clase.
  const [intento] = useState(() => new Intento(claveDeIntento))
  // Un toque a la vez: el segundo, mientras el primero viaja, no hace nada.
  const ocupado = useRef(false)

  const dia = dias.find(d => d.fecha === fecha) ?? null
  const clase = dia?.clases.find(c => c.id === claseId) ?? null
  // El lugar tomado es de esta clase y todavía está guardado.
  const guardado = estaGuardado(lugar, clase, ahoraMs)
  // Completa para quien llega: el lugar propio, mientras está guardado, no cuenta en su contra.
  const llena = !!clase && clase.libres === 0 && !guardado
  // Sin la clase (la grilla se actualizó y ya no se puede reservar), se vuelve a elegir.
  const actual = clase ? paso : 0
  const enDatos = actual === 1
  const vencido = enDatos && camino === 'lugar' && !guardado

  const titulo = useRef<HTMLHeadingElement>(null)
  const previo = useRef(actual)
  useEffect(() => {
    if (previo.current === actual) return
    previo.current = actual
    titulo.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: suave() })
  }, [actual])

  // El día elegido queda entero a la vista en la tira (igual que en la demo: solo se mueve si está cortado).
  const tira = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = tira.current
    const el = t?.querySelector<HTMLElement>("[data-elegido='true']")
    if (!t || !el || t.scrollWidth <= t.clientWidth) return
    const rt = t.getBoundingClientRect()
    const re = el.getBoundingClientRect()
    const margen = 8
    if (re.left >= rt.left + margen && re.right <= rt.right - margen) return
    t.scrollTo({ left: t.scrollLeft + (re.left - rt.left) - (rt.width - re.width) / 2, behavior: suave() })
  }, [fecha])

  const errores = erroresDeContacto(datos)
  const deps: DepsDeReserva = { api, intento, listaDeEspera: reglas.listaDeEspera, onCambio }

  /** El botón de seguir: de "Clase" a "Tus datos" toma el lugar; en "Tus datos" confirma (o anota en la lista de espera). */
  const siguiente = async () => {
    if (ocupado.current || !clase) return
    // En "Tus datos" con el lugar vencido, el botón lo vuelve a tomar. Los datos se revisan antes de mandar nada.
    const confirma = enDatos && !vencido
    if (confirma && Object.keys(errores).length) { setRevisar(true); document.getElementById(`gir-${Object.keys(errores)[0]}`)?.focus(); return }
    ocupado.current = true
    try {
      if (confirma) await enviarReserva(estado, clase, datos, deps, setEstado)
      else await continuarReserva(estado, clase, deps, setEstado)
    } finally { ocupado.current = false }
  }
  const volver = () => { if (!enviando) setEstado(e => ({ ...e, aviso: null, paso: 0 })) }
  const sinAviso = () => setEstado(e => (e.aviso ? { ...e, aviso: null } : e))
  const elegirDia = (f: ISO) => { if (!enviando) { setFecha(f); setClaseId(null); sinAviso() } }

  if (terminada) return <Listo negocio={negocio} reglas={reglas} hecha={terminada} />

  const cuando = clase ? `${fechaLarga(fecha)} · ${hhmm(clase.inicio)}` : null
  const sinSalida = !!clase && llena && !reglas.listaDeEspera
  const puede = !!clase && !sinSalida && !enviando
  const falta = !clase ? 'Elegí una clase para seguir' : sinSalida ? 'Esa clase está completa: elegí otra' : ''
  const aLaEspera = enDatos ? camino === 'espera' : llena && reglas.listaDeEspera
  const texto = enviando
    ? (enDatos ? (camino === 'espera' ? 'Anotándote…' : 'Reservando…') : 'Guardando tu lugar…')
    : vencido ? 'Tomar el lugar de nuevo'
      : aLaEspera ? 'Anotarme en la lista de espera'
        : enDatos ? 'Confirmar reserva' : 'Continuar'
  const textoCorto = enviando ? 'Un momento…' : vencido ? 'Tomar de nuevo' : aLaEspera ? 'Anotarme' : enDatos ? 'Confirmar' : 'Continuar'

  return (
    <Sitio negocio={negocio} pagina="reserva" cta={{ texto: textoCorto, sub: [clase?.actividad, cuando].filter(Boolean).join(' · ') || falta, onClick: () => void siguiente(), deshabilitado: !puede }}>
      <style>{CSS_RESERVA}</style>
      <div className="gis-cont gir">
        <ol className="gir-pasos" aria-label="Pasos de la reserva">
          {PASOS.map((p, i) => <li key={p} aria-current={i === actual ? 'step' : undefined} data-hecho={i < actual}><button type="button" onClick={() => i < actual && volver()} disabled={i > actual}>{p}</button></li>)}
        </ol>
        <div className="gir-grilla">
          <div>
            {enDatos && <button type="button" className="rv-btn rv-btn--fantasma rv-btn--sm" style={{ marginLeft: -12, marginBottom: 6 }} onClick={volver} disabled={enviando}><ChevronLeft size={16} aria-hidden /> Volver</button>}
            {aviso && <p className="rv-nota rv-nota--aviso" role="alert" style={{ marginBottom: 14 }}>{aviso}</p>}

            {!enDatos && (
              <Bloque refTitulo={titulo} titulo="¿A qué clase venís?" sub={`Podés reservar hasta ${reglas.dias} ${reglas.dias === 1 ? 'día' : 'días'} adelante. Cada clase muestra cuántos lugares quedan.`}>
                {/* Los días y las clases son radios de verdad (rv-card--radio del kit): una parada de Tab por grupo y las flechas eligen. */}
                <div ref={tira} className="gir-dias" role="radiogroup" aria-label="Día">
                  {dias.map(d => (
                    <div key={d.fecha} className="gir-dia rv-card--radio" data-elegido={d.fecha === fecha}>
                      <input type="radio" name={`${prefijo}-dia`} value={d.fecha} checked={d.fecha === fecha} onChange={() => elegirDia(d.fecha)} aria-label={d.fecha === hoy ? `Hoy, ${fechaLarga(d.fecha).toLowerCase()}` : fechaLarga(d.fecha)} />
                      <small>{d.fecha === hoy ? 'Hoy' : DIAS_CORTOS[diaSemana(d.fecha)]}</small><b>{Number(d.fecha.slice(-2))}</b>
                    </div>
                  ))}
                </div>
                {!dia || dia.cerrado ? <p className="rv-nota" style={{ marginTop: 14 }}>{dia?.motivo ? `${dia.motivo}: ese día no hay clases.` : 'Ese día no hay clases.'}</p> : dia.clases.length === 0 ? <p className="rv-ayuda" style={{ marginTop: 14 }}>{fecha === hoy ? 'Por hoy ya no quedan clases para reservar.' : 'Ese día no hay clases para reservar.'}</p> : (
                  <div className="gir-clases" role="radiogroup" aria-label="Clases" style={{ marginTop: 14 }}>
                    {dia.clases.map(c => {
                      const sel = claseId === c.id
                      const op = `${prefijo}-clase-${c.id}`
                      const mia = estaGuardado(lugar, c, ahoraMs)
                      // Completa y sin lista de espera: no se puede elegir.
                      const sinLugar = c.libres === 0 && !mia && !reglas.listaDeEspera
                      return (
                        <div key={c.id} className="gir-clase rv-card--radio" data-elegido={sel}>
                          <input type="radio" name={`${prefijo}-clase`} value={c.id} checked={sel} disabled={sinLugar || enviando} onChange={() => { setClaseId(c.id); sinAviso() }} aria-labelledby={`${op}-h ${op}`} aria-describedby={`${op}-d ${op}-c`} />
                          <span id={`${op}-h`} className="gis-clase-hora">{hhmm(c.inicio)}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <b id={op} style={{ display: 'block', fontSize: 16, color: 'var(--color-text)' }}>{c.actividad}</b>
                            <span id={`${op}-d`} className="gis-clase-sub"><Users size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {[c.profe || 'Profe a confirmar', c.sala, `${c.fin - c.inicio} min`].filter(Boolean).join(' · ')}</span>
                            <BarraCupo id={`${op}-c`} anotados={c.cupo - c.libres} cupo={c.cupo} sinEspera={!reglas.listaDeEspera} />
                          </span>
                          {sel && <Check size={18} aria-hidden style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Bloque>
            )}

            {enDatos && clase && (
              <Bloque refTitulo={titulo} titulo="Tus datos" sub={camino === 'espera' ? 'La clase está completa: te anotás en la lista de espera y, si se libera un lugar, es tuyo.' : 'Sin registrarte: con tu nombre y tu celular alcanza.'}>
                {camino === 'lugar' && (
                  vencido
                    ? <p className="rv-nota rv-nota--aviso" role="status" style={{ marginBottom: 14 }}>Se venció el tiempo que tu lugar estuvo guardado. Tocá “Tomar el lugar de nuevo”: si sigue libre, es tuyo.</p>
                    : lugar && <p className="rv-nota rv-nota--info" role="status" style={{ marginBottom: 14 }}><Clock size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /><span>Tu lugar queda guardado hasta las <b>{horaDe(lugar.hasta)}</b>. Completá tus datos y confirmá antes de esa hora.</span></p>
                )}
                <form className="rv-pila" onSubmit={e => { e.preventDefault(); void siguiente() }} noValidate>
                  <div className="rv-dos">
                    <CampoR id="nombre" label="Nombre y apellido" value={datos.nombre} onChange={v => setDatos({ ...datos, nombre: v })} error={revisar ? errores.nombre : undefined} autoComplete="name" />
                    <CampoR id="telefono" label="Celular" value={datos.telefono} onChange={v => setDatos({ ...datos, telefono: v })} error={revisar ? errores.telefono : undefined} inputMode="tel" autoComplete="tel" placeholder="Con código de área" />
                  </div>
                  <CampoR id="email" label="Email (opcional)" value={datos.email} onChange={v => setDatos({ ...datos, email: v })} error={revisar ? errores.email : undefined} inputMode="email" autoComplete="email" placeholder="Para recibir la confirmación" />
                  {camino === 'lugar' && <Area label="Algo que tengamos que saber (opcional)" value={datos.notas} onChange={v => setDatos({ ...datos, notas: v })} placeholder="Lesiones, primera vez, lo que quieras contarnos" maxLength={500} />}
                  <button type="submit" className="rv-sr">{texto}</button>
                </form>
              </Bloque>
            )}
          </div>

          <aside className="gir-lateral">
            <div className="rv-card rv-card--pad">
              <div className="rv-rotulo" style={{ marginBottom: 10 }}>Tu reserva</div>
              <dl className="gir-ticket">
                <div><dt>Clase</dt><dd>{clase?.actividad ?? <i>Falta elegir</i>}</dd></div>
                <div><dt>Cuándo</dt><dd>{cuando ?? <i>Falta elegir</i>}</dd></div>
                {clase && (
                  <div><dt>Lugar</dt><dd>
                    {guardado && lugar ? `Guardado hasta las ${horaDe(lugar.hasta)}`
                      : llena ? (reglas.listaDeEspera ? <span style={{ color: 'var(--chip-warning-fg)' }}><Hourglass size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> Lista de espera</span> : 'Completa')
                        : `${clase.libres} ${clase.libres === 1 ? 'libre' : 'libres'} de ${clase.cupo}`}
                  </dd></div>
                )}
                <div><dt>Pago</dt><dd>En {negocio.nombre}</dd></div>
              </dl>
              <button type="button" className="rv-btn rv-btn--primario rv-btn--lg rv-btn--ancho" style={{ marginTop: 14 }} onClick={() => void siguiente()} disabled={!puede} aria-busy={enviando}>
                {texto} {!enviando && <ArrowRight size={16} aria-hidden />}
              </button>
              <p className="rv-ayuda gir-falta" style={{ minHeight: 20, margin: '8px 0 0', textAlign: 'center' }}>{falta}</p>
            </div>
            <p className="rv-ayuda" style={{ margin: '10px 0 0', textAlign: 'center' }}>
              {reglas.cancelaHastaHoras > 0 ? `Si no podés ir, avisá con al menos ${reglas.cancelaHastaHoras} h de anticipación.` : 'Si no podés ir, avisá para liberar tu lugar.'}
            </p>
          </aside>
        </div>
      </div>
    </Sitio>
  )
}

/** La pantalla del final: el lugar reservado (o el pedido a confirmar por el negocio) o el lugar en la lista de espera. */
function Listo({ negocio, reglas, hecha }: { negocio: NegocioGym; reglas: ReglasDelSitio; hecha: ReservaTerminada }) {
  const { ruta } = useSitio()
  const { clase: c } = hecha
  const espera = hecha.tipo === 'espera'
  const pendiente = hecha.tipo === 'reserva' && hecha.pendiente
  const pila = hecha.nombre.trim().split(/\s+/)[0]
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: suave() })
  }, [])
  const calendario = () => descargarICS(generarICS([{
    uid: `${hecha.tipo === 'reserva' ? hecha.codigo : c.id}-${c.fecha}@orbita`, titulo: `${c.actividad} · ${negocio.nombre}`,
    inicio: { fecha: c.fecha, minuto: c.inicio }, fin: { fecha: c.fecha, minuto: c.fin }, lugar: [c.sala, negocio.direccion].filter(Boolean).join(' · ') || negocio.nombre,
  }], { nombre: negocio.nombre }), `clase-${c.fecha}`)
  const cabecera = espera ? 'Estás en la lista de espera' : pendiente ? 'Recibimos tu pedido' : 'Tu lugar está reservado'
  const detalle = espera
    ? [
      hecha.yaEstaba ? 'Ya estabas en la lista de esta clase: seguís en tu lugar.' : null,
      hecha.posicion ? `Estás en el lugar ${hecha.posicion} de la lista.` : null,
      'Si alguien cancela, el lugar pasa a ser tuyo.',
      hecha.email ? `Te avisamos a ${hecha.email}.` : `Como no dejaste un email no te llega el aviso: preguntá en ${negocio.nombre}.`,
    ]
    : pendiente
      ? [`${negocio.nombre} tiene que confirmarlo.`, hecha.email ? `Te avisamos a ${hecha.email} cuando lo haga.` : `Preguntá en ${negocio.nombre} si quedó confirmado.`]
      : [
        `Te esperamos, ${pila}.`,
        hecha.email ? `Te mandamos el detalle a ${hecha.email}.` : null,
        reglas.cancelaHastaHoras > 0 ? `Si no podés ir, avisá con al menos ${reglas.cancelaHastaHoras} h de anticipación.` : 'Si no podés ir, avisá para liberar tu lugar.',
      ]
  return (
    <Sitio negocio={negocio} pagina="reserva">
      <style>{CSS_RESERVA}</style>
      <div className="gis-cont" style={{ maxWidth: 640, paddingTop: 32 }}>
        <div className="rv-card rv-card--pad rv-entra" style={{ textAlign: 'center', padding: 28 }}>
          <span className="gir-ok" data-espera={espera || pendiente} aria-hidden>{espera || pendiente ? <Hourglass size={24} /> : <Check size={26} strokeWidth={3} />}</span>
          <h1 ref={titulo} tabIndex={-1} className="rv-h1" style={{ marginTop: 14 }}>{cabecera}</h1>
          <p className="rv-bajada" style={{ margin: '10px auto 0' }}>{detalle.filter(Boolean).join(' ')}</p>
          {hecha.tipo === 'reserva' && <div className="gir-codigo"><span className="rv-rotulo">Código</span><b className="rv-num">{hecha.codigo}</b></div>}
          <dl className="gir-ticket" style={{ textAlign: 'left', marginTop: 20 }}>
            <div><dt>Clase</dt><dd>{c.actividad}</dd></div>
            <div><dt>Cuándo</dt><dd>{fechaLarga(c.fecha)} · {hhmm(c.inicio)} a {hhmm(c.fin)}</dd></div>
            {(c.sala || c.profe) && <div><dt>Dónde</dt><dd>{[c.sala, c.profe ? `con ${c.profe}` : ''].filter(Boolean).join(' · ')}</dd></div>}
            {!espera && <div><dt>Pago</dt><dd>En {negocio.nombre}: con tu plan o la clase suelta</dd></div>}
          </dl>
          <div className="rv-fila" style={{ justifyContent: 'center', marginTop: 20 }}>
            {!espera && <button type="button" className="rv-btn" onClick={calendario}><CalendarPlus size={16} aria-hidden /> Agregar al calendario</button>}
            <Link href={ruta('inicio', negocio.rubro)} className="rv-btn rv-btn--primario">Volver al inicio</Link>
          </div>
        </div>
      </div>
    </Sitio>
  )
}
