// Horarios: los días y el horario dentro del que se arman las clases. Si el
// horario nuevo deja clases afuera, se avisa antes de guardar: no se mueven
// solas, pero la grilla las marca.
import { DIAS_CORTOS, hhmm } from '@/lib/reservas/fechas'
import { actividadDe } from '../../datos'
import { BarraGuardar, Encabezado, Nota, Seccion, Selector, useBorrador } from '@/design-system/reservas/piezas'
import { type PropsConfig } from '../piezas'

const HORAS = Array.from({ length: 25 }, (_, i) => ({ id: i * 60, label: i === 24 ? '24:00' : hhmm(i * 60) }))

export default function Horarios({ negocio, onGuardar }: PropsConfig) {
  const b = useBorrador(negocio.apertura)
  const v = b.v
  const toggle = (d: number) => b.set('dias', v.dias.includes(d) ? v.dias.filter(x => x !== d) : [...v.dias, d].sort((a, c) => a - c))
  // Las clases de la grilla que quedarían fuera: un día que ya no abre, o antes de abrir o después de cerrar.
  const fuera = negocio.clases.filter(c => !v.dias.includes(c.dia) || c.inicio < v.desde || c.inicio + (actividadDe(negocio, c.actividadId)?.duracion ?? 60) > v.hasta)
  return (
    <div className="rv-pagina rv-pagina--form">
      <Encabezado rotulo="Configuración" titulo="Horarios" bajada="Los días y el horario dentro del que se arman las clases. Se muestran en el sitio, en Dónde estamos." />
      <Seccion titulo="Días y horario">
        <div className="rv-rotulo" style={{ marginBottom: 8 }}>Días que abre</div>
        <div className="rv-fila" role="group" aria-label="Días que abre" style={{ gap: 6 }}>
          {DIAS_CORTOS.map((d, i) => <button key={d} type="button" className="rv-chip rv-chip--borde" aria-pressed={v.dias.includes(i)} onClick={() => toggle(i)}>{d}</button>)}
        </div>
        <div className="rv-dos" style={{ marginTop: 14 }}>
          {/* Si abre a la hora en que cerraba (o después), el cierre se corre: si no, el selector de "Cierra" quedaba con un valor que no está entre sus opciones. */}
          <Selector label="Abre" valor={v.desde} onChange={x => b.setV({ ...v, desde: x, hasta: v.hasta > x ? v.hasta : Math.min(24 * 60, x + 60) })} opciones={HORAS.slice(0, 24)} />
          <Selector label="Cierra" valor={v.hasta} onChange={x => b.set('hasta', x)} opciones={HORAS.filter(h => h.id > v.desde)} />
        </div>
        {fuera.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Nota tono="aviso">
              <span>{fuera.length === 1 ? 'Una clase de la grilla queda' : `${fuera.length} clases de la grilla quedan`} fuera de este horario (por ejemplo {actividadDe(negocio, fuera[0].actividadId)?.nombre} del {DIAS_CORTOS[fuera[0].dia].toLowerCase()} a las {hhmm(fuera[0].inicio)}). No se mueven solas: movelas o quitalas desde la grilla semanal.</span>
            </Nota>
          </div>
        )}
      </Seccion>
      <BarraGuardar cambiado={b.cambiado} motivo={v.dias.length === 0 ? 'Marcá al menos un día.' : undefined} onGuardar={() => onGuardar({ apertura: v }, 'Horarios guardados')} onDescartar={b.descartar} />
    </div>
  )
}
