// El resumen de la reserva como un ticket que se va completando. En escritorio
// queda fijo a la derecha; en celular es una hoja pegada abajo: el total y el
// botón de seguir están siempre a la vista, y el detalle se despliega.
// Cada dato entra con una animación corta cuando el cliente lo elige (key =
// valor: si cambia, vuelve a entrar).
import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronUp, Gift } from 'lucide-react'
import { pesos } from '@/modules/turnos/datos'
import type { TemaNegocio } from '../tema'

export interface FilaTicket {
  k: string
  Icon: LucideIcon
  /** null = todavía no se eligió. */
  v: ReactNode | null
  /** Cambia cuando cambia el valor: dispara la animación de entrada. */
  clave: string
  falta: string
}

function Filas({ filas }: { filas: FilaTicket[] }) {
  return (
    <div>
      {filas.map(f => (
        <div key={f.k} className="tur-fila" data-lista={f.v !== null}>
          <span className="tur-fila-icono" aria-hidden><f.Icon size={16} /></span>
          <span style={{ minWidth: 0 }}>
            <span className="tur-fila-k">{f.k}</span>
            {f.v === null
              ? <span className="tur-fila-v" data-vacia="true">{f.falta}</span>
              : <span key={f.clave} className="tur-fila-v tur-llega">{f.v}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** El descuento de bienvenida de la cuenta, cuando aplica. */
export interface Rebaja { pct: number; monto: number; antes: number }

function Importes({ total, precio, sena, rebaja }: { total: string; precio: number; sena: number; rebaja?: Rebaja }) {
  return (
    <>
      {rebaja && (
        <div className="tur-llega tur-rebaja">
          <span><span>Precio</span><s className="tur-num">{pesos(rebaja.antes)}</s></span>
          <span><span><Gift size={14} aria-hidden /> Bienvenida por tu cuenta ({rebaja.pct}%)</span><b className="tur-num">−{pesos(rebaja.monto)}</b></span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 14.5, color: 'var(--color-muted)' }}>Total</span>
        <span key={total} className="tur-num tur-total tur-llega">{total}</span>
      </div>
      {sena > 0 && (
        <div className="tur-llega" style={{ display: 'grid', gap: 6, marginTop: 12, padding: '12px 14px', borderRadius: 'var(--tur-r-sm)', background: 'var(--color-primary-bg)', fontSize: 14, color: 'var(--color-text)' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Pagás ahora (seña)</span><b className="tur-num">{pesos(sena)}</b></span>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>El día del turno</span><span className="tur-num">{pesos(precio - sena)}</span></span>
        </div>
      )}
    </>
  )
}

interface Props {
  t: TemaNegocio
  filas: FilaTicket[]
  /** Texto del total ya resuelto ("$16.500", "Sin cargo", "—"). */
  total: string
  /** Lo que se paga, ya con el descuento aplicado. */
  precio: number
  sena: number
  rebaja?: Rebaja
  /** Dónde se hace el turno: en el local o a domicilio. */
  donde: { Icon: LucideIcon; txt: string }
}

/** Lo que falta elegir, en palabras: un "0/4" al lado de "Paso 1 de 2" se leía como otro contador de pasos. */
const faltanTxt = (n: number) => n === 0 ? 'Completa' : n === 1 ? 'Falta 1 dato' : `Faltan ${n} datos`

export function Ticket({ t, filas, total, precio, sena, rebaja, donde }: Props) {
  const listas = filas.filter(f => f.v !== null).length
  return (
    <div className="tur-ticket" aria-label="Resumen de tu reserva" role="region">
      <div className="tur-ticket-foto">
        <img src={t.fotoHero} alt="" />
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14, zIndex: 1, color: '#FFFFFF' }}>
          <div className="tur-h" style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>{t.nombre}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 3, color: 'rgba(255,255,255,.9)' }}><donde.Icon size={13} aria-hidden /> {donde.txt}</div>
        </div>
      </div>
      <div style={{ padding: '16px 22px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span className="tur-rotulo">Tu reserva</span>
          <span className="tur-rotulo">{faltanTxt(filas.length - listas)}</span>
        </div>
        <Filas filas={filas} />
      </div>
      <div className="tur-troquel" aria-hidden><i /></div>
      <div style={{ padding: '6px 22px 22px' }}>
        <Importes total={total} precio={precio} sena={sena} rebaja={rebaja} />
      </div>
    </div>
  )
}

/** Hoja inferior del celular. `boton` es la acción principal del paso. */
export function HojaResumen({ filas, total, precio, sena, rebaja, resumen, boton }: Omit<Props, 't' | 'donde'> & { resumen: string; boton: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  const listas = filas.filter(f => f.v !== null).length
  return (
    <div className="tur-hoja" role="region" aria-label="Resumen de tu reserva">
      <button type="button" className="tur-hoja-asa" aria-expanded={abierta} aria-controls="tur-hoja-detalle" onClick={() => setAbierta(a => !a)}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tur-rotulo" style={{ display: 'block' }}>Tu reserva · {faltanTxt(filas.length - listas)}</span>
          <span key={resumen} className="tur-llega" style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resumen}</span>
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-body)' }}>{abierta ? 'Ocultar' : 'Ver detalle'}</span>
        <ChevronUp size={18} aria-hidden />
      </button>
      <div id="tur-hoja-detalle" className="tur-hoja-cuerpo" data-abierta={abierta}>
        <div>
          <div style={{ padding: '4px 0 14px' }}>
            <Filas filas={filas} />
            {(sena > 0 || rebaja) && <div style={{ marginTop: 6 }}><Importes total={total} precio={precio} sena={sena} rebaja={rebaja} /></div>}
          </div>
        </div>
      </div>
      <div className="tur-hoja-pie">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{sena > 0 ? 'Seña ahora' : 'Total'}</div>
          <div key={total} className="tur-num tur-llega" style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{sena > 0 ? pesos(sena) : total}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>{boton}</div>
      </div>
    </div>
  )
}
