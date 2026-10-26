// Primer paso del alta: con qué módulo arranca el negocio. Son cuatro tarjetas
// (radios de verdad: el rol y el estado los da el navegador y se recorren con
// las flechas), una columna en celular y dos desde tablet. Cada una dice qué
// trae y para quién es; lo que se elige acá decide qué estaciones suma el arco
// de arriba. Un módulo que el alta real todavía no habilita
// (MODULOS_PROXIMAMENTE) se muestra igual, con su chip de "Próximamente", pero
// no se puede elegir; en las demos se eligen los cuatro.
import { CalendarClock, Check, Clock, Dumbbell, KeyRound, ShoppingBag, type LucideIcon } from 'lucide-react'
import { moduloHabilitado, pasosDe, type Modulo } from './modelo'
import { TEXTOS } from './textos'

/** El ícono de cada módulo: el de su tarjeta y el de la botonera mientras no hay uno más preciso. */
export const ICONO_MODULO: Record<Modulo, LucideIcon> = { tienda: ShoppingBag, turnos: CalendarClock, alquileres: KeyRound, gimnasio: Dumbbell }

// Exportado para Orbi (OrbiAlta.tsx): son las opciones que puede elegir en este paso.
export const MODULOS: { id: Modulo; Icon: LucideIcon; titulo: string; bajada: string; puntos: string[]; para: string }[] = [
  {
    id: 'tienda', Icon: ICONO_MODULO.tienda, titulo: TEXTOS.tienda.nombre, bajada: 'Vendé tus productos con catálogo, carrito y cobro online.',
    puntos: ['Catálogo con variantes, fotos y stock', 'Cobrás con Mercado Pago o por transferencia', 'Pedidos, clientes y cupones en un solo panel'],
    para: 'Indumentaria, electrónica, almacenes, regalería…',
  },
  {
    id: 'turnos', Icon: ICONO_MODULO.turnos, titulo: TEXTOS.turnos.nombre, bajada: 'Tus clientes reservan solos, a cualquier hora y sin llamarte.',
    puntos: ['Agenda por profesional o por sala y cabina', 'Recordatorios por WhatsApp y seña con Mercado Pago', 'Tu página de reservas, con link y QR'],
    para: 'Barberías, consultorios, estética, profesionales…',
  },
  {
    id: 'alquileres', Icon: ICONO_MODULO.alquileres, titulo: TEXTOS.alquileres.nombre, bajada: 'Alquilá por hora, por evento o por noches, con tu calendario siempre al día.',
    puntos: ['Canchas y espacios por hora, uno o varios', 'Salones por bloque, con paquetes por invitados', 'Casas y cabañas por noche, con temporadas'],
    para: 'Complejos de canchas, salones de fiestas, quinchos, cabañas…',
  },
  {
    id: 'gimnasio', Icon: ICONO_MODULO.gimnasio, titulo: TEXTOS.gimnasio.nombre, bajada: 'Clases con cupo que se reservan solas, con planes y socios.',
    puntos: ['Grilla semanal de clases con cupo y lista de espera', 'Clase de prueba, packs y membresías por mes', 'Socios con su plan, vencimientos y asistencia'],
    para: 'Gimnasios, crossfit, yoga y pilates, danza, artes marciales…',
  },
]

const AVISO_ID = 'tuob-modulos-pronto'

/** "Turnos, Alquileres y Gimnasio": la lista con la "y" antes del último. */
const enumerar = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)

export function PasoModulo({ elegido, onElegir, real }: { elegido: Modulo | null; onElegir: (m: Modulo) => void; real: boolean }) {
  const pronto = MODULOS.filter(m => !moduloHabilitado(m.id, real))
  const uno = pronto.length === 1
  return (
    <div className="tuob-ancho tuob-ancho--medio">
      <div className="tuob-modulos" role="radiogroup" aria-label="Módulo">
        {MODULOS.map(m => {
          const habilitado = moduloHabilitado(m.id, real)
          const sel = habilitado && elegido === m.id
          const id = `tuob-modulo-${m.id}`
          return (
            // El radio ocupa toda la tarjeta (invisible, por encima): se elige
            // tocando en cualquier lado y adentro puede haber títulos y listas.
            <div key={m.id} className="tuob-modulo" data-elegido={sel} data-proximamente={!habilitado}>
              <input type="radio" name="tuob-modulo" value={m.id} checked={sel} disabled={!habilitado} onChange={() => onElegir(m.id)}
                aria-labelledby={`${id}-t`} aria-describedby={`${id}-d ${id}-l${habilitado ? '' : ` ${AVISO_ID}`}`} />
              <div className="tuob-modulo-cuerpo">
                <div className="tuob-modulo-cab">
                  <span className="tuob-modulo-icono"><m.Icon size={22} strokeWidth={1.75} aria-hidden /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 id={`${id}-t`}>{m.titulo}</h2>
                    <p id={`${id}-d`}>{m.bajada}</p>
                    {/* Debajo de la bajada y no al costado: en celular le robaba ancho al título. */}
                    {!habilitado && <span className="tuob-modulo-pronto"><Clock size={12} strokeWidth={2.4} aria-hidden /> Próximamente</span>}
                  </div>
                  {habilitado && <i className="tuob-marca-opcion" aria-hidden><Check size={13} strokeWidth={3.2} /></i>}
                </div>
                <ul id={`${id}-l`} className="tuob-modulo-lista">
                  {m.puntos.map(p => <li key={p}><Check size={15} strokeWidth={2.6} aria-hidden /> {p}</li>)}
                </ul>
                <div className="tuob-modulo-pie">
                  <span><b>Para:</b> {m.para}</span>
                  {habilitado && <span className="tuob-modulo-pasos tuo-num">{pasosDe(m.id).length} pasos</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* Un solo aviso para todos los que faltan, abajo: repetido en cada tarjeta era ruido. */}
      {pronto.length > 0 && (
        <p id={AVISO_ID} className="tuob-modulos-aviso">
          <Clock size={14} strokeWidth={2.2} aria-hidden />
          <span>
            {enumerar(pronto.map(m => m.titulo))} {uno ? 'lo estamos terminando' : 'los estamos terminando'}. Por ahora podés arrancar con
            tu tienda online y {uno ? 'sumarlo' : 'sumarlos'} cuando {uno ? 'esté listo' : 'estén listos'}.
          </span>
        </p>
      )}
    </div>
  )
}
