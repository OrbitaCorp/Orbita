// Horarios: los días que abre el negocio y el horario de cada día. En las
// canchas es dentro de qué horas se reserva; en el salón, el tramo en el que
// se arman los bloques fijos. La estadía no pasa por acá (entra y sale a la
// hora de cada propiedad).
import { useState } from 'react'
import { DIAS_CORTOS, DIAS_SEMANA, hhmm } from '@/lib/reservas/fechas'
import { armarBloques } from '@/lib/reservas/disponibilidad'
import { BarraGuardar, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { TIPOS } from '../../datos'
import { HORAS, PaginaForm, igual, type Form } from './comun'

export default function Horarios({ negocio, onGuardar }: Form) {
  const [v, setV] = useState(negocio.apertura)
  const cambiado = !igual(v, negocio.apertura)
  const toggle = (d: number) => setV({ ...v, dias: v.dias.includes(d) ? v.dias.filter(x => x !== d) : [...v.dias, d].sort() })
  const bloques = negocio.tipo === 'bloque' && negocio.salon ? armarBloques([v.desde, v.hasta], negocio.salon.duracionBloque, negocio.salon.limpieza) : []
  const horasPorDia = (v.hasta - v.desde) / 60
  return (
    <PaginaForm rotulo={TIPOS[negocio.tipo].label} titulo="Horarios" bajada={negocio.tipo === 'bloque' ? 'Los días que abre el salón y el horario dentro del que se arman los bloques.' : 'Los días y el horario en que se puede reservar.'}>
      <div className="rv-pila">
        <Seccion titulo="Días y horario" bajada="Un solo tramo por día. Fuera de esto, el sitio no ofrece nada.">
          <div className="rv-rotulo" style={{ marginBottom: 8 }}>Días</div>
          <div className="alc-dias" role="group" aria-label="Días que abre">
            {DIAS_CORTOS.map((d, i) => <button key={d} type="button" className="rv-chip rv-chip--borde" aria-pressed={v.dias.includes(i)} onClick={() => toggle(i)}>{d}</button>)}
          </div>
          <div className="rv-dos" style={{ marginTop: 14 }}>
            <Selector label="Abre" valor={v.desde} onChange={x => setV({ ...v, desde: x, hasta: Math.max(v.hasta, x + 60) })} opciones={HORAS.slice(0, 24)} />
            <Selector label="Cierra" valor={v.hasta} onChange={x => setV({ ...v, hasta: x })} opciones={HORAS.filter(h => h.id > v.desde)} />
          </div>
        </Seccion>
        <Seccion titulo="Así queda tu semana" bajada={`${v.dias.length === 7 ? 'Todos los días' : `${v.dias.length} ${v.dias.length === 1 ? 'día' : 'días'} por semana`}, ${horasPorDia} horas por día.`}>
          <div className="rv-lista">
            {DIAS_SEMANA.map((d, i) => {
              const abre = v.dias.includes(i)
              return (
                <div key={d} className="rv-item" style={{ padding: '9px 0' }}>
                  <span className="rv-item-cuerpo"><span className="rv-item-titulo" style={{ fontWeight: 500, color: abre ? 'var(--color-text)' : 'var(--color-muted)' }}>{d}</span></span>
                  <span className="rv-num" style={{ fontSize: 13, color: abre ? 'var(--color-text)' : 'var(--color-muted)' }}>{abre ? `${hhmm(v.desde)} a ${hhmm(v.hasta)}` : 'Cerrado'}</span>
                </div>
              )
            })}
          </div>
        </Seccion>
        {negocio.tipo === 'bloque' && (bloques.length
          ? <Nota tono="info"><span>Con este horario quedan {bloques.length === 1 ? 'un bloque fijo' : `${bloques.length} bloques fijos`}: {bloques.map(b => `${b.nombre.toLowerCase()} de ${hhmm(b.inicio)} a ${hhmm(b.fin)}`).join(', ')}. Cuánto dura cada uno y la limpieza del medio se cambian en Salón.</span></Nota>
          : <Nota tono="aviso"><span>Con este horario no entra ningún bloque: abrí más horas o acortá los bloques en Salón.</span></Nota>)}
      </div>
      <BarraGuardar cambiado={cambiado} motivo={v.dias.length === 0 ? 'Marcá al menos un día.' : undefined} onDescartar={() => setV(negocio.apertura)} onGuardar={() => onGuardar({ apertura: v })} />
    </PaginaForm>
  )
}
