// El salón: capacidad, cuánto dura cada bloque, la limpieza entre uno y otro y
// las fotos. Los paquetes y los extras tienen su propia página; el depósito de
// garantía va en Pagos y señas.
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { hhmm } from '@/lib/reservas/fechas'
import { armarBloques } from '@/lib/reservas/disponibilidad'
import { pesos } from '@/lib/reservas/precio'
import { Campo, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { TIPOS, type Salon as SalonT } from '../../datos'
import type { Vista } from '../navegacion'
import { Guardar } from '../piezas'
import { PaginaForm, igual, num, type Form } from './comun'

const de = (s: SalonT | null) => ({ capacidad: s?.capacidad ?? 50, duracionBloque: s?.duracionBloque ?? 240, limpieza: s?.limpieza ?? 60, fotos: s?.fotos ?? [] })

export default function Salon({ negocio, onGuardar, onIr }: Form & { onIr: (vista: Vista) => void }) {
  const s = negocio.salon
  const [v, setV] = useState(de(s))
  const cambiado = !igual(v, de(s))
  // Así quedan los bloques fijos con estos valores: lo que el cliente ve para elegir.
  const bloques = armarBloques([negocio.apertura.desde, negocio.apertura.hasta], v.duracionBloque, v.limpieza)
  const guardar = () => onGuardar({ salon: { paquetes: [], extras: [], deposito: 0, ...s, ...v } })
  return (
    <PaginaForm rotulo={TIPOS.bloque.label} titulo="Salón" bajada="Capacidad, duración de cada bloque, limpieza entre uno y otro, y las fotos del sitio.">
      <div className="rv-pila">
        <Seccion titulo="Capacidad y bloques" bajada="Nadie puede reservar para más invitados que la capacidad.">
          <div className="rv-grid rv-grid--3">
            <Campo label="Capacidad máxima" value={String(v.capacidad)} onChange={x => setV({ ...v, capacidad: num(x) })} inputMode="numeric" ayuda="Personas, contando a los adultos." />
            <Selector label="Cada bloque dura" valor={v.duracionBloque} onChange={x => setV({ ...v, duracionBloque: x })} opciones={[180, 240, 300, 360].map(m => ({ id: m, label: `${m / 60} horas` }))} />
            <Selector label="Limpieza entre bloques" valor={v.limpieza} onChange={x => setV({ ...v, limpieza: x })} opciones={[30, 60, 90, 120].map(m => ({ id: m, label: `${m} minutos` }))} />
          </div>
          <div style={{ marginTop: 12 }}>
            {bloques.length
              ? <Nota tono="info"><span>Con el horario de {hhmm(negocio.apertura.desde)} a {hhmm(negocio.apertura.hasta)} quedan {bloques.length === 1 ? 'un bloque fijo' : `${bloques.length} bloques fijos`}: {bloques.map(b => `${b.nombre.toLowerCase()} de ${hhmm(b.inicio)} a ${hhmm(b.fin)}`).join(', ')}. Los {v.limpieza} minutos de limpieza del medio no se pueden reservar.</span></Nota>
              : <Nota tono="aviso"><span>Con el horario de {hhmm(negocio.apertura.desde)} a {hhmm(negocio.apertura.hasta)} no entra ningún bloque de {v.duracionBloque / 60} horas: acortalos o cambiá el horario en Horarios.</span></Nota>}
          </div>
        </Seccion>
        <Seccion titulo="Fotos" bajada="Las del sitio. La primera es la de la portada.">
          <div className="alc-fotos">
            {v.fotos.map((f, i) => <img key={`${i}-${f}`} src={f} alt={`Foto ${i + 1} del salón`} loading="lazy" />)}
          </div>
          <p className="ala-pie-nota">En la demo son fotos de ejemplo: no se cargan nuevas.</p>
        </Seccion>
        <Nota><span style={{ flex: 1, minWidth: 0 }}>El depósito de garantía ({s?.deposito ? pesos(s.deposito) : 'no se pide'}) se define en Pagos y señas; los paquetes y los extras, en sus propias páginas.</span><button type="button" className="rv-btn rv-btn--sm" onClick={() => onIr('pagos')}>Ir a Pagos y señas <ArrowRight size={14} aria-hidden /></button></Nota>
      </div>
      <Guardar cambiado={cambiado && bloques.length > 0} nota={bloques.length ? undefined : 'Con esos valores no queda ningún bloque.'} onDescartar={() => setV(de(s))} onGuardar={guardar} />
    </PaginaForm>
  )
}
