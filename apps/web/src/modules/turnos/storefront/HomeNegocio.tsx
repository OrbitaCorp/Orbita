// Portada pública de un negocio de turnos: lo primero que ve un cliente cuando
// entra al link del negocio (o desde Instagram/Google). Objetivo único: que
// reserve. Todo empuja a "Reservar", con el próximo horario libre a la vista.
//
// La portada es una plantilla con CUATRO composiciones de hero (cine, partido,
// impacto, collage) y tarjetas que cambian de forma según el tema: el orden de
// las secciones es el mismo —es lo que convierte—, pero una barbería, un
// consultorio, un box y un taller no comparten ni la entrada ni el trazo.
// El CSS de todas las secciones vive en estilos.ts.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Clock, MapPin, Navigation, MessageCircle, CalendarCheck, BellRing, ShieldCheck, Sparkles, Users, Phone, AtSign, MousePointerClick,
  ChevronLeft, ChevronRight, X, Check, Percent, Gift, Home, UserRoundCheck,
} from 'lucide-react'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { duracionTxt, recursosDe, clasesDe, horaTxt, type RubroTurnos, type ClaseCupo } from '@/modules/turnos/datos'
import { beneficiosTxt, useNegocioDemo, type BeneficioTxt } from '@/modules/turnos/demo/negocioDemo'
import SitioNegocio from './SitioNegocio'
import { CSS_PORTADA } from './estilos'
import { Abierto, AnillosTema, Encabezado, Foto, HOY, AHORA, HorasDia, Marca, OrbitaMini, Precio, ProximoLibre, Reveal, SemanaOrbita, TarjetaSellos, estadoLocal, proximoLibre, ruta, useDialogo } from './piezas'
import { useContacto } from './ContactoDemo'
import { linkMapa } from './reserva/acciones'
import { RETRATOS, altFoto, temaDe, type TemaNegocio } from './tema'

interface P { rubro: RubroTurnos; t: TemaNegocio }

const verbo = (r: RubroTurnos) => r.modo === 'cupo' ? 'Reservar mi lugar' : r.modo === 'cancha' ? 'Reservar cancha' : 'Reservar turno'

export default function HomeNegocio({ rubro }: { rubro: RubroTurnos }) {
  // El header arranca transparente solo en los heros con foto a sangre.
  const comp = temaDe(rubro).composicion
  return (
    <SitioNegocio rubro={rubro} pagina="inicio" sobreFoto={comp === 'cine' || comp === 'impacto'}>
      {t => (
        <>
          <style>{CSS_PORTADA}</style>
          {t.composicion === 'cine' && <HeroCine rubro={rubro} t={t} />}
          {t.composicion === 'impacto' && <HeroImpacto rubro={rubro} t={t} />}
          {t.composicion === 'partido' && <HeroPartido rubro={rubro} t={t} />}
          {t.composicion === 'collage' && <HeroCollage rubro={rubro} t={t} />}
          {t.estilo === 'box' && <Cinta rubro={rubro} t={t} />}
          <Confianza rubro={rubro} t={t} />
          <Disponibilidad rubro={rubro} />
          {rubro.modo === 'cupo' && <Clases rubro={rubro} />}
          {rubro.modo === 'cancha' && <Canchas rubro={rubro} />}
          {rubro.modo !== 'cupo' && <Servicios rubro={rubro} t={t} />}
          {rubro.modo === 'profesional' && <Equipo rubro={rubro} />}
          <Nosotros rubro={rubro} t={t} />
          <Galeria t={t} />
          <Beneficios rubro={rubro} t={t} />
          <ComoFunciona rubro={rubro} />
          <Ubicacion t={t} />
          <Cierre rubro={rubro} t={t} />
          <BotonFlotante rubro={rubro} />
        </>
      )}
    </SitioNegocio>
  )
}

// ─── Piezas del hero ─────────────────────────────────────────────────────────

/** Titular en dos líneas que suben desde su máscara; el remate va destacado. */
function Titular({ t }: { t: TemaNegocio }) {
  return (
    <h1 className="tu-h tu-h1">
      <span className="tu-linea"><span>{t.titular[0]}</span></span>{' '}
      <span className="tu-linea"><span style={{ animationDelay: '140ms' }}><em>{t.titular[1]}</em></span></span>
    </h1>
  )
}

function Bajada({ t }: { t: TemaNegocio }) {
  // La frase de la plantilla acompaña al negocio de ejemplo; a la descripción que escribió el dueño no se le agrega nada.
  return <p className="tup-hero-p tu-entra" style={{ ['--i' as string]: 3 }}><b>{t.nombre}.</b> {t.tagline.replace(/\.$/, '')}.{t.propio ? '' : ` ${t.sello}.`}</p>
}

function Botones({ rubro }: { rubro: RubroTurnos }) {
  return (
    <div className="tup-hero-ctas tu-entra" style={{ ['--i' as string]: 4 }}>
      <Link href={ruta('reserva', rubro.key)} className="tu-btn tu-btn--lg">{verbo(rubro)} <ArrowRight size={18} aria-hidden /></Link>
      <Link href={ruta('servicios', rubro.key)} className="tu-btn-sec tu-btn--lg">{rubro.modo === 'cupo' ? 'Ver actividades' : 'Servicios y precios'}</Link>
    </div>
  )
}

/**
 * Lo que más frena una reserva es tener que crear una cuenta: acá se dice de
 * entrada que no hace falta. Si se atiende por profesional, van las caras del equipo.
 */
function SinRegistro({ rubro }: { rubro: RubroTurnos }) {
  const porPersona = rubro.modo === 'profesional'
  return (
    <Link href={ruta('reserva', rubro.key)} className="tup-social tu-entra" style={{ ['--i' as string]: 5 }}>
      {porPersona ? (
        <span className="tup-caras" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- demo local */}
          {RETRATOS.slice(0, 3).map(r => <img key={r} src={r} alt="" />)}
        </span>
      ) : <span className="tup-social-ico" aria-hidden><UserRoundCheck size={19} /></span>}
      <span>
        <b>Reservá sin registrarte</b>
        <span className="tup-social-det">{porPersona ? 'Elegís con quién y a qué hora' : 'Solo tu nombre y tu celular'}</span>
      </span>
    </Link>
  )
}

