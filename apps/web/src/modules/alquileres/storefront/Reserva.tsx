// Reserva pública de Alquileres: el flujo que usa el cliente final.
//   canchas:  cancha → día y horario (una o varias franjas seguidas) → extras → datos → seña → listo
//   salón:    fecha y bloque → paquete e invitados → extras → datos del evento → seña → listo
//   estadía:  propiedad → entrada, salida y huéspedes → datos → seña → listo
// Se puede entrar con algo ya elegido desde la portada (?unidad=, ?fecha=,
// ?hora=, ?paquete=, ?propiedad=, ?entrada=, ?salida=).
//
// Se reserva sin registrarse: nombre y celular alcanzan. El "pago" de la seña
// es simulado. Al confirmar, la reserva queda guardada en el navegador y
// aparece en "Mis reservas" y en el panel del negocio. Todo el cálculo de
// disponibilidad y precio es de lib/reservas.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowRight, CalendarPlus, Check, ChevronLeft, Lock, MessageCircle, Users } from 'lucide-react'
import { duracionTxt, esISO, fechaLarga, hhmm, rangoTxt, sumarDias, diaSemana, fechaCorta, type ISO } from '@/lib/reservas/fechas'
import { consecutivasDesde, franjasDelDia } from '@/lib/reservas/disponibilidad'
import { pesos, precioBloque, precioPorHora, senaDe } from '@/lib/reservas/precio'
import { motivoNoReservable, nochesEntre, precioEstadia, salidaMaxima, nochesOcupadas } from '@/lib/reservas/estadia'
import { descargarICS, generarICS } from '@/lib/reservas/ics'
import { AHORA, HOY, aperturaDe, bloqueoEn, bloquesDe, bloquesLibresEn, ocupadoDelDia, rangosOcupados, type Cliente, type NegocioAlquiler, type Reserva as ReservaT } from '../datos'
import { CalendarioDia, CalendarioRango, type Rango } from '@/design-system/reservas/Calendario'
import { Campo, Area, Selector } from '@/design-system/reservas/piezas'
import Sitio, { ruta } from './Sitio'

interface P { negocio: NegocioAlquiler; reservas: ReservaT[]; onReservar: (r: ReservaT, c: Cliente) => void }

type PasoId = 'unidad' | 'cuando' | 'paquete' | 'extras' | 'datos' | 'pago'

const NOMBRE: Record<PasoId, string> = { unidad: 'Qué', cuando: 'Cuándo', paquete: 'Paquete', extras: 'Extras', datos: 'Tus datos', pago: 'Seña' }

interface Datos { nombre: string; telefono: string; email: string; notas: string; agasajado: string; edad: string; invitados: string; huespedes: string }
const DATOS_VACIOS: Datos = { nombre: '', telefono: '', email: '', notas: '', agasajado: '', edad: '', invitados: '', huespedes: '2' }

const q1 = (v: unknown) => (typeof v === 'string' ? v : '')

