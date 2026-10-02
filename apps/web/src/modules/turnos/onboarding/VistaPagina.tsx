// Vista previa de "Tu página" adentro de un celular: cómo va a quedar lo que
// ve el cliente con cada una de las dos formas. Se arma con lo que el dueño ya
// cargó (nombre, descripción, logo, servicios, horarios) y con los colores y
// tipografías de la plantilla de su rubro.
//
//  · Sitio web completo → la página se recorre sola, despacio, de arriba abajo:
//    se ve todo lo que tiene (portada, servicios, equipo, nosotros, cómo llegar).
//  · Página simple → se ve la reserva de un turno, paso a paso: la página, el
//    toque en "Reservar", el servicio, el día y la hora, los datos y el turno
//    confirmado. Son cinco pantallas que se turnan solas (CSS, sin timers).
//
// Es una ilustración, no el sitio real (que vive en storefront/): por eso va
// con aria-hidden + inert. Lo que dice cada opción ya está en texto al lado.
// Con "reducir movimiento" queda quieta: la página simple muestra su portada.
import type { CSSProperties, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Clock, Gift, MapPin, Menu, MessageCircle, Sun, Sunset } from 'lucide-react'
import { duracionTxt, pesos, type RubroTurnos } from '@/modules/turnos/datos'
import { beneficiosTxt, type FormaSitio } from '@/modules/turnos/demo/negocioDemo'
import { hhmm, tramosDeJornada, type Bloque } from '@/modules/turnos/horario'
import { RETRATOS, temaDe } from '@/modules/turnos/storefront/tema'
import { diasTxt, horarioTxt, iniciales, modalidadesAlta, type DatosAlta, type ServicioAlta } from './modelo'

interface Props { forma: FormaSitio; rubro: RubroTurnos; d: DatosAlta; servicios: ServicioAlta[] }

/** Los tres primeros horarios de un turno de atención (mañana o tarde), cada media hora. */
const horasDe = (b: Bloque) => (b.on && b.hasta > b.desde ? [0, 30, 60].map(m => b.desde + m).filter(m => m < b.hasta) : [])

