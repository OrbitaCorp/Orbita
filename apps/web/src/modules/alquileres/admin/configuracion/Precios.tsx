// Precios por horario: un descuento en las horas que cuesta llenar y, si se
// quiere, un recargo en las de más demanda. Debajo, la vista previa: cuánto
// vale cada hora de una cancha un día de la semana, con las franjas puestas.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DIAS_CORTOS, DIAS_SEMANA, hhmm } from '@/lib/reservas/fechas'
import { pesos, precioPorHora, type ReglaFranja } from '@/lib/reservas/precio'
import { BarraGuardar, Seccion, Selector, Vacio } from '@/design-system/reservas/piezas'
import { TIPOS } from '../../datos'
import { HORAS, PaginaForm, igual, type Form } from './comun'

const AJUSTES = [-30, -20, -15, -10, 0, 10, 15, 20, 30].map(a => ({ id: a, label: a === 0 ? 'Sin cambio' : `${a > 0 ? '+' : ''}${a}%` }))

const CSS = `
  .alc-precios { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; }
  .alc-precio { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 52px; padding: 7px 4px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-family: var(--rv-mono); font-size: 12px; color: var(--color-muted); }
  .alc-precio b { font-size: 13px; font-weight: 600; color: var(--color-text); }
  .alc-precio[data-ajuste='menos'] { background: var(--color-success-bg); border-color: transparent; }
  .alc-precio[data-ajuste='mas'] { background: var(--color-warning-bg); border-color: transparent; }
  .alc-precio small { font-size: 10.5px; }
`

export default function Precios({ negocio, onGuardar }: Form) {
  const [reglas, setReglas] = useState<ReglaFranja[]>(negocio.reglasPrecio)
  const cambiado = !igual(reglas, negocio.reglasPrecio)
  const editar = (i: number, c: Partial<ReglaFranja>) => setReglas(reglas.map((r, k) => (k === i ? { ...r, ...c } : r)))
  // La vista previa: una cancha y un día de la semana.
  const [unidadId, setUnidadId] = useState(negocio.unidades[0]?.id ?? '')
  const [dia, setDia] = useState(4)
  const unidad = negocio.unidades.find(u => u.id === unidadId) ?? negocio.unidades[0]
  const abre = negocio.apertura.dias.includes(dia)
  const horas = abre ? Array.from({ length: Math.floor((negocio.apertura.hasta - negocio.apertura.desde) / 60) }, (_, i) => negocio.apertura.desde + i * 60) : []
  return (
    <PaginaForm rotulo={TIPOS.cancha.label} titulo="Precios por horario" bajada="Un descuento en las horas que cuesta llenar y, si querés, un recargo en las de más demanda. El precio final se ve al elegir el horario."
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setReglas([...reglas, { dias: [0, 1, 2, 3, 4], desde: 9 * 60, hasta: 12 * 60, ajuste: -10 }])}><Plus size={15} aria-hidden /> Agregar franja</button>}>
      <style>{CSS}</style>
      <div className="rv-pila">
        <Seccion titulo="Franjas" bajada={reglas.length ? 'Si dos franjas se pisan, manda la primera de la lista.' : 'Sin franjas: todas las horas valen lo mismo.'}>
          <div className="rv-pila">
            {reglas.map((r, i) => (
              <div key={i} className="rv-card rv-card--pad" style={{ background: 'var(--color-surface)' }}>
                <div className="alc-dias" role="group" aria-label="Días">
                  {DIAS_CORTOS.map((d, k) => {
                    // [] es "todos los días": tocar uno con todos marcados lo saca a él (antes quedaba solo ese), y el último no se
                    // saca (volvería a ser [] = todos). Si se marcan los siete, se guarda [] como en los datos de ejemplo.
                    const dias = r.dias.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : r.dias
                    const on = dias.includes(k)
                    const nuevos = on ? dias.filter(x => x !== k) : [...dias, k].sort()
                    return <button key={d} type="button" className="rv-chip rv-chip--borde" aria-pressed={on} onClick={() => { if (nuevos.length) editar(i, { dias: nuevos.length === 7 ? [] : nuevos }) }}>{d}</button>
                  })}
                </div>
                <div className="alc-horas" style={{ marginTop: 10 }}>
                  <Selector label="Desde" valor={r.desde} onChange={x => editar(i, { desde: x, hasta: Math.max(r.hasta, x + 60) })} opciones={HORAS.slice(0, 24)} />
                  <Selector label="Hasta" valor={r.hasta} onChange={x => editar(i, { hasta: x })} opciones={HORAS.filter(h => h.id > r.desde)} />
                  <Selector label="Ajuste" valor={r.ajuste} onChange={x => editar(i, { ajuste: x })} opciones={AJUSTES} />
                  <div className="rv-campo"><span aria-hidden>&nbsp;</span><button type="button" className="rv-btn" onClick={() => setReglas(reglas.filter((_, k) => k !== i))}><Trash2 size={15} aria-hidden /> Quitar</button></div>
                </div>
              </div>
            ))}
            {reglas.length === 0 && <Vacio titulo="Sin franjas" texto="Agregá una para bajar el precio de las horas flojas o subirlo en las de más demanda." />}
          </div>
        </Seccion>
        {unidad && (
          <Seccion titulo="Así queda" bajada="Lo que vale cada hora con estas franjas, antes de los extras.">
            <div className="rv-dos" style={{ marginBottom: 12 }}>
              <Selector label="Cancha" valor={unidad.id} onChange={setUnidadId} opciones={negocio.unidades.map(u => ({ id: u.id, label: `${u.nombre} · ${pesos(u.tarifaHora)} la hora` }))} />
              <Selector label="Día" valor={dia} onChange={setDia} opciones={DIAS_SEMANA.map((d, i) => ({ id: i, label: d }))} />
            </div>
            {!abre ? <p className="rv-ayuda" style={{ margin: 0 }}>Los {DIAS_SEMANA[dia].toLowerCase()} el complejo no abre.</p> : (
              <div className="alc-precios" role="list" aria-label={`Precio por hora de ${unidad.nombre} los ${DIAS_SEMANA[dia].toLowerCase()}`}>
                {horas.map(h => {
                  const p = precioPorHora(unidad.tarifaHora, 60, dia, h, reglas)
                  return (
                    <div key={h} role="listitem" className="alc-precio" data-ajuste={p.ajuste < 0 ? 'menos' : p.ajuste > 0 ? 'mas' : undefined} aria-label={`${hhmm(h)}: ${pesos(p.final)}${p.ajuste ? ` (${p.ajuste > 0 ? '+' : ''}${p.ajuste}%)` : ''}`}>
                      <span>{hhmm(h)}</span><b>{pesos(p.final)}</b>{p.ajuste ? <small>{p.ajuste > 0 ? '+' : ''}{p.ajuste}%</small> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </Seccion>
        )}
      </div>
      <BarraGuardar cambiado={cambiado} onDescartar={() => setReglas(negocio.reglasPrecio)} onGuardar={() => onGuardar({ reglasPrecio: reglas })} />
    </PaginaForm>
  )
}
