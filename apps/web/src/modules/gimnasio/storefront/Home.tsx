// Portada del sitio de un gimnasio. Objetivo único: que reserve su lugar en
// una clase. Hoy arriba (lo que queda del día), la semana completa, los
// planes con precio y dónde queda.
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarCheck, MapPin, MousePointerClick, QrCode, Users } from 'lucide-react'
import { DIAS_CORTOS, fechaCorta, hhmm, sumarDias, diaSemana, type ISO } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { AHORA, HOY, clasesDelDia, cupoDe, diaBloqueado, rubroPorKey, type Inscripcion, type NegocioGym, type Plan } from '../datos'
import Sitio, { BarraCupo, Mapa, ruta } from './Sitio'

interface P { negocio: NegocioGym; inscripciones: Inscripcion[] }

export default function Home({ negocio, inscripciones }: P) {
  const r = rubroPorKey(negocio.rubro)
  return (
    <Sitio negocio={negocio} pagina="inicio" cta={{ texto: 'Reservar clase', href: ruta('reserva', negocio.rubro) }}>
      <div className="gis-cont">
        <Hero negocio={negocio} inscripciones={inscripciones} />
        <Hoy negocio={negocio} inscripciones={inscripciones} />
        <Semana negocio={negocio} inscripciones={inscripciones} />
        <Planes negocio={negocio} />
        <ComoFunciona negocio={negocio} socio={r.socio.toLowerCase()} />
        <Ubicacion negocio={negocio} />
      </div>
    </Sitio>
  )
}

function Encabezado({ id, titulo, bajada, accion }: { id: string; titulo: string; bajada?: string; accion?: { label: string; href: string } }) {
  return (
    <div className="gis-sec-cab">
      <div><h2 id={id}>{titulo}</h2>{bajada && <p>{bajada}</p>}</div>
      {accion && <Link href={accion.href} className="gis-link">{accion.label} <ArrowRight size={15} aria-hidden /></Link>}
    </div>
  )
}

function Hero({ negocio, inscripciones }: P) {
  const r = rubroPorKey(negocio.rubro)
  const hoy = clasesDelDia(negocio, HOY).filter(c => c.inicio >= AHORA)
  const libresHoy = hoy.reduce((s, c) => s + cupoDe(c, HOY, inscripciones).libres, 0)
  const desde = Math.min(...negocio.planes.filter(p => p.activo && p.precio > 0).map(p => p.precio))
  return (
    <section className="gis-hero">
      <div className="gis-hero-foto"><img src={negocio.fotoPortada} alt="" /></div>
      <div>
        <span className="rv-rotulo">{r.label}</span>
        <h1>{negocio.nombre}</h1>
        <p>{negocio.descripcion}</p>
        <ul className="gis-hero-datos">
          <li><b>{negocio.clases.length}</b><span>clases por semana</span></li>
          <li><b>{libresHoy}</b><span>lugares libres hoy</span></li>
          <li><b>{Number.isFinite(desde) ? `$${Math.round(desde / 1000)}k` : '—'}</b><span>planes, desde</span></li>
        </ul>
        <div className="gis-hero-ctas">
          <Link href={ruta('reserva', negocio.rubro)} className="rv-btn rv-btn--primario rv-btn--lg">Reservar clase <ArrowRight size={17} aria-hidden /></Link>
          {negocio.planes.some(p => p.tipo === 'prueba' && p.activo) && <Link href={ruta('reserva', negocio.rubro, { plan: 'prueba' })} className="rv-btn rv-btn--lg">Probar una clase gratis</Link>}
        </div>
      </div>
    </section>
  )
}

