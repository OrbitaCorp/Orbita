// Portada del sitio de un negocio de alquileres. Objetivo único: que reserve.
// Cambia según el modo: canchas con sus próximos horarios libres, salón con
// sus paquetes y fechas libres, propiedades con su precio por noche y el
// detalle de cada una (galería, comodidades, mapa y calendario).
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowRight, BedDouble, Bath, DoorOpen, Users, Check, ChevronLeft, Clock, MapPin, CalendarCheck, Sparkles, MousePointerClick } from 'lucide-react'
import { fechaCorta, hhmm, sumarDias, diaSemana, rangoTxt, type ISO } from '@/lib/reservas/fechas'
import { franjasDelDia } from '@/lib/reservas/disponibilidad'
import { pesos } from '@/lib/reservas/precio'
import { motivoNoReservable, nochesEntre, precioEstadia, salidaMaxima, nochesOcupadas } from '@/lib/reservas/estadia'
import { AHORA, HOY, TIPOS, aperturaDe, bloquesDe, bloquesLibresEn, ocupadoDelDia, rangosOcupados, type NegocioAlquiler, type Propiedad, type Reserva } from '../datos'
import { CalendarioRango, type Rango } from '@/design-system/reservas/Calendario'
import { Modal } from '@/design-system/reservas/piezas'
import Sitio, { Horarios, Mapa, ruta } from './Sitio'

interface P { negocio: NegocioAlquiler; reservas: Reserva[] }

