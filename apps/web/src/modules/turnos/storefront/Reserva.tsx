// Reserva pública: el flujo que usa el cliente final para sacar un turno.
//   servicio → profesional / espacio / cancha → día y hora → datos → (seña) → listo
//   rubros con cupo: clase → datos → (seña) → listo, o lista de espera si está completa
// Se puede entrar con algo ya elegido desde la portada (?servicio=, ?con=,
// ?clase=) y el flujo arranca en el paso siguiente.
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
// un anillo. Todo es de ejemplo: no reserva nada ni llama a Mercado Pago.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import type { ParsedUrlQuery } from 'querystring'
import { ArrowRight, CalendarClock, ChevronLeft, Clock, Home, Lock, MapPin, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { pesos, duracionTxt, horaTxt, recursosDe, clasesDe, semanaDeRecurso, type RubroTurnos, type ClaseCupo } from '@/modules/turnos/datos'
import { cancelacionTxt, useNegocioDemo, type FormaSitio, type Modalidad } from '@/modules/turnos/demo/negocioDemo'
import { tramosDe, tramosFrase } from '@/modules/turnos/horario'
import SitioNegocio from './SitioNegocio'
import { RETRATOS, type TemaNegocio } from './tema'
import { EstiloReserva } from './reserva/estilo'
import { fechaDeClase, fechaLarga, primerLibre, HOY, type Fecha } from './reserva/calendario'
import { OrbitaPasos } from './reserva/OrbitaPasos'
import { PasoServicio, PasoRecurso, PasoClase } from './reserva/PasosEleccion'
import { PasoFecha } from './reserva/PasoFecha'
import { PasoDatos, PasoPago, validar, idCampo, DATOS_VACIOS, type CampoValidado, type Cuenta } from './reserva/PasoDatos'
import { Ticket, HojaResumen, type FilaTicket } from './reserva/Ticket'
import { Confirmacion, SinAgenda } from './reserva/Confirmacion'
import { BotonCarga, Bloque, Fondo } from './reserva/piezas'

export default function Reserva({ rubro }: { rubro: RubroTurnos }) {
  const router = useRouter()
  // ?forma=simple: se llegó desde la página simple del negocio y la reserva se abre con el encabezado mínimo.
  const forma: FormaSitio = router.query.forma === 'simple' ? 'simple' : 'web'
  return (
    <SitioNegocio rubro={rubro} pagina="reserva" forma={forma} ctaMovil={false}>
      {t => (
        <>
          <EstiloReserva />
          <Flujo rubro={rubro} t={t} simple={forma === 'simple'} />
        </>
      )}
    </SitioNegocio>
  )
}

type Paso = 'servicio' | 'recurso' | 'fecha' | 'clase' | 'datos' | 'pago'

/** Los rubros con cupo y seña (talleres) no tienen precio por clase en los datos de ejemplo:
 *  se toma el del servicio con ese nombre y, si es gratis, el más barato de los pagos. */
function precioDeClase(rubro: RubroTurnos, c: ClaseCupo) {
  const propio = rubro.servicios.find(s => s.nombre === c.nombre)?.precio ?? 0
  if (propio > 0 || rubro.sena === 0) return propio
  const pagos = rubro.servicios.filter(s => s.precio > 0).map(s => s.precio)
  return pagos.length ? Math.min(...pagos) : 0
}

/** Lo que ya viene elegido por la URL, y en qué paso conviene arrancar. */
function preseleccion(q: ParsedUrlQuery, rubro: RubroTurnos, recursos: { id: string }[], clases: ClaseCupo[]) {
  const out: { servicio: number | null; recursoId: string | null; claseId: string | null; saltear: Paso[] } = { servicio: null, recursoId: null, claseId: null, saltear: [] }
  if (rubro.modo === 'cupo') {
    if (typeof q.clase === 'string' && clases.some(c => c.id === q.clase)) { out.claseId = q.clase; out.saltear = ['clase'] }
    return out
  }
  if (typeof q.servicio === 'string' && rubro.servicios[+q.servicio]) { out.servicio = +q.servicio; out.saltear.push('servicio') }
  if (typeof q.con === 'string' && recursos.some(r => r.id === q.con)) {
    out.recursoId = q.con
    // Con quién ya está; si además vino el servicio, se va derecho a elegir día y hora.
    if (out.servicio !== null) out.saltear.push('recurso')
  }
  return out
}

function Flujo({ rubro, t, simple }: { rubro: RubroTurnos; t: TemaNegocio; simple: boolean }) {
  const router = useRouter()
  const vacio = router.query.estado === 'vacio'
  const recursos = useMemo(() => recursosDe(rubro), [rubro])
  const clases = useMemo(() => clasesDe(rubro), [rubro])
  const conCupo = rubro.modo === 'cupo'

  // La página se sirve con getServerSideProps: la query ya está en el primer render,
  // así que lo preseleccionado entra como estado inicial y no hace falta un effect.
  const [inicial] = useState(() => preseleccion(router.query, rubro, recursos, clases))
  const [servicioIdx, setServicioIdx] = useState<number | null>(inicial.servicio)
  // En la reserva simple no se elige con quién: salvo que venga pedido por la URL, es el primero libre.
  const [recursoId, setRecursoId] = useState<string | null>(inicial.recursoId ?? (simple ? 'cualquiera' : null))
  const [claseId, setClaseId] = useState<string | null>(inicial.claseId)
  const [fecha, setFecha] = useState<Fecha | null>(null)
  const [hora, setHora] = useState<number | null>(null)
  const [datos, setDatos] = useState(DATOS_VACIOS)
  // Dónde se hace: si el negocio atiende de una sola forma, no hay nada que elegir.
  const [lugarPedido, setLugar] = useState<Modalidad | null>(null)
  const lugar = lugarPedido && t.modalidades.includes(lugarPedido) ? lugarPedido : t.modalidades[0]
  // La cuenta es opcional: lo normal es reservar como invitado.
  const { demo } = useNegocioDemo()
  const beneficios = demo.cuentas
  const [cuentaPedida, setCuenta] = useState<Cuenta>('invitado')
  const cuenta: Cuenta = beneficios.activo ? cuentaPedida : 'invitado'
  const [intento, setIntento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  const servicio = servicioIdx === null ? null : rubro.servicios[servicioIdx]
  const clase = clases.find(c => c.id === claseId) ?? null
  const recurso = recursos.find(r => r.id === recursoId)
  const idxRecurso = recursos.findIndex(r => r.id === recursoId)
  // Los horarios que se ofrecen: los del negocio (su mañana y su tarde) y, si ya eligió con quién,
  // solo los días y las horas en que esa persona atiende.
  const agenda = useMemo(() => (recurso ? semanaDeRecurso(recurso, t.horarios) : t.horarios), [recurso, t.horarios])
  const elegido = conCupo ? !!clase : !!servicio
  const precio = conCupo ? (clase ? precioDeClase(rubro, clase) : 0) : servicio?.precio ?? 0
  const duracion = (conCupo ? clase?.duracion : servicio?.duracion) ?? 30
  const llena = !!clase && clase.anotados >= clase.cupo
  // El descuento de bienvenida es para el primer turno con cuenta: vale al crearla, no para quien ya la tenía.
  const descuento = cuenta === 'nueva' && beneficios.bienvenida > 0 && !llena ? Math.round((precio * beneficios.bienvenida) / 100) : 0
  const aPagar = precio - descuento
  // La seña se pide si el rubro la usa y hay algo que cobrar; en lista de espera no se cobra nada.
  const pideSena = rubro.sena > 0 && !llena && !(elegido && precio === 0)
  const sena = pideSena && aPagar ? Math.round((aPagar * rubro.sena) / 100) : 0

  const pasos: Paso[] = conCupo
    ? ['clase', 'datos', ...(pideSena ? ['pago' as Paso] : [])]
    : ['servicio', ...(simple ? [] : ['recurso' as Paso]), 'fecha', 'datos', ...(pideSena ? ['pago' as Paso] : [])]
  const rotuloRecurso = rubro.modo === 'profesional' ? rubro.profesional : rubro.modo === 'cancha' ? 'Cancha' : 'Espacio'
  const NOMBRE: Record<Paso, string> = { servicio: 'Servicio', recurso: rotuloRecurso, fecha: 'Día y hora', clase: 'Clase', datos: 'Tus datos', pago: 'Seña' }

  const [paso, setPaso] = useState(() => pasos.findIndex(p => !inicial.saltear.includes(p)))
  const [dir, setDir] = useState<'adelante' | 'atras'>('adelante')
  const actual = pasos[Math.min(paso, pasos.length - 1)]
  const ultimo = paso >= pasos.length - 1

  // Si todavía no eligió día, se muestra el primero con lugar para ese servicio (estado derivado).
  const fechaVista = fecha ?? primerLibre(agenda, duracion)?.f ?? HOY
  const fechaTurno = conCupo ? (clase ? fechaDeClase(clase.dia) : null) : hora !== null ? fechaVista : null
  const inicioTurno = conCupo ? clase?.inicio ?? null : hora
  const cuando = fechaTurno && inicioTurno !== null ? `${fechaLarga(fechaTurno)} · ${horaTxt(inicioTurno)}` : null
  const nombreRecurso = conCupo ? clase?.profe : recursoId === 'cualquiera' ? (rubro.modo === 'profesional' ? 'Cualquiera disponible' : 'El primero libre') : recurso?.nombre

  const errores = validar(datos, lugar === 'domicilio')
  const puede: Record<Paso, boolean> = { servicio: !!servicio, recurso: !!recursoId, fecha: hora !== null, clase: !!clase, datos: true, pago: true }

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

  // El "envío" simulado: mientras dura, el botón queda trabado con el giro.
  useEffect(() => {
    if (!enviando) return
    const x = setTimeout(() => { setEnviando(false); setListo(true) }, pideSena ? 1700 : 1100)
    return () => clearTimeout(x)
  }, [enviando, pideSena])

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
    else setEnviando(true)
  }

  // Reserva simple: elegir ya avanza, sin pasar por "Continuar".
  const avanzar = () => { if (simple && !ultimo) ir(paso + 1) }

  if (vacio) return <SinAgenda rubro={rubro} t={t} />

  if (listo && fechaTurno && inicioTurno !== null) {
    return (
      <Confirmacion rubro={rubro} t={t} servicio={(conCupo ? clase?.nombre : servicio?.nombre) ?? ''} fecha={fechaTurno} inicio={inicioTurno} duracion={duracion}
        recurso={nombreRecurso ? { rotulo: conCupo ? rubro.profesional : rubro.modo === 'profesional' ? 'Con' : rotuloRecurso, nombre: nombreRecurso, retrato: rubro.modo === 'profesional' && idxRecurso >= 0 ? RETRATOS[idxRecurso % RETRATOS.length] : undefined } : undefined}
        nombre={datos.nombre} espera={llena} precio={aPagar} sena={sena} recordatorio={datos.recordatorio}
        lugar={lugar} domicilio={datos.domicilio} cuenta={cuenta} beneficios={beneficios} />
    )
  }

  // ── Textos del botón principal ──
  const sigue = pasos[paso + 1]
  const textoBoton = actual === 'pago' ? `Pagar ${pesos(sena)}`
    : ultimo ? (llena ? 'Anotarme en la lista de espera' : 'Confirmar reserva')
    : sigue === 'pago' ? 'Ir a pagar la seña' : 'Continuar'
  const textoCorto = actual === 'pago' ? `Pagar ${pesos(sena)}` : ultimo ? (llena ? 'Anotarme' : 'Confirmar') : 'Continuar'
  const falta: Record<Paso, string> = {
    servicio: 'Elegí un servicio para seguir', recurso: rubro.modo === 'profesional' ? 'Elegí con quién para seguir' : 'Elegí dónde para seguir',
    fecha: 'Elegí un horario para seguir', clase: 'Elegí una clase para seguir', datos: '', pago: '',
  }
  const boton = (corto: boolean) => (
    <BotonCarga cargando={enviando} textoCargando={actual === 'pago' ? 'Procesando…' : 'Reservando…'} disabled={!puede[actual]} onClick={siguiente}
      className={corto ? '' : 'tur-btn--ancho'} style={corto ? { minHeight: 50, padding: '0 20px' } : undefined} aria-describedby={!corto && falta[actual] && !puede[actual] ? 'tur-falta' : undefined}>
      {actual === 'pago' && <Lock size={17} aria-hidden />} {corto ? textoCorto : textoBoton} {actual !== 'pago' && <ArrowRight size={18} className="tur-flecha" aria-hidden />}
    </BotonCarga>
  )

  // ── Ticket ──
  const filas: FilaTicket[] = [
    { k: conCupo ? 'Clase' : 'Servicio', Icon: Sparkles, v: (conCupo ? clase?.nombre : servicio?.nombre) ?? null, clave: `s-${claseId ?? servicioIdx}`, falta: conCupo ? 'Elegí una clase' : 'Elegí un servicio' },
    {
      k: conCupo ? rubro.profesional : rubro.modo === 'profesional' ? 'Con' : rotuloRecurso, Icon: rubro.modo === 'profesional' || conCupo ? UserRound : MapPin, clave: `r-${conCupo ? claseId : recursoId}`, falta: 'Falta elegir',
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
  const total = !elegido ? '—' : aPagar ? pesos(aPagar) : conCupo ? 'Incluido' : 'Sin cargo'
  const rebaja = descuento > 0 ? { pct: beneficios.bienvenida, monto: descuento, antes: precio } : undefined
  const donde = lugar === 'local' ? { Icon: MapPin, txt: [t.direccion, t.barrio].filter(Boolean).join(', ') }
    : { Icon: Home, txt: 'A domicilio' }
  const resumen = [conCupo ? clase?.nombre : servicio?.nombre, cuando].filter(Boolean).join(' · ') || falta[actual] || 'Tu reserva'

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
              <Bloque refTitulo={titulo} titulo={rubro.familia === 'salud' ? '¿Qué turno necesitás?' : rubro.modo === 'cancha' ? '¿Qué querés jugar?' : '¿Qué te querés hacer?'}
                sub={rubro.sena ? `Para reservar se pide una seña del ${rubro.sena}%, que se descuenta del total.` : 'Elegí un servicio. El precio que ves es el final.'}>
                <PasoServicio rubro={rubro} t={t} elegido={servicioIdx} onElegir={i => { setServicioIdx(i); setFecha(null); setHora(null); avanzar() }} />
              </Bloque>
            )}

            {actual === 'recurso' && (
              <Bloque refTitulo={titulo} titulo={rubro.modo === 'cancha' ? '¿En qué cancha?' : rubro.modo === 'profesional' ? '¿Con quién te querés atender?' : '¿Dónde te atendés?'}
                sub={rubro.modo === 'cancha' ? 'Elegí la cancha y después el horario.' : 'Si te da lo mismo, dejá la primera opción: es la que tiene más horarios.'}>
                <PasoRecurso rubro={rubro} t={t} recursos={recursos} duracion={duracion} elegido={recursoId} onElegir={id => { setRecursoId(id); setFecha(null); setHora(null) }} />
              </Bloque>
            )}

            {actual === 'fecha' && servicio && (
              <Bloque refTitulo={titulo} titulo="Elegí día y horario"
                sub={`${servicio.nombre} · ${duracionTxt(servicio.duracion)}${nombreRecurso ? ` · ${rubro.modo === 'profesional' && recurso ? `con ${recurso.nombre.split(' ')[0]}` : nombreRecurso.toLowerCase()}` : ''}${recurso?.horario ? `, que atiende ${tramosFrase(tramosDe(recurso.horario))}` : ''}`}>
                <PasoFecha horarios={agenda} duracion={servicio.duracion} fecha={fechaVista} hora={hora} onFecha={f => { setFecha(f); setHora(null) }} onHora={(f, m) => { setFecha(f); setHora(m); avanzar() }} />
              </Bloque>
            )}

            {actual === 'clase' && (
              <Bloque refTitulo={titulo} titulo="Reservá tu lugar" sub="Cada clase muestra cuántos lugares quedan. Si está completa, te podés anotar en la lista de espera.">
                <PasoClase clases={clases} elegida={clase} onElegir={c => { setClaseId(c.id); avanzar() }} />
              </Bloque>
            )}

            {actual === 'datos' && (
              <Bloque refTitulo={titulo} titulo="Tus datos" sub={llena ? 'Para avisarte si se libera un lugar.' : 'Sin registrarte: con tu nombre y tu celular alcanza para confirmarte el turno.'}>
                <PasoDatos rubro={rubro} t={t} datos={datos} onDatos={setDatos} intento={intento} conSena={sena > 0} onEnviar={siguiente}
                  lugar={lugar} onLugar={setLugar} cuenta={cuenta} onCuenta={setCuenta} beneficios={beneficios} politica={demo.politica} />
              </Bloque>
            )}

            {actual === 'pago' && (
              <Bloque refTitulo={titulo} titulo="Confirmá con la seña" sub="Tu turno queda reservado cuando se acredita el pago.">
                <PasoPago rubro={rubro} precio={aPagar} sena={sena} pagando={enviando} onPagar={siguiente} politica={demo.politica} />
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
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-muted)' }}>
              <ShieldCheck size={15} aria-hidden /> {cancelacionTxt(demo.politica)}
            </p>
          </aside>
        </div>
      </div>

      {/* En la reserva simple elegir ya avanza: la hoja con el botón aparece recién para confirmar o pagar. */}
      {(!simple || actual === 'datos' || actual === 'pago') && <HojaResumen filas={filas} total={total} precio={aPagar} sena={sena} rebaja={rebaja} resumen={resumen} boton={boton(true)} />}
    </div>
  )
}
