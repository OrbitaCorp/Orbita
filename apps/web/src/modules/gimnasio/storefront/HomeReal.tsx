// Portada del sitio de un gimnasio real. Objetivo único, como en la demo: que
// la persona reserve su lugar en una clase. Arriba, lo que queda de hoy;
// después, los próximos días, los planes que ofrece el negocio, cómo funciona
// y cuándo abre.
//
// Usa el armazón y los estilos de la portada de la demo (Sitio.tsx, Home.tsx),
// pero con lo que dice la API: las clases que se pueden reservar y sus lugares
// salen de la grilla (datos/origen/sitio.ts), y del negocio se muestra solo lo
// que tiene cargado. No hay foto, mapa ni dirección de ejemplo: si falta el
// dato, falta la parte.
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarCheck, MessageCircle, MousePointerClick, Phone, Users } from 'lucide-react'
import { DIAS_CORTOS, diaSemana, fechaCorta, hhmm, type ISO } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import type { Plan } from '../datos'
import type { CargaSitio, ClaseDelSitio, DiaDelSitio } from '../datos/origen/sitio'
import { useReloj } from '../datos/reloj'
import { Encabezado } from './Home'
import Sitio, { BarraCupo } from './Sitio'
import { useSitio } from './rutas'

/** Cuántos días (además de hoy) muestra la portada: los demás están en Reservar. */
const PROXIMOS = 6

const lugaresTxt = (n: number) => `${n} ${n === 1 ? 'lugar' : 'lugares'}`
/** Lo que se dice de una clase completa: con lista de espera se puede anotar; sin ella, no hay nada que hacer. */
const completaTxt = (conEspera: boolean) => (conEspera ? 'completa: lista de espera' : 'completa')

export default function HomeReal({ carga }: { carga: CargaSitio }) {
  const { negocio, rubro, dias, reglas, horarios } = carga
  const { ruta } = useSitio()
  const { hoy } = useReloj()
  // La grilla arranca en hoy; si el día cambió con la página abierta, hoy es el primero que queda.
  const deHoy = dias.find(d => d.fecha === hoy) ?? null
  const proximos = dias.filter(d => d.fecha > hoy).slice(0, PROXIMOS)
  const reservar = (q: Record<string, string> = {}) => ruta('reserva', negocio.rubro, q)
  return (
    <Sitio negocio={negocio} pagina="inicio" cta={{ texto: 'Reservar clase', href: reservar() }}>
      <div className="gis-cont">
        <Hero carga={carga} deHoy={deHoy} href={reservar()} />
        <Hoy dia={deHoy} hoy={hoy} conEspera={reglas.listaDeEspera} reservar={reservar} />
        {proximos.length > 0 && <Proximos dias={proximos} hasta={reglas.dias} conEspera={reglas.listaDeEspera} reservar={reservar} />}
        <Planes planes={negocio.planes} nombre={negocio.nombre} href={reservar()} />
        <ComoFunciona nombre={negocio.nombre} socio={rubro.socio.toLowerCase()} conEspera={reglas.listaDeEspera} cancelaHastaHoras={reglas.cancelaHastaHoras} />
        <Horarios horarios={horarios} telefono={negocio.telefono} />
      </div>
    </Sitio>
  )
}

function Hero({ carga, deHoy, href }: { carga: CargaSitio; deHoy: DiaDelSitio | null; href: string }) {
  const { negocio, rubro } = carga
  const libresHoy = (deHoy?.clases ?? []).reduce((s, c) => s + c.libres, 0)
  const pagos = negocio.planes.filter(p => p.precio > 0).map(p => p.precio)
  return (
    // Sin foto del negocio todavía: el hero va en una sola columna.
    <section className="gis-hero" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div>
        <span className="rv-rotulo">{rubro.label}</span>
        <h1>{negocio.nombre}</h1>
        {negocio.descripcion && <p>{negocio.descripcion}</p>}
        <ul className="gis-hero-datos">
          <li><b>{negocio.clases.length}</b><span>{negocio.clases.length === 1 ? 'clase por semana' : 'clases por semana'}</span></li>
          <li><b>{libresHoy}</b><span>{libresHoy === 1 ? 'lugar libre hoy' : 'lugares libres hoy'}</span></li>
          {pagos.length > 0 && <li><b>{`$${Math.round(Math.min(...pagos) / 1000)}k`}</b><span>planes, desde</span></li>}
        </ul>
        <div className="gis-hero-ctas">
          <Link href={href} className="rv-btn rv-btn--primario rv-btn--lg">Reservar clase <ArrowRight size={17} aria-hidden /></Link>
        </div>
      </div>
    </section>
  )
}

