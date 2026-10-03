// La página simple de un negocio de turnos: la otra forma de sitio que puede
// elegir el dueño. No hay menú ni secciones: la portada, el logo, el nombre, una
// descripción corta y UN botón. Se toca y se reserva, paso a paso.
//
// Es la que se pega en la bio de Instagram o se manda por WhatsApp: todo lo que
// hay debajo del botón (dónde atiende, horarios, mis turnos) es apoyo y no
// compite con él. Tiene cinco diseños (DisenoSimple): el contenido es el mismo y
// lo que cambia es la composición, que resuelve el CSS con data-diseno; el
// dueño lo elige en Apariencia. ?diseno= lo prueba sin guardarlo (lo usa la
// vista previa del panel). La reserva y "mis turnos" se abren con el encabezado mínimo
// (forma 'simple' en SitioNegocio) para no salirse de esta página.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { CalendarCheck, ChevronDown, ChevronRight, Clock, Gift, Home, MapPin, MessageCircle } from 'lucide-react'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { tramosDelDia, tramosFrase } from '@/modules/turnos/horario'
import { DISENOS_SIMPLE, beneficiosTxt, useNegocioDemo, type DisenoSimple } from '@/modules/turnos/demo/negocioDemo'
import SitioNegocio from './SitioNegocio'
import { CSS_SIMPLE } from './estilos'
import { Abierto, HorasDia, Marca, proximoLibre, ruta } from './piezas'
import { useContacto } from './ContactoDemo'
import { linkMapa } from './reserva/acciones'
import { altFoto, type TemaNegocio } from './tema'
import { useCalendarioReserva } from './reserva/calendario'

const verbo = (r: RubroTurnos) => r.modo === 'cupo' ? 'Reservar mi lugar' : r.modo === 'cancha' ? 'Reservar cancha' : 'Reservar turno'
const SIMPLE = { forma: 'simple' }

export default function PaginaSimple({ rubro }: { rubro: RubroTurnos }) {
  return (
    <SitioNegocio rubro={rubro} pagina="inicio" forma="simple">
      {t => <Contenido rubro={rubro} t={t} />}
    </SitioNegocio>
  )
}

function Contenido({ rubro, t }: { rubro: RubroTurnos; t: TemaNegocio }) {
  const contactar = useContacto()
  const { demo } = useNegocioDemo()
  const router = useRouter()
  const pedido = router.query.diseno as DisenoSimple
  const diseno = DISENOS_SIMPLE.includes(pedido) ? pedido : demo.simple
  const [verHorarios, setVerHorarios] = useState(false)
  const cal = useCalendarioReserva()
  const HOY = cal.ahora.diaSemana
  const prox = proximoLibre(rubro, cal)
  const beneficios = beneficiosTxt(demo.cuentas, rubro)
  const conLocal = t.modalidades.includes('local')
  const hoy = tramosDelDia(t.horarios, HOY)
  return (
    <>
      <style>{CSS_SIMPLE}</style>
      <div className="tusp" data-diseno={diseno}>
        {/* eslint-disable-next-line @next/next/no-img-element -- demo local */}
        <div aria-hidden className="tusp-fondo"><img src={t.fotoHero} alt="" /></div>
        <article className="tusp-tarjeta tu-entra" aria-labelledby="tusp-nombre">
          <div className="tusp-heroe">
          <div className="tusp-portada">
            {/* eslint-disable-next-line @next/next/no-img-element -- demo local */}
            <img src={t.fotoHero} alt={altFoto(t.fotoHero)} fetchPriority="high" />
            <div className="tusp-estado"><Abierto t={t} corto /></div>
          </div>

          <div className="tusp-cuerpo tusp-arriba">
            <Marca t={t} className="tu-mono tusp-logo" />
            <h1 id="tusp-nombre" className="tu-h tusp-nombre">{t.nombre}</h1>
            <div className="tu-rotulo tusp-lugar">{[rubro.label, t.barrio].filter(Boolean).join(' · ')}</div>
            <p className="tusp-desc">{t.tagline.replace(/\.$/, '')}.</p>

            <Link href={ruta('reserva', rubro.key, SIMPLE)} className="tu-btn tu-btn--lg tusp-cta"><CalendarCheck size={20} aria-hidden /> {verbo(rubro)}</Link>
            <p className="tusp-nota">
              <span>Sin registrarte</span>
              <span className="tusp-nota-punto" aria-hidden />
              <span>{prox.rotulo}: <b>{prox.cuando.toLowerCase()} {prox.hora}</b></span>
            </p>
          </div>
          </div>

          <div className="tusp-cuerpo tusp-abajo">
            <ul className="tusp-datos">
              {conLocal && (
                <li>
                  <a className="tusp-fila" href={linkMapa(t.direccion, t.barrio)} target="_blank" rel="noopener noreferrer" aria-label={`${[t.direccion, t.barrio].filter(Boolean).join(', ')}: abrir en Google Maps (se abre en otra pestaña)`}>
                    <span className="tusp-fila-ico" aria-hidden><MapPin size={18} /></span>
                    <span className="tusp-fila-txt">{t.direccion}<span>{t.barrio || 'Cómo llegar'}</span></span>
                    <ChevronRight size={18} aria-hidden className="tusp-fila-ir" />
                  </a>
                </li>
              )}
              {t.modalidades.includes('domicilio') && (
                <li>
                  <div className="tusp-fila">
                    <span className="tusp-fila-ico" aria-hidden><Home size={18} /></span>
                    <span className="tusp-fila-txt">{conLocal ? 'También a domicilio' : 'A domicilio'}<span>{t.zonas}</span></span>
                  </div>
                </li>
              )}
              <li>
                <button type="button" className="tusp-fila" aria-expanded={verHorarios} aria-controls="tusp-horarios" onClick={() => setVerHorarios(v => !v)}>
                  <span className="tusp-fila-ico" aria-hidden><Clock size={18} /></span>
                  <span className="tusp-fila-txt">{hoy.length ? `Hoy, ${tramosFrase(hoy)}` : 'Hoy está cerrado'}<span>{verHorarios ? 'Ocultar los horarios' : 'Ver todos los horarios'}</span></span>
                  <ChevronDown size={18} aria-hidden className="tusp-fila-ir" />
                </button>
                {verHorarios && (
                  <dl id="tusp-horarios" className="tusp-horarios tu-entra">
                    {t.horarios.map(([d, h], i) => (
                      <div key={d} data-hoy={i === HOY} data-cerrado={!h}>
                        <dt>{d}</dt><dd><HorasDia texto={h} apilado /></dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            </ul>

            {beneficios.length > 0 && (
              <div className="tusp-cuenta">
                <b><Gift size={16} aria-hidden /> Con cuenta, sumás beneficios</b>
                {beneficios.map(b => b.titulo).join(' · ')}. Es opcional: la creás cuando reservás.
              </div>
            )}

            <div className="tusp-links">
              <Link href={ruta('mis-turnos', rubro.key, SIMPLE)} className="tu-btn-sec"><CalendarCheck size={16} aria-hidden /> Mis turnos</Link>
              <button type="button" className="tu-btn-sec" onClick={() => contactar({ canal: 'whatsapp', texto: `Hola ${t.nombre}, quiero hacer una consulta.` })}><MessageCircle size={16} aria-hidden /> WhatsApp</button>
            </div>
          </div>
        </article>
      </div>
    </>
  )
}
