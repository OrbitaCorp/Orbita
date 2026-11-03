// Planes y precios: la clase de prueba (gratis, una vez por persona), la clase
// suelta, los packs y las membresías. Cada tarjeta dice cuántos alumnos lo
// tienen hoy: apagar o quitar un plan no les saca nada hasta que venza.
import { Plus, Trash2 } from 'lucide-react'
import { estadoPlanDe, rubroPorKey, type Plan, type Socio } from '../../datos'
import { BarraGuardar, Campo, Chip, Encabezado, FilaSwitch, Selector, useBorrador } from '@/design-system/reservas/piezas'
import { num, type PropsConfig } from '../piezas'

const TIPO: Record<Plan['tipo'], string> = { prueba: 'Prueba · una vez por persona', suelta: 'Clase suelta', pack: 'Pack de clases', membresia: 'Membresía mensual' }

export default function Planes({ negocio, socios, onGuardar }: PropsConfig & { socios: Socio[] }) {
  const r = rubroPorKey(negocio.rubro)
  const b = useBorrador({ planes: negocio.planes })
  const lista = b.v.planes
  const editar = (id: string, c: Partial<Plan>) => b.set('planes', lista.map(p => (p.id === id ? { ...p, ...c } : p)))
  const agregar = (tipo: 'membresia' | 'pack') => b.set('planes', [...lista, tipo === 'pack'
    ? { id: `pl${Date.now().toString(36)}`, tipo, nombre: 'Pack de 8 clases', precio: 56000, clases: 8, vigenciaDias: 90, activo: true }
    : { id: `pl${Date.now().toString(36)}`, tipo, nombre: '2 veces por semana', precio: 48000, porSemana: 2, vigenciaDias: 30, activo: true }])
  /** Cuántos lo tienen vigente hoy. */
  const conPlan = (id: string) => socios.filter(s => s.planId === id && ['vigente', 'por-vencer'].includes(estadoPlanDe(s))).length
  return (
    <div className="rv-pagina rv-pagina--form">
      <Encabezado rotulo="Negocio" titulo="Planes y precios" bajada="La prueba es gratis, una vez por persona. Las membresías se renuevan cada mes."
        acciones={<>
          <button type="button" className="rv-btn" onClick={() => agregar('membresia')}><Plus size={15} aria-hidden /> Membresía</button>
          <button type="button" className="rv-btn" onClick={() => agregar('pack')}><Plus size={15} aria-hidden /> Pack</button>
        </>} />
      <div className="rv-pila">
        {lista.map(p => {
          const n = conPlan(p.id)
          return (
            <section key={p.id} className="rv-card rv-card--pad" aria-label={p.nombre}>
              <div className="rv-entre" style={{ marginBottom: 12 }}>
                <span className="rv-fila" style={{ gap: 8 }}>
                  <span className="rv-rotulo">{TIPO[p.tipo]}</span>
                  {(p.tipo === 'pack' || p.tipo === 'membresia') && <Chip tono={n ? 'primario' : 'gris'}>{n} {n === 1 ? r.socio.toLowerCase().replace('/a', '') : r.socios.toLowerCase()}</Chip>}
                </span>
                {p.tipo !== 'prueba' && <button type="button" className="rv-btn rv-btn--sm rv-btn--fantasma" onClick={() => b.set('planes', lista.filter(x => x.id !== p.id))}><Trash2 size={14} aria-hidden /> Quitar</button>}
              </div>
              <div className="rv-grid rv-grid--3">
                <Campo label="Nombre" value={p.nombre} onChange={x => editar(p.id, { nombre: x })} maxLength={40} />
                {p.tipo !== 'prueba' && <Campo label="Precio" prefijo="$" value={String(p.precio)} onChange={x => editar(p.id, { precio: num(x) })} inputMode="numeric" />}
                {p.tipo === 'pack' && <Campo label="Clases" value={String(p.clases ?? 0)} onChange={x => editar(p.id, { clases: Math.max(1, num(x)) })} inputMode="numeric" />}
                {p.tipo === 'membresia' && <Selector label="Por semana" valor={p.porSemana ?? 0} onChange={x => editar(p.id, { porSemana: x })} opciones={[0, 1, 2, 3, 4, 5].map(k => ({ id: k, label: k ? `${k} clases` : 'Libre' }))} />}
                {(p.tipo === 'pack' || p.tipo === 'membresia') && <Selector label="Vigencia" valor={p.vigenciaDias} onChange={x => editar(p.id, { vigenciaDias: x })} opciones={[30, 60, 90, 180].map(d => ({ id: d, label: `${d} días` }))} />}
              </div>
              <div style={{ marginTop: 6 }}>
                <FilaSwitch titulo="Se ofrece en el sitio" ayuda={p.tipo === 'pack' || p.tipo === 'membresia' ? `Apagado, no se vende más; ${n ? `${n === 1 ? 'quien lo tiene lo sigue usando' : 'quienes lo tienen lo siguen usando'} hasta que venza.` : 'nadie lo tiene hoy.'}` : 'Apagado, no aparece en el sitio ni al reservar.'} on={p.activo} onChange={x => editar(p.id, { activo: x })} />
              </div>
            </section>
          )
        })}
      </div>
      <BarraGuardar cambiado={b.cambiado} onGuardar={() => onGuardar({ planes: lista.map(p => ({ ...p, nombre: p.nombre.trim() || 'Plan' })) }, 'Planes guardados')} onDescartar={b.descartar} />
    </div>
  )
}
