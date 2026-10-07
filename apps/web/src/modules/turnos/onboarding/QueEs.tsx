// El "qué es" de una opción del alta: el botón con el signo de admiración que
// va en la esquina de la tarjeta y el modal que abre al tocarlo.
//
// Existe para las dos formas de vender de Tienda ("Tienda online" y "Vidriera
// digital"), una decisión difícil de deshacer una vez que el negocio tiene
// productos y pedidos cargados: la tarjeta la resume en una línea y el modal la
// explica a fondo, en tres bloques (qué es, dónde se ve y en qué afecta). Es un
// modal y no un desplegable a propósito, como en el alta anterior: la tarjeta
// no cambia de alto al tocar el ícono.
//
// El modal usa las clases del kit (tuo-modal-*): en escritorio es una caja
// centrada y en celular una hoja que sube desde abajo. Va por encima del botón
// flotante de Orbi y de su burbuja (ver .tuob-que-es-velo en estilo.ts).
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { CircleAlert, X } from 'lucide-react'

export interface QueEs {
  /** Qué es, en palabras del dueño del negocio. */
  que: string
  /** En qué parte de la tienda pública se ve. */
  donde?: string
  /** Qué cambia en el panel y en la tienda al elegirla. */
  afecta?: string
}

/** Las dos formas de vender de Tienda, explicadas a fondo. */
export const QUE_ES_MODO_VENTA: Record<'ecommerce' | 'vidriera', { titulo: string; detalle: QueEs }> = {
  ecommerce: {
    titulo: 'Tienda online',
    detalle: {
      que: 'Tu tienda tiene catálogo, carrito de compras y checkout: el cliente arma su pedido y paga online (tarjeta, transferencia, efectivo o Mercado Pago) sin salir de tu sitio.',
      donde: 'En toda tu tienda: cada producto tiene el botón "Agregar al carrito" y el cliente completa la compra solo, de punta a punta.',
      afecta: 'Sumás pedidos, módulo de clientes, cupones, mensajes y opiniones de compradores: el panel completo. Podés pasar a vidriera digital más adelante si preferís simplificar.',
    },
  },
  vidriera: {
    titulo: 'Vidriera digital',
    detalle: {
      que: 'Mostrás tu catálogo como una vidriera, sin carrito ni cobro online. El cliente ve tus productos, pero cierra la compra hablando con vos.',
      donde: 'En toda tu tienda: cada producto tiene un botón para consultarte por WhatsApp en vez de "Agregar al carrito".',
      afecta: 'No vas a tener checkout, carrito, módulo de clientes y pedidos, cupones, mensajes ni opiniones: solo catálogo y descuentos. Podés pasar a tienda online más adelante.',
    },
  },
}

/** El signo de admiración de la esquina de la tarjeta. `de` es el nombre de la opción, para el lector de pantalla. */
export function BotonQueEs({ de, onAbrir }: { de: string; onAbrir: () => void }) {
  return (
    <button
      type="button"
      className="tuob-que-es"
      aria-label={`Qué es ${de}`}
      title={`Qué es ${de}`}
      aria-haspopup="dialog"
      // Va por encima del radio que cubre la tarjeta: tocarlo abre la ayuda y no elige la opción.
      onClick={e => { e.preventDefault(); e.stopPropagation(); onAbrir() }}
    >
      <CircleAlert size={16} strokeWidth={1.9} aria-hidden />
    </button>
  )
}

export function ModalQueEs({ titulo, detalle, onCerrar }: { titulo: string; detalle: QueEs; onCerrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null)

  // Escape cierra. Se escucha en captura para ganarle a lo que quedó detrás del velo.
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCerrar()
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onCerrar])

  // El foco entra al modal al abrir, para que el teclado y el lector arranquen
  // ahí, y al cerrar vuelve al botón que lo abrió.
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    caja.current?.focus()
    return () => { if (antes?.isConnected) antes.focus({ preventScroll: true }) }
  }, [])

  // Tab da la vuelta adentro del modal: no se escapa a lo que quedó detrás del velo.
  const vuelta = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !caja.current) return
    const f = Array.from(caja.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'))
    if (!f.length) return
    const foco = document.activeElement
    if (e.shiftKey && (foco === f[0] || foco === caja.current)) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && foco === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
  }

  const bloques: [string, string | undefined][] = [
    ['Qué es', detalle.que],
    ['Dónde se ve', detalle.donde],
    ['En qué afecta', detalle.afecta],
  ]

  return (
    // mousedown y no click: soltar el mouse afuera después de seleccionar un texto no cierra.
    <div className="tuo-modal-velo tuob-que-es-velo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div ref={caja} tabIndex={-1} className="tuo-modal" role="dialog" aria-modal="true" aria-labelledby="tuob-que-es-titulo" aria-describedby="tuob-que-es-cuerpo"
        style={{ ['--tuo-ancho' as string]: '440px' }} onKeyDown={vuelta}>
        <header className="tuo-modal-cab">
          <span className="tuob-que-es-icono" aria-hidden><CircleAlert size={18} strokeWidth={1.9} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="tuob-que-es-titulo" className="tuo-modal-titulo">{titulo}</h2>
            <p className="tuo-modal-bajada">Qué es, dónde se ve y en qué afecta.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="tuo-btn tuo-btn--icono tuo-btn--sm tuo-btn--fantasma tuo-modal-cerrar" style={{ flexShrink: 0 }}>
            <X size={17} aria-hidden />
          </button>
        </header>
        <div id="tuob-que-es-cuerpo" className="tuo-modal-cuerpo tuob-que-es-cuerpo">
          {bloques.filter(([, texto]) => !!texto).map(([rotulo, texto]) => (
            <div key={rotulo} className="tuob-que-es-bloque">
              <span className="tuo-rotulo">{rotulo}</span>
              <p>{texto}</p>
            </div>
          ))}
        </div>
        <div className="tuo-modal-pie">
          <button type="button" className="tuo-btn tuo-btn--primario" onClick={onCerrar}>Entendido</button>
        </div>
      </div>
    </div>
  )
}