export default function Home({ negocio, reservas }: P) {
  const router = useRouter()
  const tipo = negocio.tipo
  const propiedadId = typeof router.query.propiedad === 'string' ? router.query.propiedad : null
  const propiedad = tipo === 'estadia' && propiedadId ? negocio.propiedades.find(p => p.id === propiedadId) ?? null : null
  if (propiedad) return <DetallePropiedad negocio={negocio} reservas={reservas} propiedad={propiedad} />
  return (
    <Sitio negocio={negocio} pagina="inicio" cta={{ texto: TIPOS[tipo].verbo, href: ruta('reserva', tipo) }}>
      <div className="als-cont">
        <Hero negocio={negocio} reservas={reservas} />
        {tipo === 'cancha' && <Canchas negocio={negocio} reservas={reservas} />}
        {tipo === 'bloque' && <Salon negocio={negocio} reservas={reservas} />}
        {tipo === 'estadia' && <Propiedades negocio={negocio} />}
        <ComoFunciona negocio={negocio} />
        <Ubicacion negocio={negocio} />
      </div>
    </Sitio>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function datos(negocio: NegocioAlquiler, reservas: Reserva[]): { valor: string; rotulo: string }[] {
  const abre = { valor: String(negocio.apertura.dias.length), rotulo: 'días por semana' }
  if (negocio.tipo === 'cancha') {
    const desde = Math.min(...negocio.unidades.map(u => u.tarifaHora))
    const libresHoy = negocio.unidades.reduce((s, u) => s + franjasDelDia(aperturaDe(negocio, HOY), ocupadoDelDia(negocio, reservas, u.id, HOY), { paso: negocio.pasoMin, duracion: negocio.duracionMin, desde: AHORA }).filter(f => f.libre).length, 0)
    return [{ valor: String(negocio.unidades.length), rotulo: 'canchas' }, { valor: `$${Math.round(desde / 1000)}k`, rotulo: 'la hora, desde' }, { valor: String(libresHoy), rotulo: 'horarios libres hoy' }]
  }
  if (negocio.tipo === 'bloque' && negocio.salon) {
    const desde = Math.min(...negocio.salon.paquetes.map(p => p.precio))
    return [{ valor: String(negocio.salon.capacidad), rotulo: 'invitados como máximo' }, { valor: `$${Math.round(desde / 1000)}k`, rotulo: 'el paquete, desde' }, abre]
  }
  const desde = Math.min(...negocio.propiedades.map(p => p.tarifa.precioNoche))
  return [{ valor: String(negocio.propiedades.length), rotulo: 'propiedades' }, { valor: `$${Math.round(desde / 1000)}k`, rotulo: 'la noche, desde' }, { valor: String(Math.max(...negocio.propiedades.map(p => p.huespedes))), rotulo: 'huéspedes como máximo' }]
}

function Hero({ negocio, reservas }: P) {
  const t = TIPOS[negocio.tipo]
  return (
    <section className="als-hero">
      <div className="als-hero-foto"><img src={negocio.fotoPortada} alt="" /></div>
      <div>
        <span className="rv-rotulo">{t.label}</span>
        <h1>{negocio.nombre}</h1>
        <p>{negocio.descripcion}</p>
        <ul className="als-hero-datos">
          {datos(negocio, reservas).map(d => <li key={d.rotulo}><b>{d.valor}</b><span>{d.rotulo}</span></li>)}
        </ul>
        <div className="als-hero-ctas">
          <Link href={ruta('reserva', negocio.tipo)} className="rv-btn rv-btn--primario rv-btn--lg">{t.verbo} <ArrowRight size={17} aria-hidden /></Link>
          <Link href={ruta('mis-reservas', negocio.tipo)} className="rv-btn rv-btn--lg">Mis reservas</Link>
        </div>
      </div>
    </section>
  )
}

function Encabezado({ id, titulo, bajada, accion }: { id: string; titulo: string; bajada?: string; accion?: { label: string; href: string } }) {
  return (
    <div className="als-sec-cab">
      <div><h2 id={id}>{titulo}</h2>{bajada && <p>{bajada}</p>}</div>
      {accion && <Link href={accion.href} className="als-link">{accion.label} <ArrowRight size={15} aria-hidden /></Link>}
    </div>
  )
}

// ─── Canchas ─────────────────────────────────────────────────────────────────

function Canchas({ negocio, reservas }: P) {
  // Los próximos horarios libres de cada cancha: hoy lo que queda y, si no alcanza, mañana.
  const proximos = (unidadId: string) => {
    const out: { fecha: ISO; m: number }[] = []
    for (let d = 0; d < 3 && out.length < 3; d++) {
      const fecha = sumarDias(HOY, d)
      const libres = franjasDelDia(aperturaDe(negocio, fecha), ocupadoDelDia(negocio, reservas, unidadId, fecha), { paso: negocio.pasoMin, duracion: negocio.duracionMin, desde: d === 0 ? AHORA : undefined }).filter(f => f.libre)
      for (const f of libres) { if (out.length < 3) out.push({ fecha, m: f.inicio }) }
    }
    return out
  }
  return (
    <section className="als-sec" aria-labelledby="als-canchas">
      <Encabezado id="als-canchas" titulo="Canchas"bajada={`Reservás por hora, hasta ${negocio.maxFranjas} seguidas. ${negocio.senaPct ? `Con una seña del ${negocio.senaPct}% y el resto en el lugar.` : 'Sin seña.'}`} accion={{ label: 'Ver todos los horarios', href: ruta('reserva', 'cancha') }} />
      <div className="als-tarjetas">
        {negocio.unidades.map(u => (
          <div key={u.id} className="als-tarjeta">
            <div className="als-tarjeta-foto"><img src={u.foto} alt="" loading="lazy" /></div>
            <div className="als-tarjeta-cuerpo">
              <h3>{u.nombre}</h3>
              <span className="als-tarjeta-sub">{u.detalle}</span>
              <span className="als-precio">{pesos(u.tarifaHora)} <small>la hora</small></span>
              <div className="als-horas">
                {proximos(u.id).map(p => (
                  <Link key={`${p.fecha}${p.m}`} href={ruta('reserva', 'cancha', { unidad: u.id, fecha: p.fecha, hora: String(p.m) })} className="als-hora" aria-label={`Reservar ${u.nombre} el ${fechaCorta(p.fecha)} a las ${hhmm(p.m)}`}>
                    {p.fecha === HOY ? 'Hoy' : fechaCorta(p.fecha).split(' ')[0]} {hhmm(p.m)}
                  </Link>
                ))}
                <Link href={ruta('reserva', 'cancha', { unidad: u.id })} className="als-hora" aria-label={`Más horarios de ${u.nombre}`}><ArrowRight size={14} aria-hidden /></Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Salón ───────────────────────────────────────────────────────────────────

function Salon({ negocio, reservas }: P) {
  const s = negocio.salon
  if (!s) return null
  const bloques = bloquesDe(negocio)
  // Los próximos días con algún bloque libre.
  const fechas: { fecha: ISO; libres: number }[] = []
  for (let d = 1; d <= 45 && fechas.length < 8; d++) {
    const fecha = sumarDias(HOY, d)
    if (!negocio.apertura.dias.includes(diaSemana(fecha))) continue
    const libres = bloquesLibresEn(negocio, reservas, bloques, fecha).length
    if (libres) fechas.push({ fecha, libres })
  }
  return (
    <>
      <section className="als-sec" aria-labelledby="als-paquetes">
        <Encabezado id="als-paquetes" titulo="Paquetes"bajada={`Cada bloque dura ${s.duracionBloque / 60} horas e incluye el salón completo. El precio depende de cuántos invitados vienen.`} />
        <div className="als-paquetes">
          {s.paquetes.map((p, i) => (
            <div key={p.id} className="als-paquete" data-destacado={i === 1}>
              <div>
                <span className="rv-rotulo">Hasta {p.hastaInvitados} invitados</span>
                <div className="als-precio" style={{ fontSize: 24, marginTop: 4 }}>{pesos(p.precio)}</div>
              </div>
              <ul>{p.incluye.map(x => <li key={x}>{x}</li>)}</ul>
              <Link href={ruta('reserva', 'bloque', { paquete: p.id })} className="rv-btn rv-btn--primario" style={{ marginTop: 'auto' }}>Elegir este paquete</Link>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <span className="rv-rotulo">Extras opcionales</span>
          <div className="als-extras" style={{ marginTop: 8 }}>
            {s.extras.map(e => <span key={e.id} className="rv-chip rv-chip--borde">{e.nombre} · <span className="rv-num">{pesos(e.precio)}</span></span>)}
          </div>
        </div>
      </section>
      <section className="als-sec" aria-labelledby="als-fechas">
        <Encabezado id="als-fechas" titulo="Próximas fechas libres"bajada="Tocá una fecha para elegir el bloque de la tarde o de la noche." accion={{ label: 'Ver el calendario', href: ruta('reserva', 'bloque') }} />
        <div className="als-horas">
          {fechas.map(f => (
            <Link key={f.fecha} href={ruta('reserva', 'bloque', { fecha: f.fecha })} className="als-hora" style={{ minHeight: 44, padding: '0 14px' }}>
              {fechaCorta(f.fecha)} · {f.libres === 1 ? '1 bloque' : `${f.libres} bloques`}
            </Link>
          ))}
        </div>
      </section>
      <section className="als-sec" aria-labelledby="als-salon">
        <Encabezado id="als-salon" titulo="El salón"bajada={`Hasta ${s.capacidad} personas, con pelotero, cocina y patio.`} />
        <Galeria fotos={s.fotos} />
      </section>
    </>
  )
}

// ─── Propiedades ─────────────────────────────────────────────────────────────

function Propiedades({ negocio }: { negocio: NegocioAlquiler }) {
  return (
    <section className="als-sec" aria-labelledby="als-propiedades">
      <Encabezado id="als-propiedades" titulo="Propiedades"bajada="Elegí la tuya y mirá las fechas libres. La salida no cuenta como noche." />
      <div className="als-tarjetas">
        {negocio.propiedades.map(p => (
          <Link key={p.id} href={ruta('inicio', 'estadia', { propiedad: p.id })} className="als-tarjeta rv-card--accion">
            <div className="als-tarjeta-foto"><img src={p.fotos[0]} alt="" loading="lazy" /></div>
            <div className="als-tarjeta-cuerpo">
              <span className="rv-rotulo">{p.tipo}</span>
              <h3>{p.nombre}</h3>
              <span className="als-tarjeta-sub"><Users size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {p.huespedes} huéspedes · {p.ambientes} amb. · {p.camas} {p.camas === 1 ? 'cama' : 'camas'}</span>
              <span className="als-precio">{pesos(p.tarifa.precioNoche)} <small>la noche · mínimo {p.tarifa.minNoches} {p.tarifa.minNoches === 1 ? 'noche' : 'noches'}</small></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Galeria({ fotos }: { fotos: string[] }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  // Estable a propósito: el modal vuelve a enfocar su caja cada vez que cambia onCerrar, y acá se pasa de foto sin cerrarlo.
  const cerrar = useCallback(() => setAbierta(null), [])
  return (
    <>
      <div className="als-galeria">
        {fotos.slice(0, 5).map((f, i) => <button key={`${i}-${f}`} type="button" onClick={() => setAbierta(i)} aria-label={`Ver foto ${i + 1} de ${fotos.length}`}><img src={f} alt="" loading="lazy" /></button>)}
      </div>
      {abierta !== null && (
        <Modal titulo={`Foto ${abierta + 1} de ${fotos.length}`} onCerrar={cerrar} ancho={860}
          pie={<>
            <button type="button" className="rv-btn" onClick={() => setAbierta((abierta + fotos.length - 1) % fotos.length)}><ChevronLeft size={16} aria-hidden /> Anterior</button>
            <button type="button" className="rv-btn" onClick={() => setAbierta((abierta + 1) % fotos.length)}>Siguiente <ArrowRight size={16} aria-hidden /></button>
          </>}>
          <img src={fotos[abierta]} alt="" style={{ width: '100%', borderRadius: 10, aspectRatio: '16 / 10', objectFit: 'cover' }} />
        </Modal>
      )}
    </>
  )
}

function DetallePropiedad({ negocio, reservas, propiedad: p }: P & { propiedad: Propiedad }) {
  const ocupadas = rangosOcupados(negocio, reservas, p.id)
  const tomadas = nochesOcupadas(ocupadas)
  const [mes, setMes] = useState<ISO>(HOY)
  const [rango, setRango] = useState<Rango>({ entrada: null, salida: null })
  const completo = rango.entrada && rango.salida
  const motivo = completo ? motivoNoReservable(rango.entrada!, rango.salida!, p.tarifa, ocupadas) : null
  const precio = completo && !motivo ? precioEstadia(rango.entrada!, rango.salida!, p.tarifa) : null
  const hrefReserva = ruta('reserva', 'estadia', { propiedad: p.id, ...(completo && !motivo ? { entrada: rango.entrada!, salida: rango.salida! } : {}) })
  const resumen = precio ? `${nochesEntre(rango.entrada!, rango.salida!)} noches · ${pesos(precio.total)}` : `Desde ${pesos(p.tarifa.precioNoche)} la noche`
  return (
    <Sitio negocio={negocio} pagina="inicio" cta={{ texto: precio ? 'Reservar' : 'Elegir fechas', sub: `${p.nombre} · ${resumen}`, href: hrefReserva, deshabilitado: !!motivo }}>
      <div className="als-cont">
        <div style={{ padding: '18px 0 14px' }}>
          <Link href={ruta('inicio', 'estadia')} className="als-link"><ChevronLeft size={15} aria-hidden /> Todas las propiedades</Link>
        </div>
        <Galeria fotos={p.fotos} />
        <div className="als-detalle">
          <div>
            <span className="rv-rotulo">{p.tipo} · {p.ciudad}</span>
            <h1 className="rv-h1" style={{ fontSize: 30, marginTop: 6 }}>{p.nombre}</h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, margin: '12px 0 0' }}>{p.descripcion}</p>
            <div className="rv-fila" style={{ marginTop: 16, gap: 16 }}>
              <span className="rv-fila" style={{ gap: 6 }}><Users size={16} aria-hidden /> {p.huespedes} huéspedes</span>
              <span className="rv-fila" style={{ gap: 6 }}><DoorOpen size={16} aria-hidden /> {p.ambientes} {p.ambientes === 1 ? 'ambiente' : 'ambientes'}</span>
              <span className="rv-fila" style={{ gap: 6 }}><BedDouble size={16} aria-hidden /> {p.camas} {p.camas === 1 ? 'cama' : 'camas'}</span>
              <span className="rv-fila" style={{ gap: 6 }}><Bath size={16} aria-hidden /> {p.banos} {p.banos === 1 ? 'baño' : 'baños'}</span>
            </div>
            <section className="als-sec" style={{ paddingTop: 28 }}>
              <h2 className="rv-h2" style={{ marginBottom: 12 }}>Comodidades</h2>
              <ul className="als-comodidades">{p.comodidades.map(c => <li key={c}><Check size={15} aria-hidden style={{ color: 'var(--color-primary)' }} /> {c}</li>)}</ul>
            </section>
            <section className="als-sec" style={{ paddingTop: 28 }}>
              <h2 className="rv-h2" style={{ marginBottom: 12 }}>Entrada y salida</h2>
              <p style={{ margin: 0 }}><Clock size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> Entrada desde las <b className="rv-num">{hhmm(p.checkIn)}</b> · Salida hasta las <b className="rv-num">{hhmm(p.checkOut)}</b>. Limpieza de <b className="rv-num">{pesos(p.tarifa.limpieza)}</b> por estadía.{p.tarifa.finDeSemanaPct ? ` Viernes y sábados llevan un ${p.tarifa.finDeSemanaPct}% más.` : ''}</p>
              {p.tarifa.temporadas.length > 0 && (
                <ul className="als-horarios" style={{ marginTop: 10 }}>
                  {p.tarifa.temporadas.map(t => <li key={t.id}><span>{t.nombre} · {rangoTxt(t.desde, t.hasta)}</span><span className="rv-num">{pesos(t.precioNoche)} la noche</span></li>)}
                </ul>
              )}
            </section>
            <section className="als-sec" style={{ paddingTop: 28 }}>
              <h2 className="rv-h2" style={{ marginBottom: 12 }}>Dónde queda</h2>
              <Mapa latLng={p.latLng} titulo={p.nombre} />
              <p style={{ margin: '10px 0 0', fontSize: 14 }}><MapPin size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {p.direccion}, {p.ciudad}</p>
            </section>
          </div>
          <aside className="als-lateral rv-card rv-card--pad">
            <div className="als-precio" style={{ fontSize: 22 }}>{pesos(p.tarifa.precioNoche)} <small>la noche</small></div>
            <p className="rv-ayuda" style={{ margin: '4px 0 14px' }}>Tocá el día de entrada y después el de salida.</p>
            <CalendarioRango mes={mes} onMes={setMes} hoy={HOY} rango={rango} onRango={setRango} minMes={HOY}
              estadoDe={f => ({ deshabilitado: f < HOY, ocupado: tomadas.has(f), aria: tomadas.has(f) ? 'ocupado' : undefined })}
              salidaMaxima={e => salidaMaxima(e, ocupadas)} />
            {motivo && <p className="rv-error" role="alert" style={{ marginTop: 10 }}>{motivo}</p>}
            {precio && (
              <ul className="als-horarios" style={{ marginTop: 12 }}>
                <li><span>{nochesEntre(rango.entrada!, rango.salida!)} noches · {rangoTxt(rango.entrada!, rango.salida!)}</span><span className="rv-num">{pesos(precio.subtotal)}</span></li>
                <li><span>Limpieza</span><span className="rv-num">{pesos(precio.limpieza)}</span></li>
                <li style={{ fontWeight: 700, color: 'var(--color-text)' }}><span>Total</span><span className="rv-num">{pesos(precio.total)}</span></li>
              </ul>
            )}
            {motivo
              ? <button type="button" className="rv-btn rv-btn--primario rv-btn--lg rv-btn--ancho" style={{ marginTop: 14 }} disabled>Reservar estas fechas <ArrowRight size={16} aria-hidden /></button>
              : <Link href={hrefReserva} className="rv-btn rv-btn--primario rv-btn--lg rv-btn--ancho" style={{ marginTop: 14 }}>{precio ? 'Reservar estas fechas' : 'Elegir fechas'} <ArrowRight size={16} aria-hidden /></Link>}
          </aside>
        </div>
      </div>
    </Sitio>
  )
}

// ─── Cómo funciona y ubicación ───────────────────────────────────────────────

function ComoFunciona({ negocio }: { negocio: NegocioAlquiler }) {
  const t = negocio.tipo
  const pasos = [
    { Icon: MousePointerClick, titulo: t === 'cancha' ? 'Elegís la cancha y el horario' : t === 'bloque' ? 'Elegís la fecha y el bloque' : 'Elegís la propiedad y las fechas', texto: t === 'cancha' ? 'Ves los horarios libres de cada cancha y podés tomar varias horas seguidas.' : t === 'bloque' ? 'Después el paquete según los invitados y los extras que quieras.' : 'Con la entrada y la salida ves el precio final, limpieza incluida.' },
    { Icon: CalendarCheck, titulo: negocio.senaPct ? `Confirmás con la seña del ${negocio.senaPct}%` : 'Confirmás al instante', texto: negocio.senaPct ? 'El resto se paga en el lugar. Si cancelás a tiempo, se devuelve.' : 'Sin seña: la reserva queda confirmada en el momento.' },
    { Icon: Sparkles, titulo: 'Te llega la confirmación', texto: 'Con el código, el horario y la dirección. Podés agregarla a tu calendario.' },
  ]
  return (
    <section className="als-sec" aria-labelledby="als-como">
      <Encabezado id="als-como" titulo="Cómo funciona" />
      <div className="als-pasos">
        {pasos.map((p, i) => <div key={p.titulo} className="als-paso"><span className="als-paso-n">{i + 1}</span><b>{p.titulo}</b><p>{p.texto}</p></div>)}
      </div>
    </section>
  )
}

function Ubicacion({ negocio }: { negocio: NegocioAlquiler }) {
  return (
    <section className="als-sec" aria-labelledby="als-ubicacion">
      <Encabezado id="als-ubicacion" titulo="Dónde y cuándo" />
      <div className="als-ubicacion">
        <div>
          <Mapa latLng={negocio.latLng} titulo={negocio.nombre} />
          <p style={{ margin: '10px 0 0', fontSize: 14 }}><MapPin size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {negocio.direccion}, {negocio.ciudad}</p>
        </div>
        <div>
          <h3 className="rv-h3" style={{ marginBottom: 8 }}>{negocio.tipo === 'estadia' ? 'Atención' : 'Horarios'}</h3>
          {negocio.tipo === 'estadia'
            ? <p style={{ margin: 0, fontSize: 14 }}>Respondemos todos los días de 9 a 21 h. La entrada y la salida de cada propiedad están en su ficha.</p>
            : <Horarios negocio={negocio} />}
        </div>
      </div>
    </section>
  )
}