export function VistaPagina({ forma, rubro, d, servicios }: Props) {
  const t = temaDe(rubro)
  const nombre = d.negocio.trim() || 'Tu negocio'
  const descripcion = d.descripcion.trim() || `${rubro.label} con reserva online. Elegí día y horario en un minuto, sin llamar.`
  const verbo = rubro.modo === 'cupo' ? 'Reservar lugar' : rubro.modo === 'cancha' ? 'Reservar cancha' : 'Reservar turno'
  const marcadas = modalidadesAlta(d, rubro)
  const local = marcadas.includes('local')
  const lugar = local ? [d.direccion.trim(), d.ciudad.trim()].filter(Boolean).join(', ') || 'Tu dirección'
    : `A domicilio${d.ciudad.trim() ? ` en ${d.ciudad.trim()}` : ''}`
  const horario = `${diasTxt(d.dias)} · ${horarioTxt(d) || 'Sin horario'}`
  const beneficio = beneficiosTxt(d.cuentas, rubro)[0]
  const avatar = d.logo
    // eslint-disable-next-line @next/next/no-img-element -- demo local: data URL del logo recién subido
    ? <img src={d.logo} alt="" />
    : iniciales(nombre)
  const lista = servicios.filter(s => s.nombre.trim()).slice(0, 3)

  const estilo = {
    '--ms-bg': t.c.bg, '--ms-surface': t.c.surface, '--ms-alt': t.c.surfaceAlt, '--ms-border': t.c.border,
    '--ms-text': t.c.text, '--ms-body': t.c.body, '--ms-muted': t.c.muted, '--ms-primary': t.c.primary, '--ms-on': t.c.onPrimary,
    '--ms-fh': t.fh, '--ms-fb': t.fb, '--ms-peso': String(t.pesoTitulo),
    '--ms-rbtn': t.boton === 'pildora' ? '999px' : t.boton === 'suave' ? '9px' : `${t.radio}px`, '--ms-r': `${Math.min(t.radio, 12)}px`,
  } as CSSProperties

  // ── Lo que "elige" la persona en la reserva de ejemplo ──
  const elegido = lista[Math.min(1, lista.length - 1)]
  const manana = horasDe(d.jornada.manana)
  const tarde = horasDe(d.jornada.tarde)
  // Elige un horario de la tarde si la hay; si no, de la mañana.
  const hora = tarde[1] ?? tarde[0] ?? manana[1] ?? manana[0] ?? tramosDeJornada(d.jornada)[0]?.[0] ?? 10 * 60
  const cabecera = (paso: number, titulo: string) => (
    <>
      <div className="tuob-esc-cab"><ArrowLeft size={12} /><span className="tuob-ms-avatar tuob-ms-avatar--chico">{avatar}</span><b>{nombre}</b></div>
      <div className="tuob-esc-paso">Paso {paso} de 3</div>
      <strong className="tuob-ms-h tuob-esc-tit">{titulo}</strong>
    </>
  )
  const escena = (k: number, hijos: ReactNode) => <div className="tuob-esc" style={{ ['--k' as string]: k }}>{hijos}</div>

  return (
    <div className="tuob-tel" aria-hidden inert>
      <span className="tuob-tel-isla" />
      {/* key = forma: al cambiar de opción la pantalla entra de nuevo. */}
      <div key={forma} className="tuob-tel-pantalla tuob-ms" data-forma={forma} data-mayus={!!t.mayus} style={estilo}>
        {forma === 'simple' ? (
          <>
            {/* 1 · La página: una sola pantalla con el botón */}
            {escena(0, <>
              {/* eslint-disable-next-line @next/next/no-img-element -- demo local con fotos de /public */}
              <div className="tuob-ms-portada"><img src={t.fotoHero} alt="" /></div>
              <div className="tuob-ms-centro">
                <span className="tuob-ms-avatar">{avatar}</span>
                <strong className="tuob-ms-h">{nombre}</strong>
                <span className="tuob-ms-eyebrow">{rubro.label}</span>
                <p>{descripcion}</p>
                <span className="tuob-ms-btn tuob-ms-btn--ancho tuob-esc-pulso">{verbo} <ArrowRight size={12} /><i className="tuob-dedo" /></span>
                <span className="tuob-ms-nota">Sin registrarte: solo tu nombre y tu celular</span>
                <ul className="tuob-ms-datos">
                  <li><Clock size={11} /> {horario}</li>
                  <li><MapPin size={11} /> {lugar}</li>
                </ul>
                {beneficio && <span className="tuob-ms-benef"><Gift size={11} /> Con cuenta: {beneficio.titulo.toLowerCase()}</span>}
              </div>
            </>)}

            {/* 2 · Qué se quiere hacer */}
            {escena(1, <>
              {cabecera(1, rubro.modo === 'cupo' ? 'Elegí la clase' : rubro.modo === 'cancha' ? '¿Qué querés jugar?' : 'Elegí el servicio')}
              <div className="tuob-esc-lista">
                {lista.map(s => (
                  <div key={s.id} className="tuob-esc-op" data-el={s.id === elegido?.id || undefined}>
                    <span><b>{s.nombre}</b><small>{duracionTxt(s.duracion)}</small></span>
                    <i>{pesos(s.precio)}</i>
                    {s.id === elegido?.id && <i className="tuob-dedo" />}
                  </div>
                ))}
              </div>
            </>)}

            {/* 3 · Día y horario: mañana y tarde, como atiende el negocio */}
            {escena(2, <>
              {cabecera(2, 'Día y horario')}
              <div className="tuob-esc-dias">
                {[['Hoy', '26'], ['Lun', '28'], ['Mar', '29'], ['Mié', '30']].map(([dia, n], i) => <span key={n} data-sel={i === 1 || undefined}><small>{dia}</small><b>{n}</b></span>)}
              </div>
              {manana.length > 0 && <>
                <div className="tuob-esc-franja"><Sun size={10} /> Mañana</div>
                <div className="tuob-esc-horas">{manana.map(m => <span key={m} data-el={m === hora || undefined}>{hhmm(m)}{m === hora && <i className="tuob-dedo" />}</span>)}</div>
              </>}
              {tarde.length > 0 && <>
                <div className="tuob-esc-franja"><Sunset size={10} /> Tarde</div>
                <div className="tuob-esc-horas">{tarde.map(m => <span key={m} data-el={m === hora || undefined}>{hhmm(m)}{m === hora && <i className="tuob-dedo" />}</span>)}</div>
              </>}
            </>)}

            {/* 4 · Los datos: nombre y celular, sin cuenta */}
            {escena(3, <>
              {cabecera(3, 'Tus datos')}
              <div className="tuob-esc-campo"><small>Nombre y apellido</small><span>Sofía Ramírez</span></div>
              <div className="tuob-esc-campo"><small>Celular (WhatsApp)</small><span>11 5555 0000</span></div>
              <div className="tuob-esc-resumen">
                <span>{elegido?.nombre ?? 'Tu servicio'}</span>
                <b>Lun 28 · {hhmm(hora)}</b>
              </div>
              <span className="tuob-ms-btn tuob-ms-btn--ancho tuob-esc-pulso">Confirmar reserva<i className="tuob-dedo" /></span>
              <span className="tuob-ms-nota" style={{ textAlign: 'center' }}>Sin crear una cuenta ni una contraseña</span>
            </>)}

            {/* 5 · Listo */}
            {escena(4, <div className="tuob-esc-ok">
              <span className="tuob-esc-tilde"><Check size={22} strokeWidth={3} /></span>
              <strong className="tuob-ms-h">¡Turno confirmado!</strong>
              <div className="tuob-esc-ticket">
                <small>{nombre}</small>
                <b>{elegido?.nombre ?? 'Tu servicio'}</b>
                <span><CalendarCheck size={11} /> Lunes 28 · {hhmm(hora)}</span>
                <span><MapPin size={11} /> {lugar}</span>
              </div>
              <span className="tuob-esc-wa"><MessageCircle size={11} /> Le llega la confirmación por WhatsApp</span>
            </div>)}

            <div className="tuob-esc-puntos">{[0, 1, 2, 3, 4].map(k => <i key={k} style={{ ['--k' as string]: k }} />)}</div>
          </>
        ) : (
          <>
            <div className="tuob-ms-rollo">
              <div className="tuob-ms-cab"><span className="tuob-ms-avatar tuob-ms-avatar--chico">{avatar}</span><b>{nombre}</b><Menu size={14} /></div>
              <div className="tuob-ms-hero">
                {/* eslint-disable-next-line @next/next/no-img-element -- demo local con fotos de /public */}
                <img src={t.fotoHero} alt="" />
                <div className="tuob-ms-hero-txt">
                  <span className="tuob-ms-eyebrow">{rubro.label}</span>
                  <strong className="tuob-ms-h">{t.titular[0]} <em>{t.titular[1]}</em></strong>
                  <span className="tuob-ms-btn">{verbo} <ArrowRight size={12} /></span>
                </div>
              </div>
              <div className="tuob-ms-sec">
                <span className="tuob-ms-eyebrow">{rubro.modo === 'cupo' ? 'Actividades' : rubro.modo === 'cancha' ? 'Canchas' : 'Servicios'}</span>
                {lista.map(s => (
                  <div key={s.id} className="tuob-ms-serv">
                    <b>{s.nombre}</b>
                    <span>{duracionTxt(s.duracion)}</span>
                    <i>{pesos(s.precio)}</i>
                  </div>
                ))}
              </div>
              {rubro.modo === 'profesional' && (
                <div className="tuob-ms-sec">
                  <span className="tuob-ms-eyebrow">Equipo</span>
                  <div className="tuob-ms-equipo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- demo local con fotos de /public */}
                    {RETRATOS.slice(0, 3).map(r => <img key={r} src={r} alt="" />)}
                  </div>
                </div>
              )}
              <div className="tuob-ms-sec">
                <span className="tuob-ms-eyebrow">Nosotros</span>
                <p>{descripcion}</p>
              </div>
              <div className="tuob-ms-sec">
                <span className="tuob-ms-eyebrow">{local ? 'Cómo llegar' : 'Dónde atendemos'}</span>
                {local && <div className="tuob-ms-mapa"><MapPin size={16} /></div>}
                <ul className="tuob-ms-datos">
                  <li><MapPin size={11} /> {lugar}</li>
                  <li><Clock size={11} /> {horario}</li>
                </ul>
              </div>
              <div className="tuob-ms-sello">Reservas con Órbita</div>
            </div>
            <div className="tuob-ms-cta"><span className="tuob-ms-btn tuob-ms-btn--ancho">{verbo}</span></div>
          </>
        )}
      </div>
    </div>
  )
}
