// Paquetes del salón: por cantidad de invitados, con lo que incluye cada uno.
// Cada paquete dice cuántos eventos lo eligieron.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { pesos } from '@/lib/reservas/precio'
import { Area, BarraGuardar, Campo, Vacio } from '@/design-system/reservas/piezas'
import { TIPOS, cuenta, type Paquete, type Reserva } from '../../datos'
import { PaginaForm, idNuevo, igual, num, type Form } from './comun'

export default function Paquetes({ negocio, reservas, onGuardar }: Form & { reservas: Reserva[] }) {
  const s = negocio.salon
  const origen = s?.paquetes ?? []
  const [lista, setLista] = useState<Paquete[]>(origen)
  const cambiado = !igual(lista, origen)
  const capacidad = s?.capacidad ?? 0
  const editar = (id: string, c: Partial<Paquete>) => setLista(lista.map(p => (p.id === id ? { ...p, ...c } : p)))
  const eventos = (id: string) => reservas.filter(r => r.paqueteId === id && r.estado !== 'cancelada')
  const guardar = () => onGuardar({ salon: { capacidad: 50, duracionBloque: 240, limpieza: 60, extras: [], deposito: 0, fotos: [], ...s, paquetes: lista.map(p => ({ ...p, nombre: p.nombre.trim() || 'Paquete', incluye: p.incluye.map(x => x.trim()).filter(Boolean) })) } })
  return (
    <PaginaForm rotulo={TIPOS.bloque.label} titulo="Paquetes" bajada="Por cantidad de invitados. El precio incluye lo que digas que incluye; los extras se suman aparte."
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setLista([...lista, { id: idNuevo('p'), nombre: 'Nuevo paquete', hastaInvitados: Math.min(40, capacidad || 40), precio: 300000, incluye: ['Mesas, sillas y vajilla'] }])}><Plus size={15} aria-hidden /> Agregar paquete</button>}>
      <div className="rv-pila">
        {lista.length === 0 && <Vacio titulo="Sin paquetes" texto="Sin paquetes no se puede reservar el salón: agregá al menos uno." />}
        {lista.map(p => {
          const suyos = eventos(p.id)
          return (
            <div key={p.id} className="rv-card rv-card--pad">
              <div className="alc-paquete">
                <div className="alc-fila alc-fila--paquete">
                  <Campo label="Nombre" value={p.nombre} onChange={x => editar(p.id, { nombre: x })} />
                  <Campo label="Hasta" value={String(p.hastaInvitados)} onChange={x => editar(p.id, { hastaInvitados: num(x) })} inputMode="numeric" error={p.hastaInvitados > capacidad ? `El salón es para ${capacidad}` : undefined} />
                  <Campo label="Precio" prefijo="$" value={String(p.precio)} onChange={x => editar(p.id, { precio: num(x) })} inputMode="numeric" />
                  <button type="button" className="rv-btn rv-btn--icono" onClick={() => setLista(lista.filter(x => x.id !== p.id))} aria-label={`Quitar ${p.nombre}`} disabled={lista.length <= 1}><Trash2 size={16} /></button>
                </div>
                {/* Uno por renglón. Se guarda el texto tal cual mientras se escribe (si no, el renglón vacío del Enter desaparecía) y se limpia al guardar. */}
                <Area label="Qué incluye (uno por renglón)" value={p.incluye.join('\n')} onChange={x => editar(p.id, { incluye: x.split('\n') })} maxLength={400} />
              </div>
              <p className="ala-pie-nota">{origen.some(x => x.id === p.id) ? (suyos.length ? `${cuenta(suyos.length, 'evento', 'eventos')} con este paquete · ${pesos(suyos.reduce((a, r) => a + r.total, 0))} en total` : 'Ningún evento lo eligió todavía') : 'Nuevo: todavía nadie lo vio'}.</p>
            </div>
          )
        })}
      </div>
      <BarraGuardar cambiado={cambiado} motivo={lista.length === 0 ? 'Agregá al menos un paquete.' : undefined} onDescartar={() => setLista(origen)} onGuardar={guardar} />
    </PaginaForm>
  )
}
