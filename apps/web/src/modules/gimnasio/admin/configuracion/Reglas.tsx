// Reglas de reserva: hasta cuándo se reserva, hasta cuándo se cancela sin
// perder la clase y desde cuándo se hace check-in. Abajo, lo que el sistema
// ya hace solo (lista de espera, pack, prueba, tope semanal): no se configura,
// pero conviene saberlo.
import type { LucideIcon } from 'lucide-react'
import { Gift, Hourglass, Repeat, Ticket } from 'lucide-react'
import { Encabezado, Seccion, Selector } from '@/design-system/reservas/piezas'
import { BarraGuardar, useBorrador, type PropsConfig } from '../piezas'

const CSS = `
  .grg-reglas { display: flex; flex-direction: column; }
  .grg-regla { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--color-border); }
  .grg-regla:first-child { border-top: none; padding-top: 0; }
  .grg-regla:last-child { padding-bottom: 0; }
  .grg-ico { width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-primary-bg); color: var(--color-primary); }
  .grg-regla b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); }
  .grg-regla p { margin: 2px 0 0; font-size: 13px; line-height: 1.5; color: var(--color-muted); }
`

const SOLAS: { Icon: LucideIcon; titulo: string; texto: string }[] = [
  { Icon: Hourglass, titulo: 'La lista de espera avanza sola', texto: 'Cuando alguien cancela una clase llena, el primero que esperaba pasa a reservado y se le avisa. Si le subís el cupo a una clase, pasan los que entren.' },
  { Icon: Ticket, titulo: 'El pack se descuenta al reservar', texto: 'Una clase reservada con pack resta una. Si se cancela a tiempo, vuelve; fuera de plazo, no.' },
  { Icon: Gift, titulo: 'La clase de prueba vale una vez por persona', texto: 'Se reconoce por el celular o el email, aunque reserve como alguien nuevo.' },
  { Icon: Repeat, titulo: 'La membresía respeta su tope semanal', texto: 'Con 2 por semana, la tercera clase de esa semana no entra con el plan: se puede pagar aparte como clase suelta.' },
]

export default function Reglas({ negocio, onGuardar }: PropsConfig) {
  const b = useBorrador({ anticipacionDias: negocio.anticipacionDias, cancelaHastaHoras: negocio.cancelaHastaHoras, checkInMin: negocio.checkInMin })
  const v = b.v
  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado rotulo="Reservas" titulo="Reglas de reserva" bajada="Hasta cuándo se reserva, hasta cuándo se cancela sin perder la clase y desde cuándo se hace check-in. Valen para el sitio y para el panel." />
      <div className="rv-pila">
        <Seccion titulo="Reservar, cancelar y llegar">
          <div className="rv-grid rv-grid--3">
            <Selector label="Se reserva hasta" valor={v.anticipacionDias} onChange={x => b.set('anticipacionDias', x)} opciones={[3, 7, 14, 21, 30].map(d => ({ id: d, label: `${d} días adelante` }))} ayuda="Cuántos días adelante se ve la grilla en el sitio." />
            <Selector label="Cancelación sin cargo" valor={v.cancelaHastaHoras} onChange={x => b.set('cancelaHastaHoras', x)} opciones={[1, 2, 4, 6, 12, 24].map(h => ({ id: h, label: `hasta ${h} h antes` }))} ayuda="Después de eso, la clase se cuenta como usada (pack y membresía)." />
            <Selector label="Check-in desde" valor={v.checkInMin} onChange={x => b.set('checkInMin', x)} opciones={[15, 30, 45, 60].map(m => ({ id: m, label: `${m} min antes` }))} ayuda="Desde Mis clases o con el QR en la puerta." />
          </div>
        </Seccion>
        <Seccion titulo="Lo que pasa solo" bajada="Reglas del sistema: no se configuran, pero conviene saberlas.">
          <div className="grg-reglas">
            {SOLAS.map(s => (
              <div key={s.titulo} className="grg-regla">
                <span className="grg-ico" aria-hidden><s.Icon size={16} strokeWidth={1.7} /></span>
                <div style={{ minWidth: 0 }}><b>{s.titulo}</b><p>{s.texto}</p></div>
              </div>
            ))}
          </div>
        </Seccion>
      </div>
      <BarraGuardar cambiado={b.cambiado} onGuardar={() => onGuardar(v, 'Reglas guardadas')} onDescartar={b.descartar} />
    </div>
  )
}
