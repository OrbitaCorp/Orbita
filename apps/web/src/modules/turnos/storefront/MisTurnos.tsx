// "Mis turnos": el cliente entra con su celular + un código por WhatsApp (sin
// contraseña: es un cliente de un negocio, no un usuario de Órbita) y ve su
// próximo turno, los siguientes y el historial. Desde acá reprograma, cancela
// o repite un turno anterior.
//
// El próximo turno es el protagonista: una cuenta regresiva en arco (cuánto
// falta), el QR para mostrar al llegar y las acciones a mano. El historial es
// una línea de tiempo. ?estado=vacio muestra al cliente que todavía no reservó.
// Todo en memoria, es una vista previa: comparte hoja y piezas con la reserva.
//
// Esta es también "la cuenta" del cliente. No hace falta para reservar: es
// opcional, y quien la tiene ve acá lo que le reconoce el negocio (la tarjeta
// de sellos y las promos que el dueño configuró en Reglas de reserva).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  ArrowRight, CalendarClock, CalendarPlus, Check, ChevronLeft, Clock, Coins, Gift, Home, Hourglass, LogOut, MapPin, MessageCircle,
  Navigation, RotateCcw, ShieldCheck, X,
} from 'lucide-react'
import { recursosDe, clasesDe, horaTxt, duracionTxt, pesos, type RubroTurnos } from '@/modules/turnos/datos'
import { beneficiosTxt, plazoTxt, useNegocioDemo, type FormaSitio } from '@/modules/turnos/demo/negocioDemo'
import type { Semana } from '@/modules/turnos/horario'
import { QR } from '@/modules/turnos/_shared/components/QR'
import { arco, largoArco, punto } from '@/modules/turnos/_shared/orbita/geometria'
import SitioNegocio, { ruta } from './SitioNegocio'
import { TarjetaSellos, useForma } from './piezas'
import { RETRATOS, type TemaNegocio } from './tema'
import { EstiloReserva } from './reserva/estilo'
import { CODIGO_DEMO, descargarICS, linkMapa, teclasRadio, urlTurno } from './reserva/acciones'
import { enDias, esHoy, fechaLarga, mesCorto, mismaFecha, nombreDiaCorto, proximosDias, type Fecha } from './reserva/calendario'
import { OrbitaVacia } from './reserva/Confirmacion'
import { SELLOS_DEMO } from './reserva/PasoDatos'
import { BotonCarga, Campo, FirmaOrbita, Fondo } from './reserva/piezas'

export default function MisTurnos({ rubro }: { rubro: RubroTurnos }) {
  const router = useRouter()
  // ?forma=simple: se llegó desde la página simple del negocio.
  const forma: FormaSitio = router.query.forma === 'simple' ? 'simple' : 'web'
  return (
    <SitioNegocio rubro={rubro} pagina="mis-turnos" forma={forma} ctaMovil={false}>
      {t => (
        <>
          <EstiloReserva />
          <Contenido rubro={rubro} t={t} />
        </>
      )}
    </SitioNegocio>
  )
}

