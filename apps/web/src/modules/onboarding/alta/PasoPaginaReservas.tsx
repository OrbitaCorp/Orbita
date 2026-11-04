// "Tu página" en Alquileres y en Gimnasio: lo que ve el cliente cuando entra al
// link. Sus sitios tienen una sola forma (no hay página simple ni plantillas
// como en Turnos), así que lo que se elige acá es la foto de portada, entre las
// del negocio de ejemplo del modo o del rubro. Al costado, un celular muestra
// cómo queda con lo que ya se cargó: nombre, logo, lo que se alquila o las
// clases, los precios y la dirección.
//
// La vista previa es una ilustración (aria-hidden + inert), como la de Turnos
// (VistaPagina.tsx): lo que dice cada cosa ya está en texto al lado.
//
// Usa el código de esos dos módulos (reservas.ts): el alta lo baja recién al
// llegar a este paso (next/dynamic en Alta.tsx). No lo importes de forma estática.
import type { CSSProperties } from 'react'
import { ArrowRight, Check, MapPin, Menu, UserRoundCheck } from 'lucide-react'
import type { AltaAlquiler } from '@/modules/alquileres/onboarding/pasos'
import type { AltaGym } from '@/modules/gimnasio/onboarding/pasos'
import type { PropsPaso } from './campos'
import { iniciales, type DatosAlta } from './modelo'
import { portadaDe, vistaDe, type VistaReservas } from './reservas'

type ModuloReservas = 'alquileres' | 'gimnasio'

const TEXTO: Record<ModuloReservas, { sinRegistro: string; detalle: string; previa: string; pie: string }> = {
  alquileres: {
    sinRegistro: 'Tus clientes reservan sin registrarse',
    detalle: 'Para reservar alcanza con el nombre y el celular. Nadie tiene que crear una cuenta ni acordarse de una contraseña.',
    previa: 'Así la ven tus clientes',
    pie: 'Se recorre hacia abajo, y el botón de reservar acompaña toda la página.',
  },
  gimnasio: {
    sinRegistro: 'Se anotan sin registrarse',
    detalle: 'Para reservar un lugar en una clase alcanza con el nombre y el celular. Con eso entran después a "Mis clases".',
    previa: 'Así se ve tu página',
    pie: 'Horarios, planes y el botón para reservar clase, siempre a mano.',
  },
}

