// Salones: uno o varios (el Jardín, el Arcoíris), cada uno con su nombre, su
// detalle, su capacidad, cuánto dura cada bloque, la limpieza entre uno y
// otro y sus fotos. Se suman y se quitan desde acá; los paquetes de cada uno
// tienen su propia página, los extras son del negocio y el depósito de
// garantía va en Pagos y señas. Si el rubro habla de peloteros o de quinchos,
// la pantalla también.
import { useState } from 'react'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { hhmm, MESES, partes } from '@/lib/reservas/fechas'
import { armarBloques } from '@/lib/reservas/disponibilidad'
import { pesos } from '@/lib/reservas/precio'
import { BarraGuardar, Campo, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { HOY, TIPOS, capital, cuenta, laUnidad, palabrasDe, type Reserva, type Salon } from '../../datos'
import type { Vista } from '../navegacion'
import { PaginaForm, idNuevo, igual, num, type Form } from './comun'

export default function Salones({ negocio, reservas, onGuardar, onIr }: Form & { reservas: Reserva[]; onIr: (vista: Vista) => void }) {
  const palabras = palabrasDe(negocio)
  const [lista, setLista] = useState<Salon[]>(negocio.salones)
  const [abierto, setAbierto] = useState(lista[0]?.id ?? '')
  const cambiado = !igual(lista, negocio.salones)
  const s = lista.find(x => x.id === abierto) ?? lista[0]
  const editar = (c: Partial<Salon>) => s && setLista(lista.map(x => (x.id === s.id ? { ...x, ...c } : x)))
  const agregar = () => {
    const id = idNuevo('s')
    const base = lista[0]
    setLista([...lista, { id, nombre: `${capital(palabras.unidad)} ${lista.length + 1}`, detalle: '', capacidad: base?.capacidad ?? 50, duracionBloque: base?.duracionBloque ?? 240, limpieza: base?.limpieza ?? 60, deposito: base?.deposito ?? 0, fotos: [negocio.fotoPortada], paquetes: (base?.paquetes ?? []).map(p => ({ ...p, id: idNuevo('p') + p.id })) }])
    setAbierto(id)
  }
  // Así quedan los bloques fijos de este salón con estos valores: lo que el cliente ve para elegir.
  const bloques = s ? armarBloques([negocio.apertura.desde, negocio.apertura.hasta], s.duracionBloque, s.limpieza) : []
  const mes = HOY.slice(0, 7)
  const delMes = s ? reservas.filter(r => r.unidadId === s.id && r.estado !== 'cancelada' && (r.fecha ?? '').startsWith(mes)) : []
  const facturado = delMes.filter(r => r.estado !== 'pendiente').reduce((a, r) => a + r.total, 0)
  const sinBloques = lista.some(x => armarBloques([negocio.apertura.desde, negocio.apertura.hasta], x.duracionBloque, x.limpieza).length === 0)
  return (
    <PaginaForm rotulo={TIPOS.bloque.label} titulo={capital(palabras.unidades)} bajada={`${lista.length === 1 ? `Tu ${palabras.unidad}` : `Cada ${palabras.unidad}`}: capacidad, duración de cada bloque, limpieza entre uno y otro y las fotos del sitio. Lo que no esté acá no se puede reservar.`}
      acciones={<button type="button" className="rv-btn rv-btn--sm" onClick={agregar}><Plus size={15} aria-hidden /> Agregar {palabras.unidad}</button>}>
      {lista.length > 1 && (
        <div className="rv-seg" role="group" aria-label={capital(palabras.unidad)} style={{ marginBottom: 14, maxWidth: '100%', overflowX: 'auto' }}>
          {lista.map(x => <button key={x.id} type="button" aria-pressed={x.id === s?.id} onClick={() => setAbierto(x.id)}>{x.nombre}</button>)}
        </div>
      )}
      {s && (
        <div className="rv-pila">
          <Seccion titulo={lista.length > 1 ? s.nombre : capital(laUnidad(palabras))} bajada={negocio.salones.some(x => x.id === s.id) ? `${cuenta(delMes.length, 'evento', 'eventos')} en ${MESES[partes(HOY).mes - 1]} · ${pesos(facturado)} facturados.` : 'Nuevo: todavía sin eventos.'}>
            <div className="rv-pila">
              <div className="rv-dos">
                <Campo label="Nombre" value={s.nombre} onChange={x => editar({ nombre: x })} maxLength={40} />
                <Campo label="Detalle" value={s.detalle} onChange={x => editar({ detalle: x })} placeholder="Pelotero y patio · hasta 60" maxLength={60} ayuda="Se ve debajo del nombre en el sitio." />
              </div>
              <div className="rv-grid rv-grid--3">
                <Campo label="Capacidad máxima" value={String(s.capacidad)} onChange={x => editar({ capacidad: num(x) })} inputMode="numeric" ayuda="Personas, contando a los adultos. Nadie puede reservar para más." />
                <Selector label="Cada bloque dura" valor={s.duracionBloque} onChange={x => editar({ duracionBloque: x })} opciones={[180, 240, 300, 360].map(m => ({ id: m, label: `${m / 60} horas` }))} />
                <Selector label="Limpieza entre bloques" valor={s.limpieza} onChange={x => editar({ limpieza: x })} opciones={[30, 60, 90, 120].map(m => ({ id: m, label: `${m} minutos` }))} />
              </div>
              {bloques.length
                ? <Nota tono="info"><span>Con el horario de {hhmm(negocio.apertura.desde)} a {hhmm(negocio.apertura.hasta)} quedan {bloques.length === 1 ? 'un bloque fijo' : `${bloques.length} bloques fijos`}: {bloques.map(b => `${b.nombre.toLowerCase()} de ${hhmm(b.inicio)} a ${hhmm(b.fin)}`).join(', ')}. Los {s.limpieza} minutos de limpieza del medio no se pueden reservar.</span></Nota>
                : <Nota tono="aviso"><span>Con el horario de {hhmm(negocio.apertura.desde)} a {hhmm(negocio.apertura.hasta)} no entra ningún bloque de {s.duracionBloque / 60} horas: acortalos o cambiá el horario en Horarios.</span></Nota>}
            </div>
          </Seccion>
          <Seccion titulo="Fotos" bajada="Las del sitio. La primera es la de la tarjeta.">
            <div className="alc-fotos">
              {s.fotos.map((f, i) => <img key={`${i}-${f}`} src={f} alt={`Foto ${i + 1} de ${s.nombre}`} loading="lazy" />)}
            </div>
            <p className="ala-pie-nota">En la demo son fotos de ejemplo: no se cargan nuevas.</p>
          </Seccion>
          <Nota><span style={{ flex: 1, minWidth: 0 }}>Los paquetes de {s.nombre} ({cuenta(s.paquetes.length, 'paquete', 'paquetes')}) tienen su página; el depósito de garantía ({s.deposito ? pesos(s.deposito) : 'no se pide'}) se define en Pagos y señas; los extras son del negocio.</span><button type="button" className="rv-btn rv-btn--sm" onClick={() => onIr('paquetes')}>Ir a Paquetes <ArrowRight size={14} aria-hidden /></button></Nota>
          {lista.length > 1 && <button type="button" className="rv-btn rv-btn--peligro" style={{ alignSelf: 'flex-start' }} onClick={() => { const resto = lista.filter(x => x.id !== s.id); setLista(resto); setAbierto(resto[0].id) }}><Trash2 size={15} aria-hidden /> Quitar {s.nombre}</button>}
        </div>
      )}
      <BarraGuardar cambiado={cambiado} motivo={sinBloques ? 'Con esos valores a un salón no le queda ningún bloque.' : lista.length === 0 ? `Dejá al menos ${palabras.genero === 'm' ? 'un' : 'una'} ${palabras.unidad}.` : undefined}
        onDescartar={() => { setLista(negocio.salones); setAbierto(negocio.salones[0]?.id ?? '') }}
        onGuardar={() => onGuardar({ salones: lista.map(x => ({ ...x, nombre: x.nombre.trim() || capital(palabras.unidad), detalle: x.detalle.trim() })) })} />
    </PaginaForm>
  )
}
