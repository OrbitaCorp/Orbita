// Propuesta de sección para la landing (orbita.site): Turnos como vertical.
// Se enchufa en PaginaV2 como cualquier otra sección (usa su Seccion, su
// paleta --oc-* y su formulario de contacto) sin tocar nada de la landing.
//
// Turnos todavía NO está lanzado: toda la sección está planteada como un
// adelanto ("En camino", verbos en futuro) y no promete fechas ni precios.
// Es la misma regla del comentario de v2/Rubros.tsx: generar expectativa sin
// vender algo que hoy no funciona. Si se cambia el copy, que siga siendo así.
//
// El protagonista es el dial del día (OrbitaDia), el mismo componente del
// panel: al pasar por un rubro de la nube cambian el mockup y la ficha, que es
// la forma más corta de mostrar que la agenda se arma según el rubro.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowRight, BellRing, CalendarRange, Coins, Globe } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Seccion } from '@/modules/landing/components/v2/Reveal'
import { useContacto } from '@/modules/landing/components/v2/Contacto'
import { FAMILIAS, RUBROS_TURNOS, MODO_LABEL, pesos, duracionTxt, recursosDe, turnosDeHoy, clientesDe, rubroPorKey, type FamiliaId } from '@/modules/turnos/datos'
import { EstiloTurnos } from '@/modules/turnos/_shared/orbita/estilo'
import { OrbitaDia } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { Estrellas } from '@/modules/turnos/_shared/orbita/Cielo'
import { useReloj } from '@/modules/turnos/reloj'
import { CSS_LANDING_TURNOS } from './estilo'

const QUE_TRAE: { titulo: string; texto: string; Icon: LucideIcon }[] = [
  { titulo: 'Reservas online las 24 h', texto: 'Tus clientes van a elegir servicio, con quién y a qué hora desde tu página, sin escribirte ni esperar que contestes.', Icon: Globe },
  { titulo: 'Recordatorios automáticos', texto: 'Un aviso antes del turno para que nadie se olvide. Menos ausencias y menos huecos en el día.', Icon: BellRing },
  { titulo: 'Seña con Mercado Pago', texto: 'Para los rubros donde faltar sale caro: el turno se confirma recién con la seña paga, en tu cuenta.', Icon: Coins },
  { titulo: 'Agenda a tu medida', texto: 'Por persona, por sala, por cancha o por cupo: se arma según cómo trabaja tu rubro, no al revés.', Icon: CalendarRange },
]

const PASOS = [
  { n: '01', titulo: 'Elegís tu rubro', texto: 'Barbería, consultorio, canchas o clases. Con eso la agenda ya sabe si se reserva una persona, un espacio o un lugar en una clase.' },
  { n: '02', titulo: 'Cargás servicios y horarios', texto: 'Arrancás con los servicios típicos de tu rubro y ajustás duración, precio, seña y los días de cada uno.' },
  { n: '03', titulo: 'Compartís tu link', texto: 'Lo pegás en Instagram o WhatsApp. Tus clientes reservan solos y vos ves el día completo de un vistazo.' },
]

const FAMILIA_CORTA: Record<FamiliaId, string> = { belleza: 'Belleza', salud: 'Salud', deporte: 'Deporte', clases: 'Clases' }

// Qué palabra usa cada modo para "lo que se reserva": la ficha lo muestra tal cual.
const QUE_SE_RESERVA = { profesional: 'Una persona', recurso: 'Una sala o cabina', cancha: 'Una cancha', cupo: 'Un lugar en la clase' } as const

interface Props {
  /** Solo en la demo: reemplaza al formulario de contacto de la landing, que
   *  manda un mail de verdad, por el de la vista previa (no envía nada). */
  onEscribir?: () => void
}