export function PasoPaginaReservas({ d, poner, alquiler, gym }: Pick<PropsPaso, 'd' | 'poner'> & {
  /** Lo que se tocó en los pasos propios del módulo: la vista lo arma encima de sus valores de fábrica. */
  alquiler: Partial<AltaAlquiler>
  gym: Partial<AltaGym>
}) {
  // Lo que va a ver el cliente, armado con lo cargado (el alta solo monta este paso en Alquileres y Gimnasio).
  const vista = vistaDe(d, alquiler, gym)
  if (!vista) return null
  const modulo: ModuloReservas = d.modulo === 'gimnasio' ? 'gimnasio' : 'alquileres'
  const texto = TEXTO[modulo]
  const portada = portadaDe(d, vista)
  const total = vista.fotos.length

  return (
    <div className="tuob-ancho">
      <div className="tuob-pagina">
        <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          <div className="tuob-form">
            <fieldset className="tuob-campo">
              <legend className="tuob-leyenda">Foto de portada</legend>
              <p className="tuob-ayuda" style={{ margin: '2px 0 5px' }}>Es lo primero que se ve al entrar a tu link. Elegí la que más se parezca a tu lugar.</p>
              <div className="tuob-portadas">
                {vista.fotos.map((f, i) => {
                  const sel = f === portada
                  return (
                    // El radio cubre la foto entera (invisible, por encima): se elige tocándola.
                    <label key={f} className="tuob-portada" data-elegido={sel}>
                      <input type="radio" name="tuob-portada" value={f} checked={sel} onChange={() => poner('portada', f)} aria-label={`Foto ${i + 1} de ${total}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element -- demo local con fotos de /public */}
                      <img src={f} alt="" loading="lazy" />
                      <i className="tuob-marca-opcion" aria-hidden><Check size={12} strokeWidth={3.2} /></i>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </div>

          <div className="tuob-form">
            <div className="tuob-sinreg">
              <span className="tuob-sinreg-ico" aria-hidden><UserRoundCheck size={20} strokeWidth={1.8} /></span>
              <div style={{ minWidth: 0 }}>
                <strong>{texto.sinRegistro}</strong>
                <p>{texto.detalle}</p>
              </div>
            </div>
            <p className="tuob-ayuda">Esto es un punto de partida: el nombre, la descripción y los precios se cambian después en el panel, en Configuración.</p>
          </div>
        </div>

        <aside id="tuob-previa" className="tuob-pagina-vista" aria-label="Vista previa de tu página">
          <div className="tuo-eyebrow">{texto.previa}</div>
          <Vista d={d} vista={vista} portada={portada} />
          <p className="tuob-ayuda" style={{ textAlign: 'center', maxWidth: 280 }}>{texto.pie}</p>
        </aside>
      </div>
    </div>
  )
}

/** El sitio del módulo, en chico y en un celular: se recorre solo de arriba abajo (CSS, sin timers). */
function Vista({ d, vista, portada }: { d: DatosAlta; vista: VistaReservas; portada: string }) {
  const nombre = d.negocio.trim() || 'Tu negocio'
  const descripcion = d.descripcion.trim() || `${vista.etiqueta}, con reserva online desde el celular.`
  const lugar = [d.direccion.trim(), d.ciudad.trim()].filter(Boolean).join(', ') || 'Tu dirección'
  const avatar = d.logo
    // eslint-disable-next-line @next/next/no-img-element -- demo local: data URL del logo recién subido
    ? <img src={d.logo} alt="" />
    : iniciales(nombre)
  // Los sitios de Alquileres y Gimnasio son claros, con la letra del cuerpo y el acento del módulo.
  const estilo = {
    '--ms-bg': '#FFFFFF', '--ms-surface': '#F8FAFC', '--ms-alt': '#F1F5F9', '--ms-border': '#E2E8F0',
    '--ms-text': '#0F172A', '--ms-body': '#334155', '--ms-muted': '#64748B', '--ms-primary': vista.color, '--ms-on': '#FFFFFF',
    '--ms-fh': 'var(--tuo-fh)', '--ms-fb': 'var(--tuo-fh)', '--ms-peso': '700', '--ms-rbtn': '10px', '--ms-r': '10px',
  } as CSSProperties

  return (
    <div className="tuob-tel" aria-hidden inert>
      <span className="tuob-tel-isla" />
      {/* key = portada: al elegir otra foto la pantalla entra de nuevo. */}
      <div key={portada} className="tuob-tel-pantalla tuob-ms" data-forma="web" style={estilo}>
        <div className="tuob-ms-rollo">
          <div className="tuob-ms-cab"><span className="tuob-ms-avatar tuob-ms-avatar--chico">{avatar}</span><b>{nombre}</b><Menu size={14} /></div>
          <div className="tuob-ms-hero">
            {/* eslint-disable-next-line @next/next/no-img-element -- demo local con fotos de /public */}
            <img src={portada} alt="" />
            <div className="tuob-ms-hero-txt">
              <span className="tuob-ms-eyebrow">{vista.etiqueta}</span>
              <strong className="tuob-ms-h">{nombre}</strong>
              <span className="tuob-ms-btn">{vista.verbo} <ArrowRight size={12} /></span>
            </div>
          </div>
          <div className="tuob-ms-sec">
            <span className="tuob-ms-eyebrow">{vista.seccion}</span>
            {vista.items.slice(0, 3).map((x, i) => (
              <div key={`${i}-${x.nombre}`} className="tuob-ms-serv">
                <b>{x.nombre}</b>
                <span>{x.detalle}</span>
                {x.precio && <i>{x.precio}</i>}
              </div>
            ))}
          </div>
          {vista.planes.length > 0 && (
            <div className="tuob-ms-sec">
              <span className="tuob-ms-eyebrow">Planes</span>
              {vista.planes.slice(0, 3).map((x, i) => (
                <div key={`${i}-${x.nombre}`} className="tuob-ms-serv"><b>{x.nombre}</b><i>{x.precio}</i></div>
              ))}
            </div>
          )}
          <div className="tuob-ms-sec">
            <span className="tuob-ms-eyebrow">Nosotros</span>
            <p>{descripcion}</p>
          </div>
          <div className="tuob-ms-sec">
            <span className="tuob-ms-eyebrow">Cómo llegar</span>
            <div className="tuob-ms-mapa"><MapPin size={16} /></div>
            <ul className="tuob-ms-datos"><li><MapPin size={11} /> {lugar}</li></ul>
          </div>
          <div className="tuob-ms-sello">Reservas con Órbita</div>
        </div>
        <div className="tuob-ms-cta"><span className="tuob-ms-btn tuob-ms-btn--ancho">{vista.verbo}</span></div>
      </div>
    </div>
  )
}
