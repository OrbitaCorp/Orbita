// Camino Turnos, "Tu página": qué ve el cliente cuando entra al link del
// negocio. Hay dos formas y se elige una:
//   · Sitio web completo → servicios, equipo, nosotros y ubicación, con el botón
//     de reservar siempre a mano.
//   · Página simple → una sola pantalla: portada, logo, nombre, descripción corta
//     y el botón. Se toca y se reserva, paso a paso.
// Al costado, un celular muestra cómo queda con lo que ya se cargó.
//
// Abajo, la cuenta del cliente: reservar NUNCA pide registrarse. Lo que decide
// el dueño es si además ofrece una cuenta opcional y qué gana quien la crea.
import { BellRing, Gift, PanelsTopLeft, Percent, Smartphone, UserRoundCheck } from 'lucide-react'
import type { RubroTurnos } from '@/modules/turnos/datos'
import type { BeneficiosCuenta } from '@/modules/turnos/demo/negocioDemo'
import { Llave } from '@/modules/turnos/_shared/orbita/piezas'
import { Opcion, type PropsPaso } from './campos'
import type { ServicioAlta } from './modelo'
import { VistaPagina } from './VistaPagina'

const BIENVENIDAS = [0, 5, 10, 15, 20]
const SELLOS = [0, 5, 6, 8, 10]

export function PasoPagina({ d, poner, rubro, servicios }: Pick<PropsPaso, 'd' | 'poner'> & { rubro: RubroTurnos; servicios: ServicioAlta[] }) {
  const c = d.cuentas
  const cuenta = (cambio: Partial<BeneficiosCuenta>) => poner('cuentas', { ...c, ...cambio })
  const turno = rubro.modo === 'cupo' ? 'clase' : rubro.modo === 'cancha' ? 'reserva' : 'turno'
  const conEquipo = rubro.modo === 'profesional'

  return (
    <div className="tuob-ancho">
      <div className="tuob-pagina">
        <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          <div className="tuob-form">
            <fieldset className="tuob-campo">
              <legend className="tuob-leyenda">Elegí la forma de tu página</legend>
              <p className="tuob-ayuda" style={{ margin: '2px 0 5px' }}>Las dos llevan tus colores y el botón de reservar. La cambiás cuando quieras desde el panel.</p>
              <div className="tuob-opciones tuob-opciones--pila">
                <Opcion grupo="tuob-forma" valor="web" elegido={d.forma === 'web'} onElegir={() => poner('forma', 'web')} Icon={PanelsTopLeft}
                  titulo="Sitio web completo"
                  texto={<>Una página con secciones para contar quién sos: <b>servicios y precios{conEquipo ? ', equipo' : ''}, nosotros, fotos y cómo llegar</b>. El botón de reservar acompaña toda la página.</>} />
                <Opcion grupo="tuob-forma" valor="simple" elegido={d.forma === 'simple'} onElegir={() => poner('forma', 'simple')} Icon={Smartphone}
                  titulo="Página simple"
                  texto={<>Una sola pantalla: <b>tu portada, tu logo, el nombre, una descripción corta y el botón</b>. Se toca y se reserva, paso a paso. Ideal para el link de Instagram.</>} />
              </div>
            </fieldset>
          </div>

          <div className="tuob-form">
            <div className="tuob-sinreg">
              <span className="tuob-sinreg-ico" aria-hidden><UserRoundCheck size={20} strokeWidth={1.8} /></span>
              <div style={{ minWidth: 0 }}>
                <strong>Tus clientes reservan sin registrarse</strong>
                <p>Para sacar un {turno} alcanza con el nombre y el celular. Nadie tiene que crear una cuenta ni acordarse de una contraseña.</p>
              </div>
            </div>

            <div className="tuob-llave-fila">
              <div style={{ minWidth: 0 }}>
                <strong id="tuob-cuentas-tit">Ofrecer una cuenta opcional con beneficios</strong>
                <p>Quien quiera se la crea al reservar (entra con su celular, sin contraseña) y vos le reconocés que vuelve.</p>
              </div>
              <Llave on={c.activo} onChange={v => cuenta({ activo: v })} label="Ofrecer una cuenta opcional con beneficios" />
            </div>

            {c.activo && (
              <ul className="tuob-benef tuo-entra" aria-labelledby="tuob-cuentas-tit">
                <li>
                  <span className="tuob-benef-ico" aria-hidden><Percent size={17} /></span>
                  <div><label htmlFor="tuob-bienvenida">Descuento de bienvenida</label><p>En el primer {turno} con cuenta.</p></div>
                  <select id="tuob-bienvenida" className="tuob-input tuob-input--mono" value={c.bienvenida} onChange={e => cuenta({ bienvenida: Number(e.target.value) })}>
                    {BIENVENIDAS.map(p => <option key={p} value={p}>{p === 0 ? 'No ofrecer' : `${p}%`}</option>)}
                  </select>
                </li>
                <li>
                  <span className="tuob-benef-ico" aria-hidden><Gift size={17} /></span>
                  <div><label htmlFor="tuob-sellos">Tarjeta de sellos</label><p>Un sello por {turno}; al completarla, un premio.</p></div>
                  <select id="tuob-sellos" className="tuob-input tuob-input--mono" value={c.sellos} onChange={e => cuenta({ sellos: Number(e.target.value) })}>
                    {SELLOS.map(n => <option key={n} value={n}>{n === 0 ? 'No ofrecer' : `${n} sellos`}</option>)}
                  </select>
                </li>
                <li>
                  <span className="tuob-benef-ico" aria-hidden><BellRing size={17} /></span>
                  <div><strong id="tuob-promos-tit">Promos por WhatsApp</strong><p>Les avisás primero cuando hay una promo o se libera un horario.</p></div>
                  <Llave on={c.promos} onChange={v => cuenta({ promos: v })} label="Promos por WhatsApp" />
                </li>
              </ul>
            )}
            <p className="tuob-ayuda">Esto es un punto de partida: el premio, los porcentajes y los mensajes se ajustan después en el panel, en Configuración.</p>
          </div>
        </div>

        <aside id="tuob-previa" className="tuob-pagina-vista" aria-label="Vista previa de tu página">
          <div className="tuo-eyebrow">Así la ven tus clientes</div>
          <VistaPagina forma={d.forma} rubro={rubro} d={d} servicios={servicios} />
          <p className="tuob-ayuda" style={{ textAlign: 'center', maxWidth: 280 }}>
            {d.forma === 'web' ? 'Sitio web completo: se recorre hacia abajo, sección por sección.' : 'Página simple: tocan el botón y sacan el turno en tres pasos, sin registrarse.'}
          </p>
        </aside>
      </div>
    </div>
  )
}