function Contenido({ rubro, t }: { rubro: RubroTurnos; t: TemaNegocio }) {
  const [etapa, setEtapa] = useState<'tel' | 'codigo' | 'panel'>('tel')
  const [tel, setTel] = useState('')
  const beneficios = beneficiosTxt(useNegocioDemo().demo.cuentas, rubro)
  return (
    <div className="tur" data-oscuro={t.oscuro} data-mayus={!!t.mayus}>
      <Fondo t={t} />
      {etapa === 'panel' ? <Panel rubro={rubro} t={t} onSalir={() => { setTel(''); setEtapa('tel') }} /> : (
        <div className="tur-cont" style={{ paddingTop: 56, paddingBottom: 24 }}>
          {/* key: cada etapa entra de nuevo; volver al celular entra desde el otro lado */}
          <div key={etapa} className="tur-paso tur-ingreso" data-dir={etapa === 'tel' ? 'atras' : 'adelante'}>
            {etapa === 'tel'
              ? <Celular t={t} tel={tel} onTel={setTel} onListo={() => setEtapa('codigo')} beneficios={beneficios.map(b => b.titulo.toLowerCase())} />
              : <Codigo tel={tel} onListo={() => setEtapa('panel')} onVolver={() => setEtapa('tel')} />}
            <div style={{ marginTop: 34 }}><FirmaOrbita texto="Turnos con Órbita" /></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Ingreso ──────────────────────────────────────────────────────────────────

/** El dibujo de arriba del ingreso: un planeta con su órbita y el ícono adentro. */
function Emblema({ children }: { children: React.ReactNode }) {
  return (
    <div className="tur-ingreso-icono">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <circle cx="44" cy="44" r="43" fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="1.5 6" strokeLinecap="round" />
        <circle cx="44" cy="44" r="32" fill="var(--color-primary-bg)" stroke="var(--color-primary)" strokeOpacity="0.5" strokeWidth="1.2" />
        <g className="tur-orb-sat" style={{ transformOrigin: '44px 44px' }}><circle cx="44" cy="1" r="4" fill="var(--color-primary)" stroke="var(--color-bg)" strokeWidth="1.5" /></g>
      </svg>
      <span style={{ position: 'relative', display: 'grid' }}>{children}</span>
    </div>
  )
}

const digitos = (s: string) => s.replace(/\D/g, '').replace(/^0/, '')

function Celular({ t, tel, onTel, onListo, beneficios }: { t: TemaNegocio; tel: string; onTel: (v: string) => void; onListo: () => void; beneficios: string[] }) {
  const [intento, setIntento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const n = digitos(tel)
  const error = !n ? 'Escribí el celular con el que reservaste.' : n.length < 10 ? `Faltan dígitos: son 10 con el código de área (llevás ${n.length}).` : n.length > 10 ? 'Sobran dígitos: va sin el 0 del área y sin el 15.' : undefined

  // "Mandar" el código tarda un momento, como pasaría de verdad.
  useEffect(() => {
    if (!enviando) return
    const x = setTimeout(onListo, 900)
    return () => clearTimeout(x)
  }, [enviando, onListo])

  return (
    <form noValidate onSubmit={e => { e.preventDefault(); if (error) { setIntento(true); document.getElementById('tur-mt-tel')?.focus() } else setEnviando(true) }}>
      <Emblema><MessageCircle size={28} aria-hidden /></Emblema>
      <h1 className="tur-h" style={{ fontSize: 'clamp(32px, 4.4vw, 44px)', fontWeight: 700 }}>Tus turnos</h1>
      <p className="tur-bajada" style={{ margin: '12px auto 28px' }}>Ingresá el celular con el que reservaste en {t.nombre}. Te mandamos un código por WhatsApp: no hay contraseñas.</p>
      <div style={{ textAlign: 'left' }}>
        <Campo id="tur-mt-tel" label="Tu celular" valor={tel} onChange={onTel} error={intento ? error : undefined} ok={!error}
          tipo="tel" inputMode="tel" autoComplete="tel-national" prefijo="+54" placeholder="11 5555 5555" maxLength={20} ayuda="Código de área sin el 0 y número sin el 15." />
      </div>
      <BotonCarga type="submit" cargando={enviando} textoCargando="Enviando el código…" className="tur-btn--ancho">
        Enviarme el código <ArrowRight size={18} className="tur-flecha" aria-hidden />
      </BotonCarga>
      <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13.5, color: 'var(--color-muted)', margin: '18px 0 0' }}>
        <ShieldCheck size={15} aria-hidden /> Solo ves los turnos de este celular.
      </p>
      {beneficios.length > 0 && (
        <p className="tur-aviso" style={{ margin: '18px 0 0', textAlign: 'left', fontSize: 14, lineHeight: 1.55, color: 'var(--color-body)' }}>
          <Gift size={19} aria-hidden style={{ flexShrink: 0, color: 'var(--color-text)' }} />
          <span><b style={{ color: 'var(--color-text)' }}>¿Primera vez?</b> Con el mismo código queda creada tu cuenta, y con ella sumás {beneficios.join(', ')}. Para reservar no hace falta.</span>
        </p>
      )}
    </form>
  )
}

const CAJITAS = [0, 1, 2, 3, 4, 5]

function Codigo({ tel, onListo, onVolver }: { tel: string; onListo: () => void; onVolver: () => void }) {
  const [d, setD] = useState<string[]>(['', '', '', '', '', ''])
  const [verificando, setVerificando] = useState(false)
  const [seg, setSeg] = useState(30)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => { if (seg <= 0) return; const x = setTimeout(() => setSeg(s => s - 1), 1000); return () => clearTimeout(x) }, [seg])
  useEffect(() => {
    if (!verificando) return
    const x = setTimeout(onListo, 1000)
    return () => clearTimeout(x)
  }, [verificando, onListo])

  // Escribe `texto` a partir de la cajita `desde`: sirve para un dígito, para pegar el código
  // entero y para el autocompletado del celular, que manda los seis juntos a la primera.
  const poner = (desde: number, texto: string) => {
    const n = texto.replace(/\D/g, '')
    const nuevo = [...d]
    if (!n) nuevo[desde] = ''
    else n.slice(0, 6 - desde).split('').forEach((c, k) => { nuevo[desde + k] = c })
    setD(nuevo)
    if (n) refs.current[Math.min(desde + n.length, 5)]?.focus()
    if (nuevo.every(Boolean)) setVerificando(true)
  }
  const cambiar = (i: number, valor: string) => {
    // Si la cajita ya tenía un número y se tipea otro, vale el nuevo.
    const limpio = valor.replace(/\D/g, '')
    poner(i, d[i] && limpio.length === 2 ? limpio.replace(d[i], '') || d[i] : limpio)
  }
  const teclas = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !d[i] && i > 0) { e.preventDefault(); setD(p => p.map((x, k) => (k === i - 1 ? '' : x))); refs.current[i - 1]?.focus() }
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus() }
    if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); refs.current[i + 1]?.focus() }
  }
  const final = tel.replace(/\D/g, '').slice(-4)

  return (
    <>
      <Emblema>{verificando ? <Check size={30} strokeWidth={2.6} aria-hidden /> : <ShieldCheck size={28} aria-hidden />}</Emblema>
      <h1 className="tur-h" style={{ fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 700 }}>Ingresá el código</h1>
      <p className="tur-bajada" style={{ margin: '12px auto 28px' }}>Te mandamos 6 números por WhatsApp al celular terminado en <b className="tur-num" style={{ color: 'var(--color-text)' }}>{final}</b>.</p>
      <div className="tur-codigo" role="group" aria-label="Código de 6 números">
        {CAJITAS.map(i => (
          <input key={i} ref={el => { refs.current[i] = el }} value={d[i]} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Número ${i + 1} de 6`} data-lleno={!!d[i]} disabled={verificando}
            onChange={e => cambiar(i, e.target.value)} onKeyDown={e => teclas(i, e)} onFocus={e => e.target.select()}
            onPaste={e => { e.preventDefault(); poner(i, e.clipboardData.getData('text')) }} />
        ))}
      </div>
      {/* Alto fijo: pasar de la cuenta regresiva a "Verificando" no mueve nada */}
      <div aria-live="polite" style={{ minHeight: 44, marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14.5, color: 'var(--color-body)' }}>
        {verificando
          ? <><span className="tur-gira" style={{ display: 'inline-grid' }}><Hourglass size={16} aria-hidden /></span> Verificando el código…</>
          : seg > 0
            ? <span>Podés pedir otro en <span className="tur-num">0:{String(seg).padStart(2, '0')}</span></span>
            : <button type="button" className="tur-enlace" onClick={() => setSeg(30)}>Reenviar el código</button>}
      </div>
      <button type="button" className="tur-enlace" onClick={onVolver} disabled={verificando}><ChevronLeft size={16} aria-hidden /> Cambiar el número</button>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '14px 0 0' }}>Vista previa: cualquier código de 6 números funciona.</p>
    </>
  )
}

// ─── Panel del cliente ───────────────────────────────────────────────────────

interface TurnoCliente { id: string; servicio: number; recurso: number; fecha: Fecha; hora: number; estado: 'confirmado' | 'cancelado' | 'espera'; sena?: boolean; lugar?: number; cambiado?: boolean }
type Pendiente = { tipo: 'cancelar'; id: string } | { tipo: 'reprogramar'; id: string; fecha: Fecha; hora: number }

const faltan = (f: Fecha) => { const n = enDias(f); return n <= 0 ? 'Es hoy' : n === 1 ? 'Es mañana' : `Faltan ${n} días` }

function Panel({ rubro, t, onSalir }: { rubro: RubroTurnos; t: TemaNegocio; onSalir: () => void }) {
  const router = useRouter()
  const sinNada = router.query.estado === 'vacio'
  const recursos = useMemo(() => recursosDe(rubro), [rubro])
  const clases = useMemo(() => clasesDe(rubro), [rubro])
  const cupo = rubro.modo === 'cupo'
  const persona = rubro.modo === 'profesional'
  const forma = useForma()
  const { cuentas, politica } = useNegocioDemo().demo
  // La bienvenida es para el primer turno con cuenta: a quien ya vino, no se le vuelve a ofrecer.
  const beneficios = beneficiosTxt(cuentas, rubro).filter(b => b.id !== 'bienvenida' || sinNada)
  const sellos = sinNada ? 0 : Math.min(SELLOS_DEMO, cuentas.sellos)
  const conLocal = t.modalidades.includes('local')
  const donde = conLocal ? { Icon: MapPin, txt: t.direccion, largo: [t.direccion, t.barrio].filter(Boolean).join(', ') }
    : { Icon: Home, txt: 'A domicilio', largo: 'A domicilio' }
  const tarjeta = beneficios.length > 0 && (
    <section className="tur-entra" style={{ textAlign: 'left' }} aria-labelledby="tur-mt-benef">
      <h2 id="tur-mt-benef" className="tur-rotulo" style={{ margin: '0 0 12px' }}>Tus beneficios</h2>
      {cuentas.sellos > 0 && <TarjetaSellos total={cuentas.sellos} hechos={sellos} nombre={t.nombre} />}
      <ul className="tur-cuenta-lista" style={{ borderTop: 'none', paddingTop: 0 }}>
        {beneficios.map(b => <li key={b.id}><Check size={15} strokeWidth={2.6} aria-hidden /><span><b>{b.titulo}.</b> {b.id === 'sellos' && !sinNada ? `Llevás ${sellos} de ${cuentas.sellos}: te ${cuentas.sellos - sellos === 1 ? 'falta 1' : `faltan ${cuentas.sellos - sellos}`} para el premio.` : b.texto}</span></li>)}
      </ul>
    </section>
  )

  const [turnos, setTurnos] = useState<TurnoCliente[]>(() => sinNada ? [] : [
    { id: 'a', servicio: 1, recurso: 1, fecha: { mes: 9, dia: 29 }, hora: 16 * 60, estado: 'confirmado', sena: rubro.sena > 0 },
    { id: 'b', servicio: 0, recurso: 0, fecha: { mes: 10, dia: 13 }, hora: 11 * 60, estado: cupo ? 'espera' : 'confirmado', lugar: 2 },
  ])
  const [reprog, setReprog] = useState<TurnoCliente | null>(null)
  const [cancelar, setCancelar] = useState<TurnoCliente | null>(null)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => { if (!aviso) return; const x = setTimeout(() => setAviso(null), 3600); return () => clearTimeout(x) }, [aviso])
  // El "guardado" simulado de cancelar y reprogramar: el botón del modal queda trabado mientras tanto.
  useEffect(() => {
    if (!pendiente) return
    const x = setTimeout(() => {
      if (pendiente.tipo === 'cancelar') {
        setTurnos(ts => ts.map(y => (y.id === pendiente.id ? { ...y, estado: 'cancelado' } : y)))
        setCancelar(null)
        setAviso('Tu turno quedó cancelado.')
      } else {
        setTurnos(ts => ts.map(y => (y.id === pendiente.id ? { ...y, fecha: pendiente.fecha, hora: pendiente.hora, cambiado: true } : y)))
        setReprog(null)
        setAviso(`Listo: tu turno pasó al ${fechaLarga(pendiente.fecha).toLowerCase()} a las ${horaTxt(pendiente.hora)}.`)
      }
      setPendiente(null)
    }, 1000)
    return () => clearTimeout(x)
  }, [pendiente])

  const servicioDe = (i: number) => rubro.servicios[i % rubro.servicios.length]
  const nombreServ = (i: number) => (cupo ? clases[i * 3]?.nombre ?? servicioDe(i).nombre : servicioDe(i).nombre)
  const duracionDe = (x: TurnoCliente) => (cupo ? 60 : servicioDe(x.servicio).duracion)

  // El protagonista es el turno activo más cercano; los cancelados quedan en la lista, avisados.
  const orden = (a: TurnoCliente, b: TurnoCliente) => enDias(a.fecha) - enDias(b.fecha) || a.hora - b.hora
  const activos = turnos.filter(x => x.estado !== 'cancelado').sort(orden)
  const prox = activos[0]
  const resto = [...activos.slice(1), ...turnos.filter(x => x.estado === 'cancelado').sort(orden)]
  const HIST = sinNada ? [] : [
    { f: '12 sep', s: 0, r: 0 }, { f: '22 ago', s: 1, r: 1 }, { f: '1 ago', s: 0, r: 0 }, { f: '10 jul', s: 2 % rubro.servicios.length, r: 2 },
  ]

  return (
    <div className="tur-cont" style={{ paddingTop: 40, paddingBottom: 24 }}>
      <header className="tur-entra" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 30 }}>
        <div>
          <div className="tur-rotulo" style={{ marginBottom: 10 }}>{t.nombre}</div>
          <h1 className="tur-h" style={{ fontSize: 'clamp(34px, 4.6vw, 52px)', fontWeight: 700 }}>Hola, Sofía</h1>
        </div>
        <button type="button" className="tur-enlace" onClick={onSalir}><LogOut size={16} aria-hidden /> Salir</button>
      </header>

      {!prox && resto.length === 0 ? (
        <div className="tur-vacio tur-entra" style={{ paddingTop: 8 }}>
          <OrbitaVacia><CalendarPlus size={38} strokeWidth={1.5} aria-hidden /></OrbitaVacia>
          <h2 className="tur-h" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700, marginTop: 8 }}>Todavía no tenés turnos</h2>
          <p className="tur-bajada" style={{ margin: '12px auto 26px' }}>Cuando reserves en {t.nombre}, tu turno aparece acá con su QR, la cuenta regresiva y las opciones para cambiarlo.</p>
          <Link href={ruta('reserva', rubro.key, { forma })} className="tur-btn">Reservar {cupo ? 'una clase' : 'un turno'} <ArrowRight size={18} className="tur-flecha" aria-hidden /></Link>
          {tarjeta && <div style={{ marginTop: 36 }}>{tarjeta}</div>}
        </div>
      ) : (
        <div className="tur-mt">
          <div style={{ minWidth: 0 }}>
            <h2 className="tur-rotulo tur-entra" style={{ margin: '0 0 12px' }}>{cupo ? 'Tu próxima clase' : 'Tu próximo turno'}</h2>
            {prox ? (
              <article className="tur-prox tur-entra" style={{ ['--i' as string]: 1 }}>
                <div className="tur-prox-cuerpo">
                  <CuentaRegresiva key={`${prox.id}-${enDias(prox.fecha)}`} dias={enDias(prox.fecha)} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {prox.estado === 'espera'
                        ? <span className="tur-estado" style={{ color: 'var(--tur-aviso)' }}><Hourglass size={13} aria-hidden /> En lista de espera · puesto {prox.lugar}</span>
                        : <span className="tur-estado" style={{ color: 'var(--tur-ok)' }}><Check size={13} strokeWidth={3} aria-hidden /> Confirmado</span>}
                      {prox.cambiado && <span className="tur-estado" style={{ color: 'var(--color-body)' }}><CalendarClock size={13} aria-hidden /> Reprogramado</span>}
                    </div>
                    <div className="tur-h" style={{ fontSize: 'clamp(26px, 3.6vw, 34px)', fontWeight: 700 }}>{nombreServ(prox.servicio)}</div>
                    <div key={`${prox.fecha.dia}-${prox.hora}`} className="tur-llega" style={{ display: 'block', fontSize: 17, color: 'var(--color-body)', marginTop: 8 }}>
                      {fechaLarga(prox.fecha)} · <b className="tur-num" style={{ color: 'var(--color-text)' }}>{horaTxt(prox.hora)}</b>
                    </div>
                    <div className="tur-meta" style={{ marginTop: 20 }}>
                      {persona && (
                        <span>
                          <img src={RETRATOS[prox.recurso % RETRATOS.length]} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          <span><small>Con</small><b>{recursos[prox.recurso % recursos.length].nombre}</b></span>
                        </span>
                      )}
                      <span>
                        <donde.Icon size={20} aria-hidden style={{ flexShrink: 0 }} />
                        <span><small>Dónde</small><b>{donde.txt}</b></span>
                      </span>
                      <span>
                        <Clock size={20} aria-hidden style={{ flexShrink: 0 }} />
                        <span><small>Duración</small><b>{duracionTxt(duracionDe(prox))}</b></span>
                      </span>
                      {prox.sena && (
                        <span>
                          <Coins size={20} aria-hidden style={{ flexShrink: 0 }} />
                          <span><small>Seña</small><b>Pagada</b></span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="tur-troquel" aria-hidden><i /></div>
                <div className="tur-prox-pie">
                  <div className="tur-prox-acciones">
                    <button type="button" className="tur-btn tur-btn--chico" onClick={() => descargarICS({ titulo: `${nombreServ(prox.servicio)} · ${t.nombre}`, fecha: prox.fecha, inicio: prox.hora, duracion: duracionDe(prox), lugar: donde.largo })}>
                      <CalendarPlus size={16} aria-hidden /> Al calendario
                    </button>
                    {conLocal && <a className="tur-btn tur-btn--sec tur-btn--chico" href={linkMapa(t.direccion, t.barrio)} target="_blank" rel="noopener noreferrer"><Navigation size={16} aria-hidden /> Cómo llegar</a>}
                    <button type="button" className="tur-btn tur-btn--sec tur-btn--chico" onClick={() => setReprog(prox)}><CalendarClock size={16} aria-hidden /> Reprogramar</button>
                    <button type="button" className="tur-btn tur-btn--sec tur-btn--chico" style={{ color: 'var(--tur-error)' }} onClick={() => setCancelar(prox)}><X size={16} aria-hidden /> Cancelar</button>
                  </div>
                  {prox.estado === 'confirmado' && (
                    <div className="tur-prox-qr">
                      <div className="tur-qr"><QR texto={urlTurno(t.nombre)} size={104} titulo={`Código QR de la reserva ${CODIGO_DEMO}`} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="tur-rotulo">Reserva</div>
                        <div className="tur-num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text)', marginTop: 2 }}>{CODIGO_DEMO}</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--color-body)', marginTop: 5, maxWidth: 150 }}>{conLocal ? 'Mostrá el QR cuando llegues.' : 'Es el comprobante de tu reserva.'}</div>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ) : (
              <div className="tur-aviso tur-entra" style={{ flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 220px', fontSize: 15, color: 'var(--color-body)' }}>No te queda ningún turno activo.</span>
                <Link href={ruta('reserva', rubro.key, { forma })} className="tur-btn tur-btn--chico">Reservar otro <ArrowRight size={16} className="tur-flecha" aria-hidden /></Link>
              </div>
            )}

            {resto.length > 0 && (
              <>
                <h2 className="tur-rotulo" style={{ margin: '36px 0 12px' }}>Después</h2>
                <div style={{ display: 'grid', gap: 10 }}>
                  {resto.map((x, i) => (
                    <div key={x.id} className="tur-item tur-entra" style={{ ['--i' as string]: i + 2 }}>
                      <div style={{ textAlign: 'center', width: 54, flexShrink: 0 }}>
                        <div className="tur-rotulo">{nombreDiaCorto(x.fecha)}</div>
                        <div className="tur-h" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.05, textDecoration: x.estado === 'cancelado' ? 'line-through' : undefined }}>{x.fecha.dia}</div>
                        <div className="tur-rotulo" style={{ fontSize: 10.5 }}>{mesCorto(x.fecha)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--color-text)' }}>{nombreServ(x.servicio)}</div>
                        <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 2 }}>
                          <span className="tur-num">{horaTxt(x.hora)}</span>{persona ? ` · con ${recursos[x.recurso % recursos.length].nombre.split(' ')[0]}` : ''}{x.estado === 'confirmado' ? ` · ${faltan(x.fecha).toLowerCase()}` : ''}
                        </div>
                      </div>
                      {x.estado === 'espera' ? (
                        <span className="tur-estado" style={{ color: 'var(--tur-aviso)' }}><Hourglass size={13} aria-hidden /> Espera · puesto {x.lugar}</span>
                      ) : x.estado === 'cancelado' ? (
                        <span className="tur-estado" style={{ color: 'var(--tur-error)' }}><X size={13} aria-hidden /> Cancelado</span>
                      ) : (
                        <button type="button" onClick={() => setReprog(x)} className="tur-btn tur-btn--sec tur-btn--chico">Cambiar</button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <aside style={{ minWidth: 0 }}>
            {tarjeta && <div style={{ marginBottom: 30 }}>{tarjeta}</div>}
            <h2 className="tur-rotulo" style={{ margin: '0 0 12px' }}>Historial</h2>
            <ol className="tur-linea">
              {HIST.map((h, i) => (
                <li key={h.f} className="tur-entra" style={{ ['--i' as string]: i + 2 }}>
                  <div className="tur-hist">
                    {persona
                      ? <img src={RETRATOS[h.r % RETRATOS.length]} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-text)', flexShrink: 0 }}><rubro.Icon size={18} /></span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tur-rotulo">{h.f}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{nombreServ(h.s)}</div>
                      {!cupo && <div className="tur-num" style={{ fontSize: 13.5, color: 'var(--color-muted)' }}>{servicioDe(h.s).precio ? pesos(servicioDe(h.s).precio) : 'Sin cargo'}</div>}
                    </div>
                    <Link href={ruta('reserva', rubro.key, { forma, ...(cupo ? {} : { servicio: h.s % rubro.servicios.length, ...(persona ? { con: recursos[h.r % recursos.length].id } : {}) }) })}
                      className="tur-enlace" aria-label={`Repetir ${nombreServ(h.s)}`}><RotateCcw size={15} aria-hidden /> Repetir</Link>
                  </div>
                </li>
              ))}
            </ol>
            <div style={{ marginTop: 14, padding: 18, borderRadius: 'var(--tur-r)', background: 'var(--color-primary-bg)', fontSize: 14.5, color: 'var(--color-text)', lineHeight: 1.55 }}>
              <b className="tur-num">{HIST.length + turnos.length}</b> <b>visitas</b> en {t.nombre}, contando las que vienen.
            </div>
            <div style={{ marginTop: 22, textAlign: 'center' }}><FirmaOrbita texto="Turnos con Órbita" /></div>
          </aside>
        </div>
      )}

      {reprog && (
        <Reprogramar horarios={t.horarios} duracion={duracionDe(reprog)} actual={reprog} guardando={pendiente?.tipo === 'reprogramar'} onCerrar={() => !pendiente && setReprog(null)}
          onListo={(fecha, hora) => setPendiente({ tipo: 'reprogramar', id: reprog.id, fecha, hora })} />
      )}
      {cancelar && (
        <Modal titulo={cupo ? '¿Cancelar la clase?' : '¿Cancelar el turno?'} onCerrar={() => !pendiente && setCancelar(null)}>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--color-text)', margin: '0 0 8px', fontWeight: 600 }}>{nombreServ(cancelar.servicio)} · {fechaLarga(cancelar.fecha).toLowerCase()} a las <span className="tur-num">{horaTxt(cancelar.hora)}</span></p>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-body)', margin: '0 0 24px' }}>
            {enDias(cancelar.fecha) * 24 > politica.cancelaHasta
              ? `Estás a tiempo (se puede ${plazoTxt(politica.cancelaHasta)}): se cancela sin cargo${cancelar.sena ? ' y la seña se devuelve al mismo medio de pago' : ''}.`
              : `Ya pasó el plazo para cancelar sin cargo (era ${plazoTxt(politica.cancelaHasta)})${cancelar.sena ? `: ${politica.senaFueraDePlazo === 'se-pierde' ? 'la seña no se devuelve' : 'la seña te queda a favor para otro turno'}` : ''}.`} El horario queda libre para otra persona.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <button type="button" onClick={() => setCancelar(null)} disabled={!!pendiente} className="tur-btn tur-btn--sec">No, mantenerlo</button>
            <BotonCarga cargando={pendiente?.tipo === 'cancelar'} textoCargando="Cancelando…" className="tur-btn--peligro" onClick={() => setPendiente({ tipo: 'cancelar', id: cancelar.id })}>
              Sí, cancelar
            </BotonCarga>
          </div>
        </Modal>
      )}
      {aviso && (
        <div role="status" className="tur-toast"><Check size={18} aria-hidden style={{ flexShrink: 0 }} /> {aviso}</div>
      )}
    </div>
  )
}

// ─── Cuenta regresiva ─────────────────────────────────────────────────────────
// Un arco de 270° que se va cerrando a medida que se acerca el turno, con el
// satélite en la punta. Tres semanas o más = arco casi vacío; hoy = completo.
const CR = { lado: 148, c: 74, r: 62, desde: 135, barrido: 270 }

function CuentaRegresiva({ dias }: { dias: number }) {
  const valor = Math.min(1, Math.max(0.05, 1 - dias / 21))
  const hasta = CR.desde + CR.barrido * valor
  const [sx, sy] = punto(CR.c, CR.c, CR.r, hasta)
  const texto = dias <= 0 ? 'Es hoy' : dias === 1 ? 'Es mañana' : `Faltan ${dias} días`
  return (
    <div role="img" aria-label={texto} style={{ position: 'relative', width: CR.lado, height: CR.lado, flexShrink: 0, display: 'grid', placeItems: 'center', justifySelf: 'center' }}>
      <svg width={CR.lado} height={CR.lado} viewBox={`0 0 ${CR.lado} ${CR.lado}`} aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <circle cx={CR.c} cy={CR.c} r={CR.r + 11} fill="none" stroke="var(--color-border)" strokeWidth={1} strokeDasharray="1.5 6" strokeLinecap="round" />
        <path d={arco(CR.c, CR.c, CR.r, CR.desde, CR.desde + CR.barrido)} fill="none" stroke="var(--color-surface-alt)" strokeWidth={9} strokeLinecap="round" />
        <path className="tur-cuenta-traza" d={arco(CR.c, CR.c, CR.r, CR.desde, hasta)} fill="none" stroke="var(--color-primary)" strokeWidth={9} strokeLinecap="round"
          style={{ ['--largo' as string]: largoArco(CR.r, hasta - CR.desde) + 9 }} />
        <circle className="tur-entra" style={{ ['--i' as string]: 14 }} cx={sx} cy={sy} r={7} fill="var(--color-bg)" stroke="var(--color-primary)" strokeWidth={3} />
      </svg>
      <div aria-hidden style={{ position: 'relative', textAlign: 'center', lineHeight: 1.1 }}>
        {dias <= 1 ? (
          <>
            <div className="tur-rotulo">Es</div>
            <div className="tur-h" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{dias <= 0 ? 'Hoy' : 'Mañana'}</div>
          </>
        ) : (
          <>
            <div className="tur-rotulo">Faltan</div>
            <div className="tur-num" style={{ fontSize: 44, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1 }}>{dias}</div>
            <div className="tur-rotulo" style={{ marginTop: 2 }}>días</div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Modales ──────────────────────────────────────────────────────────────────

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  // Al abrir, el foco entra al diálogo; al cerrar, vuelve al botón que lo abrió.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    caja.current?.focus()
    return () => antes?.focus?.()
  }, [])
  // Tab da la vuelta adentro del diálogo y Escape lo cierra.
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onCerrar(); return }
    if (e.key !== 'Tab' || !caja.current) return
    const f = Array.from(caja.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')).filter(el => el.tabIndex >= 0)
    if (!f.length) return
    const foco = document.activeElement
    if (e.shiftKey && (foco === f[0] || foco === caja.current)) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && foco === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
  }
  return (
    <div className="tur-velo" onClick={onCerrar} onKeyDown={teclas}>
      <div ref={caja} role="dialog" aria-modal="true" aria-labelledby="tur-modal-titulo" tabIndex={-1} className="tur-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 id="tur-modal-titulo" className="tur-h" style={{ fontSize: 28, fontWeight: 700, flex: 1 }}>{titulo}</h2>
          <button type="button" className="tur-redondo" onClick={onCerrar} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Reprogramar({ horarios, duracion, actual, guardando, onCerrar, onListo }: { horarios: Semana; duracion: number; actual: TurnoCliente; guardando: boolean; onCerrar: () => void; onListo: (fecha: Fecha, hora: number) => void }) {
  // Solo días con lugar, sin contar hoy: reprogramar para dentro de un rato no es el caso.
  const dias = proximosDias(horarios, duracion).filter(d => d.libres > 0 && !esHoy(d.f)).slice(0, 8)
  const [fecha, setFecha] = useState<Fecha>(dias[0].f)
  const [hora, setHora] = useState<number | null>(null)
  const dia = dias.find(d => mismaFecha(d.f, fecha)) ?? dias[0]
  const primera = dia.grilla.find(g => g.libre)?.m

  return (
    <Modal titulo="Reprogramar" onCerrar={onCerrar}>
      <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-body)', margin: '0 0 14px' }}>
        Hoy lo tenés el {fechaLarga(actual.fecha).toLowerCase()} a las <span className="tur-num">{horaTxt(actual.hora)}</span>. Elegí el nuevo horario: es el mismo servicio, {duracionTxt(duracion)}.
      </p>
      <div className="tur-tira" role="radiogroup" aria-label="Nuevo día" onKeyDown={teclasRadio}>
        {dias.map((d, i) => {
          const sel = mismaFecha(d.f, fecha)
          return (
            <button key={`${d.f.mes}-${d.f.dia}`} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1} className="tur-dia" style={{ minHeight: 92 }}
              onClick={() => { setFecha(d.f); setHora(null) }} aria-label={`${fechaLarga(d.f)}: ${d.libres} horarios libres`}>
              {(i === 0 || d.f.dia === 1) && <span className="tur-dia-mes">{mesCorto(d.f)}</span>}
              <span className="tur-dia-sem">{nombreDiaCorto(d.f)}</span>
              <span className="tur-dia-num">{d.f.dia}</span>
              <span className="tur-dia-txt">{d.libres} libre{d.libres === 1 ? '' : 's'}</span>
            </button>
          )
        })}
      </div>
      <div key={`${fecha.mes}-${fecha.dia}`} className="tur-horas tur-entra" role="radiogroup" aria-label={`Horarios del ${fechaLarga(fecha).toLowerCase()}`} onKeyDown={teclasRadio} style={{ margin: '8px 0 24px' }}>
        {dia.grilla.map(g => {
          const sel = hora === g.m
          return (
            <button key={g.m} type="button" role="radio" aria-checked={sel} disabled={!g.libre} className="tur-hora" tabIndex={sel || (hora === null && g.m === primera) ? 0 : -1}
              onClick={() => setHora(g.m)} aria-label={`${horaTxt(g.m)}${g.libre ? '' : ', ocupado'}`}>{horaTxt(g.m)}</button>
          )
        })}
      </div>
      <BotonCarga cargando={guardando} textoCargando="Guardando el cambio…" disabled={hora === null} className="tur-btn--ancho" onClick={() => hora !== null && onListo(fecha, hora)}>
        {hora === null ? 'Elegí un horario' : <>Pasarlo al {nombreDiaCorto(fecha).toLowerCase()} {fecha.dia} a las {horaTxt(hora)} <ArrowRight size={17} className="tur-flecha" aria-hidden /></>}
      </BotonCarga>
    </Modal>
  )
}
