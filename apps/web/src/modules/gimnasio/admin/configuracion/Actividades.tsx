// Actividades y salas: lo que se dicta (con duración y cupo por defecto, el
// color con el que se ve en la grilla) y dónde. Los profes viven en Equipo.
// Al guardar, las clases de una sala que ya no existe pasan a la primera y las
// de una actividad quitada salen de la grilla: se avisa cuántas.
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { COLORES_ACTIVIDAD, type Actividad } from '../../datos'
import { BarraGuardar, Campo, Encabezado, Seccion, Selector, useBorrador } from '@/design-system/reservas/piezas'
import { Punto, num, type PropsConfig } from '../piezas'

const CSS = `
  .gac-fila { grid-template-columns: 12px minmax(0, 1.4fr) 128px 104px auto; }
  .gac-fila > .gac-punto { align-self: end; margin-bottom: 17px; }
  .gac-sala { grid-template-columns: minmax(0, 1fr) auto; }
  @media (max-width: 640px) {
    /* El nombre va solo arriba, con el botón de quitar; duración y cupo abajo, a la par. */
    .gac-fila { grid-template-columns: 12px minmax(0, 1fr) minmax(0, 1fr) auto; }
    .gac-fila > .gac-punto { grid-row: 1; margin-bottom: 15px; }
    .gac-fila > .gac-nombre { grid-column: 2 / 4; }
    .gac-fila > .gac-dura { grid-column: 2; }
    .gac-fila > .gac-cupo { grid-column: 3; }
    .gac-fila > .gac-quitar { grid-column: 4; grid-row: 1; }
  }
`

export default function Actividades({ negocio, onGuardar, onIrEquipo }: PropsConfig & { onIrEquipo: () => void }) {
  const b = useBorrador({ actividades: negocio.actividades, salas: negocio.salas })
  const v = b.v
  const editar = (id: string, c: Partial<Actividad>) => b.set('actividades', v.actividades.map(a => (a.id === id ? { ...a, ...c } : a)))
  const clasesDe = (actividadId: string) => negocio.clases.filter(c => c.actividadId === actividadId).length
  const guardar = () => {
    const salas = v.salas.map(s => s.trim()).filter(Boolean)
    const actividades = v.actividades.map(a => ({ ...a, nombre: a.nombre.trim() || 'Actividad' }))
    const quedan = negocio.clases.filter(c => actividades.some(a => a.id === c.actividadId))
    const clases = quedan.map(c => ({ ...c, sala: salas.includes(c.sala) ? c.sala : salas[0] ?? c.sala }))
    // Los profes que daban una actividad quitada dejan de darla.
    const profes = negocio.profes.map(p => ({ ...p, actividades: p.actividades.filter(id => actividades.some(a => a.id === id)) }))
    const fuera = negocio.clases.length - quedan.length
    onGuardar({ actividades, salas: salas.length ? salas : negocio.salas, clases, profes }, 'Actividades y salas guardadas', fuera ? `${fuera} ${fuera === 1 ? 'clase salió' : 'clases salieron'} de la grilla.` : undefined)
  }
  return (
    <div className="rv-pagina rv-pagina--form">
      <style>{CSS}</style>
      <Encabezado rotulo="Negocio" titulo="Actividades y salas" bajada="Lo que se dicta y dónde. La duración y el cupo son los de cada clase nueva; en la grilla se ajustan clase por clase." />
      <div className="rv-pila">
        <Seccion titulo="Actividades" bajada="Cada una con su color en la grilla."
          acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => b.set('actividades', [...v.actividades, { id: `a${Date.now().toString(36)}`, nombre: '', duracion: 60, cupo: 12, color: COLORES_ACTIVIDAD[v.actividades.length % COLORES_ACTIVIDAD.length] }])}><Plus size={15} aria-hidden /> Agregar</button>}>
          <div className="gip-filas">
            {v.actividades.map(a => {
              const n = clasesDe(a.id)
              return (
                <div key={a.id} className="gip-fila gac-fila">
                  <span className="gac-punto"><Punto color={a.color} /></span>
                  <span className="gac-nombre"><Campo label="Nombre" value={a.nombre} onChange={x => editar(a.id, { nombre: x })} placeholder="Nueva actividad" ayuda={negocio.actividades.some(x => x.id === a.id) ? `${n} ${n === 1 ? 'clase' : 'clases'} por semana en la grilla` : 'Nueva: sumale clases desde la grilla.'} /></span>
                  <span className="gac-dura"><Selector label="Dura" valor={a.duracion} onChange={x => editar(a.id, { duracion: x })} opciones={[30, 45, 50, 60, 75, 90, 120, 150].map(m => ({ id: m, label: `${m} min` }))} /></span>
                  <span className="gac-cupo"><Campo label="Cupo" value={String(a.cupo)} onChange={x => editar(a.id, { cupo: Math.max(1, num(x)) })} inputMode="numeric" /></span>
                  <span className="gac-quitar"><button type="button" className="rv-btn rv-btn--icono" onClick={() => b.set('actividades', v.actividades.filter(x => x.id !== a.id))} aria-label={`Quitar ${a.nombre || 'actividad'}`} disabled={v.actividades.length <= 1}><Trash2 size={16} /></button></span>
                </div>
              )
            })}
          </div>
        </Seccion>
        <Seccion titulo="Salas" bajada="Dos clases no pueden pisarse en la misma sala. Si quitás una sala, sus clases pasan a la primera."
          acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => b.set('salas', [...v.salas, ''])}><Plus size={15} aria-hidden /> Agregar</button>}>
          <div className="gip-filas">
            {v.salas.map((s, i) => (
              <div key={i} className="gip-fila gac-sala">
                <Campo label={`Sala ${i + 1}`} value={s} onChange={x => b.set('salas', v.salas.map((y, j) => (j === i ? x : y)))} placeholder="Salón principal" />
                <button type="button" className="rv-btn rv-btn--icono" onClick={() => b.set('salas', v.salas.filter((_, j) => j !== i))} aria-label={`Quitar ${s || 'sala'}`} disabled={v.salas.length <= 1}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </Seccion>
        <div className="rv-card rv-card--pad rv-entre">
          <div style={{ minWidth: 0 }}><div className="rv-h3">Los profes están en Equipo</div><p className="rv-ayuda" style={{ margin: '3px 0 0' }}>Quién da cada actividad, su color en la grilla y las invitaciones al panel.</p></div>
          <button type="button" className="rv-btn rv-btn--sm" onClick={onIrEquipo}>Ir a Equipo <ArrowRight size={14} aria-hidden /></button>
        </div>
      </div>
      <BarraGuardar cambiado={b.cambiado} onGuardar={guardar} onDescartar={b.descartar} nota="Al quitar una actividad, sus clases salen de la grilla." />
    </div>
  )
}
