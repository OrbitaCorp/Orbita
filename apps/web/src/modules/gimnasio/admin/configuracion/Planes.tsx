// Planes y precios: la clase de prueba (gratis, una vez por persona), la clase
// suelta, los packs y las membresías. Cada tarjeta dice cuántos alumnos lo
// tienen hoy: apagar o quitar un plan no les saca nada hasta que venza (cada
// uno guarda cómo era el plan cuando se lo asignaron).
//
// Se guarda la lista entera, de una vez. Un negocio que recién empieza no
// tiene ninguno: puede arrancar con los sugeridos de su rubro y cambiarlos.
import { Plus, Trash2 } from 'lucide-react'
import { negocioDe, planesDeSocio, rubroPorKey, type Plan, type Socio, type TipoPlan } from '../../datos'
import { useReloj } from '../../datos/reloj'
import { BarraGuardar, Campo, Chip, Encabezado, FilaSwitch, Selector, Vacio, useBorrador } from '@/design-system/reservas/piezas'
import { num, type PropsConfig } from '../piezas'

const TIPO: Record<TipoPlan, string> = { prueba: 'Prueba · una vez por persona', suelta: 'Clase suelta', pack: 'Pack de clases', membresia: 'Membresía mensual' }
const VIGENCIAS = [30, 60, 90, 180]
const POR_SEMANA = [0, 1, 2, 3, 4, 5]
/** Las opciones de un selector más el valor que ya tiene el plan, si no es uno de los de siempre. */
const conLaSuya = (opciones: number[], valor: number) => [...new Set([...opciones, valor])].sort((a, b) => a - b)
const idNuevo = () => `pl${Date.now().toString(36)}`

const NUEVO: Record<TipoPlan, () => Plan> = {
  prueba: () => ({ id: idNuevo(), tipo: 'prueba', nombre: 'Clase de prueba', precio: 0, vigenciaDias: 30, activo: true }),
  suelta: () => ({ id: idNuevo(), tipo: 'suelta', nombre: 'Clase suelta', precio: 7000, vigenciaDias: 1, activo: true }),
  pack: () => ({ id: idNuevo(), tipo: 'pack', nombre: 'Pack de 8 clases', precio: 56000, clases: 8, vigenciaDias: 90, activo: true }),
  membresia: () => ({ id: idNuevo(), tipo: 'membresia', nombre: '2 veces por semana', precio: 48000, porSemana: 2, vigenciaDias: 30, activo: true }),
}

export default function Planes({ negocio, socios, onGuardar }: PropsConfig & { socios: Socio[] }) {
  const { hoy } = useReloj()
  const r = rubroPorKey(negocio.rubro)
  const b = useBorrador({ planes: negocio.planes })
  const lista = b.v.planes
  const editar = (id: string, c: Partial<Plan>) => b.set('planes', lista.map(p => (p.id === id ? { ...p, ...c } : p)))
  const agregar = (tipo: TipoPlan) => b.set('planes', [...lista, NUEVO[tipo]()])
  /** Cuántos lo tienen hoy: vale hoy y, si es un pack, le quedan clases. */
  const conPlan = (id: string) => socios.filter(s => planesDeSocio(negocio, s).some(p => p.planId === id && p.desde <= hoy && hoy <= p.hasta && (p.tipo !== 'pack' || (p.restantes ?? 0) > 0))).length
  const hay = (tipo: TipoPlan) => lista.some(p => p.tipo === tipo)
  // Los sugeridos del rubro, como planes nuevos (con otro id: los guardados son los que manda el negocio).
  const sugeridos = () => b.set('planes', negocioDe(r).planes.map((p, i) => ({ ...p, id: `${idNuevo()}${i}` })))
  const sinNombre = lista.some(p => p.nombre.trim().length < 2)
  const quitadosConGente = negocio.planes.filter(p => !lista.some(x => x.id === p.id) && conPlan(p.id) > 0).length
  const guardar = () => {
    // Lo que queda en pantalla es lo que se manda: sin espacios de más en los nombres.
    const planes = lista.map(p => ({ ...p, nombre: p.nombre.trim() }))
    b.set('planes', planes)
    void onGuardar({ planes }, 'Planes guardados')
  }
  return (
    <div className="rv-pagina rv-pagina--form">
      <Encabezado rotulo="Negocio" titulo="Planes y precios" bajada="La prueba es gratis, una vez por persona. Las membresías se renuevan cada mes."
        acciones={<>
          <button type="button" className="rv-btn" onClick={() => agregar('membresia')}><Plus size={15} aria-hidden /> Membresía</button>
          <button type="button" className="rv-btn" onClick={() => agregar('pack')}><Plus size={15} aria-hidden /> Pack</button>
          {/* La clase suelta y la de prueba son una de cada una: el botón está solo si falta. */}
          {lista.length > 0 && !hay('suelta') && <button type="button" className="rv-btn" onClick={() => agregar('suelta')}><Plus size={15} aria-hidden /> Clase suelta</button>}
          {lista.length > 0 && !hay('prueba') && <button type="button" className="rv-btn" onClick={() => agregar('prueba')}><Plus size={15} aria-hidden /> Clase de prueba</button>}
        </>} />
      {lista.length === 0 && (
        <Vacio titulo="Todavía no hay planes" texto={`Sumá una membresía o un pack, o arrancá con los que suele tener ${r.label.toLowerCase()} y cambiales el nombre y el precio.`}
          accion={<button type="button" className="rv-btn rv-btn--primario" onClick={sugeridos}>Usar los planes sugeridos</button>} />
      )}
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
                {p.tipo === 'membresia' && <Selector label="Por semana" valor={p.porSemana ?? 0} onChange={x => editar(p.id, { porSemana: x })} opciones={conLaSuya(POR_SEMANA, p.porSemana ?? 0).map(k => ({ id: k, label: k ? `${k} ${k === 1 ? 'clase' : 'clases'}` : 'Libre' }))} />}
                {(p.tipo === 'pack' || p.tipo === 'membresia') && <Selector label="Vigencia" valor={p.vigenciaDias} onChange={x => editar(p.id, { vigenciaDias: x })} opciones={conLaSuya(VIGENCIAS, p.vigenciaDias).map(d => ({ id: d, label: `${d} días` }))} />}
              </div>
              <div style={{ marginTop: 6 }}>
                <FilaSwitch titulo="Se ofrece en el sitio" ayuda={p.tipo === 'pack' || p.tipo === 'membresia' ? `Apagado, no se vende más; ${n ? `${n === 1 ? 'quien lo tiene lo sigue usando' : 'quienes lo tienen lo siguen usando'} hasta que venza.` : 'nadie lo tiene hoy.'}` : 'Apagado, no aparece en el sitio ni cuando reservan desde ahí. Desde el panel se sigue pudiendo anotar con ella.'} on={p.activo} onChange={x => editar(p.id, { activo: x })} />
              </div>
            </section>
          )
        })}
      </div>
      <BarraGuardar cambiado={b.cambiado} onGuardar={guardar} onDescartar={b.descartar}
        motivo={sinNombre ? 'Ponele un nombre a cada plan' : undefined}
        nota={quitadosConGente ? 'Quien ya tiene un plan que quitaste lo sigue usando hasta que venza.' : undefined} />
    </div>
  )
}