/** Quién da la clase, dónde y cuánto dura. */
function Sub({ c }: { c: ClaseDelSitio }) {
  return <span className="gis-clase-sub"><Users size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {[c.profe || 'Profe a confirmar', c.sala, `${c.fin - c.inicio} min`].filter(Boolean).join(' · ')}</span>
}

function Hoy({ dia, hoy, conEspera, reservar }: { dia: DiaDelSitio | null; hoy: ISO; conEspera: boolean; reservar: (q?: Record<string, string>) => string }) {
  const clases = dia?.clases ?? []
  const bajada = dia?.cerrado
    ? dia.motivo ?? 'Hoy no hay clases.'
    : clases.length ? `Lo que queda del ${fechaCorta(hoy)}. Tocá una clase para reservar tu lugar.` : 'Por hoy ya no quedan clases para reservar.'
  return (
    <section className="gis-sec" aria-labelledby="gis-hoy">
      <Encabezado id="gis-hoy" titulo="Hoy" bajada={bajada} accion={{ label: 'Ver todos los días', href: reservar() }} />
      {clases.length > 0 && (
        <div className="gis-clases">
          {clases.map(c => {
            const lleno = c.libres === 0
            const cuerpo = <><span className="gis-clase-hora">{hhmm(c.inicio)}</span><h3>{c.actividad}</h3><Sub c={c} /><BarraCupo anotados={c.cupo - c.libres} cupo={c.cupo} sinEspera={!conEspera} /></>
            // Completa y sin lista de espera: se ve (está pasando), pero no lleva a ningún lado.
            if (lleno && !conEspera) return <div key={c.id} className="gis-clase" data-en-curso="true">{cuerpo}</div>
            return (
              <Link key={c.id} href={reservar({ clase: c.id, fecha: c.fecha })} className="gis-clase" aria-label={`${c.actividad} a las ${hhmm(c.inicio)}, ${lleno ? completaTxt(conEspera) : `${lugaresTxt(c.libres)} ${c.libres === 1 ? 'libre' : 'libres'}`}`}>
                {cuerpo}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Proximos({ dias, hasta, conEspera, reservar }: { dias: DiaDelSitio[]; hasta: number; conEspera: boolean; reservar: (q?: Record<string, string>) => string }) {
  const [elegido, setElegido] = useState<ISO>(dias[0].fecha)
  // Si el día elegido ya no está (pasó la medianoche y la lista se corrió), el primero.
  const dia = dias.some(d => d.fecha === elegido) ? elegido : dias[0].fecha
  return (
    <section className="gis-sec" aria-labelledby="gis-semana">
      <Encabezado id="gis-semana" titulo="Los próximos días" bajada={`Del ${fechaCorta(dias[0].fecha)} al ${fechaCorta(dias[dias.length - 1].fecha)}. Se reserva hasta ${hasta} ${hasta === 1 ? 'día' : 'días'} adelante.`} accion={{ label: 'Reservar clase', href: reservar() }} />
      {/* En celular se ve un día por vez: estos botones eligen cuál (en escritorio no se muestran). */}
      <div className="gis-tabs-dias" role="group" aria-label="Día">
        {dias.map(d => <button key={d.fecha} type="button" aria-pressed={d.fecha === dia} className="rv-chip rv-chip--borde" onClick={() => setElegido(d.fecha)}>{DIAS_CORTOS[diaSemana(d.fecha)]} {Number(d.fecha.slice(-2))}</button>)}
      </div>
      <div className="gis-semana">
        {dias.map(d => (
          <div key={d.fecha} className="gis-dia" data-oculto={d.fecha !== dia}>
            <div className="gis-dia-cab"><span>{DIAS_CORTOS[diaSemana(d.fecha)]} <small>{Number(d.fecha.slice(-2))}</small></span><small>{d.cerrado ? 'Cerrado' : d.clases.length === 1 ? '1 clase' : `${d.clases.length} clases`}</small></div>
            {d.cerrado ? <p className="rv-ayuda" style={{ margin: 0 }}>{d.motivo ?? 'Sin clases'}</p> : d.clases.map(c => {
              const lleno = c.libres === 0
              const cuerpo = <><b>{hhmm(c.inicio)}</b><span>{c.actividad}</span><span className="gis-dia-cupo">{lleno ? 'Completa' : lugaresTxt(c.libres)}</span></>
              if (lleno && !conEspera) return <div key={c.id} className="gis-dia-clase" data-lleno="true" style={{ cursor: 'default' }}>{cuerpo}</div>
              return (
                <Link key={c.id} href={reservar({ clase: c.id, fecha: c.fecha })} className="gis-dia-clase" data-lleno={lleno} aria-label={`${c.actividad} ${hhmm(c.inicio)}, ${lleno ? completaTxt(conEspera) : lugaresTxt(c.libres)}`}>
                  {cuerpo}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

/** Lo que trae cada plan, dicho para quien lo está mirando. El pago no se hace en el sitio. */
export function textoPlanReal(p: Plan): string {
  if (p.tipo === 'suelta') return 'Para venir a una clase, sin plan.'
  if (p.tipo === 'pack') return `${p.clases ?? 1} ${p.clases === 1 ? 'clase' : 'clases'} para usar en ${p.vigenciaDias} días.`
  if (p.tipo === 'membresia') return p.porSemana ? `${p.porSemana} ${p.porSemana === 1 ? 'clase' : 'clases'} por semana.` : 'Todas las clases que quieras.'
  return 'Una vez por persona.'
}
const unidadDe = (p: Plan) => (p.tipo === 'membresia' ? (p.vigenciaDias === 30 ? 'por mes' : `cada ${p.vigenciaDias} días`) : p.tipo === 'pack' ? 'el pack' : 'la clase')

function Planes({ planes, nombre, href }: { planes: Plan[]; nombre: string; href: string }) {
  if (planes.length === 0) return null
  // La de prueba va en su franja, arriba: es para empezar, no un plan más que comparar.
  const prueba = planes.find(p => p.tipo === 'prueba')
  const pagos = planes.filter(p => p.tipo !== 'prueba')
  return (
    <section className="gis-sec" aria-labelledby="gis-planes">
      <Encabezado id="gis-planes" titulo="Planes y pases" bajada={`Acá reservás tu lugar; el pago lo arreglás en ${nombre}.`} />
      {prueba && (
        <div className="gis-prueba">
          <p><b>¿Primera vez?</b> {prueba.nombre}: gratis, una vez por persona. Reservá tu lugar y avisá cuando llegues.</p>
          <Link href={href} className="rv-btn">Reservar clase <ArrowRight size={15} aria-hidden /></Link>
        </div>
      )}
      {pagos.length > 0 && (
        <div className="gis-planes">
          {pagos.map(p => (
            <div key={p.id} className="gis-plan">
              <span className="rv-rotulo">{p.tipo === 'suelta' ? 'Sin compromiso' : p.tipo === 'pack' ? 'Pack' : 'Membresía'}</span>
              <h3 className="rv-h3" style={{ fontSize: 17 }}>{p.nombre}</h3>
              <div className="gis-precio">{pesos(p.precio)} <small>{unidadDe(p)}</small></div>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>{textoPlanReal(p)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ComoFunciona({ nombre, socio, conEspera, cancelaHastaHoras }: { nombre: string; socio: string; conEspera: boolean; cancelaHastaHoras: number }) {
  const pasos = [
    { Icon: MousePointerClick, titulo: 'Elegís la clase', texto: `Ves cuántos lugares quedan en cada una antes de reservar.${conEspera ? ' Si está completa, te anotás en la lista de espera.' : ''}` },
    { Icon: CalendarCheck, titulo: 'Reservás tu lugar', texto: `Con tu nombre y tu celular, sin registrarte. El pago lo arreglás en ${nombre}: con tu plan, un pack o la clase suelta.` },
    { Icon: MessageCircle, titulo: 'Si no podés ir, avisás', texto: cancelaHastaHoras > 0 ? `Con al menos ${cancelaHastaHoras} h de anticipación, así tu lugar lo puede usar otro ${socio.replace('/a', '')}.` : `Así tu lugar lo puede usar otro ${socio.replace('/a', '')}.` },
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

function Horarios({ horarios, telefono }: { horarios: CargaSitio['horarios']; telefono: string }) {
  if (horarios.length === 0 && !telefono) return null
  return (
    <section className="gis-sec" aria-labelledby="gis-ubicacion">
      <Encabezado id="gis-ubicacion" titulo="Horarios y contacto" />
      <div style={{ maxWidth: 460 }}>
        {horarios.length > 0 && (
          <ul className="gis-horarios">
            {DIAS_CORTOS.map((d, i) => {
              const tramos = horarios.filter(h => h.dia === i)
              return <li key={d} data-cerrado={tramos.length === 0}><span>{d}</span><span className="rv-num">{tramos.length ? tramos.map(t => `${hhmm(t.inicio)} – ${hhmm(t.fin)}`).join(' y ') : 'Cerrado'}</span></li>
            })}
          </ul>
        )}
        {telefono && <p style={{ margin: '14px 0 0', fontSize: 14 }}><a className="gis-link" href={`tel:${telefono.replace(/[^\d+]/g, '')}`}><Phone size={14} aria-hidden /> {telefono}</a></p>}
      </div>
    </section>
  )
}
