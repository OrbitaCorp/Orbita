// El cierre de la reserva: una celebración sobria. Un anillo se cierra
// alrededor del check (la órbita completa su vuelta), el turno queda como una
// entrada con su QR y abajo están las tres cosas que la gente hace después:
// agendarlo, ver cómo llegar y avisarle a alguien.
// También cubre la lista de espera (clase completa) y el estado vacío del
// negocio que todavía no publicó su agenda.
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, BellRing, CalendarPlus, CalendarX2, Check, Gift, Hourglass, MessageCircle, Navigation } from 'lucide-react'
import { duracionTxt, horaTxt, pesos, type RubroTurnos } from '@/modules/turnos/datos'
import { beneficiosTxt, type BeneficiosCuenta, type Modalidad } from '@/modules/turnos/demo/negocioDemo'
import { QR } from '@/modules/turnos/_shared/components/QR'
import { Marca, TarjetaSellos, ruta, useForma } from '../piezas'
import { useContacto } from '../ContactoDemo'
import type { TemaNegocio } from '../tema'
import { CODIGO_DEMO, descargarICS, linkMapa, linkWhatsApp, urlTurno } from './acciones'
import { fechaLarga, type Fecha } from './calendario'
import { SELLOS_DEMO, type Cuenta } from './PasoDatos'
import { FirmaOrbita, Fondo } from './piezas'

interface Props {
  rubro: RubroTurnos
  t: TemaNegocio
  servicio: string
  fecha: Fecha
  inicio: number
  duracion: number
  /** "Con", "Cancha", "Espacio" o "Profe", y a quién o qué corresponde. */
  recurso?: { rotulo: string; nombre: string; retrato?: string }
  nombre: string
  /** La clase estaba completa: quedó en lista de espera, no tiene lugar todavía. */
  espera: boolean
  /** Lo que se paga, ya con el descuento de bienvenida si lo hubo. */
  precio: number
  sena: number
  recordatorio: boolean
  /** Dónde se hace el turno y, si es a domicilio, a qué dirección. */
  lugar: Modalidad
  domicilio: string
  /** Reservó como invitado, creó su cuenta o entró con la que ya tenía. */
  cuenta: Cuenta
  beneficios: BeneficiosCuenta
}