export default function RubrosTurnos({ onEscribir }: Props) {
  const { abrir } = useContacto()
  // `elegido` es el rubro elegido con un clic (o un toque); `pasando`, el que se
  // está señalando con el mouse o el foco. Al salir de la nube vuelve el fijo.
  // En la demo arranca con el rubro que viene en ?rubro=; en la landing real ese
  // parámetro no existe y arranca con barbería. El de la URL se lee en cada
  // pintado y no como estado inicial: si la página se sirve estática, el
  // parámetro recién aparece después de hidratar.
  const router = useRouter()
  const [elegido, setFijo] = useState<string | null>(null)
  const [pasando, setPasando] = useState<string | null>(null)
  const fijo = elegido ?? (typeof router.query.rubro === 'string' ? rubroPorKey(router.query.rubro).key : 'barberia')
  const rubro = rubroPorKey(pasando ?? fijo)

  const recursos = useMemo(() => recursosDe(rubro), [rubro])
  const ahora = useReloj()
  const turnos = useMemo(() => turnosDeHoy(rubro, ahora), [rubro, ahora])
  const clientes = useMemo(() => clientesDe(rubro), [rubro])
  const activos = turnos.filter(t => t.estado !== 'cancelado')

  return (
    <Seccion id="turnos" className="tul">
      {/* El dial usa los keyframes y tokens del kit de Turnos. */}
      <EstiloTurnos />
      <style>{CSS_LANDING_TURNOS}</style>

      <header className="tul-cab tul-rev">
        <span className="tul-ceja"><span className="tul-encamino">En camino</span> Turnos y agenda</span>
        <h2 className="tul-h2">Si tu negocio vive de la agenda, <em>Órbita también va a ser para vos.</em></h2>
        <p className="tul-bajada">
          Estamos construyendo la agenda de Órbita con la misma idea que la tienda: se arma según tu rubro.
          Todavía no está disponible; esto es un adelanto de cómo va a ser.
        </p>
      </header>

      {/* ── Nube de rubros ── */}
      <div className="tul-nube tul-rev" onMouseLeave={() => setPasando(null)}>
        {FAMILIAS.map(f => (
          <div key={f.id} className="tul-familia" role="group" aria-label={f.label}>
            <span className="tul-familia-nombre"><f.Icon size={14} strokeWidth={1.9} aria-hidden /> {FAMILIA_CORTA[f.id]}</span>
            <ul className="tul-chips">
              {RUBROS_TURNOS.filter(r => r.familia === f.id).map(r => (
                <li key={r.key}>
                  <button
                    type="button" className="tul-chip" aria-pressed={fijo === r.key} data-vista={rubro.key === r.key}
                    onClick={() => setFijo(r.key)}
                    onMouseEnter={() => setPasando(r.key)}
                    onFocus={() => setPasando(r.key)} onBlur={() => setPasando(null)}
                  >
                    <r.Icon size={14} strokeWidth={1.9} aria-hidden /> {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="tul-pista">Elegí un rubro y mirá cómo cambia la agenda.</p>
      </div>

      {/* ── Mockup + ficha del rubro ── */}
      <div className="tul-escena tul-rev">
        <div className="tul-marco-caja">
          <div className="tul-marco tuo">
            <div className="tul-marco-barra">
              <i aria-hidden /><i aria-hidden /><i aria-hidden />
              <b>Agenda de hoy · {rubro.label}</b>
              <span>Adelanto</span>
            </div>
            <div className="tuo-espacio tul-marco-cuerpo">
              <Estrellas cantidad={34} />
              <div className="tul-marco-dial">
                <OrbitaDia
                  recursos={recursos} turnos={turnos} ahora={ahora.minutos}
                  nombreCliente={id => clientes.find(c => c.id === id)?.nombre ?? 'Cliente'}
                  pie={`${activos.length} turnos hoy`} size={420}
                />
              </div>
              <ul className="tul-leyenda" aria-label="Un anillo por cada uno">
                {recursos.map(r => (
                  <li key={r.id}><i style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }} aria-hidden /> {r.nombre}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="tul-ficha">
          <span className="tul-ficha-ceja">Así se armaría para</span>
          <div key={rubro.key} className="tul-ficha-cuerpo">
            <div className="tul-ficha-titulo">
              <span className="tul-ficha-icono"><rubro.Icon size={24} strokeWidth={1.7} aria-hidden /></span>
              <h3 className="tul-h3">{rubro.label}</h3>
            </div>
            <p>{rubro.descripcion}. Cada anillo del dial es {rubro.modo === 'profesional' ? 'una persona del equipo' : rubro.modo === 'cancha' ? 'una cancha' : 'un espacio'}; cada tramo, un turno del día.</p>
            <dl className="tul-datos">
              <div className="tul-dato"><dt>Agenda</dt><dd>{MODO_LABEL[rubro.modo]}</dd></div>
              <div className="tul-dato"><dt>Se reserva</dt><dd>{QUE_SE_RESERVA[rubro.modo]}</dd></div>
              <div className="tul-dato"><dt>Seña sugerida</dt><dd>{rubro.sena ? `${rubro.sena}%` : 'Sin seña'}</dd></div>
            </dl>
            <ul className="tul-servicios" aria-label={`Servicios típicos de ${rubro.label}`}>
              {rubro.servicios.slice(0, 4).map(s => (
                <li key={s.nombre}><span>{s.nombre}</span><span>{duracionTxt(s.duracion)} · {pesos(s.precio)}</span></li>
              ))}
            </ul>
            <p className="tul-nota">Servicios y precios de ejemplo: los vas a poder cambiar todos.</p>
          </div>
        </div>
      </div>

      {/* ── Lo que va a traer ── */}
      <div className="tul-sub">
        <div className="tul-sub-cab tul-rev">
          <h3 className="tul-h3">Lo que va a traer</h3>
          <p>Cuatro cosas que hoy se resuelven por mensaje, a mano, y que la agenda va a hacer sola.</p>
        </div>
        <ul className="tul-grilla4 tul-rev" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {QUE_TRAE.map(q => (
            <li key={q.titulo}>
              <div className="tul-card">
                <span className="tul-card-icono"><q.Icon size={20} strokeWidth={1.7} aria-hidden /></span>
                <h4>{q.titulo}</h4>
                <p>{q.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Cómo va a funcionar ── */}
      <div className="tul-sub">
        <div className="tul-sub-cab tul-rev">
          <h3 className="tul-h3">Cómo va a funcionar</h3>
          <p>Tres pasos, sin instalar nada ni saber de tecnología.</p>
        </div>
        <ol className="tul-grilla3 tul-rev" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {PASOS.map(p => (
            <li key={p.n} className="tul-paso">
              <span className="tul-paso-n" aria-hidden>{p.n}</span>
              <div className="tul-card">
                <h4 style={{ marginTop: 0 }}>{p.titulo}</h4>
                <p>{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Cierre ── */}
      <div className="tul-cierre tul-rev">
        <h3 className="tul-h3">¿Tu negocio da turnos?</h3>
        <p>
          Contanos cómo trabajás y qué necesitás de una agenda: nos sirve para construirla.
          Si ya usás Órbita para vender, los turnos se van a sumar a tu misma cuenta, sin migrar nada.
        </p>
        <div className="tul-botones">
          <button type="button" className="tul-btn oc-cta" onClick={onEscribir ?? abrir}>
            Escribinos <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
          </button>
          <Link href="/#modulos" className="tul-btn oc-ghost">Ver lo que Órbita hace hoy</Link>
        </div>
      </div>
    </Seccion>
  )
}