export default function Reserva({ negocio, reservas, onReservar }: P) {
  const router = useRouter()
  const tipo = negocio.tipo
  const salon = negocio.salon

  // ── Lo que ya viene elegido por la URL (nada en el pasado) ──
  const q = router.query
  const unidadInicial = tipo === 'estadia' ? q1(q.propiedad) : tipo === 'bloque' ? 'salon' : q1(q.unidad)
  const fechaQ = (k: string) => { const v = q1(q[k]); return esISO(v) && v >= HOY ? v : null }
  const [unidadId, setUnidadId] = useState<string | null>(unidadInicial || (tipo === 'bloque' ? 'salon' : null))
  const [fecha, setFecha] = useState<ISO | null>(fechaQ('fecha'))
  const [horaPedida, setHora] = useState<number | null>(q1(q.hora) ? Number(q1(q.hora)) : null)
  const [franjas, setFranjas] = useState(1)
  const [bloqueId, setBloqueId] = useState<string | null>(null)
  const [paqueteId, setPaqueteId] = useState<string | null>(q1(q.paquete) || null)
  const [extras, setExtras] = useState<string[]>([])
  const [rango, setRango] = useState<Rango>(() => { const entrada = fechaQ('entrada'); const salida = fechaQ('salida'); return { entrada, salida: entrada ? salida : null } })
  const [mes, setMes] = useState<ISO>(fecha ?? rango.entrada ?? HOY)
  // Dos huéspedes de entrada, o menos si la propiedad que vino por la URL no los admite.
  const [datos, setDatos] = useState<Datos>(() => {
    const p = tipo === 'estadia' ? negocio.propiedades.find(x => x.id === unidadInicial) : undefined
    return { ...DATOS_VACIOS, huespedes: String(Math.min(2, p?.huespedes ?? 2)) }
  })
  const [intento, setIntento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [hecha, setHecha] = useState<ReservaT | null>(null)

  // ── Lo elegido ──
  // Sin useMemo: react-compiler memoiza solo, y a mano no se podía (las listas se arman en cada render).
  const unidad = tipo === 'cancha' ? negocio.unidades.find(u => u.id === unidadId) ?? null : null
  const propiedad = tipo === 'estadia' ? negocio.propiedades.find(p => p.id === unidadId) ?? null : null
  const paquete = salon?.paquetes.find(p => p.id === paqueteId) ?? null
  const listaExtras = tipo === 'cancha' ? negocio.extras : salon?.extras ?? []

  const franjasDia = fecha && unidad ? franjasDelDia(aperturaDe(negocio, fecha), ocupadoDelDia(negocio, reservas, unidad.id, fecha), { paso: negocio.pasoMin, duracion: negocio.duracionMin, desde: fecha === HOY ? AHORA : undefined }) : []
  // La hora cuenta solo si esa franja está libre: la que viene por la URL (?hora=) pudo haberse tomado.
  const horaLibre = horaPedida !== null && franjasDia.some(f => f.inicio === horaPedida && f.libre)
  const hora = horaLibre ? horaPedida : null
  const maxSeguidas = hora !== null ? Math.min(negocio.maxFranjas, consecutivasDesde(franjasDia, hora, negocio.maxFranjas)) : 0
  const seguidas = Math.min(franjas, Math.max(1, maxSeguidas))
  const bloques = bloquesDe(negocio)
  const bloquesDelDia = fecha ? bloquesLibresEn(negocio, reservas, bloques, fecha).map(b => b.id) : []
  const bloque = bloques.find(b => b.id === bloqueId) ?? null
  const ocupadasProp = propiedad ? rangosOcupados(negocio, reservas, propiedad.id) : []
  const tomadas = nochesOcupadas(ocupadasProp)
  const rangoCompleto = !!(rango.entrada && rango.salida)
  const motivoRango = propiedad && rangoCompleto ? motivoNoReservable(rango.entrada!, rango.salida!, propiedad.tarifa, ocupadasProp) : null
  const invitados = Number(datos.invitados || 0)
  const pasaCapacidad = !!salon && invitados > salon.capacidad

  // ── Precio ──
  function calcularPrecio(): { total: number; detalle: [string, number][] } | null {
    const elegidos = listaExtras.filter(e => extras.includes(e.id)).map(e => [e.nombre, e.precio] as [string, number])
    if (tipo === 'cancha' && unidad && fecha && hora !== null) {
      const p = precioPorHora(unidad.tarifaHora, negocio.duracionMin * seguidas, diaSemana(fecha), hora, negocio.reglasPrecio)
      return { total: precioBloque(p.final, listaExtras, extras).total, detalle: [[`${unidad.nombre} · ${duracionTxt(negocio.duracionMin * seguidas)}${p.ajuste ? ` (${p.ajuste > 0 ? '+' : ''}${p.ajuste}%)` : ''}`, p.final], ...elegidos] }
    }
    if (tipo === 'bloque' && paquete) return { total: precioBloque(paquete.precio, listaExtras, extras).total, detalle: [[paquete.nombre, paquete.precio], ...elegidos] }
    if (tipo === 'estadia' && propiedad && rangoCompleto && !motivoRango) {
      const p = precioEstadia(rango.entrada!, rango.salida!, propiedad.tarifa)
      return { total: p.total, detalle: [[`${p.noches.length} noches · ${rangoTxt(rango.entrada!, rango.salida!)}`, p.subtotal], ['Limpieza', p.limpieza]] }
    }
    return null
  }
  const precio = calcularPrecio()
  const total = precio?.total ?? 0
  const sena = senaDe(total, negocio.senaPct)

  // ── Pasos ──
  const pasos: PasoId[] = tipo === 'cancha' ? ['unidad', 'cuando', ...(listaExtras.length ? ['extras' as PasoId] : []), 'datos', ...(sena ? ['pago' as PasoId] : [])]
    : tipo === 'bloque' ? ['cuando', 'paquete', 'extras', 'datos', ...(sena ? ['pago' as PasoId] : [])]
      : ['unidad', 'cuando', 'datos', ...(sena ? ['pago' as PasoId] : [])]
  // Lo que vino por la URL también se revisa: una hora tomada o un bloque ocupado no dejan seguir.
  const listo: Record<PasoId, boolean> = {
    unidad: tipo === 'cancha' ? !!unidad : !!propiedad,
    cuando: tipo === 'cancha' ? !!fecha && horaLibre : tipo === 'bloque' ? !!fecha && !!bloque && bloquesDelDia.includes(bloque.id) : rangoCompleto && !motivoRango,
    paquete: !!paquete && invitados > 0 && invitados <= paquete.hastaInvitados && !pasaCapacidad,
    extras: true, datos: true, pago: true,
  }
  // Arranca en el primer paso que falta: lo que vino por la URL se saltea.
  const [paso, setPaso] = useState(() => {
    const i = pasos.findIndex(p => !listo[p] && p !== 'extras' && p !== 'datos' && p !== 'pago')
    return i < 0 ? 0 : i
  })
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

  const errores = validar(datos, tipo, paquete?.hastaInvitados ?? 0, propiedad?.huespedes ?? 0)
  const ir = (p: number) => { if (!enviando) setPaso(Math.max(0, Math.min(p, pasos.length - 1))) }
  const siguiente = () => {
    if (enviando || !listo[actual]) return
    if (actual === 'datos' && Object.keys(errores).length) { setIntento(true); document.getElementById(`alr-${Object.keys(errores)[0]}`)?.focus(); return }
    if (!ultimo) { ir(paso + 1); return }
    confirmar()
  }
  const confirmar = () => {
    setEnviando(true)
    window.setTimeout(() => {
      const id = `n${Date.now().toString(36)}`
      const clienteId = `k${id}`
      const cliente: Cliente = { id: clienteId, nombre: datos.nombre.trim(), telefono: datos.telefono.trim(), email: datos.email.trim() || undefined }
      const base = { id, unidadId: unidadId ?? 'salon', clienteId, creada: HOY, extras, total, sena, senaPagada: sena > 0, saldoPagado: false, estado: 'confirmada' as const, nota: datos.notas.trim() || undefined }
      const r: ReservaT = tipo === 'cancha' && fecha && hora !== null
        ? { ...base, fecha, inicio: hora, fin: hora + negocio.duracionMin * seguidas }
        : tipo === 'bloque' && fecha && bloque
          ? { ...base, fecha, inicio: bloque.inicio, fin: bloque.fin, bloqueId: bloque.id, paqueteId: paquete?.id, evento: { agasajado: datos.agasajado.trim(), edad: datos.edad ? Number(datos.edad) : undefined, invitados: Number(datos.invitados), notas: datos.notas.trim() || undefined }, deposito: salon?.deposito || undefined, depositoRegistrado: false }
          : { ...base, entrada: rango.entrada ?? HOY, salida: rango.salida ?? sumarDias(HOY, 1), huespedes: Number(datos.huespedes || 1) }
      onReservar(r, cliente)
      setHecha(r)
      setEnviando(false)
    }, sena ? 1600 : 1000)
  }

  if (hecha) return <Confirmacion negocio={negocio} reserva={hecha} datos={datos} />

  // ── Textos ──
  const cuando = tipo === 'cancha' && fecha && hora !== null ? `${fechaLarga(fecha)} · ${hhmm(hora)} a ${hhmm(hora + negocio.duracionMin * seguidas)}`
    : tipo === 'bloque' && fecha && bloque ? `${fechaLarga(fecha)} · ${bloque.nombre}, ${hhmm(bloque.inicio)} a ${hhmm(bloque.fin)}`
      : tipo === 'estadia' && rangoCompleto ? `${rangoTxt(rango.entrada!, rango.salida!)} · ${nochesEntre(rango.entrada!, rango.salida!)} noches` : null
  const que = unidad?.nombre ?? propiedad?.nombre ?? (tipo === 'bloque' ? negocio.nombre : null)
  const falta: Record<PasoId, string> = {
    unidad: tipo === 'estadia' ? 'Elegí una propiedad para seguir' : 'Elegí una cancha para seguir',
    cuando: tipo === 'estadia' ? 'Elegí entrada y salida para seguir' : tipo === 'bloque' ? 'Elegí fecha y bloque para seguir' : 'Elegí día y horario para seguir',
    paquete: 'Elegí un paquete y cuántos invitados vienen', extras: '', datos: '', pago: '',
  }
  const textoBoton = actual === 'pago' ? `Pagar ${pesos(sena)}` : ultimo ? 'Confirmar reserva' : pasos[paso + 1] === 'pago' ? 'Ir a pagar la seña' : 'Continuar'

  return (
    <Sitio negocio={negocio} pagina="reserva" cta={{ texto: textoBoton, sub: [que, cuando].filter(Boolean).join(' · ') || falta[actual], onClick: siguiente, deshabilitado: !listo[actual] || enviando }}>
      <style>{CSS_RESERVA}</style>
      <div className="als-cont alr">
        <ol className="alr-pasos" aria-label="Pasos de la reserva">
          {pasos.map((p, i) => <li key={p} aria-current={i === paso ? 'step' : undefined} data-hecho={i < paso}><button type="button" onClick={() => i < paso && ir(i)} disabled={i > paso}>{NOMBRE[p]}</button></li>)}
        </ol>
        <div className="alr-grilla">
          <div className="alr-paso">
            {paso > 0 && <button type="button" className="rv-btn rv-btn--fantasma rv-btn--sm" style={{ marginLeft: -12, marginBottom: 6 }} onClick={() => ir(paso - 1)} disabled={enviando}><ChevronLeft size={16} aria-hidden /> Volver</button>}

            {actual === 'unidad' && tipo === 'cancha' && (
              <Bloque refTitulo={titulo} titulo="¿Qué cancha querés?" sub="Cada una tiene su precio por hora. Después elegís el día y el horario.">
                <div className="alr-opciones" role="radiogroup" aria-label="Canchas">
                  {negocio.unidades.map(u => (
                    <button key={u.id} type="button" role="radio" aria-checked={unidadId === u.id} className="alr-op" onClick={() => { setUnidadId(u.id); setHora(null) }}>
                      <img src={u.foto} alt="" loading="lazy" />
                      <span><b>{u.nombre}</b><small>{u.detalle}</small><span className="als-precio">{pesos(u.tarifaHora)} <small>la hora</small></span></span>
                      {unidadId === u.id && <Check size={18} aria-hidden className="alr-tilde" />}
                    </button>
                  ))}
                </div>
              </Bloque>
            )}
            {actual === 'unidad' && tipo === 'estadia' && (
              <Bloque refTitulo={titulo} titulo="¿Dónde te querés quedar?" sub="Elegí la propiedad. Después las fechas y cuántos vienen.">
                <div className="alr-opciones" role="radiogroup" aria-label="Propiedades">
                  {negocio.propiedades.map(p => (
                    <button key={p.id} type="button" role="radio" aria-checked={unidadId === p.id} className="alr-op" onClick={() => { setUnidadId(p.id); setRango({ entrada: null, salida: null }); setDatos({ ...datos, huespedes: String(Math.min(Number(datos.huespedes) || 1, p.huespedes)) }) }}>
                      <img src={p.fotos[0]} alt="" loading="lazy" />
                      <span><b>{p.nombre}</b><small>{p.tipo} · hasta {p.huespedes} huéspedes · mínimo {p.tarifa.minNoches} {p.tarifa.minNoches === 1 ? 'noche' : 'noches'}</small><span className="als-precio">{pesos(p.tarifa.precioNoche)} <small>la noche</small></span></span>
                      {unidadId === p.id && <Check size={18} aria-hidden className="alr-tilde" />}
                    </button>
                  ))}
                </div>
              </Bloque>
            )}

            {actual === 'cuando' && tipo === 'cancha' && unidad && (
              <Bloque refTitulo={titulo} titulo="Elegí día y horario" sub={`${unidad.nombre} · turnos de ${duracionTxt(negocio.duracionMin)}. ${negocio.maxFranjas > 1 ? `Podés tomar hasta ${negocio.maxFranjas} seguidas.` : ''}`}>
                <div className="alr-dos">
                  <CalendarioDia mes={mes} onMes={setMes} hoy={HOY} elegido={fecha} onElegir={f => { setFecha(f); setHora(null) }} minMes={HOY}
                    estadoDe={f => {
                      const cerrado = !negocio.apertura.dias.includes(diaSemana(f))
                      const bloqueado = !cerrado && !!bloqueoEn(negocio, unidad.id, f)
                      return { deshabilitado: f < HOY || cerrado || bloqueado, ocupado: bloqueado, aria: cerrado ? 'cerrado' : bloqueado ? 'no disponible' : undefined }
                    }} />
                  <div>
                    <div className="rv-rotulo" style={{ marginBottom: 8 }}>{fecha ? fechaLarga(fecha) : 'Elegí un día'}</div>
                    {fecha && (
                      franjasDia.length === 0 ? <p className="rv-ayuda">Ese día está cerrado.</p> : bloqueoEn(negocio, unidad.id, fecha) ? <p className="rv-ayuda">{unidad.nombre} no está disponible ese día. Probá con otro día o con otra cancha.</p> : (
                        <div className="rv-franjas" role="radiogroup" aria-label="Horarios">
                          {franjasDia.map(f => (
                            <button key={f.inicio} type="button" role="radio" aria-checked={hora === f.inicio} className="rv-franja" disabled={!f.libre} onClick={() => { setHora(f.inicio); setFranjas(1) }}>
                              {hhmm(f.inicio)}{negocio.reglasPrecio.length ? <small>{(() => { const a = precioPorHora(unidad.tarifaHora, negocio.duracionMin, diaSemana(fecha), f.inicio, negocio.reglasPrecio); return a.ajuste ? `${a.ajuste > 0 ? '+' : ''}${a.ajuste}%` : pesos(a.final) })()}</small> : null}
                            </button>
                          ))}
                        </div>
                      )
                    )}
                    {hora !== null && maxSeguidas > 1 && (
                      <div style={{ marginTop: 14 }}>
                        <div className="rv-rotulo" style={{ marginBottom: 8 }}>¿Cuánto tiempo?</div>
                        <div className="rv-seg" role="group" aria-label="Turnos seguidos">
                          {Array.from({ length: maxSeguidas }, (_, i) => i + 1).map(n => <button key={n} type="button" aria-pressed={seguidas === n} onClick={() => setFranjas(n)}>{duracionTxt(negocio.duracionMin * n)}</button>)}
                        </div>
                        <p className="rv-ayuda" style={{ marginTop: 6 }}>De {hhmm(hora)} a {hhmm(hora + negocio.duracionMin * seguidas)}.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Bloque>
            )}
            {actual === 'cuando' && tipo === 'bloque' && salon && (
              <Bloque refTitulo={titulo} titulo="¿Qué día y qué bloque?" sub={`Cada bloque dura ${salon.duracionBloque / 60} horas. Entre uno y otro hay ${salon.limpieza} minutos de limpieza.`}>
                <div className="alr-dos">
                  <CalendarioDia mes={mes} onMes={setMes} hoy={HOY} elegido={fecha} onElegir={f => { setFecha(f); setBloqueId(null) }} minMes={HOY}
                    estadoDe={f => {
                      const cerrado = f <= HOY || !negocio.apertura.dias.includes(diaSemana(f))
                      const lleno = !cerrado && bloquesLibresEn(negocio, reservas, bloques, f).length === 0
                      return { deshabilitado: cerrado || lleno, ocupado: lleno, aria: cerrado ? 'cerrado' : lleno ? 'completo' : undefined }
                    }} />
                  <div>
                    <div className="rv-rotulo" style={{ marginBottom: 8 }}>{fecha ? fechaLarga(fecha) : 'Elegí un día'}</div>
                    {fecha && (
                      <div className="alr-bloques" role="radiogroup" aria-label="Bloques">
                        {bloques.map(b => {
                          const libre = bloquesDelDia.includes(b.id)
                          return (
                            <button key={b.id} type="button" role="radio" aria-checked={bloqueId === b.id} className="alr-bloque" disabled={!libre} onClick={() => setBloqueId(b.id)}>
                              <b>{b.nombre}</b><span className="rv-num">{hhmm(b.inicio)} – {hhmm(b.fin)}</span><small>{libre ? 'Libre' : 'Tomado'}</small>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Bloque>
            )}
            {actual === 'cuando' && tipo === 'estadia' && propiedad && (
              <Bloque refTitulo={titulo} titulo="¿Cuándo?" sub={`${propiedad.nombre} · entrada desde las ${hhmm(propiedad.checkIn)}, salida hasta las ${hhmm(propiedad.checkOut)}. Tocá el día de entrada y después el de salida.`}>
                <div className="alr-dos">
                  <CalendarioRango mes={mes} onMes={setMes} hoy={HOY} rango={rango} onRango={setRango} minMes={HOY}
                    estadoDe={f => ({ deshabilitado: f < HOY, ocupado: tomadas.has(f), aria: tomadas.has(f) ? 'ocupado' : undefined })}
                    salidaMaxima={e => salidaMaxima(e, ocupadasProp)} />
                  <div>
                    {motivoRango && <p className="rv-error" role="alert" style={{ marginBottom: 12 }}>{motivoRango}</p>}
                    {rangoCompleto && !motivoRango && (
                      <p style={{ margin: '0 0 12px', fontSize: 14 }}><b>{nochesEntre(rango.entrada!, rango.salida!)} noches</b> · {rangoTxt(rango.entrada!, rango.salida!)}</p>
                    )}
                    <Selector label="¿Cuántos vienen?" valor={datos.huespedes} onChange={v => setDatos({ ...datos, huespedes: v })} opciones={Array.from({ length: propiedad.huespedes }, (_, i) => ({ id: String(i + 1), label: `${i + 1} ${i === 0 ? 'huésped' : 'huéspedes'}` }))} />
                  </div>
                </div>
              </Bloque>
            )}

            {actual === 'paquete' && salon && (
              <Bloque refTitulo={titulo} titulo="¿Cuántos vienen?" sub="El paquete incluye mesas, sillas y vajilla para esa cantidad. Si son más, elegí el siguiente.">
                <Campo label="Invitados" value={datos.invitados} onChange={v => setDatos({ ...datos, invitados: v.replace(/\D/g, '') })} inputMode="numeric" maxLength={3} placeholder="Ej.: 25"
                  error={pasaCapacidad ? `El salón tiene lugar para ${salon.capacidad} personas como máximo.` : intento && errores.invitados ? errores.invitados : undefined} ayuda={`Hasta ${salon.capacidad} en total.`} />
                <div className="alr-bloques alr-bloques--lista" role="radiogroup" aria-label="Paquetes" style={{ marginTop: 14 }}>
                  {salon.paquetes.map(p => {
                    const chico = invitados > p.hastaInvitados
                    return (
                      <button key={p.id} type="button" role="radio" aria-checked={paqueteId === p.id} className="alr-bloque" disabled={chico} onClick={() => setPaqueteId(p.id)} style={{ textAlign: 'left', alignItems: 'flex-start' }}>
                        <b>{p.nombre}</b><span className="rv-num">{pesos(p.precio)}</span><small>{chico ? 'No alcanza para tus invitados' : p.incluye.join(' · ')}</small>
                      </button>
                    )
                  })}
                </div>
              </Bloque>
            )}

            {actual === 'extras' && (
              <Bloque refTitulo={titulo} titulo="¿Sumás algo?" sub="Opcional: se agrega al total. Podés seguir sin elegir nada.">
                <div className="alr-bloques">
                  {listaExtras.map(e => {
                    const on = extras.includes(e.id)
                    return (
                      <button key={e.id} type="button" aria-pressed={on} className="alr-bloque" onClick={() => setExtras(on ? extras.filter(x => x !== e.id) : [...extras, e.id])}>
                        <b>{e.nombre}</b><span className="rv-num">+ {pesos(e.precio)}</span><small>{on ? 'Agregado' : 'Tocá para agregar'}</small>
                      </button>
                    )
                  })}
                </div>
              </Bloque>
            )}

            {actual === 'datos' && (
              <Bloque refTitulo={titulo} titulo={tipo === 'bloque' ? 'El evento y tus datos' : 'Tus datos'} sub="Sin registrarte: con tu nombre y tu celular alcanza para confirmarte.">
                <form className="rv-pila" onSubmit={e => { e.preventDefault(); siguiente() }} noValidate>
                  {tipo === 'bloque' && (
                    <div className="rv-dos">
                      <CampoR id="agasajado" label="¿Quién cumple o qué se festeja?" value={datos.agasajado} onChange={v => setDatos({ ...datos, agasajado: v })} error={intento ? errores.agasajado : undefined} placeholder="Ej.: Olivia" />
                      <CampoR id="edad" label="Edad (opcional)" value={datos.edad} onChange={v => setDatos({ ...datos, edad: v.replace(/\D/g, '') })} inputMode="numeric" maxLength={3} />
                    </div>
                  )}
                  <div className="rv-dos">
                    <CampoR id="nombre" label="Nombre y apellido" value={datos.nombre} onChange={v => setDatos({ ...datos, nombre: v })} error={intento ? errores.nombre : undefined} autoComplete="name" />
                    <CampoR id="telefono" label="Celular" value={datos.telefono} onChange={v => setDatos({ ...datos, telefono: v })} error={intento ? errores.telefono : undefined} inputMode="tel" autoComplete="tel" placeholder="Con código de área" />
                  </div>
                  <CampoR id="email" label="Email (opcional)" value={datos.email} onChange={v => setDatos({ ...datos, email: v })} error={intento ? errores.email : undefined} inputMode="email" autoComplete="email" ayuda="Para mandarte la confirmación." />
                  <Area label={tipo === 'bloque' ? 'Algo que tengamos que saber' : 'Notas (opcional)'} value={datos.notas} onChange={v => setDatos({ ...datos, notas: v })} placeholder={tipo === 'bloque' ? 'Temática, alergias, horario de la torta…' : ''} maxLength={300} />
                  <button type="submit" className="rv-sr">Continuar</button>
                </form>
              </Bloque>
            )}

            {actual === 'pago' && (
              <Bloque refTitulo={titulo} titulo="Confirmá con la seña" sub={`Pagás ${pesos(sena)} ahora y ${pesos(total - sena)} en el lugar. Si cancelás ${negocio.cancelaHastaHoras >= 24 ? `hasta ${negocio.cancelaHastaHoras / 24} ${negocio.cancelaHastaHoras / 24 === 1 ? 'día' : 'días'}` : `hasta ${negocio.cancelaHastaHoras} h`} antes, se devuelve.`}>
                <div className="rv-card rv-card--pad" style={{ background: 'var(--color-surface)' }}>
                  <div className="rv-rotulo">Vista previa: no se cobra nada</div>
                  <p style={{ margin: '8px 0 14px', fontSize: 14 }}>En el producto real, acá se abre Mercado Pago con el monto de la seña.</p>
                  <button type="button" className="rv-btn rv-btn--primario rv-btn--lg rv-btn--ancho" onClick={siguiente} disabled={enviando} aria-busy={enviando}><Lock size={16} aria-hidden /> {enviando ? 'Procesando…' : `Pagar ${pesos(sena)} con Mercado Pago`}</button>
                </div>
              </Bloque>
            )}
          </div>

          <aside className="alr-lateral">
            <div className="rv-card rv-card--pad">
              <div className="rv-rotulo" style={{ marginBottom: 10 }}>Tu reserva</div>
              <dl className="alr-ticket">
                <div><dt>{tipo === 'estadia' ? 'Propiedad' : tipo === 'bloque' ? 'Salón' : 'Cancha'}</dt><dd>{que ?? <i>Falta elegir</i>}</dd></div>
                <div><dt>Cuándo</dt><dd>{cuando ?? <i>Falta elegir</i>}</dd></div>
                {tipo === 'bloque' && <div><dt>Paquete</dt><dd>{paquete ? `${paquete.nombre}${datos.invitados ? ` · ${datos.invitados} invitados` : ''}` : <i>Falta elegir</i>}</dd></div>}
                {tipo === 'estadia' && rangoCompleto && <div><dt>Huéspedes</dt><dd>{datos.huespedes}</dd></div>}
                {precio?.detalle.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="rv-num">{pesos(v)}</dd></div>)}
              </dl>
              <div className="alr-total"><span>Total</span><b className="rv-num">{precio ? pesos(total) : '—'}</b></div>
              {sena > 0 && <div className="alr-total" style={{ fontWeight: 500, color: 'var(--color-muted)' }}><span>Seña ahora</span><span className="rv-num">{pesos(sena)}</span></div>}
              {actual !== 'pago' && (
                <button type="button" className="rv-btn rv-btn--primario rv-btn--lg rv-btn--ancho" style={{ marginTop: 14 }} onClick={siguiente} disabled={!listo[actual] || enviando} aria-busy={enviando}>
                  {enviando ? 'Reservando…' : textoBoton} {!enviando && <ArrowRight size={16} aria-hidden />}
                </button>
              )}
              <p className="rv-ayuda" style={{ minHeight: 20, margin: '8px 0 0', textAlign: 'center' }}>{listo[actual] ? '' : falta[actual]}</p>
            </div>
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

function CampoR(p: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; ayuda?: string; placeholder?: string; inputMode?: 'text' | 'numeric' | 'tel' | 'email'; autoComplete?: string; maxLength?: number }) {
  const id = `alr-${p.id}`
  return (
    <label className="rv-campo" htmlFor={id}>
      <span>{p.label}</span>
      <input id={id} className="rv-input" value={p.value} onChange={e => p.onChange(e.target.value)} placeholder={p.placeholder} inputMode={p.inputMode} autoComplete={p.autoComplete} maxLength={p.maxLength} aria-invalid={p.error ? true : undefined} aria-describedby={p.error ? `${id}-e` : undefined} />
      {p.error ? <span id={`${id}-e`} className="rv-error" role="alert">{p.error}</span> : p.ayuda ? <span className="rv-ayuda">{p.ayuda}</span> : null}
    </label>
  )
}

function validar(d: Datos, tipo: NegocioAlquiler['tipo'], hasta: number, maxHuespedes: number): Partial<Record<keyof Datos, string>> {
  const e: Partial<Record<keyof Datos, string>> = {}
  if (d.nombre.trim().length < 3) e.nombre = 'Escribí tu nombre y apellido.'
  if (d.telefono.replace(/\D/g, '').length < 8) e.telefono = 'Escribí un celular con código de área.'
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Revisá el email: le falta algo.'
  if (tipo === 'bloque') {
    if (d.agasajado.trim().length < 2) e.agasajado = 'Contanos quién cumple o qué se festeja.'
    const n = Number(d.invitados || 0)
    if (n < 1) e.invitados = 'Decinos cuántos invitados vienen.'
    else if (hasta && n > hasta) e.invitados = `Ese paquete es hasta ${hasta} invitados.`
  }
  if (tipo === 'estadia' && maxHuespedes && Number(d.huespedes) > maxHuespedes) e.huespedes = `Entran hasta ${maxHuespedes}.`
  return e
}

// ─── Confirmación ────────────────────────────────────────────────────────────

function Confirmacion({ negocio, reserva: r, datos }: { negocio: NegocioAlquiler; reserva: ReservaT; datos: Datos }) {
  const tipo = negocio.tipo
  const codigo = r.id.slice(-6).toUpperCase()
  const unidad = tipo === 'cancha' ? negocio.unidades.find(u => u.id === r.unidadId) : tipo === 'estadia' ? negocio.propiedades.find(p => p.id === r.unidadId) : null
  const cuando = r.entrada && r.salida ? `${rangoTxt(r.entrada, r.salida)} · ${nochesEntre(r.entrada, r.salida)} noches` : r.fecha && r.inicio !== undefined && r.fin !== undefined ? `${fechaLarga(r.fecha)} · ${hhmm(r.inicio)} a ${hhmm(r.fin)}` : ''
  const calendario = () => {
    const titulo = `${unidad?.nombre ?? negocio.nombre} · ${negocio.nombre}`
    const ev = r.entrada && r.salida ? { uid: `${r.id}@orbita`, titulo, fecha: r.entrada, hasta: r.salida, lugar: `${negocio.direccion}, ${negocio.ciudad}` }
      : { uid: `${r.id}@orbita`, titulo, inicio: { fecha: r.fecha ?? HOY, minuto: r.inicio ?? 0 }, fin: { fecha: r.fecha ?? HOY, minuto: r.fin ?? 0 }, lugar: `${negocio.direccion}, ${negocio.ciudad}` }
    descargarICS(generarICS([ev], { nombre: negocio.nombre }), `reserva-${codigo}`)
  }
  const wa = `https://wa.me/?text=${encodeURIComponent(`Reservé en ${negocio.nombre}: ${unidad?.nombre ?? ''} ${cuando}. Código ${codigo}.`)}`
  return (
    <Sitio negocio={negocio} pagina="reserva">
      <style>{CSS_RESERVA}</style>
      <div className="als-cont" style={{ maxWidth: 640, paddingTop: 32 }}>
        <div className="rv-card rv-card--pad rv-entra" style={{ textAlign: 'center', padding: 28 }}>
          <span className="alr-ok" aria-hidden><Check size={26} strokeWidth={3} /></span>
          <h1 className="rv-h1" style={{ marginTop: 14 }}>{r.sena ? 'Seña recibida: tu reserva está confirmada' : 'Tu reserva está confirmada'}</h1>
          <p className="rv-bajada" style={{ margin: '10px auto 0' }}>Te mandamos la confirmación por WhatsApp{datos.email ? ' y por email' : ''}. Guardá el código por si tenés que cambiar algo.</p>
          <div className="alr-codigo"><span className="rv-rotulo">Código</span><b className="rv-num">{codigo}</b></div>
          <dl className="alr-ticket" style={{ textAlign: 'left', marginTop: 20 }}>
            <div><dt>{tipo === 'estadia' ? 'Propiedad' : tipo === 'bloque' ? 'Salón' : 'Cancha'}</dt><dd>{unidad?.nombre ?? negocio.nombre}</dd></div>
            <div><dt>Cuándo</dt><dd>{cuando}</dd></div>
            {r.evento && <div><dt>Evento</dt><dd>{r.evento.agasajado}{r.evento.edad ? ` · ${r.evento.edad} años` : ''} · {r.evento.invitados} invitados</dd></div>}
            {r.huespedes && <div><dt>Huéspedes</dt><dd>{r.huespedes}</dd></div>}
            <div><dt>Total</dt><dd className="rv-num">{pesos(r.total)}</dd></div>
            {r.sena > 0 && <div><dt>Pagado ahora</dt><dd className="rv-num">{pesos(r.sena)} · queda {pesos(r.total - r.sena)} en el lugar</dd></div>}
            {r.deposito ? <div><dt>Depósito</dt><dd>{pesos(r.deposito)} de garantía, se entrega el día del evento y se devuelve al terminar.</dd></div> : null}
            <div><dt>Dónde</dt><dd>{negocio.direccion}, {negocio.ciudad}</dd></div>
          </dl>
          <div className="rv-fila" style={{ justifyContent: 'center', marginTop: 20 }}>
            <button type="button" className="rv-btn" onClick={calendario}><CalendarPlus size={16} aria-hidden /> Agregar al calendario</button>
            <a className="rv-btn" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden /> Compartir</a>
            <Link href={ruta('mis-reservas', tipo)} className="rv-btn rv-btn--primario"><Users size={16} aria-hidden /> Ver mis reservas</Link>
          </div>
        </div>
        <p className="rv-ayuda" style={{ textAlign: 'center', marginTop: 14 }}>Es una demo: no se cobró nada ni se mandó ningún mensaje. {fechaCorta(HOY)}.</p>
      </div>
    </Sitio>
  )
}

export const CSS_RESERVA = `
  .alr { padding-top: 20px; }
  .alr-pasos { display: flex; gap: 4px; margin: 0 0 20px; padding: 0; list-style: none; overflow-x: auto; scrollbar-width: none; }
  .alr-pasos::-webkit-scrollbar { display: none; }
  .alr-pasos li { flex-shrink: 0; }
  .alr-pasos button { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--color-border); background: transparent; color: var(--color-muted); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
  .alr-pasos li[data-hecho='true'] button { color: var(--color-text); border-color: var(--color-primary); }
  .alr-pasos li[aria-current='step'] button { background: var(--color-primary); color: var(--color-on-primary); border-color: transparent; font-weight: 600; }
  .alr-pasos button:disabled { cursor: default; opacity: 0.6; }
  .alr-pasos button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .alr-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 32px; align-items: start; }
  .alr-lateral { position: sticky; top: calc(var(--rv-tope, 0px) + 80px); }
  .alr-dos { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 24px; align-items: start; }
  .alr-opciones { display: flex; flex-direction: column; gap: 10px; }
  .alr-op { position: relative; display: flex; align-items: center; gap: 14px; padding: 10px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-bg); text-align: left; font: inherit; color: inherit; cursor: pointer; width: 100%; }
  .alr-op img { width: 96px; height: 72px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
  .alr-op > span { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .alr-op b { font-size: 16px; color: var(--color-text); }
  .alr-op small { font-size: 13px; color: var(--color-muted); }
  .alr-op[aria-checked='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
  .alr-op:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .alr-tilde { color: var(--color-primary); flex-shrink: 0; margin-right: 6px; }
  .alr-bloques { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .alr-bloque { display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 76px; padding: 12px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-bg); font: inherit; color: inherit; cursor: pointer; text-align: center; }
  .alr-bloque b { font-size: 14px; color: var(--color-text); }
  .alr-bloque small { font-size: 12px; color: var(--color-muted); line-height: 1.4; }
  .alr-bloque:disabled { opacity: 0.5; cursor: not-allowed; }
  .alr-bloque[aria-checked='true'], .alr-bloque[aria-pressed='true'] { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); background: var(--color-primary-bg); }
  .alr-bloque:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .alr-ticket { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .alr-ticket > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13.5px; }
  .alr-ticket dt { color: var(--color-muted); flex-shrink: 0; }
  .alr-ticket dd { margin: 0; text-align: right; color: var(--color-text); font-weight: 500; min-width: 0; }
  .alr-ticket i { font-style: normal; color: var(--color-muted); font-weight: 400; }
  /* Las franjas son radios (aria-checked) y el kit pinta solo aria-pressed: sin esto, la hora elegida no se ve. */
  .alr .rv-franja[aria-checked='true'] { background: var(--color-primary); color: var(--color-on-primary); border-color: transparent; }
  .alr .rv-franja[aria-checked='true'] small { color: inherit; opacity: 0.85; }
  .alr-total { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border); font-size: 15px; font-weight: 700; color: var(--color-text); }
  .alr-ok { width: 56px; height: 56px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); }
  .alr-codigo { display: inline-flex; flex-direction: column; gap: 2px; margin-top: 18px; padding: 10px 18px; border-radius: 12px; background: var(--color-surface); }
  .alr-codigo b { font-size: 22px; letter-spacing: 0.12em; color: var(--color-text); }
  @media (max-width: 960px) { .alr-dos { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 860px) {
    .alr-grilla { grid-template-columns: minmax(0, 1fr); gap: 20px; }
    .alr-lateral { position: static; }
  }
  /* El botón del resumen se va recién cuando aparece la barra fija del pie (768): entre 769 y 860 no había ninguno. */
  @media (max-width: 768px) { .alr-lateral .rv-btn { display: none; } .alr-pasos button { min-height: 44px; } }
  @media (max-width: 480px) {
    .alr-op img { width: 76px; height: 60px; }
    .alr-bloques { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* Los paquetes traen lo que incluyen: en dos columnas de 170 px no se leían. */
    .alr-bloques--lista { grid-template-columns: minmax(0, 1fr); }
  }
`
