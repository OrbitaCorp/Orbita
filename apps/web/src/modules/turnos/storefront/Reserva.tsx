// Reserva pública: el flujo que usa el cliente final para sacar un turno.
//   servicio → profesional / espacio → día y hora → datos → (seña) → listo
// Se puede entrar con algo ya elegido desde la portada (?servicio=, ?con=) y
// el flujo arranca en el paso siguiente.
//
// Se reserva SIN registrarse: nombre y celular alcanzan. Si el negocio ofrece
// beneficios, en "Tus datos" se puede crear la cuenta (o entrar a la que ya se
// tiene) y el descuento de bienvenida se ve en el ticket antes de confirmar.
//
// Desde la página simple (?forma=simple) el flujo es más corto y más liviano:
// no se pregunta con quién (se da el primero libre), elegir un servicio o un
// horario ya pasa al paso siguiente, y todo va en una columna angosta con una
// barrita de avance en vez de la órbita y el ticket al costado.
//
// Acá vive solo el estado y el orden de los pasos; cada paso y cada pieza está
// en ./reserva. Manda la marca del negocio (tema) y Órbita aparece como motivo:
// el progreso es una órbita, el resumen es un ticket y la confirmación cierra
// un anillo.
//
// En /turnos-demo todo es de ejemplo: no reserva nada ni llama a Mercado Pago.
// En el sitio de un negocio real (adentro de SitioApiProvider, origenSitio.ts)
// los servicios, las agendas, los días y los horarios libres salen de la API,
// y confirmar retiene el horario y lo confirma con los datos de la persona. La
// seña no se cobra todavía en línea: se muestra y se coordina con el negocio.
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import type { ParsedUrlQuery } from 'querystring'
import { ArrowRight, CalendarClock, ChevronLeft, Clock, Home, Lock, MapPin, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { pesos, duracionTxt, horaTxt, recursosDe, semanaDeRecurso, type RubroTurnos } from '@/modules/turnos/datos'
import { cancelacionTxt, useNegocioDemo, type FormaSitio, type Modalidad } from '@/modules/turnos/datos/negocio'
import { fijarReloj, tramosDe, tramosFrase } from '@/modules/turnos/horario'
import { ReservasApiError, claveDeIntento } from '@/lib/reservasApi/cliente'
import { cargarSitio, useSlugSitio, type HorarioLibre, type ReservaHecha, type SitioApi } from './origenSitio'
import SitioNegocio from './SitioNegocio'
import { RETRATOS, type TemaNegocio } from './tema'
import { EstiloReserva } from './reserva/estilo'
import { fechaLarga, fijarHoy, isoDe, primerLibre, sumarDias, HOY, type DiaAgenda, type Fecha } from './reserva/calendario'
import { OrbitaPasos } from './reserva/OrbitaPasos'
import { PasoServicio, PasoRecurso } from './reserva/PasosEleccion'
import { PasoFecha } from './reserva/PasoFecha'
import { PasoDatos, PasoPago, validar, idCampo, DATOS_VACIOS, type CampoValidado, type Cuenta } from './reserva/PasoDatos'
import { Ticket, HojaResumen, type FilaTicket } from './reserva/Ticket'
import { Confirmacion, SinAgenda } from './reserva/Confirmacion'
import { BotonCarga, Bloque, Fondo } from './reserva/piezas'

export default function Reserva({ rubro }: { rubro: RubroTurnos }) {
  const router = useRouter()
  // ?forma=simple: se llegó desde la página simple del negocio y la reserva se abre con el encabezado mínimo.
  const forma: FormaSitio = router.query.forma === 'simple' ? 'simple' : 'web'
  // En el sitio de un negocio real, su subdominio: los datos salen de la API.
  const slug = useSlugSitio()
  return (
    <SitioNegocio rubro={rubro} pagina="reserva" forma={forma} ctaMovil={false}>
      {t => (
        <>
          <EstiloReserva />
          {slug ? <FlujoApi slug={slug} rubro={rubro} t={t} simple={forma === 'simple'} /> : <Flujo rubro={rubro} t={t} simple={forma === 'simple'} />}
        </>
      )}
    </SitioNegocio>
  )
}

/** Con la API: trae los servicios, las agendas y el horario del negocio antes de mostrar el flujo. */
function FlujoApi({ slug, rubro, t, simple }: { slug: string; rubro: RubroTurnos; t: TemaNegocio; simple: boolean }) {
  const [estado, setEstado] = useState<{ api: SitioApi | null; error: string | null }>({ api: null, error: null })
  const [vuelta, setVuelta] = useState(0)
  const cargar = useEffectEvent(() => cargarSitio(slug, rubro))
  useEffect(() => {
    let vivo = true
    cargar().then(
      api => { if (vivo) setEstado({ api, error: null }) },
      (e: unknown) => { if (vivo) setEstado({ api: null, error: e instanceof Error && e.message ? e.message : 'No pudimos abrir la agenda.' }) },
    )
    return () => { vivo = false }
  }, [slug, vuelta])
  if (estado.error) {
    return (
      <div className="tur" data-oscuro={t.oscuro}><div className="tur-cont tur-flujo">
        <p role="alert" style={{ textAlign: 'center', margin: '48px 0 12px', fontSize: 16 }}>{estado.error}</p>
        <p style={{ textAlign: 'center' }}><button type="button" className="tur-volver" onClick={() => { setEstado({ api: null, error: null }); setVuelta(n => n + 1) }}>Probar de nuevo</button></p>
      </div></div>
    )
  }
  if (!estado.api) return <div className="tur"><div className="tur-cont tur-flujo"><p aria-busy="true" style={{ textAlign: 'center', margin: '48px 0', color: 'var(--color-muted)' }}>Abriendo la agenda…</p></div></div>
  return <Flujo rubro={estado.api.rubro} t={t} simple={simple} api={estado.api} />
}

/** Cuántos días de la tira se piden a la API. */
const DIAS_TIRA = 21

/** Lo que dice la config sobre devolver la seña, igual que el email de la reserva (reservas-avisos.service.ts). */
export function senaDevolucionTxt(a: Pick<SitioApi, 'senaSeDevuelve' | 'politica'>): string {
  if (!a.senaSeDevuelve) return ' Si cancelás, la seña no se devuelve.'
  const h = a.politica.cancelaHasta
  return h > 0 ? ` Si cancelás hasta ${h} ${h === 1 ? 'hora' : 'horas'} antes, se devuelve.` : ' Si cancelás, se devuelve.'
}

type Paso = 'servicio' | 'recurso' | 'fecha' | 'datos' | 'pago'

/** Lo que ya viene elegido por la URL, y en qué paso conviene arrancar. */
function preseleccion(q: ParsedUrlQuery, rubro: RubroTurnos, recursos: { id: string }[]) {
  const out: { servicio: number | null; recursoId: string | null; saltear: Paso[] } = { servicio: null, recursoId: null, saltear: [] }
  if (typeof q.servicio === 'string' && rubro.servicios[+q.servicio]) { out.servicio = +q.servicio; out.saltear.push('servicio') }
  if (typeof q.con === 'string' && recursos.some(r => r.id === q.con)) {
    out.recursoId = q.con
    // Con quién ya está; si además vino el servicio, se va derecho a elegir día y hora.
    if (out.servicio !== null) out.saltear.push('recurso')
  }
  return out
}

function Flujo({ rubro, t, simple, api }: { rubro: RubroTurnos; t: TemaNegocio; simple: boolean; api?: SitioApi }) {
  const router = useRouter()
  // El "hoy" y la hora: los de Argentina con la API, los de la demo sin ella. Antes de cualquier cálculo.
  fijarHoy(api?.hoy ?? null)
  fijarReloj(api ? { hoy: api.hoy, minutos: api.minutos } : null)
  const vacio = router.query.estado === 'vacio' || (!!api && rubro.servicios.length === 0)
  const recursos = useMemo(() => (api ? api.recursos : recursosDe(rubro)), [api, rubro])

  // La página se sirve con getServerSideProps: la query ya está en el primer render,
  // así que lo preseleccionado entra como estado inicial y no hace falta un effect.
  const [inicial] = useState(() => preseleccion(router.query, rubro, recursos))
  const [servicioIdx, setServicioIdx] = useState<number | null>(inicial.servicio)
  // En la reserva simple no se elige con quién: salvo que venga pedido por la URL, es el primero libre.
  const [recursoId, setRecursoId] = useState<string | null>(inicial.recursoId ?? (simple ? 'cualquiera' : null))
  const [fecha, setFecha] = useState<Fecha | null>(null)
  const [hora, setHora] = useState<number | null>(null)
  const [datos, setDatos] = useState(DATOS_VACIOS)
  // Dónde se hace: si el negocio atiende de una sola forma, no hay nada que elegir.
  const [lugarPedido, setLugar] = useState<Modalidad | null>(null)
  const lugar = lugarPedido && t.modalidades.includes(lugarPedido) ? lugarPedido : t.modalidades[0]
  // La cuenta es opcional: lo normal es reservar como invitado.
  const { demo } = useNegocioDemo()
  // Con la API: la política de la config, y sin cuenta de clientes (todavía no existe para Turnos).
  const politica = api ? { ...demo.politica, ...api.politica } : demo.politica
  const beneficios = api ? { ...demo.cuentas, activo: false } : demo.cuentas
  const [cuentaPedida, setCuenta] = useState<Cuenta>('invitado')
  const cuenta: Cuenta = beneficios.activo ? cuentaPedida : 'invitado'
  const [intento, setIntento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  const servicio = servicioIdx === null ? null : rubro.servicios[servicioIdx]
  const recurso = recursos.find(r => r.id === recursoId)
  const idxRecurso = recursos.findIndex(r => r.id === recursoId)
  // Los horarios que se ofrecen: los del negocio (su mañana y su tarde) y, si ya eligió con quién,
  // solo los días y las horas en que esa persona atiende.
  const horariosBase = api ? api.semana : t.horarios
  const agenda = useMemo(() => (recurso ? semanaDeRecurso(recurso, horariosBase) : horariosBase), [recurso, horariosBase])
  const elegido = !!servicio
  const precio = servicio?.precio ?? 0
  const duracion = servicio?.duracion ?? 30
  // El descuento de bienvenida es para el primer turno con cuenta: vale al crearla, no para quien ya la tenía.
  const descuento = cuenta === 'nueva' && beneficios.bienvenida > 0 ? Math.round((precio * beneficios.bienvenida) / 100) : 0
  const aPagar = precio - descuento
  // La seña se pide si el rubro la usa y hay algo que cobrar.
  const pideSena = rubro.sena > 0 && !(elegido && precio === 0)
  const sena = pideSena && aPagar ? Math.round((aPagar * rubro.sena) / 100) : 0

  // Con la API la seña no se cobra en línea todavía: no hay paso de pago (se coordina con el negocio).
  const pasos: Paso[] = ['servicio', ...(simple ? [] : ['recurso' as Paso]), 'fecha', 'datos', ...(pideSena && !api ? ['pago' as Paso] : [])]
  const rotuloRecurso = rubro.modo === 'profesional' ? rubro.profesional : 'Espacio'
  const NOMBRE: Record<Paso, string> = { servicio: 'Servicio', recurso: rotuloRecurso, fecha: 'Día y hora', datos: 'Tus datos', pago: 'Seña' }

  const [paso, setPaso] = useState(() => pasos.findIndex(p => !inicial.saltear.includes(p)))
  const [dir, setDir] = useState<'adelante' | 'atras'>('adelante')
  const actual = pasos[Math.min(paso, pasos.length - 1)]
  const ultimo = paso >= pasos.length - 1

  // ── Con la API: los días y los horarios libres de verdad ──
  const servicioId = api && servicioIdx !== null ? api.servicioIds[servicioIdx] ?? null : null
  const agendasPedidas = api ? (recursoId && recursoId !== 'cualquiera' ? [recursoId] : api.recursos.map(r => r.id)) : []
  const claveAgenda = servicioId && recursoId ? `${servicioId}|${recursoId}` : null
  const [rango, setRango] = useState<{ clave: string; dias: Map<string, { libres: number; cerrado: boolean }> } | null>(null)
  const [horariosDia, setHorariosDia] = useState<Record<string, HorarioLibre[]>>({})
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [clave, setClave] = useState<string | null>(null)
  const [hecha, setHecha] = useState<ReservaHecha | null>(null)
  const pedirRango = useEffectEvent((c: string) => {
    if (!api || !servicioId) return
    api.rango(agendasPedidas, servicioId, api.hoy, DIAS_TIRA).then(
      dias => setRango({ clave: c, dias }),
      (e: unknown) => setErrorApi(e instanceof Error && e.message ? e.message : 'No pudimos traer los días.'),
    )
  })
  useEffect(() => { if (claveAgenda && actual === 'fecha' && rango?.clave !== claveAgenda) pedirRango(claveAgenda) }, [claveAgenda, actual, rango?.clave])
  const diasApi: DiaAgenda[] | undefined = api && claveAgenda && rango?.clave === claveAgenda
    ? Array.from({ length: DIAS_TIRA }, (_, i) => {
      const f = sumarDias(HOY, i)
      const r = rango.dias.get(isoDe(f))
      const grilla = (horariosDia[`${claveAgenda}|${isoDe(f)}`] ?? []).map(h => ({ m: h.m, libre: h.libre }))
      return { f, grilla, libres: r?.libres ?? 0, cerrado: r ? r.cerrado : true }
    })
    : undefined

  // Si todavía no eligió día, se muestra el primero con lugar para ese servicio (estado derivado).
  const fechaVista = fecha ?? (api ? diasApi?.find(d => d.libres > 0)?.f : primerLibre(agenda, duracion)?.f) ?? HOY
  const claveDia = claveAgenda ? `${claveAgenda}|${isoDe(fechaVista)}` : null
  const pedirHorarios = useEffectEvent((c: string, fechaIso: string) => {
    if (!api || !servicioId) return
    api.horarios(agendasPedidas, servicioId, fechaIso).then(
      hs => setHorariosDia(h => ({ ...h, [c]: hs })),
      (e: unknown) => setErrorApi(e instanceof Error && e.message ? e.message : 'No pudimos traer los horarios.'),
    )
  })
  const hayDias = !!diasApi
  useEffect(() => {
    if (claveDia && hayDias && actual === 'fecha' && !horariosDia[claveDia]) pedirHorarios(claveDia, claveDia.split('|')[2])
  }, [claveDia, hayDias, actual, horariosDia])
  const fechaTurno = hora !== null ? fechaVista : null
  const inicioTurno = hora
  const cuando = fechaTurno && inicioTurno !== null ? `${fechaLarga(fechaTurno)} · ${horaTxt(inicioTurno)}` : null
  const nombreRecurso = recursoId === 'cualquiera' ? (rubro.modo === 'profesional' ? 'Cualquiera disponible' : 'El primero libre') : recurso?.nombre

  const errores = validar(datos, lugar === 'domicilio')
  const puede: Record<Paso, boolean> = { servicio: !!servicio, recurso: !!recursoId, fecha: hora !== null, datos: true, pago: true }

  // Al cambiar de paso el foco va al título: quien navega con teclado o lector sigue
  // desde el contenido nuevo y no desde un botón que ya no está. Solo cuando el paso cambia de verdad: al cargar no roba el foco.
  const titulo = useRef<HTMLHeadingElement>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const pasoPrevio = useRef(actual)
  useEffect(() => {
    if (pasoPrevio.current === actual) return
    pasoPrevio.current = actual
    titulo.current?.focus({ preventScroll: true })
    // Solo se sube si el arranque del flujo quedó fuera de pantalla.
    const r = raiz.current?.getBoundingClientRect()
    if (r && r.top < 0) {
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: window.scrollY + r.top - 120, behavior: suave ? 'smooth' : 'auto' })
    }
  }, [actual])

  // El "envío" simulado (solo en la demo): mientras dura, el botón queda trabado con el giro.
  useEffect(() => {
    if (!enviando || api) return
    const x = setTimeout(() => { setEnviando(false); setListo(true) }, pideSena ? 1700 : 1100)
    return () => clearTimeout(x)
  }, [enviando, pideSena, api])

  const ir = (p: number) => {
    if (enviando) return
    setDir(p < paso ? 'atras' : 'adelante')
    setPaso(p)
  }
  const siguiente = () => {
    if (enviando || !puede[actual]) return
    if (actual === 'datos') {
      const mal = (['domicilio', 'nombre', 'tel', 'email'] as CampoValidado[]).find(c => errores[c])
      if (mal) { setIntento(true); document.getElementById(idCampo(mal))?.focus(); return }
    }
    if (!ultimo) ir(paso + 1)
    else if (api) void confirmarEnApi(api)
    else setEnviando(true)
  }

  // Con la API: retener el horario y confirmarlo. Si se ocupó en el medio (409), vuelve a elegir
  // horario con los de ese día traídos de nuevo; cualquier otro error, el mensaje de la API.
  const confirmarEnApi = async (a: SitioApi) => {
    if (!servicioId || hora === null || !claveDia) return
    const recursoReal = recursoId === 'cualquiera' ? horariosDia[claveDia]?.find(h => h.m === hora && h.libre)?.recursoId : recursoId
    const volverAElegir = (msg: string) => {
      setErrorApi(msg); setHora(null)
      setHorariosDia(h => { const resto = { ...h }; delete resto[claveDia]; return resto })
      setRango(null)
      ir(pasos.indexOf('fecha'))
    }
    if (!recursoReal) { volverAElegir('Ese horario ya no está libre. Elegí otro.'); return }
    setEnviando(true); setErrorApi(null)
    try {
      const r = await a.reservar({
        recursoId: recursoReal, servicioId, fecha: isoDe(fechaVista), inicio: hora, clave: clave ?? claveDeIntento(),
        nombre: datos.nombre.trim(), telefono: datos.tel.trim() || undefined, email: datos.email.trim() || undefined, notas: datos.nota.trim() || undefined,
      })
      setHecha(r); setListo(true)
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : 'No pudimos reservar. Probá de nuevo.'
      if (e instanceof ReservasApiError && e.esConflicto) volverAElegir(msg)
      else setErrorApi(msg)
    } finally {
      setEnviando(false)
    }
  }

  // Reserva simple: elegir ya avanza, sin pasar por "Continuar".
  const avanzar = () => { if (simple && !ultimo) ir(paso + 1) }

  if (vacio) return <SinAgenda rubro={rubro} t={t} />

  if (listo && fechaTurno && inicioTurno !== null) {
    return (
      <Confirmacion rubro={rubro} t={t} servicio={servicio?.nombre ?? ''} fecha={fechaTurno} inicio={inicioTurno} duracion={duracion}
        recurso={nombreRecurso ? { rotulo: rubro.modo === 'profesional' ? 'Con' : rotuloRecurso, nombre: nombreRecurso, retrato: rubro.modo === 'profesional' && idxRecurso >= 0 ? RETRATOS[idxRecurso % RETRATOS.length] : undefined } : undefined}
        nombre={datos.nombre} precio={api ? hecha?.precio ?? aPagar : aPagar} sena={api ? 0 : sena} recordatorio={datos.recordatorio}
        lugar={lugar} domicilio={datos.domicilio} cuenta={cuenta} beneficios={beneficios}
        real={api && hecha ? { codigo: hecha.codigo, senaAPagar: hecha.sena, pendiente: hecha.estado === 'PENDIENTE' } : undefined} />
    )
  }

  // ── Textos del botón principal ──
  const sigue = pasos[paso + 1]
  const textoBoton = actual === 'pago' ? `Pagar ${pesos(sena)}`
    : ultimo ? 'Confirmar reserva'
    : sigue === 'pago' ? 'Ir a pagar la seña' : 'Continuar'
  const textoCorto = actual === 'pago' ? `Pagar ${pesos(sena)}` : ultimo ? 'Confirmar' : 'Continuar'
  const falta: Record<Paso, string> = {
    servicio: 'Elegí un servicio para seguir', recurso: rubro.modo === 'profesional' ? 'Elegí con quién para seguir' : 'Elegí dónde para seguir',
    fecha: 'Elegí un horario para seguir', datos: '', pago: '',
  }
  const boton = (corto: boolean) => (
    <BotonCarga cargando={enviando} textoCargando={actual === 'pago' ? 'Procesando…' : 'Reservando…'} disabled={!puede[actual]} onClick={siguiente}
      className={corto ? '' : 'tur-btn--ancho'} style={corto ? { minHeight: 50, padding: '0 20px' } : undefined} aria-describedby={!corto && falta[actual] && !puede[actual] ? 'tur-falta' : undefined}>
      {actual === 'pago' && <Lock size={17} aria-hidden />} {corto ? textoCorto : textoBoton} {actual !== 'pago' && <ArrowRight size={18} className="tur-flecha" aria-hidden />}
    </BotonCarga>
  )

  // ── Ticket ──
  const filas: FilaTicket[] = [
    { k: 'Servicio', Icon: Sparkles, v: servicio?.nombre ?? null, clave: `s-${servicioIdx}`, falta: 'Elegí un servicio' },
    {
      k: rubro.modo === 'profesional' ? 'Con' : rotuloRecurso, Icon: rubro.modo === 'profesional' ? UserRound : MapPin, clave: `r-${recursoId}`, falta: 'Falta elegir',
      v: nombreRecurso ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {rubro.modo === 'profesional' && idxRecurso >= 0 && <img src={RETRATOS[idxRecurso % RETRATOS.length]} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />}
          {nombreRecurso}
        </span>
      ) : null,
    },
    { k: 'Cuándo', Icon: CalendarClock, v: cuando ? <span>{cuando.split(' · ')[0]} · <span className="tur-num">{cuando.split(' · ')[1]}</span></span> : null, clave: `c-${cuando}`, falta: 'Falta elegir día y hora' },
    { k: 'Duración', Icon: Clock, v: elegido ? duracionTxt(duracion) : null, clave: `d-${duracion}`, falta: 'Según lo que elijas' },
  ]
  const total = !elegido ? '—' : aPagar ? pesos(aPagar) : 'Sin cargo'
  const rebaja = descuento > 0 ? { pct: beneficios.bienvenida, monto: descuento, antes: precio } : undefined
  const donde = lugar === 'local' ? { Icon: MapPin, txt: [t.direccion, t.barrio].filter(Boolean).join(', ') }
    : { Icon: Home, txt: 'A domicilio' }
  const resumen = [servicio?.nombre, cuando].filter(Boolean).join(' · ') || falta[actual] || 'Tu reserva'

  return (
    <div ref={raiz} className="tur" data-oscuro={t.oscuro} data-mayus={!!t.mayus} data-simple={simple}>
      <Fondo t={t} />
      <div className="tur-cont tur-flujo">
        {simple
          ? <div className="tur-pasitos" aria-hidden>{pasos.map((p, i) => <i key={p} data-on={i <= paso} />)}</div>
          : <OrbitaPasos pasos={pasos.map(p => NOMBRE[p])} actual={paso} onIr={i => i < paso && ir(i)} />}
        <p className="tur-sr" aria-live="polite">{`Paso ${paso + 1} de ${pasos.length}: ${NOMBRE[actual]}`}</p>

        <div className="tur-grilla">
          <div key={actual} className="tur-paso" data-dir={dir}>
            <div className="tur-cabeza">
              {paso > 0 && (
                <button type="button" className="tur-volver" onClick={() => ir(paso - 1)} disabled={enviando}>
                  <ChevronLeft size={18} aria-hidden /> Volver
                </button>
              )}
              <span className="tur-rotulo">Paso <span className="tur-num">{paso + 1}</span> de <span className="tur-num">{pasos.length}</span>{simple ? ` · ${NOMBRE[actual]}` : ''}</span>
            </div>

            {actual === 'servicio' && (
              <Bloque refTitulo={titulo} titulo={rubro.familia === 'salud' ? '¿Qué turno necesitás?' : '¿Qué te querés hacer?'}
                sub={!rubro.sena ? 'Elegí un servicio. El precio que ves es el final.'
                  : api ? `Se pide una seña del ${rubro.sena}%, que coordinás con el negocio y se descuenta del total.${senaDevolucionTxt(api)}`
                    : `Para reservar se pide una seña del ${rubro.sena}%, que se descuenta del total.`}>
                <PasoServicio rubro={rubro} t={t} elegido={servicioIdx} onElegir={i => { setServicioIdx(i); setFecha(null); setHora(null); avanzar() }} />
              </Bloque>
            )}

            {actual === 'recurso' && (
              <Bloque refTitulo={titulo} titulo={rubro.modo === 'profesional' ? '¿Con quién te querés atender?' : '¿Dónde te atendés?'}
                sub="Si te da lo mismo, dejá la primera opción: es la que tiene más horarios.">
                <PasoRecurso rubro={rubro} t={t} recursos={recursos} duracion={duracion} elegido={recursoId} onElegir={id => { setRecursoId(id); setFecha(null); setHora(null) }} sinProximos={!!api} />
              </Bloque>
            )}

            {actual === 'fecha' && servicio && (
              <Bloque refTitulo={titulo} titulo="Elegí día y horario"
                sub={`${servicio.nombre} · ${duracionTxt(servicio.duracion)}${nombreRecurso ? ` · ${rubro.modo === 'profesional' && recurso ? `con ${recurso.nombre.split(' ')[0]}` : nombreRecurso.toLowerCase()}` : ''}${recurso?.horario ? `, que atiende ${tramosFrase(tramosDe(recurso.horario))}` : ''}`}>
                <PasoFecha horarios={agenda} duracion={servicio.duracion} fecha={fechaVista} hora={hora} onFecha={f => { setFecha(f); setHora(null) }}
                  onHora={(f, m) => { setFecha(f); setHora(m); setClave(api ? claveDeIntento() : null); setErrorApi(null); avanzar() }}
                  dias={diasApi} buscando={!!api && (!diasApi || (!!claveDia && !horariosDia[claveDia]))} />
              </Bloque>
            )}

            {actual === 'datos' && (
              <Bloque refTitulo={titulo} titulo="Tus datos" sub="Sin registrarte: con tu nombre y tu celular alcanza para confirmarte el turno.">
                <PasoDatos rubro={rubro} t={t} datos={datos} onDatos={setDatos} intento={intento} conSena={sena > 0} onEnviar={siguiente}
                  lugar={lugar} onLugar={setLugar} cuenta={cuenta} onCuenta={setCuenta} beneficios={beneficios} politica={politica} />
              </Bloque>
            )}

            {actual === 'pago' && (
              <Bloque refTitulo={titulo} titulo="Confirmá con la seña" sub="Tu turno queda reservado cuando se acredita el pago.">
                <PasoPago rubro={rubro} precio={aPagar} sena={sena} pagando={enviando} onPagar={siguiente} politica={politica} />
              </Bloque>
            )}
          </div>

          <aside className="tur-lateral">
            <Ticket t={t} filas={filas} total={total} precio={aPagar} sena={sena} rebaja={rebaja} donde={donde} />
            {/* En la seña el botón de pagar está en la tarjeta del pago: acá sería un duplicado */}
            {actual !== 'pago' && <div style={{ marginTop: 16 }}>{boton(false)}</div>}
            {/* Alto reservado: el aviso de lo que falta aparece y se va sin mover el botón */}
            <p id="tur-falta" style={{ minHeight: 22, margin: '10px 0 0', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
              {puede[actual] ? '' : falta[actual]}
            </p>
            {errorApi && <p role="alert" style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 13.5, color: 'var(--color-error)' }}>{errorApi}</p>}
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-muted)' }}>
              <ShieldCheck size={15} aria-hidden /> {cancelacionTxt(politica)}
            </p>
          </aside>
        </div>
      </div>

      {/* En la reserva simple elegir ya avanza: la hoja con el botón aparece recién para confirmar o pagar. */}
      {(!simple || actual === 'datos' || actual === 'pago') && <HojaResumen filas={filas} total={total} precio={aPagar} sena={sena} rebaja={rebaja} resumen={resumen} boton={boton(true)} />}
    </div>
  )
}
