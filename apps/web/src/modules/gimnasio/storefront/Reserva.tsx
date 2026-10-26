// Reservar un lugar en una clase: clase → cómo se paga (plan, pack, suelta o
// prueba) → datos → listo. Si la clase está llena, el lugar queda en lista de
// espera y pasa solo cuando alguien cancela. Se reserva sin registrarse: con
// nombre y celular alcanza; quien ya tiene plan entra con su celular.
//
// Las reglas de los planes: la clase de prueba vale una vez por persona (se
// reconoce por el celular o el email, aunque reserve como alguien nuevo); la
// membresía de X por semana no deja pasar la clase X+1 de esa semana (se
// puede pagar aparte como suelta); el pack se descuenta al reservar (lo hace
// el almacén de la demo, datos/negocio.ts, igual que desde el panel).
//
// Se puede entrar con la clase elegida desde la portada (?clase=&fecha=) o
// con un plan (?plan=). El pago es simulado. Al confirmar, la inscripción
// queda guardada en el navegador y aparece en "Mis clases" y en el panel.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarPlus, Check, ChevronLeft, Hourglass, Lock, Users } from 'lucide-react'
import { DIAS_CORTOS, diaSemana, esISO, fechaLarga, hhmm, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { descargarICS, generarICS } from '@/lib/reservas/ics'
import { AHORA, HOY, clasesDelDia, cupoDe, diaBloqueado, estadoPlanDe, idSocioDemo, planDe, rubroPorKey, topeSemanal, yaUsoLaPrueba, type ClaseSemanal, type Inscripcion, type NegocioGym, type Plan, type Socio } from '../datos'
import { Area } from '@/design-system/reservas/piezas'
import Sitio, { BarraCupo, ruta } from './Sitio'
import { textoPlan } from './Home'

interface P { negocio: NegocioGym; inscripciones: Inscripcion[]; socios: Socio[]; onInscribir: (i: Inscripcion, socio: Socio, plan: Plan | null) => void }

type PasoId = 'clase' | 'plan' | 'datos'
const NOMBRE: Record<PasoId, string> = { clase: 'Clase', plan: 'Cómo pagás', datos: 'Tus datos' }

/** Lo que muestra la confirmación: la inscripción y cómo quedó el plan. */
interface Hecha { inscripcion: Inscripcion; nombre: string; detalle: string | null; precio: number }

const q1 = (v: unknown) => (typeof v === 'string' ? v : '')

export default function Reserva({ negocio, inscripciones, socios, onInscribir, query }: P & { query: Record<string, unknown> }) {
  const r = rubroPorKey(negocio.rubro)
  const fechaQ = esISO(q1(query.fecha)) && q1(query.fecha) >= HOY ? q1(query.fecha) : HOY
  const [fecha, setFecha] = useState<ISO>(fechaQ)
  // La clase que viene por la URL tiene que existir y no haber empezado (la portada muestra la que está en curso, pero no se reserva).
  const [claseId, setClaseId] = useState<string | null>(() => {
    const c = negocio.clases.find(x => x.id === q1(query.clase))
    return c && (fechaQ !== HOY || c.inicio > AHORA) ? c.id : null
  })
  const planQ = q1(query.plan)
  const [modo, setModo] = useState<'socio' | 'nuevo'>('nuevo')
  const [planId, setPlanId] = useState<string | null>(planQ === 'prueba' ? negocio.planes.find(p => p.tipo === 'prueba')?.id ?? null : negocio.planes.some(p => p.id === planQ) ? planQ : null)
  // El socio que ya usó las clases de su semana puede pagar esta aparte, como suelta.
  const [aparte, setAparte] = useState(false)
  const [datos, setDatos] = useState({ nombre: '', telefono: '', email: '', notas: '' })
  const [intento, setIntento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [hecha, setHecha] = useState<Hecha | null>(null)

  const clase = negocio.clases.find(c => c.id === claseId) ?? null
  const cupo = clase ? cupoDe(clase, fecha, inscripciones) : null
  const socioDemo = socios.find(s => s.id === idSocioDemo(negocio.rubro)) ?? null
  const planSocio = socioDemo ? planDe(negocio, socioDemo.planId) : null
  const estadoSocio = socioDemo ? estadoPlanDe(socioDemo) : 'sin-plan'
  const planSocioVale = estadoSocio === 'vigente' || estadoSocio === 'por-vencer'
  // El tope de la membresía se cuenta en la semana de la clase elegida.
  const tope = socioDemo && clase ? topeSemanal(negocio, socioDemo, fecha, inscripciones) : null
  const planSuelta = negocio.planes.find(p => p.tipo === 'suelta' && p.activo) ?? null
  const pagaAparte = modo === 'socio' && aparte && !!planSuelta && !!tope?.lleno
  const plan = modo === 'socio' ? (pagaAparte ? planSuelta : planSocio) : planDe(negocio, planId)
  const precio = modo === 'socio' ? (pagaAparte ? planSuelta?.precio ?? 0 : 0) : plan?.precio ?? 0
  // La prueba gratis, una vez por persona: con ese celular o ese email ya se usó.
  const pruebaUsada = modo === 'nuevo' && plan?.tipo === 'prueba' && yaUsoLaPrueba(negocio, socios, inscripciones, { telefono: datos.telefono, email: datos.email })
  // Quien entra con su plan y ya tiene lugar (o está esperando) en esa clase no se anota dos veces.
  const yaAnotado = modo === 'socio' && !!socioDemo && !!clase && inscripciones.some(i => i.socioId === socioDemo.id && i.claseId === clase.id && i.fecha === fecha && i.estado !== 'cancelada')

  const pasos: PasoId[] = ['clase', 'plan', 'datos']
  const listo: Record<PasoId, boolean> = { clase: !!clase, plan: modo === 'socio' ? planSocioVale && !yaAnotado && (!tope?.lleno || pagaAparte) : !!plan, datos: !pruebaUsada }
  const [paso, setPaso] = useState(() => (clase ? 1 : 0))
  const actual = pasos[Math.min(paso, pasos.length - 1)]
  const ultimo = paso >= pasos.length - 1

  const titulo = useRef<HTMLHeadingElement>(null)
  const previo = useRef(actual)
  useEffect(() => {
    if (previo.current === actual) return
    previo.current = actual
    titulo.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [actual])

  const errores: Record<string, string> = {}
  if (modo === 'nuevo') {
    if (datos.nombre.trim().length < 3) errores.nombre = 'Escribí tu nombre y apellido.'
    if (datos.telefono.replace(/\D/g, '').length < 8) errores.telefono = 'Escribí un celular con código de área.'
    if (datos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.email.trim())) errores.email = 'Revisá el email.'
  }

  const ir = (p: number) => { if (!enviando) setPaso(Math.max(0, Math.min(p, pasos.length - 1))) }
  const siguiente = () => {
    if (enviando || !listo[actual]) return
    if (actual === 'datos' && Object.keys(errores).length) { setIntento(true); document.getElementById(`gir-${Object.keys(errores)[0]}`)?.focus(); return }
    if (!ultimo) { ir(paso + 1); return }
    confirmar()
  }

  /** Cómo queda el plan después de esta clase, para la confirmación. */
  const detalleDe = (espera: boolean): string | null => {
    if (!plan) return null
    if (pagaAparte) return `${plan.nombre}, aparte de tu plan`
    if (plan.tipo === 'prueba') return `${plan.nombre} · gratis, una vez por persona`
    if (plan.tipo === 'suelta') return plan.nombre
    if (plan.tipo === 'pack') {
      const quedan = modo === 'socio' ? socioDemo?.clasesRestantes ?? 0 : plan.clases ?? 0
      return `${plan.nombre} · te quedan ${espera ? quedan : Math.max(0, quedan - 1)} clases`
    }
    if (modo === 'socio' && tope) return `${plan.nombre} · ${espera ? tope.usadas : tope.usadas + 1} de ${tope.porSemana} clases esta semana`
    const vence = modo === 'socio' ? socioDemo?.vence : sumarDias(HOY, plan.vigenciaDias)
    return vence ? `${plan.nombre} · vence el ${fechaLarga(vence).toLowerCase()}` : plan.nombre
  }

  const confirmar = () => {
    if (!clase || !cupo) return
    setEnviando(true)
    window.setTimeout(() => {
      const id = `n${Date.now().toString(36)}`
      // La prueba y la suelta son de una sola clase: no le dejan un plan al socio (la inscripción guarda con qué se pagó).
      const planNuevo = plan && (plan.tipo === 'pack' || plan.tipo === 'membresia') ? plan : null
      const socio: Socio = modo === 'socio' && socioDemo ? socioDemo : {
        id: `sn${id}`, nombre: datos.nombre.trim(), telefono: datos.telefono.trim(), email: datos.email.trim() || undefined,
        planId: planNuevo?.id ?? null, desde: planNuevo ? HOY : null, vence: planNuevo ? sumarDias(HOY, planNuevo.vigenciaDias) : null,
        // El pack entra entero: la clase de hoy la descuenta el almacén al inscribir, como cualquier reserva con pack.
        clasesRestantes: planNuevo?.tipo === 'pack' ? planNuevo.clases ?? 0 : null, probo: false, nota: datos.notas.trim() || undefined, alta: HOY,
      }
      const espera = cupo.lleno
      const ins: Inscripcion = { id, claseId: clase.id, fecha, socioId: socio.id, estado: espera ? 'espera' : 'reservada', creada: HOY, planId: plan?.id ?? null }
      onInscribir(ins, socio, modo === 'nuevo' ? plan : null)
      setHecha({ inscripcion: ins, nombre: socio.nombre, detalle: detalleDe(espera), precio: espera ? 0 : precio })
      setEnviando(false)
    }, precio ? 1500 : 900)
  }

  if (hecha && clase) return <Confirmacion negocio={negocio} hecha={hecha} clase={clase} />

  const dias = Array.from({ length: negocio.anticipacionDias + 1 }, (_, i) => sumarDias(HOY, i)).filter(f => negocio.apertura.dias.includes(diaSemana(f)))
  const delDia = clasesDelDia(negocio, fecha).filter(c => fecha !== HOY || c.inicio > AHORA)
  const bloqueo = diaBloqueado(negocio, fecha)
  const cuando = clase ? `${fechaLarga(fecha)} · ${hhmm(clase.inicio)}` : null
  const que = clase ? negocio.actividades.find(a => a.id === clase.actividadId)?.nombre ?? '' : null
  const falta: Record<PasoId, string> = {
    clase: 'Elegí una clase para seguir',
    plan: modo === 'socio' ? (yaAnotado ? 'Ya estás anotado en esta clase' : planSocioVale && tope?.lleno ? `Ya usaste tus ${tope.porSemana} clases de esa semana` : 'Tu plan no está vigente: elegí cómo pagar') : 'Elegí cómo pagás para seguir',
    datos: pruebaUsada ? 'Con esos datos ya se usó la clase de prueba' : '',
  }
  const textoBoton = ultimo ? (cupo?.lleno ? 'Anotarme en la lista de espera' : precio ? `Pagar ${pesos(precio)} y reservar` : 'Confirmar reserva') : 'Continuar'

  return (
    // En el botón fijo del celular, el último paso con pago dice el monto: es lo que se va a cobrar.
    <Sitio negocio={negocio} pagina="reserva" cta={{ texto: enviando ? 'Reservando…' : ultimo ? (cupo?.lleno ? 'Anotarme' : precio ? `Pagar ${pesos(precio)}` : 'Confirmar') : 'Continuar', sub: [que, cuando].filter(Boolean).join(' · ') || falta[actual], onClick: siguiente, deshabilitado: !listo[actual] || enviando }}>
      <style>{CSS_RESERVA}</style>
      <div className="gis-cont gir">
        <ol className="gir-pasos" aria-label="Pasos de la reserva">
          {pasos.map((p, i) => <li key={p} aria-current={i === paso ? 'step' : undefined} data-hecho={i < paso}><button type="button" onClick={() => i < paso && ir(i)} disabled={i > paso}>{NOMBRE[p]}</button></li>)}
        </ol>
        <div className="gir-grilla">
          <div>
            {paso > 0 && <button type="button" className="rv-btn rv-btn--fantasma rv-btn--sm" style={{ marginLeft: -12, marginBottom: 6 }} onClick={() => ir(paso - 1)} disabled={enviando}><ChevronLeft size={16} aria-hidden /> Volver</button>}

            {actual === 'clase' && (
              <Bloque refTitulo={titulo} titulo="¿A qué clase venís?" sub={`Podés reservar hasta ${negocio.anticipacionDias} días adelante. Cada clase muestra cuántos lugares quedan.`}>
                <div className="gir-dias" role="radiogroup" aria-label="Día">
                  {dias.map(f => <button key={f} type="button" role="radio" aria-checked={f === fecha} className="gir-dia" onClick={() => { setFecha(f); setClaseId(null) }} aria-label={fechaLarga(f)}><small>{f === HOY ? 'Hoy' : DIAS_CORTOS[diaSemana(f)]}</small><b>{Number(f.slice(-2))}</b></button>)}
                </div>
                {bloqueo ? <p className="rv-nota" style={{ marginTop: 14 }}>{bloqueo.motivo}: ese día no hay clases.</p> : delDia.length === 0 ? <p className="rv-ayuda" style={{ marginTop: 14 }}>{fecha === HOY ? 'Por hoy ya no quedan clases.' : 'Ese día no hay clases.'}</p> : (
                  <div className="gir-clases" role="radiogroup" aria-label="Clases" style={{ marginTop: 14 }}>
                    {delDia.map(c => {
                      const k = cupoDe(c, fecha, inscripciones)
                      const sel = claseId === c.id
                      return (
                        <button key={c.id} type="button" role="radio" aria-checked={sel} className="gir-clase" onClick={() => setClaseId(c.id)}>
                          <span className="gis-clase-hora">{hhmm(c.inicio)}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ display: 'block', fontSize: 16, color: 'var(--color-text)' }}>{c.actividad?.nombre}</b>
                            <span className="gis-clase-sub"><Users size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {c.profe?.nombre} · {c.sala} · {c.actividad?.duracion} min</span>
                            <BarraCupo anotados={k.anotados} cupo={k.cupo} />
                          </span>
                          {sel && <Check size={18} aria-hidden style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Bloque>
            )}

            {actual === 'plan' && (
              <Bloque refTitulo={titulo} titulo="¿Cómo pagás?" sub={cupo?.lleno ? 'La clase está completa: te anotás en la lista de espera y, si se libera un lugar, es tuyo. No se cobra nada hasta entonces.' : 'Con tu plan si ya sos parte, o elegí cómo empezar.'}>
                <div className="rv-seg rv-seg--lleno" role="group" aria-label="Tengo plan o soy nuevo" style={{ marginBottom: 14 }}>
                  <button type="button" aria-pressed={modo === 'socio'} onClick={() => setModo('socio')}>Ya tengo plan</button>
                  <button type="button" aria-pressed={modo === 'nuevo'} onClick={() => setModo('nuevo')}>Soy nuevo</button>
                </div>
                {modo === 'socio' ? (
                  <div className="rv-card rv-card--pad">
                    <div className="rv-rotulo">Entrás con tu celular</div>
                    <p style={{ margin: '6px 0 0', fontSize: 14 }}>En la demo entrás como <b>{socioDemo?.nombre}</b> ({socioDemo?.telefono}).</p>
                    {planSocio && socioDemo ? (
                      <p style={{ margin: '10px 0 0', fontSize: 14 }}>Plan <b>{planSocio.nombre}</b>{socioDemo.vence ? ` · vence el ${fechaLarga(socioDemo.vence).toLowerCase()}` : ''}{socioDemo.clasesRestantes !== null ? ` · te quedan ${socioDemo.clasesRestantes} clases` : ''}{tope ? ` · esa semana usaste ${tope.usadas} de ${tope.porSemana}` : ''}.{estadoSocio === 'vencido' || estadoSocio === 'agotado' ? ' Está vencido: elegí cómo seguir abajo.' : ''}</p>
                    ) : <p className="rv-ayuda" style={{ marginTop: 8 }}>No tenés un plan vigente.</p>}
                    {(estadoSocio === 'vencido' || estadoSocio === 'agotado' || estadoSocio === 'sin-plan') && <button type="button" className="rv-btn" style={{ marginTop: 12 }} onClick={() => setModo('nuevo')}>Elegir un plan <ArrowRight size={15} aria-hidden /></button>}
                    {yaAnotado && (
                      <p className="rv-nota rv-nota--info" style={{ marginTop: 12 }} role="status"><span>Ya tenés esta clase en <Link href={ruta('mis-clases', negocio.rubro)} style={{ color: 'inherit', fontWeight: 600 }}>Mis clases</Link>. Elegí otra para sumar una más.</span></p>
                    )}
                    {!yaAnotado && planSocioVale && tope?.lleno && (
                      <div className="rv-nota rv-nota--aviso" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'stretch' }} role="status">
                        <span>Tu plan es de {tope.porSemana} {tope.porSemana === 1 ? 'clase' : 'clases'} por semana y esa semana ya las usaste. Elegí una clase de otra semana{planSuelta ? ', o pagá esta aparte como clase suelta.' : '.'}</span>
                        {planSuelta && (
                          <button type="button" className="rv-btn rv-btn--sm" aria-pressed={pagaAparte} style={{ alignSelf: 'flex-start' }} onClick={() => setAparte(!aparte)}>
                            {pagaAparte ? <><Check size={15} aria-hidden /> La pago aparte · {pesos(planSuelta.precio)}</> : `Pagarla aparte · ${pesos(planSuelta.precio)}`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="gir-planes" role="radiogroup" aria-label="Planes">
                    {negocio.planes.filter(p => p.activo).map(p => {
                      const sel = planId === p.id
                      return (
                        <button key={p.id} type="button" role="radio" aria-checked={sel} className="gir-plan" onClick={() => setPlanId(p.id)}>
                          <span className="rv-rotulo">{p.tipo === 'prueba' ? 'Primera vez' : p.tipo === 'suelta' ? 'Una clase' : p.tipo === 'pack' ? 'Pack' : 'Membresía'}</span>
                          <b>{p.nombre}</b>
                          <span className="gis-precio" style={{ fontSize: 18 }}>{p.precio ? pesos(p.precio) : 'Gratis'}</span>
                          <small>{textoPlan(p)}</small>
                          {sel && <Check size={16} aria-hidden className="gir-tilde" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Bloque>
            )}

            {actual === 'datos' && (
              <Bloque refTitulo={titulo} titulo={modo === 'socio' ? 'Confirmá' : 'Tus datos'} sub={modo === 'socio' ? 'Revisá y confirmá tu lugar.' : 'Sin registrarte: con tu nombre y tu celular alcanza. Con eso entrás después a Mis clases.'}>
                {modo === 'nuevo' && (
                  <form className="rv-pila" onSubmit={e => { e.preventDefault(); siguiente() }} noValidate>
                    <div className="rv-dos">
                      <CampoR id="nombre" label="Nombre y apellido" value={datos.nombre} onChange={v => setDatos({ ...datos, nombre: v })} error={intento ? errores.nombre : undefined} autoComplete="name" />
                      <CampoR id="telefono" label="Celular" value={datos.telefono} onChange={v => setDatos({ ...datos, telefono: v })} error={intento ? errores.telefono : undefined} inputMode="tel" autoComplete="tel" placeholder="Con código de área" />
                    </div>
                    <CampoR id="email" label="Email (opcional)" value={datos.email} onChange={v => setDatos({ ...datos, email: v })} error={intento ? errores.email : undefined} inputMode="email" autoComplete="email" />
                    <Area label="Algo que tengamos que saber (opcional)" value={datos.notas} onChange={v => setDatos({ ...datos, notas: v })} placeholder="Lesiones, primera vez, lo que quieras contarnos" maxLength={300} />
                    {pruebaUsada && (
                      <div className="rv-nota rv-nota--aviso" role="alert" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <span>Con ese celular o ese email ya se usó la clase de prueba: es una sola vez por persona. Elegí otro plan para reservar.</span>
                        <button type="button" className="rv-btn rv-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => ir(1)}>Elegir otro plan</button>
                      </div>
                    )}
                    <button type="submit" className="rv-sr">Confirmar</button>
                  </form>
                )}
                {precio > 0 && !cupo?.lleno && (
                  <div className="rv-card rv-card--pad" style={{ background: 'var(--color-surface)', marginTop: 14 }}>
                    <div className="rv-rotulo">Vista previa: no se cobra nada</div>
                    <p style={{ margin: '6px 0 0', fontSize: 14 }}>En el producto real, acá se abre Mercado Pago por {pesos(precio)}.</p>
                  </div>
                )}
              </Bloque>
            )}
          </div>

          <aside className="gir-lateral">
            <div className="rv-card rv-card--pad">
              <div className="rv-rotulo" style={{ marginBottom: 10 }}>Tu reserva</div>
              <dl className="gir-ticket">
                <div><dt>Clase</dt><dd>{que ?? <i>Falta elegir</i>}</dd></div>
                <div><dt>Cuándo</dt><dd>{cuando ?? <i>Falta elegir</i>}</dd></div>
                {clase && <div><dt>Lugar</dt><dd>{cupo?.lleno ? <span style={{ color: 'var(--color-warning)' }}><Hourglass size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> Lista de espera</span> : `${cupo?.libres} libres de ${cupo?.cupo}`}</dd></div>}
                <div><dt>Pagás con</dt><dd>{modo === 'socio' ? (pagaAparte && planSuelta ? `${planSuelta.nombre}, aparte` : planSocio ? `Tu plan · ${planSocio.nombre}` : <i>Sin plan</i>) : plan ? plan.nombre : <i>Falta elegir</i>}</dd></div>
              </dl>
              <div className="gir-total"><span>Total</span><b className="rv-num">{cupo?.lleno ? 'Nada por ahora' : modo === 'socio' && !pagaAparte ? 'Incluido' : plan ? (precio ? pesos(precio) : 'Gratis') : '—'}</b></div>
              <button type="button" className="rv-btn rv-btn--primario rv-btn--lg rv-btn--ancho" style={{ marginTop: 14 }} onClick={siguiente} disabled={!listo[actual] || enviando} aria-busy={enviando}>
                {enviando ? 'Reservando…' : textoBoton} {!enviando && (ultimo && precio && !cupo?.lleno ? <Lock size={16} aria-hidden /> : <ArrowRight size={16} aria-hidden />)}
              </button>
              <p className="rv-ayuda gir-falta" style={{ minHeight: 20, margin: '8px 0 0', textAlign: 'center' }}>{listo[actual] ? '' : falta[actual]}</p>
            </div>
            <p className="rv-ayuda" style={{ margin: '10px 0 0', textAlign: 'center' }}>Cancelás hasta {negocio.cancelaHastaHoras} h antes sin perder la clase. {r.socio === 'Atleta' ? 'Un cupo por atleta.' : ''}</p>
          </aside>
        </div>
      </div>
    </Sitio>
  )
}

function Bloque({ refTitulo, titulo, sub, children }: { refTitulo: React.RefObject<HTMLHeadingElement | null>; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rv-entra">
      <h1 ref={refTitulo} className="rv-h1" tabIndex={-1} style={{ fontSize: 24 }}>{titulo}</h1>
      {sub && <p className="rv-bajada" style={{ marginBottom: 18 }}>{sub}</p>}
      {children}
    </section>
  )
}

function CampoR(p: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; inputMode?: 'text' | 'tel' | 'email'; autoComplete?: string }) {
  const id = `gir-${p.id}`
  return (
    <label className="rv-campo" htmlFor={id}>
      <span>{p.label}</span>
      <input id={id} className="rv-input" value={p.value} onChange={e => p.onChange(e.target.value)} placeholder={p.placeholder} inputMode={p.inputMode} autoComplete={p.autoComplete} aria-invalid={p.error ? true : undefined} aria-describedby={p.error ? `${id}-e` : undefined} />
      {p.error && <span id={`${id}-e`} className="rv-error" role="alert">{p.error}</span>}
    </label>
  )
}

function Confirmacion({ negocio, hecha, clase }: { negocio: NegocioGym; hecha: Hecha; clase: ClaseSemanal }) {
  const { inscripcion: i, nombre, detalle, precio } = hecha
  const act = negocio.actividades.find(a => a.id === clase.actividadId)
  const espera = i.estado === 'espera'
  const codigo = i.id.slice(-6).toUpperCase()
  const calendario = () => descargarICS(generarICS([{ uid: `${i.id}@orbita`, titulo: `${act?.nombre ?? 'Clase'} · ${negocio.nombre}`, inicio: { fecha: i.fecha, minuto: clase.inicio }, fin: { fecha: i.fecha, minuto: clase.inicio + (act?.duracion ?? 60) }, lugar: `${negocio.direccion}, ${negocio.ciudad}` }], { nombre: negocio.nombre }), `clase-${codigo}`)
  return (
    <Sitio negocio={negocio} pagina="reserva">
      <style>{CSS_RESERVA}</style>
      <div className="gis-cont" style={{ maxWidth: 640, paddingTop: 32 }}>
        <div className="rv-card rv-card--pad rv-entra" style={{ textAlign: 'center', padding: 28 }}>
          <span className="gir-ok" data-espera={espera} aria-hidden>{espera ? <Hourglass size={24} /> : <Check size={26} strokeWidth={3} />}</span>
          <h1 className="rv-h1" style={{ marginTop: 14 }}>{espera ? 'Estás en la lista de espera' : 'Tu lugar está reservado'}</h1>
          <p className="rv-bajada" style={{ margin: '10px auto 0' }}>
            {espera ? 'Si alguien cancela, el lugar es tuyo y te avisamos por WhatsApp. No se cobra nada hasta entonces.' : `Te esperamos, ${nombre.split(' ')[0]}. Hacé check-in desde Mis clases ${negocio.checkInMin} minutos antes, o con el QR en la puerta.`}
          </p>
          <div className="gir-codigo"><span className="rv-rotulo">Código</span><b className="rv-num">{codigo}</b></div>
          <dl className="gir-ticket" style={{ textAlign: 'left', marginTop: 20 }}>
            <div><dt>Clase</dt><dd>{act?.nombre}</dd></div>
            <div><dt>Cuándo</dt><dd>{fechaLarga(i.fecha)} · {hhmm(clase.inicio)} a {hhmm(clase.inicio + (act?.duracion ?? 60))}</dd></div>
            <div><dt>Dónde</dt><dd>{clase.sala} · {negocio.direccion}</dd></div>
            {detalle && <div><dt>Plan</dt><dd>{detalle}</dd></div>}
            {precio > 0 && !espera && <div><dt>Pagado</dt><dd className="rv-num">{pesos(precio)}</dd></div>}
          </dl>
          <div className="rv-fila" style={{ justifyContent: 'center', marginTop: 20 }}>
            {!espera && <button type="button" className="rv-btn" onClick={calendario}><CalendarPlus size={16} aria-hidden /> Agregar al calendario</button>}
            <Link href={ruta('mis-clases', negocio.rubro)} className="rv-btn rv-btn--primario"><Users size={16} aria-hidden /> Ver mis clases</Link>
          </div>
        </div>
        <p className="rv-ayuda" style={{ textAlign: 'center', marginTop: 14 }}>Es una demo: no se cobró nada ni se mandó ningún mensaje.</p>
      </div>
    </Sitio>
  )
}

export const CSS_RESERVA = `
  .gir { padding-top: 20px; }
  .gir-pasos { display: flex; gap: 4px; margin: -4px -4px 16px; padding: 4px; list-style: none; overflow-x: auto; scrollbar-width: none; }
  .gir-pasos::-webkit-scrollbar { display: none; }
  .gir-pasos li { flex-shrink: 0; }
  .gir-pasos button { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--color-border); background: transparent; color: var(--color-muted); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
  .gir-pasos li[data-hecho='true'] button { color: var(--color-text); border-color: var(--color-primary); }
  .gir-pasos li[aria-current='step'] button { background: var(--color-primary); color: var(--color-on-primary); border-color: transparent; font-weight: 600; }
  .gir-pasos button:disabled { cursor: default; opacity: 0.6; }
  .gir-pasos button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gir-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 32px; align-items: start; }
  .gir-lateral { position: sticky; top: calc(var(--rv-tope, 0px) + 80px); }
  /* El padding (y el margen negativo que lo compensa) deja lugar al anillo de foco: el overflow lo recortaba. */
  .gir-dias { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 4px; margin: -4px; }
  .gir-dias::-webkit-scrollbar { display: none; }
  .gir-dia { flex: 0 0 auto; min-width: 60px; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); font: inherit; color: var(--color-body); cursor: pointer; }
  .gir-dia b { font-family: var(--rv-mono); font-size: 16px; color: var(--color-text); }
  .gir-dia small { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .gir-dia[aria-checked='true'] { background: var(--color-primary); border-color: transparent; color: var(--color-on-primary); }
  .gir-dia[aria-checked='true'] b { color: inherit; }
  .gir-dia:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gir-clases { display: flex; flex-direction: column; gap: 10px; }
  .gir-clase { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-bg); text-align: left; font: inherit; color: inherit; cursor: pointer; width: 100%; }
  .gir-clase[aria-checked='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  .gir-clase:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gir-clase .gis-clase-hora { width: 64px; flex-shrink: 0; }
  .gir-planes { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .gir-plan { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-bg); text-align: left; font: inherit; color: inherit; cursor: pointer; }
  .gir-plan b { font-size: 15px; color: var(--color-text); }
  .gir-plan small { font-size: 12.5px; color: var(--color-muted); line-height: 1.45; }
  .gir-plan[aria-checked='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: var(--color-primary-bg); }
  .gir-plan:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .gir-tilde { position: absolute; top: 12px; right: 12px; color: var(--color-primary); }
  .gir-ticket { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .gir-ticket > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13.5px; }
  .gir-ticket dt { color: var(--color-muted); flex-shrink: 0; }
  .gir-ticket dd { margin: 0; text-align: right; color: var(--color-text); font-weight: 500; min-width: 0; }
  .gir-ticket i { font-style: normal; color: var(--color-muted); font-weight: 400; }
  .gir-total { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border); font-size: 15px; font-weight: 700; color: var(--color-text); }
  .gir-ok { width: 56px; height: 56px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); }
  .gir-ok[data-espera='true'] { background: var(--color-warning-bg); color: var(--color-warning); }
  .gir-codigo { display: inline-flex; flex-direction: column; gap: 2px; margin-top: 18px; padding: 10px 18px; border-radius: 12px; background: var(--color-surface); }
  .gir-codigo b { font-size: 22px; letter-spacing: 0.12em; color: var(--color-text); }
  @media (max-width: 860px) {
    .gir-grilla { grid-template-columns: minmax(0, 1fr); gap: 20px; }
    .gir-lateral { position: static; }
  }
  /* En celular el botón del resumen sobra: el de reservar va fijo al pie (Sitio). Hasta
     768 y no hasta 860: entre 769 y 860 no hay botón fijo y este es el único. */
  @media (max-width: 768px) {
    .gir-lateral .rv-btn, .gir-lateral .gir-falta { display: none; }
    .gir-pasos button { min-height: 44px; padding: 0 14px; }
  }
`
