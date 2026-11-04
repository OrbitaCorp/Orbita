// Extras: lo que se suma al total si el cliente lo marca al reservar. Son del
// negocio, no de cada cancha ni de cada salón: la iluminación o las pelotas en
// las canchas; el DJ, los inflables, el animador en los salones. Cada uno dice
// cuántas veces lo pidieron, así se ve cuál conviene mantener.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { MESES, partes } from '@/lib/reservas/fechas'
import { pesos, type Extra } from '@/lib/reservas/precio'
import { BarraGuardar, Campo, Nota, Vacio } from '@/design-system/reservas/piezas'
import { HOY, TIPOS, cuenta, type Reserva } from '../../datos'
import { PaginaForm, idNuevo, igual, num, type Form } from './comun'

export default function Extras({ negocio, reservas, onGuardar }: Form & { reservas: Reserva[] }) {
  const enSalon = negocio.tipo === 'bloque'
  const origen = negocio.extras
  const [lista, setLista] = useState<Extra[]>(origen)
  const cambiado = !igual(lista, origen)
  const editar = (id: string, c: Partial<Extra>) => setLista(lista.map(e => (e.id === id ? { ...e, ...c } : e)))
  const activas = reservas.filter(r => r.estado !== 'cancelada')
  const veces = (id: string) => activas.filter(r => r.extras.includes(id)).length
  const mes = HOY.slice(0, 7)
  const delMes = activas.filter(r => (r.fecha ?? '').startsWith(mes) && r.extras.length)
  const sumaMes = delMes.reduce((s, r) => s + origen.filter(e => r.extras.includes(e.id)).reduce((a, e) => a + e.precio, 0), 0)
  const guardar = () => onGuardar({ extras: lista.map(e => ({ ...e, nombre: e.nombre.trim() || 'Extra' })) })
  return (
    <PaginaForm rotulo={TIPOS[negocio.tipo].label} titulo="Extras" bajada={enSalon ? `DJ, inflables, animador, mozo, torta, decoración: lo que se suma al paquete${negocio.salones.length > 1 ? ', en cualquiera de los salones' : ''}.` : 'Iluminación, pelotas, pecheras: se suman al total si el cliente los marca.'}
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setLista([...lista, { id: idNuevo('e'), nombre: 'Nuevo extra', precio: enSalon ? 20000 : 2000 }])}><Plus size={15} aria-hidden /> Agregar extra</button>}>
      <div className="rv-pila">
        {lista.length === 0 ? <Vacio titulo="Sin extras" texto="El paso de extras se saltea al reservar." /> : (
          <div className="rv-card rv-card--pad">
            <div className="rv-pila">
              {lista.map(e => (
                <div key={e.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                  <div className="alc-fila alc-fila--extra">
                    <Campo label="Nombre" value={e.nombre} onChange={x => editar(e.id, { nombre: x })} />
                    <Campo label="Precio" prefijo="$" value={String(e.precio)} onChange={x => editar(e.id, { precio: num(x) })} inputMode="numeric" />
                    <button type="button" className="rv-btn rv-btn--icono" onClick={() => setLista(lista.filter(x => x.id !== e.id))} aria-label={`Quitar ${e.nombre}`}><Trash2 size={16} /></button>
                  </div>
                  <p className="ala-pie-nota" style={{ marginTop: 8 }}>{origen.some(x => x.id === e.id) ? (veces(e.id) ? `Pedido ${cuenta(veces(e.id), 'vez', 'veces')} · ${pesos(veces(e.id) * e.precio)} en total` : 'Nadie lo pidió todavía') : 'Nuevo: todavía nadie lo vio'}.</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {origen.length > 0 && <Nota tono="info"><span>En {MESES[partes(HOY).mes - 1]} los extras sumaron {pesos(sumaMes)} en {cuenta(delMes.length, enSalon ? 'evento' : 'reserva', enSalon ? 'eventos' : 'reservas')}.</span></Nota>}
      </div>
      <BarraGuardar cambiado={cambiado} onDescartar={() => setLista(origen)} onGuardar={guardar} />
    </PaginaForm>
  )
}
