// Canchas (o salas, boxes, estudios: lo que se alquila por hora): cada una
// con su detalle y su precio por hora, y cómo le fue este mes. Lo que no esté
// acá no se puede reservar.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { MESES, partes } from '@/lib/reservas/fechas'
import { conAjuste, pesos, redondearCien } from '@/lib/reservas/precio'
import { BarraGuardar, Campo } from '@/design-system/reservas/piezas'
import { HOY, TIPOS, cadaUna, capital, cuenta, palabrasDe, type Reserva, type Unidad } from '../../datos'
import { PaginaForm, idNuevo, igual, num, type Form } from './comun'

export default function Canchas({ negocio, reservas, onGuardar }: Form & { reservas: Reserva[] }) {
  const palabras = palabrasDe(negocio)
  const [lista, setLista] = useState<Unidad[]>(negocio.unidades)
  const cambiado = !igual(lista, negocio.unidades)
  const editar = (id: string, c: Partial<Unidad>) => setLista(l => l.map(u => (u.id === id ? { ...u, ...c } : u)))
  const mes = HOY.slice(0, 7)
  const nombreMes = MESES[partes(HOY).mes - 1]
  // Con las franjas de Precios por horario, lo que vale la hora en el horario más barato y en el más caro.
  const ajustes = negocio.reglasPrecio.map(r => r.ajuste)
  const bajo = Math.min(0, ...ajustes)
  const alto = Math.max(0, ...ajustes)
  return (
    <PaginaForm rotulo={TIPOS.cancha.label} titulo={capital(palabras.unidades)} bajada={`${capital(cadaUna(palabras))} con su precio por hora. Lo que no esté acá no se puede reservar.`}
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={() => setLista([...lista, { id: idNuevo('u'), nombre: `${capital(palabras.unidad)} ${lista.length + 1}`, detalle: '', tarifaHora: 40000, foto: negocio.fotoPortada }])}><Plus size={15} aria-hidden /> Agregar {palabras.unidad}</button>}>
      <div className="rv-pila">
        {lista.map(u => {
          const delMes = reservas.filter(r => r.unidadId === u.id && r.estado !== 'cancelada' && (r.fecha ?? '').startsWith(mes))
          const facturado = delMes.filter(r => r.estado !== 'pendiente').reduce((s, r) => s + r.total, 0)
          return (
            <div key={u.id} className="rv-card rv-card--pad">
              <div className="alc-fila">
                <Campo label="Nombre" value={u.nombre} onChange={x => editar(u.id, { nombre: x })} />
                <Campo label="Detalle" value={u.detalle} onChange={x => editar(u.id, { detalle: x })} placeholder={negocio.rubro === 'canchas' ? 'Fútbol 5 · techada' : 'Qué tiene, para cuántos'} />
                <Campo label="Por hora" prefijo="$" value={String(u.tarifaHora)} onChange={x => editar(u.id, { tarifaHora: num(x) })} inputMode="numeric" />
                <button type="button" className="rv-btn rv-btn--icono" onClick={() => setLista(lista.filter(x => x.id !== u.id))} aria-label={`Quitar ${u.nombre}`} disabled={lista.length <= 1}><Trash2 size={16} /></button>
              </div>
              <p className="ala-pie-nota">
                {negocio.unidades.some(x => x.id === u.id) ? `${cuenta(delMes.length, 'reserva', 'reservas')} en ${nombreMes} · ${pesos(facturado)} facturados` : `${palabras.genero === 'm' ? 'Nuevo' : 'Nueva'}: todavía sin reservas`}
                {ajustes.length > 0 && u.tarifaHora > 0 ? ` · con las franjas, la hora va de ${pesos(redondearCien(conAjuste(u.tarifaHora, bajo)))} a ${pesos(redondearCien(conAjuste(u.tarifaHora, alto)))}` : ''}.
              </p>
            </div>
          )
        })}
      </div>
      <BarraGuardar cambiado={cambiado} onDescartar={() => setLista(negocio.unidades)} onGuardar={() => onGuardar({ unidades: lista.map(u => ({ ...u, nombre: u.nombre.trim() || capital(palabras.unidad) })) })} />
    </PaginaForm>
  )
}