/** "Barbería · Palermo, CABA". Un negocio sin local (solo a domicilio) no tiene barrio que mostrar. */
const lugar = (rubro: RubroTurnos, t: TemaNegocio) => [rubro.label, t.barrio].filter(Boolean).join(' · ')

/** Foto de fondo que se mueve más lento que el scroll (profundidad). */
function FotoParallax({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const mover = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (ref.current) ref.current.style.transform = `translate3d(0, ${Math.min(window.scrollY, 900) * 0.28}px, 0) scale(1.08)`
      })
    }
    mover()
    window.addEventListener('scroll', mover, { passive: true })
    return () => { window.removeEventListener('scroll', mover); cancelAnimationFrame(raf) }
  }, [])
  // eslint-disable-next-line @next/next/no-img-element -- demo local
  return <img ref={ref} src={src} alt={alt} fetchPriority="high" style={{ transform: 'scale(1.08)' }} />
}

// ─── Hero "cine": foto a sangre, serif enorme abajo a la izquierda ───────────

function HeroCine({ rubro, t }: P) {
  return (
    <section className="tup-hero tup-hero--cine">
      <div className="tup-hero-foto"><FotoParallax src={t.fotoHero} alt={altFoto(t.fotoHero)} /></div>
      <div aria-hidden className="tup-hero-velo" />
      <div className="tu-cont tup-hero-cuerpo">
        <div className="tup-hero-txt">
          <div className="tu-eyebrow tu-eyebrow--raya tu-entra">{lugar(rubro, t)}</div>
          <Titular t={t} />
          <Bajada t={t} />
          <Botones rubro={rubro} />
          <SinRegistro rubro={rubro} />
        </div>
        <div className="tup-hero-lado tu-entra" style={{ ['--i' as string]: 6 }}><ProximoLibre rubro={rubro} vidrio /></div>
      </div>
    </section>
  )
}

// ─── Hero "impacto": condensada gigante, remate en contorno, tablero de datos ─

function datosRapidos(rubro: RubroTurnos, t: TemaNegocio): { valor: string; rotulo: string }[] {
  const abre = { valor: String(t.horarios.filter(([, h]) => h).length), rotulo: 'días por semana' }
  if (rubro.modo === 'cupo') {
    const semana = clasesDe(rubro)
    const lugares = semana.filter(c => c.dia === HOY && c.inicio >= AHORA).reduce((a, c) => a + Math.max(0, c.cupo - c.anotados), 0)
    return [{ valor: String(semana.length), rotulo: 'clases por semana' }, { valor: String(lugares), rotulo: 'lugares libres hoy' }, abre]
  }
  const recursos = recursosDe(rubro)
  // Si el dueño dejó todo sin precio, no hay "desde" que mostrar.
  const precios = rubro.servicios.filter(s => s.precio > 0).map(s => s.precio)
  return [
    { valor: String(recursos.length), rotulo: rubro.modo === 'cancha' ? 'canchas' : rubro.modo === 'profesional' ? 'profesionales' : 'espacios' },
    precios.length
      ? { valor: `$${Math.round(Math.min(...precios) / 1000)}k`, rotulo: rubro.modo === 'cancha' ? 'la hora, desde' : 'desde' }
      : { valor: String(rubro.servicios.length), rotulo: 'servicios' },
    abre,
  ]
}

function HeroImpacto({ rubro, t }: P) {
  return (
    <section className="tup-hero tup-hero--impacto">
      <div className="tup-hero-foto"><FotoParallax src={t.fotoHero} alt={altFoto(t.fotoHero)} /></div>
      <div aria-hidden className="tup-hero-velo" />
      <div aria-hidden className="tup-hero-franjas" />
      <div className="tu-cont tup-hero-cuerpo">
        <div className="tup-hero-txt">
          <div className="tu-eyebrow tu-eyebrow--raya tu-entra">{lugar(rubro, t)}</div>
          <Titular t={t} />
          <Bajada t={t} />
          <Botones rubro={rubro} />
        </div>
        <div className="tup-hero-lado tu-entra" style={{ ['--i' as string]: 6 }}><ProximoLibre rubro={rubro} vidrio /></div>
      </div>
      <div className="tu-cont">
        <dl className="tup-tablero tu-entra" style={{ ['--i' as string]: 7 }}>
          {datosRapidos(rubro, t).map(d => (
            <div key={d.rotulo}>
              <dd className="tu-num">{d.valor}</dd>
              <dt className="tu-rotulo">{d.rotulo}</dt>
            </div>
          ))}
          <div className="tup-tablero-estado"><Abierto t={t} /></div>
        </dl>
      </div>
    </section>
  )
}

// ─── Hero "partido": texto a un lado, foto con forma y tarjetas flotando ─────

function HeroPartido({ rubro, t }: P) {
  return (
    <section className="tup-hero tup-hero--partido">
      <div aria-hidden className="tup-hero-luz" />
      <div className="tu-cont tup-hp">
        <div className="tup-hero-txt">
          <div className="tu-entra"><Abierto t={t} style={{ marginBottom: 22 }} /></div>
          <div className="tu-eyebrow tu-entra" style={{ ['--i' as string]: 1 }}>{lugar(rubro, t)}</div>
          <Titular t={t} />
          <Bajada t={t} />
          <Botones rubro={rubro} />
          <SinRegistro rubro={rubro} />
        </div>
        <div className="tup-hp-lado tu-entra" style={{ ['--i' as string]: 2 }}>
          <AnillosTema size={560} className="tup-hp-anillos" />
          <Foto src={t.fotoHero} alt={altFoto(t.fotoHero)} prioridad className="tup-hp-marco" />
          {t.galeria[0] && t.galeria[0] !== t.fotoHero && <Foto src={t.galeria[0]} alt="" className="tup-hp-mini" />}
          <div className="tup-hp-prox"><ProximoLibre rubro={rubro} /></div>
        </div>
      </div>
    </section>
  )
}

// ─── Hero "collage": titular centrado y tres fotos en arco, como un pizarrón ─

