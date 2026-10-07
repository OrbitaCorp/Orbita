// Primer paso del alta: con qué módulo arranca el negocio. Son dos tarjetas
// grandes (radios de verdad, se recorren con las flechas): cada una dice qué
// trae y para quién es. Lo que se elige acá
// decide qué estaciones suma el arco de arriba. Un módulo que todavía no está
// habilitado (MODULOS_PROXIMAMENTE) se muestra igual, con su cartel de
// "Próximamente", pero no se puede elegir.
import { CalendarClock, Check, Clock, ShoppingBag, type LucideIcon } from 'lucide-react'
import { moduloHabilitado, pasosDe, type Modulo } from './modelo'

// Exportado para Orbi (OrbiAlta.tsx): son las opciones que puede elegir en este paso.
export const MODULOS: { id: Modulo; Icon: LucideIcon; titulo: string; bajada: string; puntos: string[]; para: string }[] = [
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

export function PasoModulo({ elegido, onElegir }: { elegido: Modulo | null; onElegir: (m: Modulo) => void }) {
  return (
    <div className="tuob-ancho tuob-ancho--medio">
      <div className="tuob-modulos" role="radiogroup" aria-label="Módulo">
        {MODULOS.map(m => {
          const habilitado = moduloHabilitado(m.id)
          const sel = habilitado && elegido === m.id
          const id = `tuob-modulo-${m.id}`
          return (
            // El radio ocupa toda la tarjeta (invisible, por encima): se elige
            // tocando en cualquier lado y adentro puede haber títulos y listas.
            <div key={m.id} className="tuob-modulo" data-elegido={sel} data-proximamente={!habilitado}>
              <input type="radio" name="tuob-modulo" value={m.id} checked={sel} disabled={!habilitado} onChange={() => onElegir(m.id)} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d ${id}-l${habilitado ? '' : ` ${id}-p`}`} />
              <div className="tuob-modulo-cuerpo">
                <div className="tuob-modulo-cab">
                  <span className="tuob-modulo-icono"><m.Icon size={22} strokeWidth={1.75} aria-hidden /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 id={`${id}-t`}>{m.titulo}</h2>
                    <p id={`${id}-d`}>{m.bajada}</p>
                  </div>
                  {habilitado
                    ? <i className="tuob-marca-opcion" aria-hidden><Check size={13} strokeWidth={3.2} /></i>
                    : <span className="tuob-modulo-pronto"><Clock size={12} strokeWidth={2.4} aria-hidden /> Próximamente</span>}
                </div>
                <ul id={`${id}-l`} className="tuob-modulo-lista">
                  {m.puntos.map(p => <li key={p}><Check size={15} strokeWidth={2.6} aria-hidden /> {p}</li>)}
                </ul>
                <div className="tuob-modulo-pie">
                  <span><b>Para:</b> {m.para}</span>
                  {habilitado && <span className="tuob-modulo-pasos tuo-num">{pasosDe(m.id).length} pasos</span>}
                </div>
                {!habilitado && <p id={`${id}-p`} className="tuob-modulo-aviso">Lo estamos terminando. Por ahora podés arrancar con tu tienda online y sumar turnos cuando esté listo.</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
