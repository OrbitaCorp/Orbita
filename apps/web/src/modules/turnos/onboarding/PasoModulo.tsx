// Primer paso del alta: con qué módulo arranca el negocio. Son dos tarjetas
// grandes (radios de verdad, se recorren con las flechas): cada una muestra en
// chico cómo se ve el producto, qué trae y para quién es. Lo que se elige acá
// decide qué estaciones suma el arco de arriba.
import { CalendarClock, Check, ShoppingBag, ShoppingCart, type LucideIcon } from 'lucide-react'
import { arco } from '@/modules/turnos/_shared/orbita/geometria'
import { pasosDe, type Modulo } from './modelo'

const MODULOS: { id: Modulo; Icon: LucideIcon; titulo: string; bajada: string; puntos: string[]; para: string }[] = [
  {
    id: 'tienda', Icon: ShoppingBag, titulo: 'Tienda online', bajada: 'Vendé tus productos con catálogo, carrito y cobro online.',
    puntos: ['Catálogo con variantes, fotos y stock', 'Cobrás con Mercado Pago o por transferencia', 'Pedidos, clientes y cupones en un solo panel'],
    para: 'Indumentaria, electrónica, almacenes, regalería…',
  },
  {
    id: 'turnos', Icon: CalendarClock, titulo: 'Turnos y reservas', bajada: 'Tus clientes reservan solos, a cualquier hora y sin llamarte.',
    puntos: ['Agenda por profesional, sala, cancha o clase con cupo', 'Recordatorios por WhatsApp y seña con Mercado Pago', 'Tu página de reservas, con link y QR'],
    para: 'Barberías, consultorios, estética, gimnasios, canchas…',
  },
]

const PRODUCTOS = [
  { nombre: 'Remera lisa', precio: '$18.900', fondo: 'linear-gradient(135deg, #60A5FA, #4F46E5)' },
  { nombre: 'Zapatillas', precio: '$64.500', fondo: 'linear-gradient(135deg, #F0ABFC, #818CF8)' },
  { nombre: 'Mochila', precio: '$32.000', fondo: 'linear-gradient(135deg, #5EEAD4, #3B82F6)' },
]

/** Una vidriera en miniatura: la barra del navegador, tres productos y el carrito. */
function IluTienda() {
  return (
    <div className="tuob-ilu tuob-ilu--tienda" aria-hidden>
      <div className="tuob-ilu-barra">
        <i /><i /><i />
        <span className="tuo-num">tunegocio.orbita.site</span>
        <b className="tuo-num"><ShoppingCart size={11} strokeWidth={2.2} /> 2</b>
      </div>
      <div className="tuob-ilu-prods">
        {PRODUCTOS.map(p => (
          <div key={p.nombre}>
            <span style={{ background: p.fondo }} />
            <em>{p.nombre}</em>
            <strong className="tuo-num">{p.precio}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

/** El día en órbita, en miniatura: los turnos como tramos del anillo y los horarios para elegir. */
function IluTurnos() {
  return (
    <div className="tuob-ilu tuob-ilu--turnos" aria-hidden>
      <svg viewBox="0 0 120 120" width="118" height="118">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(147,197,253,0.24)" strokeDasharray="2 6" strokeLinecap="round" />
        <circle cx="60" cy="60" r="41" fill="none" stroke="rgba(147,197,253,0.13)" strokeWidth="9" />
        <path d={arco(60, 60, 41, -90, -22)} fill="none" stroke="#60A5FA" strokeWidth="9" strokeLinecap="round" />
        <path d={arco(60, 60, 41, 4, 66)} fill="none" stroke="#818CF8" strokeWidth="9" strokeLinecap="round" />
        <path d={arco(60, 60, 41, 104, 150)} fill="none" stroke="#34D399" strokeWidth="9" strokeLinecap="round" />
        <g className="tuob-gira" style={{ transformOrigin: '60px 60px', animation: 'tuoGira 16s linear infinite' }}>
          <circle cx="60" cy="6" r="7" fill="#93C5FD" opacity="0.22" />
          <circle cx="60" cy="6" r="3.2" fill="#EFF6FF" />
        </g>
        <text x="60" y="54" textAnchor="middle" fontSize="7.5" letterSpacing="1.4" fontFamily='"Geist Mono", monospace' fill="#8794B2">HOY</text>
        <text x="60" y="72" textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="-0.6" fontFamily="'Sora', sans-serif" fill="#F1F5FD">15:30</text>
      </svg>
      <div className="tuob-ilu-horas">
        <span className="tuo-num">15:00</span>
        <span className="tuo-num" data-sel="true">15:30</span>
        <span className="tuo-num">16:00</span>
        <b><Check size={11} strokeWidth={3} /> Turno confirmado</b>
      </div>
    </div>
  )
}

export function PasoModulo({ elegido, onElegir }: { elegido: Modulo | null; onElegir: (m: Modulo) => void }) {
  return (
    <div className="tuob-ancho tuob-ancho--medio">
      <div className="tuob-modulos" role="radiogroup" aria-label="Módulo">
        {MODULOS.map(m => {
          const sel = elegido === m.id
          const id = `tuob-modulo-${m.id}`
          return (
            // El radio ocupa toda la tarjeta (invisible, por encima): se elige
            // tocando en cualquier lado y adentro puede haber títulos y listas.
            <div key={m.id} className="tuob-modulo" data-elegido={sel}>
              <input type="radio" name="tuob-modulo" value={m.id} checked={sel} onChange={() => onElegir(m.id)} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d ${id}-l`} />
              <div className="tuob-modulo-ilu">{m.id === 'tienda' ? <IluTienda /> : <IluTurnos />}</div>
              <div className="tuob-modulo-cuerpo">
                <div className="tuob-modulo-cab">
                  <span className="tuob-modulo-icono"><m.Icon size={22} strokeWidth={1.75} aria-hidden /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 id={`${id}-t`}>{m.titulo}</h2>
                    <p id={`${id}-d`}>{m.bajada}</p>
                  </div>
                  <i className="tuob-marca-opcion" aria-hidden><Check size={13} strokeWidth={3.2} /></i>
                </div>
                <ul id={`${id}-l`} className="tuob-modulo-lista">
                  {m.puntos.map(p => <li key={p}><Check size={15} strokeWidth={2.6} aria-hidden /> {p}</li>)}
                </ul>
                <div className="tuob-modulo-pie">
                  <span><b>Para:</b> {m.para}</span>
                  <span className="tuo-chip tuo-chip--primario tuo-num">{pasosDe(m.id).length} pasos</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