export function Confirmacion({ rubro, t, servicio, fecha, inicio, duracion, recurso, nombre, espera, precio, sena, recordatorio, lugar, domicilio, cuenta, beneficios }: Props) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const forma = useForma()
  // Al llegar, arriba de todo y con el foco en el título: el lector de pantalla anuncia que salió bien.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    titulo.current?.focus({ preventScroll: true })
  }, [])

  const primero = nombre.trim().split(/\s+/)[0]
  const cuando = `${fechaLarga(fecha)} a las ${horaTxt(inicio)}`
  const tono = espera ? 'var(--tur-aviso)' : 'var(--color-primary)'
  const direccion = [t.direccion, t.barrio].filter(Boolean).join(', ')
  // Dónde es el turno, para el calendario y para el mensaje que se comparte.
  const dondeTxt = lugar === 'local' ? direccion : domicilio.trim() || 'A domicilio'
  const mensaje = `Reservé ${servicio} en ${t.nombre}: ${cuando.toLowerCase()}. ${lugar === 'local' ? direccion : 'A domicilio'}.`
  const cierre = lugar === 'local' ? 'Te esperamos' : 'Vamos a tu casa'

  const conCuenta = cuenta !== 'invitado' && !espera
  const sellos = beneficios.sellos
  const sellosHechos = cuenta === 'nueva' ? 1 : Math.min(SELLOS_DEMO + 1, sellos)
  const paraSumar = beneficiosTxt(beneficios, rubro)

  return (
    <div className="tur" data-oscuro={t.oscuro} data-mayus={!!t.mayus}>
      <Fondo t={t} />
      <div className="tur-cont" style={{ paddingTop: 48, paddingBottom: 24 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 20px' }}>
            <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
              <circle cx="60" cy="60" r="58" fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="1.5 6" strokeLinecap="round" />
              <circle className="tur-sello-onda" cx="60" cy="60" r="46" fill="none" stroke={tono} strokeWidth="1.5" opacity="0" />
              <circle cx="60" cy="60" r="46" fill="var(--color-primary-bg)" />
              {/* Arranca arriba (rotate -90) y cierra la vuelta en el sentido del reloj */}
              <circle className="tur-sello-anillo" cx="60" cy="60" r="46" fill="none" stroke={tono} strokeWidth="3.5" strokeLinecap="round" transform="rotate(-90 60 60)" />
              {!espera && <path className="tur-sello-check" d="M41 61 L54 74 L80 46" fill="none" stroke="var(--color-text)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" style={{ ['--largo' as string]: 60 }} />}
              <g className="tur-sello-sat"><circle cx="60" cy="2" r="4" fill={tono} stroke="var(--color-bg)" strokeWidth="1.5" /></g>
            </svg>
            {espera && <Hourglass size={38} aria-hidden style={{ position: 'absolute', inset: 0, margin: 'auto', color: 'var(--color-text)' }} />}
          </div>
          <h1 ref={titulo} tabIndex={-1} className="tur-h tur-entra" style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700 }}>
            {espera ? 'Estás en la lista de espera' : `¡Listo${primero ? `, ${primero}` : ''}! ${cierre}`}
          </h1>
          <p className="tur-bajada tur-entra" style={{ margin: '14px auto 0', maxWidth: 470, fontSize: 17, ['--i' as string]: 1 }}>
            {espera
              ? 'La clase está completa. Si se libera un lugar te escribimos por WhatsApp para que lo confirmes.'
              : `${sena ? `Recibimos tu seña de ${pesos(sena)}. ` : ''}Tu turno quedó reservado para ${cuando.toLowerCase()}.`}
          </p>
        </div>

        <div className="tur-entrada tur-entra" style={{ marginTop: 36, ['--i' as string]: 2 }}>
          <div style={{ padding: '26px 28px 28px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <Marca t={t} />
              <span className="tur-h" style={{ fontSize: 19, fontWeight: 700, flex: 1, minWidth: 0 }}>{t.nombre}</span>
              <span className="tur-estado" style={{ color: espera ? 'var(--tur-aviso)' : 'var(--tur-ok)' }}>
                {espera ? <Hourglass size={13} aria-hidden /> : <Check size={13} strokeWidth={3} aria-hidden />} {espera ? 'En espera' : 'Confirmado'}
              </span>
            </div>
            <div className="tur-rotulo">{rubro.modo === 'cupo' ? 'Clase' : 'Servicio'}</div>
            <div className="tur-h" style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 700, margin: '6px 0 24px' }}>{servicio}</div>
            <div className="tur-datos-entrada">
              <Dato k="Fecha" v={fechaLarga(fecha)} />
              <Dato k="Hora" v={<span className="tur-num" style={{ fontSize: 22, fontWeight: 600 }}>{horaTxt(inicio)}</span>} sub={`Hasta las ${horaTxt(inicio + duracion)} · ${duracionTxt(duracion)}`} />
              {recurso && (
                <Dato k={recurso.rotulo} v={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    {recurso.retrato && <img src={recurso.retrato} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
                    {recurso.nombre}
                  </span>
                )} />
              )}
              {lugar === 'local' && <Dato k="Dónde" v={t.direccion} sub={t.barrio} />}
              {lugar === 'domicilio' && <Dato k="Dónde" v="A domicilio" sub={domicilio.trim() || undefined} />}
              {sena > 0 && <Dato k="Seña" v={<span className="tur-num">{pesos(sena)} pagados</span>} sub={`Resta ${pesos(precio - sena)} el día del turno`} />}
            </div>
          </div>
          <div className="tur-entrada-talon">
            {espera ? (
              <>
                <Hourglass size={34} aria-hidden style={{ color: 'var(--color-text)', flexShrink: 0 }} />
                <div>
                  <div className="tur-rotulo">Lista de espera</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-body)', marginTop: 6 }}>Todavía no tenés lugar. Te avisamos apenas haya uno.</div>
                </div>
              </>
            ) : (
              <>
                <div className="tur-qr"><QR texto={urlTurno(t.nombre)} size={132} titulo={`Código QR de la reserva ${CODIGO_DEMO}`} /></div>
                <div>
                  <div className="tur-rotulo">Reserva</div>
                  <div className="tur-num" style={{ fontSize: 19, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text)', marginTop: 2 }}>{CODIGO_DEMO}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--color-body)', marginTop: 6 }}>{lugar === 'local' ? 'Mostrá el QR cuando llegues.' : 'Es el comprobante de tu reserva.'}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Con cuenta: lo que sumó con esta reserva. */}
        {conCuenta && (
          <div className="tur-premio tur-entra" style={{ ['--i' as string]: 3 }}>
            {sellos > 0 && <TarjetaSellos total={sellos} hechos={sellosHechos} nombre={t.nombre} compacta />}
            <div style={{ minWidth: 0 }}>
              <b>{cuenta === 'nueva' ? 'Tu cuenta quedó creada' : 'Sumaste con tu cuenta'}</b>
              <span>
                {sellos > 0
                  ? `Con este turno llegás a ${sellosHechos} de ${sellos} sellos${sellosHechos >= sellos ? ': ¡tenés tu premio!' : `. Te ${sellos - sellosHechos === 1 ? 'falta 1' : `faltan ${sellos - sellosHechos}`} para el premio.`}`
                  : 'Desde tu cuenta ves tus turnos y los cambiás cuando quieras.'}
                {cuenta === 'nueva' && ' Para entrar no hace falta contraseña: usás tu celular.'}
              </span>
            </div>
          </div>
        )}

        <div className="tur-acciones tur-entra" style={{ marginTop: 28, ['--i' as string]: 3 }}>
          {!espera && (
            <button type="button" className="tur-btn" onClick={() => descargarICS({ titulo: `${servicio} · ${t.nombre}`, fecha, inicio, duracion, lugar: dondeTxt })}>
              <CalendarPlus size={18} aria-hidden /> Agregar al calendario
            </button>
          )}
          {lugar === 'local' && <a className="tur-btn tur-btn--sec" href={linkMapa(t.direccion, t.barrio)} target="_blank" rel="noopener noreferrer"><Navigation size={17} aria-hidden /> Cómo llegar</a>}
          {!espera && <a className="tur-btn tur-btn--sec" href={linkWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden /> Compartir por WhatsApp</a>}
        </div>

        <div className="tur-aviso tur-entra" style={{ maxWidth: 760, margin: '24px auto 0', ['--i' as string]: 4 }}>
          <BellRing size={20} aria-hidden style={{ flexShrink: 0, color: 'var(--color-text)' }} />
          <span style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-body)' }}>
            {espera
              ? 'El aviso llega al WhatsApp que dejaste. Mientras tanto no se te cobra nada.'
              : recordatorio
                ? 'Te llega la confirmación por WhatsApp y un recordatorio el día antes, con un link por si necesitás cambiarlo.'
                : 'Te llega la confirmación por WhatsApp. Desactivaste el recordatorio del día anterior.'}
          </span>
        </div>

        {/* Reservó sin cuenta y el negocio ofrece beneficios: se lo cuenta una vez, sin insistir. */}
        {cuenta === 'invitado' && !espera && paraSumar.length > 0 && (
          <div className="tur-aviso tur-entra" style={{ maxWidth: 760, margin: '12px auto 0', ['--i' as string]: 4 }}>
            <Gift size={20} aria-hidden style={{ flexShrink: 0, color: 'var(--color-text)' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-body)' }}>
              Reservaste sin cuenta, y está perfecto. Si un día querés sumar {paraSumar.map(b => b.titulo.toLowerCase()).join(', ')}, la creás en un minuto.
            </span>
            <Link href={ruta('mis-turnos', rubro.key, { forma })} className="tur-enlace" style={{ flexShrink: 0 }}>Crear cuenta</Link>
          </div>
        )}

        <div className="tur-entra" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 30, ['--i' as string]: 5 }}>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--color-body)', textAlign: 'center' }}>
            ¿Necesitás cambiarlo? <Link href={ruta('mis-turnos', rubro.key, { forma })} className="tur-enlace">Gestioná tus turnos <ArrowRight size={15} aria-hidden /></Link>
          </p>
          <FirmaOrbita />
        </div>
      </div>
    </div>
  )
}