function Hoy({ negocio, inscripciones }: P) {
  const bloqueo = diaBloqueado(negocio, HOY)
  const clases = clasesDelDia(negocio, HOY).filter(c => c.inicio + (c.actividad?.duracion ?? 60) > AHORA)
  return (
    <section className="gis-sec" aria-labelledby="gis-hoy">
      <Encabezado id="gis-hoy" titulo="Hoy" bajada={bloqueo ? bloqueo.motivo : clases.length ? `Lo que queda del ${fechaCorta(HOY)}. Tocá una clase para reservar tu lugar.` : 'Por hoy ya no quedan clases.'} accion={{ label: 'Ver toda la semana', href: ruta('reserva', negocio.rubro) }} />
      {!bloqueo && (
        <div className="gis-clases">
          {clases.map(c => {
            const cupo = cupoDe(c, HOY, inscripciones)
            const sub = <span className="gis-clase-sub"><Users size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {c.profe?.nombre} · {c.sala} · {c.actividad?.duracion} min</span>
            // La que ya empezó se muestra (está pasando), pero no se reserva: no es un link.
            if (c.inicio <= AHORA) {
              return (
                <div key={c.id} className="gis-clase" data-en-curso="true">
                  <span className="gis-clase-hora">{hhmm(c.inicio)}<span className="rv-chip rv-chip--aviso" style={{ marginLeft: 8, verticalAlign: '4px' }}>En curso</span></span>
                  <h3>{c.actividad?.nombre}</h3>
                  {sub}
                  <span className="rv-ayuda">Ya empezó: se reserva hasta el horario de inicio.</span>
                </div>
              )
            }
            return (
              <Link key={c.id} href={ruta('reserva', negocio.rubro, { clase: c.id, fecha: HOY })} className="gis-clase" aria-label={`${c.actividad?.nombre} a las ${hhmm(c.inicio)}, ${cupo.lleno ? 'completa: lista de espera' : `${cupo.libres} ${cupo.libres === 1 ? 'lugar libre' : 'lugares libres'}`}`}>
                <span className="gis-clase-hora">{hhmm(c.inicio)}</span>
                <h3>{c.actividad?.nombre}</h3>
                {sub}
                <BarraCupo anotados={cupo.anotados} cupo={cupo.cupo} />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Semana({ negocio, inscripciones }: P) {
  // La semana que arranca el lunes próximo a hoy (hoy es sábado: se muestra la que viene).
  const lunes = sumarDias(HOY, diaSemana(HOY) === 0 ? 0 : 7 - diaSemana(HOY))
  const dias = Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i))
  const [dia, setDia] = useState<ISO>(dias[0])
  return (
    <section className="gis-sec" aria-labelledby="gis-semana">
      <Encabezado id="gis-semana" titulo="La semana" bajada={`Del ${fechaCorta(dias[0])} al ${fechaCorta(dias[5])}. La grilla se repite todas las semanas.`} />
      {/* En celular se ve un día por vez: estos botones eligen cuál (en escritorio no se muestran). */}
      <div className="gis-tabs-dias" role="group" aria-label="Día de la semana">
        {dias.map(f => <button key={f} type="button" aria-pressed={f === dia} className="rv-chip rv-chip--borde" onClick={() => setDia(f)}>{DIAS_CORTOS[diaSemana(f)]} {Number(f.slice(-2))}</button>)}
      </div>
      <div className="gis-semana">
        {dias.map(f => {
          const clases = clasesDelDia(negocio, f)
          const bloqueo = diaBloqueado(negocio, f)
          return (
            <div key={f} className="gis-dia" data-oculto={f !== dia}>
              <div className="gis-dia-cab"><span>{DIAS_CORTOS[diaSemana(f)]} <small>{Number(f.slice(-2))}</small></span><small>{bloqueo ? 'Cerrado' : `${clases.length} clases`}</small></div>
              {bloqueo ? <p className="rv-ayuda" style={{ margin: 0 }}>{bloqueo.motivo}</p> : clases.map(c => {
                const cupo = cupoDe(c, f, inscripciones)
                return (
                  <Link key={c.id} href={ruta('reserva', negocio.rubro, { clase: c.id, fecha: f })} className="gis-dia-clase" data-lleno={cupo.lleno} aria-label={`${c.actividad?.nombre} ${hhmm(c.inicio)}, ${cupo.lleno ? 'completa: lista de espera' : `${cupo.libres} ${cupo.libres === 1 ? 'lugar' : 'lugares'}`}`}>
                    <b>{hhmm(c.inicio)}</b><span>{c.actividad?.nombre}</span><span className="gis-dia-cupo">{cupo.lleno ? 'Completa' : `${cupo.libres} ${cupo.libres === 1 ? 'lugar' : 'lugares'}`}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function textoPlan(p: Plan): string {
  if (p.tipo === 'prueba') return 'Una vez por persona. Sin compromiso.'
  if (p.tipo === 'suelta') return 'Para una clase. Se paga al reservar.'
  if (p.tipo === 'pack') return `${p.clases} clases para usar en ${p.vigenciaDias} días.`
  return p.porSemana ? `${p.porSemana} ${p.porSemana === 1 ? 'clase' : 'clases'} por semana · se renueva cada mes.` : 'Todas las clases que quieras · se renueva cada mes.'
}

function Planes({ negocio }: { negocio: NegocioGym }) {
  const planes = negocio.planes.filter(p => p.activo)
  // La de prueba va en su franja, arriba: es para empezar, no un plan más que comparar.
  const prueba = planes.find(p => p.tipo === 'prueba')
  const pagos = planes.filter(p => p.tipo !== 'prueba')
  const destacado = pagos.find(p => p.tipo === 'membresia' && (p.porSemana ?? 0) === 3) ?? pagos.find(p => p.tipo === 'membresia')
  return (
    <section className="gis-sec" aria-labelledby="gis-planes">
      <Encabezado id="gis-planes" titulo="Planes y pases" bajada={prueba ? 'Probá gratis una vez. Después, una clase suelta, un pack o una membresía mensual.' : 'Una clase suelta, un pack o una membresía mensual.'} />
      {prueba && (
        <div className="gis-prueba">
          <p><b>¿Primera vez?</b> {prueba.nombre}: gratis, una vez por persona y sin compromiso.</p>
          <Link href={ruta('reserva', negocio.rubro, { plan: 'prueba' })} className="rv-btn">Reservar mi prueba <ArrowRight size={15} aria-hidden /></Link>
        </div>
      )}
      <div className="gis-planes">
        {pagos.map(p => (
          <div key={p.id} className="gis-plan" data-destacado={p.id === destacado?.id}>
            <span className="rv-rotulo">{p.tipo === 'suelta' ? 'Sin compromiso' : p.tipo === 'pack' ? 'Pack' : 'Membresía'}</span>
            <h3 className="rv-h3" style={{ fontSize: 17 }}>{p.nombre}</h3>
            <div className="gis-precio">{pesos(p.precio)} <small>{p.tipo === 'membresia' ? 'por mes' : p.tipo === 'pack' ? 'el pack' : 'la clase'}</small></div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5, flex: 1 }}>{textoPlan(p)}</p>
            <Link href={ruta('reserva', negocio.rubro, { plan: p.id })} className={`rv-btn${p.id === destacado?.id ? ' rv-btn--primario' : ''}`} aria-label={`Elegir ${p.nombre}`}>Elegir</Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function ComoFunciona({ negocio, socio }: { negocio: NegocioGym; socio: string }) {
  const pasos = [
    { Icon: MousePointerClick, titulo: 'Elegís la clase', texto: 'Ves el cupo de cada una antes de reservar. Si está llena, te anotás en la lista de espera y te avisamos si se libera un lugar.' },
    { Icon: CalendarCheck, titulo: 'Reservás tu lugar', texto: `Con tu plan, un pack o una clase suelta. Sin plan, la primera es de prueba. Cancelás hasta ${negocio.cancelaHastaHoras} h antes sin perder la clase.` },
    { Icon: QrCode, titulo: 'Hacés check-in', texto: `Desde ${negocio.checkInMin} minutos antes, desde Mis clases o con el QR en la puerta. Cada ${socio} tiene su asistencia a la vista.` },
  ]
  return (
    <section className="gis-sec" aria-labelledby="gis-como">
      <Encabezado id="gis-como" titulo="Cómo funciona" />
      <div className="gis-pasos">
        {pasos.map((p, i) => <div key={p.titulo} className="gis-paso"><span className="gis-paso-n">{i + 1}</span><b>{p.titulo}</b><p>{p.texto}</p></div>)}
      </div>
    </section>
  )
}

function Ubicacion({ negocio }: { negocio: NegocioGym }) {
  const a = negocio.apertura
  return (
    <section className="gis-sec" aria-labelledby="gis-ubicacion">
      <Encabezado id="gis-ubicacion" titulo="Dónde y cuándo" />
      <div className="gis-ubicacion">
        <div>
          <Mapa latLng={negocio.latLng} titulo={negocio.nombre} />
          <p style={{ margin: '10px 0 0', fontSize: 14 }}><MapPin size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {negocio.direccion}, {negocio.ciudad}</p>
        </div>
        <div>
          <h3 className="rv-h3" style={{ marginBottom: 8 }}>Horarios</h3>
          <ul className="gis-horarios">
            {DIAS_CORTOS.map((d, i) => <li key={d} data-cerrado={!a.dias.includes(i)}><span>{d}</span><span className="rv-num">{a.dias.includes(i) ? `${hhmm(a.desde)} – ${hhmm(a.hasta)}` : 'Cerrado'}</span></li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}