function HeroCollage({ rubro, t }: P) {
  const fotos = [t.galeria[0] ?? t.fotoHero, t.fotoHero, t.galeria[1] ?? t.fotoHero]
  return (
    <section className="tup-hero tup-hero--collage">
      <div aria-hidden className="tup-hero-luz" />
      <div className="tu-cont">
        <div className="tup-hero-txt">
          <div className="tu-entra"><Abierto t={t} style={{ marginBottom: 22 }} /></div>
          <div className="tu-eyebrow tu-entra" style={{ ['--i' as string]: 1 }}>{lugar(rubro, t)}</div>
          <Titular t={t} />
          <Bajada t={t} />
          <Botones rubro={rubro} />
          <SinRegistro rubro={rubro} />
        </div>
        <div className="tup-collage tu-entra" style={{ ['--i' as string]: 4 }}>
          {fotos.map((f, i) => <Foto key={i} src={f} alt={altFoto(f)} prioridad={i === 1} className={`tup-collage-f tup-collage-f${i}`} />)}
          <div className="tup-collage-prox"><ProximoLibre rubro={rubro} /></div>
        </div>
      </div>
    </section>
  )
}

/** Cinta infinita con los servicios: ritmo de marca debajo del hero del box. */
function Cinta({ rubro, t }: P) {
  const items = rubro.servicios.map(s => s.nombre)
  const fila = [...items, ...items, ...items]
  return (
    // El contenedor externo recorta la cinta inclinada: sin él, la rotación la
    // hace sobresalir por los costados y aparece scroll horizontal.
    <div aria-hidden className="tup-cinta-marco">
      <div className="tup-cinta-banda">
        <div className="tu-cinta" style={{ ['--tu-vel' as string]: '42s' }}>
          {[0, 1].map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {fila.map((x, i) => <span key={i} className="tup-cinta-item" style={{ fontFamily: t.fh }}>{x}<Sparkles size={18} style={{ opacity: .7 }} /></span>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Franja de confianza ─────────────────────────────────────────────────────

function Confianza({ rubro, t }: P) {
  const e = estadoLocal(t)
  const conLocal = t.modalidades.includes('local')
  return (
    <Reveal className="tu-cont tu-sec tu-sec--corta">
      <ul className="tup-confianza">
        <li>
          <Link href={ruta('reserva', rubro.key)} className="tup-dato">
            <span className="tup-dato-ico"><MousePointerClick size={18} aria-hidden /></span>
            <span><span className="tup-dato-tit">Reserva online</span><span className="tup-dato-txt">Sin registrarte, en un minuto</span></span>
          </Link>
        </li>
        <li>
          <a href="#ubicacion" className="tup-dato">
            <span className="tup-dato-ico"><Clock size={18} aria-hidden /></span>
            <span><span className="tup-dato-tit" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className={e.abierto ? 'tu-vivo' : 'tu-vivo tu-vivo--off'} aria-hidden />{e.abierto ? 'Abierto ahora' : 'Cerrado ahora'}</span><span className="tup-dato-txt">{e.abierto ? <>Hoy hasta las <span className="tu-num">{e.cierra}</span></> : e.abre ? <>Hoy abre a las <span className="tu-num">{e.abre}</span></> : 'Mirá los horarios'}</span></span>
          </a>
        </li>
        <li>
          <a href="#ubicacion" className="tup-dato">
            {conLocal ? <>
              <span className="tup-dato-ico"><MapPin size={18} aria-hidden /></span>
              <span><span className="tup-dato-tit">{t.direccion}</span><span className="tup-dato-txt">{t.barrio}</span></span>
            </> : <>
              <span className="tup-dato-ico"><Home size={18} aria-hidden /></span>
              <span><span className="tup-dato-tit">A domicilio</span><span className="tup-dato-txt">{t.zonas}</span></span>
            </>}
          </a>
        </li>
        <li>
          <div className="tup-dato">
            <span className="tup-dato-ico">{rubro.sena ? <ShieldCheck size={18} aria-hidden /> : <BellRing size={18} aria-hidden />}</span>
            {rubro.sena
              ? <span><span className="tup-dato-tit">Seña del <span className="tu-num">{rubro.sena}%</span></span><span className="tup-dato-txt">Se descuenta del total</span></span>
              : <span><span className="tup-dato-tit">Recordatorio</span><span className="tup-dato-txt">Por WhatsApp, el día antes</span></span>}
          </div>
        </li>
      </ul>
    </Reveal>
  )
}

// ─── La semana en órbita ─────────────────────────────────────────────────────

function Disponibilidad({ rubro }: { rubro: RubroTurnos }) {
  return (
    <section className="tu-cont tu-sec" aria-labelledby="tup-disp">
      <Reveal>
        <div className="tu-card tup-disp">
          <div className="tup-disp-txt">
            <div className="tu-eyebrow tu-eyebrow--raya">Disponibilidad</div>
            <h2 id="tup-disp" className="tu-h tu-h2">La semana, <em>de un vistazo</em></h2>
            <p className="tu-bajada">Cada tramo del anillo es un día: cuanto más color, más lugar queda. Elegí el que te sirva y seguí con la reserva.</p>
          </div>
          <SemanaOrbita rubro={rubro} />
        </div>
      </Reveal>
    </section>
  )
}

// ─── Servicios ───────────────────────────────────────────────────────────────

function Servicios({ rubro, t }: P) {
  const carta = t.tarjeta === 'filete'
  const conFoto = t.tarjeta === 'papel'
  const lista = rubro.servicios.slice(0, 6)
  return (
    <section className="tu-cont tu-sec">
      <Reveal>
        <Encabezado eyebrow="Servicios" titulo={carta ? <>Nuestra <em>carta</em></> : rubro.modo === 'cancha' ? <>Elegí <em>tu deporte</em></> : <>Qué podés <em>reservar</em></>} accion={{ label: 'Ver todos con detalle', href: ruta('servicios', rubro.key) }} />
      </Reveal>
      {carta ? (
        <Reveal delay={80}><Carta rubro={rubro} t={t} /></Reveal>
      ) : (
        <div className="tu-grilla tu-grilla--sv" data-n={lista.length}>
          {lista.map((s, i) => (
            <Reveal key={s.nombre} delay={i * 60}>
              <Link href={ruta('reserva', rubro.key, { servicio: i })} className="tu-card tu-card-h tu-spot tup-sv" data-foto={conFoto}>
                {conFoto
                  ? <Foto src={t.galeria[i % t.galeria.length]} alt="" className="tup-sv-foto" />
                  : <span className="tup-sv-cab"><span className="tup-sv-ico"><rubro.Icon size={22} strokeWidth={1.7} aria-hidden /></span><span className="tu-num tup-sv-n" aria-hidden>{String(i + 1).padStart(2, '0')}</span></span>}
                <span className="tup-sv-cuerpo">
                  <span className="tu-h tup-sv-nombre">{s.nombre}</span>
                  <span className="tup-sv-dur"><Clock size={14} aria-hidden /> <span className="tu-num">{duracionTxt(s.duracion)}</span></span>
                  <span className="tup-sv-pie">
                    <Precio valor={s.precio} size={20} />
                    <span className="tu-ir" aria-hidden><ArrowRight size={17} /></span>
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}

/** Carta de precios: al pasar el mouse por un servicio, su foto aparece siguiendo al cursor. */
function Carta({ rubro, t }: P) {
  const [activo, setActivo] = useState<number | null>(null)
  const foto = useRef<HTMLDivElement>(null)
  const mover = (e: React.MouseEvent) => {
    if (foto.current) foto.current.style.transform = `translate3d(${e.clientX + 24}px, ${e.clientY - 110}px, 0) rotate(-3deg)`
  }
  return (
    <div className="tup-carta-lista" onMouseMove={mover} onMouseLeave={() => setActivo(null)}>
      {rubro.servicios.map((s, i) => (
        <Link key={s.nombre} href={ruta('reserva', rubro.key, { servicio: i })} className="tup-carta" onMouseEnter={() => setActivo(i)}>
          <span className="tup-carta-fila">
            <span className="tu-num tup-carta-n" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            <span className="tu-h tup-carta-nombre">{s.nombre}</span>
            <span aria-hidden className="tup-carta-puntos" />
            <Precio valor={s.precio} size={18} color="var(--color-primary)" />
          </span>
          <span className="tup-carta-det">
            <Clock size={13} aria-hidden /> <span className="tu-num">{duracionTxt(s.duracion)}</span>
            <span className="tup-carta-cta">Reservar <ArrowRight size={14} aria-hidden /></span>
          </span>
        </Link>
      ))}
      <div ref={foto} aria-hidden className="tup-carta-foto" style={{ opacity: activo === null ? 0 : 1 }}>
        {t.galeria.map((f, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- demo local
          <img key={f + i} src={f} alt="" style={{ opacity: activo !== null && activo % t.galeria.length === i ? 1 : 0 }} />
        ))}
      </div>
    </div>
  )
}

// ─── Clases con cupo ─────────────────────────────────────────────────────────

const DIA_CLASE = ['Lun 28', 'Mar 29', 'Mié 30', 'Jue 1', 'Vie 2', 'Hoy']

function estadoCupo(c: ClaseCupo) {
  const libres = c.cupo - c.anotados
  if (libres <= 0) return { tono: 'lleno', texto: 'Lista de espera', libres: 0 }
  if (libres <= 3) return { tono: 'aviso', texto: libres === 1 ? 'Último lugar' : `Últimos ${libres} lugares`, libres }
  return { tono: 'ok', texto: `${libres} lugares libres`, libres }
}

function Clases({ rubro }: { rubro: RubroTurnos }) {
  // Lo que queda de hoy y, para completar, las primeras del lunes.
  const todas = clasesDe(rubro)
  const clases = [...todas.filter(c => c.dia === HOY && c.inicio >= AHORA), ...todas.filter(c => c.dia === 0)].sort((a, b) => (a.dia === HOY ? -1 : 0) - (b.dia === HOY ? -1 : 0) || a.inicio - b.inicio).slice(0, 6)
  return (
    <section className="tu-cont tu-sec">
      <Reveal><Encabezado eyebrow="Próximas clases" titulo={<>Reservá <em>tu lugar</em></>} bajada="El anillo muestra cuánto se llenó cada clase. Si está completa, te anotás en la lista de espera." accion={{ label: 'Ver la semana', href: ruta('reserva', rubro.key) }} /></Reveal>
      <div className="tu-grilla tu-grilla--cl">
        {clases.map((c, i) => {
          const e = estadoCupo(c)
          return (
            <Reveal key={c.id} delay={i * 50}>
              <Link href={ruta('reserva', rubro.key, { clase: c.id })} className="tu-card tu-card-h tu-spot tup-clase">
                <span className="tup-clase-cab">
                  <span>
                    <span className="tu-rotulo">{DIA_CLASE[c.dia]}</span>
                    <span className="tu-num tup-clase-hora">{horaTxt(c.inicio)}</span>
                  </span>
                  <Anillo valor={c.anotados / c.cupo} size={62} grosor={6} color={`var(--tu-${e.tono})`} label={`${c.anotados} de ${c.cupo} lugares ocupados`}>
                    <span style={{ fontSize: 13 }}>{c.anotados}/{c.cupo}</span>
                  </Anillo>
                </span>
                <span className="tu-h tup-clase-nombre">{c.nombre}</span>
                <span className="tup-clase-det"><Users size={14} aria-hidden /> {c.profe} · {c.sala} · <span className="tu-num">{duracionTxt(c.duracion)}</span></span>
                <span className="tup-clase-pie">
                  <span className="tu-estado" data-tono={e.tono}>{e.texto}</span>
                  <span className="tu-ir" aria-hidden><ArrowRight size={17} /></span>
                </span>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

// ─── Canchas ─────────────────────────────────────────────────────────────────

/** Cancha vista desde arriba, dibujada con el color del negocio. Cada deporte con sus líneas:
 *  pádel y tenis llevan red y cuadros de saque, no áreas ni círculo central. */
function DibujoCancha({ deporte }: { deporte: string }) {
  const d = deporte.toLowerCase()
  const tenis = d.includes('tenis')
  if (tenis || d.includes('pádel') || d.includes('padel')) {
    // Pádel: saque a 3 m del fondo. Tenis: pasillos de dobles y saque más cerca de la red.
    const [arriba, abajo] = tenis ? [30, 140] : [8, 162]
    const [saqueIzq, saqueDer] = tenis ? [90, 230] : [54, 266]
    return (
      <svg aria-hidden viewBox="0 0 320 170" className="tup-cancha-svg">
        <rect x="8" y="8" width="304" height="154" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        {tenis && <>
          <line x1="8" y1={arriba} x2="312" y2={arriba} stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1={abajo} x2="312" y2={abajo} stroke="currentColor" strokeWidth="2" />
        </>}
        <line x1={saqueIzq} y1={arriba} x2={saqueIzq} y2={abajo} stroke="currentColor" strokeWidth="2" />
        <line x1={saqueDer} y1={arriba} x2={saqueDer} y2={abajo} stroke="currentColor" strokeWidth="2" />
        <line x1={saqueIzq} y1="85" x2={saqueDer} y2="85" stroke="currentColor" strokeWidth="2" />
        {/* La red, con sus dos postes. */}
        <line x1="160" y1="4" x2="160" y2="166" stroke="currentColor" strokeWidth="3" strokeDasharray="2 4" />
        <circle cx="160" cy="4" r="3" fill="currentColor" />
        <circle cx="160" cy="166" r="3" fill="currentColor" />
        {/* La pelota cruza la red dando la vuelta: la órbita, en la cancha. */}
        <g className="tu-orbita-gira" style={{ transformOrigin: '160px 85px', animationDuration: '9s' }}><circle cx="160" cy="50" r="4" fill="currentColor" /></g>
      </svg>
    )
  }
  return (
    <svg aria-hidden viewBox="0 0 320 170" className="tup-cancha-svg">
      <rect x="8" y="8" width="304" height="154" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="160" y1="8" x2="160" y2="162" stroke="currentColor" strokeWidth="2" />
      <circle cx="160" cy="85" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="160" cy="85" r="3" fill="currentColor" />
      <rect x="8" y="45" width="46" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="266" y="45" width="46" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="65" width="18" height="40" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="294" y="65" width="18" height="40" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* La pelota da la vuelta al círculo central: la órbita, en la cancha. */}
      <g className="tu-orbita-gira" style={{ transformOrigin: '160px 85px', animationDuration: '9s' }}><circle cx="160" cy="55" r="5" fill="currentColor" /></g>
    </svg>
  )
}

function Canchas({ rubro }: { rubro: RubroTurnos }) {
  const canchas = recursosDe(rubro)
  const horas = [[16 * 60, 19 * 60, 21 * 60], [15 * 60 + 30, 17 * 60, 20 * 60], [18 * 60, 20 * 60, 22 * 60]]
  return (
    <section className="tu-cont tu-sec">
      <Reveal><Encabezado eyebrow="Canchas" titulo={<>Libres <em>hoy</em></>} bajada={rubro.sena ? `Reservás con una seña del ${rubro.sena}% y el resto lo pagás en el lugar.` : undefined} accion={{ label: 'Ver todos los horarios', href: ruta('reserva', rubro.key) }} /></Reveal>
      <div className="tu-grilla tu-grilla--sv" data-n={canchas.length}>
        {canchas.map((c, i) => {
          const s = rubro.servicios[i % rubro.servicios.length]
          return (
            <Reveal key={c.id} delay={i * 70}>
              <div className="tu-card tu-card-h tu-spot tup-cancha">
                <div className="tup-cancha-dib"><DibujoCancha deporte={s.nombre} /></div>
                <div className="tup-cancha-cuerpo">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span className="tu-h tup-sv-nombre">{c.nombre}</span>
                    <span className="tu-rotulo">{s.nombre}</span>
                  </div>
                  <div className="tup-sv-dur"><Precio valor={s.precio} size={17} /> <span>· <span className="tu-num">{duracionTxt(s.duracion)}</span></span></div>
                  <div className="tu-horas">
                    {horas[i % horas.length].map(h => <Link key={h} href={ruta('reserva', rubro.key, { con: c.id })} className="tu-hora" aria-label={`Reservar ${c.nombre} hoy a las ${horaTxt(h)}`}>{horaTxt(h)}</Link>)}
                    <Link href={ruta('reserva', rubro.key, { con: c.id })} className="tu-hora tu-hora--mas" aria-label={`Ver más horarios de ${c.nombre}`}><ArrowRight size={15} aria-hidden /></Link>
                  </div>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

// ─── Equipo ───────────────────────────────────────────────────────────────────

function Equipo({ rubro }: { rubro: RubroTurnos }) {
  const equipo = recursosDe(rubro)
  const esp = rubro.servicios.map(s => s.nombre)
  const horas = [[15 * 60 + 30, 17 * 60, 18 * 60 + 30], [17 * 60, 17 * 60 + 30, 18 * 60], [10 * 60, 11 * 60 + 30, 14 * 60]]
  return (
    <section id="equipo" className="tu-cont tu-sec tu-ancla">
      <Reveal><Encabezado eyebrow="El equipo" titulo={<>Elegí <em>con quién</em></>} bajada={`Cada ${rubro.profesional.toLowerCase()} tiene su propia agenda: tocá un horario y seguís la reserva con esa persona.`} /></Reveal>
      <div className="tu-grilla tu-grilla--eq">
        {equipo.map((r, i) => {
          const manana = i % 3 === 2
          return (
            <Reveal key={r.id} delay={i * 90}>
              <article className="tu-card tu-card-h tu-spot tup-pro">
                <Foto src={RETRATOS[i % RETRATOS.length]} alt={`${r.nombre}, ${r.rol.toLowerCase()}`} className="tup-pro-foto">
                  <span aria-hidden className="tup-pro-velo" />
                  <span className="tup-pro-nombre">
                    <span className="tu-h">{r.nombre}</span>
                    <span>{r.rol} · {esp[i % esp.length]}</span>
                  </span>
                </Foto>
                <div className="tup-pro-pie">
                  <div className="tu-rotulo" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="tu-vivo" aria-hidden /> Libre {manana ? 'el lunes' : 'hoy'}</div>
                  <div className="tu-horas">
                    {horas[i % 3].map(h => <Link key={h} href={ruta('reserva', rubro.key, { con: r.id })} className="tu-hora" aria-label={`Reservar con ${r.nombre} a las ${horaTxt(h)}`}>{horaTxt(h)}</Link>)}
                    <Link href={ruta('reserva', rubro.key, { con: r.id })} aria-label={`Ver más horarios de ${r.nombre}`} className="tu-hora tu-hora--mas"><ArrowRight size={15} aria-hidden /></Link>
                  </div>
                </div>
              </article>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

// ─── Galería editorial ───────────────────────────────────────────────────────

function Galeria({ t }: { t: TemaNegocio }) {
  const fotos = t.galeria.slice(0, 5)
  const [abierta, setAbierta] = useState<number | null>(null)
  return (
    <section className="tu-cont tu-sec" aria-label={`Fotos de ${t.nombre}`}>
      <Reveal><Encabezado eyebrow="El lugar" titulo={<>Pasá a <em>conocernos</em></>} /></Reveal>
      <Reveal delay={80}>
        <div className="tup-gal" data-n={fotos.length}>
          {fotos.map((f, i) => (
            <figure key={f + i} className="tup-gal-item">
              <Foto src={f} alt={altFoto(f)} />
              <figcaption><span className="tu-num">{String(i + 1).padStart(2, '0')}</span> {altFoto(f)}</figcaption>
              <button type="button" className="tup-gal-abrir" onClick={() => setAbierta(i)} aria-label={`Ver la foto en grande: ${altFoto(f)}`} />
            </figure>
          ))}
        </div>
      </Reveal>
      {/* Fuera de Reveal: el velo es fixed y Reveal anima con transform. */}
      {abierta !== null && <Visor fotos={fotos} inicial={abierta} onCerrar={() => setAbierta(null)} />}
    </section>
  )
}

/** La foto en grande: se pasa con los botones o con ← →; Escape o un toque afuera la cierran. */
function Visor({ fotos, inicial, onCerrar }: { fotos: string[]; inicial: number; onCerrar: () => void }) {
  const [i, setI] = useState(inicial)
  const { caja, teclas } = useDialogo<HTMLDivElement>(onCerrar)
  const varias = fotos.length > 1
  const pasar = (d: 1 | -1) => setI(k => (k + d + fotos.length) % fotos.length)
  const flechas = (e: React.KeyboardEvent) => {
    if (varias && e.key === 'ArrowRight') pasar(1)
    else if (varias && e.key === 'ArrowLeft') pasar(-1)
    else teclas(e)
  }
  return (
    <div className="tu-velo tup-velo-foto" onClick={onCerrar} onKeyDown={flechas}>
      <div ref={caja} role="dialog" aria-modal="true" aria-label="Fotos del lugar" tabIndex={-1} className="tup-visor" onClick={e => e.stopPropagation()}>
        <div className="tup-visor-cab">
          <span className="tu-num tup-visor-cuenta" aria-live="polite">{String(i + 1).padStart(2, '0')} / {String(fotos.length).padStart(2, '0')}</span>
          <button type="button" className="tup-visor-btn" onClick={onCerrar} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </div>
        <div className="tup-visor-foto" onClick={onCerrar}>
          {/* eslint-disable-next-line @next/next/no-img-element -- demo local */}
          <img key={fotos[i]} src={fotos[i]} alt={altFoto(fotos[i])} className="tu-entra" onClick={e => e.stopPropagation()} />
        </div>
        <div className="tup-visor-pie">
          {varias && <button type="button" className="tup-visor-btn" onClick={() => pasar(-1)} aria-label="Foto anterior"><ChevronLeft size={20} aria-hidden /></button>}
          <span className="tup-visor-txt">{altFoto(fotos[i])}</span>
          {varias && <button type="button" className="tup-visor-btn" onClick={() => pasar(1)} aria-label="Foto siguiente"><ChevronRight size={20} aria-hidden /></button>}
        </div>
      </div>
    </div>
  )
}

// ─── Nosotros ────────────────────────────────────────────────────────────────

/** Quiénes son y cómo trabajan, en palabras del negocio. El texto lo escribe el dueño en Configuración. */
function Nosotros({ rubro, t }: P) {
  const n = t.nosotros
  const recursos = rubro.modo === 'cupo' ? 0 : recursosDe(rubro).length
  const datos = [
    ...(n.desde ? [{ valor: String(n.desde), rotulo: 'abrimos en' }] : []),
    rubro.modo === 'cupo'
      ? { valor: String(clasesDe(rubro).length), rotulo: 'clases por semana' }
      : { valor: String(recursos), rotulo: rubro.modo === 'cancha' ? 'canchas' : rubro.modo === 'profesional' ? (recursos === 1 ? 'profesional' : 'profesionales') : 'espacios' },
    { valor: String(t.horarios.filter(([, h]) => h).length), rotulo: 'días por semana' },
  ]
  return (
    <section id="nosotros" className="tu-cont tu-sec tu-ancla" aria-labelledby="tup-nos">
      <div className="tup-nos">
        <Reveal className="tup-nos-cab">
          <div className="tu-eyebrow tu-eyebrow--raya">Nosotros</div>
          <h2 id="tup-nos" className="tu-h tu-h2">{n.titulo[0]} <em>{n.titulo[1]}</em></h2>
          <dl className="tup-nos-datos">
            {datos.map(d => (
              <div key={d.rotulo}>
                <dt className="tu-rotulo">{d.rotulo}</dt>
                <dd className="tu-num">{d.valor}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal delay={80}>
          <div className="tu-card tup-nos-txt">
            <AnillosTema size={380} className="tup-nos-anillos" />
            {n.parrafos.map((p, i) => <p key={i} className={i === 0 ? 'tup-nos-lead' : undefined}>{p}</p>)}
            <ul className="tup-nos-valores">
              {n.valores.map(v => <li key={v}><span className="tup-nos-tilde" aria-hidden><Check size={14} strokeWidth={2.6} /></span>{v}</li>)}
            </ul>
            <div className="tup-nos-firma">
              <Marca t={t} />
              <span><b>El equipo de {t.nombre}</b><span>{lugar(rubro, t)}</span></span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Beneficios de la cuenta (opcional) ──────────────────────────────────────

const ICONO_BENEFICIO: Record<BeneficioTxt['id'], typeof Gift> = { bienvenida: Percent, sellos: Gift, promos: BellRing }

/**
 * Reservar no pide cuenta. Esta sección cuenta qué gana quien igual la crea:
 * lo define el dueño en Configuración → Reglas de reserva. Si no ofrece cuenta,
 * la sección no existe.
 */
function Beneficios({ rubro, t }: P) {
  const { demo } = useNegocioDemo()
  const lista = beneficiosTxt(demo.cuentas, rubro)
  if (!lista.length) return null
  return (
    <section id="beneficios" className="tu-cont tu-sec tu-ancla" aria-labelledby="tup-ben">
      <Reveal>
        <div className="tu-card tup-ben">
          <div className="tup-ben-txt">
            <div className="tu-eyebrow tu-eyebrow--raya">Tu cuenta, si querés</div>
            <h2 id="tup-ben" className="tu-h tu-h2">Reservá sin registrarte. <em>Con cuenta, sumás.</em></h2>
            <p className="tu-bajada">Para reservar alcanza con tu nombre y tu celular. Si además creás tu cuenta —es gratis y lleva un minuto—, {t.nombre} te lo reconoce cada vez que volvés.</p>
            <div className="tup-ben-ctas">
              <Link href={ruta('reserva', rubro.key)} className="tu-btn">{verbo(rubro)} <ArrowRight size={17} aria-hidden /></Link>
              <Link href={ruta('mis-turnos', rubro.key)} className="tu-btn-sec">Crear mi cuenta</Link>
            </div>
          </div>
          <div className="tup-ben-lado">
            {demo.cuentas.sellos > 0 && <TarjetaSellos total={demo.cuentas.sellos} hechos={2} nombre={t.nombre} />}
            <ul className="tup-ben-lista">
              {lista.map(b => {
                const Icono = ICONO_BENEFICIO[b.id]
                return (
                  <li key={b.id}>
                    <span className="tup-ben-ico" aria-hidden><Icono size={18} /></span>
                    <span><b>{b.titulo}</b><span>{b.texto}</span></span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

// ─── Cómo funciona ────────────────────────────────────────────────────────────

function ComoFunciona({ rubro }: { rubro: RubroTurnos }) {
  const pasos = [
    { Icon: MousePointerClick, titulo: rubro.modo === 'cupo' ? 'Elegís tu clase' : rubro.modo === 'cancha' ? 'Elegís la cancha' : 'Elegís el servicio', texto: rubro.modo === 'profesional' ? 'Y con quién te querés atender. Ves precio y duración antes de reservar.' : 'Ves precio, duración y lugares disponibles antes de reservar.' },
    { Icon: CalendarCheck, titulo: 'Reservás el horario', texto: rubro.sena ? `Confirmás con una seña del ${rubro.sena}% que se descuenta del total.` : 'La confirmación es inmediata, sin llamadas ni esperas.' },
    { Icon: BellRing, titulo: 'Te recordamos', texto: 'Un día antes te llega un WhatsApp. Si no podés ir, reprogramás desde el mismo link.' },
  ]
  return (
    <section className="tu-cont tu-sec">
      <Reveal><Encabezado centro eyebrow="Así de simple" titulo={<>Tu reserva, <em>en tres pasos</em></>} /></Reveal>
      <Reveal delay={80}>
        <ol className="tup-pasos">
          {pasos.map((p, i) => (
            <li key={p.titulo} className="tup-paso">
              <span className="tup-paso-nodo"><p.Icon size={22} strokeWidth={1.7} aria-hidden /><span className="tu-num tup-paso-n">{i + 1}</span></span>
              <span className="tu-h tup-paso-tit">{p.titulo}</span>
              <span className="tup-paso-txt">{p.texto}</span>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  )
}

// ─── Ubicación y horarios ────────────────────────────────────────────────────

function Mapa({ t }: { t: TemaNegocio }) {
  // Mapa ilustrado (sin servicio externo): calles en grilla con el pin del local
  // y, alrededor, las ondas de la órbita.
  const linea = t.oscuro ? 'rgba(255,255,255,.07)' : `color-mix(in srgb, ${t.c.text} 8%, transparent)`
  const calle = t.oscuro ? 'rgba(255,255,255,.13)' : t.c.bg
  return (
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Mapa ilustrado: ${t.direccion}, ${t.barrio}`} className="tup-mapa">
      {Array.from({ length: 16 }, (_, i) => <line key={`v${i}`} x1={i * 40 + 10} y1="0" x2={i * 40 - 30} y2="400" stroke={linea} strokeWidth="1" />)}
      {Array.from({ length: 11 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 40} x2="600" y2={i * 40 + 12} stroke={linea} strokeWidth="1" />)}
      <path d="M-10 250 L620 180" stroke={calle} strokeWidth="18" />
      <path d="M180 -10 L260 420" stroke={calle} strokeWidth="14" />
      <path d="M430 -10 L380 420" stroke={calle} strokeWidth="10" />
      <rect x="40" y="40" width="110" height="80" rx="10" fill={t.e.ok} opacity=".14" />
      <g className="tu-orbita-gira" style={{ transformOrigin: '300px 205px', animationDuration: '16s' }}><circle cx="300" cy="113" r="4" fill={t.c.primary} /></g>
      <g transform="translate(300 205)">
        <circle r="92" fill="none" stroke={t.c.primary} strokeOpacity=".3" strokeDasharray="2 7" strokeLinecap="round" />
        <circle r="58" fill="none" stroke={t.c.primary} strokeOpacity=".4" />
        <circle r="30" fill={t.c.primary} opacity=".16" />
        <path d="M0 -34 C 18 -34 26 -20 26 -10 C 26 8 0 30 0 30 C 0 30 -26 8 -26 -10 C -26 -20 -18 -34 0 -34 Z" fill={t.c.primary} />
        <circle cy="-11" r="9" fill={t.c.onPrimary} />
      </g>
    </svg>
  )
}

function Ubicacion({ t }: { t: TemaNegocio }) {
  const contactar = useContacto()
  const conLocal = t.modalidades.includes('local')
  const domicilio = t.modalidades.includes('domicilio')
  // La otra forma de atender, además del local (o la única, si no tiene local).
  const modos = domicilio ? [{ Icon: Home, titulo: 'A domicilio', texto: `Vamos a ${t.zonas}. Al reservar nos dejás tu dirección.` }] : []
  return (
    <section id="ubicacion" className="tu-cont tu-sec tu-ancla">
      <Reveal>
        <Encabezado
          eyebrow={conLocal ? 'Ubicación' : 'Dónde atendemos'}
          titulo={conLocal ? <>Cómo <em>llegar</em></> : <>Vamos <em>a tu casa</em></>}
        />
      </Reveal>
      <Reveal delay={80}>
        <div className="tup-ub">
          {conLocal
            ? <a href={linkMapa(t.direccion, t.barrio)} target="_blank" rel="noopener noreferrer" className="tu-card tup-ub-mapa" aria-label={`Abrir ${[t.direccion, t.barrio].filter(Boolean).join(', ')} en Google Maps (se abre en otra pestaña)`}><Mapa t={t} /></a>
            : (
              <div className="tu-card tup-ub-modos">
                <AnillosTema size={460} className="tup-ub-anillos" />
                <ul>
                  {modos.map(m => (
                    <li key={m.titulo}>
                      <span className="tup-dato-ico" aria-hidden><m.Icon size={20} /></span>
                      <span><span className="tu-h tup-ub-modo-tit">{m.titulo}</span><span className="tup-ub-modo-txt">{m.texto}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          <div className="tu-card tup-ub-datos">
            <Abierto t={t} />
            {conLocal
              ? <><div className="tu-h tup-ub-dir">{t.direccion}</div><div className="tup-ub-barrio">{t.barrio}</div></>
              : <><div className="tu-h tup-ub-dir">A domicilio</div><div className="tup-ub-barrio">{t.zonas}</div></>}
            {conLocal && modos.length > 0 && (
              <ul className="tup-ub-tambien">
                {modos.map(m => <li key={m.titulo}><m.Icon size={15} aria-hidden /> También {m.titulo.toLowerCase()}</li>)}
              </ul>
            )}
            <ul className="tup-contacto">
              <li><span className="tu-dato"><Phone size={15} aria-hidden /> <span className="tu-num">{t.telefono}</span></span></li>
              <li><button type="button" className="tu-link-suave" onClick={() => contactar({ canal: 'instagram' })}><AtSign size={15} aria-hidden /> {t.instagram}</button></li>
            </ul>
            <table className="tup-horarios">
              <caption className="tu-rotulo">Horarios</caption>
              <tbody>
                {t.horarios.map(([d, h], i) => (
                  <tr key={d} data-hoy={i === HOY} data-cerrado={!h}>
                    <th scope="row">{d}{i === HOY && <span className="tu-chip-hoy">Hoy</span>}</th>
                    <td><HorasDia texto={h} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tup-ub-ctas">
              {conLocal && <a href={linkMapa(t.direccion, t.barrio)} target="_blank" rel="noopener noreferrer" className="tu-btn"><Navigation size={16} aria-hidden /> Cómo llegar</a>}
              <button type="button" className={conLocal ? 'tu-btn-sec' : 'tu-btn'} onClick={() => contactar({ canal: 'whatsapp', texto: `Hola ${t.nombre}, quiero hacer una consulta.` })}><MessageCircle size={16} aria-hidden /> WhatsApp</button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

// ─── Cierre ───────────────────────────────────────────────────────────────────

function Cierre({ rubro, t }: P) {
  return (
    <section className="tu-cont tu-sec">
      <Reveal>
        <div className="tup-cierre">
          <AnillosTema size={620} className="tup-cierre-anillos" />
          <div className="tup-cierre-txt">
            <div className="tup-cierre-rot"><OrbitaMini size={30} color="currentColor" lento /> {t.nombre}</div>
            <h2 className="tu-h tu-h2">{rubro.modo === 'cupo' ? 'Tu lugar en la próxima clase, a un toque' : rubro.modo === 'cancha' ? 'La cancha de hoy, a un toque' : 'Tu próximo turno, a un toque'}</h2>
            <p>Elegí día y horario, y listo. {rubro.modo === 'cupo' ? 'Si la clase está llena, te anotamos en la lista de espera.' : 'Te mandamos la confirmación al instante.'}</p>
            <Link href={ruta('reserva', rubro.key)} className="tu-btn tu-btn--lg tu-btn--inverso">{verbo(rubro)} <ArrowRight size={18} aria-hidden /></Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/** Botón flotante de reserva que aparece al pasar el hero (solo escritorio; en celular ya está la barra fija). */
function BotonFlotante({ rubro }: { rubro: RubroTurnos }) {
  const [ver, setVer] = useState(false)
  const p = proximoLibre(rubro)
  useEffect(() => {
    const f = () => setVer(window.scrollY > 760 && window.scrollY < document.documentElement.scrollHeight - window.innerHeight - 380)
    // El primer cálculo va en el próximo cuadro: un setState sincrónico dentro del effect dispara un render en cascada.
    const raf = requestAnimationFrame(f)
    window.addEventListener('scroll', f, { passive: true })
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', f) }
  }, [])
  return (
    <div className="tup-flotante" data-ver={ver} aria-hidden={!ver}>
      <div className="tup-flotante-caja">
        <span className="tup-flotante-txt"><span className="tu-vivo" aria-hidden /> Próximo libre: <b className="tu-num">{p.cuando.toLowerCase()} {p.hora}</b></span>
        <Link href={ruta('reserva', rubro.key)} className="tu-btn" tabIndex={ver ? 0 : -1} style={{ height: 46, fontSize: 14 }}>{verbo(rubro)} <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </div>
  )
}