function Dato({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="tur-rotulo">{k}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginTop: 5, overflowWrap: 'anywhere' }}>{v}</div>
      {sub && <div style={{ fontSize: 13.5, color: 'var(--color-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/** El negocio todavía no publicó su agenda (?estado=vacio). */
export function SinAgenda({ rubro, t }: { rubro: RubroTurnos; t: TemaNegocio }) {
  const contactar = useContacto()
  const forma = useForma()
  return (
    <div className="tur" data-oscuro={t.oscuro} data-mayus={!!t.mayus}>
      <Fondo t={t} />
      <div className="tur-cont" style={{ paddingTop: 64, paddingBottom: 24 }}>
        <div className="tur-vacio">
          <OrbitaVacia><CalendarX2 size={40} strokeWidth={1.5} aria-hidden /></OrbitaVacia>
          <h1 className="tur-h tur-entra" style={{ fontSize: 'clamp(30px, 4.6vw, 44px)', fontWeight: 700, marginTop: 8 }}>Todavía no hay turnos para reservar</h1>
          <p className="tur-bajada tur-entra" style={{ margin: '14px auto 0', ['--i' as string]: 1 }}>
            {t.nombre} está armando su agenda. Mientras tanto podés escribirles por WhatsApp y coordinar directo.
          </p>
          <div className="tur-acciones tur-entra" style={{ marginTop: 28, ['--i' as string]: 2 }}>
            <button type="button" className="tur-btn" onClick={() => contactar({ canal: 'whatsapp', texto: `Hola ${t.nombre}, quiero sacar un turno.` })}><MessageCircle size={18} aria-hidden /> Escribir por WhatsApp</button>
            <Link href={ruta('inicio', rubro.key, { forma })} className="tur-btn tur-btn--sec">Volver al inicio</Link>
          </div>
          <div className="tur-entra" style={{ marginTop: 34, ['--i' as string]: 3 }}><FirmaOrbita texto="Reservas con Órbita" /></div>
        </div>
      </div>
    </div>
  )
}

/** Órbitas vacías con un ícono en el centro: la ilustración de los estados sin contenido. */
export function OrbitaVacia({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto', display: 'grid', placeItems: 'center', color: 'var(--color-text)' }}>
      <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden style={{ position: 'absolute', inset: 0 }}>
        <circle cx="110" cy="110" r="104" fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="1.5 7" strokeLinecap="round" />
        <circle cx="110" cy="110" r="78" fill="none" stroke="var(--color-border)" strokeWidth="1.2" />
        <circle cx="110" cy="110" r="50" fill="var(--color-primary-bg)" stroke="var(--color-primary)" strokeOpacity="0.5" strokeWidth="1.2" />
        <g className="tur-vacio-sat"><circle cx="110" cy="32" r="5" fill="var(--color-primary)" stroke="var(--color-bg)" strokeWidth="2" /></g>
        <g className="tur-vacio-sat2"><circle cx="214" cy="110" r="3.5" fill="var(--color-muted)" /></g>
      </svg>
      <span style={{ position: 'relative', display: 'grid' }}>{children}</span>
    </div>
  )
}
