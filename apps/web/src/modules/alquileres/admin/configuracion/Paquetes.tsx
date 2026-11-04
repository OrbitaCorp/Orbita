// Paquetes de cada salón: por cantidad de invitados, con lo que incluye cada
// uno. Son del salón (el Jardín y el Arcoíris no cuestan lo mismo), así que
// con varios salones se editan uno por vez. Cada paquete dice cuántos eventos
// lo eligieron.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { pesos } from '@/lib/reservas/precio'
import { Area, BarraGuardar, Campo, Vacio } from '@/design-system/reservas/piezas'
import { TIPOS, capital, cuenta, palabrasDe, type Paquete, type Reserva, type Salon } from '../../datos'
import { PaginaForm, idNuevo, igual, num, type Form } from './comun'

export default function Paquetes({ negocio, reservas, onGuardar }: Form & { reservas: Reserva[] }) {
  const palabras = palabrasDe(negocio)
  const [salones, setSalones] = useState<Salon[]>(negocio.salones)
  const [abierto, setAbierto] = useState(salones[0]?.id ?? '')
  const s = salones.find(x => x.id === abierto) ?? salones[0]
  const cambiado = !igual(salones, negocio.salones)
  const lista = s?.paquetes ?? []
  const capacidad = s?.capacidad ?? 0
  const setLista = (paquetes: Paquete[]) => s && setSalones(salones.map(x => (x.id === s.id ? { ...x, paquetes } : x)))
  const editar = (id: string, c: Partial<Paquete>) => setLista(lista.map(p => (p.id === id ? { ...p, ...c } : p)))
  const eventos = (id: string) => reservas.filter(r => r.paqueteId === id && r.estado !== 'cancelada')
  const origen = negocio.salones.find(x => x.id === s?.id)?.paquetes ?? []
  const guardar = () => onGuardar({ salones: salones.map(x => ({ ...x, paquetes: x.paquetes.map(p => ({ ...p, nombre: p.nombre.trim() || 'Paquete', incluye: p.incluye.map(i => i.trim()).filter(Boolean) })) })) })
  const sinPaquetes = salones.find(x => x.paquetes.length === 0)
  return (
    <PaginaForm rotulo={TIPOS.bloque.label} titulo="Paquetes" bajada={`Por cantidad de invitados${salones.length > 1 ? `, de cada ${palabras.unidad}` : ''}. El precio incluye lo que digas que incluye; los extras se suman aparte.`}
      acciones={s && <button type="button" className="rv-btn rv-btn--sm" onClick={() => setLista([...lista, { id: idNuevo('p'), nombre: 'Nuevo paquete', hastaInvitados: Math.min(40, capacidad || 40), precio: 300000, incluye: ['Mesas, sillas y vajilla'] }])}><Plus size={15} aria-hidden /> Agregar paquete</button>}>
      {salones.length > 1 && (
        <div className="rv-seg" role="group" aria-label={capital(palabras.unidad)} style={{ marginBottom: 14, maxWidth: '100%', overflowX: 'auto' }}>
          {salones.map(x => <button key={x.id} type="button" aria-pressed={x.id === s?.id} onClick={() => setAbierto(x.id)}>{x.nombre} · {x.paquetes.length}</button>)}
        </div>
      )}
      <div className="rv-pila">
        {!s && <Vacio titulo={`Sin ${palabras.unidades}`} texto={`Cargá ${palabras.genero === 'm' ? 'el primero' : 'la primera'} en ${capital(palabras.unidades)}.`} />}
        {s && lista.length === 0 && <Vacio titulo="Sin paquetes" texto={`Sin paquetes no se puede reservar ${s.nombre}: agregá al menos uno.`} />}
        {lista.map(p => {
          const suyos = eventos(p.id)
          return (
            <div key={p.id} className="rv-card rv-card--pad">
              <div className="alc-paquete">
                <div className="alc-fila alc-fila--paquete">
                  <Campo label="Nombre" value={p.nombre} onChange={x => editar(p.id, { nombre: x })} />
                  <Campo label="Hasta" value={String(p.hastaInvitados)} onChange={x => editar(p.id, { hastaInvitados: num(x) })} inputMode="numeric" error={p.hastaInvitados > capacidad ? `${s?.nombre ?? 'El salón'} es para ${capacidad}` : undefined} />
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
      <BarraGuardar cambiado={cambiado} motivo={sinPaquetes ? `${sinPaquetes.nombre} se queda sin paquetes: agregá al menos uno.` : undefined} onDescartar={() => setSalones(negocio.salones)} onGuardar={guardar} />
    </PaginaForm>
  )
}
